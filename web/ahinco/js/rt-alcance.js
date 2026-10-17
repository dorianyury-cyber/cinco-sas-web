// Alcance, validación y limitaciones de AHÍNCO. Un solo lugar para que el
// ingeniero sepa hasta dónde llega cada cálculo (se muestra en pantalla, en la
// memoria PDF/Word y en el Excel) y para que el desarrollador sepa qué falta.
// El plan de mejoras detallado, con dónde tocar el código, está en
// docs/AHINCO-mejoras.md (raíz del repositorio; no se publica en el sitio).
// Al mejorar un cálculo: actualice aquí su "metodo" y quite la limitación.

export const ALCANCE = {
  cargas: {
    metodo: "Suma de cargas por circuito con factor de demanda, reparto por fase y corriente del alimentador con el 25 % del motor más grande (NTC 2050 Sección 220 y 430-24).",
    limitaciones: ["No calcula armónicos ni el factor K de cargas no lineales: si hay variadores, UPS o iluminación LED en gran cantidad, el literal c) debe complementarse.", "Los factores de demanda los define el diseñador; no se aplican automáticamente las tablas de la Sección 220."]
  },
  conductores: {
    metodo: "Capacidad de corriente de la NTC 2050 Tabla 310-16 con corrección por temperatura y agrupamiento, temperatura de terminales (110-14(c)), cargas continuas al 125 % y protección normalizada (240-6).",
    limitaciones: ["Solo conductores de baja tensión (hasta 2000 V) en canalización o cable; no cubre instalación al aire libre ni bandejas (Tabla 310-17 / 392).", "No verifica la soportabilidad térmica del conductor al cortocircuito (I²t); para cables de media tensión use el cálculo «Cables de media tensión».", "La coordinación con las curvas de limitación de los interruptores (IEC 60947-2 Anexo A) no se calcula."]
  },
  regulacion: {
    metodo: "Caída de tensión por tramo con R y X de la NTC 2050 Cap. 9 Tabla 9 (o de conductores aéreos), acumulada aguas abajo, y pérdidas I²R.",
    limitaciones: ["Supone la carga concentrada al final de cada tramo y factor de potencia único para todo el circuito.", "No calcula pérdidas de energía anuales (factor de pérdidas) ni el valor presente para el cálculo económico del literal j)."]
  },
  canalizaciones: {
    metodo: "Llenado de tuberías con las áreas de conductores THHN/THWN-2 y las áreas internas de la NTC 2050 Cap. 9 Tablas 1, 4 y 5.",
    limitaciones: ["Solo conductores THHN/THWN-2; otros aislamientos (XLPE, cables multiconductores de MT) deben digitarse como área equivalente.", "No calcula bandejas portacables, cajas, conduletas ni volumen de encerramientos (también parte del literal n)."]
  },
  transformador: {
    metodo: "Potencia normalizada (NTC 818 / 819) a partir de la demanda y el crecimiento, corrientes nominales, cortocircuito en bornes con barra infinita y protecciones primaria (fusible K) y secundaria (450-3).",
    limitaciones: ["Para transformadores de distribución; para subestaciones de potencia use «Transformador de potencia».", "No considera la reducción de capacidad por armónicos (factor K, IEEE C57.110).", "El fusible primario es una referencia: el definitivo lo fija la norma del operador de red."]
  },
  trafoPotencia: {
    metodo: "Corrientes por etapa ONAN/ONAF y en la toma extrema, cortocircuito pasante con la impedancia de la red (IEC 60076-5) y verificación de TC (IEC 61869-2) y de los equipos en serie (IEC 62271-1).",
    limitaciones: ["No calcula la cargabilidad térmica con perfil de carga ni el envejecimiento del aislamiento (IEC 60076-7).", "Los TC se verifican por corriente térmica y factor límite de precisión; no se calcula la saturación con componente DC ni la tensión de punto de codo para la protección diferencial.", "El terciario se considera sin carga."]
  },
  cortocircuito: {
    metodo: "IEC 60909-0: red equivalente, transformador con corrección KT, cables en serie; corriente trifásica, monofásica a tierra y pico por barra.",
    limitaciones: ["Radial con una sola fuente: no incluye el aporte de motores, generadores ni generación distribuida, ni redes malladas.", "La secuencia cero se aproxima: transformador Dyn o YNyn(d) con Z0 ≈ Z1, cables con Z0 ≈ 4 Z1; con zig-zag se usa su reactancia. Para un estudio definitivo de falla a tierra use los datos de secuencia cero del fabricante y software especializado (ETAP, DIgSILENT).", "No calcula la corriente de cortocircuito de corte (Ib) ni la permanente (Ik) para tiempos largos."]
  },
  cableMT: {
    metodo: "Capacidad de corriente digitada del fabricante o de la NTC 2050 Tablas 310-77 a 310-86 con un factor de corrección, cortocircuito adiabático (IEC 60949) y caída de tensión.",
    limitaciones: ["La capacidad de corriente base la digita el usuario: no hay tablas de cables de media tensión precargadas ni cálculo IEC 60287 (resistividad térmica del suelo, profundidad, banco de ductos).", "No verifica la pantalla metálica para la corriente de falla a tierra ni las tensiones inducidas en la pantalla.", "La resistencia se calcula a 90 °C a partir de la resistividad si no se digita; la reactancia por defecto es un valor típico."]
  },
  coordinacion: {
    metodo: "Curvas de tiempo inverso IEC 60255-151 (SI, VI, EI, LTI) y tiempo definido, con elemento instantáneo; margen de coordinación entre protecciones sucesivas y verificación de la corriente de energización.",
    limitaciones: ["Todas las protecciones deben referirse a la misma tensión (el usuario convierte las corrientes de AT a MT).", "No incluye curvas ANSI/IEEE, fusibles, reconectadores ni interruptores de baja tensión con sus bandas de tolerancia.", "No coordina protección de falla a tierra (51N), diferencial (87) ni de distancia (21); solo sobrecorriente de fase."]
  },
  malla: {
    metodo: "IEEE 80-2013: tensiones tolerables (50 o 70 kg) con capa superficial, corriente de malla con factor de decremento, resistencia de Sverak, tensiones de malla y de paso con Km, Ks y Ki, y sección mínima del conductor.",
    limitaciones: ["Suelo uniforme: no modela suelo de dos capas, que es lo habitual cuando hay medición de resistividad (IEEE 80 §13, IEEE 81).", "Malla rectangular con espaciamiento uniforme; formas en L o irregulares se aproximan por el rectángulo equivalente.", "El factor de división de corriente Sf lo digita el usuario; no se calcula a partir de los cables de guarda y las impedancias de las líneas.", "No calcula las tensiones transferidas ni el potencial fuera del cerramiento."]
  },
  rayos: {
    metodo: "IEC 62305-2 / NTC 4552-2: componentes RA, RB, RU y RV del riesgo de pérdida de vidas humanas R1, con búsqueda de la combinación mínima de SIPRA y DPS.",
    limitaciones: ["Solo R1. No calcula R2 (servicio público), R3 (patrimonio) ni R4 (pérdidas económicas), ni las componentes RC, RM, RW y RZ, necesarias en hospitales, estructuras con riesgo de explosión o redes de servicio público.", "Una sola zona y una sola línea de servicio por estructura."]
  },
  apantallamiento: {
    metodo: "Esfera rodante por nivel de protección (NTC 4552-3) o modelo electrogeométrico IEEE 998 con la corriente crítica a partir del BIL; radio protegido por elemento.",
    limitaciones: ["Evalúa cada elemento frente a un solo captador y en el plano vertical: la protección combinada entre dos o más mástiles o cables de guarda (mayor en la realidad) no se calcula, por lo que el resultado queda del lado de la seguridad.", "No dibuja la zona protegida en planta ni verifica el área completa de la subestación."]
  },
  aislamiento: {
    metodo: "IEC 60071 / IEC 60099-5: sobretensión temporal, selección de Uc y Ur del DPS, corrección por altitud y margen de protección con el efecto de la separación entre el DPS y el equipo.",
    limitaciones: ["Método simplificado: no reemplaza un estudio de transitorios electromagnéticos (EMTP/ATP) para sobretensiones de maniobra o subestaciones con cables largos.", "La tensión residual y la capacidad TOV del DPS deben tomarse del catálogo del fabricante."]
  },
  distancias: {
    metodo: "Distancias mínimas de seguridad del RETIE en zonas con construcciones y vías, con corrección por altitud sobre 1000 m.",
    limitaciones: ["Solo están cargados algunos tipos de distancia y, para 66, 115 y 230 kV, solo la distancia vertical a vías: en los demás casos el usuario digita la distancia exigida.", "Debe confirmarse contra la tabla del RETIE vigente antes de firmar.", "No calcula franjas de servidumbre ni distancias dentro de subestaciones (use la distancia en aire del cálculo de aislamiento)."]
  },
  mecanico: {
    metodo: "Ecuación de cambio de estado (método parabólico) resuelta por Newton-Raphson para cada hipótesis de temperatura y viento; flecha, tensión máxima y distancia al suelo.",
    limitaciones: ["Vano a nivel y método parabólico (adecuado para vanos cortos y medianos); no calcula vanos desnivelados, vano regulador de una sección ni la catenaria exacta.", "No calcula estructuras, cimentaciones ni retenidas (también parte del literal l)."]
  }
};

// Para la página «Alcance y validación».
export const VALIDACION = [
  "Cada cálculo de la pantalla se reproduce con fórmulas en el Excel formulado; ambos se compararon y dan los mismos resultados.",
  "El cálculo de malla se comprobó con el ejemplo 1 del Anexo B de la IEEE 80-2013 (Rg, Cs, tensión de contacto y tensión de malla coinciden).",
  "Las tablas normativas cargadas (NTC 2050, IEC, IEEE) se transcribieron de las normas citadas en cada hoja.",
  "Pendiente: validación independiente de cortocircuito y coordinación contra un estudio hecho con software comercial (ETAP o DIgSILENT), y revisión de una memoria completa por un organismo de inspección acreditado."
];

export const LIMITACIONES_GENERALES = [
  "AHÍNCO es una herramienta de cálculo y de verificación. La responsabilidad del diseño es del ingeniero que firma la memoria, que debe revisar los datos de entrada y los resultados.",
  "Los métodos son los de cálculo manual de las normas citadas, adecuados para memorias de distribución y para verificación de interventoría. Para subestaciones de alta tensión, el estudio definitivo de cortocircuito, coordinación y transitorios debe hacerse con software especializado.",
  "No incluye todavía: energía incidente por arco eléctrico (IEEE 1584), campos electromagnéticos, flujo de carga y armónicos, ni cálculo económico de conductores; esos literales se desarrollan como texto.",
  "Los datos marcados «(S)» son supuestos: quedan listados en la sección de hallazgos o pendientes y deben confirmarse antes de firmar.",
  "No guarda historial de versiones de un proyecto: use «Exportar proyecto» para conservar una copia de cada revisión."
];

export const MEJORAS = [
  ["Alta", "Validar cortocircuito y coordinación contra un estudio en ETAP o DIgSILENT, y una memoria completa con un organismo de inspección."],
  ["Alta", "Energía incidente por arco eléctrico (IEEE 1584-2018) en celdas y tableros."],
  ["Alta", "Malla de puesta a tierra con suelo de dos capas a partir de la medición de resistividad."],
  ["Media", "Tablas de capacidad de corriente de cables de media tensión (NTC 2050 310-77 a 310-86) y cálculo IEC 60287 para bancos de ductos."],
  ["Media", "Historial de versiones del proyecto y comparación entre revisiones de la memoria."],
  ["Media", "Cortocircuito con aporte de motores y generación distribuida, e impedancias de secuencia cero del fabricante."],
  ["Media", "Coordinación con curvas ANSI, fusibles y protección de falla a tierra; protección combinada de varios captadores en el apantallamiento."],
  ["Baja", "Riesgo por rayos R2 a R4, armónicos y factor K, cálculo económico de conductores y campos electromagnéticos."]
];
