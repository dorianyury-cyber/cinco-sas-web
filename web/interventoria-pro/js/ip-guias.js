// Guía de cada módulo de Interventoría PRO: qué se controla, cómo se
// controla y qué revisa el aplicativo por sí solo. Redactada en términos
// generales para cualquier contrato de interventoría o seguimiento; lo
// específico va solo como ejemplo ("ej."). Se muestra arriba de cada
// módulo (ip-modulo.js) y se resume en Generalidades.
//
// Formato: { que: texto, como: [pasos], automatico: texto, ejemplo?: texto }

export const GUIAS = {
  // ---------------------------------------------------------------- Administrativo
  actainicio: {
    que: "Los requisitos que deben estar cumplidos antes de firmar el acta de inicio: documentos contractuales y legales, garantías, personal, planes, programación, anticipo, seguridad y salud en el trabajo, condiciones del sitio y organización de la interventoría.",
    como: [
      "Carga la lista base con el botón «Cargar lista base» y ajústala a lo que exige el contrato (agrega, edita o marca «No aplica»).",
      "A medida que el contratista o la entidad entregan cada soporte, cambia el estado a «Recibido» y, una vez revisado, a «Aprobado» o «Con observaciones».",
      "Anota la fecha de verificación y el enlace a la evidencia para dejar trazabilidad.",
      "En «Fuente» y «Soporte» deja de qué documento sale cada exigencia y su cláusula o numeral exacto (contrato, términos de referencia, contrato de interventoría, manual del contratante, norma).",
      "Firma el acta solo cuando el cumplimiento llegue al 100 % (todo «Aprobado» o «No aplica»)."
    ],
    automatico: "Calcula el porcentaje de cumplimiento total y por categoría, y avisa si el acta de inicio se registró en la cronología con requisitos aún sin aprobar.",
    ejemplo: "Ej.: garantías aprobadas por la entidad, hojas de vida del personal ofertado, plan de calidad aprobado, cuenta conjunta del anticipo."
  },
  actuaciones: {
    que: "Lo que la propia interventoría debe hacer y cuándo, desde la designación hasta el cierre: actuaciones únicas (con inicio y fin), hitos (fechas clave), periódicas (comités, visitas, informe mensual, actas de pago) y eventuales (cuando se presenten).",
    como: [
      "Carga el plan base con «Ver y cargar lista base» o importa el plan del contrato desde Excel (el ítem identifica cada actuación y evita duplicados).",
      "Ponle fechas a cada actuación; en las periódicas elige la frecuencia y, si aplica, el día límite del mes (ej. 7 para un informe que se entrega dentro de los primeros 7 días).",
      "En «Dónde se registra» elige el módulo que guarda el dato y la evidencia: desde la tabla se abre con un clic, para no registrar lo mismo dos veces.",
      "Cuando se cumpla una única o un hito, márcala «Cumplida» con su fecha; en las periódicas marca cada vencimiento cumplido."
    ],
    automatico: "Genera los vencimientos de las periódicas, avisa en Inicio lo vencido y lo que vence pronto, calcula el cumplimiento de las periódicas y dibuja la curva S del plan con lo cumplido (sin porcentajes estimados). El informe mensual trae una sección con lo que vencía en el mes.",
    ejemplo: "Ej.: aprobar el plan de calidad antes del acta de inicio (única), asistir a la FAT del transformador (hito), comité de obra (semanal), informe mensual a más tardar el día 7 (mensual)."
  },
  cronologia: {
    que: "La línea de tiempo de los hitos administrativos del contrato.",
    como: [
      "Registra cada acta o evento con su tipo, fecha y una descripción breve.",
      "Adjunta el enlace al documento firmado.",
      "Mantenla al día: es la base del resumen cronológico del informe mensual."
    ],
    automatico: "Ordena los eventos por fecha y los lleva al informe acumulados hasta el mes del informe.",
    ejemplo: "Ej.: acta de inicio, acta de replanteo, suspensión, reinicio, adición, prórroga, otrosí, recibo final, liquidación."
  },
  observaciones: {
    que: "Las observaciones del periodo para el capítulo correspondiente del informe.",
    como: [
      "Registra una observación por mes con el análisis de la interventoría: hallazgos, avances, compromisos y recomendaciones.",
      "Redacta en términos verificables (qué, quién, cuándo) para que pueda citarse en el informe sin reescribir."
    ],
    automatico: "Las observaciones del mes elegido se copian tal cual en el capítulo del informe mensual."
  },
  anexos: {
    que: "Los documentos soporte de cada capítulo, organizados por mes.",
    como: [
      "Registra el nombre del documento, el mes y el enlace a la carpeta o archivo (ej. OneDrive, Drive).",
      "Usa nombres claros y consistentes para encontrarlos fácilmente al armar el informe."
    ],
    automatico: "Los anexos del mes elegido aparecen como tabla en el capítulo del informe."
  },

  // ---------------------------------------------------------------- Financiero
  financiero: {
    que: "El estado financiero del contrato: valor inicial, adiciones, reducciones, anticipo, amortizaciones y valor ejecutado mediante actas parciales o constancias de cumplimiento.",
    como: [
      "Registra el valor inicial en la información del contrato.",
      "Registra cada movimiento (acta parcial, adición, anticipo, amortización, acta de recibo final) con su fecha y valor.",
      "Verifica que cada acta parcial esté soportada por el avance de obra o servicio aprobado por la interventoría."
    ],
    automatico: "Calcula el valor total, ejecutado, saldo y porcentaje de avance financiero, lo compara con el avance técnico y avisa si lo ejecutado supera el valor del contrato.",
    ejemplo: "Ej.: «Acta parcial N.º 2 — $ 1.008.373.403»."
  },
  anticipo: {
    que: "La inversión del anticipo frente al plan de inversión aprobado.",
    como: [
      "Registra el anticipo y sus amortizaciones en Estado financiero.",
      "Aquí registra cada gasto pagado con el anticipo, con su soporte.",
      "Compara lo invertido contra el plan de inversión aprobado y la cuenta de manejo conjunto, si el contrato la exige."
    ],
    automatico: "Calcula lo recibido, invertido, por invertir y por amortizar, y avisa si lo invertido supera el anticipo."
  },

  // ---------------------------------------------------------------- Jurídico
  garantias: {
    que: "La vigencia y suficiencia de las pólizas y amparos exigidos en el contrato.",
    como: [
      "Registra cada amparo con aseguradora, número de póliza, valor asegurado y vigencia.",
      "Verifica que los valores y vigencias correspondan a los porcentajes y plazos del contrato.",
      "Actualízalas cada vez que haya acta de inicio, adición, prórroga, suspensión o reinicio."
    ],
    automatico: "Marca las pólizas vencidas y las que vencen en los próximos 30 días.",
    ejemplo: "Ej.: cumplimiento, buen manejo del anticipo, salarios y prestaciones, calidad, estabilidad de la obra, responsabilidad civil."
  },
  requerimientos: {
    que: "Los requerimientos por incumplimiento y el debido proceso hasta su cierre o la imposición de multas.",
    como: [
      "Registra el requerimiento con la obligación incumplida, el radicado y el plazo de respuesta.",
      "Anota la respuesta del contratista y el análisis de la interventoría.",
      "Si procede, registra la multa propuesta según lo pactado en el contrato y escala a la entidad.",
      "Cierra el registro cuando el contratista subsane o se resuelva el caso."
    ],
    automatico: "Avisa los requerimientos con plazo de respuesta vencido y suma las multas propuestas frente al tope del contrato.",
    ejemplo: "Ej.: multa del 0,5 % del valor del contrato por día de retraso, con un tope del 10 %."
  },

  // ---------------------------------------------------------------- SST
  personal: {
    que: "El personal vinculado al contrato, su perfil, afiliaciones y salario.",
    como: [
      "Registra a cada persona con cargo, matrícula o licencia, EPS, AFP, ARL, salario y fecha de ingreso.",
      "Verifica que el personal mínimo exigido esté vinculado y que los perfiles correspondan a los ofertados.",
      "Registra la fecha de retiro cuando alguien sale del contrato (no lo borres)."
    ],
    automatico: "Marca salarios por debajo del SMMLV o del pactado para el cargo y personas sin afiliación completa; calcula la nómina mensual."
  },
  novedades: {
    que: "Las novedades del personal mes a mes.",
    como: [
      "Registra cada novedad con la persona, el tipo y las fechas.",
      "Adjunta la evidencia (certificado de afiliación, incapacidad, carta de retiro)."
    ],
    automatico: "Arma la tabla de novedades por tipo y mes que va en el informe, y alimenta el indicador de ausentismo.",
    ejemplo: "Ej.: afiliación, retiro, incapacidad, vacaciones, licencia, cambio de cargo."
  },
  epp: {
    que: "La entrega de elementos de protección personal y dotación al personal.",
    como: [
      "Registra cada entrega con la persona, la fecha, los elementos y el acta firmada.",
      "Verifica que los elementos correspondan a los riesgos de la actividad."
    ],
    automatico: "Avisa qué personas activas no tienen ninguna entrega registrada."
  },
  examenes: {
    que: "Los exámenes médicos ocupacionales de ingreso, periódicos y de egreso.",
    como: [
      "Registra cada examen con la persona, el tipo, el concepto de aptitud y la fecha del próximo.",
      "Verifica los énfasis exigidos por la actividad (ej. trabajo en alturas)."
    ],
    automatico: "Avisa quién no tiene examen de ingreso y qué exámenes periódicos están vencidos."
  },
  segsocial: {
    que: "El pago mensual de la seguridad social del personal.",
    como: [
      "Registra la planilla de cada mes con su número, fecha de pago y número de cotizantes.",
      "Verifica que estén todos los vinculados del mes antes de aprobar el acta de pago."
    ],
    automatico: "Compara mes a mes los cotizantes pagados con el personal vinculado y avisa los meses sin planilla o con personas por fuera."
  },
  accidentes: {
    que: "Los accidentes, incidentes y enfermedades laborales, su reporte e investigación.",
    como: [
      "Registra el evento con la persona, la descripción y los días de incapacidad.",
      "Verifica el reporte a la ARL dentro del plazo y la investigación con sus acciones."
    ],
    automatico: "Calcula mes a mes los indicadores de accidentalidad, severidad, enfermedad laboral y ausentismo, y avisa los eventos sin investigar."
  },
  capacitaciones: {
    que: "Las capacitaciones, inducciones, pausas activas y simulacros del periodo.",
    como: [
      "Registra cada actividad con el tema, la fecha, el número de asistentes y el formato de asistencia.",
      "Revisa que se cubran los temas críticos de la actividad (ej. alturas, riesgo eléctrico, primeros auxilios)."
    ],
    automatico: "Arma la tabla de capacitaciones por tipo y mes del informe."
  },
  inspecciones: {
    que: "Las inspecciones de seguridad a vehículos, equipos, herramientas, EPP, botiquines, extintores e instalaciones.",
    como: [
      "Registra cada inspección con su resultado y los hallazgos.",
      "Toda inspección «No conforme» debe tener una acción correctiva y su seguimiento."
    ],
    automatico: "Arma la tabla de inspecciones por mes y avisa las no conformes sin acción correctiva."
  },

  // ---------------------------------------------------------------- Social y ambiental
  socializacion: {
    que: "Las actividades de socialización y relacionamiento con la comunidad y los interesados.",
    como: [
      "Registra cada reunión o actividad con lugar, asistentes, acuerdos y evidencia (acta, listado, fotos).",
      "Haz seguimiento a los compromisos adquiridos con la comunidad."
    ],
    automatico: "Las actividades del mes pasan al capítulo social del informe."
  },
  aspectos: {
    que: "La identificación de aspectos e impactos ambientales por actividad y sus controles.",
    como: [
      "Registra cada actividad con su aspecto, impacto, significancia y medida de control.",
      "Actualiza la matriz cuando cambien las actividades o los frentes de trabajo."
    ],
    automatico: "La matriz completa se incluye en el capítulo ambiental del informe.",
    ejemplo: "Ej.: «Excavación — generación de residuos — contaminación del suelo — separación y disposición autorizada»."
  },
  planambiental: {
    que: "El cumplimiento de las actividades del plan de gestión o manejo ambiental.",
    como: [
      "Registra cada actividad del plan con su fecha programada.",
      "Cámbiala a «Cumplida» cuando se ejecute y adjunta la evidencia."
    ],
    automatico: "Calcula el porcentaje de cumplimiento del plan y avisa las actividades vencidas."
  },
  indicadores: {
    que: "La medición mensual de los indicadores ambientales frente a su meta.",
    como: [
      "Registra cada indicador por mes con su meta, resultado y unidad.",
      "Indica si la meta se cumple con un resultado mayor o menor."
    ],
    automatico: "Marca cada medición como «Cumple» o «No cumple»."
  },
  requisitos: {
    que: "El cumplimiento de la normatividad ambiental aplicable.",
    como: [
      "Registra cada norma con el requisito aplicable y su cumplimiento.",
      "Adjunta la evidencia de cumplimiento (permiso, certificado, registro)."
    ],
    automatico: "Avisa los requisitos legales sin cumplir."
  },
  incidentesamb: {
    que: "Los incidentes ambientales y su atención.",
    como: [
      "Registra el incidente con su descripción y la acción tomada.",
      "Ciérralo cuando la acción esté ejecutada y verificada."
    ],
    automatico: "Si no hay incidentes en el mes, el informe lo declara así."
  },

  // ---------------------------------------------------------------- Técnico
  cantidades: {
    que: "Las cantidades de obra contratadas frente a las ejecutadas, por componente.",
    como: [
      "Registra cada ítem con su componente, especificación, unidad y cantidad contratada.",
      "Actualiza la cantidad ejecutada con cada medición o acta parcial.",
      "Describe el estado del ítem (ej. «construida, conectada y energizada»)."
    ],
    automatico: "Calcula el porcentaje ejecutado por ítem y por componente.",
    ejemplo: "Ej.: redes de media y baja tensión (km), acometidas, transformadores, apoyos (und)."
  },
  suministros: {
    que: "El ciclo de los equipos y materiales principales: aprobación técnica, certificados, pruebas en fábrica (FAT), despacho, llegada a sitio y pruebas en sitio (SAT).",
    como: [
      "Registra cada equipo principal con su frente, tipo y fabricante.",
      "Aprueba la ficha técnica y verifica los certificados de conformidad antes de la fabricación o compra.",
      "Programa y documenta las pruebas FAT y SAT con sus protocolos.",
      "Registra la llegada a sitio y, si es importado, la declaración de importación."
    ],
    automatico: "Avisa las pruebas FAT vencidas o rechazadas y las fichas con observaciones; resume cuántos equipos están aprobados, en sitio y probados.",
    ejemplo: "Ej.: transformador de potencia, celdas, interruptores, equipos de protección y control."
  },
  cambios: {
    que: "Los cambios al diseño o a la ejecución propuestos durante el contrato.",
    como: [
      "Registra la solicitud con su justificación técnica y el profesional que la firma.",
      "Estima el impacto en costo y en plazo.",
      "Responde dentro del plazo acordado: aprobado, con observaciones o rechazado."
    ],
    automatico: "Avisa las solicitudes sin respuesta de la interventoría dentro del plazo."
  },
  consignaciones: {
    que: "La programación y el cumplimiento de las consignaciones o maniobras necesarias para trabajar en instalaciones en servicio.",
    como: [
      "Registra cada consignación con el equipo, el trabajo, la hora y la duración prevista.",
      "Actualiza su estado (solicitada, aprobada, ejecutada) y anota el número asignado por el operador.",
      "Registra si se ejecutó con retraso para el seguimiento de la continuidad del servicio."
    ],
    automatico: "Avisa las consignaciones sin cierre y las ejecutadas con retraso."
  },
  actividades: {
    que: "El avance físico del contrato por actividad y su comparación con lo programado (curva S).",
    como: [
      "Registra cada actividad del cronograma con su peso (%), duración y fecha de terminación.",
      "Cada mes registra el avance acumulado (%) de cada actividad.",
      "Lo ideal es que los pesos sumen 100 %."
    ],
    automatico: "Calcula el avance ponderado real contra el programado a hoy, dibuja la curva S y avisa las actividades atrasadas."
  },

  // ---------------------------------------------------------------- Riesgos, fotos y calidad
  riesgos: {
    que: "Los riesgos del contrato, su nivel y las medidas de monitoreo.",
    como: [
      "Registra cada riesgo con su categoría, probabilidad e impacto.",
      "Define la medida de monitoreo y el responsable.",
      "Revísalo periódicamente y actualiza su estado (abierto, mitigado, cerrado)."
    ],
    automatico: "Calcula el nivel (probabilidad × impacto) y avisa los riesgos abiertos de nivel alto."
  },
  fotos: {
    que: "La evidencia fotográfica de las actividades del periodo.",
    como: [
      "Sube la foto con la fecha, el capítulo relacionado y una observación clara de lo que muestra.",
      "Prefiere fotos que evidencien avance, cumplimiento o hallazgos."
    ],
    automatico: "Las fotos se comprimen al subirlas y las del mes elegido forman el registro fotográfico del informe."
  },
  entregables: {
    que: "Los documentos que el contratista debe presentar para revisión y aprobación de la interventoría, empezando por el plan de calidad.",
    como: [
      "Registra cada documento esperado con su tipo, frente y versión.",
      "Cuando lo radiquen, anota la fecha y el plazo de revisión de la interventoría.",
      "Emite el concepto (aprobado o con observaciones) y registra las nuevas versiones hasta su aprobación."
    ],
    automatico: "Avisa si no se ha registrado el plan de calidad y si la interventoría se pasó del plazo de revisión.",
    ejemplo: "Ej.: plan de calidad, procedimientos e instructivos, cronograma, programa SST, plan de manejo ambiental, planos as-built, protocolos de prueba."
  },
  noconformidades: {
    que: "El trabajo o producto no conforme y las acciones correctivas y preventivas hasta su cierre eficaz.",
    como: [
      "Registra la no conformidad con su origen y descripción.",
      "Exige la acción correctiva con su responsable y fecha de cierre.",
      "Ciérrala con evidencia y verifica después su eficacia."
    ],
    automatico: "Avisa las no conformidades abiertas con fecha de cierre vencida."
  }
};

// Textos de Generalidades (generalidades.html).
export const GENERALIDADES = {
  proposito: "Interventoría PRO es la herramienta de Cinco S.A.S. para llevar, en un solo lugar y mes a mes, el seguimiento técnico, administrativo, financiero, jurídico, de seguridad y salud en el trabajo, social, ambiental y de calidad de los contratos que la firma interviene o supervisa, junto con el plan de actuaciones de la propia interventoría, y para producir con esa misma información el informe mensual.",
  principios: [
    "Registrar una vez y usar muchas: lo que se registra en los módulos alimenta las alertas, los resúmenes, el Excel y el informe mensual.",
    "Planear lo propio: el Plan de actuaciones dice qué debe hacer la interventoría y cuándo; cada actuación enlaza al módulo donde queda su dato, para no registrar lo mismo dos veces.",
    "Controlar con evidencia: cada registro puede llevar fotos, documentos PDF y el enlace a su soporte, y cada requisito su fuente y la cláusula o numeral que lo exige.",
    "Anticipar: las alertas avisan lo vencido o por vencer antes de que se convierta en incumplimiento.",
    "Trazabilidad: cada creación, edición o eliminación queda en el Historial de cambios con la persona, la fecha y los valores antes y después; el historial no se puede modificar.",
    "Separar por contrato y por frente: cada contrato es independiente y, dentro de él, los registros pueden asociarse a un proyecto o frente (ej. una subestación, un tramo o un sector)."
  ],
  roles: [
    ["Administrador principal", "Tiene todos los permisos y es el único que define qué puede hacer cada rol (botón «Roles y permisos» en Equipo de interventoría)."],
    ["Administrador", "Por defecto puede todo: crear y eliminar contratos, asignar equipos, cambiar roles, registrar, eliminar registros, generar informes y enviar avisos."],
    ["Gestor", "Por defecto ve todos los contratos, los crea y edita, asigna su equipo, registra, elimina registros, genera informes y envía y recibe avisos; no elimina contratos ni cambia roles."],
    ["Equipo", "Por defecto ve solo los contratos donde está asignado, registra y edita información, consulta el historial, genera el informe y envía avisos; no elimina registros."]
  ],
  flujo: [
    ["Al iniciar el contrato", "Crea el contrato con sus frentes y asígnale el equipo. Carga o importa los requisitos del acta de inicio y el plan de actuaciones de la interventoría con sus fechas. Verifica cada requisito hasta el 100 % antes de firmar el acta (ver «Empezar un contrato paso a paso»)."],
    ["Durante cada mes", "Registra en cada módulo lo ocurrido: personal y seguridad social, avance de actividades, actas y pagos, entregables, inspecciones, fotos y observaciones. Marca como cumplidas las actuaciones del plan (las únicas e hitos con su fecha y cada vencimiento de las periódicas). Atiende las alertas de Inicio. Lo que ocurre en la obra se puede registrar desde el celular en Registro en campo."],
    ["Al cierre del mes", "En Informe mensual elige el mes, marca las secciones a incluir (también el plan de actuaciones), elige las fotos, revisa la vista previa y genera el PDF o el Word."],
    ["Al finalizar el contrato", "Verifica el recibo final, la vigencia de las garantías posteriores, el cierre de no conformidades, requerimientos y pendientes, y prepara el acta de cierre y balance (o liquidación) y la re-evaluación del proveedor."]
  ],
  // Paso a paso para dejar listo un contrato nuevo: [título, detalle, enlace].
  inicio: [
    ["Crear el contrato", "En Contratos usa «+ Nuevo contrato»: número, tipo (servicios u obra), objeto, partes, valor, anticipo, fechas y supervisor. En «Proyectos / frentes» escribe uno por línea (ej. cada subestación o tramo): sin frentes no se pueden asociar ni importar registros por frente.", "contratos.html"],
    ["Asignar el equipo", "En Equipo de interventoría marca quiénes trabajan en el contrato; solo ellos lo verán si su rol no permite ver todos los contratos.", "equipo.html"],
    ["Cargar los requisitos del acta de inicio", "En Requisitos acta de inicio usa «Ver y cargar lista base» (lista general) o «Importar Excel» con la lista propia del contrato, con la fuente y el soporte (cláusula o numeral) de cada requisito. Si la lista propia ya trae todo, no cargues también la base, para no duplicar.", "modulo.html?m=actainicio"],
    ["Cargar el plan de actuaciones", "En Plan de actuaciones de la interventoría usa «Ver y cargar lista base» o «Importar Excel». Ponle fechas a cada actuación; en las periódicas elige la frecuencia y, si aplica, el día límite del mes; en «Dónde se registra» elige el módulo que guarda su evidencia.", "modulo.html?m=actuaciones"],
    ["Registrar las garantías y el personal", "Registra las pólizas aprobadas y el personal del contratista con su seguridad social; el aplicativo avisará vencimientos y faltantes.", "modulo.html?m=garantias"],
    ["Firmar el acta de inicio", "Cuando los requisitos estén al 100 % («Aprobado» o «No aplica»), registra el acta en Cronología de actas y ajusta la fecha de inicio del contrato si cambió.", "modulo.html?m=cronologia"]
  ],
  convenciones: [
    "Semáforo de validación: verde = al día, amarillo = pendiente o por vencer, rojo = vencido, rechazado o con observaciones.",
    "«Para revisar» agrupa las alertas de cada módulo; en Inicio aparecen todas las del contrato.",
    "Contratos: muestra todos los contratos en una vista con su semáforo general — en riesgo (alertas rojas, plazo vencido o avance técnico más de 5 puntos atrás de lo programado), atención (solo alertas amarillas) o al día.",
    "Plan de actuaciones: «Única» se cumple una vez entre su inicio y su fin; «Hito» es una fecha clave; «Periódica» se repite y el aplicativo genera cada vencimiento, que se marca al cumplirlo; «Eventual» se hace cuando se presente. La curva S del plan cuenta solo las únicas e hitos cumplidos.",
    "Registro en campo: lo registrado desde el celular se guarda primero en el teléfono y se sube solo cuando hay señal; mientras tanto aparece en «Pendientes por subir». Conviene abrir la página con señal antes de salir a la obra.",
    "Las fechas se muestran en formato día/mes/año y los valores en pesos colombianos.",
    "Cada módulo se puede exportar a Excel con todos sus campos e importar desde Excel con su plantilla (vista previa antes de guardar). Al importar de nuevo se actualiza en vez de duplicar: en Personal por cédula, en Actividades y en el Plan de actuaciones por ítem, y en Requisitos del acta de inicio por el texto del requisito. Las celdas vacías no borran datos.",
    "Al importar, los frentes se reconocen aunque estén escritos de forma parecida (ej. «Seboruco» encuentra «SE Seboruco»)."
  ],
  // Rutina sugerida al grupo interventor: [texto, enlace (opcional)].
  rutina: [
    { periodo: "Cada día", icono: "☀️", desc: "Lo que ocurre en la obra se registra el mismo día.", items: [
      ["Revisar en Inicio las alertas rojas del contrato y atender primero las vencidas.", "inicio.html"],
      ["Revisar en el Plan de actuaciones lo que vence en los próximos 15 días y marcar lo que se cumplió.", "modulo.html?m=actuaciones"],
      ["Registrar desde la obra lo ocurrido: fotos con su observación, inspecciones, accidentes o incidentes, novedades de personal y charlas de seguridad.", "campo.html"],
      ["Verificar que quien ingresa a la obra esté en el Listado de personal, con seguridad social y examen de ingreso.", "modulo.html?m=personal"],
      ["Revisar los requerimientos con plazo de respuesta próximo a vencer.", "modulo.html?m=requerimientos"],
      ["Confirmar que en Registro en campo no queden registros «pendientes por subir».", "campo.html"]
    ] },
    { periodo: "Cada semana", icono: "📅", desc: "Seguimiento del avance y de lo que está por vencer.", items: [
      ["Marcar en el Plan de actuaciones los vencimientos semanales cumplidos (ej. comité de obra, visitas, inspecciones).", "modulo.html?m=actuaciones"],
      ["Actualizar el avance de las actividades y compararlo con lo programado en la curva S.", "modulo.html?m=actividades"],
      ["Revisar entregables del contratista, solicitudes de cambio y no conformidades pendientes de respuesta o de cierre.", "modulo.html?m=entregables"],
      ["Revisar pólizas, exámenes ocupacionales y otros documentos que vencen en los próximos 30 días.", "modulo.html?m=garantias"],
      ["Verificar el plan de consignaciones y las pruebas de equipos (FAT/SAT) de la semana siguiente, cuando apliquen.", "modulo.html?m=consignaciones"],
      ["Registrar las observaciones del comité o reunión de seguimiento (ej. comité semanal de obra).", "modulo.html?m=observaciones&cap=tecnico"],
      ["Si hay vencimientos sin atender, enviar los avisos por correo al gestor.", "avisos.html"],
      ["Gestor: revisar en Contratos el semáforo de todos los contratos.", "contratos.html"]
    ] },
    { periodo: "Cada mes", icono: "🗓️", desc: "Cierre del periodo e informe mensual.", items: [
      ["Verificar la planilla de seguridad social del mes anterior de todo el personal activo.", "modulo.html?m=segsocial"],
      ["Registrar el avance acumulado del mes de cada actividad y las actas de pago del periodo.", "modulo.html?m=financiero"],
      ["Marcar los vencimientos mensuales y trimestrales del Plan de actuaciones y revisar su curva S.", "modulo.html?m=actuaciones"],
      ["Revisar los indicadores de SST y ambientales del mes y actualizar la matriz de riesgos.", "modulo.html?m=riesgos"],
      ["Escribir las observaciones del mes en cada capítulo del informe.", "modulo.html?m=observaciones&cap=administrativo"],
      ["Seleccionar las fotos más representativas del periodo en el registro fotográfico.", "modulo.html?m=fotos"],
      ["Generar el informe mensual, revisarlo y radicarlo en el plazo del contrato.", "informe.html"],
      ["Revisar en el Historial de cambios lo modificado durante el mes.", "historial.html"]
    ] }
  ]
};
