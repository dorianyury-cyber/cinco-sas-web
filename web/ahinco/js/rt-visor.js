// Visualizadores de AHÍNCO: muestran la memoria y el Excel formulado antes de
// descargarlos. Siguen el patrón de Interventoría PRO (ventana .modal con el
// PDF en un iframe —la CSP permite frame-src blob:— y el libro por pestañas)
// y usan sus mismas clases (ip.css ya está cargado en AHÍNCO).
import { esc } from "./rt-core.js";

function ventana(titulo, { ancha = false } = {}) {
  const fondo = document.createElement("div");
  fondo.className = "modal-backdrop open ip-visor-fondo";
  fondo.innerHTML = `<div class="modal ${ancha ? "ip-visor-informe" : "ip-modal-ancho ip-visor-modal"}" role="dialog" aria-label="${esc(titulo)}">
    <div class="ip-visor-barra"><h2>${esc(titulo)}</h2><span class="rt-visor-botones"></span></div>
    <div class="rt-visor-cuerpo"></div>
  </div>`;
  document.body.appendChild(fondo);
  const urls = [];
  const cerrar = () => { fondo.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); document.removeEventListener("keydown", alEsc); };
  const alEsc = (e) => { if (e.key === "Escape") cerrar(); };
  document.addEventListener("keydown", alEsc);
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
  return { fondo, cuerpo: fondo.querySelector(".rt-visor-cuerpo"), botones: fondo.querySelector(".rt-visor-botones"), cerrar, urls };
}
function boton(texto, clase, fn) {
  const b = document.createElement("button");
  b.type = "button"; b.className = `btn ${clase}`.trim(); b.textContent = texto;
  b.addEventListener("click", async () => {
    const t = b.textContent; b.disabled = true; b.textContent = "Generando…";
    try { await fn(); } catch (err) { console.error(err); alert(`No se pudo generar: ${err.message || err}`); } finally { b.disabled = false; b.textContent = t; }
  });
  return b;
}
export function descargarUrl(url, nombre) {
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
}

// PDF en pantalla. generar() devuelve el documento de jsPDF; acciones: botones
// adicionales [{ texto, fn }] (por ejemplo, descargar el Word).
export async function verPdf({ titulo, generar, nombre, acciones = [] }) {
  const v = ventana(titulo, { ancha: true });
  v.cuerpo.className = "ip-visor-pdf";
  v.cuerpo.innerHTML = '<p class="text-muted ip-visor-cargando">Generando vista previa…</p>';
  let url = null;
  v.botones.append(
    boton("⬇ Descargar PDF", "", async () => { if (url) descargarUrl(url, nombre); }),
    ...acciones.map((a) => boton(a.texto, "secondary", a.fn)),
    Object.assign(document.createElement("button"), { type: "button", className: "btn secondary", textContent: "Cerrar", onclick: v.cerrar })
  );
  try {
    const doc = await generar();
    url = doc.output("bloburl");
    v.urls.push(url);
    v.cuerpo.innerHTML = `<iframe title="${esc(titulo)}" src="${url}#view=FitH"></iframe>`;
  } catch (err) {
    console.error(err);
    v.cuerpo.innerHTML = `<p class="alert error">No se pudo generar la vista previa: ${esc(err.message || String(err))}</p>`;
  }
}

// ---------------------------------------------------------------- Excel formulado
// Las fórmulas se calculan cuando Excel abre el archivo: el visor muestra los
// datos de entrada, cada fórmula y su explicación en palabras (columna «Cómo se
// calcula»), con el mismo orden y las mismas pestañas del libro.
const MAX_FILAS = 400;
function textoCelda(c) {
  const v = c.value;
  if (v == null) return { t: "" };
  if (typeof v === "object" && !(v instanceof Date)) {
    if (v.formula) return { t: v.result != null ? String(v.result) : "ƒx", f: v.formula };
    if (v.richText) return { t: v.richText.map((r) => r.text).join("") };
    if (v.text) return { t: String(v.text) };
  }
  if (typeof v === "number") return { t: v.toLocaleString("es-CO", { maximumFractionDigits: 6 }) };
  return { t: String(v) };
}
function hojaHtml(ws) {
  let max = 0;
  const filas = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (filas.length >= MAX_FILAS) return;
    const celdas = [];
    for (let i = 1; i <= Math.min(ws.columnCount, 20); i++) {
      const c = row.getCell(i);
      if (c.isMerged && c.master !== c) { celdas.push(null); continue; }
      const x = textoCelda(c);
      const entrada = c.protection?.locked === false;
      celdas.push({ ...x, entrada });
    }
    while (celdas.length && (celdas[celdas.length - 1] === null || celdas[celdas.length - 1].t === "")) celdas.pop();
    max = Math.max(max, celdas.length);
    filas.push({ n, celdas });
  });
  if (!filas.length) return '<p class="text-muted">Hoja sin contenido.</p>';
  return `<div class="ip-visor-tabla rt-visor-hoja"><table class="tabla-compacta"><tbody>${filas.map(({ n, celdas }) => `<tr><th class="rt-visor-n">${n}</th>${Array.from({ length: max }, (_, i) => {
    const c = celdas[i];
    if (c === null || c === undefined) return "<td></td>";
    const clase = c.f ? "rt-visor-formula" : c.entrada ? "rt-visor-entrada" : "";
    return `<td class="${clase}"${c.f ? ` title="=${esc(c.f)}"` : ""}>${esc(c.t)}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}
export async function verLibro(wb, nombre, { titulo = "Vista previa del Excel formulado" } = {}) {
  const v = ventana(titulo, { ancha: true });
  const hojas = wb.worksheets.slice().sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0));
  let actual = 0;
  const pintar = () => {
    v.cuerpo.innerHTML = `<p class="text-muted ip-visor-nota">Amarillo: datos de entrada. <b>ƒx</b>: fórmula viva (pase el cursor para verla); Excel calcula su valor al abrir el archivo y la columna «Cómo se calcula» la explica en palabras.</p>
      <div class="ip-visor-pestanas">${hojas.map((h, i) => `<button type="button" data-h="${i}" class="${i === actual ? "activa" : ""}">${esc(h.name)}</button>`).join("")}</div>
      ${hojaHtml(hojas[actual])}`;
    v.cuerpo.querySelectorAll("[data-h]").forEach((b) => b.addEventListener("click", () => { actual = Number(b.dataset.h); pintar(); }));
  };
  v.cuerpo.classList.add("rt-visor-libro");
  pintar();
  v.botones.append(
    boton("⬇ Descargar Excel", "", async () => {
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      v.urls.push(url);
      descargarUrl(url, nombre);
    }),
    Object.assign(document.createElement("button"), { type: "button", className: "btn secondary", textContent: "Cerrar", onclick: v.cerrar })
  );
}
