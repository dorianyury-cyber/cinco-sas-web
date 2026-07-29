// Catálogo de líneas de servicio para codificar contratos — mismos nombres
// que las 7 líneas de web/servicios.html. Editar aquí si cambian las líneas
// (sin UI de administración a propósito, igual criterio que
// documentos-plantillas.js y plantillas.js).

export const LINEAS_SERVICIO = [
  { clave: "INT", nombre: "Interventoría" },
  { clave: "PER", nombre: "Consultoría / reducción de pérdidas" },
  { clave: "CON", nombre: "Construcción" },
  { clave: "DIS", nombre: "Diseño" },
  { clave: "CAP", nombre: "Capacitación" },
  { clave: "MED", nombre: "Medición y generación solar" },
  { clave: "WEB", nombre: "Desarrollo de aplicativos web" }
];

export function nombreLinea(clave) {
  return LINEAS_SERVICIO.find((l) => l.clave === clave)?.nombre || clave;
}
