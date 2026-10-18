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
    metodo: "IEC 60909-0: red equivalente, transformador con corrección KT, cables en serie; corriente trifásica, monofásica a tierra y pico por barra. Incluye el aporte de grupos de motores (impedancia en paralelo en su barra, que también aporta a las barras de aguas arriba) y de generación con inversores (fuente de corriente k × In), y la secuencia cero del fabricante (transformador y cables) cuando se digita.",
    limitaciones: ["Red radial alimentada por un solo transformador: no resuelve redes malladas ni varias fuentes de red en paralelo.", "El aporte de los inversores se suma en forma aritmética a todas las barras (conservador); los generadores sincrónicos se deben modelar como motores de MT o con software especializado.", "Sin datos del fabricante, la secuencia cero se aproxima (transformador ≈ Z1, cables ≈ 4 Z1, zig-zag con su reactancia); no calcula la corriente de corte (Ib) ni la permanente (Ik)."]
  },
  cableMT: {
    metodo: "Capacidad de corriente de las Tablas 310.60(C)(77) a (86) de la NTC 2050 (cables de 2001 a 35 000 V en banco de ductos o directamente enterrados, cobre o aluminio, 90 o 105 °C) con corrección por temperatura del suelo (310.60(C)(4)) y por profundidad (6 % por cada 300 mm), o la del fabricante; cortocircuito adiabático (IEC 60949) y caída de tensión.",
    limitaciones: ["Las tablas son para resistividad térmica del suelo de 90 °C·cm/W, factor de carga 100 % y las disposiciones de la Figura 310.60 (hasta 6 circuitos en ductos y 2 directamente enterrados): con otro suelo, otra disposición o más circuitos aplique un factor adicional o un cálculo IEC 60287 / Neher-McGrath, que AHÍNCO todavía no hace. Los calibres de 300, 400 y 600 kcmil se interpolan por sección y quedan marcados (S).", "No verifica la pantalla metálica para la corriente de falla a tierra ni las tensiones inducidas en la pantalla.", "La resistencia se calcula a 90 °C a partir de la resistividad si no se digita; la reactancia por defecto es un valor típico."]
  },
  coordinacion: {
    metodo: "Curvas de tiempo inverso IEC 60255-151 (SI, VI, EI, LTI), IEEE C37.112 (MI, VI, EI) y tiempo definido, con elemento instantáneo; fusibles e interruptores con su curva por puntos del fabricante (interpolación log-log); protecciones de fase y de tierra (51N); margen de coordinación entre protecciones sucesivas del mismo tipo desde la protección más cercana a cada falla, y verificación de la corriente de energización.",
    limitaciones: ["Todas las protecciones deben referirse a la misma tensión (el usuario convierte las corrientes de AT a MT).", "La curva por puntos es una sola (despeje total): no se representan la banda de tolerancia ni la curva de fusión mínima del fusible, ni las bandas de los interruptores de baja tensión.", "No coordina protecciones diferenciales (87) ni de distancia (21), ni reconectadores con secuencias de recierre."]
  },
  malla: {
    metodo: "IEEE 80-2013: tensiones tolerables (50 o 70 kg) con capa superficial, corriente de malla con factor de decremento, resistencia de Sverak, tensiones de malla y de paso con Km, Ks y Ki, y sección mínima del conductor. Opcionalmente, modelo de suelo de dos capas ajustado a las mediciones Wenner (IEEE 81) con la resistividad uniforme equivalente ρa(av2) del Anexo E, factor de división Sf calculado con los cables de guarda y neutros (Endrenyi) y revisión de tensiones transferidas (GPR frente al contacto tolerable).",
    limitaciones: ["Con suelo de dos capas, las ecuaciones de la IEEE 80 se aplican con una resistividad uniforme equivalente (Anexo E), no con un cálculo de dos capas: frente a un programa de dos capas, la resistencia sale mayor (conservadora) pero la tensión de contacto puede salir menor cuando la capa superior es más resistiva (K < 0). Por eso se muestran como referencia Em y Es con ρ1 y Rg con ρ2; si el contraste de resistividades es grande, confirme con software de dos capas o multicapa.", "Malla rectangular con espaciamiento uniforme; formas en L o irregulares se aproximan por el rectángulo equivalente.", "El Sf calculado ignora los acoples mutuos entre conductores y supone líneas largas de vanos iguales (método de Endrenyi); el Sf de una subestación con aporte local de corriente de falla debe tomarse de un estudio detallado.", "Las tensiones transferidas se revisan comparando el GPR con la tensión de contacto tolerable; no se calcula el potencial en la superficie fuera del cerramiento ni en cercas separadas."]
  },
  rayos: {
    metodo: "IEC 62305-2 / NTC 4552-2: componentes RA, RB, RU y RV del riesgo de pérdida de vidas humanas R1, con búsqueda de la combinación mínima de SIPRA y DPS.",
    limitaciones: ["Solo R1. No calcula R2 (servicio público), R3 (patrimonio) ni R4 (pérdidas económicas), ni las componentes RC, RM, RW y RZ, necesarias en hospitales, estructuras con riesgo de explosión o redes de servicio público.", "Una sola zona y una sola línea de servicio por estructura."]
  },
  arcoElectrico: {
    metodo: "Modelo empírico de la IEEE 1584-2018 para sistemas trifásicos de 0,208 a 15 kV: corriente de arco por interpolación entre 600, 2700 y 14 300 V (ecuación 25 en BT), corriente reducida por el factor de variación, factor de tamaño del encerramiento y energía incidente con el mayor valor entre corriente plena y reducida; frontera de arco a 1,2 cal/cm² y categoría de EPP según NFPA 70E.",
    limitaciones: ["Fuera de 0,208 a 15 kV (por ejemplo 34,5 kV o más) el modelo no aplica: el punto se marca «Fuera del modelo» y debe usarse otro método (NFPA 70E Anexo D, método de Lee o software especializado).", "Los tiempos de despeje se toman de la protección de la coordinación indicada en cada punto (curvas IEC y tiempo instantáneo, más la apertura del interruptor, con máximo de 2 s), o se digitan: no se modelan fusibles, curvas ANSI ni la protección de baja tensión propia del tablero si no está en la coordinación.", "Solo sistemas trifásicos de corriente alterna: no cubre arco en corriente continua (bancos de baterías, arreglos fotovoltaicos) ni sistemas monofásicos.", "Las dimensiones de encerramiento, la separación entre electrodos y la distancia de trabajo vacías toman los valores típicos de la Tabla 8 de la norma: confírmelas con el fabricante del equipo."]
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
  fvArreglo: {
    metodo: "Tensiones del string a la temperatura mínima (Voc) y a la temperatura máxima de celda (Vmp, método NOCT), rango de módulos en serie, corriente por MPPT con el 125 % de la NTC 2050 690-8, relación DC/AC, DPS de corriente continua y necesidad de fusibles de string (IEC 62548).",
    limitaciones: ["Supone strings iguales (mismo número de módulos, orientación e inclinación) en todas las entradas MPPT usadas; arreglos con varias orientaciones deben calcularse como cálculos separados.", "No calcula el recorte (clipping) de potencia del inversor ni el comportamiento con sombras parciales.", "No incluye módulos bifaciales (ganancia por la cara posterior) ni microinversores u optimizadores."]
  },
  fvProduccion: {
    metodo: "Energía anual = potencia pico × horas sol pico × 365 × PR, con el PR como producto de las pérdidas (temperatura de celda por el método NOCT, suciedad, sombras, dispersión, cableado, inversor e indisponibilidad), degradación anual y balance con el consumo según la CREG 174 de 2021.",
    limitaciones: ["Cálculo anual con un solo valor de horas sol pico: no hace simulación horaria ni mensual (PVsyst, SAM o PVGIS la hacen) ni considera la transposición al plano inclinado; las HSP deben estar ya en el plano del arreglo.", "La simultaneidad entre generación y consumo es un dato supuesto; para un balance preciso se requiere la curva de carga horaria del usuario.", "La valoración económica es indicativa: no incluye inversión, impuestos, beneficios tributarios de la Ley 1715 ni flujo de caja."]
  },
  fvConductores: {
    metodo: "Corriente máxima y de diseño de los circuitos DC (1,25 × 1,25 × Isc) y AC (1,25 × In) según la NTC 2050 690-8, capacidad de la Tabla 310-16 corregida por temperatura (con el incremento por exposición solar que digita el usuario) y agrupamiento, temperatura de terminales, protección, conductor de puesta a tierra (Tabla 250-122) y caída de tensión.",
    limitaciones: ["El incremento de temperatura por exposición solar sobre cubiertas lo digita el usuario (NTC 2050 310-15(b)(3)(c)).", "Usa la Tabla 310-16 (conductores en canalización); para conductores al aire libre o en bandeja la capacidad real es mayor.", "No dimensiona el seccionador DC, la caja combinadora ni la protección diferencial; deben especificarse según la ficha del inversor y la NTC 2050 690-13 a 690-17."]
  },
  fvConexion: {
    metodo: "Clasificación AGPE o GD y procedimiento de conexión (CREG 174 de 2021), elevación de tensión en el punto de conexión con la impedancia de la red ((P·R + Q·X) / U²), aporte del inversor al cortocircuito, y requisitos de anti-isla y medición bidireccional, con los ajustes de referencia de la IEEE 1547-2018.",
    limitaciones: ["La capacidad disponible del circuito, la potencia de cortocircuito y los ajustes definitivos de protección los entrega el operador de red; los valores de este cálculo son de referencia.", "La elevación de tensión se calcula en el punto de conexión con la demanda mínima del usuario; no hace un flujo de carga del circuito con los demás generadores conectados.", "No reemplaza el estudio de conexión simplificado que exige la CREG 174 de 2021 para AGPE de más de 0,1 MW."]
  },
  mecanico: {
    metodo: "Ecuación de cambio de estado (método parabólico) resuelta por Newton-Raphson para cada hipótesis de temperatura y viento; flecha, tensión máxima y distancia al suelo.",
    limitaciones: ["Vano a nivel y método parabólico (adecuado para vanos cortos y medianos); no calcula vanos desnivelados, vano regulador de una sección ni la catenaria exacta.", "No calcula estructuras, cimentaciones ni retenidas (también parte del literal l)."]
  }
};

// Para la página «Alcance y validación».
export const VALIDACION = [
  "Cada cálculo de la pantalla se reproduce con fórmulas en el Excel formulado; ambos se compararon y dan los mismos resultados.",
  "El arco eléctrico se comprobó con los ejemplos D.1 (4,16 kV) y D.2 (480 V) del Anexo D de la IEEE 1584-2018: corrientes de arco, factor de encerramiento, energía incidente y frontera de arco coinciden con los valores publicados, en la pantalla y en el Excel.",
  "La interpretación de las mediciones Wenner en dos capas reproduce la Tabla 3 de la IEEE 81-2012 (ρ1 = 300 Ω·m, h = 6,1 m, ρ2 = 100 Ω·m y su inversa): el ajuste da 300,1 / 100,2 Ω·m y 6,08 m. La resistividad equivalente ρa(av2) coincide con la Tabla E.1 de la IEEE 80 (193 Ω·m) y el factor de división calculado con el ejemplo de la IEEE 80 §15.9 (Zeq de la línea 4,22 + j1,04 Ω; Sf 0,36 frente a 0,37 publicado).",
  "Las capacidades de corriente de cables de media tensión son las de las Tablas 310.60(C)(77) a (86) de la NEC 2017 (iguales en la NTC 2050), contrastadas celda por celda con las verificaciones publicadas por CalcWare. El tiempo de arco tomado de la coordinación coincide con el cálculo manual de la curva IEC.",
  "Las curvas IEEE C37.112 reproducen los valores de la norma (VI: 0,6891 s con M = 10 y TD = 1; EI: 1,2967 s con M = 5) y la curva por puntos interpola exactamente en escala log-log. El aporte de motores coincide con c × (ILR/IrM) × IrM en sus bornes, y el Excel formulado (con funciones de números complejos) reproduce el cálculo de la pantalla.",
  "El cálculo de malla se comprobó con el ejemplo 1 del Anexo B de la IEEE 80-2013 (Rg, Cs, tensión de contacto y tensión de malla coinciden).",
  "Las tablas normativas cargadas (NTC 2050, IEC, IEEE) se transcribieron de las normas citadas en cada hoja.",
  "Pendiente: validación independiente de cortocircuito y coordinación contra un estudio hecho con software comercial (ETAP o DIgSILENT), y revisión de una memoria completa por un organismo de inspección acreditado."
];

export const LIMITACIONES_GENERALES = [
  "AHÍNCO es una herramienta de cálculo y de verificación. La responsabilidad del diseño es del ingeniero que firma la memoria, que debe revisar los datos de entrada y los resultados.",
  "Los métodos son los de cálculo manual de las normas citadas, adecuados para memorias de distribución y para verificación de interventoría. Para subestaciones de alta tensión, el estudio definitivo de cortocircuito, coordinación y transitorios debe hacerse con software especializado.",
  "No incluye todavía: campos electromagnéticos, flujo de carga y armónicos, ni cálculo económico de conductores; esos literales se desarrollan como texto.",
  "Los datos marcados «(S)» son supuestos: quedan listados en la sección de hallazgos o pendientes y deben confirmarse antes de firmar.",
  "No guarda historial de versiones de un proyecto: use «Exportar proyecto» para conservar una copia de cada revisión."
];

export const MEJORAS = [
  ["Alta", "Validar cortocircuito y coordinación contra un estudio en ETAP o DIgSILENT, y una memoria completa con un organismo de inspección."],
  ["Media", "Malla en suelo de dos capas por un método numérico (sin pasar por la resistividad uniforme equivalente) y potenciales en la superficie fuera del cerramiento."],
  ["Media", "Cálculo IEC 60287 / Neher-McGrath de cables de media tensión para bancos de ductos con otra resistividad del suelo, otra disposición o más circuitos que las tablas."],
  ["Media", "Historial de versiones del proyecto y comparación entre revisiones de la memoria."],
  ["Media", "Coordinación con bandas de tolerancia de fusibles e interruptores de BT, reconectadores y protección diferencial; protección combinada de varios captadores en el apantallamiento."],
  ["Media", "Fotovoltaica: horas sol pico mensuales, simulación horaria con la curva de carga del usuario, varias orientaciones, sombras, módulos bifaciales y flujo de caja con los beneficios de la Ley 1715."],
  ["Baja", "Riesgo por rayos R2 a R4, armónicos y factor K, cálculo económico de conductores y campos electromagnéticos."]
];
