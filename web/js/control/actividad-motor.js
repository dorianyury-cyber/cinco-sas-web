// Lógica pura (sin Firebase ni DOM) de la bitácora de actuaciones del contrato
// y de los documentos adjuntos a cada ítem — separada para poder probarla con `npm test`.

export const TAMANO_MAXIMO = 25 * 1024 * 1024;

export const TIPOS_ACTIVIDAD = {
  estado: "Estado",
  fecha: "Fecha",
  responsable: "Responsable",
  notas: "Notas",
  verificacion: "Verificación",
  doc_adjunto: "Documento adjuntado",
  doc_reemplazo: "Documento reemplazado",
  doc_eliminado: "Documento eliminado",
  aprobacion: "Aprobación",
  equipo: "Equipo",
  item: "Ítem",
  contrato: "Contrato"
};

const EXTENSIONES = {
  pdf: { tipo: "application/pdf", visor: "pdf" },
  png: { tipo: "image/png", visor: "imagen" },
  jpg: { tipo: "image/jpeg", visor: "imagen" },
  jpeg: { tipo: "image/jpeg", visor: "imagen" },
  gif: { tipo: "image/gif", visor: "imagen" },
  webp: { tipo: "image/webp", visor: "imagen" },
  doc: { tipo: "application/msword", visor: "descarga" },
  docx: { tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", visor: "descarga" },
  xls: { tipo: "application/vnd.ms-excel", visor: "descarga" },
  xlsx: { tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", visor: "descarga" }
};

export function extensionDe(nombre) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(nombre || ""));
  return m ? m[1].toLowerCase() : "";
}

// {ok, motivo, extension, contentType} — solo PDF, imágenes, Word y Excel, hasta 25 MB.
export function validarArchivo(nombre, tamano) {
  const extension = extensionDe(nombre);
  const info = EXTENSIONES[extension];
  if (!info) return { ok: false, motivo: `«${nombre}»: solo se admiten PDF, imágenes, Word y Excel.` };
  if (!(tamano > 0)) return { ok: false, motivo: `«${nombre}» está vacío.` };
  if (tamano >= TAMANO_MAXIMO) return { ok: false, motivo: `«${nombre}» pesa más de 25 MB.` };
  return { ok: true, extension, contentType: info.tipo };
}

// "pdf" | "imagen" (se ven dentro de la página) | "descarga" (Word, Excel...)
export function tipoVisor(nombre) {
  return EXTENSIONES[extensionDe(nombre)]?.visor || "descarga";
}

export function esUrlSegura(url) {
  try {
    const u = new URL(String(url).trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch (e) {
    return false;
  }
}

export function nombreDeEnlace(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return "Enlace"; }
}

// Lista unificada de documentos de un ítem: los adjuntos (`documentos`) más el
// enlace de OneDrive heredado (`enlace`), que se muestra como un documento más.
export function documentosDeItem(item) {
  const lista = Array.isArray(item?.documentos) ? item.documentos.filter((d) => d && d.url) : [];
  const legado = typeof item?.enlace === "string" ? item.enlace.trim() : "";
  if (legado) lista.push({ id: "enlace-heredado", tipo: "enlace", nombre: nombreDeEnlace(legado), url: legado, heredado: true });
  return lista;
}

const vacio = (v) => (v === null || v === undefined || v === "" ? "(vacío)" : String(v));
const corto = (s) => (s.length > 70 ? s.slice(0, 69) + "…" : s);
export function detalleCambio(etiqueta, antes, despues) {
  return `${etiqueta}: ${corto(vacio(antes))} → ${corto(vacio(despues))}`;
}

export function personasDe(registros) {
  return [...new Set(registros.map((r) => r.nombre || r.por).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}
export function seccionesDe(registros) {
  return [...new Set(registros.map((r) => r.seccion).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

// filtros: {persona, seccion, itemId} — vacío = sin filtrar. Devuelve una copia (más reciente primero).
export function filtrarActividad(registros, filtros = {}) {
  const t = (r) => (r.en && typeof r.en.getTime === "function" ? r.en.getTime() : 0);
  return registros
    .filter((r) => !filtros.persona || (r.nombre || r.por) === filtros.persona)
    .filter((r) => !filtros.seccion || r.seccion === filtros.seccion)
    .filter((r) => !filtros.itemId || r.itemId === filtros.itemId)
    .sort((a, b) => t(b) - t(a));
}

// Registro listo para guardar: sin campos undefined (Firestore los rechaza).
export function armarRegistro({ por, nombre, tipo, seccion, item, itemId, detalle }) {
  const r = { por, nombre: nombre || por, tipo, detalle: String(detalle || "").slice(0, 300) };
  if (seccion) r.seccion = seccion;
  if (item) r.item = item;
  if (itemId) r.itemId = itemId;
  return r;
}
