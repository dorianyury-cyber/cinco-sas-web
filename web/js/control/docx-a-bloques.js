// Convierte un .docx (el documento tal cual se elaboró en Word) a los bloques de una carta de
// Correspondencia — texto (negrilla/cursiva/color/alineación), tablas e imágenes — para que salga
// con el membrete, el radicado y el pie de Cinco sin tener que volver a escribirlo.
//
// Sin librerías: el .docx es un ZIP y se lee con DecompressionStream("deflate-raw") del navegador;
// el XML se recorre con DOMParser.

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";

// ---- ZIP: directorio central → { nombre: () => Promise<Uint8Array> } ----
async function leerZip(buffer) {
  const v = new DataView(buffer);
  let fin = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error("El archivo no es un .docx válido.");
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const dec = new TextDecoder();
  const archivos = {};
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const tamComp = v.getUint32(p + 20, true);
    const lNombre = v.getUint16(p + 28, true), lExtra = v.getUint16(p + 30, true), lComent = v.getUint16(p + 32, true);
    const offLocal = v.getUint32(p + 42, true);
    const nombre = dec.decode(new Uint8Array(buffer, p + 46, lNombre));
    archivos[nombre] = async () => {
      const ini = offLocal + 30 + v.getUint16(offLocal + 26, true) + v.getUint16(offLocal + 28, true);
      const datos = new Uint8Array(buffer, ini, tamComp);
      if (metodo === 0) return datos;
      const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(flujo).arrayBuffer());
    };
    p += 46 + lNombre + lExtra + lComent;
  }
  return archivos;
}

const hijos = (el, nombre) => Array.from(el?.childNodes || []).filter((n) => n.nodeType === 1 && n.namespaceURI === W && n.localName === nombre);
const hijo = (el, nombre) => hijos(el, nombre)[0] || null;
const val = (el) => el?.getAttributeNS(W, "val") ?? el?.getAttribute("w:val") ?? null;
// <w:b/> activa; <w:b w:val="0|false"/> la desactiva.
const activa = (el) => !!el && !/^(0|false|none)$/i.test(val(el) || "");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function alineacionDe(p) {
  const jc = val(hijo(hijo(p, "pPr"), "jc"));
  if (jc === "center") return "center";
  if (jc === "right" || jc === "end") return "right";
  if (jc === "both" || jc === "distribute") return "justify";
  return "";
}

// Espacio después del párrafo (twips): el del párrafo, si no el del estilo por defecto del documento.
function espacioDespues(p, porDefecto) {
  const s = hijo(hijo(p, "pPr"), "spacing");
  const a = s?.getAttributeNS(W, "after");
  return a != null && a !== "" ? Number(a) : porDefecto;
}

// Texto de un párrafo (o celda) como HTML del campo rico + las imágenes que trae, en orden.
function leerParrafo(p, rels) {
  let html = "";
  const imagenes = [];
  const estiloP = val(hijo(hijo(p, "pPr"), "pStyle")) || "";
  const negritaEstilo = /^(Title|Ttulo|T[ií]tulo|Heading|Encabezado)/i.test(estiloP);
  const runs = Array.from(p.getElementsByTagNameNS(W, "r"));
  for (const r of runs) {
    const rPr = hijo(r, "rPr");
    const b = negritaEstilo || activa(hijo(rPr, "b"));
    const i = activa(hijo(rPr, "i"));
    const color = val(hijo(rPr, "color"));
    let t = "";
    for (const n of Array.from(r.childNodes)) {
      if (n.nodeType !== 1) continue;
      if (n.localName === "t") t += esc(n.textContent);
      else if (n.localName === "tab") t += "    ";
      else if (n.localName === "br" || n.localName === "cr") t += "<br>";
      else if (n.localName === "noBreakHyphen") t += "-";
      else if (n.localName === "drawing" || n.localName === "pict") {
        const blip = n.getElementsByTagNameNS(A, "blip")[0];
        const id = blip?.getAttributeNS(R, "embed") || n.getElementsByTagName("v:imagedata")[0]?.getAttribute("r:id");
        if (id && rels[id]) imagenes.push(rels[id]);
      }
    }
    if (!t) continue;
    if (color && /^[0-9a-f]{6}$/i.test(color) && color.toUpperCase() !== "000000") t = `<span style="color:#${color}">${t}</span>`;
    if (i) t = `<i>${t}</i>`;
    if (b) t = `<b>${t}</b>`;
    html += t;
  }
  return { html: html.replace(/(<\/b>)(<b>)/g, ""), imagenes, texto: p.textContent };
}

/**
 * @returns {Promise<{ bloques: Array, titulo: string }>} bloques: {tipo:"texto",texto} | {tipo:"tabla",filas} |
 *   {tipo:"imagen",blob} | {tipo:"firma"} (donde va la firma digital: sobre la última línea "_____" del documento,
 *   o al final si no la hay). titulo: el primer párrafo con texto, para el asunto del listado.
 */
export async function docxABloques(archivo) {
  const zip = await leerZip(await archivo.arrayBuffer());
  if (!zip["word/document.xml"]) throw new Error("El archivo no es un documento de Word (.docx).");
  const dec = new TextDecoder();
  const xml = (u8) => new DOMParser().parseFromString(dec.decode(u8), "application/xml");
  const documento = xml(await zip["word/document.xml"]());

  // Imágenes: id de relación → nombre del archivo dentro del ZIP.
  const rels = {};
  if (zip["word/_rels/document.xml.rels"]) {
    const relsXml = xml(await zip["word/_rels/document.xml.rels"]());
    for (const rel of Array.from(relsXml.getElementsByTagName("Relationship"))) {
      if (/\/image$/.test(rel.getAttribute("Type") || "")) rels[rel.getAttribute("Id")] = "word/" + rel.getAttribute("Target").replace(/^\/?word\//, "").replace(/^\.\//, "");
    }
  }
  let espacioDefecto = 0;
  if (zip["word/styles.xml"]) {
    const estilos = xml(await zip["word/styles.xml"]());
    const s = estilos.getElementsByTagNameNS(W, "pPrDefault")[0]?.getElementsByTagNameNS(W, "spacing")[0];
    if (s?.getAttributeNS(W, "after")) espacioDefecto = Number(s.getAttributeNS(W, "after"));
  }
  const tipoImagen = (n) => (/\.png$/i.test(n) ? "image/png" : /\.gif$/i.test(n) ? "image/gif" : /\.bmp$/i.test(n) ? "image/bmp" : "image/jpeg");

  const cuerpo = documento.getElementsByTagNameNS(W, "body")[0];
  // Primero una lista plana de elementos; luego se agrupan los párrafos en bloques de texto.
  const items = [];
  const recorrer = (contenedor) => {
    for (const el of Array.from(contenedor.childNodes)) {
      if (el.nodeType !== 1 || el.namespaceURI !== W) continue;
      if (el.localName === "p") {
        const { html, imagenes, texto } = leerParrafo(el, rels);
        items.push({ tipo: "p", html, texto, alin: alineacionDe(el), despues: espacioDespues(el, espacioDefecto) });
        imagenes.forEach((nombre) => items.push({ tipo: "imagen", nombre }));
      } else if (el.localName === "tbl") {
        const filas = hijos(el, "tr").map((tr) => hijos(tr, "tc").map((tc) => hijos(tc, "p").map((p) => p.textContent).join("\n").trim()));
        // Una tabla de una sola celda suele ser un recuadro de diseño: se toma su contenido como texto.
        if (filas.length === 1 && filas[0].length === 1) recorrer(hijos(hijos(el, "tr")[0], "tc")[0]);
        else if (filas.length) items.push({ tipo: "tabla", filas });
      } else if (el.localName === "sdt") {
        const c = hijo(el, "sdtContent");
        if (c) recorrer(c);
      }
    }
  };
  recorrer(cuerpo);

  // La firma va justo encima de la última línea de solo guiones bajos ("________"), que es donde el documento
  // deja el espacio para firmar.
  let iFirma = -1;
  items.forEach((it, i) => { if (it.tipo === "p" && /^\s*_{5,}\s*$/.test(it.texto)) iFirma = i; });

  const bloques = [];
  let actual = null;
  const cerrar = () => {
    if (actual) {
      // Quita líneas en blanco al final del bloque (el espacio entre bloques ya lo pone la carta).
      bloques.push({ tipo: "texto", texto: actual.join("").replace(/(<div><br><\/div>)+$/, "") });
      actual = null;
    }
  };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (i === iFirma) { cerrar(); bloques.push({ tipo: "firma" }); }
    if (it.tipo === "p") {
      const vacio = !it.html.replace(/<br>/g, "").trim();
      if (vacio && !actual) continue;
      actual = actual || [];
      actual.push(vacio ? "<div><br></div>" : `<div${it.alin ? ` style="text-align:${it.alin}"` : ""}>${it.html}</div>`);
      // Párrafos con espacio después (≥ 6 pt) quedan como bloques separados; los seguidos se mantienen juntos.
      if (it.despues >= 120) cerrar();
    } else if (it.tipo === "tabla") {
      cerrar();
      bloques.push({ tipo: "tabla", filas: it.filas });
    } else if (it.tipo === "imagen" && zip[it.nombre]) {
      cerrar();
      bloques.push({ tipo: "imagen", blob: new Blob([await zip[it.nombre]()], { type: tipoImagen(it.nombre) }) });
    }
  }
  cerrar();
  if (iFirma < 0) bloques.push({ tipo: "firma" });

  const primero = items.find((it) => it.tipo === "p" && it.texto.trim() && !/^\s*_+\s*$/.test(it.texto));
  return { bloques: bloques.filter((b) => b.tipo !== "texto" || b.texto), titulo: (primero?.texto || "").trim() };
}
