# AHÍNCO — alcance técnico, validación y mejoras pendientes

Documento para quien mantenga o amplíe AHÍNCO (`web/ahinco/`). Resume cómo está construido, qué está validado, qué limitaciones conocidas tiene cada cálculo y qué mejoras siguen, con el lugar del código donde se hace cada una.

> El texto que ve el usuario sobre alcance y limitaciones vive en `web/ahinco/js/rt-alcance.js`. Se muestra al final de cada cálculo, en la memoria PDF/Word, en el encabezado de cada hoja del Excel y en la página `acerca.html`. **Cuando se mejore un cálculo, actualice ahí su `metodo` y quite la limitación resuelta**, y también la tabla de este documento.

## 1. Cómo está construido

| Archivo | Qué hace |
|---|---|
| `js/rt-normas.js` | Tablas normativas (NTC 2050, IEC, IEEE, RETIE). Sin dependencias. |
| `js/rt-calculos.js` | Motor de cálculo: una función pura por módulo `f(entradas, proyecto, ctx)` que devuelve `{resumen, salidas, tablas, pasos, verificaciones, notas, conclusion}`. Sin Firebase: se puede probar con Node. |
| `js/rt-modulos.js` | Formularios de cada módulo (campos, valores de ejemplo, normas, objeto). |
| `js/rt-literales.js` | Literales a) a x) del RETIE y qué módulos desarrollan cada uno. |
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
- **Pendiente:** validación independiente de cortocircuito y coordinación contra un estudio en ETAP o DIgSILENT, y revisión de una memoria completa por un organismo de inspección acreditado.

## 3. Limitaciones conocidas por cálculo

| Cálculo | Limitación | Dónde se resolvería |
|---|---|---|
| Cortocircuito | Radial, una fuente; sin aporte de motores ni generación distribuida. Z0 aproximada (transformador ≈ Z1, cables ≈ 4 Z1, zig-zag con su X0). Sin Ib ni Ik permanente. | `cortocircuito()` en `rt-calculos.js`; columnas R0/X0 en `HOJAS.cortocircuito` |
| Malla (IEEE 80) | Suelo uniforme; malla rectangular; Sf digitado; sin tensiones transferidas. | `malla()`; agregar modelo de dos capas (IEEE 80 §13) y cálculo de Sf (Anexo C) |
| Cables de MT | Ampacidad digitada por el usuario; sin IEC 60287 ni tablas 310-77 a 310-86; pantalla no verificada. | `cableMT()` y `rt-normas.js` (tablas nuevas) |
| Coordinación | Solo sobrecorriente de fase IEC; sin ANSI, fusibles, 51N, 87, 21; corrientes referidas a una tensión por el usuario. | `coordinacion()`, `CURVAS_IEC` en `rt-normas.js`, gráfico en `rt-grafico.js` |
| Apantallamiento | Un captador por elemento, en el plano; sin protección combinada ni planta. | `apantallamiento()` |
| Riesgo por rayos | Solo R1 (RA, RB, RU, RV); una zona y una línea. | `rayos()` |
| Aislamiento | Método simplificado sin transitorios (EMTP/ATP). | — (fuera del alcance de una herramienta de cálculo manual) |
| Distancias | Tabla RETIE incompleta para 66–230 kV (valores `null`): el usuario digita. | `RETIE_DISTANCIAS` en `rt-normas.js` (cargar con la tabla vigente) |
| Mecánico | Vano a nivel, parabólico; sin vano regulador ni estructuras. | `mecanico()` |
| Conductores BT | Tabla 310-16 únicamente; sin I²t ni bandejas. | `conductores()` |
| Cargas / transformador | Sin armónicos ni factor K. | `cargas()`, `transformador()` |
| Proyecto | Sin historial de versiones (se usa «Exportar»). | `rt-core.js` (subcolección de versiones) |

## 4. Mejoras pendientes (en orden)

1. **Validación independiente** (cortocircuito, coordinación, memoria completa). No requiere código, pero es lo que más credibilidad da. Registrar el resultado en la sección 2 y en `VALIDACION` (`rt-alcance.js`).
2. **Arco eléctrico IEEE 1584-2018**: módulo nuevo (área MT), con la corriente de cortocircuito de `ctx.cortocircuito` y el tiempo de despeje de la coordinación; literal e).
3. **Malla con suelo de dos capas**: entradas ρ1, ρ2 y espesor h1 (de la medición IEEE 81); resistencia y tensiones según IEEE 80 §13 / Anexo E.
4. **Cables de MT**: cargar las Tablas 310-77 a 310-86 de la NTC 2050 en `rt-normas.js` y, como opción, IEC 60287 para bancos de ductos (resistividad térmica, profundidad, agrupamiento).
5. **Historial de versiones**: guardar una copia de entradas y literales al generar cada memoria (`rtProyectos/{id}/versiones`), con comparación entre revisiones.
6. **Cortocircuito ampliado**: aporte de motores y generación, impedancias de secuencia cero del fabricante.
7. **Coordinación ampliada**: curvas ANSI, fusibles, 51N; apantallamiento con varios captadores.
8. **Otros**: riesgo R2 a R4, armónicos y factor K, cálculo económico de conductores (literal j), campos electromagnéticos (literal g).
