// Pegar una tabla copiada de Word o Excel conservando su estructura
// (pedido de Nataly, 2026-11-12): el portapapeles trae, además del texto con
// tabuladores, el HTML de la tabla. Del HTML se sacan las celdas combinadas
// (colspan/rowspan), los saltos de línea dentro de una celda (Word los pone
// como párrafos y en el texto plano parecían filas nuevas), la negrilla, el
// centrado horizontal y vertical, el color de letra y el ancho de cada
// columna. Devuelve el mismo formato del bloque "tabla" del editor
// (editor-tabla.js / tabla-celdas.js) o null si el HTML no trae tabla.
//
// Excel pone los estilos en clases (.xl65 { font-weight:700; … }) dentro de
// un <style>; Word los pone en línea (style="…", align, valign, <b>). Se
// leen las dos formas.

const NEGRO = /^(#0{3}|#0{6}|black|windowtext|auto|rgb\(0,\s*0,\s*0\))$/i;

function reglasDeClase(docHtml) {
  const reglas = {};
  docHtml.querySelectorAll("style").forEach((st) => {
    const css = st.textContent.replace(/<!--|-->/g, "");
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      m[1].split(",").forEach((sel) => {
        const c = sel.trim().match(/^(?:td|th)?\.([\w-]+)$/i);
        if (c) reglas[c[1]] = `${reglas[c[1]] || ""};${m[2]}`;
      });
    }
  });
  return reglas;
}

// Propiedades CSS de un texto "a:b; c:d" (la última gana).
function leerEstilo(texto) {
  const r = {};
  String(texto || "").split(";").forEach((par) => {
    const i = par.indexOf(":");
    if (i > 0) r[par.slice(0, i).trim().toLowerCase()] = par.slice(i + 1).trim().replace(/\s*!important$/i, "");
  });
  return r;
}

function aHex(color) {
  const c = String(color || "").trim().replace(/["']/g, "");
  if (!c || NEGRO.test(c)) return null;
  let m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return `#${m[1].toLowerCase()}`;
  m = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase();
  m = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("")}`;
  const nombres = { red: "#ff0000", blue: "#0000ff", green: "#008000", navy: "#000080", maroon: "#800000", gray: "#808080", grey: "#808080", purple: "#800080", teal: "#008080", olive: "#808000", orange: "#ffa500" };
  return nombres[c.toLowerCase()] || null;
}

// Ancho en puntos de "120", "90pt", "1.5in", "2cm", "160px".
function aPuntos(valor) {
  const m = String(valor || "").trim().match(/^([\d.]+)\s*(pt|px|in|cm|mm)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || "px").toLowerCase();
  return u === "pt" ? n : u === "in" ? n * 72 : u === "cm" ? n * 28.35 : u === "mm" ? n * 2.835 : n * 0.75;
}

const esNegritaCss = (v) => /^(bold|bolder|[6-9]00)$/i.test(String(v || "").trim());

// Texto de la celda: cada párrafo / <br> es un salto de línea dentro de la
// MISMA celda; los espacios repetidos del HTML se juntan.
function textoCelda(td) {
  const partes = [];
  let linea = "";
  const cortar = () => { partes.push(linea); linea = ""; };
  (function recorrer(nodo) {
    nodo.childNodes.forEach((n) => {
      if (n.nodeType === 3) { linea += n.textContent.replace(/[\s ]+/g, " "); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase();
      if (tag === "br") { cortar(); return; }
      if (tag === "style" || tag === "script" || tag === "table") return;
      const bloque = /^(p|div|li|h[1-6])$/.test(tag);
      if (bloque && linea.trim()) cortar();
      if (tag === "li") linea += "• ";
      recorrer(n);
      if (bloque) cortar();
    });
  })(td);
  if (linea) cortar();
  return partes.map((l) => l.replace(/ +/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ¿Casi todo el texto de la celda está en negrilla?
function celdaEnNegrita(td, estiloTd) {
  if (td.tagName.toLowerCase() === "th" || esNegritaCss(estiloTd["font-weight"])) return true;
  const total = td.textContent.replace(/\s+/g, "").length;
  if (!total) return false;
  // Cada trozo de texto cuenta si alguno de sus contenedores (hasta la celda) es negrilla.
  const enNegrita = (el) => {
    for (let x = el; x && x !== td; x = x.parentElement) {
      const tag = x.tagName.toLowerCase();
      if (tag === "b" || tag === "strong" || esNegritaCss(leerEstilo(x.getAttribute("style"))["font-weight"])) return true;
    }
    return false;
  };
  let negrita = 0;
  const recorrido = td.ownerDocument.createTreeWalker(td, 4);
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    if (n.parentElement && enNegrita(n.parentElement)) negrita += n.textContent.replace(/\s+/g, "").length;
  }
  return negrita >= total * 0.6;
}

function colorDeCelda(td, estiloTd) {
  const directo = aHex(estiloTd.color);
  if (directo) return directo;
  for (const el of td.querySelectorAll("font[color], [style*='color']")) {
    if (!el.textContent.trim()) continue;
    const c = aHex(el.getAttribute("color") || leerEstilo(el.getAttribute("style")).color);
    if (c) return c;
  }
  return null;
}

export function tablaDesdeHtml(html) {
  if (!html || !/<table/i.test(html)) return null;
  const docHtml = new DOMParser().parseFromString(html, "text/html");
  // La primera tabla de nivel superior (si se copió con texto alrededor).
  const tabla = [...docHtml.querySelectorAll("table")].find((t) => !t.parentElement.closest("table"));
  if (!tabla) return null;
  const reglas = reglasDeClase(docHtml);
  const estiloDe = (el) => {
    const deClase = [...el.classList].map((c) => reglas[c] || "").join(";");
    return leerEstilo(`${deClase};${el.getAttribute("style") || ""}`);
  };

  // Filas propias de esta tabla (no las de tablas anidadas), sin las ocultas.
  const filasTr = [...tabla.querySelectorAll("tr")].filter((tr) => tr.closest("table") === tabla && !/^none$/i.test(estiloDe(tr).display || ""));
  if (!filasTr.length) return null;

  const ocupada = [];
  const celdas = []; // { fi, ci, filas, cols, texto, negrita, centro, medio, color, anchoPt }
  filasTr.forEach((tr, fi) => {
    ocupada[fi] = ocupada[fi] || [];
    let ci = 0;
    [...tr.children].filter((td) => /^(td|th)$/i.test(td.tagName)).forEach((td) => {
      while (ocupada[fi][ci]) ci += 1;
      const cols = Math.max(1, Math.min(50, parseInt(td.getAttribute("colspan"), 10) || 1));
      const filas = Math.max(1, Math.min(filasTr.length - fi, parseInt(td.getAttribute("rowspan"), 10) || 1));
      const est = estiloDe(td);
      const parrafo = td.querySelector("p, div");
      const estP = parrafo ? estiloDe(parrafo) : {};
      const alinear = (td.getAttribute("align") || est["text-align"] || parrafo?.getAttribute("align") || estP["text-align"] || "").toLowerCase();
      const vertical = (td.getAttribute("valign") || est["vertical-align"] || "").toLowerCase();
      celdas.push({
        fi, ci, filas, cols,
        texto: textoCelda(td),
        negrita: celdaEnNegrita(td, est),
        centro: alinear === "center" || alinear === "centre",
        medio: vertical === "middle" || vertical === "center",
        color: colorDeCelda(td, est),
        anchoPt: aPuntos(td.getAttribute("width")) || aPuntos(est.width)
      });
      for (let f = fi; f < fi + filas; f++) {
        ocupada[f] = ocupada[f] || [];
        for (let c = ci; c < ci + cols; c++) ocupada[f][c] = true;
      }
      ci += cols;
    });
  });

  const numFilas = filasTr.length;
  const numCols = Math.max(1, ...celdas.map((c) => c.ci + c.cols));
  const filas = Array.from({ length: numFilas }, () => new Array(numCols).fill(""));
  const merges = [], centrados = [], centradosVertical = [], negritas = [], coloresCelda = [];
  celdas.forEach((c) => {
    filas[c.fi][c.ci] = c.texto;
    if (c.filas > 1 || c.cols > 1) merges.push({ fila: c.fi, col: c.ci, filas: c.filas, cols: c.cols });
    // El formato se marca en todas las coordenadas del rango combinado
    // (como lo hacen los botones del editor sobre una selección).
    for (let f = c.fi; f < c.fi + c.filas; f++) {
      for (let k = c.ci; k < c.ci + c.cols; k++) {
        if (c.centro) centrados.push({ fila: f, col: k });
        if (c.medio) centradosVertical.push({ fila: f, col: k });
        if (c.negrita) negritas.push({ fila: f, col: k });
        if (c.color) coloresCelda.push({ fila: f, col: k, color: c.color });
      }
    }
  });

  // Ancho de columnas: <col width> (Excel) o el ancho de las celdas sin
  // combinar horizontalmente (Word). Si no viene ninguno, queda automático.
  let anchos = new Array(numCols).fill(0);
  const cols = [...tabla.querySelectorAll("col")].filter((c) => c.closest("table") === tabla);
  if (cols.length) {
    let i = 0;
    cols.forEach((col) => {
      const n = Math.max(1, parseInt(col.getAttribute("span"), 10) || 1);
      const w = aPuntos(col.getAttribute("width")) || aPuntos(estiloDe(col).width);
      for (let k = 0; k < n && i < numCols; k++, i++) anchos[i] = w;
    });
  }
  if (anchos.some((w) => !w)) {
    celdas.filter((c) => c.cols === 1 && c.anchoPt).forEach((c) => { if (!anchos[c.ci]) anchos[c.ci] = c.anchoPt; });
  }
  let anchosColumna = null;
  if (anchos.every((w) => w > 0)) {
    const total = anchos.reduce((s, w) => s + w, 0);
    anchosColumna = anchos.map((w) => Math.round((w / total) * 1000) / 10);
  }

  // Filas de encabezado: las del <thead> o la fila 0 si va toda en negrilla.
  const enThead = filasTr.filter((tr) => tr.parentElement?.tagName.toLowerCase() === "thead").length;
  const altoFila0 = Math.max(1, ...celdas.filter((c) => c.fi === 0).map((c) => c.filas));
  const filasEncabezado = Math.min(Math.max(1, enThead || altoFila0), Math.max(1, numFilas - 1));

  return { filas, merges, centrados, centradosVertical, negritas, coloresCelda, anchosColumna, filasEncabezado };
}
