# AHÍNCO — alcance técnico, validación y mejoras pendientes

Documento para quien mantenga o amplíe AHÍNCO (`web/ahinco/`). Resume cómo está construido, qué está validado, qué limitaciones conocidas tiene cada cálculo y qué mejoras siguen, con el lugar del código donde se hace cada una.

> El texto que ve el usuario sobre alcance y limitaciones vive en `web/ahinco/js/rt-alcance.js`. Se muestra al final de cada cálculo, en la memoria PDF/Word, en el encabezado de cada hoja del Excel y en la página `acerca.html`. **Cuando se mejore un cálculo, actualice ahí su `metodo` y quite la limitación resuelta**, y también la tabla de este documento.

## 1. Cómo está construido

| Archivo | Qué hace |
|---|---|
| `js/rt-normas.js` | Tablas normativas (NTC 2050, IEC, IEEE, RETIE). Sin dependencias. |
| `js/rt-calculos.js` | Motor de cálculo: una función pura por módulo `f(entradas, proyecto, ctx)` que devuelve `{resumen, salidas, tablas, pasos, verificaciones, notas, conclusion}`. Sin Firebase: se puede probar con Node. |
| `js/rt-modulos.js` | Formularios de cada módulo (campos, valores de ejemplo, normas, objeto). |
| `js/rt-literales.js` | Literales a) a x) del RETIE y qué módulos desarrollan cada uno. Un módulo con `literalPrincipal` (en `rt-modulos.js`) se desarrolla en ese literal y los demás remiten a él. |
| `js/rt-alcance.js` | Alcance, validación, limitaciones y mejoras (texto para el usuario). |
| `js/rt-hallazgos.js` | Hallazgos (criterios que no cumplen) y supuestos «(S)». Tipo de proyecto `modo`: `diseno` o `verificacion`. |
| `js/rt-core.js` | Firebase (sesión, proyectos, cálculos), cálculo encadenado (`calcularProyecto`), instancias repetibles (`modulo-N`), importar y exportar. |
| `js/rt-shell.js` | Menú lateral (lista de proyectos y proyecto). |
| `js/rt-memoria.js` | Memoria PDF/Word con los generadores compartidos `web/js/control/informes-pdf.js` e `informes-docx.js`. |
| `js/rt-excel.js` | Excel formulado (ExcelJS): clase `Hoja` (formato, explicación de fórmulas, resumen, protección con clave `cinco`) y una función por módulo en `HOJAS`. |
| `proyecto.html`, `calculo.html`, `inicio.html`, `acerca.html` | Páginas (CSP estricta: sin `style=""` ni scripts externos). |

Datos en Firestore: `rtProyectos/{id}` y `rtProyectos/{id}/calculos/{clave}` (`clave` = módulo o `módulo-N`). Reglas en `firestore.rules` (se publican a mano).

### Agregar un módulo nuevo
1. Función de cálculo en `rt-calculos.js` y registrarla en `CALCULOS`.
2. Formulario en `rt-modulos.js` (área, campos, valores de ejemplo, normas, objeto).
3. Orden de cálculo en `ORDEN_MODULOS` (`rt-core.js`) si usa salidas de otro módulo (`ctx`).
4. Literal que desarrolla, en `rt-literales.js`.
5. Hoja del Excel en `HOJAS` (`rt-excel.js`), con su `h.resumen([...])` al final, y sus constantes en `CONSTANTES`.
6. Alcance y limitaciones en `rt-alcance.js`.
7. Probarlo: el resultado de la pantalla y el del Excel recalculado en Excel deben coincidir.

## 2. Validación hecha

- La pantalla y el Excel formulado dan los mismos resultados, comprobados recalculando en Excel con los proyectos de ejemplo y con las subestaciones Oriente, Sur y Seboruco (0 errores de fórmula).
- Malla de puesta a tierra: coincide con el ejemplo 1 del Anexo B de la IEEE 80-2013 (Rg 2,78 Ω; Cs 0,743; tensión de contacto 840,5 V; tensión de malla 992,5 V).
- Arco eléctrico (IEEE 1584-2018): coincide con los ejemplos D.1 (4,16 kV: Iarc 12,979 kA, E 12,152 J/cm², AFB 1606 mm; reducida 13,343 J/cm²) y D.2 (480 V: E 11,585 J/cm², AFB 1029 mm; reducida 53,156 J/cm²) del Anexo D, en la pantalla y en el Excel. Prueba: `arco1584()` en `rt-calculos.js`.
- Suelo de dos capas: la serie de Sunde reproduce la Tabla 3 de la IEEE 81-2012 (error ≤ 0,8 %, redondeo de la tabla) y el ajuste da ρ1 = 300,1, ρ2 = 100,2 Ω·m, h = 6,08 m (RMS 0,27 %), igual que XGSLab en el benchmark de la IEEE 80-2013 Anexo H. ρa(av2) = 193 Ω·m con la Tabla E.2 de la IEEE 80. Con la malla del Anexo H (70 × 70 m, 20 varillas de 7,5 m, 140 Ω·m) Rg = 1,022 Ω y GPR = 761 V, iguales a la norma; Em y Es salen 5 % menores que la columna «STD 80» del benchmark en las dos mallas (mismo factor: corriente de malla del ejemplo).
- Factor de división (Endrenyi): ejemplo de la IEEE 80 §15.9 — Zeq de la línea 4,22 + j1,04 Ω (igual), Sf 0,36 frente a 0,37 publicado (la norma redondea el neutro del alimentador a 1,88 + j0,89 Ω; la fórmula da 1,88 + j0,81 Ω).
- Cables de MT: los valores de `AMPACIDAD_MT` se extrajeron de las verificaciones de CalcWare (NEC 2017) y se compararon celda por celda (0 diferencias); dos erratas de la NEC impresa (Tabla 85 Det. 7 350 kcmil 105 °C: 580 → 530; Tabla 84 Det. 6 6 AWG 35 kV 105 °C: 95 → 87) se reemplazaron por el valor coherente con el cálculo Neher-McGrath.
- Arco con tiempos de la coordinación: `tiempoArcoDesdeRele()` coincide con el cálculo manual de la curva IEC (2,33 kA en SI 200 A TMS 0,1 → 328 ms con 50 ms de apertura) y con el Excel.
- Coordinación: curvas IEEE C37.112 (VI 0,6891 s con M = 10, TD = 1; EI 1,2967 s con M = 5) y curva por puntos (interpolación log-log exacta en el punto medio geométrico). Cortocircuito: aporte de motores = c × (ILR/IrM) × IrM en bornes; motores aguas abajo aportan a las barras de aguas arriba; Excel = pantalla.
- Campos EM: soluciones analíticas de un conductor (E en el suelo = 2V/(h ln(2h/r)); B = μ0 I/(2π r)), radio equivalente de haces y simetría. Armónicos: 6 pulsos teórico (THD 29,04 %, K 8,30). Cálculo económico: Q cerrado = suma; igualdad de CT en los límites económicos. Excel = pantalla en los tres.
- **Pendiente:** validación independiente de cortocircuito y coordinación contra un estudio en ETAP o DIgSILENT, y revisión de una memoria completa por un organismo de inspección acreditado.

## 3. Limitaciones conocidas por cálculo

| Cálculo | Limitación | Dónde se resolvería |
|---|---|---|
| Cortocircuito | Radial con un solo transformador. Motores en paralelo por barra (en el Excel, un grupo por barra con los datos del primero); inversores sumados en forma aritmética. Z0 del fabricante opcional. Sin Ib ni Ik permanente. | `cortocircuito()` en `rt-calculos.js` (nodos con Thévenin hacia la fuente y hacia aguas abajo); `HOJAS.cortocircuito` con funciones IM de Excel |
| Malla (IEEE 80) | Dos capas por resistividad equivalente ρa(av2), no por cálculo numérico de dos capas (Em puede quedar baja con K < 0; se muestra la referencia con ρ1). Malla rectangular. Sf por Endrenyi sin acoples mutuos. Transferidas solo GPR frente al contacto tolerable. | `malla()`, `ajusteDosCapas()`, `factorDivision()` en `rt-calculos.js` |
| Arco eléctrico | Solo 0,208 a 15 kV trifásico AC (fuera: «Fuera del modelo»); tiempos de la coordinación solo con curvas IEC (sin fusibles ni ANSI); sin arco DC. | `arco1584()` y `arcoElectrico()`; tablas `IEEE1584` en `rt-normas.js` |
| Cables de MT | Tablas 310.60(C)(77) a (86) (`AMPACIDAD_MT`, `INSTALACIONES_MT` en `rt-normas.js`; `ampacidadTablaMT()`) solo para suelo de 90 °C·cm/W y las disposiciones de la Figura 310.60; sin IEC 60287; pantalla no verificada. | `cableMT()`; agregar Neher-McGrath (NEC Anexo B) |
| Coordinación | IEC, IEEE C37.112, tiempo definido y curvas por puntos (fusibles); fase y 51N con la protección más cercana a cada falla. Sin bandas de tolerancia, 87, 21 ni reconectadores. | `coordinacion()`, `paresCoordinacion()`, `CURVAS_IEC` y `puntosCurva()` en `rt-normas.js`; `curvaPuntosExcel()` en `rt-excel.js` |
| Apantallamiento | Un captador por elemento, en el plano; sin protección combinada ni planta. | `apantallamiento()` |
| Riesgo por rayos | Solo R1 (RA, RB, RU, RV); una zona y una línea. | `rayos()` |
| Aislamiento | Método simplificado sin transitorios (EMTP/ATP). | — (fuera del alcance de una herramienta de cálculo manual) |
| Distancias | Tabla RETIE incompleta para 66–230 kV (valores `null`): el usuario digita. | `RETIE_DISTANCIAS` en `rt-normas.js` (cargar con la tabla vigente) |
| Mecánico | Vano a nivel, parabólico; sin vano regulador ni estructuras. | `mecanico()` |
| Conductores BT | Tabla 310-16 únicamente; sin I²t ni bandejas. | `conductores()` |
| Cargas / transformador | Sin armónicos ni factor K. | `cargas()`, `transformador()` |
| FV — arreglo | Strings iguales en todas las MPPT; sin varias orientaciones, sombras parciales, recorte (clipping), bifaciales ni optimizadores. | `fvArreglo()` en `rt-calculos.js` |
| FV — producción | Energía anual con un solo valor de HSP (sin simulación horaria ni transposición al plano); simultaneidad supuesta; economía indicativa sin flujo de caja. | `fvProduccion()`; agregar HSP mensual y curva de carga |
| FV — conductores | Incremento de temperatura por sol digitado; Tabla 310-16 para todos los casos; no dimensiona seccionador DC ni caja combinadora. | `fvConductores()` |
| FV — conexión | Sin flujo de carga del circuito; capacidad disponible, Sk y ajustes los da el operador de red; no reemplaza el estudio de conexión simplificado (> 0,1 MW). | `fvConexion()`; `AJUSTES_IEEE1547` en `rt-normas.js` |
| Campos EM (literal g) | Conductores rectos e infinitos a la altura de la flecha; suelo plano; sin corrientes inducidas en guardas. | `camposEM()`, `camposPerfil()`; Excel con MINVERSE |
| Armónicos (literal c) | Suma aritmética de grupos; THDv sin resonancias; espectros teóricos o típicos. | `armonicos()`, `ESPECTROS` e `IEEE519_*` en `rt-normas.js` |
| Cálculo económico (literal j) | Costos digitados; resistencia de la Tabla 9; sin pérdidas en pantallas. | `conductorEconomico()`, `factorEconomico()` |
| Riesgo por rayos R2 a R4 | No implementado: requiere los componentes RC, RM, RW y RZ con las tablas de la NTC 4552-2 / IEC 62305-2. | `rayos()` |
| Proyecto | Sin historial de versiones (se usa «Exportar»). | `rt-core.js` (subcolección de versiones) |

## 4. Mejoras pendientes (en orden)

1. **Validación independiente** (cortocircuito, coordinación, memoria completa). No requiere código, pero es lo que más credibilidad da. Registrar el resultado en la sección 2 y en `VALIDACION` (`rt-alcance.js`).
2. **Arco en DC** (baterías, FV) y tiempos con fusibles y curvas ANSI.
3. **Malla en dos capas por método numérico** (sin resistividad equivalente) y potenciales fuera del cerramiento.
4. **Cables de MT — IEC 60287 / Neher-McGrath** para bancos de ductos fuera de las condiciones de las tablas (resistividad térmica, disposición, más circuitos).
5. **Historial de versiones**: guardar una copia de entradas y literales al generar cada memoria (`rtProyectos/{id}/versiones`), con comparación entre revisiones.
6. **Cortocircuito**: redes malladas o con varias fuentes; corriente de corte Ib e Ik permanente.
7. **Coordinación**: bandas de tolerancia de fusibles e interruptores de BT, reconectadores; apantallamiento con varios captadores.
8. **Fotovoltaica avanzada**: HSP mensual (IDEAM / NASA POWER), simulación horaria con la curva de carga del usuario, varias orientaciones, sombras, bifaciales y flujo de caja con los beneficios de la Ley 1715.
9. **Otros**: riesgo R2 a R4 (requiere las tablas de la NTC 4552-2 para RC, RM, RW y RZ), flujo de carga, campos EM en 3D.
