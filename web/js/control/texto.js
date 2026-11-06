// Normalización de texto para formularios de Control de Contratos.
// Se respetan las mayúsculas que la persona escribe (nombres propios,
// siglas, "No.", códigos); solo se asegura la mayúscula al inicio de cada
// oración (o de cada palabra, en nombres). Únicamente si el texto entero
// viene en MAYÚSCULA SOSTENIDA se rehace a formato "oración" o "nombre
// propio". En ambos casos se corrigen siempre:
// - siglas de una lista fija (SAS, GGC, NIT...) que siempre quedan en
//   mayúscula sin importar cómo se escribieron
// - nombres propios/ciudades de uso frecuente en la operación (lista fija,
//   ampliar aquí si aparecen casos nuevos)

const SIGLAS = ["SAS", "LTDA", "IPS", "ESE", "EPS", "ESP", "ONG", "NIT", "GGC", "AGPE", "RETIE"];

const PROPIOS = [
  "Neiva", "Huila", "Colombia", "Pitalito", "Garzón", "Campoalegre",
  "Rivera", "Palermo", "Aipe", "Baraya", "Gigante", "Tesalia", "Íquira",
  "Yaguará", "Hobo", "Bogotá", "Medellín", "Cali", "Barranquilla",
  "Electrohuila", "Utrahuilca"
];

const CONECTORES = new Set([
  "de", "del", "la", "las", "los", "el", "y", "e", "en", "a", "al",
  "para", "por", "con", "sin", "o", "u"
]);

const LETRA = "a-zA-Zá-úÁ-ÚñÑüÜ";
const PATRON_PALABRA = new RegExp(`^([^${LETRA}]*)([${LETRA}]*)([^${LETRA}]*)$`);

function dividirPalabra(palabra) {
  const m = palabra.match(PATRON_PALABRA);
  return m ? { pre: m[1], nucleo: m[2], post: m[3] } : { pre: "", nucleo: palabra, post: "" };
}

// Valor fijo (sigla o nombre propio) para un núcleo alfabético, o null si
// debe tratarse como palabra común (minúscula salvo mayúscula inicial).
function valorFijo(nucleo) {
  const sigla = SIGLAS.find((s) => s.toLowerCase() === nucleo.toLowerCase());
  if (sigla) return sigla;
  return PROPIOS.find((p) => p.toLowerCase() === nucleo.toLowerCase()) || null;
}

// Reconoce una sigla escrita con un punto entre cada letra (ej. "S.A.S.",
// "s.a.s", "E.S.P."), un patrón muy común en razones sociales que
// dividirPalabra() no captura por sí solo (esa función solo separa
// puntuación al inicio/final de la palabra, no intercalada letra a letra).
const PATRON_SIGLA_PUNTEADA = /^[a-zA-Zá-úÁ-Ú](\.[a-zA-Zá-úÁ-Ú])+\.?$/;

function siglaPunteada(palabra) {
  if (!PATRON_SIGLA_PUNTEADA.test(palabra)) return null;
  const letras = palabra.replace(/\./g, "");
  const sigla = SIGLAS.find((s) => s.toLowerCase() === letras.toLowerCase());
  return sigla ? sigla.split("").join(".") + "." : null;
}

// ¿El texto viene en mayúscula sostenida (pegado de un documento en
// MAYÚSCULAS, o escrito con Bloq Mayús)? Solo en ese caso se rehace el uso
// de mayúsculas; si no, se respeta lo que la persona escribió — antes se
// pasaba a minúscula cualquier palabra con mayúscula inicial en medio del
// texto (Electrohuila, Utrahuilca, No., Infrared...) y no había forma de
// dejarla bien (pedido del usuario 2026-11-06).
function esMayusculaSostenida(texto) {
  const letras = texto.replace(new RegExp(`[^${LETRA}]`, "g"), "");
  if (letras.length < 8) return false;
  const mayusculas = letras.replace(/[^A-ZÁ-ÚÑÜ]/g, "").length;
  return mayusculas / letras.length > 0.8;
}

// Palabra con dígitos (CE-06-2025..., 176-2026, N.°3): es un código, se deja tal cual.
const tieneDigito = (palabra) => /\d/.test(palabra);
const mayusculaInicial = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Normaliza una palabra cuando el texto venía todo en mayúscula: siglas
// de la lista, sigla punteada (J.C.S.) y códigos quedan; el resto pasa a
// minúscula (con la inicial en mayúscula si "inicial" es true).
function palabraDesdeMayusculas(palabra, inicial) {
  if (tieneDigito(palabra) || PATRON_SIGLA_PUNTEADA.test(palabra)) return palabra;
  const { pre, nucleo, post } = dividirPalabra(palabra);
  if (!nucleo) return palabra;
  const fijo = valorFijo(nucleo);
  if (fijo) return pre + fijo + post;
  const base = nucleo.toLowerCase();
  return pre + (inicial ? mayusculaInicial(base) : base) + post;
}

// Respeta la palabra como se escribió; solo corrige las siglas y nombres
// propios de la lista fija (ej. "sas" → "SAS", "neiva" → "Neiva").
function palabraRespetada(palabra) {
  const sigla = siglaPunteada(palabra);
  if (sigla) return sigla;
  const { pre, nucleo, post } = dividirPalabra(palabra);
  const fijo = nucleo && valorFijo(nucleo);
  return fijo ? pre + fijo + post : palabra;
}

export function capitalizarOracion(texto) {
  const limpio = (texto || "").trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  const sostenida = esMayusculaSostenida(limpio);
  const palabras = limpio.split(" ");
  return palabras
    .map((palabra, i) => {
      // Inicio del texto o de una oración nueva (después de ". "), salvo
      // abreviaturas cortas tipo "No." / "N.°" que no cierran oración.
      const anterior = palabras[i - 1] || "";
      const inicioOracion = i === 0 || (/[.!?]$/.test(anterior)
        && !/^(no|n\.?°?|nro|art|num)\.$/i.test(anterior)
        && !PATRON_SIGLA_PUNTEADA.test(anterior));
      const resultado = sostenida ? palabraDesdeMayusculas(palabra, inicioOracion) : palabraRespetada(palabra);
      return inicioOracion && !sostenida ? mayusculaInicial(resultado) : resultado;
    })
    .join(" ");
}

// Para etiquetas de <option> (ej. "código — objeto del contrato"): el
// objeto de un contrato puede ser una frase legal larguísima, y el menú
// desplegable nativo del navegador no la envuelve ni la trunca — solo el
// <select> cerrado respeta el ancho vía CSS, pero la lista abierta no. Se
// recorta el texto de raíz para que la lista abierta tampoco se desborde.
export function truncar(texto, maximo = 90) {
  const limpio = (texto || "").trim();
  if (limpio.length <= maximo) return limpio;
  return limpio.slice(0, maximo - 1).trim() + "…";
}

// Nombres (cliente, supervisor): cada palabra con inicial mayúscula salvo
// los conectores (de, del, y...). Lo que ya venga con mayúsculas por dentro
// (siglas como INFRARED o J.C.S., "McDonald") se respeta; solo si el nombre
// entero venía en mayúscula sostenida se rehace a "Nombre Propio".
export function capitalizarNombrePropio(texto) {
  const limpio = (texto || "").trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  const sostenida = esMayusculaSostenida(limpio);
  return limpio
    .split(" ")
    .map((palabra, i) => {
      const sigla = siglaPunteada(palabra);
      if (sigla) return sigla;
      if (tieneDigito(palabra)) return palabra;
      const { pre, nucleo, post } = dividirPalabra(palabra);
      if (!nucleo) return palabra;
      const fijo = valorFijo(nucleo);
      if (fijo) return pre + fijo + post;
      if (sostenida && PATRON_SIGLA_PUNTEADA.test(palabra)) return palabra;
      const base = sostenida ? nucleo.toLowerCase() : nucleo;
      if (i > 0 && CONECTORES.has(nucleo.toLowerCase())) return pre + nucleo.toLowerCase() + post;
      return pre + mayusculaInicial(base) + post;
    })
    .join(" ");
}

// Fecha AAAA-MM-DD en la hora de Colombia (la del equipo), no en UTC: con toISOString() desde las 7:00 p. m.
// la fecha ya salía con el día siguiente (ej. una carta del 26 de octubre radicada «27 de octubre»).
export function fechaLocalISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
