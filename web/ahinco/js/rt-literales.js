// Literales del diseño detallado del RETIE (Resolución 40117 de 2024 del
// Ministerio de Minas y Energía, Libro 3, Título 3, numeral 3.3.1.1
// "Diseño detallado"). La memoria de AHÍNCO se organiza por estos
// literales: cada uno queda cubierto por uno o más módulos de cálculo o por
// el desarrollo que escribe el diseñador. Parágrafo 1o del mismo artículo:
// en la memoria se debe mencionar expresamente qué literales no aplican y
// por qué (aquí: "No aplica" exige justificación).

export const FUENTE_LITERALES = "RETIE (Res. 40117 de 2024 del MinEnergía), numeral 3.3.1.1 «Diseño detallado»";

export const LITERALES = [
  { l: "a", texto: "Análisis de riesgos de origen eléctrico y medidas para mitigarlos.", modulos: [], guia: "Describa los factores de riesgo potenciales o presentes (contacto directo e indirecto, arco, sobretensiones, incendio) y las medidas adoptadas para minimizarlos (parágrafo 3)." },
  { l: "b", texto: "Análisis de riesgos por descargas eléctricas atmosféricas (rayos) y medidas de protección.", modulos: ["rayos", "apantallamiento"] },
  { l: "c", texto: "Análisis y cálculo de cargas iniciales y futuras, incluyendo factor de potencia y armónicos.", modulos: ["cargas", "fvProduccion", "armonicos"], guia: "Cargas por circuito y, si hay cargas no lineales, el análisis de armónicos (IEEE 519) y el factor K del transformador." },
  { l: "d", texto: "Coordinación de aislamiento eléctrico.", modulos: ["aislamiento", "fvArreglo"] },
  { l: "e", texto: "Análisis y cálculos de cortocircuito, arco eléctrico y falla a tierra.", modulos: ["cortocircuito", "arcoElectrico"], guia: "Cortocircuito trifásico y falla a tierra (IEC 60909) y energía incidente por arco eléctrico con su frontera y EPP (IEEE 1584-2018)." },
  { l: "f", texto: "Análisis del nivel tensión requerido.", modulos: [], guia: "Justifique el nivel de tensión de conexión según la demanda (literal c) y la disponibilidad del operador de red." },
  { l: "g", texto: "Cálculos de campos electromagnéticos.", modulos: ["camposEM"], guia: "Perfil de campo eléctrico y magnético a 1 m del suelo frente a los límites del RETIE 2024 (Tabla 3.11.1.a); obligatorio en subestaciones de 57,5 kV o más y en edificaciones a menos de 15 m de partes de más de 100 kV." },
  { l: "h", texto: "Cálculo de transformadores incluyendo efectos de los armónicos y factor de potencia en la carga.", modulos: ["transformador", "trafoPotencia"] },
  { l: "i", texto: "Sistema de puesta a tierra.", modulos: ["malla"] },
  { l: "j", texto: "Cálculo económico de conductores, teniendo en cuenta todos los factores de pérdidas, las cargas resultantes y los costos de la energía.", modulos: ["conductorEconomico"], guia: "Costo total en la vida útil (inversión más valor presente de las pérdidas) por calibre y rango económico de corriente, según IEC 60287-3-2." },
  { l: "k", texto: "Especificación de los conductores, teniendo en cuenta el tiempo de disparo de los interruptores, la corriente de cortocircuito de la red y la capacidad de corriente del conductor, de acuerdo con la norma IEC 60909 u otra equivalente.", modulos: ["conductores", "cableMT", "fvConductores", "cortocircuito"] },
  { l: "l", texto: "Cálculo mecánico de estructuras y de elementos de sujeción y soporte de redes de transmisión, de distribución, subestaciones y plantas de generación.", modulos: ["mecanico"] },
  { l: "m", texto: "Cálculo y coordinación de protecciones contra sobrecorrientes. En baja tensión se permite la coordinación con las características de limitación de corriente de los dispositivos según IEC 60947-2 Anexo A.", modulos: ["conductores", "coordinacion", "fvConductores"] },
  { l: "n", texto: "Cálculos de canalizaciones (tubos, ductos, canales y electroductos), bandejas portacables y volumen de encerramientos (cajas, conduletas, armarios, etc.)", modulos: ["canalizaciones"] },
  { l: "o", texto: "Cálculo de pérdidas de energía, teniendo en cuenta los efectos de armónicos y factor de potencia.", modulos: ["regulacion", "fvProduccion"] },
  { l: "p", texto: "Cálculos de regulación de tensión.", modulos: ["regulacion", "fvConductores", "fvConexion"] },
  { l: "q", texto: "Áreas clasificadas como peligrosas.", modulos: [], guia: "Indique si existen áreas clasificadas (NTC 2050 Sección 500) y su tratamiento." },
  { l: "r", texto: "Diagramas unifilares.", modulos: [], guia: "Relacione los planos de diagramas unifilares que acompañan la memoria." },
  { l: "s", texto: "Planos eléctricos para construcción.", modulos: [], guia: "Relacione los planos eléctricos de construcción (número y nombre)." },
  { l: "t", texto: "Especificaciones de construcción complementarias a los planos, incluyendo las de tipo técnico de equipos y materiales y sus condiciones particulares.", modulos: [] },
  { l: "u", texto: "Distancias de seguridad o servidumbre requeridas.", modulos: ["distancias"] },
  { l: "v", texto: "Justificación de desviaciones técnicas cuando sea estrictamente necesarias, siempre y cuando no comprometa la seguridad de las personas o de la instalación.", modulos: [] },
  { l: "w", texto: "Los demás estudios que el tipo de instalación requiera para su correcta y segura operación, tales como condiciones sísmicas, acústicas, mecánicas o térmicas.", modulos: [] },
  { l: "x", texto: "Selección, cálculo y especificación de equipos de generación de energía convencionales y no convencionales.", modulos: ["fvArreglo", "fvProduccion", "fvConexion"], guia: "Para sistemas fotovoltaicos (AGPE o GD) use los cálculos del área «Generación solar fotovoltaica». Para plantas diésel o de otro tipo, desarrolle la selección como texto." }
];

// Estado de un literal con los cálculos (resultados por clave, con r.modulo)
// y lo que escribió el diseñador.
export function estadoLiteral(lit, dato, resultados) {
  const aplica = dato?.aplica !== "No";
  const texto = (dato?.texto || "").trim();
  if (!aplica) return texto ? { texto: "No aplica (justificado)", clase: "muted" } : { texto: "No aplica sin justificación", clase: "danger" };
  const mods = Object.values(resultados).filter((r) => lit.modulos.includes(r.modulo));
  if (lit.modulos.length && !mods.length && !texto) return { texto: "Pendiente", clase: "warn" };
  if (!lit.modulos.length && !texto) return { texto: "Pendiente", clase: "warn" };
  const fallan = mods.some((r) => (r.verificaciones || []).some((v) => v.cumple === false));
  return fallan ? { texto: "Con incumplimientos", clase: "danger" } : { texto: "Desarrollado", clase: "ok" };
}
