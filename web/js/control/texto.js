// Normalización de texto para formularios de Control de Contratos.
// El usuario puede escribir en cualquier combinación de mayúsculas/
// minúsculas (incluido todo en mayúscula sostenida); al guardar se
// homogeniza a formato "oración" (primera letra en mayúscula, resto en
// minúscula) o a formato "nombre propio" (título), respetando:
// - siglas de una lista fija (SAS, GGC, NIT...) que siempre quedan en
//   mayúscula sin importar cómo se escribieron
// - nombres propios/ciudades de uso frecuente en la operación (lista fija,
//   ampliar aquí si aparecen casos nuevos)

const SIGLAS = ["SAS", "LTDA", "IPS", "ESE", "EPS", "ESP", "ONG", "NIT", "GGC", "AGPE", "RETIE"];

const PROPIOS = [
  "Neiva", "Huila", "Colombia", "Pitalito", "Garzón", "Campoalegre",
  "Rivera", "Palermo", "Aipe", "Baraya", "Gigante", "Tesalia", "Íquira",
  "Yaguará", "Hobo", "Bogotá", "Medellín", "Cali", "Barranquilla"
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

// Una sigla que no está en la lista fija (ej. RETIE, ANROER, o cualquier
// otra que aparezca en un contrato futuro) se perdía en minúscula sin
// avisar, porque solo se respetaban SIGLAS/PROPIOS. En vez de tener que
// mantener esa lista al día con cada sigla nueva, se respeta tal cual
// cualquier palabra de 2+ letras que el usuario ya haya escrito TODA en
// mayúscula — se toma como señal de que es una sigla a propósito, no un
// descuido de digitación (que normalmente no produce una palabra entera en
// mayúscula sostenida).
function pareceSiglaEscrita(nucleo) {
  return nucleo.length >= 2 && nucleo === nucleo.toUpperCase() && nucleo !== nucleo.toLowerCase();
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

export function capitalizarOracion(texto) {
  const limpio = (texto || "").trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  return limpio
    .split(" ")
    .map((palabra, i) => {
      const sigla = siglaPunteada(palabra);
      if (sigla) return sigla;
      const { pre, nucleo, post } = dividirPalabra(palabra);
      if (!nucleo) return palabra;
      const fijo = valorFijo(nucleo);
      if (fijo) return pre + fijo + post;
      if (pareceSiglaEscrita(nucleo)) return pre + nucleo + post;
      const base = nucleo.toLowerCase();
      const cuerpo = i === 0 ? base.charAt(0).toUpperCase() + base.slice(1) : base;
      return pre + cuerpo + post;
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

export function capitalizarNombrePropio(texto) {
  const limpio = (texto || "").trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  return limpio
    .split(" ")
    .map((palabra, i) => {
      const sigla = siglaPunteada(palabra);
      if (sigla) return sigla;
      const { pre, nucleo, post } = dividirPalabra(palabra);
      if (!nucleo) return palabra;
      const fijo = valorFijo(nucleo);
      if (fijo) return pre + fijo + post;
      if (pareceSiglaEscrita(nucleo)) return pre + nucleo + post;
      const base = nucleo.toLowerCase();
      const cuerpo = i > 0 && CONECTORES.has(base) ? base : base.charAt(0).toUpperCase() + base.slice(1);
      return pre + cuerpo + post;
    })
    .join(" ");
}
