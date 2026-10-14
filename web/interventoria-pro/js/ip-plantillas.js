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
  "9. Interventoría",
  "10. Contrato de interventoría"
];

// De dónde sale cada exigencia (la cláusula o numeral exacto va en "soporte").
export const FUENTES_REQUISITO = [
  "Contrato", "Términos de referencia", "Contrato y términos de referencia", "Contrato de interventoría",
  "Manual de seguimiento del contratante", "Norma", "Buenas prácticas"
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

// PLAN_ACTUACIONES: lo que la propia interventoría debe hacer y cuándo, de
// la designación al cierre. Base general: cada contrato le pone fechas y la
// ajusta. Tipos: "Única" (tiene inicio y fin), "Hito" (fecha clave),
// "Periódica" (se repite con una frecuencia: el aplicativo genera cada
// vencimiento) y "Eventual" (cuando se presente, sin fecha fija).
// registro = módulo donde queda el dato y la evidencia de esa actuación.
export const FASES_PLAN = [
  "0. Alistamiento", "1. Requisitos del acta de inicio", "2. Arranque y anticipo", "3. Ingeniería y suministros",
  "4. Ejecución", "5. Pruebas, puesta en servicio y entrega", "6. Cierre", "Permanente"
];
export const TIPOS_ACTUACION = ["Única", "Hito", "Periódica", "Eventual (cuando se presente)"];
export const FRECUENCIAS = ["Semanal", "Quincenal", "Mensual", "Trimestral"];

const [F0, F1, F2, F3, F4, F5, F6, FP] = FASES_PLAN;
const U = "Única", H = "Hito", P = "Periódica", EV = "Eventual (cuando se presente)";
const A = (fase, actuacion, tipo, entregable, responsable, registro = "", frecuencia = "") => ({ fase, actuacion, tipo, entregable, responsable, registro, frecuencia });

export const PLAN_ACTUACIONES = [
  A(F0, "Recibir la designación formal de la interventoría y reunirse con el supervisor para acordar canales, formatos y fechas.", U, "Acta de reunión con el supervisor", "Director de interventoría", "cronologia"),
  A(F0, "Conformar el equipo exigido y entregar las hojas de vida al contratante para su aprobación.", U, "Hojas de vida aprobadas", "Director de interventoría"),
  A(F0, "Declarar la ausencia de conflictos de interés, inhabilidades e incompatibilidades.", U, "Declaraciones firmadas", "Asesor jurídico"),
  A(F0, "Estudiar el contrato, los términos de referencia, los anexos y la propuesta, y elaborar la matriz de obligaciones.", U, "Matriz de obligaciones", "Director de interventoría"),
  A(F0, "Elaborar el plan de trabajo, la metodología de control y los formatos de la interventoría.", U, "Plan de trabajo y formatos", "Director de interventoría"),
  A(F0, "Revisar la matriz de riesgos del contrato y agregar los riesgos de la ejecución.", U, "Matriz de riesgos actualizada", "Director de interventoría", "riesgos"),
  A(F1, "Requerir al contratista los documentos para el acta de inicio con la lista de chequeo.", U, "Oficio de requerimiento", "Director de interventoría", "actainicio"),
  A(F1, "Revisar las garantías del contratista (amparos, valores, vigencias y beneficiarios).", U, "Concepto de revisión de garantías", "Asesor jurídico", "garantias"),
  A(F1, "Verificar el personal mínimo frente a la propuesta.", U, "Matriz de verificación de personal", "Director de interventoría", "personal"),
  A(F1, "Revisar y aprobar el plan de calidad del contratista.", U, "Plan de calidad aprobado", "Director de interventoría", "entregables"),
  A(F1, "Revisar el cronograma de ejecución y el programa de suministros de larga entrega.", U, "Concepto sobre el cronograma", "Residente", "entregables"),
  A(F1, "Revisar el SG-SST y el plan de manejo ambiental del contratista.", U, "Concepto SST y ambiental", "Profesional HSEQ", "entregables"),
  A(F1, "Suscribir el acta de inicio con todos los requisitos cumplidos.", H, "Acta de inicio", "Director de interventoría", "cronologia"),
  A(F2, "Realizar la reunión de inicio: comités, aprobaciones, plazos de respuesta y régimen sancionatorio.", U, "Acta de reunión de inicio", "Director de interventoría"),
  A(F2, "Levantar el acta de replanteo y el acta de vecindad con registro fotográfico.", U, "Actas de replanteo y vecindad", "Residente", "fotos"),
  A(F2, "Gestionar la socialización del proyecto con la comunidad antes de iniciar las obras.", U, "Registro de socialización", "Profesional social / HSEQ", "socializacion"),
  A(F2, "Revisar el plan de inversión, la cuenta y los soportes para el pago del anticipo.", H, "Visto bueno del anticipo", "Profesional financiero", "anticipo"),
  A(F3, "Revisar los diseños, planos y memorias del contratista y emitir concepto.", U, "Concepto de diseños", "Residente", "entregables"),
  A(F3, "Revisar fichas técnicas y certificados de conformidad de equipos y materiales antes de fabricar o comprar.", U, "Fichas técnicas aprobadas", "Residente", "suministros"),
  A(F3, "Asistir a las pruebas en fábrica (FAT) de los equipos principales.", H, "Actas de FAT", "Residente", "suministros"),
  A(F3, "Recibir los equipos en sitio y supervisar las pruebas de recepción (SAT).", U, "Actas de recibo y SAT", "Residente", "suministros"),
  A(F3, "Tramitar los cambios de diseño o de especificaciones que proponga el contratista.", EV, "Conceptos de cambio", "Residente", "cambios"),
  A(F4, "Supervisar la obra civil y el montaje según diseños, especificaciones y normas.", U, "Registros de inspección", "Residente", "fotos"),
  A(F4, "Revisar y coordinar consignaciones, ventanas de trabajo y maniobras con el operador.", EV, "Consignaciones aprobadas", "Residente", "consignaciones"),
  A(F5, "Supervisar las pruebas, la puesta en servicio y la energización.", H, "Actas de pruebas y energización", "Director de interventoría"),
  A(F5, "Verificar la certificación de la obra (ej. dictamen RETIE) antes de energizar.", H, "Certificación de la obra", "Residente", "entregables"),
  A(F5, "Revisar los entregables finales: planos as-built, manuales, protocolos y dossier.", U, "Entregables finales aprobados", "Residente", "entregables"),
  A(F5, "Suscribir el acta de entrega y recibo final.", H, "Acta de entrega y recibo final", "Director de interventoría", "cronologia"),
  A(F5, "Elaborar el informe final de interventoría.", U, "Informe final", "Director de interventoría", "informe"),
  A(F6, "Preparar y suscribir el acta de cierre y balance (o liquidación) del contrato.", H, "Acta de cierre y balance", "Director de interventoría", "cronologia"),
  A(F6, "Presentar la re-evaluación del proveedor en el formato del contratante.", U, "Informe de re-evaluación", "Director de interventoría"),
  A(FP, "Realizar el comité de obra con el contratista y el contratante.", P, "Acta de comité", "Director de interventoría", "", "Semanal"),
  A(FP, "Visitar cada frente para verificar avance, calidad y seguridad, con registro fotográfico.", P, "Registro de visita y fotos", "Residente", "fotos", "Semanal"),
  A(FP, "Verificar SST y ambiental en campo: EPP, permisos de trabajo, inspecciones y residuos.", P, "Inspecciones SST", "Profesional HSEQ", "inspecciones", "Semanal"),
  A(FP, "Presentar el informe mensual de interventoría al contratante.", P, "Informe mensual", "Director de interventoría", "informe", "Mensual"),
  A(FP, "Revisar y suscribir las actas parciales de pago con sus soportes.", P, "Actas parciales", "Profesional financiero", "financiero", "Mensual"),
  A(FP, "Verificar el pago de nómina, seguridad social y parafiscales del contratista.", P, "Planillas verificadas", "Profesional HSEQ", "segsocial", "Mensual"),
  A(FP, "Controlar la inversión y amortización del anticipo.", P, "Conciliación del anticipo", "Profesional financiero", "anticipo", "Mensual"),
  A(FP, "Actualizar la matriz de riesgos y el seguimiento al cronograma.", P, "Matriz y cronograma actualizados", "Director de interventoría", "riesgos", "Mensual"),
  A(FP, "Controlar la vigencia y el valor de las garantías del contratista.", P, "Control de garantías", "Asesor jurídico", "garantias", "Trimestral"),
  A(FP, "Requerir al contratista ante incumplimientos y adelantar el procedimiento de multas.", EV, "Requerimientos", "Director de interventoría", "requerimientos")
].map((a, i) => ({ item: i + 1, ...a }));

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
