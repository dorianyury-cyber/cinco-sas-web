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

  const inputColor = document.createElement("input");
  inputColor.type = "color";
  inputColor.className = "control-rich-color";
  inputColor.dataset.cmd = "foreColor";
  inputColor.title = "Color de letra";
  inputColor.value = "#1a1a1a";

  toolbar.append(btnNegrita, btnCursiva, inputColor);

  const editable = document.createElement("div");
  editable.className = "control-rich-editable";
  editable.contentEditable = "true";
  editable.dataset.placeholder = placeholder || "";
  editable.innerHTML = htmlParaCampoRico(valor);

  editable.addEventListener("input", () => onInput?.(editable.innerHTML));

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
export function parsearHtmlARuns(html) {
  if (!html) return [];
  const raiz = document.createElement("div");
  raiz.innerHTML = html;
  const runs = [];

  function caminar(nodo, estilo) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      if (nodo.textContent) runs.push({ texto: nodo.textContent, ...estilo });
      return;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;
    if (nodo.tagName === "BR") { runs.push({ salto: true }); return; }

    const nuevoEstilo = { ...estilo };
    if (nodo.tagName === "B" || nodo.tagName === "STRONG") nuevoEstilo.negrita = true;
    if (nodo.tagName === "I" || nodo.tagName === "EM") nuevoEstilo.cursiva = true;
    if (nodo.style && nodo.style.color) nuevoEstilo.color = rgbDesdeCss(nodo.style.color);

    nodo.childNodes.forEach((hijo) => caminar(hijo, nuevoEstilo));
    if (nodo.tagName === "DIV" || nodo.tagName === "P") runs.push({ salto: true });
  }
  raiz.childNodes.forEach((hijo) => caminar(hijo, {}));
  while (runs.length && runs[runs.length - 1].salto) runs.pop();
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
