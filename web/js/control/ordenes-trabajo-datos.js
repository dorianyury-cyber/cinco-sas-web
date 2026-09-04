// Datos fijos del formato FR-GHSEQ-00179 (Orden de Trabajo) — separado de
// ordenes-trabajo.js/ordenes-trabajo-pdf.js para que ninguno de los dos
// dependa del otro (los dos lo importan a él, no se importan entre sí).

// Mismos 8 campos de "Trabajo de alto riesgo", en el mismo orden que la
// plantilla en papel (2 columnas de 4).
export const RIESGOS = [
  { clave: "altura", nombre: "Trabajo en altura" },
  { clave: "espaciosConfinados", nombre: "Espacios confinados" },
  { clave: "izajeCargas", nombre: "Izaje de cargas" },
  { clave: "manipulacionExplosivos", nombre: "Manipulación de explosivos" },
  { clave: "trabajoCaliente", nombre: "Trabajo en caliente" },
  { clave: "trabajoElectrico", nombre: "Trabajo eléctrico" },
  { clave: "excavaciones", nombre: "Excavaciones" },
  { clave: "transito", nombre: "Tránsito" }
];

// Mismos 15 elementos de "Requerimientos preoperacionales" de la plantilla
// (3 columnas de 5 en el papel original).
export const PREOPERACIONALES = [
  { clave: "guantesDielectricos", nombre: "Guantes Dieléctricos" },
  { clave: "gafas", nombre: "Gafas" },
  { clave: "cascoDielectrico", nombre: "Casco Dieléctrico" },
  { clave: "detectorTension", nombre: "Detector de Tensión" },
  { clave: "caretaProteccion", nombre: "Careta de Protección" },
  { clave: "pertiga", nombre: "Pértiga" },
  { clave: "botasDielectricas", nombre: "Botas Dieléctricas" },
  { clave: "puestaTierra", nombre: "Puesta a Tierra" },
  { clave: "ropaTrabajo", nombre: "Ropa de Trabajo" },
  { clave: "kitControlDerrame", nombre: "Kit Control Derrame" },
  { clave: "botiquin", nombre: "Botiquín" },
  { clave: "kitRescateAlturas", nombre: "Kit Rescate Alturas" },
  { clave: "guantesNitrilo", nombre: "Guantes de nitrilo/nylon" },
  { clave: "tapabocas", nombre: "Tapabocas" },
  { clave: "kitDesinfeccion", nombre: "Kit de Desinfección" }
];

// Las 12 recomendaciones SSTA son texto fijo de la compañía (no editable
// desde el formulario). Nota: el ítem 9 traía en la plantilla original un
// carácter mal codificado ("desinfecciónA³n"), corregido acá a
// "desinfección".
export const RECOMENDACIONES_SSTA = [
  "Dar cumplimiento a la política de seguridad vial y las otras políticas de HSEQ de CINCO S.A.S.",
  "Realizar el análisis de riesgos laborales y impactos ambientales antes, durante y después de la operación en terreno y aplicar los controles necesarios.",
  "Cumplir con las recomendaciones de SSTA mencionadas en el procedimiento misional que le aplique.",
  "Realizar Inspección de herramienta, equipo y vehículo antes de salir al sitio asignado para ejecutar las actividades.",
  "En caso de hacer uso del transporte público se debe efectuar con empresas de transporte reconocidas y verificar que los documentos del vehículo se encuentren en cumplimiento de las normas legales vigentes.",
  "En caso de que los desplazamientos se realicen en tempranas horas debe garantizar la regulación de horas de descanso y la ejecución de pausas activas.",
  "Las rutas permitidas para el desplazamiento son las resaltadas en el mapa.",
  "Hacer uso y mantenimiento adecuado de los EPP, EPCC y EPCRE entregados para el desarrollo de las actividades.",
  "Recuerde el uso obligatorio de tapabocas, lavado de manos frecuente, desinfección de elementos personal, distanciamiento físico con las personas que interactúe y aplique los protocolos de bioseguridad establecidos por la empresa.",
  "Realizar la adecuada separación de residuos en la fuente, de acuerdo al código de colores establecido en PGRIS.",
  "No arrojar residuos sólidos o líquidos en sitio no autorizado, estos deben ser depositados en los puntos de acopio seleccionados.",
  "Se recomienda tener en cuenta los riesgos a los que están expuestos los trabajadores en las actividades propias del cargo, como: Riesgo Biológico (Mordedura, Picadura, Rickettsia), Riesgo Público (Hurto), Riesgo Locativo (Caída a nivel) y Riesgo Físico (Temperaturas Extremas)."
];
