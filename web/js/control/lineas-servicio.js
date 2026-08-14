// Catálogo de líneas de servicio para codificar contratos. Hasta 2026-08-14
// coincidía 1 a 1 con las 7 líneas de web/servicios.html, pero PER y MED
// agrupaban dos servicios distintos bajo una sola clave — se separaron en
// PER/CONS y MED/SOL para codificar contratos con más precisión, aunque en
// la página pública (servicios.html) esos dos pares se sigan presentando
// como un solo panel cada uno (esa página no se tocó).
// Editar aquí si cambian las líneas (sin UI de administración a propósito,
// igual criterio que documentos-plantillas.js y plantillas.js).

export const LINEAS_SERVICIO = [
  { clave: "INT", nombre: "Interventoría" },
  { clave: "PER", nombre: "Reducción de pérdidas" },
  { clave: "CONS", nombre: "Consultoría" },
  { clave: "CON", nombre: "Construcción" },
  { clave: "DIS", nombre: "Diseño" },
  { clave: "CAP", nombre: "Capacitación" },
  { clave: "MED", nombre: "Mediciones" },
  { clave: "SOL", nombre: "Generación solar" },
  { clave: "WEB", nombre: "Desarrollo de aplicativos web" }
];

export function nombreLinea(clave) {
  return LINEAS_SERVICIO.find((l) => l.clave === clave)?.nombre || clave;
}
