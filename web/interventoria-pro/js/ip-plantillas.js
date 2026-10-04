// Plantillas que el gestor carga de un clic en un contrato nuevo.
//
// LISTA_ACTA_INICIO: requisitos para suscribir el acta de inicio de un
// contrato de obra, armada a partir de los términos de referencia de la
// Invitación Pública EHUI-SD-047-2026 de Electrohuila (subestaciones
// Seboruco, Sur y Oriente — numerales citados en "soporte"), más los
// controles propios de la interventoría. Es la misma lista que se exporta
// a Excel (scripts fuera del sitio la leen de aquí), así no se duplica.
//
// Campos: categoria, requisito, soporte (numeral TDR), responsable,
// proyecto ("General" o un frente concreto).

const C = "Contratista", E = "Electrohuila", I = "Interventoría";

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
  L(CL, "Contrato suscrito por las partes (copia firmada) y registro presupuestal / CDP de las vigencias 2026 y 2027.", "1.7 · 4.2", E),
  L(CL, "Comunicación de Electrohuila que designa la interventoría externa y el supervisor del contrato (notificación al interventor).", "4.4 · 4.12", E),
  L(CL, "Certificado de existencia y representación legal vigente (≤ 30 días) y RUT del contratista; documento del representante legal o apoderado para obra.", "3.4.2 · 3.4.7", C),
  L(CL, "Documento de conformación del consorcio o unión temporal con su representante (si aplica).", "3.4.5", C),
  L(CL, "Inscripción vigente en el Registro de Proveedores de Electrohuila.", "3.4.22", C),
  L(CL, "Certificación de pago de aportes a seguridad social y parafiscales del contratista (revisor fiscal o representante legal).", "3.4.6", C),
  L(CL, "Formato de Debida Diligencia (Anexo 7) diligenciado por cada persona vinculada al contrato y autorización de verificación periódica.", "4.8 · 4.9.2-19", C),
  L(CL, "Certificado de cumplimiento de estándares mínimos del SG-SST expedido por la ARL / Ministerio del Trabajo (si está obligado).", "4.9.2-16", C),
  L(CL, "Datos de contacto oficiales del contratista (correos, teléfonos, dirección de notificaciones) y canales de comunicación acordados.", "Buenas prácticas", C),

  // 2. Garantías
  L(GA, "Garantía única aprobada por Electrohuila (División de Servicios Administrativos), con comprobante de pago de la prima y clausulado general y particular. El acta solo se firma con garantías aprobadas.", "4.4 · 4.5", E),
  L(GA, "Amparo de buen manejo y correcta inversión del anticipo: 100 % del anticipo, vigencia plazo + 6 meses.", "4.5-a", C),
  L(GA, "Amparo de cumplimiento: 20 % del valor del contrato, vigencia plazo + 6 meses.", "4.5-b", C),
  L(GA, "Amparo de salarios, prestaciones sociales e indemnizaciones: 15 %, vigencia plazo + 3 años.", "4.5-c", C),
  L(GA, "Amparo de calidad del servicio: 20 %, vigencia plazo + 6 meses.", "4.5-d", C),
  L(GA, "Póliza todo riesgo construcción y montaje: 100 % del valor del contrato (tomador contratista; asegurado y beneficiario Electrohuila).", "4.5-g", C),
  L(GA, "Póliza de responsabilidad civil extracontractual: 5 %, vigencia plazo + 30 días (beneficiarios Electrohuila y terceros afectados).", "4.5-h", C),
  L(GA, "Si es póliza única: proyectos Seboruco, Sur y Oriente individualizados en carátula o anexo (denominación, objeto, valor y plazo).", "4.5 parág. 2", C),
  L(GA, "Ajuste de vigencias de todas las pólizas a la fecha real del acta de inicio (compromiso de remitir el certificado de modificación).", "4.5", C),

  // 3. Personal
  L(PE, "Listado total del personal contratado para la obra con sus contratos de vinculación (entregado antes de firmar el acta).", "1.5.5", C),
  L(PE, "Afiliación de todo el personal al Sistema de Seguridad Social Integral (EPS, AFP, ARL) con planilla vigente.", "1.5.5", C),
  L(PE, "Director de obra eléctrica (1, 100 %): el mismo ofertado; ingeniero electricista con especialización, 20 años de experiencia, matrícula y certificado de vigencia COPNIA.", "1.5.6 · 3.6.2", C),
  L(PE, "Director de obra civil (1, 100 %): el mismo ofertado; ingeniero civil con especialización y experiencia exigida, matrícula vigente.", "1.5.6 · 3.6.2", C),
  L(PE, "Ingeniero residente eléctrico (100 %) con 5 años en obras de AT/MT — SE Seboruco.", "1.5.6", C, "Seboruco"),
  L(PE, "Ingeniero residente eléctrico (100 %) con 5 años en obras de AT/MT — SE Sur.", "1.5.6", C, "Sur"),
  L(PE, "Ingeniero residente eléctrico (100 %) con 5 años en obras de AT/MT — SE Oriente.", "1.5.6", C, "Oriente"),
  L(PE, "Residente de obra civil (100 %) con 15 años de experiencia y especialización.", "1.5.6", C),
  L(PE, "Profesional coordinador HSEQ (100 %): especialización, auditor interno ISO 9001, 14001 y 45001, auditor PESV.", "1.5.6", C),
  L(PE, "Profesional HSEQ (100 %) — SE Seboruco.", "1.5.6", C, "Seboruco"),
  L(PE, "Profesional HSEQ (100 %) — SE Sur.", "1.5.6", C, "Sur"),
  L(PE, "Profesional HSEQ (100 %) — SE Oriente.", "1.5.6", C, "Oriente"),
  L(PE, "Cuadrilla técnica — SE Seboruco: 2 linieros especializados, 1 supervisor MT/AT, 2 auxiliares calificados, 2 no calificados (5 años de experiencia).", "1.5.6", C, "Seboruco"),
  L(PE, "Cuadrilla técnica — SE Sur (misma conformación).", "1.5.6", C, "Sur"),
  L(PE, "Cuadrilla técnica — SE Oriente (misma conformación).", "1.5.6", C, "Oriente"),
  L(PE, "Cambios de personal frente a la oferta aprobados por Electrohuila con perfil igual o superior (si los hay).", "1.5.6 · 4.14-17", E),
  L(PE, "Matrículas profesionales vigentes y tarjetas CONTE / certificados de competencia del personal técnico electricista.", "1.5.6", C),
  L(PE, "Certificados vigentes de trabajo seguro en alturas para todo el personal que trabaje a más de 1,5 m.", "1.5.6 · Res. 4272/2021", C),
  L(PE, "Exámenes médicos ocupacionales de ingreso con concepto de aptitud (incluye énfasis en alturas).", "Res. 0312/2019", C),
  L(PE, "Carnés de doble faz codificados y numerados, y ropa de trabajo marcada \"Contratista - Electrohuila S.A. E.S.P.\"; calzado de seguridad.", "1.5.7", C),

  // 4. Planeación y calidad
  L(PC, "Plan de Calidad (ISO 9001:2015) presentado: requisitos de la norma aplicados al contrato, recursos, responsables, controles, procedimientos, registros y cronograma del SGC.", "1.5.8", C),
  L(PC, "Plan de Calidad con estructura organizacional del proyecto: niveles de responsabilidad, autoridad e interrelaciones de quien dirige, ejecuta, verifica y revisa.", "1.5.8", C),
  L(PC, "Plan de Calidad revisado y APROBADO por la interventoría y remitido al supervisor de Electrohuila para comentarios.", "1.5.8", I),
  L(PC, "Copia controlada de procedimientos ISO: acciones correctivas y preventivas, producto no conforme, control de registros, control de documentos y auditoría interna.", "1.5.8", C),
  L(PC, "Instructivos específicos de ejecución y control de las actividades del contrato (montaje GIS, transformadores, celdas, obra civil, pruebas).", "1.5.8", C),
  L(PC, "Cronograma de ejecución por proyecto (Seboruco, Sur, Oriente) con ruta crítica, hitos de FAT, llegada de equipos, consignaciones y puesta en servicio hasta el 31-dic-2027.", "4.4 · 4.9.1-48", C),
  L(PC, "Programa de fabricación de equipos de larga entrega (transformadores 30/40 y 40/50 MVA, bahías GIS 115 kV, celdas 36 kV, IED) con fechas de FAT.", "4.9.1-42 · 4.9.1-49", C),
  L(PC, "Formatos acordados: informe mensual del contratista, acta de recibo parcial, control de cambios de diseño y no conformidades.", "4.9.1-4 · 4.9.1-28", I),
  L(PC, "Presupuesto en APU y relación de APU con las Unidades Constructivas (UC) según capítulo 14 de la Resolución CREG 015 de 2018.", "4.9.1-10 · 4.9.1-11", C),

  // 5. Ingeniería y suministros
  L(IS, "Entrega formal por Electrohuila de diseños, planos (Anexo 25), especificaciones (Anexos 22 y 23) y fichas técnicas (Anexo 24) vigentes.", "1.5.3 · 1.5.4", E),
  L(IS, "Informe del contratista de revisión y validación de los diseños entregados, con observaciones o ajustes propuestos (RETIE, IEC, NTC, NSR-10).", "4.9.1-2 · 4.9.1-7", C),
  L(IS, "Fichas técnicas de equipos y materiales a suministrar entregadas a la interventoría para revisión y validación técnica, antes de iniciar la obra.", "4.9.1-3 · 4.9.1-14", C),
  L(IS, "Certificados de conformidad de producto RETIE y certificaciones ONAC / IAF / ILAC de equipos y materiales.", "1.5.2 · 4.9.1-6", C),
  L(IS, "Compatibilidad SCADA confirmada: protocolos IEC 61850 / Modbus TCP-IP / DNP3 / OPC UA de transformadores, celdas e IED.", "4.9.1-36 · 4.9.1-41", C),
  L(IS, "Plan de consignaciones preliminar por subestación (maniobras, desenergizaciones y tiempos), coordinado con Operación de Electrohuila.", "4.9.1-47", C),
  L(IS, "Inventario y estado inicial de equipos existentes a desmontar, trasladar o reintegrar en cada subestación.", "1.5.1 · 4.9.1-31", I),
  L(IS, "Acta de replanteo programada (requisito para el pago del anticipo).", "4.3", I),
  L(IS, "Organismo de inspección RETIE acreditado ONAC previsto y gestionado por el contratista.", "4.9.1-29 · 4.9.1-30", C),

  // 6. Anticipo
  L(AN, "Plan de inversión del anticipo diligenciado en el formato del Anexo 21.", "4.3 · 4.9.2-17", C),
  L(AN, "Cuenta bancaria exclusiva del anticipo a nombre del contratista, de manejo conjunto contratista – interventor.", "4.3", C),
  L(AN, "Certificación de equipos que fabrica el contratista y ciudad de la actividad fabril (si es fabricante).", "4.3", C),
  L(AN, "Paquete para el pago del anticipo verificado: acta de inicio, listado de personal, cronograma, afiliaciones, programa SST, plan de manejo ambiental, plan de inversión y acta de replanteo.", "4.3", I),

  // 7. SST y ambiental
  L(SA, "Programa / plan del SG-SST del contrato conforme al Decreto 1072 de 2015, la Resolución 0312 de 2019 y la Resolución 5018 de 2019 (sector eléctrico).", "1.5.5 · 4.9.1-23", C),
  L(SA, "Matriz de identificación de peligros y valoración de riesgos (IPEVR) por subestación y actividad.", "1.5.5", C),
  L(SA, "Procedimientos de trabajo seguro: alturas (Res. 4272/2021), riesgo eléctrico (5 reglas de oro), espacios confinados e izaje de cargas.", "1.5.5 · 4.9.1-27", C),
  L(SA, "Plan de emergencias y contingencias, brigada, botiquín y señalización de evacuación por frente.", "4.9.1-17", C),
  L(SA, "Entrega inicial de EPP, EPCRE (riesgo eléctrico), EPCC (protección contra caídas) y señalización, con registros firmados.", "1.5.5 · 4.9.1-26", C),
  L(SA, "Plan Estratégico de Seguridad Vial (si aplica) y documentos de vehículos: SOAT, revisión técnico-mecánica, licencias de conducción.", "1.5.5", C),
  L(SA, "Inspección pre-uso de vehículos, equipos y herramientas (incluye certificados de calibración de equipos de prueba y de izaje).", "1.5.5 · 4.9.1-28i", C),
  L(SA, "Inducción y capacitación del personal: alturas, riesgo eléctrico, manipulación de cargas y primeros auxilios.", "4.9.1-27", C),
  L(SA, "Cargue de la información SST en el aplicativo de Electrohuila (licencia a cargo del contratista).", "1.5.5", C),
  L(SA, "Plan de manejo ambiental (residuos, aceites dieléctricos, SF6 de equipos GIS, ruido, material de excavación).", "4.3 · 4.9.1-23", C),
  L(SA, "Permisos y licencias requeridos (aprovechamiento forestal si aplica, ocupación, disposición de escombros).", "1.5.9 · 4.9.1-24", C),
  L(SA, "Socialización del Manual de Gestión HSEQ para Contratistas y Proveedores de Electrohuila (Anexo 15).", "Anexo 15", I),

  // 8. Instalaciones y sitio
  L(SI, "Oficina de obra adecuada en sitio.", "4.9.1-21", C),
  L(SI, "Campamentos con servicios sanitarios adecuados para el personal.", "4.9.1-20", C),
  L(SI, "Bodegas y zonas de acopio seguras, señalizadas y protegidas (humedad, polvo, vandalismo) para equipos y materiales.", "4.9.1-15 · 16 · 19", C),
  L(SI, "Acta de vecindad con registro fotográfico del estado inicial de predios, vías de acceso y propiedades vecinas.", "1.5.9", I),
  L(SI, "Procedimiento de ingreso a subestaciones energizadas acordado con Electrohuila (autorizaciones, acompañamiento de operación, horarios).", "1.5.5", E, "General"),
  L(SI, "Registro fotográfico del estado inicial de la SE Seboruco.", "Buenas prácticas", I, "Seboruco"),
  L(SI, "Registro fotográfico del estado inicial de la SE Sur.", "Buenas prácticas", I, "Sur"),
  L(SI, "Registro fotográfico del estado inicial de la SE Oriente.", "Buenas prácticas", I, "Oriente"),

  // 9. Interventoría
  L(IN, "Plan de trabajo de la interventoría con su personal, metodología de control y frecuencia de visitas por subestación.", "4.12", I),
  L(IN, "Revisión de la matriz de riesgos del proceso (Anexo 18) y riesgos propios de la ejecución.", "1.4 · Anexo 18", I),
  L(IN, "Socialización del Manual de Seguimiento de la Ejecución Contractual de Electrohuila (Anexo 12).", "Anexo 12", I),
  L(IN, "Reunión de inicio: periodicidad de comités de obra, flujo de aprobaciones, plazos de respuesta y canales oficiales.", "4.12", I),
  L(IN, "Bitácora o libro de obra abierto por frente.", "Buenas prácticas", I),
  L(IN, "Régimen de multas (0,5 % por día / por obligación, tope 10 %) y cláusula penal (20 %) explicados en la reunión de inicio.", "4.15 · 4.16 · 4.17", I)
];
