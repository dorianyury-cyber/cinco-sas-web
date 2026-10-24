// Alcance, validación y limitaciones de AHÍNCO. Un solo lugar para que el
// ingeniero sepa hasta dónde llega cada cálculo (se muestra en pantalla, en la
// memoria PDF/Word y en el Excel) y para que el desarrollador sepa qué falta.
// El plan de mejoras detallado, con dónde tocar el código, está en
// docs/AHINCO-mejoras.md (raíz del repositorio; no se publica en el sitio).
// Al mejorar un cálculo: actualice aquí su "metodo" y quite la limitación.

export const ALCANCE = {
  riesgoElectrico: {
    metodo: "Matriz de análisis de riesgos del RETIE 2024 (Libro 1, Tabla 1.5.1.4.1.a): para cada riesgo se cruza la probabilidad (E a A) con la consecuencia (1 a 5) en personas, económicas, ambientales y de imagen, se toma el caso más crítico y se repite con las medidas de mitigación para obtener el riesgo residual; las decisiones salen de la Tabla 1.5.1.4.1.b.",
    limitaciones: ["La identificación de los riesgos, la probabilidad y las consecuencias las define el diseñador: el aplicativo aplica la matriz, no reemplaza el criterio del ingeniero.", "El riesgo residual se valora con una sola consecuencia (la mayor después de las medidas) y una probabilidad."]
  },
  nivelTension: {
    metodo: "Compara los niveles de tensión candidatos para la demanda proyectada: corriente, caída de tensión y pérdidas en la acometida con un conductor de referencia por nivel, y potencia máxima que el operador de red conecta en cada nivel; recomienda el menor nivel viable. Niveles según la CREG 015 de 2018 y tensiones de la NTC 1340.",
    limitaciones: ["Los conductores de referencia, su capacidad y los límites de potencia del operador de red son datos de entrada (los de ejemplo son ilustrativos): tómelos de la norma del operador del área.", "No incluye el costo de la conexión ni la disponibilidad de la red, que definen la decisión final junto con la factibilidad del operador."]
  },
  unifilar: {
    metodo: "Diagrama unifilar generado con los datos de los cálculos del proyecto: red del operador, DPS y protección de media tensión, transformador, medida, barras con sus cables y corrientes de cortocircuito, circuitos con su protección y calibre, tableros derivados y generación solar.",
    limitaciones: ["Es un diagrama de una sola fuente y un transformador, con los circuitos que salen de una barra: no dibuja transferencias, plantas de emergencia, celdas de media tensión ni varios transformadores.", "No reemplaza el plano de construcción (literal s): úselo como base y complete marcas, referencias y cuadros de cargas."]
  },
  cargas: {
    metodo: "Suma de cargas por circuito con factor de demanda, reparto por fase y corriente del alimentador con el 25 % del motor más grande (NTC 2050 Sección 220 y 430.24).",
    limitaciones: ["No calcula armónicos ni el factor K de cargas no lineales: si hay variadores, UPS o iluminación LED en gran cantidad, el literal c) debe complementarse.", "Los factores de demanda los define el diseñador; no se aplican automáticamente las tablas de la Sección 220."]
  },
  conductores: {
    metodo: "Capacidad de corriente de la NTC 2050 Tabla 310.15(B)(16) con corrección por temperatura y agrupamiento, temperatura de terminales (110.14(C)), cargas continuas al 125 % y protección normalizada (240.6(A)).",
    limitaciones: ["Solo conductores de baja tensión (hasta 2000 V) en canalización o cable; no cubre instalación al aire libre ni bandejas (Tabla 310.15(B)(17) / 392).", "No verifica la soportabilidad térmica del conductor al cortocircuito (I²t); para cables de media tensión use el cálculo «Cables de media tensión».", "La coordinación con las curvas de limitación de los interruptores (IEC 60947-2 Anexo A) no se calcula."]
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
    metodo: "Potencia normalizada (NTC 818 / 819) a partir de la demanda y el crecimiento, corrientes nominales, cortocircuito en bornes con barra infinita y protecciones primaria (fusible K) y secundaria (450.3).",
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
    metodo: "NTC 4552-2 (IEC 62305-2:2006): número de eventos peligrosos ND, NM, NL, NI y NDa; probabilidades PA a PZ con las Tablas 14 a 25; pérdidas de las Tablas 26 a 32; los ocho componentes RA a RZ y los riesgos R1 (vidas humanas), R2 (servicio público), R3 (patrimonio cultural) y R4 (valor económico, con la conveniencia económica de 5.6). Busca la combinación mínima de SIPRA y DPS que lleva R1, R2 y R3 al tolerable y da los parámetros de diseño del SIPRA de la NTC 4552-3 (esfera rodante, malla, bajantes, electrodo l1 y distancia de separación) y los de la NTC 4552-1 (corrientes máxima y mínima y eficacia del nivel).",
    limitaciones: ["Una sola zona por estructura (si hay zonas con características distintas, cree un cálculo por zona) y a lo sumo dos líneas de servicio: potencia y telecomunicaciones.", "No evalúa las acometidas de servicio como objeto de protección (R'1, R'2 y R'4) ni líneas de fibra óptica o tuberías metálicas, que la NTC 4552-2 deja en estudio.", "El método del ángulo de protección de la NTC 4552-3 (Figura 3) no se calcula: se usa la esfera rodante, que es la que fija la norma como método de referencia."]
  },
  armonicos: {
    metodo: "Espectro de corriente por grupo de carga (convertidores de 6 y 12 pulsos teóricos, fuentes conmutadas típicas o espectro medido), THDi y TDD frente a los límites de la IEEE 519-2014 según ISC/IL, distorsión de tensión estimada en el PCC, factor K (UL 1561) y capacidad del transformador con armónicos (IEEE C57.110), y corriente en el neutro por armónicos triples.",
    limitaciones: ["Las corrientes armónicas de los grupos se suman en forma aritmética (sin diversidad de ángulos), lo que da el caso más desfavorable.", "La distorsión de tensión supone una fuente inductiva sin resonancias: no modela bancos de condensadores ni filtros (verifique la resonancia paralela h ≈ √(Scc / Qc)).", "Los espectros de convertidores son teóricos y el de fuentes conmutadas es típico: el estudio definitivo debe usar mediciones del sitio (IEEE 519 se evalúa con mediciones en el PCC)."]
  },
  conductorEconomico: {
    metodo: "IEC 60287-3-2: costo total en la vida útil por calibre (costo instalado más valor presente de las pérdidas Joule con crecimiento de carga y de precio y tasa de descuento), con resistencia a la temperatura media de operación, rango económico de corriente de cada calibre y selección del de menor costo entre los que tienen capacidad de corriente suficiente.",
    limitaciones: ["Los costos instalados por metro los digita el usuario (los de ejemplo son ilustrativos).", "La resistencia AC es la de la NTC 2050 Cap. 9 Tabla 9 en tubo de PVC, corregida a la temperatura media; no incluye pérdidas en pantallas ni armaduras de cables de media tensión.", "El calibre económico es una recomendación: el RETIE exige el cálculo, no que se adopte el calibre de menor costo."]
  },
  camposEM: {
    metodo: "Perfil lateral a 1 m del suelo (o a la altura indicada): campo eléctrico por simulación de cargas con imágenes (coeficientes de potencial de Maxwell, haces con radio equivalente, cables de guarda a tierra) y densidad de flujo magnético por Biot-Savart, frente a los límites del público y ocupacional del RETIE 2024 (Tabla 3.11.1.a); identifica las zonas de más de 200 µT y de más de 1000 µT.",
    limitaciones: ["Conductores rectos, paralelos e infinitos a la altura del punto más bajo de la flecha (caso más desfavorable); no modela la catenaria en 3D, los extremos de los vanos ni estructuras metálicas cercanas.", "El suelo es plano y conductor para el campo eléctrico; para el campo magnético se desprecian las imágenes y la corriente inducida en los cables de guarda (ambas lo reducen levemente).", "En subestaciones, los barrajes y conexiones se modelan como conductores de este perfil: para geometrías complejas (equipos, transformadores, edificaciones cercanas) use software 3D."]
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
  iluminacion: {
    metodo: "Verificación del diseño de iluminación interior frente al RETILAP 2024 (Anexo General de la Res. 40150 de 2024, con las modificaciones de las Res. 40318 de 2025 y 40286 de 2026), Libro 3: Em, Uo, UGR y Em,z por recinto según la Tabla 3.2.2.6.a; reflectancia del piso (3.2.1.1); método del UGR con giro del observador en oficinas (3.2.1.4); VEEI por recinto con los límites de la Tabla 3.2.5.a (2,5 en locales de más de 600 lx); emergencia en rutas (1 lx), zonas de énfasis (5 lx; cuarto eléctrico 15 lx vertical), antipánico (0,5 lx), relación 1:40, mallas impares, autonomía de 60 min y Ra >= 70; factor de mantenimiento, control del alumbrado (art. 3.2.6) y documentos del diseño básico y detallado (3.1.4). Control cruzado opcional por el método de los lúmenes.",
    limitaciones: ["No calcula la iluminancia punto a punto: los resultados fotométricos (Em, Uo, UGR, Ez, emergencia) son los del software de cálculo (DIALux, RELUX u otro), que el usuario transcribe.", "Incluye los tipos de recinto más frecuentes de la Tabla 3.2.2.6.a; para otros use «Personalizado» y digite los valores exigidos.", "No incluye alumbrado público, exterior, deportivo ni de túneles (Títulos 3 a 5 del Libro 3).", "No verifica los límites de luminancia para pantallas (Tabla 3.2.1.8.a) ni la fotometría de las luminarias de emergencia (Tabla 3.2.4.a)."]
  },
  distancias: {
    metodo: "Distancias mínimas de seguridad del RETIE 2024 (Libro 3, Tablas 3.10.1.a y 3.10.2.a: construcciones, vías, zonas verdes, ferrocarriles, ríos y campos deportivos, de < 1 kV a 500 kV), con la corrección por altitud de la Nota 2 del art. 3.10 (3 % por cada 300 m sobre 1000 m, solo sobre 57,5 kV), y ancho de la zona de servidumbre de líneas de transmisión (Tabla 3.19.1.a, con la reducción de la Nota 5).",
    limitaciones: ["Donde la tabla del RETIE no da valor para una tensión (por ejemplo, «a» o «c» sobre 44 kV), el usuario digita la distancia exigida.", "No calcula cruces entre líneas (Tabla 3.10.3.a), distancias entre conductores en la misma estructura (Tablas 3.10.4.a y b) ni distancias dentro de subestaciones: se digitan como distancia exigida (o use la distancia en aire del cálculo de aislamiento).", "No calcula la corriente electrostática de 5 mA exigida sobre 98 kV línea-tierra (Nota 1 de la Tabla 3.10.2.a) ni el desplazamiento B por viento de la ecuación de servidumbre: son datos del diseñador."]
  },
  fvArreglo: {
    metodo: "Tensiones del string a la temperatura mínima (Voc) y a la temperatura máxima de celda (Vmp, método NOCT), rango de módulos en serie, corriente por MPPT con el 125 % de la NTC 2050 690.8, relación DC/AC, DPS de corriente continua y necesidad de fusibles de string (IEC 62548).",
    limitaciones: ["Supone strings iguales (mismo número de módulos, orientación e inclinación) en todas las entradas MPPT usadas; arreglos con varias orientaciones deben calcularse como cálculos separados.", "No calcula el recorte (clipping) de potencia del inversor ni el comportamiento con sombras parciales.", "No incluye módulos bifaciales (ganancia por la cara posterior) ni microinversores u optimizadores."]
  },
  fvProduccion: {
    metodo: "Energía anual = potencia pico × horas sol pico × 365 × PR, con el PR como producto de las pérdidas (temperatura de celda por el método NOCT, suciedad, sombras, dispersión, cableado, inversor e indisponibilidad), degradación anual y balance con el consumo según la CREG 174 de 2021.",
    limitaciones: ["Cálculo anual con un solo valor de horas sol pico: no hace simulación horaria ni mensual (PVsyst, SAM o PVGIS la hacen) ni considera la transposición al plano inclinado; las HSP deben estar ya en el plano del arreglo.", "La simultaneidad entre generación y consumo es un dato supuesto; para un balance preciso se requiere la curva de carga horaria del usuario.", "La valoración económica es indicativa: no incluye inversión, impuestos, beneficios tributarios de la Ley 1715 ni flujo de caja."]
  },
  fvConductores: {
    metodo: "Corriente máxima y de diseño de los circuitos DC (1,25 × 1,25 × Isc) y AC (1,25 × In) según la NTC 2050 690.8, capacidad de la Tabla 310.15(B)(16) corregida por temperatura (con el incremento por exposición solar que digita el usuario) y agrupamiento, temperatura de terminales, protección, conductor de puesta a tierra (Tabla 250.122) y caída de tensión.",
    limitaciones: ["El incremento de temperatura por exposición solar sobre cubiertas lo digita el usuario (NTC 2050 310.15(B)(3)(c)).", "Usa la Tabla 310.15(B)(16) (conductores en canalización); para conductores al aire libre o en bandeja la capacidad real es mayor.", "No dimensiona el seccionador DC, la caja combinadora ni la protección diferencial; deben especificarse según la ficha del inversor y la NTC 2050 690.13 a 690.17."]
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
  "Campos electromagnéticos: el cálculo reproduce las soluciones analíticas de un conductor sobre el suelo (E en el suelo = 2V / (h ln(2h/r)) y B = μ0 I / (2π r)), el radio equivalente de haces y la simetría del perfil; el Excel (MINVERSE) da los mismos resultados.",
  "Armónicos: con el convertidor de 6 pulsos teórico da THD = 29,04 % y K = FHL = 8,30 (valores analíticos), los límites de la IEEE 519-2014 y la reducción de capacidad de la IEEE C57.110. Cálculo económico: Q coincide con la suma de la serie y en el límite económico entre dos calibres sus costos totales se igualan (IEC 60287-3-2 ec. 12 y 13). El Excel reproduce ambos cálculos.",
  "Análisis de riesgos: la matriz reproduce la Tabla 1.5.1.4.1.a del RETIE 2024 (Libro 1). Nivel de tensión: la caída de tensión coincide con el cálculo manual ΔV % = S L (R cos φ + X sen φ) / (10 V²).",
  "El cálculo de malla se comprobó con el ejemplo 1 del Anexo B de la IEEE 80-2013 (Rg, Cs, tensión de contacto y tensión de malla coinciden).",
  "Las tablas normativas cargadas (NTC 2050, IEC, IEEE) se transcribieron de las normas citadas en cada hoja.",
  "Revisión contra el RETIE 2024 compilado con la Resolución 40284 del 23 de junio de 2026 (texto oficial del Ministerio de Minas y Energía): literales a) a x) del 3.3.1.1 y diseño básico del 3.3.1.2; distancias de las Tablas 3.10.1.a y 3.10.2.a (hasta 500 kV) y corrección por altitud de la Nota 2 del art. 3.10; servidumbre de la Tabla 3.19.1.a; tensión de contacto sin capa de la Tabla 3.12.1.a y resistencia de referencia de la Tabla 3.12.3.a; límites de campos de la Tabla 3.11.1.a; matriz de riesgos de la Tabla 1.5.1.4.1.a; regulación del Título 26; DPS del 3.3.3.1 y del art. 3.17.14; armónicos del 3.3.3.6; aviso de arco del art. 3.10.5; inversores del art. 3.17.21; tensión de tendido de los art. 3.19.6 y 3.20.6.1, y referencias a la NTC 2050 Segunda Actualización.",
  "Pendiente: validación independiente de cortocircuito y coordinación contra un estudio hecho con software comercial (ETAP o DIgSILENT), y revisión de una memoria completa por un organismo de inspección acreditado."
];

export const LIMITACIONES_GENERALES = [
  "AHÍNCO es una herramienta de cálculo y de verificación. La responsabilidad del diseño es del ingeniero que firma la memoria, que debe revisar los datos de entrada y los resultados.",
  "Los métodos son los de cálculo manual de las normas citadas, adecuados para memorias de distribución y para verificación de interventoría. Para subestaciones de alta tensión, el estudio definitivo de cortocircuito, coordinación y transitorios debe hacerse con software especializado.",
  "No incluye todavía flujo de carga ni planos de construcción: esos aspectos se desarrollan como texto.",
  "Los datos marcados «(S)» son supuestos: quedan listados en la sección de hallazgos o pendientes y deben confirmarse antes de firmar.",
  "El historial de versiones guarda una copia de los datos, literales y cálculos de cada revisión; las versiones no se pueden modificar y solo el dueño del proyecto puede borrarlas (con el proyecto)."
];

export const MEJORAS = [
  ["Alta", "Validar cortocircuito y coordinación contra un estudio en ETAP o DIgSILENT, y una memoria completa con un organismo de inspección."],
  ["Media", "Malla en suelo de dos capas por un método numérico (sin pasar por la resistividad uniforme equivalente) y potenciales en la superficie fuera del cerramiento."],
  ["Media", "Cálculo IEC 60287 / Neher-McGrath de cables de media tensión para bancos de ductos con otra resistividad del suelo, otra disposición o más circuitos que las tablas."],
  ["Media", "Coordinación con bandas de tolerancia de fusibles e interruptores de BT, reconectadores y protección diferencial; protección combinada de varios captadores en el apantallamiento."],
  ["Media", "Fotovoltaica: horas sol pico mensuales, simulación horaria con la curva de carga del usuario, varias orientaciones, sombras, módulos bifaciales y flujo de caja con los beneficios de la Ley 1715."],
  ["Media", "Riesgo por rayos con varias zonas por estructura y las acometidas de servicio como objeto de protección (R'1, R'2, R'4) de la NTC 4552-2."],
  ["Baja", "Flujo de carga; campos electromagnéticos en 3D para subestaciones con geometría compleja."]
];
