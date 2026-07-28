// Catálogos fijos del Listado Maestro de Documentos. Editar este archivo si
// cambian las áreas o tipos de documento — sin UI de administración a
// propósito (mantenerlo ágil, igual criterio que plantillas.js).

export const AREAS = [
  { clave: "SC", nombre: "Servicio al Cliente" },
  { clave: "TH", nombre: "Talento Humano" },
  { clave: "AC", nombre: "Actividades" },
  { clave: "CAL", nombre: "Calidad / HSEQ" },
  { clave: "GG", nombre: "Gestión Gerencial" },
  { clave: "ADM", nombre: "Administrativa" }
];

export const TIPOS = [
  { clave: "FOR", nombre: "Formato" },
  { clave: "PRO", nombre: "Procedimiento" },
  { clave: "INS", nombre: "Instructivo" },
  { clave: "REG", nombre: "Registro" },
  { clave: "ACT", nombre: "Acta" },
  { clave: "INF", nombre: "Informe" },
  { clave: "MAN", nombre: "Manual" }
];

export function nombreArea(clave) {
  return AREAS.find((a) => a.clave === clave)?.nombre || clave;
}

export function nombreTipo(clave) {
  return TIPOS.find((t) => t.clave === clave)?.nombre || clave;
}
