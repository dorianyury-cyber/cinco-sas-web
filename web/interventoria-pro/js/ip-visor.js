// Visualizadores de Interventoría PRO: muestran en pantalla el contenido
// de lo que antes había que descargar para conocerlo.
//  - mostrarLibro(wb, nombre): un libro de ExcelJS (exportaciones de los
//    módulos, Contratos, Historial y las plantillas de importación) con
//    una pestaña por hoja visible y el botón para descargarlo.
//  - mostrarTabla({...}): una lista cualquiera (ej. la lista base del acta
//    de inicio antes de cargarla) con una acción opcional.
// Las ventanas se crean al vuelo con las clases de siempre (.modal), así
// heredan el título y los botones con el estilo del resto del aplicativo.
import { esc } from "./ip-core.js";

const MAX_FILAS = 500;

function crearVentana(titulo) {
  const fondo = document.createElement("div");
  fondo.className = "modal-backdrop open ip-visor-fondo";
  fondo.innerHTML = `<div class="modal ip-modal-ancho ip-visor-modal" role="dialog" aria-label="${esc(titulo)}">
    <h2>${esc(titulo)}</h2>
    <div class="ip-visor-contenido"></div>
    <div class="ip-form-acciones ip-visor-acciones"></div>
  </div>`;
  document.body.appendChild(fondo);
  const cerrar = () => { fondo.remove(); document.removeEventListener("keydown", alEsc); };
  const alEsc = (e) => { if (e.key === "Escape") cerrar(); };
  document.addEventListener("keydown", alEsc);
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
  return { fondo, contenido: fondo.querySelector(".ip-visor-contenido"), acciones: fondo.querySelector(".ip-visor-acciones"), cerrar };
}

function boton(texto, clase, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${clase}`.trim();
  b.textContent = texto;
  b.addEventListener("click", fn);
  return b;
}

// Tabla con anchos proporcionales al contenido real de cada columna.
// Ninguna columna queda más angosta que su palabra más larga (así no se
// parten "Nuevo", "EPS" o "Estado"); las de texto largo reciben más ancho.
function htmlTabla(columnas, filas, { anchos } = {}) {
  const muestra = filas.slice(0, 200);
  const largo = columnas.map((c, i) => {
    const textos = [String(c), ...muestra.map((f) => String(f[i] ?? ""))];
    const palabra = Math.min(22, Math.max(4, ...textos.flatMap((t) => t.split(/\s+/).map((w) => w.length))));
    const promedio = muestra.length ? muestra.reduce((s, f) => s + String(f[i] ?? "").length, 0) / muestra.length : String(c).length;
    const base = anchos?.[i] || Math.min(60, Math.max(promedio * 1.1, 6));
    return Math.max(base, palabra + 2);
  });
  const total = largo.reduce((s, n) => s + n, 0) || 1;
  // Si las columnas no caben, la tabla se desplaza de lado en vez de apretarse.
  return `<div class="ip-visor-tabla"><table class="tabla-compacta" data-min-ancho="${Math.round(total * 7.2)}">
    <colgroup>${largo.map((n) => `<col data-ancho-col="${((n / total) * 100).toFixed(2)}">`).join("")}</colgroup>
    <thead><tr>${columnas.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${filas.length ? filas.map((f) => `<tr>${columnas.map((_, i) => `<td>${esc(f[i] ?? "")}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columnas.length}" class="text-muted">Sin filas: esta hoja trae solo los encabezados para llenar.</td></tr>`}</tbody>
  </table></div>`;
}
function aplicarAnchosColumnas(el) {
  el.querySelectorAll("col[data-ancho-col]").forEach((c) => { c.style.width = `${c.dataset.anchoCol}%`; });
  el.querySelectorAll("table[data-min-ancho]").forEach((t) => { t.style.minWidth = `${t.dataset.minAncho}px`; });
}

// Valor legible de una celda de ExcelJS.
function textoCelda(cell) {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`;
  if (typeof v === "number") return cell.numFmt && cell.numFmt.includes("#,##0") ? Math.round(v).toLocaleString("es-CO") : v.toLocaleString("es-CO");
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return String(v.result ?? "");
    if (v.text) return String(v.text);
    if (v.hyperlink) return String(v.hyperlink);
  }
  return String(v);
}

function datosHoja(ws) {
  const filas = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const valores = [];
    for (let i = 1; i <= ws.columnCount; i++) valores.push(textoCelda(row.getCell(i)));
    filas.push(valores);
  });
  const anchos = [];
  for (let i = 1; i <= ws.columnCount; i++) anchos.push(ws.getColumn(i).width || 0);
  // Las filas de texto suelto antes de la tabla (ej. el título y las
  // indicaciones de una hoja de instrucciones) se muestran como párrafos.
  const iEnc = Math.max(0, filas.findIndex((f) => f.filter(Boolean).length >= 2));
  const intro = filas.slice(0, iEnc).map((f) => f.filter(Boolean).join(" · ")).filter(Boolean);
  return { intro, encabezado: filas[iEnc] || [], filas: filas.slice(iEnc + 1).filter((f) => f.some(Boolean)), anchos: anchos.some(Boolean) ? anchos.map((w) => w || 10) : null };
}

export function mostrarLibro(wb, nombreArchivo, { titulo = "Vista previa", nota = "" } = {}) {
  const hojas = wb.worksheets.filter((ws) => ws.state !== "hidden" && ws.state !== "veryHidden");
  const v = crearVentana(titulo);
  const datos = hojas.map(datosHoja);
  // Arranca en la primera hoja que tenga filas (en una plantilla vacía, las
  // instrucciones).
  let actual = Math.max(0, datos.findIndex((d) => d.filas.length));
  function pintar() {
    const d = datos[actual];
    v.contenido.innerHTML = `${nota ? `<p class="text-muted ip-visor-nota">${esc(nota)}</p>` : ""}
      ${hojas.length > 1 ? `<div class="ip-visor-pestanas">${hojas.map((h, i) => `<button type="button" data-h="${i}" class="${i === actual ? "activa" : ""}">${esc(h.name)}${datos[i].filas.length ? ` (${datos[i].filas.length})` : ""}</button>`).join("")}</div>` : ""}
      ${d.intro.length ? `<div class="ip-visor-texto">${d.intro.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
      ${d.encabezado.length ? htmlTabla(d.encabezado, d.filas.slice(0, MAX_FILAS), { anchos: d.anchos }) : ""}
      ${d.filas.length > MAX_FILAS ? `<p class="text-muted ip-visor-nota">Se muestran las primeras ${MAX_FILAS} filas de ${d.filas.length}; el archivo descargado las trae todas.</p>` : ""}`;
    aplicarAnchosColumnas(v.contenido);
    v.contenido.querySelectorAll("[data-h]").forEach((b) => b.addEventListener("click", () => { actual = Number(b.dataset.h); pintar(); }));
  }
  pintar();
  v.acciones.append(
    boton("⬇ Descargar Excel", "", async () => {
      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }),
    boton("Cerrar", "secondary", v.cerrar)
  );
}

// filas: arreglos de valores; marcar(fila) → clase CSS opcional por fila.
export function mostrarTabla({ titulo, nota = "", columnas, filas, marcar, accion }) {
  const v = crearVentana(titulo);
  v.contenido.innerHTML = `${nota ? `<p class="text-muted ip-visor-nota">${esc(nota)}</p>` : ""}${htmlTabla(columnas, filas)}`;
  if (marcar) v.contenido.querySelectorAll("tbody tr").forEach((tr, i) => { const c = marcar(filas[i]); if (c) tr.classList.add(c); });
  aplicarAnchosColumnas(v.contenido);
  if (accion) {
    const b = boton(accion.texto, "", async () => { b.disabled = true; try { await accion.fn(); v.cerrar(); } finally { b.disabled = false; } });
    if (accion.deshabilitado) b.disabled = true;
    v.acciones.append(b);
  }
  v.acciones.append(boton(accion ? "Cancelar" : "Cerrar", "secondary", v.cerrar));
}
