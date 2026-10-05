// Plantillas que el gestor carga de un clic en un contrato.
//
// LISTA_ACTA_INICIO: requisitos típicos para suscribir el acta de inicio de
// un contrato de obra o de servicios con interventoría. Es una base general
// (se construyó a partir de unos términos de referencia reales del sector
// eléctrico, que quedan solo como ejemplo en "soporte"); cada contrato la
// ajusta: edita, agrega o marca "No aplica".
//
// proyecto: "General" aplica a todo el contrato; "*" se repite una vez por
// cada proyecto / frente definido en el contrato (ej. una subestación, un
// tramo, un sector), agregando el nombre del frente al requisito.
//
// La misma lista alimenta el Excel de la lista de chequeo.

const C = "Contratista", E = "Contratante", I = "Interventoría";

export const CATEGORIAS_ACTA = [
  "1. Contractual y legal",
  "2. Garantías",
  "3. Personal",
  "4. Planeación y calidad",
  "5. Ingeniería y suministros",
  "6. Anticipo",
  "7. SST y ambiental",
  "8. Instalaciones y sitio",
  "9. Interventoría"
];

const L = (categoria, requisito, soporte, responsable, proyecto = "General") => ({ categoria, requisito, soporte, responsable, proyecto });
const [CL, GA, PE, PC, IS, AN, SA, SI, IN] = CATEGORIAS_ACTA;

export const LISTA_ACTA_INICIO = [
  // 1. Contractual y legal
  L(CL, "Contrato suscrito por las partes (copia firmada) y respaldo presupuestal de las vigencias del contrato.", "Contrato", E),
  L(CL, "Comunicación del contratante que designa la interventoría y el supervisor del contrato.", "TDR: seguimiento contractual", E),
  L(CL, "Certificado de existencia y representación legal vigente y RUT del contratista; documento del representante legal o apoderado.", "TDR: capacidad jurídica", C),
  L(CL, "Documento de conformación del consorcio o unión temporal con su representante (si aplica).", "TDR: formas conjuntas", C),
  L(CL, "Inscripción vigente en el registro de proveedores del contratante (si lo exige).", "TDR: registro de proveedores", C),
  L(CL, "Certificación de pago de aportes a seguridad social y parafiscales del contratista.", "Ley 789 de 2002, art. 50", C),
  L(CL, "Formatos de debida diligencia / conocimiento del contratista y del personal vinculado (si los exige el contratante).", "TDR: debida diligencia", C),
  L(CL, "Certificado de cumplimiento de estándares mínimos del SG-SST expedido por la ARL (si está obligado).", "Res. 0312 de 2019", C),
  L(CL, "Datos de contacto oficiales del contratista y canales de comunicación acordados.", "Buenas prácticas", C),

  // 2. Garantías
  L(GA, "Garantía única aprobada por el contratante, con comprobante de pago de la prima y clausulado. Normalmente el acta solo se firma con garantías aprobadas.", "TDR: garantías", E),
  L(GA, "Amparo de buen manejo y correcta inversión del anticipo, en el valor y la vigencia exigidos (ej. 100 % del anticipo, plazo + 6 meses).", "TDR: garantías", C),
  L(GA, "Amparo de cumplimiento, en el valor y la vigencia exigidos (ej. 20 %, plazo + 6 meses).", "TDR: garantías", C),
  L(GA, "Amparo de salarios, prestaciones sociales e indemnizaciones (ej. 15 %, plazo + 3 años).", "TDR: garantías", C),
  L(GA, "Amparo de calidad del servicio o de los bienes (ej. 20 %, plazo + 6 meses).", "TDR: garantías", C),
  L(GA, "Póliza todo riesgo construcción y montaje, si aplica (ej. 100 % del valor del contrato).", "TDR: garantías", C),
  L(GA, "Póliza de responsabilidad civil extracontractual (ej. 5 %, plazo + 30 días), con terceros afectados como beneficiarios.", "TDR: garantías", C),
  L(GA, "Si hay varios proyectos en una póliza única: cada proyecto individualizado en la carátula o anexo (objeto, valor y plazo).", "TDR: garantías", C),
  L(GA, "Ajuste de las vigencias de todas las pólizas a la fecha real del acta de inicio.", "TDR: garantías", C),

  // 3. Personal
  L(PE, "Listado total del personal contratado para la ejecución, con sus contratos de vinculación.", "TDR: personal", C),
  L(PE, "Afiliación de todo el personal al Sistema de Seguridad Social Integral (EPS, AFP, ARL).", "TDR: personal", C),
  L(PE, "Director del proyecto: el mismo ofertado, con la formación, experiencia y matrícula profesional vigente exigidas.", "TDR: personal mínimo", C),
  L(PE, "Directores o coordinadores de otras especialidades exigidos (ej. obra civil), con los perfiles ofertados.", "TDR: personal mínimo", C),
  L(PE, "Ingeniero residente con el perfil exigido", "TDR: personal mínimo", C, "*"),
  L(PE, "Coordinador HSEQ / SST con el perfil y certificaciones exigidos.", "TDR: personal mínimo", C),
  L(PE, "Profesional HSEQ / SST en sitio", "TDR: personal mínimo", C, "*"),
  L(PE, "Cuadrilla o equipo técnico con la conformación y experiencia exigidas", "TDR: personal mínimo", C, "*"),
  L(PE, "Cambios de personal frente a la oferta aprobados por el contratante con perfil igual o superior (si los hay).", "TDR: personal", E),
  L(PE, "Matrículas profesionales y certificados de competencia (ej. tarjeta CONTE) vigentes.", "Ley 842 de 2003 / Ley 19 de 1990", C),
  L(PE, "Certificados vigentes de trabajo seguro en alturas para quien trabaje a más de 1,5 m.", "Res. 4272 de 2021", C),
  L(PE, "Exámenes médicos ocupacionales de ingreso con concepto de aptitud.", "Res. 2346 de 2007", C),
  L(PE, "Identificación del personal (carné, ropa de trabajo marcada) según lo exigido por el contratante.", "TDR: identificación del personal", C),

  // 4. Planeación y calidad
  L(PC, "Plan de calidad presentado (ej. bajo ISO 9001:2015): requisitos aplicados al contrato, recursos, responsables, controles, procedimientos, registros y cronograma.", "TDR: plan de calidad", C),
  L(PC, "Plan de calidad con la estructura organizacional del proyecto: responsabilidades, autoridad e interrelaciones.", "TDR: plan de calidad", C),
  L(PC, "Plan de calidad revisado y aprobado por la interventoría y remitido al supervisor.", "TDR: plan de calidad", I),
  L(PC, "Procedimientos del sistema de calidad en copia controlada (ej. acciones correctivas, producto no conforme, control de documentos y registros, auditoría interna).", "TDR: plan de calidad", C),
  L(PC, "Instructivos específicos para la ejecución y el control de las actividades del contrato.", "TDR: plan de calidad", C),
  L(PC, "Cronograma de ejecución por proyecto o frente, con ruta crítica e hitos principales.", "TDR: obligaciones", C),
  L(PC, "Programa de fabricación o suministro de equipos de larga entrega, con fechas de pruebas en fábrica (si aplica).", "TDR: obligaciones", C),
  L(PC, "Formatos acordados: informe mensual del contratista, acta de recibo parcial, control de cambios y no conformidades.", "Buenas prácticas", I),
  L(PC, "Presupuesto detallado en análisis de precios unitarios (APU) y su relación con las unidades de pago o constructivas exigidas.", "TDR: obligaciones", C),

  // 5. Ingeniería y suministros
  L(IS, "Entrega formal por el contratante de diseños, planos, especificaciones y fichas técnicas vigentes.", "TDR: especificaciones", E),
  L(IS, "Informe del contratista de revisión de los diseños entregados, con observaciones o ajustes propuestos.", "TDR: obligaciones", C),
  L(IS, "Fichas técnicas de equipos y materiales entregadas a la interventoría para revisión antes de iniciar.", "TDR: obligaciones", C),
  L(IS, "Certificados de conformidad de producto de equipos y materiales (ej. RETIE, organismos acreditados ONAC).", "RETIE / TDR", C),
  L(IS, "Compatibilidad de los equipos con los sistemas existentes del contratante (ej. protocolos de comunicación SCADA).", "TDR: especificaciones", C),
  L(IS, "Plan de consignaciones o maniobras preliminar, coordinado con el operador (si se trabaja en instalaciones en servicio).", "TDR: obligaciones", C),
  L(IS, "Inventario y estado inicial de los equipos existentes a desmontar, trasladar o reintegrar.", "Buenas prácticas", I),
  L(IS, "Acta de replanteo programada.", "TDR: forma de pago", I),
  L(IS, "Organismo de inspección o certificación de la obra previsto (ej. inspección RETIE).", "RETIE / TDR", C),

  // 6. Anticipo
  L(AN, "Plan de inversión del anticipo en el formato del contratante.", "TDR: anticipo", C),
  L(AN, "Cuenta bancaria exclusiva del anticipo y su modalidad de manejo (ej. conjunta contratista – interventor).", "TDR: anticipo", C),
  L(AN, "Paquete para el pago del anticipo verificado según lo exigido (ej. acta de inicio, personal, cronograma, afiliaciones, programa SST, plan de manejo ambiental, plan de inversión).", "TDR: forma de pago", I),

  // 7. SST y ambiental
  L(SA, "Plan o programa del SG-SST del contrato.", "Dec. 1072 de 2015 / Res. 0312 de 2019", C),
  L(SA, "Matriz de identificación de peligros y valoración de riesgos por actividad y sitio.", "Dec. 1072 de 2015", C),
  L(SA, "Procedimientos de trabajo seguro de las tareas críticas (ej. alturas, riesgo eléctrico, izaje, espacios confinados).", "Res. 4272 de 2021 / Res. 5018 de 2019", C),
  L(SA, "Plan de emergencias y contingencias, brigada y señalización por frente.", "Dec. 1072 de 2015", C),
  L(SA, "Entrega inicial de elementos de protección personal y de señalización, con registros firmados.", "Dec. 1072 de 2015", C),
  L(SA, "Plan estratégico de seguridad vial (si aplica) y documentos de vehículos y conductores.", "Ley 1503 de 2011", C),
  L(SA, "Inspección inicial de vehículos, equipos y herramientas, con certificados de calibración vigentes.", "Buenas prácticas", C),
  L(SA, "Inducción y capacitación inicial del personal en los riesgos de la actividad.", "Dec. 1072 de 2015", C),
  L(SA, "Plan de manejo ambiental del contrato (residuos, materiales peligrosos, ruido, escombros, etc.).", "TDR / Dec. 1076 de 2015", C),
  L(SA, "Permisos y licencias requeridos (ej. aprovechamiento forestal, ocupación de espacio, disposición de escombros).", "TDR / normativa ambiental", C),
  L(SA, "Socialización del manual o lineamientos HSEQ del contratante.", "TDR", I),

  // 8. Instalaciones y sitio
  L(SI, "Oficina de obra o lugar de trabajo adecuado.", "TDR: obligaciones", C),
  L(SI, "Campamentos o instalaciones con servicios sanitarios para el personal (si aplica).", "TDR: obligaciones", C),
  L(SI, "Bodegas y zonas de acopio seguras, señalizadas y protegidas.", "TDR: obligaciones", C),
  L(SI, "Acta de vecindad con registro fotográfico del estado inicial de predios y vías vecinos.", "Buenas prácticas", I),
  L(SI, "Procedimiento de ingreso a las instalaciones del contratante acordado (autorizaciones, acompañamiento, horarios).", "TDR", E),
  L(SI, "Registro fotográfico del estado inicial del sitio", "Buenas prácticas", I, "*"),

  // 9. Interventoría
  L(IN, "Plan de trabajo de la interventoría: personal, metodología de control y frecuencia de visitas.", "Contrato de interventoría", I),
  L(IN, "Revisión de la matriz de riesgos del contrato y de los riesgos propios de la ejecución.", "TDR: matriz de riesgos", I),
  L(IN, "Socialización del manual de supervisión o seguimiento contractual del contratante.", "TDR", I),
  L(IN, "Reunión de inicio: comités de obra, flujo de aprobaciones, plazos de respuesta y canales oficiales.", "Buenas prácticas", I),
  L(IN, "Bitácora o libro de obra abierto por frente.", "Buenas prácticas", I),
  L(IN, "Régimen de multas y cláusula penal del contrato explicado en la reunión de inicio.", "Contrato", I)
];

// Expande la lista para un contrato: los requisitos con proyecto "*" se
// repiten por cada frente ("Requisito — Frente"); sin frentes, quedan como
// un solo requisito "General".
export function expandirPorFrentes(lista, frentes) {
  const out = [];
  for (const r of lista) {
    if (r.proyecto !== "*") { out.push(r); continue; }
    if (!frentes.length) { out.push({ ...r, requisito: `${r.requisito}.`, proyecto: "General" }); continue; }
    frentes.forEach((fr) => out.push({ ...r, requisito: `${r.requisito} — ${fr}.`, proyecto: fr }));
  }
  return out;
}
