// Literales del diseño detallado del RETIE 2024 (Resolución 40117 de 2024 del
// Ministerio de Minas y Energía, modificada por la Resolución 40284 de 2026; Libro 3,
// Título 3, numeral 3.3.1.1 "Diseño detallado"). La memoria de AHÍNCO se organiza por estos
// literales: cada uno queda cubierto por uno o más módulos de cálculo o por
// el desarrollo que escribe el diseñador. Parágrafo 1o del mismo artículo:
// en la memoria se debe mencionar expresamente qué literales no aplican y
// por qué (aquí: "No aplica" exige justificación).

export const FUENTE_LITERALES = "RETIE 2024 (Res. 40117 de 2024 del MinEnergía, modificada por la Res. 40284 de 2026), Libro 3, numeral 3.3.1.1 «Diseño detallado»";

// Tipos de diseño del RETIE 2024 (3.3.1.1 detallado; 3.3.1.2 básico, casos a y b) y los
// literales del 3.3.1.1 que corresponden a los ítems exigidos en cada diseño básico.
export const TIPOS_DISENO = [
  { valor: "Diseño detallado", exigidos: null },
  { valor: "Diseño básico (vivienda, pequeño comercio o pequeña industria)", exigidos: ["a", "i", "m", "n", "p", "r", "s", "u"], ref: "3.3.1.2 a: hasta 5 cuentas, ≤ 15 kVA y ≤ 240 V" },
  { valor: "Diseño básico (ramal aéreo rural ≤ 50 kVA y 13,2 kV)", exigidos: ["a", "d", "i", "l", "m", "s", "u"], ref: "3.3.1.2 b: según las especificaciones del operador de red" }
];
// «Diseño simplificado» (RETIE 2013) se lee como el diseño básico del caso a.
export const normalizarTipoDiseno = (t) => (/simplificado/i.test(t || "") ? TIPOS_DISENO[1].valor : t || "Diseño detallado");
export const tipoDisenoDe = (t) => TIPOS_DISENO.find((x) => x.valor === normalizarTipoDiseno(t));
export const exigido = (tipo, l) => { if (/^R\d/.test(l)) return true; const x = tipoDisenoDe(tipo); return !x?.exigidos || x.exigidos.includes(l); };

export const LITERALES = [
  { l: "a", texto: "Análisis de riesgos de origen eléctrico y medidas para mitigarlos.", modulos: ["riesgoElectrico"], guia: "Describa los factores de riesgo potenciales o presentes (contacto directo e indirecto, arco, sobretensiones, incendio) y las medidas adoptadas para minimizarlos (parágrafo 3)." },
  { l: "b", texto: "Análisis de riesgos por descargas eléctricas atmosféricas (rayos) y medidas de protección.", modulos: ["rayos", "apantallamiento"] },
  { l: "c", texto: "Análisis y cálculo de cargas iniciales y futuras, incluyendo factor de potencia y armónicos.", modulos: ["cargas", "fvProduccion", "armonicos"], guia: "Cargas por circuito y, si hay cargas no lineales, el análisis de armónicos (IEEE 519) y el factor K del transformador." },
  { l: "d", texto: "Coordinación de aislamiento eléctrico.", modulos: ["aislamiento", "fvArreglo"] },
  { l: "e", texto: "Análisis y cálculos de cortocircuito, arco eléctrico y falla a tierra.", modulos: ["cortocircuito", "arcoElectrico"], guia: "Cortocircuito trifásico y falla a tierra (IEC 60909) y energía incidente por arco eléctrico con su frontera y EPP (IEEE 1584-2018)." },
  { l: "f", texto: "Análisis del nivel tensión requerido.", modulos: ["nivelTension"], guia: "Justifique el nivel de tensión de conexión según la demanda (literal c) y la disponibilidad del operador de red." },
  { l: "g", texto: "Cálculos de campos electromagnéticos.", modulos: ["camposEM"], guia: "Perfil de campo eléctrico y magnético a 1 m del suelo frente a los límites del RETIE 2024 (Tabla 3.11.1.a); obligatorio (RETIE 2024 3.3.3.2) en líneas de transmisión y subestaciones de 57,5 kV o más, en edificaciones a menos de 15 m de partes de más de 100 kV o a menos de 3 m de una servidumbre, y en proyectos con circuitos, acometidas o ramales de 1000 A o más." },
  { l: "h", texto: "Cálculo de transformadores incluyendo efectos de los armónicos y factor de potencia en la carga.", modulos: ["transformador", "trafoPotencia"] },
  { l: "i", texto: "Sistema de puesta a tierra.", modulos: ["malla"] },
  { l: "j", texto: "Cálculo económico de conductores, teniendo en cuenta todos los factores de pérdidas, las cargas resultantes y los costos de la energía.", modulos: ["conductorEconomico"], guia: "Costo total en la vida útil (inversión más valor presente de las pérdidas) por calibre y rango económico de corriente, según IEC 60287-3-2." },
  { l: "k", texto: "Especificación de los conductores, teniendo en cuenta el tiempo de disparo de los interruptores, la corriente de cortocircuito de la red y la capacidad de corriente del conductor, de acuerdo con la norma IEC 60909 u otra equivalente.", modulos: ["conductores", "cableMT", "fvConductores", "cortocircuito"] },
  { l: "l", texto: "Cálculo mecánico de estructuras y de elementos de sujeción y soporte de redes de transmisión, de distribución, subestaciones y centrales de generación.", modulos: ["mecanico"] },
  { l: "m", texto: "Cálculo y coordinación de protecciones contra sobrecorrientes. En baja tensión se permite la coordinación con las características de limitación de corriente de los dispositivos según IEC 60947-2 Anexo A.", modulos: ["conductores", "coordinacion", "fvConductores"] },
  { l: "n", texto: "Cálculos de canalizaciones (tubos, ductos, canales y electroductos), bandejas portacables y volumen de encerramientos (cajas, conduletas, armarios, etc.)", modulos: ["canalizaciones"] },
  { l: "o", texto: "Cálculo de pérdidas de energía, teniendo en cuenta los efectos de armónicos y factor de potencia.", modulos: ["regulacion", "fvProduccion"] },
  { l: "p", texto: "Cálculos de regulación de tensión.", modulos: ["regulacion", "fvConductores", "fvConexion"] },
  { l: "q", texto: "Áreas clasificadas como peligrosas.", modulos: [], guia: "Indique si existen áreas clasificadas (NTC 2050 Sección 500) y su tratamiento." },
  { l: "r", texto: "Diagramas unifilares.", modulos: ["unifilar"], guia: "Relacione los planos de diagramas unifilares que acompañan la memoria." },
  { l: "s", texto: "Planos eléctricos para construcción.", modulos: [], guia: "Relacione los planos eléctricos de construcción (número y nombre)." },
  { l: "t", texto: "Especificaciones de construcción complementarias a los planos, incluyendo las de tipo técnico de equipos y materiales y sus condiciones particulares.", modulos: [] },
  { l: "u", texto: "Distancias de seguridad o servidumbre requeridas.", modulos: ["distancias"] },
  { l: "v", texto: "Justificación de desviaciones técnicas cuando sea estrictamente necesarias, siempre y cuando no comprometa la seguridad de las personas o de la instalación.", modulos: [] },
  { l: "w", texto: "Los demás estudios que el tipo de instalación requiera para su correcta y segura operación, tales como condiciones sísmicas, acústicas, mecánicas o térmicas.", modulos: ["iluminacion"], guia: "Incluye el diseño de iluminación verificado frente al RETILAP 2024 (Anexo General de la Res. 40150 de 2024, con las modificaciones de las Res. 40318 de 2025 y 40286 de 2026), que el RETIE exige para las instalaciones de uso final; agregue además los estudios sísmicos, acústicos o térmicos que apliquen." },
  { l: "x", texto: "Selección, cálculo y especificación de equipos de generación de energía convencionales y no convencionales.", modulos: ["fvArreglo", "fvProduccion", "fvConexion"], guia: "Para sistemas fotovoltaicos (AGPE o GD) use los cálculos del área «Generación solar fotovoltaica». Para plantas diésel o de otro tipo, desarrolle la selección como texto." }
];

// Revisión de solo iluminación (proyecto.alcance = "retilap"): en vez de los
// 24 literales del RETIE, el proyecto se organiza por capítulos del RETILAP
// (Libro 3 de la Res. 40286 de 2026). Los hallazgos los citan como «R7» o
// «R2, R10», igual que citan «e), h)» en una revisión RETIE.
export const FUENTE_RETILAP = "RETILAP 2024 (Anexo General de la Res. 40150 de 2024, modificado por las Res. 40318 de 2025 y 40286 de 2026), Libro 3";
export const CAPITULOS_RETILAP = [
  { l: "R1", texto: "Análisis del proyecto y contenido documental del diseño.", ref: "3.1.4.1 a 3.1.4.3", modulos: [], guia: "Análisis del proyecto, memoria con resultados de software, plano con mallas, valores, alturas y cuadro de cantidades, declaración de cumplimiento y coherencia del expediente." },
  { l: "R2", texto: "Fuentes, luminarias y fichas técnicas.", ref: "3.1.3.1 y 3.1.3.2", modulos: [], guia: "Fichas y fotometrías del fabricante, flujo nominal usado en el cálculo, tensión, IP, IK, vida útil y certificados." },
  { l: "R3", texto: "Reflectancias y modelo de cálculo.", ref: "3.2.1.1 a 3.2.1.3", modulos: [], guia: "Reflectancias documentadas de techo, paredes y piso; alturas del plano de trabajo y mallas." },
  { l: "R4", texto: "Niveles de iluminación y uniformidad por recinto.", ref: "3.2.2 y Tabla 3.2.2.6.a", modulos: ["iluminacion"], guia: "Em y Uo de cada recinto frente a la Tabla 3.2.2.6.a, con su referencia." },
  { l: "R5", texto: "Deslumbramiento (UGR) y luminancias.", ref: "3.2.1.4 y 3.2.1.8", modulos: [], guia: "UGR en cada puesto o posición crítica y límites de luminancia para pantallas." },
  { l: "R6", texto: "Eficiencia energética (VEEI).", ref: "Art. 3.2.5 y Tabla 3.2.5.a", modulos: [], guia: "VEEI de cada recinto con toda la potencia instalada frente a la Tabla 3.2.5.a." },
  { l: "R7", texto: "Iluminación de emergencia.", ref: "Art. 3.2.4 y Tabla 3.2.4.5.a", modulos: [], guia: "Rutas, zonas de énfasis, antipánico, baños, tableros, autonomía, mallas y alimentación de los equipos." },
  { l: "R8", texto: "Factor y programa de mantenimiento.", ref: "3.2.1.10 (ISO/CIE TS 22012)", modulos: [], guia: "Factor de mantenimiento por equipo y entorno, y programa de mantenimiento." },
  { l: "R9", texto: "Control del alumbrado.", ref: "Art. 3.2.6 y 3.2.2.7", modulos: [], guia: "Sensores, temporización, grupos y zonas de control." },
  { l: "R10", texto: "Coordinación con el diseño eléctrico.", ref: "3.1.4.3 num. 3; NTC 2050", modulos: [], guia: "Potencia de iluminación frente al cuadro de cargas, circuitos, protecciones y tensión de los equipos." }
];
export const esRetilap = (p) => p?.alcance === "retilap";
export const ALCANCES = [
  { valor: "retie", texto: "Diseño eléctrico completo (literales a) a x) del RETIE)" },
  { valor: "retilap", texto: "Solo iluminación (capítulos del RETILAP)" }
];
// Esquema con el que se organiza el proyecto: literales del RETIE o capítulos del RETILAP.
export function esquemaDe(p) {
  return esRetilap(p)
    ? { items: CAPITULOS_RETILAP, fuente: FUENTE_RETILAP, nombre: "Capítulos RETILAP", singular: "capítulo", plural: "capítulos", cod: (l) => l.l, col: "Cap.", titulo: "Revisión por capítulos del RETILAP", tituloTabla: "Alcance de la revisión por capítulo del RETILAP", ayudaCita: "Ej. R7, R10" }
    : { items: LITERALES, fuente: FUENTE_LITERALES, nombre: "Literales a) a x)", singular: "literal", plural: "literales", cod: (l) => `${l.l})`, col: "Lit.", titulo: "Desarrollo según los literales a) a x) del RETIE 2024 (numeral 3.3.1.1)", tituloTabla: "Alcance de la memoria por literal del RETIE", ayudaCita: "Ej. c), h)" };
}

// Textos libres del informe (proyecto.textos[clave]): secciones que no salen
// de los cálculos ni de los literales. Las vacías no aparecen en el documento.
// lugar: dónde van en el documento (inicio, normas, hallazgos, cierre).
export const TEXTOS_INFORME = {
  verificacion: [
    { clave: "objeto", titulo: "Objeto y alcance de la revisión", lugar: "inicio", guia: "Qué se revisó, para quién y con qué propósito; qué queda por fuera del alcance." },
    { clave: "metodologia", titulo: "Metodología", lugar: "normas", guia: "Cómo se revisó: lectura de memoria y planos, recálculo de cifras, cruce memoria-planos, visita, etc." },
    { clave: "marco", titulo: "Marco normativo adicional", lugar: "normas", guia: "Normas propias de este proyecto que no están en la tabla general (RETILAP, normas del operador de red, NTC específicas)." },
    { clave: "conformes", titulo: "Aspectos conformes", lugar: "hallazgos", guia: "Lo que el diseño resuelve bien: así el diseñador sabe qué no tocar." },
    { clave: "concepto", titulo: "Concepto de la revisión", lugar: "cierre", guia: "Conclusión de la interventoría: aprobado, aprobado con observaciones o no aprobado, y qué se requiere para cerrar." },
    { clave: "limitaciones", titulo: "Limitaciones", lugar: "cierre", guia: "Supuestos de la revisión, documentos que no se recibieron, información verbal, etc." }
  ],
  diseno: [
    { clave: "objeto", titulo: "Objeto y alcance", lugar: "inicio", guia: "Qué cubre el diseño y qué queda por fuera." },
    { clave: "metodologia", titulo: "Criterios de diseño", lugar: "normas", guia: "Criterios generales adoptados (cargabilidad, regulación, reservas, etc.)." },
    { clave: "marco", titulo: "Marco normativo adicional", lugar: "normas", guia: "Normas propias de este proyecto que no están en la tabla general." },
    { clave: "concepto", titulo: "Conclusiones del diseñador", lugar: "cierre", guia: "Conclusiones generales del diseño." },
    { clave: "limitaciones", titulo: "Limitaciones y supuestos", lugar: "cierre", guia: "Información pendiente, supuestos y condiciones para la construcción." }
  ]
};
export const textosDe = (verif) => TEXTOS_INFORME[verif ? "verificacion" : "diseno"];

// Letras de literal citadas en un texto como «e), h), m)».
// También reconoce los capítulos del RETILAP: «R7, R10».
export const letrasLiteral = (t) => [...new Set([...String(t || "").matchAll(/\b([a-x])\)|\b(R\d{1,2})\b/g)].map((m) => m[1] || m[2]))];

// Estado de un literal con los cálculos (resultados por clave, con r.modulo),
// lo que escribió el diseñador y los hallazgos que lo citan: un literal con
// hallazgos no sale «Desarrollado» aunque tenga texto.
export function estadoLiteral(lit, dato, resultados, tipoDiseno, hall = []) {
  const aplica = dato?.aplica !== "No";
  const texto = (dato?.texto || "").trim();
  const mods = Object.values(resultados).filter((r) => lit.modulos.includes(r.modulo) && !r.sinDatos); // un cálculo sin datos no desarrolla el literal
  if (!exigido(tipoDiseno, lit.l) && !texto && !mods.length) return { texto: "No exigido en el diseño básico", clase: "muted" };
  if (!aplica) return texto ? { texto: "No aplica (justificado)", clase: "muted" } : { texto: "No aplica sin justificación", clase: "danger" };
  if (lit.modulos.length && !mods.length && !texto) return { texto: "Pendiente", clase: "warn" };
  if (!lit.modulos.length && !texto) return { texto: "Pendiente", clase: "warn" };
  // Color según el hallazgo más grave: rojo si alguno es de severidad alta (o no
  // la tiene, como los que detectan los cálculos); ámbar si solo hay medias o bajas.
  const citan = hall.filter((h) => letrasLiteral(h.literales).includes(lit.l));
  if (citan.length) {
    const codigos = citan.map((h) => h.codigo).join(", ");
    return citan.some((h) => !["Media", "Baja"].includes(h.severidad))
      ? { texto: `Con hallazgo alto (${codigos})`, clase: "danger", hallazgos: citan.map((h) => h.codigo) }
      : { texto: `Con observaciones (${codigos})`, clase: "obs", hallazgos: citan.map((h) => h.codigo) };
  }
  const fallan = mods.some((r) => (r.verificaciones || []).some((v) => v.cumple === false));
  return fallan ? { texto: "Con incumplimientos", clase: "danger" } : { texto: "Desarrollado", clase: "ok" };
}
