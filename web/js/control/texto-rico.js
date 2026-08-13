// Campo de texto con formato (Negrilla/Cursiva/Color) para los bloques de
// tipo "párrafo" en Informes/Ofertas/Correspondencia — mismo patrón ya
// probado en el repo hermano LBDC Neiva (web/js/utils.js), adaptado aquí
// porque este editor de bloques construye el DOM con createElement (no
// innerHTML), no con strings de HTML.
//
// Se usa contenteditable en vez de <textarea> porque un <textarea> solo
// guarda texto plano, no puede mostrar negrilla/cursiva/color.

// Texto plano (registros ya guardados como string simple, antes de existir
// esta barra) a HTML seguro: escapa < & etc. y pasa saltos de línea a <br>.
export function htmlDesdeTextoPlano(texto) {
  if (!texto) return "";
  const span = document.createElement("span");
  span.textContent = texto;
  return span.innerHTML.replace(/\n/g, "<br>");
}

// Un bloque "párrafo" puede traer, según de dónde vino (tecleado a mano,
// importado desde un JSON extraído de Word, un registro viejo), texto
// plano o HTML ya con formato — se detecta si "parece" HTML para mostrarlo
// bien en cualquiera de los dos casos, sin necesitar convertir los datos.
export function htmlParaCampoRico(valor) {
  if (!valor) return "";
  return /<[a-z][\s\S]*>/i.test(valor) ? valor : htmlDesdeTextoPlano(valor);
}

// Construye el campo (barra + contenteditable) con la API del DOM, para
// insertarlo tal cual en el editor de bloques existente. `onInput` recibe
// el HTML actual cada vez que cambia el contenido.
export function crearCampoTextoRico({ valor, placeholder, onInput }) {
  const wrap = document.createElement("div");
  wrap.className = "control-rich-campo";

  const toolbar = document.createElement("div");
  toolbar.className = "control-rich-toolbar";

  const btnNegrita = document.createElement("button");
  btnNegrita.type = "button";
  btnNegrita.className = "control-rich-btn";
  btnNegrita.dataset.cmd = "bold";
  btnNegrita.title = "Negrilla";
  btnNegrita.innerHTML = "<b>N</b>";

  const btnCursiva = document.createElement("button");
  btnCursiva.type = "button";
  btnCursiva.className = "control-rich-btn";
  btnCursiva.dataset.cmd = "italic";
  btnCursiva.title = "Cursiva";
  btnCursiva.innerHTML = "<i>C</i>";

  const btnVineta = document.createElement("button");
  btnVineta.type = "button";
  btnVineta.className = "control-rich-btn";
  btnVineta.dataset.cmd = "insertUnorderedList";
  btnVineta.title = "Viñeta";
  btnVineta.textContent = "•";

  const btnTabulador = document.createElement("button");
  btnTabulador.type = "button";
  btnTabulador.className = "control-rich-btn";
  btnTabulador.title = "Sangría / sub-viñeta (Tab dentro del texto hace lo mismo, Shift+Tab quita sangría)";
  btnTabulador.textContent = "⇥";

  const inputColor = document.createElement("input");
  inputColor.type = "color";
  inputColor.className = "control-rich-color";
  inputColor.dataset.cmd = "foreColor";
  inputColor.title = "Color de letra";
  inputColor.value = "#1a1a1a";

  toolbar.append(btnNegrita, btnCursiva, btnVineta, btnTabulador, inputColor);

  const editable = document.createElement("div");
  editable.className = "control-rich-editable";
  editable.contentEditable = "true";
  editable.dataset.placeholder = placeholder || "";
  editable.innerHTML = htmlParaCampoRico(valor);

  editable.addEventListener("input", () => onInput?.(editable.innerHTML));

  // "indent" fuera de una viñeta se vuelve una cita/blockquote que el
  // exportador a PDF/Word no sabe dibujar (parsearHtmlARuns solo entiende
  // sangría dentro de <ul>/<li>) — por eso, si el cursor no está ya en una
  // viñeta, primero se crea una antes de sangrar.
  function sangrar(quitar) {
    editable.focus();
    if (!quitar && !document.queryCommandState("insertUnorderedList")) {
      document.execCommand("insertUnorderedList", false, null);
    }
    document.execCommand(quitar ? "outdent" : "indent", false, null);
    onInput?.(editable.innerHTML);
  }

  // Tab/Shift+Tab dentro del campo = sangrar/quitar sangría (crea sub-viñeta
  // cuando el cursor está dentro de una viñeta), en vez de saltar de foco al
  // siguiente campo — mismo resultado que el botón "⇥" pero con la tecla que
  // el usuario espera para "tabulador".
  editable.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    sangrar(e.shiftKey);
  });

  let ultimaSeleccion = null;
  editable.addEventListener("mouseup", guardarSeleccion);
  editable.addEventListener("keyup", guardarSeleccion);
  function guardarSeleccion() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) ultimaSeleccion = sel.getRangeAt(0).cloneRange();
  }

  toolbar.addEventListener("mousedown", (e) => {
    if (e.target.closest(".control-rich-btn")) e.preventDefault();
  });
  toolbar.addEventListener("click", (e) => {
    const btn = e.target.closest(".control-rich-btn");
    if (!btn) return;
    if (btn === btnTabulador) { sangrar(false); return; }
    editable.focus();
    document.execCommand(btn.dataset.cmd, false, null);
    onInput?.(editable.innerHTML);
  });
  inputColor.addEventListener("input", () => {
    editable.focus();
    if (ultimaSeleccion) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(ultimaSeleccion);
    }
    document.execCommand("foreColor", false, inputColor.value);
    onInput?.(editable.innerHTML);
  });

  wrap.append(toolbar, editable);
  return wrap;
}

// ---- Para el render en PDF (jsPDF no entiende HTML): convierte el HTML
// de un campo rico a una secuencia plana de "runs" {texto, negrita,
// cursiva, color} + marcadores {salto:true} donde había <br> o un límite
// de <div>/<p> (así es como un contenteditable representa cada línea
// nueva) — cada *-pdf.js dibuja esta secuencia con su propio ancho de
// página/posición (no se comparte esa parte: cada archivo ya maneja su
// propio "y" e "saltoSiNoCabe", como el resto de los -pdf.js de este
// proyecto).
// Marcador según nivel de anidación (0 = viñeta de primer nivel), igual al
// criterio que ya se usaba tecleando a mano "·" / "o" en los informes.
// Se evitan glifos "○"/"▪": la fuente helvetica estándar de jsPDF (WinAnsi)
// no los tiene y saldrían en blanco en el PDF.
const MARCADORES_VINETA = ["•", "o", "-"];

export function parsearHtmlARuns(html) {
  if (!html) return [];
  const raiz = document.createElement("div");
  raiz.innerHTML = html;
  const runs = [];

  function caminar(nodo, estilo, nivel) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      if (nodo.textContent) runs.push({ texto: nodo.textContent, ...estilo });
      return;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;
    if (nodo.tagName === "BR") { runs.push({ salto: true }); return; }

    // Las listas (creadas con los botones "•"/"⇥" o Tab dentro del campo
    // rico) se aplanan a texto plano con el marcador + sangría ya puestos,
    // en vez de introducir un formato de "run" nuevo: así ningún *-pdf.js /
    // *-docx.js necesita enterarse de que existen viñetas.
    if (nodo.tagName === "UL" || nodo.tagName === "OL") {
      nodo.childNodes.forEach((hijo) => {
        if (hijo.nodeType === Node.ELEMENT_NODE && hijo.tagName === "LI") caminarItemLista(hijo, estilo, nivel);
      });
      return;
    }

    const nuevoEstilo = { ...estilo };
    if (nodo.tagName === "B" || nodo.tagName === "STRONG") nuevoEstilo.negrita = true;
    if (nodo.tagName === "I" || nodo.tagName === "EM") nuevoEstilo.cursiva = true;
    if (nodo.style && nodo.style.color) nuevoEstilo.color = rgbDesdeCss(nodo.style.color);

    nodo.childNodes.forEach((hijo) => caminar(hijo, nuevoEstilo, nivel));
    // Si el último hijo ya era un <br> (ej. "<div><br></div>", una línea en
    // blanco), ese <br> ya dejó puesto el salto que representa el final de
    // esta línea — no agregar un segundo por el cierre del propio div/p, o
    // una sola línea en blanco terminaría ocupando el doble en el PDF/Word.
    if ((nodo.tagName === "DIV" || nodo.tagName === "P") && !(runs.length && runs[runs.length - 1].salto)) {
      runs.push({ salto: true });
    }
  }

  function caminarItemLista(li, estilo, nivel) {
    const marcador = MARCADORES_VINETA[Math.min(nivel, MARCADORES_VINETA.length - 1)];
    // nivel + 1, no nivel: un <ul> de primer nivel (sin anidar, nivel=0) ya
    // se ve indentado en el navegador por su estilo por defecto — con solo
    // "nivel" repeticiones esa viñeta salía pegada al margen del párrafo en
    // el PDF/Word, sin la sangría que sí se ve en el editor.
    runs.push({ texto: "    ".repeat(nivel + 1) + marcador + " ", ...estilo });
    const hijos = Array.from(li.childNodes);
    hijos.forEach((hijo) => {
      // Chrome anida "indent" dentro de una viñeta como <ul> hijo del <li>.
      if (hijo.nodeType === Node.ELEMENT_NODE && (hijo.tagName === "UL" || hijo.tagName === "OL")) {
        runs.push({ salto: true });
        hijo.childNodes.forEach((nieto) => {
          if (nieto.nodeType === Node.ELEMENT_NODE && nieto.tagName === "LI") caminarItemLista(nieto, estilo, nivel + 1);
        });
      } else {
        caminar(hijo, estilo, nivel);
      }
    });
    // Si el último hijo fue una sub-lista, ella ya cerró su último ítem con
    // su propio salto — no duplicarlo (dejaría una línea en blanco antes
    // del siguiente ítem del nivel superior).
    const ultimo = hijos[hijos.length - 1];
    const terminaEnSublista = ultimo?.nodeType === Node.ELEMENT_NODE && (ultimo.tagName === "UL" || ultimo.tagName === "OL");
    if (!terminaEnSublista) runs.push({ salto: true });
  }

  raiz.childNodes.forEach((hijo) => caminar(hijo, {}, 0));

  // Las líneas en blanco que el usuario deja a propósito dentro de un
  // párrafo (al principio, en medio o al final) SÍ deben verse como espacio
  // real en el PDF/Word — ej. para separar una lista o un bloque de texto
  // del resto del párrafo — así que no se recortan ni se colapsan acá; el
  // único ajuste ya está hecho arriba (evitar contar doble una misma línea
  // en blanco).
  return runs;
}

// "rgb(31, 39, 50)" o "#1f2732" → [31, 39, 50]. Los navegadores normalizan
// el <input type="color"> (que entrega hex) a rgb(...) en el estilo en
// línea que deja document.execCommand("foreColor", ...), así que hay que
// aceptar ambos formatos.
function rgbDesdeCss(color) {
  const rgb = color.match(/\d+/g);
  if (rgb && rgb.length >= 3) return [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])];
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return null;
}

// Para exportaciones que no soportan formato por campo (ej. el nombre del
// PDF, o Correspondencia en Word si algún día hace falta texto plano):
// convierte el HTML de vuelta a texto plano legible, con saltos de línea
// donde había párrafos — mismo criterio que textoPlanoDesdeHtml en LBDC
// Neiva (incluye el mismo fix de &nbsp; que rompía el ajuste de línea).
export function textoPlanoDesdeHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll("div, p, br").forEach((el) => { el.before("\n"); el.after("\n"); });
  return tmp.textContent
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
