// Libro de Excel formulado de AHÍNCO: un solo archivo con la portada (índice y
// guía de uso), los literales a) a x) del RETIE, los hallazgos, una hoja por
// cálculo y la hoja "Tablas" con las tablas normativas. Cada hoja de cálculo
// explica qué calcula, sus normas y constantes; las celdas amarillas son datos
// de entrada (desbloqueadas) y las grises son fórmulas vivas protegidas, con su
// explicación en palabras; al final, un resumen de la selección.
import * as N from "./rt-normas.js";
import { MODULOS } from "./rt-modulos.js";
import { LITERALES, FUENTE_LITERALES } from "./rt-literales.js";
import { SISTEMAS_BT, impedanciaConductor } from "./rt-calculos.js";
import { hallazgos, supuestos, esVerificacion } from "./rt-hallazgos.js";

const NAVY = "FF1F2732", AMARILLO = "FFFFF4CC", GRIS = "FFF2F3F5";
const borde = { style: "thin", color: { argb: "FFC9CED6" } };
const BORDES = { top: borde, left: borde, bottom: borde, right: borde };
const n = (v, d = 0) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : d; };
const col = (i) => { let s = ""; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

// ---------------------------------------------------------------- hoja de tablas normativas
const T = {}; // rangos con nombre lógico → referencia absoluta en "Tablas"
function hojaTablas(wb) {
  const ws = wb.addWorksheet("Tablas");
  ws.columns = [{ width: 12 }, ...Array(16).fill({ width: 11 })];
  let r = 1;
  const titulo = (t) => { ws.getCell(`A${r}`).value = t; ws.getCell(`A${r}`).font = { bold: true, color: { argb: NAVY } }; r++; };
  const enc = (h) => { h.forEach((v, i) => { const c = ws.getCell(r, i + 1); c.value = v; c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; c.alignment = { wrapText: true, vertical: "middle" }; }); r++; };
  // Conductores BT.
  titulo("NTC 2050 Tabla 310-16 (A), Cap. 9 Tabla 9 (Ω/km, 75 °C) y Tabla 5 (mm²)");
  enc(["Calibre", "Cu 60 °C", "Cu 75 °C", "Cu 90 °C", "Al 60 °C", "Al 75 °C", "Al 90 °C", "Sección mm²", "R Cu PVC", "R Cu acero", "R Al PVC", "XL PVC", "XL acero", "Área THHN", "Límite 240-4(d) Cu", "Límite 240-4(d) Al"]);
  const ini = r;
  N.CALIBRES.forEach((c) => {
    const cu = N.AMPACIDAD.Cu[c] || [null, null, null], al = N.AMPACIDAD.Al[c] || [null, null, null], t9 = N.TABLA9[c];
    ws.addRow([c, ...cu, ...al, N.SECCION_MM2[c], t9[2], t9[3], t9[4], t9[0], t9[1], N.AREA_THHN[c], N.LIMITE_PEQUENOS.Cu[c] ?? null, N.LIMITE_PEQUENOS.Al[c] ?? null]);
    ws.getCell(`A${r}`).value = String(c);
    r++;
  });
  T.cond = `Tablas!$A$${ini}:$P$${r - 1}`;
  r++;
  titulo("Factor de corrección por temperatura ambiente (NTC 2050 Tabla 310-16); columna A = límite inferior del rango");
  enc(["Desde °C", "60 °C", "75 °C", "90 °C"]);
  const iniT = r;
  let anterior = -100;
  N.FACTOR_TEMPERATURA.forEach(([hasta, a, b, c]) => { ws.addRow([anterior + 0.0001, a ?? 0, b ?? 0, c ?? 0]); anterior = hasta; r++; });
  T.temp = `Tablas!$A$${iniT}:$D$${r - 1}`; T.tempDesde = `Tablas!$A$${iniT}:$A$${r - 1}`;
  r++;
  titulo("Factor de ajuste por más de 3 conductores portadores (NTC 2050 310-15(b)(2)(a))");
  enc(["Desde N.º", "Factor"]);
  const iniA = r;
  let antA = 0;
  N.FACTOR_AGRUPAMIENTO.forEach(([hasta, f]) => { ws.addRow([antA + 0.5, f]); antA = hasta === Infinity ? 9999 : hasta; r++; });
  ws.getCell(`A${iniA}`).value = 0;
  T.agr = `Tablas!$A$${iniA}:$B$${r - 1}`; T.agrDesde = `Tablas!$A$${iniA}:$A$${r - 1}`;
  r++;
  titulo("Corrientes normalizadas de protecciones (NTC 2050 240-6) y fusibles tipo K");
  enc(["In (A)", "Fusible K (A)"]);
  const iniP = r;
  const largo = Math.max(N.PROTECCIONES_NORMALIZADAS.length, N.FUSIBLES_K.length);
  for (let i = 0; i < largo; i++) { ws.addRow([N.PROTECCIONES_NORMALIZADAS[i] ?? null, N.FUSIBLES_K[i] ?? null]); r++; }
  T.prot = `Tablas!$A$${iniP}:$A$${iniP + N.PROTECCIONES_NORMALIZADAS.length - 1}`;
  T.fusK = `Tablas!$B$${iniP}:$B$${iniP + N.FUSIBLES_K.length - 1}`;
  r++;
  titulo("Área interna de tuberías, mm² (NTC 2050 Cap. 9 Tabla 4)");
  enc(["Tamaño", "EMT", "IMC", "PVC40"]);
  const iniTu = r;
  ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "2-1/2", "3", "3-1/2", "4", "5", "6"].forEach((t) => {
    const a = (k) => N.TUBERIAS[k].areas.find(([s]) => s === t)?.[1] ?? null;
    ws.addRow([t, a("EMT"), a("IMC"), a("PVC40")]);
    ws.getCell(`A${r}`).value = String(t);
    r++;
  });
  T.tub = `Tablas!$A$${iniTu}:$D$${r - 1}`;
  r++;
  titulo("Curvas IEC 60255-151");
  enc(["Curva", "k", "α"]);
  const iniC = r;
  Object.entries(N.CURVAS_IEC).forEach(([k, v]) => { ws.addRow([k, v.k, v.a]); r++; });
  T.curvas = `Tablas!$A${iniC}:$C${r - 1}`;
  r++;
  titulo("Conductor de puesta a tierra de equipos (NTC 2050 Tabla 250-122)");
  enc(["Protección hasta (A)", "Calibre Cu"]);
  const iniG = r;
  N.TIERRA_EQUIPOS.forEach(([lim, cal]) => { ws.addRow([lim, N.etiquetaCalibre(cal)]); r++; });
  T.tierraLim = `Tablas!$A${iniG}:$A${r - 1}`; T.tierraCal = `Tablas!$B${iniG}:$B${r - 1}`;
  ws.eachRow((row) => row.eachCell((c) => { c.border = BORDES; if (!c.font?.bold) c.font = { size: 9 }; }));
  return ws;
}

import { ALCANCE } from "./rt-alcance.js";
// ---------------------------------------------------------------- estilo del libro
// Convención (la misma en todas las hojas):
//   amarillo con letra azul  = dato de entrada (desbloqueado, se puede cambiar)
//   gris con letra negra     = fórmula (bloqueada: se ve pero no se cambia)
//   verde / rojo             = resultado de una verificación (Cumple / No cumple)
const CLAVE_PROTECCION = "cinco";
const C_NAVY = "FF1F2732", C_NARANJA = "FFF5A623", C_AMARILLO = "FFFFF4CC", C_AZUL = "FF1F4E9A", C_GRIS = "FFF2F3F5", C_GRIS_TXT = "FF5C6570";
const C_SECCION = "FFE8ECF2", C_RESUMEN = "FFEAF6EE", C_VERDE_TXT = "FF1E7B45";
const relleno = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

// Formato numérico según la unidad (en vez de "General", que muestra 10 decimales).
function formatoUnidad(u = "") {
  const t = String(u);
  if (/^(A|V|kgf|N|h)$/.test(t)) return "#,##0.0";
  if (/^(kV|kVA|kW|kA|MVA|m|mm|°C|kV\/µs|N\/m|kg\/m|Pa|% rotura|p\.u\.)$/.test(t)) return "#,##0.00";
  if (t === "%") return "0.0";
  if (/^(Ω|Ω·m|s)$/.test(t)) return "0.0000";
  if (/^(m²|mm²)$/.test(t)) return "#,##0.0";
  if (t === "/año") return "0.00E+00";
  if (/^(kWh\/año|kWh|kWh\/kWp|W|W\/m²|\$\/kWh|años)$/.test(t)) return "#,##0";
  if (/^(kWp|MW|MVAr|h\/día|%\/°C|%\/año)$/.test(t)) return "#,##0.00";
  if (t === "$" || t === "COP/año") return '"$" #,##0';
  return "General";
}

// Constantes y factores fijos que usan las fórmulas de cada hoja: se explican
// en el encabezado para que nadie tenga que adivinar de dónde sale un número.
const CONSTANTES = {
  cargas: [["0,25", "", "Se suma el 25 % de la corriente del motor más grande a la corriente del alimentador", "NTC 2050 430-24"], ["0,90", "", "Factor de potencia mínimo de referencia (por debajo se cobra energía reactiva)", "Res. CREG 015 de 2018"], ["1000", "W/kW", "Conversión de vatios a kilovatios", ""]],
  conductores: [["1,25", "", "Las cargas continuas (3 h o más) se dimensionan al 125 %", "NTC 2050 210-19 y 215-2"], ["60 / 75 / 90", "°C", "Columnas de temperatura de la tabla de capacidad de corriente", "NTC 2050 Tabla 310-16"], ["Factores Ft y Fa", "", "Corrección por temperatura ambiente y por más de 3 conductores portadores en la misma canalización", "NTC 2050 Tabla 310-16 y 310-15(b)(2)"]],
  regulacion: [["√3 / 2", "", "Factor del sistema en la caída de tensión: √3 trifásico, 2 monofásico (ida y vuelta)", ""], ["3 / 2", "", "Número de conductores con pérdidas: 3 trifásico, 2 monofásico", ""]],
  canalizaciones: [["53 / 31 / 40", "%", "Llenado máximo: 1 conductor 53 %, 2 conductores 31 %, más de 2 conductores 40 %", "NTC 2050 Cap. 9 Tabla 1"]],
  transformador: [["1,5", "", "El fusible primario tipo K se elige cerca de 1,5 veces la corriente nominal primaria", "Práctica del operador de red"], ["1,25", "", "La protección del secundario no debe superar el 125 % de la corriente nominal", "NTC 2050 450-3(b)"]],
  trafoPotencia: [["c = 1,1", "", "Factor de tensión para el cortocircuito máximo en media y alta tensión", "IEC 60909-0 Tabla 1"], ["1,2", "", "Un TC soporta en forma permanente el 120 % de su corriente nominal (corriente térmica extendida)", "IEC 61869-2"], ["ALF", "", "Factor límite de precisión: un TC 5P20 mide bien hasta 20 veces su corriente nominal", "IEC 61869-2"]],
  cortocircuito: [["c", "", "Factor de tensión: 1,05 en BT (tolerancia +6 %) o 1,10 (BT +10 %, media y alta tensión)", "IEC 60909-0 Tabla 1"], ["1,1 (cmax)", "", "Factor de tensión máximo usado para la red equivalente y la corrección KT", "IEC 60909-0"], ["0,95 y 0,6", "", "Constantes de la corrección KT de la impedancia del transformador", "IEC 60909-0 ec. 12a"], ["1,02 / 0,98 / 3", "", "Constantes del factor κ para la corriente pico", "IEC 60909-0 ec. 55"], ["4", "", "La impedancia de secuencia cero de un cable se aproxima a 4 veces la de secuencia positiva", "IEC 60909-2"]],
  cableMT: [["K = 143 / 94", "A·√s/mm²", "Constante adiabática para conductor de cobre / aluminio con aislamiento XLPE o EPR (90 °C → 250 °C)", "IEC 60949"], ["K = 115 / 76", "A·√s/mm²", "Constante adiabática para aislamiento PVC (cobre / aluminio)", "IEC 60949"], ["0,017241 / 0,028264", "Ω·mm²/m", "Resistividad del cobre / aluminio a 20 °C (para la resistencia a 90 °C)", "IEC 60228"]],
  coordinacion: [["k y α", "", "Constantes de cada curva: SI 0,14 y 0,02; VI 13,5 y 1; EI 80 y 2; LTI 120 y 1", "IEC 60255-151"], ["CTI", "s", "Margen mínimo entre la protección principal y su respaldo (típico 0,2 a 0,4 s)", "IEEE 242"]],
  malla: [["1000", "Ω", "Resistencia del cuerpo humano", "IEEE 80-2013 §7"], ["0,116 / 0,157", "", "Constante de la persona de 50 kg / 70 kg en las tensiones tolerables", "IEEE 80-2013 ec. 29 a 32"], ["1,5 y 6", "", "Factores de la resistencia de los pies en contacto y en paso", "IEEE 80-2013"], ["0,09", "m", "Constante del factor Cs de la capa superficial", "IEEE 80-2013 ec. 27"], ["60", "Hz", "Frecuencia del sistema (constante de tiempo Ta = X/(2π·60·R))", ""], ["0,644 y 0,148", "", "Constantes del factor de irregularidad Ki", "IEEE 80-2013 ec. 89"]],
  rayos: [["3H", "m", "El área colectiva se extiende 3 veces la altura de la estructura", "IEC 62305-2 Anexo A"], ["40 · LL", "m²", "Área colectiva de la línea de servicio", "IEC 62305-2 Anexo A"], ["10⁻⁶", "", "Conversión de m² a km² (NG está en descargas por km² al año)", ""], ["8760", "h", "Horas de un año", ""], ["10⁻⁵", "", "Riesgo tolerable de pérdida de vidas humanas (R1)", "IEC 62305-2 Tabla 7"]],
  apantallamiento: [["2,2", "", "Constante de la corriente crítica Ic = 2,2 × BIL / Zs", "IEEE 998"], ["8 · k", "", "Distancia de impacto S = 8 k Ic^0,65 (k = 1,2 mástiles, 1 cables de guarda)", "IEEE 998"]],
  aislamiento: [["k", "", "Factor de falla a tierra: 1,3 neutro sólido, 1,4 efectivo, 1,73 aislado o no efectivo", "IEC 60071-2"], ["8150", "m", "Constante de la corrección por altitud Ka = e^(H/8150)", "IEC 60071-2"], ["300", "m/µs", "Velocidad de la onda en la línea", "IEC 60071-2"], ["20", "%", "Margen de protección mínimo recomendado", "IEEE C62.22"]],
  distancias: [["1,25 %", "", "Por cada 100 m por encima de 1000 m de altitud la distancia aumenta 1,25 %", "RETIE"]],
  fvArreglo: [["(NOCT − 20) / 800 × 1000", "°C", "Calentamiento de la celda sobre el ambiente con 1000 W/m² (método NOCT)", "IEC 61215"], ["1,25", "", "La corriente de cortocircuito del string se multiplica por 1,25 por irradiancias mayores que la de ensayo", "NTC 2050 690-8(a)"], ["25", "°C", "Temperatura de referencia de la ficha del módulo (condiciones STC)", "IEC 61215"]],
  fvProduccion: [["365", "días", "Días del año para la energía anual", ""], ["(NOCT − 20) / 800", "°C·m²/W", "Calentamiento de la celda por unidad de irradiancia", "IEC 61215"], ["Permuta y venta", "", "Los excedentes hasta igualar las importaciones se permutan (tarifa menos comercialización); los que las superan se venden a precio de bolsa", "CREG 174 de 2021"]],
  fvConductores: [["1,25 × 1,25 = 1,56", "", "DC: 125 % por irradiancia y 125 % adicional para el conductor y la protección", "NTC 2050 690-8"], ["1,25", "", "AC: la corriente nominal del inversor se toma al 125 % (carga continua)", "NTC 2050 690-8 y 215-2"], ["2 / √3", "", "Factor de la caída de tensión: 2 en DC y monofásico, √3 en trifásico", ""]],
  fvConexion: [["1 MW", "", "Potencia máxima de AGPE y GD", "CREG 174 de 2021"], ["0,1 MW", "", "Hasta esta potencia el AGPE sigue el procedimiento simplificado sin estudio de conexión", "CREG 174 de 2021"], ["1,1 a 1,5", "× In", "Aporte típico de un inversor a la corriente de cortocircuito", "Fichas de inversores / IEEE 1547"]],
  mecanico: [["9,80665", "m/s²", "Gravedad: convierte kgf a N", ""], ["24", "", "Constante de la ecuación de cambio de estado (método parabólico)", ""], ["8", "", "Flecha parabólica f = w L² / (8 T)", ""], ["50", "%", "Tensión máxima admisible: la mitad de la carga de rotura (factor de seguridad 2)", "Criterio de diseño"]]
};

// Nombres legibles de los rangos de la hoja "Tablas" para las explicaciones.
const NOMBRE_TABLA = { cond: "tabla de conductores (hoja Tablas)", temp: "factores de temperatura (hoja Tablas)", tempDesde: "rangos de temperatura (hoja Tablas)", agr: "factores de agrupamiento (hoja Tablas)", agrDesde: "rangos de agrupamiento (hoja Tablas)", prot: "corrientes normalizadas de protecciones (hoja Tablas)", fusK: "fusibles tipo K normalizados (hoja Tablas)", tub: "áreas de tuberías (hoja Tablas)", curvas: "curvas IEC (hoja Tablas)", tierraLim: "límites de protección (hoja Tablas)", tierraCal: "calibres de puesta a tierra (hoja Tablas)" };
const FUNCIONES = [["_xlfn.AGGREGATE", "AGREGAR"], ["ROUNDDOWN", "REDONDEAR.MENOS"], ["ROUNDUP", "REDONDEAR.MAS"], ["LEFT", "IZQUIERDA"], ["IFERROR", "SI.ERROR"], ["SUMPRODUCT", "SUMAPRODUCTO"], ["SUMIF", "SUMAR.SI"], ["COUNTIF", "CONTAR.SI"], ["VLOOKUP", "BUSCARV"], ["INDEX", "INDICE"], ["MATCH", "COINCIDIR"], ["ISNUMBER", "ESNUMERO"], ["ISTEXT", "ESTEXTO"], ["SEARCH", "HALLAR"], ["AVERAGE", "PROMEDIO"], ["ROUND", "REDONDEAR"], ["SQRT", "√"], ["EXP", "e^"], ["LN", "ln"], ["LEN", "LARGO"], ["AND", "Y"], ["OR", "O"], ["IF", "SI"], ["MAX", "MÁX"], ["MIN", "MÍN"], ["SUM", "SUMA"]];

// Traduce una fórmula de Excel a una explicación legible: las celdas se
// reemplazan por el nombre de la variable y las funciones por su nombre en
// español. cols = {letra: encabezado} cuando la fórmula es de una tabla.
function traducir(formula, hoja, { r = 0, cols = null } = {}) {
  const partes = String(formula).split('"');
  const nombres = [];
  const marca = (t) => `\u0001${nombres.push(t) - 1}\u0002`;
  const out = partes.map((p, i) => {
    if (i % 2) return marca(`"${p}"`); // texto entre comillas: intacto
    let s = p;
    for (const [k, ref] of Object.entries(T)) if (ref) s = s.split(ref).join(marca(`«${NOMBRE_TABLA[k] || k}»`));
    s = s.replace(/\$([A-Z]{1,2})\$(\d+)/g, (m, c, nn) => marca(`[${hoja.nombreCelda(c, Number(nn))}]`));
    s = s.replace(/\$([A-Z]{1,2})(\d+)/g, "$1$2"); // referencias mixtas ($E12)
    if (cols) {
      s = s.replace(/\b([A-Z]{1,2}):\1\b/g, (m, c) => (cols[c] ? marca(`[columna ${cols[c]}]`) : m));
      s = s.replace(/\b([A-Z]{1,2})(\d+)\b/g, (m, c, nn) => (cols[c] ? marca(`[${cols[c]}${Number(nn) === r ? "" : Number(nn) < r ? ", fila anterior" : `, fila ${nn}`}]`) : m));
    }
    s = s.replace(/PI\(\)/g, "π").replace(/\bFALSE\b/g, "FALSO").replace(/\bTRUE\b/g, "VERDADERO");
    for (const [en, es] of FUNCIONES) s = s.replace(new RegExp(`\\b${en}\\(`, "g"), `${es}(`);
    s = s.replace(/<=/g, " ≤ ").replace(/>=/g, " ≥ ").replace(/<>/g, " ≠ ").replace(/(?<![≤≥≠])([<>])(?!\s)/g, " $1 ").replace(/(?<![≤≥])=/g, " = ");
    s = s.replace(/\*/g, " × ").replace(/\//g, " ÷ ");
    s = s.replace(/,/g, "; ").replace(/(\d)\.(\d)/g, "$1,$2").replace(/1E-9/g, "0").replace(/\s+/g, " ");
    return s;
  });
  return out.join("").replace(/\u0001(\d+)\u0002/g, (m, k) => nombres[Number(k)]).trim();
}

// ---------------------------------------------------------------- hoja de cálculo con formato
// Identificación del cálculo que se está escribiendo (un módulo puede tener
// varios cálculos en el proyecto: la hoja lleva su etiqueta) y su módulo.
let etiquetaActual = "", moduloActual = "", proyectoActual = "";
const hojasCreadas = [];
const ULT = 8; // la explicación ocupa de la columna D a la H

class Hoja {
  constructor(wb, nombre, titulo, anchos = [46, 16, 11, 16, 14, 14, 14, 14]) {
    const limpio = (t) => String(t).replace(/[\\/?*[\]:]/g, "-");
    const base = limpio(etiquetaActual ? `${nombre} ${etiquetaActual}` : nombre).slice(0, 31);
    let nombreHoja = base, k = 2;
    while (wb.getWorksheet(nombreHoja)) nombreHoja = `${base.slice(0, 27)} (${k++})`;
    const ws = (this.ws = wb.addWorksheet(nombreHoja, { properties: { tabColor: { argb: C_NARANJA } }, pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } } }));
    ws.columns = anchos.map((w) => ({ width: w }));
    this.etq = new Map(); this.celdas = new Map(); this.altos = []; this.verifs = []; this.necesitaEncabezado = false;
    hojasCreadas.push(this);
    const mod = MODULOS[moduloActual] || {};
    // Franja de título.
    ws.mergeCells(1, 1, 1, ULT);
    const t = ws.getCell("A1");
    t.value = etiquetaActual ? `${titulo} — ${etiquetaActual}` : titulo;
    t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; t.fill = relleno(C_NAVY); t.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(1).height = 30;
    ws.mergeCells(2, 1, 2, ULT);
    const s = ws.getCell("A2");
    s.value = proyectoActual; s.font = { italic: true, size: 10, color: { argb: C_GRIS_TXT } }; s.alignment = { indent: 1 };
    this.r = 3;
    this.parrafo("¿Qué calcula esta hoja?", mod.objeto || "");
    this.parrafo("Normas aplicadas", (mod.normas || []).join(" · "));
    const alc = ALCANCE[moduloActual];
    if (alc) this.parrafo("Alcance y limitaciones", `${alc.metodo} Limitaciones: ${alc.limitaciones.join(" ")}`);
    // Leyenda de colores.
    const lr = this.r++;
    ws.getCell(`A${lr}`).value = "Cómo leer esta hoja"; ws.getCell(`A${lr}`).font = { bold: true, size: 10, color: { argb: C_NAVY } }; ws.getCell(`A${lr}`).alignment = { vertical: "middle" };
    const muestra = (col, txt, fill, color) => { const c = ws.getCell(`${col}${lr}`); c.value = txt; c.fill = relleno(fill); c.font = { size: 9, bold: true, color: { argb: color } }; c.alignment = { horizontal: "center", vertical: "middle" }; c.border = BORDES; };
    muestra("B", "Dato de entrada", C_AMARILLO, C_AZUL); muestra("C", "Fórmula", C_GRIS, "FF000000");
    ws.mergeCells(lr, 4, lr, ULT);
    const ley = ws.getCell(`D${lr}`);
    ley.value = "Cambie solo las celdas amarillas: las grises se recalculan solas y están protegidas. «Cumple» sale en verde y «No cumple» en rojo. La columna «Cómo se calcula» explica cada fórmula con el nombre de sus variables.";
    ley.font = { size: 9, color: { argb: C_GRIS_TXT } }; ley.alignment = { wrapText: true, vertical: "middle" };
    this.altos.push({ row: lr, texto: ley.value, desde: 4, size: 9 });
    // Constantes de la hoja.
    const cons = CONSTANTES[moduloActual];
    if (cons?.length) {
      this.banda("Constantes y factores que usan las fórmulas");
      this.encabezado(["Constante o factor", "Unidad", "", "Qué significa y de dónde sale"]);
      ws.mergeCells(this.r - 1, 2, this.r - 1, 3);
      cons.forEach(([valor, unidad, sig, fuente]) => {
        const rr = this.r++;
        ws.getCell(`A${rr}`).value = valor; ws.getCell(`B${rr}`).value = unidad;
        ws.mergeCells(rr, 2, rr, 3);
        ws.mergeCells(rr, 4, rr, ULT);
        const d = ws.getCell(`D${rr}`); d.value = fuente ? `${sig} (${fuente})` : sig;
        [1, 2, 3, 4].forEach((ci) => { const c = ws.getCell(rr, ci); c.border = BORDES; c.font = { size: 9 }; c.alignment = { wrapText: true, vertical: "top" }; });
        ws.getCell(`A${rr}`).font = { size: 9.5, bold: true };
        ws.getCell(`B${rr}`).alignment = { horizontal: "center", vertical: "top" };
        this.altos.push({ row: rr, texto: d.value, desde: 4, size: 9 });
      });
    }
    this.banda("Datos de entrada");
    this.necesitaEncabezado = true;
    this.inicioDatos = this.r;
  }
  parrafo(titulo, texto) {
    const ws = this.ws, rr = this.r++;
    ws.getCell(`A${rr}`).value = titulo; ws.getCell(`A${rr}`).font = { bold: true, size: 10, color: { argb: C_NAVY } }; ws.getCell(`A${rr}`).alignment = { vertical: "top" };
    ws.mergeCells(rr, 2, rr, ULT);
    const c = ws.getCell(`B${rr}`); c.value = texto; c.font = { size: 10 }; c.alignment = { wrapText: true, vertical: "top" };
    this.altos.push({ row: rr, texto, desde: 2, size: 10 });
  }
  banda(texto) {
    const ws = this.ws;
    this.r++;
    const rr = this.r++;
    ws.mergeCells(rr, 1, rr, ULT);
    const c = ws.getCell(`A${rr}`);
    c.value = texto; c.font = { bold: true, size: 11, color: { argb: C_NAVY } }; c.fill = relleno(C_SECCION); c.alignment = { vertical: "middle", indent: 1 };
    c.border = { left: { style: "thick", color: { argb: C_NARANJA } } };
    ws.getRow(rr).height = 20;
  }
  encabezado(textos) {
    const ws = this.ws, rr = this.r++;
    textos.forEach((t, i) => {
      const c = ws.getCell(rr, i + 1); c.value = t;
      c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } }; c.fill = relleno(C_NAVY); c.alignment = { wrapText: true, vertical: "middle" }; c.border = BORDES;
    });
    if (textos.length === 4) ws.mergeCells(rr, 4, rr, ULT);
  }
  nota(texto) {
    const ws = this.ws, rr = this.r++;
    ws.mergeCells(rr, 1, rr, ULT);
    const c = ws.getCell(`A${rr}`); c.value = `ℹ ${texto}`; c.font = { italic: true, size: 9, color: { argb: C_GRIS_TXT } }; c.alignment = { wrapText: true };
    this.altos.push({ row: rr, texto, desde: 1, size: 9 });
  }
  seccion(texto) { this.banda(texto); this.necesitaEncabezado = true; }
  nombreCelda(c, fila) { return c === "B" && this.etq.has(fila) ? this.etq.get(fila) : this.celdas.get(`${c}${fila}`) || `${c}${fila}`; }
  // Fila "Parámetro | valor | unidad | cómo se calcula" — devuelve la dirección del valor.
  fila(etiqueta, valor, unidad = "", nota = "", entrada = false, explicacion = null) {
    const ws = this.ws;
    if (this.necesitaEncabezado) { this.encabezado(["Parámetro", "Valor", "Unidad", "Cómo se calcula / observaciones"]); this.necesitaEncabezado = false; }
    const rr = this.r++;
    const esFormula = typeof valor === "string" && valor.startsWith("=");
    this.etq.set(rr, String(etiqueta).replace(/\s+/g, " "));
    const a = ws.getCell(`A${rr}`); a.value = etiqueta; a.alignment = { wrapText: true, vertical: "top" }; a.font = { size: 10 };
    const c = ws.getCell(`B${rr}`);
    c.value = esFormula ? { formula: valor.slice(1) } : valor;
    c.fill = relleno(entrada ? C_AMARILLO : C_GRIS);
    c.font = entrada ? { bold: true, color: { argb: C_AZUL }, size: 10 } : { size: 10 };
    c.numFmt = typeof valor === "string" && !esFormula ? "@" : esFormula && !unidad ? "[<0.001]0.00E+00;#,##0.0000" : formatoUnidad(unidad);
    c.alignment = { horizontal: "right", vertical: "top" };
    if (entrada) c.protection = { locked: false };
    const u = ws.getCell(`C${rr}`); u.value = unidad; u.alignment = { horizontal: "center", vertical: "top" }; u.font = { size: 9, color: { argb: C_GRIS_TXT } };
    ws.mergeCells(rr, 4, rr, ULT);
    const d = ws.getCell(`D${rr}`);
    const expl = explicacion ?? (esFormula ? `= ${traducir(valor.slice(1), this)}` : "Dato de entrada");
    d.value = [expl, nota].filter(Boolean).join(" — ");
    d.font = { size: 9, color: { argb: esFormula ? "FF333A44" : C_GRIS_TXT } }; d.alignment = { wrapText: true, vertical: "top" };
    [1, 2, 3, 4].forEach((ci) => { ws.getCell(rr, ci).border = BORDES; });
    this.altos.push({ row: rr, texto: d.value, desde: 4, size: 9, etiqueta: String(etiqueta) });
    return `$B$${rr}`;
  }
  dato(etiqueta, valor, unidad, nota) { return this.fila(etiqueta, valor, unidad, nota, true); }
  calc(etiqueta, formula, unidad, nota) { return this.fila(etiqueta, `=${formula}`, unidad, nota, false); }
  verif(etiqueta, condicion, nota) {
    const ref = this.fila(etiqueta, `=IF(${condicion},"Cumple","No cumple")`, "", nota, false, `Se cumple cuando ${traducir(condicion, this)}`);
    this.ws.getCell(ref.replace(/\$/g, "")).font = { bold: true, size: 10 };
    this.ws.getCell(ref.replace(/\$/g, "")).alignment = { horizontal: "center", vertical: "top" };
    this.verifs.push(ref);
    return ref;
  }
  // Tabla por filas. columnas: [{t: encabezado, ancho, v: (fila, r) => valor | "=fórmula", entrada, fmt, lista}]
  tabla(columnas, datos) {
    const ws = this.ws;
    this.necesitaEncabezado = false;
    const r0 = this.r;
    const cols = {};
    columnas.forEach((c, i) => {
      cols[col(i)] = c.t;
      const cel = ws.getCell(r0, i + 1);
      cel.value = c.t; cel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cel.fill = relleno(c.entrada ? "FF2E5A9C" : C_NAVY);
      cel.alignment = { wrapText: true, vertical: "middle", horizontal: "center" }; cel.border = BORDES;
      if (c.ancho && (ws.getColumn(i + 1).width || 0) < c.ancho) ws.getColumn(i + 1).width = c.ancho;
    });
    ws.getRow(r0).height = 32;
    datos.forEach((d, k) => {
      const r = r0 + 1 + k;
      const nombreFila = String(columnas[0].v(d, r) ?? "").replace(/^=.*/, `fila ${k + 1}`);
      columnas.forEach((c, i) => {
        const v = c.v(d, r), cel = ws.getCell(r, i + 1);
        const esF = typeof v === "string" && v.startsWith("=");
        this.celdas.set(`${col(i)}${r}`, `${c.t} de «${nombreFila}»`);
        cel.value = esF ? { formula: v.slice(1) } : v;
        cel.border = BORDES;
        cel.font = c.entrada ? { size: 9, bold: true, color: { argb: C_AZUL } } : { size: 9 };
        cel.fill = relleno(c.entrada ? C_AMARILLO : esF ? C_GRIS : "FFFFFFFF");
        cel.alignment = { vertical: "top", wrapText: i === 0 || typeof v === "string" && !esF };
        if (c.entrada) cel.protection = { locked: false };
        if (c.lista) cel.dataValidation = { type: "list", allowBlank: true, formulae: [`"${c.lista.join(",")}"`], showErrorMessage: true, errorTitle: "Valor no válido", error: `Elija uno de: ${c.lista.join(", ")}` };
        if (typeof v === "string" && !esF) cel.numFmt = "@";
        else if (c.fmt) cel.numFmt = c.fmt;
      });
    });
    const r1 = r0 + datos.length;
    // Columnas de resultado: entran en el estado general de la hoja.
    columnas.forEach((c, i) => { if (/^(Resultado|≤ 50|Margen)/.test(c.t) && datos.length) this.verifs.push(`${col(i)}${r0 + 1}:${col(i)}${r1}`); });
    this.r = r1 + 1;
    // Cómo se calcula cada columna con fórmula (con la primera fila; si las
    // siguientes cambian, también se explican).
    const formulas = columnas.map((c, i) => ({ c, i })).filter(({ c }) => datos.length && typeof c.v(datos[0], r0 + 1) === "string" && String(c.v(datos[0], r0 + 1)).startsWith("="));
    if (formulas.length) {
      const rr = this.r++;
      ws.mergeCells(rr, 1, rr, ULT);
      const tt = ws.getCell(`A${rr}`); tt.value = "Cómo se calcula cada columna de la tabla:"; tt.font = { bold: true, size: 9, color: { argb: C_NAVY } };
      formulas.forEach(({ c, i }) => {
        const f1 = traducir(String(c.v(datos[0], r0 + 1)).slice(1), this, { r: r0 + 1, cols });
        const f2 = datos.length > 1 ? traducir(String(c.v(datos[1], r0 + 2)).slice(1), this, { r: r0 + 2, cols }) : f1;
        const texto = f2 !== f1 ? `primera fila: = ${f1}; filas siguientes: = ${f2}` : `= ${f1}`;
        const fr = this.r++;
        ws.getCell(`A${fr}`).value = `• ${c.t}`; ws.getCell(`A${fr}`).font = { size: 9, bold: true }; ws.getCell(`A${fr}`).alignment = { vertical: "top", wrapText: true };
        ws.mergeCells(fr, 2, fr, ULT);
        const e = ws.getCell(`B${fr}`); e.value = texto; e.font = { size: 9, color: { argb: "FF333A44" } }; e.alignment = { wrapText: true, vertical: "top" };
        this.altos.push({ row: fr, texto, desde: 2, size: 9 });
        void i;
      });
    }
    this.r++;
    return { r0: r0 + 1, r1, col: (k) => col(columnas.findIndex((c) => c.k === k)) };
  }
  // Resumen de la selección (al final de la hoja): fórmulas vivas que leen
  // los resultados de arriba. items: [{t, f: fórmula o referencia, u, texto}]
  resumen(items) {
    const ws = this.ws;
    this.banda("Resumen de la selección");
    items.filter(Boolean).forEach((it) => {
      const rr = this.r++;
      const a = ws.getCell(`A${rr}`); a.value = it.t; a.font = { bold: true, size: 10 }; a.alignment = { wrapText: true, vertical: "top" };
      const f = String(it.f).replace(/^=/, "");
      if (it.texto) {
        ws.mergeCells(rr, 2, rr, ULT);
        const c = ws.getCell(`B${rr}`); c.value = it.valor !== undefined ? it.valor : { formula: f };
        c.font = { size: 10, color: { argb: C_VERDE_TXT }, bold: true }; c.fill = relleno(C_RESUMEN); c.alignment = { wrapText: true, vertical: "top" };
        this.altos.push({ row: rr, texto: "x".repeat(110), desde: 2, size: 10 });
      } else {
        const c = ws.getCell(`B${rr}`); c.value = { formula: f }; c.numFmt = it.fmt || formatoUnidad(it.u);
        c.font = { size: 11, bold: true, color: { argb: C_VERDE_TXT } }; c.fill = relleno(C_RESUMEN); c.alignment = { horizontal: "right" };
        ws.getCell(`C${rr}`).value = it.u || ""; ws.getCell(`C${rr}`).alignment = { horizontal: "center" };
        ws.mergeCells(rr, 4, rr, ULT);
        const d = ws.getCell(`D${rr}`); d.value = it.nota || ""; d.font = { size: 9, color: { argb: C_GRIS_TXT } }; d.alignment = { wrapText: true };
      }
      [1, 2, 3, 4].forEach((ci) => { ws.getCell(rr, ci).border = BORDES; });
    });
    if (this.verifs.length) {
      const rr = this.r++;
      const cuenta = `SUM(${this.verifs.map((v) => `COUNTIF(${v.replace(/\$/g, "")},"No cumple*")`).join(",")})`;
      const a = ws.getCell(`A${rr}`); a.value = "Estado de las verificaciones de esta hoja"; a.font = { bold: true, size: 10 };
      ws.mergeCells(rr, 2, rr, ULT);
      const c = ws.getCell(`B${rr}`);
      c.value = { formula: `IF(${cuenta}>0,"No cumple: "&${cuenta}&" criterio(s) en rojo deben revisarse","Cumple: todos los criterios verificados en esta hoja se cumplen")` };
      c.font = { bold: true, size: 11 }; c.alignment = { wrapText: true };
      [1, 2].forEach((ci) => { ws.getCell(rr, ci).border = BORDES; });
    }
  }
  // Alturas de filas con texto largo, colores de Cumple/No cumple y vista.
  finalizar() {
    const ws = this.ws;
    const ancho = (desde) => { let w = 0; for (let ci = desde; ci <= ULT; ci++) w += ws.getColumn(ci).width || 10; return w; };
    this.altos.forEach(({ row, texto, desde, size, etiqueta }) => {
      const lineas = Math.max(1, Math.ceil(String(texto).length / (ancho(desde) * (size >= 10 ? 1.12 : 1.32))), etiqueta ? Math.ceil(etiqueta.length / ((ws.getColumn(1).width || 40) * 1.1)) : 1);
      ws.getRow(row).height = Math.max(ws.getRow(row).height || 0, 15 * lineas + 2);
    });
    const ref = `A1:${col(Math.max(ws.columnCount, ULT) - 1)}${Math.max(ws.rowCount, 1)}`;
    ws.addConditionalFormatting({ ref, rules: [
      { type: "expression", priority: 1, formulae: ['LEFT(A1,9)="No cumple"'], style: { font: { color: { argb: "FFB42318" }, bold: true }, fill: relleno("FFFDECEC") } },
      { type: "expression", priority: 2, formulae: ['A1="No protegido"'], style: { font: { color: { argb: "FFB42318" }, bold: true }, fill: relleno("FFFDECEC") } },
      { type: "expression", priority: 3, formulae: ['OR(A1="Cumple",LEFT(A1,8)="Cumple (",LEFT(A1,7)="Cumple:",A1="Protegido")'], style: { font: { color: { argb: C_VERDE_TXT }, bold: true }, fill: relleno("FFE6F4EA") } },
      { type: "expression", priority: 4, formulae: ['LEFT(A1,13)="Captador a <="'], style: { font: { color: { argb: "FF8A5A00" }, bold: true }, fill: relleno("FFFFF4E0") } }
    ] });
    ws.views = [{ state: "frozen", ySplit: 2, showGridLines: false }];
  }
}
const sigNormTierra = (x) => `IFERROR(INDEX(${T.tierraCal},MATCH(${x}-1E-9,${T.tierraLim},1)+1),INDEX(${T.tierraCal},1))`;
const sigNorm = (x, rango) => `IFERROR(INDEX(${rango},MATCH(${x}-1E-9,${rango},1)+1),INDEX(${rango},1))`;
const vacias = (arr) => (arr || []).filter((f) => f && Object.values(f).some((v) => v !== "" && v != null));

// ---------------------------------------------------------------- hojas por módulo
const HOJAS = {
  cargas(wb, e) {
    const h = new Hoja(wb, "c-Cargas", "Cuadro de cargas y demanda (RETIE literal c; NTC 2050 Sección 220)");
    const sis = SISTEMAS_BT[e.sistema] || SISTEMAS_BT["3F208"];
    const vln = h.dato("Tensión fase-neutro", sis.VLN, "V", sis.nombre), vll = h.dato("Tensión línea-línea", sis.VLL, "V");
    const fasesSis = h.dato("Fases del sistema", sis.fases.join(""), "", "Letras de las fases disponibles");
    h.seccion("Circuitos");
    const filas = vacias(e.circuitos);
    const t = h.tabla([
      { t: "Circ.", v: (f) => String(f.circuito ?? ""), entrada: true, ancho: 7 }, { t: "Descripción", v: (f) => String(f.descripcion ?? ""), entrada: true, ancho: 26 },
      { t: "Tipo", k: "tipo", v: (f) => String(f.tipo ?? ""), entrada: true, lista: ["Alumbrado", "Tomas", "Fuerza", "Motor", "Especial"] }, { t: "Cant.", k: "cant", v: (f) => n(f.cantidad, 1), entrada: true },
      { t: "P unit. (W)", k: "pu", v: (f) => n(f.potencia), entrada: true }, { t: "fp", k: "fp", v: (f) => n(f.fp, 0.9), entrada: true },
      { t: "FD (%)", k: "fd", v: (f) => n(f.fd, 100), entrada: true }, { t: "Fases", k: "fs", v: (f) => String(f.fases || "A"), entrada: true, lista: ["A", "B", "C", "AB", "BC", "CA", "ABC"] },
      { t: "P inst. (W)", k: "p", v: (f, r) => `=D${r}*E${r}`, fmt: "#,##0" }, { t: "S inst. (VA)", k: "s", v: (f, r) => `=I${r}/F${r}`, fmt: "#,##0" },
      { t: "S dem. (VA)", k: "sd", v: (f, r) => `=J${r}*G${r}/100`, fmt: "#,##0" },
      { t: "Fase A (VA)", v: (f, r) => `=IF(ISNUMBER(SEARCH("A",H${r})),K${r}/LEN(H${r}),0)`, fmt: "#,##0" },
      { t: "Fase B (VA)", v: (f, r) => `=IF(ISNUMBER(SEARCH("B",H${r})),K${r}/LEN(H${r}),0)`, fmt: "#,##0" },
      { t: "Fase C (VA)", v: (f, r) => `=IF(ISNUMBER(SEARCH("C",H${r})),K${r}/LEN(H${r}),0)`, fmt: "#,##0" },
      { t: "I motor (A)", v: (f, r) => `=IF(C${r}="Motor",J${r}/IF(LEN(H${r})=3,SQRT(3)*${vll},IF(LEN(H${r})=2,${vll},${vln})),0)`, fmt: "0.0" }
    ], filas);
    const R = (c) => `${c}${t.r0}:${c}${t.r1}`;
    h.seccion("Resultados");
    const sInst = h.calc("Carga instalada", `SUM(${R("J")})/1000`, "kVA");
    const demMax = h.calc("Demanda máxima", `SUM(${R("K")})/1000`, "kVA");
    const ia = h.calc("Corriente fase A", `SUM(${R("L")})/${vln}`, "A"), ib = h.calc("Corriente fase B", `SUM(${R("M")})/${vln}`, "A"), ic = h.calc("Corriente fase C", `SUM(${R("N")})/${vln}`, "A");
    const lista = `IF(LEN(${fasesSis})=1,${ia},IF(LEN(${fasesSis})=2,MAX(${ia},${ib}),MAX(${ia},${ib},${ic})))`;
    const imax = h.calc("Corriente de la fase más cargada", lista, "A");
    const des = h.calc("Desbalance entre fases", `IF(LEN(${fasesSis})=1,0,IF(LEN(${fasesSis})=2,(MAX(${ia},${ib})-MIN(${ia},${ib}))/AVERAGE(${ia},${ib}),(MAX(${ia},${ib},${ic})-MIN(${ia},${ib},${ic}))/AVERAGE(${ia},${ib},${ic})))*100`, "%");
    const ialim = h.calc("Corriente de diseño del alimentador", `${imax}+0.25*MAX(${R("O")})`, "A", "NTC 2050 430-24");
    const dmax = h.dato("Desbalance máximo admisible", n(e.desbalanceMax, 10), "%");
    h.verif("Verificación del desbalance", `${des}<=${dmax}`, "Criterio de diseño");
    h.verif("Factor de potencia promedio ≥ 0,90", `SUMPRODUCT(${R("I")},${R("G")})/100/SUM(${R("K")})>=0.9`, "Referencia Res. CREG 015 de 2018");
    h.resumen([{ t: "Carga instalada", f: sInst, u: "kVA" }, { t: "Demanda máxima de diseño", f: demMax, u: "kVA", nota: "Base para dimensionar el transformador (literal h)" }, { t: "Corriente de diseño del alimentador", f: ialim, u: "A", nota: "Base para seleccionar el conductor y la protección del alimentador" }, { t: "Desbalance entre fases", f: des, u: "%" }]);
  },
  conductores(wb, e, r, p) {
    const h = new Hoja(wb, "k-m Conductores", "Selección de conductores y protecciones (RETIE literales k y m; NTC 2050)");
    h.nota("El calibre adoptado es el que seleccionó AHÍNCO; cámbielo y la hoja verifica de nuevo capacidad, terminales y protección.");
    const sel = r?.tablas?.[0]?.filas || [];
    const filas = vacias(e.circuitos).map((f, i) => ({ ...f, cal: String(sel[i]?.[4] || "").replace(/ (AWG|kcmil)$/, "") || "4/0" }));
    const colAmp = (rr, tcol) => `IF($E${rr}="Al",4,1)+MATCH(${tcol}${rr},{60,75,90},0)`;
    const t = h.tabla([
      { t: "Circ.", v: (f) => String(f.circuito ?? ""), entrada: true, ancho: 7 }, { t: "Descripción", v: (f) => String(f.descripcion ?? ""), entrada: true, ancho: 22 },
      { t: "I carga (A)", v: (f) => n(f.corriente), entrada: true }, { t: "Continua", v: (f) => String(f.continua || "Sí"), entrada: true, lista: ["Sí", "No"] },
      { t: "Mat.", v: (f) => (f.material === "Al" ? "Al" : "Cu"), entrada: true, lista: ["Cu", "Al"] }, { t: "T aisl.", v: (f) => n(f.tAisl, 90), entrada: true, lista: [60, 75, 90] },
      { t: "T term.", v: (f) => n(f.tTerm, 75), entrada: true, lista: [60, 75] }, { t: "Portad.", v: (f) => n(f.portadores, 3), entrada: true },
      { t: "T amb.", v: (f) => n(f.tAmb, n(p.tempAmbiente, 30)), entrada: true }, { t: "Calibre", v: (f) => f.cal, entrada: true },
      { t: "Ft", v: (f, rr) => `=INDEX(${T.temp},MATCH(I${rr},${T.tempDesde},1),MATCH(F${rr},{60,75,90},0)+1)`, fmt: "0.00" },
      { t: "Fa", v: (f, rr) => `=INDEX(${T.agr},MATCH(H${rr},${T.agrDesde},1),2)`, fmt: "0.00" },
      { t: "I diseño (A)", v: (f, rr) => `=C${rr}*IF(D${rr}="Sí",1.25,1)`, fmt: "0.0" },
      { t: "Ampac. aisl. corregida", v: (f, rr) => `=VLOOKUP(J${rr},${T.cond},${colAmp(rr, "F")},FALSE)*K${rr}*L${rr}`, fmt: "0.0" },
      { t: "Ampac. terminales", v: (f, rr) => `=VLOOKUP(J${rr},${T.cond},${colAmp(rr, "G")},FALSE)`, fmt: "0" },
      { t: "Ampac. final", v: (f, rr) => `=MIN(N${rr},O${rr})`, fmt: "0.0" },
      { t: "In protección (A)", v: (f, rr) => `=${sigNorm(`M${rr}`, T.prot)}`, fmt: "0" },
      { t: "In máx. permitida", v: (f, rr) => `=IFERROR(VLOOKUP(J${rr},${T.cond},IF(E${rr}="Al",16,15),FALSE)*1,0)+0`, fmt: "0" },
      { t: "Límite aplicado", v: (f, rr) => `=IF(R${rr}>0,R${rr},${sigNorm(`P${rr}`, T.prot)})`, fmt: "0" },
      { t: "Icc (kA)", v: (f) => n(f.icc, 0), entrada: true }, { t: "Icu (kA)", v: (f) => n(f.icu, 0), entrada: true },
      { t: "Resultado", v: (f, rr) => `=IF(AND(O${rr}>=M${rr},N${rr}>=C${rr},Q${rr}<=S${rr},OR(T${rr}=0,U${rr}>=T${rr})),"Cumple","No cumple")`, ancho: 11 }
    ], filas);
    h.resumen(filas.map((f, i) => { const rr = t.r0 + i; return { t: `Circuito ${f.circuito || i + 1}`, texto: true, f: `A${rr}&" — "&B${rr}&": conductor "&J${rr}&" "&E${rr}&" ("&F${rr}&" °C), protección de "&Q${rr}&" A; capacidad final del conductor "&ROUND(P${rr},0)&" A"` }; }));
  },
  regulacion(wb, e) {
    const h = new Hoja(wb, "o-p Regulación", "Regulación de tensión y pérdidas (RETIE literales o y p)");
    const tri = e.sistema !== "1F";
    const V = h.dato("Tensión nominal", n(e.tension, 208), "V", tri ? "Trifásico (línea-línea)" : "Monofásico");
    const k = h.dato("Factor del sistema k", tri ? Math.sqrt(3) : 2, "", "√3 trifásico; 2 monofásico"), kp = h.dato("Factor de pérdidas", tri ? 3 : 2, "", "3 trifásico; 2 monofásico");
    const fp = h.dato("Factor de potencia", n(e.fp, 0.9), ""), sen = h.calc("sen φ", `SQRT(1-${fp}^2)`, "");
    const lp = h.dato("Regulación máxima por tramo", n(e.limiteParcial, 3), "%"), lt = h.dato("Regulación máxima acumulada", n(e.limiteTotal, 5), "%");
    h.seccion("Tramos");
    const filas = vacias(e.tramos).map((f) => ({ ...f, z: impedanciaConductor(f.conductor, f.canalizacion, n(f.dmg, 1000)) }));
    const t = h.tabla([
      { t: "Tramo", v: (f) => String(f.tramo ?? ""), entrada: true }, { t: "Desde", v: (f) => String(f.desde ?? ""), entrada: true }, { t: "Hasta", v: (f) => String(f.hasta ?? ""), entrada: true },
      { t: "L (m)", v: (f) => n(f.longitud), entrada: true }, { t: "S (kVA)", v: (f) => n(f.carga), entrada: true }, { t: "Conductor", v: (f) => f.z.nombre, ancho: 22 },
      { t: "R (Ω/km)", v: (f) => f.z.R, entrada: true, fmt: "0.0000" }, { t: "X (Ω/km)", v: (f) => f.z.X, entrada: true, fmt: "0.0000" }, { t: "Paralelos", v: (f) => n(f.paralelos, 1), entrada: true },
      { t: "I (A)", v: (f, rr) => `=E${rr}*1000/(${tri ? `SQRT(3)*${V}` : V})`, fmt: "0.0" },
      { t: "ΔV (V)", v: (f, rr) => `=${k}*J${rr}*D${rr}/1000*(G${rr}*${fp}+H${rr}*${sen})/I${rr}`, fmt: "0.00" },
      { t: "ΔV (%)", v: (f, rr) => `=K${rr}/${V}*100`, fmt: "0.00" },
      { t: "ΔV acum. (%)", v: (f, rr) => `=L${rr}+IFERROR(INDEX(M:M,MATCH(B${rr},C:C,0)),0)`, fmt: "0.00" },
      { t: "Pérdidas (kW)", v: (f, rr) => `=${kp}*J${rr}^2*G${rr}*D${rr}/1000/I${rr}/1000`, fmt: "0.000" },
      { t: "Pérdidas (%)", v: (f, rr) => `=IF(E${rr}>0,N${rr}/(E${rr}*${fp})*100,0)`, fmt: "0.00" },
      { t: "Resultado", v: (f, rr) => `=IF(AND(L${rr}<=${lp},M${rr}<=${lt}),"Cumple","No cumple")` }
    ], filas);
    const perd = h.calc("Pérdidas totales", `SUM(N${t.r0}:N${t.r1})`, "kW");
    h.resumen([{ t: "Regulación acumulada máxima", f: `MAX(M${t.r0}:M${t.r1})`, u: "%", nota: "Debe ser menor que el límite de regulación acumulada" }, { t: "Pérdidas totales de potencia", f: perd, u: "kW" }, ...filas.map((f, i) => ({ t: `Tramo ${f.tramo || i + 1}`, texto: true, f: `F${t.r0 + i}&" — "&D${t.r0 + i}&" m, caída "&ROUND(L${t.r0 + i},2)&" % (acumulada "&ROUND(M${t.r0 + i},2)&" %)"` }))]);
  },
  canalizaciones(wb, e, r) {
    const h = new Hoja(wb, "n Canalizaciones", "Canalizaciones — llenado de ductos (RETIE literal n; NTC 2050 Cap. 9)");
    const filas = vacias(e.conductores);
    h.seccion("Conductores");
    const t = h.tabla([
      { t: "Ducto", v: (f) => String(f.ducto || "Ducto 1"), entrada: true, ancho: 14 }, { t: "Calibre", v: (f) => String(f.calibre || "12"), entrada: true },
      { t: "Cantidad", v: (f) => n(f.cantidad, 1), entrada: true }, { t: "Área (mm²)", v: (f, rr) => `=VLOOKUP(B${rr},${T.cond},14,FALSE)*C${rr}`, fmt: "0.0" }
    ], filas);
    h.seccion("Ductos");
    const ductos = (r?.tablas?.[0]?.filas || []).map((f) => ({ ducto: f[0], tipo: Object.keys(N.TUBERIAS).find((k) => N.TUBERIAS[k].nombre === f[1]) || "PVC40", tam: String(f[7] || "").replace(/"$/, "") }));
    const rng = (c) => `$${c}$${t.r0}:$${c}$${t.r1}`;
    const t2 = h.tabla([
      { t: "Ducto", v: (d) => d.ducto, ancho: 14 }, { t: "Tipo (EMT/IMC/PVC40)", v: (d) => d.tipo, entrada: true, lista: ["EMT", "IMC", "PVC40"] }, { t: "Tamaño adoptado", v: (d) => d.tam, entrada: true },
      { t: "N.º conductores", v: (d, rr) => `=SUMIF(${rng("A")},A${rr},${rng("C")})` }, { t: "Área cond. (mm²)", v: (d, rr) => `=SUMIF(${rng("A")},A${rr},${rng("D")})`, fmt: "0.0" },
      { t: "Llenado máx. (%)", v: (d, rr) => `=IF(D${rr}=1,53,IF(D${rr}=2,31,40))` },
      { t: "Área tubería (mm²)", v: (d, rr) => `=VLOOKUP(C${rr},${T.tub},MATCH(B${rr},{"EMT","IMC","PVC40"},0)+1,FALSE)` },
      { t: "Llenado (%)", v: (d, rr) => `=E${rr}/G${rr}*100`, fmt: "0.0" }, { t: "Resultado", v: (d, rr) => `=IF(H${rr}<=F${rr},"Cumple","No cumple")` }
    ], ductos);
    h.resumen(ductos.map((d, i) => { const rr = t2.r0 + i; return { t: `Ducto ${d.ducto}`, texto: true, f: `"Tubería "&B${rr}&" de "&C${rr}&" pulgadas con "&D${rr}&" conductores: llenado "&ROUND(H${rr},1)&" % (máximo "&F${rr}&" %)"` }; }));
  },
  transformador(wb, e, r, p, ctx) {
    const h = new Hoja(wb, "h Transformador", "Dimensionamiento del transformador (RETIE literal h; NTC 818/819; NTC 2050 450-3)");
    const s = r?.salidas || {};
    const tri = e.tipo !== "monofasico";
    const dem = h.dato("Demanda máxima", n(e.demanda, ctx.cargas?.sDemKVA ?? 0), "kVA");
    const cre = h.dato("Reserva por crecimiento", n(e.crecimiento, 20), "%");
    const sreq = h.calc("Potencia requerida", `${dem}*(1+${cre}/100)`, "kVA");
    const sn = h.dato("Potencia normalizada adoptada", s.sn ?? 0, "kVA", tri ? "NTC 819" : "NTC 818");
    const vp = h.dato("Tensión primaria", n(e.vPrimario, 13.2), "kV"), vs = h.dato("Tensión secundaria", n(e.vSecundario, 208), "V");
    const z = h.dato("Impedancia de cortocircuito", s.z ?? 4, "%");
    const raiz = tri ? "SQRT(3)*" : "";
    const ip = h.calc("Corriente nominal primaria", `${sn}*1000/(${raiz}${vp}*1000)`, "A"), is = h.calc("Corriente nominal secundaria", `${sn}*1000/(${raiz}${vs})`, "A");
    h.calc("Cortocircuito en bornes BT (barra infinita)", `${is}/(${z}/100)/1000`, "kA");
    const fus = h.calc("Fusible primario tipo K (≈ 1,5 Ip)", sigNorm(`1.5*${ip}`, T.fusK), "A");
    const inb = h.calc("Interruptor general BT", sigNorm(is, T.prot), "A");
    const cmax = h.dato("Cargabilidad máxima admisible", n(e.cargaMax, 80), "%");
    const carga = h.calc("Cargabilidad actual", `${dem}/${sn}*100`, "%"), fut = h.calc("Cargabilidad con crecimiento", `${sreq}/${sn}*100`, "%");
    h.verif("Cargabilidad actual", `${carga}<=${cmax}`);
    h.verif("Cargabilidad con crecimiento", `${fut}<=100`);
    h.verif("Protección del secundario (450-3(b))", `${inb}<=${sigNorm(`1.25*${is}`, T.prot)}`);
    h.resumen([{ t: "Transformador adoptado", texto: true, f: `${sn}&" kVA, "&${vp}&" kV / "&${vs}&" V, Z = "&${z}&" %"` }, { t: "Fusible primario tipo K", f: fus, u: "A" }, { t: "Interruptor general de baja tensión", f: inb, u: "A" }, { t: "Corriente nominal secundaria", f: is, u: "A" }, { t: "Cargabilidad actual", f: carga, u: "%" }]);
  },
  cortocircuito(wb, e, r, p, ctx) {
    const h = new Hoja(wb, "e Cortocircuito", "Cortocircuito según IEC 60909-0 (RETIE literales e y k)");
    const un = h.dato("Tensión nominal del secundario Un", n(e.uBT, ctx.transformador?.vs ?? 208), "V");
    const c = h.dato("Factor de tensión c", n(e.factorC, 1.05), "", "IEC 60909-0 Tabla 1");
    const umt = h.dato("Tensión nominal MT", n(e.uMT, 13.2), "kV"), sk = h.dato("S\"kQ de la red", n(e.sk, 250), "MVA"), rx = h.dato("R/X de la red", n(e.rxRed, 0.1), "");
    const sn = h.dato("Potencia del transformador", n(e.snTrafo, ctx.transformador?.sn ?? 150), "kVA");
    const uk = h.dato("ukr", n(e.uk, ctx.transformador?.z ?? 4), "%"), pk = h.dato("PkrT", n(e.pkTrafo, n(e.snTrafo, ctx.transformador?.sn ?? 150) * 0.012), "kW", "Vacío en AHÍNCO = 1,2 % de Sn");
    h.calc("Ik\" trifásica en MT", `${sk}/(SQRT(3)*${umt})`, "kA");
    const zq = h.calc("ZQ referida al secundario", `1.1*${un}^2/(${sk}*1E6)`, "Ω");
    const xq = h.calc("XQ", `${zq}/SQRT(1+${rx}^2)`, "Ω"), rq = h.calc("RQ", `${rx}*${xq}`, "Ω");
    const zt = h.calc("ZT", `${uk}/100*${un}^2/(${sn}*1000)`, "Ω"), rt = h.calc("RT", `${pk}*1000*${un}^2/(${sn}*1000)^2`, "Ω");
    const xt = h.calc("XT", `SQRT(MAX(${zt}^2-${rt}^2,0))`, "Ω");
    const kt = h.calc("KT = 0,95·cmax/(1+0,6·xT)", `0.95*1.1/(1+0.6*${xt}/(${un}^2/(${sn}*1000)))`, "");
    const x0zz = n(e.x0Tierra, 0) > 0 ? h.dato("X0 del transformador zig-zag", n(e.x0Tierra), "Ω", "Secundario en delta: Z0 = la del zig-zag") : null;
    const r1 = h.calc("R1 en bornes", `${rq}+${kt}*${rt}`, "Ω"), x1 = h.calc("X1 en bornes", `${xq}+${kt}*${xt}`, "Ω");
    h.seccion("Corrientes de cortocircuito por barra");
    h.nota(x0zz ? "Secundario en delta con transformador zig-zag: la impedancia de secuencia cero en la barra es la del zig-zag; en los cables Z0 ≈ 4 Z1." : "Z0 del transformador Dyn o YNyn con terciario en delta ≈ Z1; en los cables Z0 ≈ 4 Z1 (aproximación IEC 60909-2).");
    const barras = [{ barra: e.nombreBornes || "Bornes BT", L: 0, R: 0, X: 0, n: 1, icu: n(e.icuBornes, 0) }, ...vacias(e.cables).map((cb) => { const z = impedanciaConductor(cb.conductor, cb.canalizacion); return { barra: cb.barra, L: n(cb.longitud), R: z.R, X: z.X, n: n(cb.paralelos, 1), icu: n(cb.icu, 0) }; })];
    const tb = h.tabla([
      { t: "Barra", v: (b) => String(b.barra || ""), ancho: 20 }, { t: "L (m)", v: (b) => b.L, entrada: true }, { t: "R cable (Ω/km)", v: (b) => b.R, entrada: true, fmt: "0.0000" },
      { t: "X cable (Ω/km)", v: (b) => b.X, entrada: true, fmt: "0.0000" }, { t: "Paralelos", v: (b) => b.n, entrada: true },
      { t: "R1 (Ω)", v: (b, rr) => (b === barras[0] ? `=${r1}` : `=F${rr - 1}+C${rr}*B${rr}/1000/E${rr}`), fmt: "0.00000" },
      { t: "X1 (Ω)", v: (b, rr) => (b === barras[0] ? `=${x1}` : `=G${rr - 1}+D${rr}*B${rr}/1000/E${rr}`), fmt: "0.00000" },
      { t: "R0 (Ω)", v: (b, rr) => (b === barras[0] ? (x0zz ? 0 : `=${kt}*${rt}`) : `=H${rr - 1}+4*C${rr}*B${rr}/1000/E${rr}`), fmt: "0.00000" },
      { t: "X0 (Ω)", v: (b, rr) => (b === barras[0] ? (x0zz ? `=${x0zz}` : `=${kt}*${xt}`) : `=I${rr - 1}+4*D${rr}*B${rr}/1000/E${rr}`), fmt: "0.00000" },
      { t: "Ik\" 3F (kA)", v: (b, rr) => `=${c}*${un}/(SQRT(3)*SQRT(F${rr}^2+G${rr}^2))/1000`, fmt: "0.00" },
      { t: "κ", v: (b, rr) => `=1.02+0.98*EXP(-3*F${rr}/G${rr})`, fmt: "0.00" },
      { t: "ip (kA)", v: (b, rr) => `=K${rr}*SQRT(2)*J${rr}`, fmt: "0.00" },
      { t: "Ik\" 1F (kA)", v: (b, rr) => `=SQRT(3)*${c}*${un}/SQRT((2*F${rr}+H${rr})^2+(2*G${rr}+I${rr})^2)/1000`, fmt: "0.00" },
      { t: "Icu (kA)", v: (b) => b.icu, entrada: true }, { t: "Resultado", v: (b, rr) => `=IF(N${rr}=0,"Sin dato",IF(N${rr}>=J${rr},"Cumple","No cumple"))` }
    ], barras);
    h.resumen(barras.map((b, i) => { const rr = tb.r0 + i; return { t: String(b.barra || `Barra ${i + 1}`), texto: true, f: `"Ik3 = "&ROUND(J${rr},2)&" kA; Ik1 = "&ROUND(M${rr},2)&" kA; pico ip = "&ROUND(L${rr},2)&" kA → especificar equipos con capacidad de interrupción ≥ "&ROUND(MAX(J${rr},M${rr}),1)&" kA"` }; }));
  },
  coordinacion(wb, e) {
    const h = new Hoja(wb, "m Coordinación", "Coordinación de protecciones IEC 60255-151 (RETIE literal m)");
    const cti = h.dato("Margen de coordinación CTI", n(e.cti, 0.3), "s");
    h.seccion("Protecciones (de aguas abajo hacia aguas arriba)");
    const rels = vacias(e.protecciones);
    const t = h.tabla([
      { t: "Protección", v: (f) => String(f.nombre || ""), ancho: 22 }, { t: "Curva (SI/VI/EI/LTI/DT)", v: (f) => String(f.curva || "SI"), entrada: true, lista: ["SI", "VI", "EI", "LTI", "DT"] },
      { t: "I arranque (A)", v: (f) => n(f.pickup), entrada: true }, { t: "TMS / t (s)", v: (f) => n(f.tms, 0.1), entrada: true },
      { t: "I inst. (A)", v: (f) => n(f.inst, 0), entrada: true }, { t: "t inst. (s)", v: (f) => n(f.tinst, 0.05), entrada: true },
      { t: "k", v: (f, rr) => `=VLOOKUP(B${rr},${T.curvas},2,FALSE)` }, { t: "α", v: (f, rr) => `=VLOOKUP(B${rr},${T.curvas},3,FALSE)` }
    ], rels);
    h.seccion("Tiempos de operación (s) por corriente de falla");
    const fallas = vacias(e.fallas);
    const cols = [{ t: "Punto de falla", v: (f) => String(f.punto || ""), ancho: 30 }, { t: "I (A)", v: (f) => n(f.corriente), entrada: true }];
    rels.forEach((rel, i) => {
      const rr = t.r0 + i;
      cols.push({ t: `t ${rel.nombre || i + 1}`, v: (f, r) => `=IF(B${r}<=$C$${rr},"No opera",MIN(IF($B$${rr}="DT",$D$${rr},$D$${rr}*$G$${rr}/((B${r}/$C$${rr})^$H$${rr}-1)),IF(AND($E$${rr}>0,B${r}>=$E$${rr}),$F$${rr},1E9)))`, fmt: "0.000" });
    });
    for (let i = 0; i + 1 < rels.length; i++) {
      const a = col(2 + i), b = col(3 + i);
      cols.push({ t: `Margen ${rels[i + 1].nombre || i + 2} − ${rels[i].nombre || i + 1}`, v: (f, r) => `=IF(OR(ISTEXT(${a}${r}),ISTEXT(${b}${r})),"—",IF(${b}${r}-${a}${r}>=${cti},"Cumple ("&ROUND(${b}${r}-${a}${r},3)&" s)","No cumple ("&ROUND(${b}${r}-${a}${r},3)&" s)"))`, ancho: 22 });
    }
    h.tabla(cols, fallas);
    h.resumen(rels.map((rl, i) => { const rr = t.r0 + i; return { t: String(rl.nombre || `Protección ${i + 1}`), texto: true, f: `"Curva "&B${rr}&", arranque "&C${rr}&" A, TMS "&D${rr}&IF(E${rr}>0,", instantánea "&E${rr}&" A en "&F${rr}&" s","")` }; }));
  },
  malla(wb, e) {
    const h = new Hoja(wb, "i Puesta a tierra", "Malla de puesta a tierra — IEEE 80-2013 (RETIE literal i)");
    const mat = N.MATERIALES_SPT[e.material] || N.MATERIALES_SPT.cuDuro;
    const cal = e.calibre || "2/0";
    const rho = h.dato("Resistividad del suelo ρ", n(e.rho, 100), "Ω·m"), rhos = h.dato("Resistividad capa superficial ρs", n(e.rhoS, 3000), "Ω·m"), hs = h.dato("Espesor capa superficial hs", n(e.hs, 0.1), "m");
    const If = h.dato("Corriente de falla 3I0", n(e.ifalla, 3000), "A"), sf = h.dato("Factor de división Sf", n(e.sf, 60), "%"), xr = h.dato("X/R", n(e.xr, 10), "");
    const tf = h.dato("Duración de la falla tf", n(e.tf, 0.5), "s"), tc = h.dato("Duración para el conductor tc", n(e.tc, 1), "s");
    const lx = h.dato("Largo Lx", n(e.lx, 20), "m"), ly = h.dato("Ancho Ly", n(e.ly, 15), "m"), D = h.dato("Espaciamiento D", n(e.d, 3), "m"), hh = h.dato("Profundidad h", n(e.h, 0.5), "m");
    const d = h.dato("Diámetro del conductor", (N.DIAMETRO_COBRE_DESNUDO[cal] || 10.52) / 1000, "m", `${N.etiquetaCalibre(cal)}`), acal = h.dato("Sección del conductor", N.SECCION_MM2[cal] || 67.43, "mm²");
    const ta = h.dato("Temperatura ambiente", n(e.ta, 40), "°C");
    const nr = h.dato("Número de varillas", n(e.varillas, 0), ""), lr = h.dato("Longitud de varilla", n(e.lVarilla, 2.4), "m"), per = h.dato("Varillas en el perímetro (1 = sí)", e.varillasPerimetro !== "No" ? 1 : 0, "");
    const kp = h.dato("Constante de la persona", n(e.peso, 50) >= 70 ? 0.157 : 0.116, "", "0,116 (50 kg) / 0,157 (70 kg)");
    h.seccion(`Material: ${mat.nombre} (IEEE 80 Tabla 1)`);
    const ar = h.dato("αr", mat.ar, "1/°C"), k0 = h.dato("K0", mat.K0, "°C"), tm = h.dato("Tm", mat.Tm, "°C"), rr = h.dato("ρr", mat.rr, "µΩ·cm"), tcap = h.dato("TCAP", mat.TCAP, "J/(cm³·°C)");
    h.seccion("Cálculos");
    const cs = h.calc("Cs", `IF(AND(${hs}>0,${rhos}>0),1-0.09*(1-${rho}/${rhos})/(2*${hs}+0.09),1)`, "");
    const rs = `IF(AND(${hs}>0,${rhos}>0),${rhos},${rho})`;
    const et = h.calc("Tensión de contacto tolerable", `(1000+1.5*${cs}*${rs})*${kp}/SQRT(${tf})`, "V"), es = h.calc("Tensión de paso tolerable", `(1000+6*${cs}*${rs})*${kp}/SQRT(${tf})`, "V");
    const tad = h.calc("Ta = X/(ωR)", `${xr}/(2*PI()*60)`, "s"), df = h.calc("Df", `SQRT(1+${tad}/${tf}*(1-EXP(-2*${tf}/${tad})))`, "");
    const ig = h.calc("Corriente de malla IG", `${df}*${sf}/100*${If}`, "A");
    const areq = h.calc("Sección mínima del conductor", `(${df}*${If}/1000)/SQRT((${tcap}*1E-4/(${tc}*${ar}*${rr}))*LN((${k0}+${tm})/(${k0}+${ta})))`, "mm²");
    const lc = h.calc("LC (conductor horizontal)", `(ROUND(${ly}/${D},0)+1)*${lx}+(ROUND(${lx}/${D},0)+1)*${ly}`, "m");
    const lp = h.calc("Perímetro Lp", `2*(${lx}+${ly})`, "m"), A = h.calc("Área A", `${lx}*${ly}`, "m²"), LR = h.calc("LR (varillas)", `${nr}*${lr}`, "m"), lt = h.calc("LT", `${lc}+${LR}`, "m");
    const rg = h.calc("Rg (Sverak)", `${rho}*(1/${lt}+1/SQRT(20*${A})*(1+1/(1+${hh}*SQRT(20/${A}))))`, "Ω");
    const gpr = h.calc("GPR", `${ig}*${rg}`, "V");
    const nn = h.calc("n = na·nb", `(2*${lc}/${lp})*SQRT(${lp}/(4*SQRT(${A})))`, "");
    const kii = h.calc("Kii", `IF(AND(${nr}>0,${per}=1),1,1/(2*${nn})^(2/${nn}))`, ""), kh = h.calc("Kh", `SQRT(1+${hh}/1)`, "");
    const km = h.calc("Km", `1/(2*PI())*(LN(${D}^2/(16*${hh}*${d})+(${D}+2*${hh})^2/(8*${D}*${d})-${hh}/(4*${d}))+${kii}/${kh}*LN(8/(PI()*(2*${nn}-1))))`, "");
    const ki = h.calc("Ki", `0.644+0.148*${nn}`, "");
    const lm = h.calc("LM", `IF(AND(${nr}>0,${per}=1),${lc}+(1.55+1.22*(${lr}/SQRT(${lx}^2+${ly}^2)))*${LR},${lc}+${LR})`, "m");
    const em = h.calc("Tensión de malla Em", `${rho}*${km}*${ki}*${ig}/${lm}`, "V");
    const ks = h.calc("Ks", `1/PI()*(1/(2*${hh})+1/(${D}+${hh})+1/${D}*(1-0.5^(${nn}-2)))`, ""), ls = h.calc("LS", `0.75*${lc}+0.85*${LR}`, "m");
    const ep = h.calc("Tensión de paso Es", `${rho}*${ks}*${ki}*${ig}/${ls}`, "V");
    const ret = N.RETIE_RESISTENCIA_SPT[e.tipoInstalacion] || N.RETIE_RESISTENCIA_SPT.subMT;
    const rmax = h.dato("Resistencia de referencia RETIE", ret.max, "Ω", ret.nombre);
    h.seccion("Verificaciones");
    h.verif("Em ≤ E contacto tolerable", `${em}<=${et}`, "IEEE 80");
    h.verif("Es ≤ E paso tolerable", `${ep}<=${es}`, "IEEE 80");
    h.verif("Rg ≤ referencia RETIE", `${rg}<=${rmax}`, "RETIE");
    h.verif("Sección del conductor ≥ mínima", `${acal}>=${areq}`, "IEEE 80 ec. 37");
    h.resumen([
      { t: "Malla adoptada", texto: true, f: `${lx}&" m × "&${ly}&" m, espaciamiento "&${D}&" m, enterrada a "&${hh}&" m"` },
      { t: "Conductor", texto: true, f: `"${N.etiquetaCalibre(cal)} de ${mat.nombre.toLowerCase()} ("&${acal}&" mm²; mínimo requerido "&ROUND(${areq},1)&" mm²)"` },
      { t: "Electrodos", texto: true, f: `${nr}&" varillas de "&${lr}&" m"&IF(${per}=1," en el perímetro","")` },
      { t: "Resistencia de la malla Rg", f: rg, u: "Ω" }, { t: "Elevación de potencial GPR", f: gpr, u: "V" },
      { t: "Tensión de contacto / tolerable", texto: true, f: `ROUND(${em},0)&" V frente a "&ROUND(${et},0)&" V tolerables"` },
      { t: "Tensión de paso / tolerable", texto: true, f: `ROUND(${ep},0)&" V frente a "&ROUND(${es},0)&" V tolerables"` }
    ]);
  },
  rayos(wb, e) {
    const h = new Hoja(wb, "b Rayos", "Análisis de riesgo por rayos — R1 (RETIE literal b; NTC 4552-2 / IEC 62305-2)");
    const v = (tabla, k, def) => (tabla[k] || tabla[def]).v;
    const L = h.dato("Largo L", n(e.largo, 30), "m"), W = h.dato("Ancho W", n(e.ancho, 15), "m"), H = h.dato("Altura H", n(e.alto, 9), "m"), ng = h.dato("NG", n(e.ng, 8), "descargas/km²·año");
    const cd = h.dato("CD (ubicación)", v(N.CD_UBICACION, e.ubicacion, "rodeada_iguales"), ""), ll = h.dato("Longitud línea LL", n(e.longLinea, 500), "m");
    const ci = h.dato("CI", e.lineaEnterrada === "Sí" ? 0.5 : 1, ""), ce = h.dato("CE", n(e.ce, 0.5), ""), ct = h.dato("CT", e.trafoLinea === "Sí" ? 0.2 : 1, "");
    const nz = h.dato("Personas en la zona nz", n(e.personasZona, 20), ""), nt = h.dato("Personas totales nt", n(e.personasTotal, 20), ""), tz = h.dato("Horas de presencia tz", n(e.horas, 2920), "h");
    const rt = h.dato("rt (superficie)", v(N.RT_SUELO, e.suelo, "agricola"), ""), rp = h.dato("rp (provisiones)", v(N.RP_PROVISIONES, e.provisiones, "ninguna"), "");
    const rf = h.dato("rf (incendio)", v(N.RF_INCENDIO, e.incendio, "ordinario"), ""), hz = h.dato("hz (peligro especial)", v(N.HZ_PANICO, e.panico, "ninguno"), ""), lf = h.dato("LF", v(N.LF_TIPO, e.tipoEstructura, "otro"), "");
    const pb = h.dato("PB (SIPRA adoptado)", v(N.PB_SIPRA, e.sipra, "ninguno"), ""), peb = h.dato("PEB (DPS adoptados)", v(N.PEB_DPS, e.dps, "ninguno"), ""), pta = h.dato("PTA (medidas paso/contacto)", v(N.PTA_MEDIDAS, e.medidas, "ninguna"), "");
    h.seccion("Cálculos");
    const ad = h.calc("AD", `${L}*${W}+2*(3*${H})*(${L}+${W})+PI()*(3*${H})^2`, "m²"), nd = h.calc("ND", `${ng}*${ad}*${cd}*1E-6`, "/año");
    const nl = h.calc("NL", `${ng}*40*${ll}*${ci}*${ce}*${ct}*1E-6`, "/año"), fr = h.calc("(nz/nt)·(tz/8760)", `${nz}/MAX(${nt},${nz})*${tz}/8760`, "");
    const la = h.calc("LA", `${rt}*0.01*${fr}`, ""), lb = h.calc("LB", `${rp}*${rf}*${hz}*${lf}*${fr}`, "");
    const ra = h.calc("RA", `${nd}*${pta}*${pb}*${la}`, ""), rb = h.calc("RB", `${nd}*${pb}*${lb}`, ""), ru = h.calc("RU", `${nl}*${pta}*${peb}*${la}`, ""), rv = h.calc("RV", `${nl}*${peb}*${lb}`, "");
    const r1 = h.calc("R1", `${ra}+${rb}+${ru}+${rv}`, "");
    h.verif("R1 ≤ 1E-5 (riesgo tolerable)", `${r1}<=1E-5`, "IEC 62305-2");
    h.resumen([{ t: "Riesgo R1 con las medidas adoptadas", f: r1, fmt: "0.00E+00", nota: "Tolerable: ≤ 1,00E-05" }, { t: "Medidas de protección adoptadas", texto: true, valor: `${(N.PB_SIPRA[e.sipra] || N.PB_SIPRA.ninguno).nombre}; ${(N.PEB_DPS[e.dps] || N.PEB_DPS.ninguno).nombre}; ${(N.PTA_MEDIDAS[e.medidas] || N.PTA_MEDIDAS.ninguna).nombre}` }]);
  },
  aislamiento(wb, e, r, p) {
    const h = new Hoja(wb, "d Aislamiento", "Coordinación de aislamiento y DPS (RETIE literal d; IEC 60071 / 60099-5)");
    h.dato("Um del equipo", n(e.um, 36), "kV");
    const um = h.dato("Us, tensión máxima de operación del sistema", n(e.us, 0) || n(e.um, 36), "kV"), k = h.dato("Factor de falla a tierra k", e.puestaTierra === "aislado" ? 1.73 : e.puestaTierra === "solido" ? 1.3 : 1.4, "");
    const H = h.dato("Altitud", n(e.altitud, n(p.altitud, 0)), "m"), bil = h.dato("BIL del equipo", n(e.bil, 170), "kV");
    const ur = h.dato("Ur del DPS", n(e.ur, 30), "kV"), uc = h.dato("Uc del DPS", n(e.uc, 24.4), "kV"), ures = h.dato("Ures 10 kA", n(e.ures, 79), "kV"), T = h.dato("Capacidad TOV T", n(e.capTov, 1.1), "p.u.");
    const d = h.dato("Separación DPS-equipo", n(e.distancia, 3), "m"), S = h.dato("Pendiente de la onda", n(e.pendiente, 500), "kV/µs");
    h.seccion("Cálculos");
    const tov = h.calc("TOV = k·Us/√3", `${k}*${um}/SQRT(3)`, "kV"), ucm = h.calc("Uc mínima = Us/√3", `${um}/SQRT(3)`, "kV"), urm = h.calc("Ur mínima = TOV/T", `${tov}/${T}`, "kV");
    const ka = h.calc("Ka = e^(H/8150)", `EXP(${H}/8150)`, ""), ve = h.calc("Tensión en el equipo", `${ures}+2*${S}*${d}/300`, "kV");
    const mp = h.calc("Margen de protección", `((${bil}/${ka})/${ve}-1)*100`, "%");
    h.seccion("Verificaciones");
    h.verif("Uc ≥ Us/√3", `${uc}>=${ucm}`); h.verif("Ur ≥ TOV/T", `${ur}>=${urm}`); h.verif("Margen ≥ 20 %", `${mp}>=20`, "IEEE C62.22");
    h.resumen([{ t: "DPS seleccionado", texto: true, f: `"Ur = "&${ur}&" kV; Uc = "&${uc}&" kV; tensión residual a 10 kA = "&${ures}&" kV, a "&${d}&" m del equipo"` }, { t: "Ur mínima exigida", f: urm, u: "kV" }, { t: "Uc mínima exigida", f: ucm, u: "kV" }, { t: "BIL del equipo protegido", f: bil, u: "kV" }, { t: "Margen de protección obtenido", f: mp, u: "%", nota: "Mínimo recomendado: 20 %" }]);
  },
  distancias(wb, e, r, p) {
    const h = new Hoja(wb, "u Distancias", "Distancias de seguridad (RETIE literal u)");
    const H = h.dato("Altitud", n(e.altitud, n(p.altitud, 0)), "m");
    const f = h.calc("Factor de altitud", `IF(${H}>1000,1+0.0125*(${H}-1000)/100,1)`, "");
    h.nota("Distancia base: tabla de distancias mínimas de seguridad del RETIE (verificar contra la versión vigente) o valor digitado.");
    const filas = vacias(e.puntos).map((x) => { const tipo = N.RETIE_DISTANCIAS.tipos[x.tipo] || N.RETIE_DISTANCIAS.tipos.e; const base = n(x.exigida, NaN); return { ...x, tipoN: tipo.nombre, base: Number.isFinite(base) ? base : tipo.v[x.tension] ?? null }; });
    const t = h.tabla([
      { t: "Punto", v: (x) => String(x.punto || ""), ancho: 24 }, { t: "Tensión (kV)", v: (x) => String(x.tension || "") }, { t: "Tipo de distancia", v: (x) => x.tipoN, ancho: 40 },
      { t: "Distancia base (m)", v: (x) => x.base, entrada: true }, { t: "Exigida (m)", v: (x, rr) => `=IF(D${rr}="","",D${rr}*${f})`, fmt: "0.00" },
      { t: "Diseño (m)", v: (x) => n(x.diseno), entrada: true }, { t: "Resultado", v: (x, rr) => `=IF(E${rr}="","Sin dato",IF(F${rr}>=E${rr},"Cumple","No cumple"))` }
    ], filas);
    h.resumen(filas.map((x, i) => { const rr = t.r0 + i; return { t: String(x.punto || `Punto ${i + 1}`), texto: true, f: `"Distancia de diseño "&F${rr}&" m frente a "&IF(E${rr}="","(sin dato exigido)",ROUND(E${rr},2)&" m exigidos")` }; }));
  },
  mecanico(wb, e) {
    const h = new Hoja(wb, "l Mecánico", "Cálculo mecánico de conductores — cambio de estado (RETIE literal l)");
    const base = N.CONDUCTORES_AEREOS[e.conductor];
    const c = base && e.conductor !== "personalizado" ? base : { nombre: "Personalizado", area: n(e.area, 100), diametro: n(e.diametro, 13), peso: n(e.peso, 0.35), rotura: n(e.rotura, 3000), E: n(e.modulo, 75000), alfa: n(e.alfa, 19e-6) };
    h.nota(c.nombre);
    const A = h.dato("Área", c.area, "mm²"), d = h.dato("Diámetro", c.diametro, "mm"), w = h.dato("Peso", c.peso, "kg/m"), rot = h.dato("Carga de rotura", c.rotura, "kgf");
    const E = h.dato("Módulo de elasticidad", c.E, "N/mm²"), al = h.dato("Coef. de dilatación α", c.alfa, "1/°C"), L = h.dato("Vano", n(e.vano, 150), "m"), eds = h.dato("EDS", n(e.eds, 18), "% rotura");
    const ea = h.calc("EA", `${E}*${A}`, "N"), w0 = h.calc("w0", `${w}*9.80665`, "N/m"), t1 = h.calc("T1 (EDS)", `${eds}/100*${rot}*9.80665`, "N");
    const hip = vacias(e.hipotesis);
    const ib = Math.max(0, hip.findIndex((x) => /eds|diaria/i.test(x.nombre || "")));
    const tb = h.dato("Temperatura de la condición EDS", n(hip[ib]?.temperatura, 25), "°C"), qb = h.dato("Viento en la condición EDS", n(hip[ib]?.viento, 0), "Pa");
    const w1 = h.calc("w1 (condición EDS)", `SQRT(${w0}^2+(${qb}*${d}/1000)^2)`, "N/m");
    h.seccion("Hipótesis — la tensión T2 se resuelve con 8 iteraciones de Newton sobre T2²(T2 − A) = B");
    const cols = [
      { t: "Hipótesis", v: (x) => String(x.nombre || ""), ancho: 26 }, { t: "T (°C)", v: (x) => n(x.temperatura, 25), entrada: true }, { t: "Viento (Pa)", v: (x) => n(x.viento, 0), entrada: true },
      { t: "w2 (N/m)", v: (x, r) => `=SQRT(${w0}^2+(C${r}*${d}/1000)^2)`, fmt: "0.000" },
      { t: "A", ancho: 14, v: (x, r) => `=${t1}-${w1}^2*${L}^2*${ea}/(24*${t1}^2)-${al}*${ea}*(B${r}-${tb})`, fmt: "0" },
      { t: "B", ancho: 16, v: (x, r) => `=D${r}^2*${L}^2*${ea}/24`, fmt: "0" }
    ];
    for (let i = 0; i < 8; i++) {
      const prev = i === 0 ? null : col(6 + i - 1);
      cols.push({ t: `Iter. ${i + 1}`, ancho: 10, v: (x, r) => (i === 0 ? `=MAX(${t1},1)` : `=${prev}${r}-(${prev}${r}^2*(${prev}${r}-E${r})-F${r})/(3*${prev}${r}^2-2*E${r}*${prev}${r})`), fmt: "0" });
    }
    const ult = col(13);
    cols.push({ t: "Tensión (kgf)", v: (x, r) => `=${ult}${r}/9.80665`, fmt: "0" }, { t: "% rotura", v: (x, r) => `=${ult}${r}/9.80665/${rot}*100`, fmt: "0.0" }, { t: "Flecha (m)", v: (x, r) => `=D${r}*${L}^2/(8*${ult}${r})`, fmt: "0.00" }, { t: "≤ 50 % rotura", v: (x, r) => `=IF(${col(15)}${r}<=50,"Cumple","No cumple")` });
    const t = h.tabla(cols, hip);
    h.resumen([{ t: "Conductor", texto: true, valor: `${c.nombre}, vano de ${n(e.vano, 150)} m, EDS ${n(e.eds, 18)} %` }, { t: "Tensión máxima del conductor", f: `MAX(${col(14)}${t.r0}:${col(14)}${t.r1})`, u: "kgf" }, { t: "Porcentaje máximo de la rotura", f: `MAX(${col(15)}${t.r0}:${col(15)}${t.r1})`, u: "%", nota: "Máximo admisible: 50 %" }, { t: "Flecha máxima", f: `MAX(${col(16)}${t.r0}:${col(16)}${t.r1})`, u: "m" }]);
  },
  trafoPotencia(wb, e) {
    const h = new Hoja(wb, "h Trafo potencia", "Transformador de potencia (RETIE literal h; IEC 60076-5; IEC 61869-2)");
    const sOnan = h.dato("Potencia ONAN", n(e.sOnan, 40), "MVA"), sOnaf = h.dato("Potencia ONAF", Math.max(n(e.sOnaf, 40), n(e.sOnan, 40)), "MVA");
    const uAT = h.dato("Tensión AT", n(e.uAT, 115), "kV"), uMT = h.dato("Tensión MT", n(e.uMT, 34.5), "kV"), tap = h.dato("Rango de tomas (±)", n(e.tapRango, 12.5), "%");
    const uk = h.dato("Impedancia uk", n(e.uk, 9.5), "%"), base = h.dato(`Potencia base de uk (${e.ukBase === "ONAF" ? "ONAF" : "ONAN"})`, e.ukBase === "ONAF" ? Math.max(n(e.sOnaf, 40), n(e.sOnan, 40)) : n(e.sOnan, 40), "MVA");
    const ikRed = h.dato("Cortocircuito de la red en AT Ik\"", n(e.ikRed, 40), "kA"), c = h.dato("Factor de tensión c", n(e.factorC, 1.1), "");
    h.seccion("Corrientes nominales y cortocircuito pasante");
    h.calc("In AT ONAN", `${sOnan}*1000/(SQRT(3)*${uAT})`, "A"); h.calc("In AT ONAF", `${sOnaf}*1000/(SQRT(3)*${uAT})`, "A");
    const iAT = h.calc("In AT ONAF en la toma extrema", `${sOnaf}*1000/(SQRT(3)*${uAT})/(1-${tap}/100)`, "A");
    h.calc("In MT ONAN", `${sOnan}*1000/(SQRT(3)*${uMT})`, "A");
    const iMT = h.calc("In MT ONAF", `${sOnaf}*1000/(SQRT(3)*${uMT})`, "A");
    const sk = h.calc("S\"kQ de la red", `SQRT(3)*${uAT}*${ikRed}`, "MVA");
    const zq = h.calc("ZQ referida a MT", `${c}*${uMT}^2/${sk}`, "Ω"), zt = h.calc("ZT referida a MT", `${uk}/100*${uMT}^2/${base}`, "Ω");
    const ikMT = h.calc("Ik\" en la barra MT", `${c}*${uMT}/(SQRT(3)*(${zq}+${zt}))`, "kA");
    const ikPas = h.calc("Ik pasante vista desde AT", `${ikMT}*${uMT}/${uAT}`, "kA");
    if (n(e.ikSoporta, 0) > 0) {
      const esp = h.dato(`Soportabilidad especificada lado AT (${n(e.tSoporta, 2)} s)`, n(e.ikSoporta), "kA");
      h.verif("Ik pasante ≤ soportabilidad especificada", `${ikPas}<=${esp}`, "IEC 60076-5");
    }
    if (n(e.demanda, 0) > 0) {
      const dem = h.dato("Demanda proyectada", n(e.demanda), "MVA"), cre = h.dato("Crecimiento", n(e.crecimiento, 0), "%"), cmax = h.dato("Cargabilidad máxima (ONAF)", n(e.cargaMax, 100), "%");
      h.verif("Cargabilidad con la demanda proyectada", `${dem}*(1+${cre}/100)/${sOnaf}*100<=${cmax}`, "IEC 60076-7");
    }
    const tcs = vacias(e.tcs);
    if (tcs.length) {
      h.seccion("Transformadores de corriente (corriente térmica extendida 120 %; ALF × Ipn ≥ Ik)");
      h.tabla([
        { t: "TC", v: (f) => String(f.nombre || ""), ancho: 18 }, { t: "Lado (AT/MT)", v: (f) => f.lado === "AT" ? "AT" : "MT", entrada: true, lista: ["AT", "MT"] },
        { t: "Función", v: (f) => String(f.funcion || "Protección"), entrada: true, lista: ["Protección", "Medida"] }, { t: "Ipn (A)", v: (f) => n(f.primaria), entrada: true }, { t: "ALF", v: (f) => n(f.alf, 20), entrada: true },
        { t: "I máx. circuito (A)", v: (f, rr) => `=IF(B${rr}="AT",${iAT},${iMT})`, fmt: "0" }, { t: "Ik vista (kA)", v: (f, rr) => `=IF(B${rr}="AT",${ikPas},${ikMT})`, fmt: "0.00" },
        { t: "Resultado", v: (f, rr) => `=IF(AND(F${rr}<=1.2*D${rr},OR(C${rr}<>"Protección",D${rr}*E${rr}>=G${rr}*1000)),"Cumple","No cumple")` }
      ], tcs);
    }
    const eq = vacias(e.equipos);
    if (eq.length) {
      h.seccion("Equipos en serie con el transformador");
      h.tabla([
        { t: "Equipo", v: (f) => String(f.equipo || ""), ancho: 24 }, { t: "Lado (AT/MT)", v: (f) => f.lado === "AT" ? "AT" : "MT", entrada: true, lista: ["AT", "MT"] },
        { t: "In (A)", v: (f) => n(f.inom), entrada: true }, { t: "Ik equipo (kA)", v: (f) => n(f.icc), entrada: true },
        { t: "I exigida (A)", v: (f, rr) => `=IF(B${rr}="AT",${iAT},${iMT})`, fmt: "0" }, { t: "Ik exigida (kA)", v: (f, rr) => `=IF(B${rr}="AT",${ikRed},${ikMT})`, fmt: "0.00" },
        { t: "Resultado", v: (f, rr) => `=IF(AND(C${rr}>=E${rr},OR(D${rr}=0,D${rr}>=F${rr})),"Cumple","No cumple")` }
      ], eq);
    }
    h.resumen([{ t: "Transformador", texto: true, f: `${sOnan}&"/"&${sOnaf}&" MVA, "&${uAT}&" / "&${uMT}&" kV, uk = "&${uk}&" %"` }, { t: "Corriente nominal en MT (ONAF)", f: iMT, u: "A", nota: "Corriente que deben soportar la llegada, el TC y la celda de MT" }, { t: "Corriente máxima en AT (toma extrema)", f: iAT, u: "A" }, { t: "Cortocircuito en la barra MT", f: ikMT, u: "kA", nota: "Capacidad de interrupción mínima de las celdas de MT" }, { t: "Cortocircuito pasante visto desde AT", f: ikPas, u: "kA", nota: "Debe ser menor que la soportabilidad especificada del transformador" }]);
  },
  cableMT(wb, e, r, p, ctx) {
    const h = new Hoja(wb, "k Cables MT", "Cables de media tensión (RETIE literal k; IEC 60502-2; IEC 60949)");
    const U = h.dato("Tensión nominal", n(e.tension, ctx.trafoPotencia ? ctx.trafoPotencia.vs / 1000 : 34.5), "kV");
    const fp = h.dato("Factor de potencia", n(e.fp, 0.9), ""), sen = h.calc("sen φ", `SQRT(1-${fp}^2)`, ""), dvMax = h.dato("Caída de tensión máxima", n(e.dvMax, 3), "%");
    const ik3 = ctx.cortocircuito?.barras?.[0]?.ik3;
    const ikDef = ctx.trafoPotencia?.ikMT ?? (Number.isFinite(ik3) ? ik3 / 1000 : 0);
    h.nota("K adiabático (IEC 60949): Cu XLPE/EPR 143, Al XLPE/EPR 94, Cu PVC 115, Al PVC 76. R vacía en AHÍNCO = resistencia a 90 °C calculada.");
    const t = h.tabla([
      { t: "Circuito", v: (f) => String(f.circuito || ""), ancho: 16 }, { t: "Mat. (Cu/Al)", v: (f) => (f.material === "Cu" ? "Cu" : "Al"), entrada: true, lista: ["Cu", "Al"] },
      { t: "Calibre", v: (f) => String(f.calibre || "750"), entrada: true }, { t: "Aisl.", v: (f) => String(f.aislamiento || "XLPE"), entrada: true, lista: ["XLPE", "EPR", "PVC"] },
      { t: "S (mm²)", v: (f, rr) => `=VLOOKUP(C${rr},${T.cond},8,FALSE)`, fmt: "0.0" },
      { t: "Ampacidad base (A)", v: (f) => n(f.ampacidad), entrada: true }, { t: "Factor", v: (f) => n(f.factor, 1), entrada: true },
      { t: "Ampacidad corregida (A)", v: (f, rr) => `=F${rr}*G${rr}`, fmt: "0" }, { t: "I diseño (A)", v: (f) => n(f.corriente), entrada: true },
      { t: "L (m)", v: (f) => n(f.longitud), entrada: true },
      { t: "R (Ω/km)", v: (f) => { const S = N.SECCION_MM2[f.calibre] || 0, cu = f.material === "Cu"; return n(f.r, 0) || (S ? ((cu ? 0.017241 : 0.028264) / S) * 1000 * (1 + (cu ? 0.00393 : 0.00403) * 70) : 0); }, entrada: true, fmt: "0.0000" },
      { t: "X (Ω/km)", v: (f) => n(f.x, 0.13), entrada: true, fmt: "0.000" },
      { t: "K", v: (f, rr) => `=IF(B${rr}="Cu",IF(D${rr}="PVC",115,143),IF(D${rr}="PVC",76,94))` },
      { t: "t despeje (s)", v: (f) => n(f.tDespeje, 0.5), entrada: true }, { t: "Ik (kA)", v: (f) => n(f.icc, ikDef), entrada: true, fmt: "0.00" },
      { t: "Ik admisible (kA)", v: (f, rr) => `=M${rr}*E${rr}/SQRT(N${rr})/1000`, fmt: "0.00" },
      { t: "ΔV (%)", v: (f, rr) => `=SQRT(3)*I${rr}*J${rr}/1000*(K${rr}*${fp}+L${rr}*${sen})/(${U}*1000)*100`, fmt: "0.00" },
      { t: "In celda (A)", v: (f) => n(f.inCelda, 0), entrada: true },
      { t: "Resultado", v: (f, rr) => `=IF(AND(I${rr}<=H${rr},O${rr}<=P${rr},Q${rr}<=${dvMax},OR(R${rr}=0,R${rr}>=I${rr})),"Cumple","No cumple")` }
    ], vacias(e.circuitos));
    h.resumen(vacias(e.circuitos).map((f, i) => { const rr = t.r0 + i; return { t: String(f.circuito || `Circuito ${i + 1}`), texto: true, f: `"Cable "&B${rr}&" "&C${rr}&" "&D${rr}&": capacidad "&ROUND(H${rr},0)&" A para "&I${rr}&" A; soporta "&ROUND(P${rr},1)&" kA durante "&N${rr}&" s"` }; }));
  },
  apantallamiento(wb, e) {
    const h = new Hoja(wb, "b Apantallamiento", "Apantallamiento por esfera rodante (RETIE literal b; NTC 4552-3; IEEE 998)");
    let R;
    if (e.metodo === "ieee998") {
      const bil = h.dato("BIL de los equipos", n(e.bil, 550), "kV"), zs = h.dato("Impedancia de onda Zs", n(e.zs, 350), "Ω"), k = h.dato("k (mástil 1,2; cable 1)", e.captador === "cable" ? 1 : 1.2, "");
      const ic = h.calc("Ic = 2,2 × BIL / Zs", `2.2*${bil}/${zs}`, "kA");
      R = h.calc("Radio de la esfera S = 8 k Ic^0,65", `8*${k}*${ic}^0.65`, "m");
    } else {
      R = h.dato(`Radio de la esfera (nivel ${e.nivel || "I"})`, (N.NIVELES_SIPRA[e.nivel] || N.NIVELES_SIPRA.I).esfera, "m");
    }
    h.seccion("Elementos a proteger — r = √(hm(2R − hm)) − √(h(2R − h))");
    const t = h.tabla([
      { t: "Elemento", v: (f) => String(f.elemento || ""), ancho: 26 }, { t: "Captador", v: (f) => String(f.captador || ""), ancho: 14 },
      { t: "Altura captador (m)", v: (f) => n(f.hCaptador), entrada: true }, { t: "Altura elemento (m)", v: (f) => n(f.hElemento), entrada: true },
      { t: "Distancia (m)", v: (f) => (f.distancia === "" || f.distancia == null ? "" : n(f.distancia)), entrada: true },
      { t: "Radio protegido (m)", v: (f, rr) => `=IF(D${rr}>=C${rr},0,MAX(0,IF(C${rr}>=${R},${R},SQRT(C${rr}*(2*${R}-C${rr})))-IF(D${rr}>=${R},${R},SQRT(D${rr}*(2*${R}-D${rr})))))`, fmt: "0.00" },
      { t: "Resultado", v: (f, rr) => `=IF(E${rr}="","Captador a <= "&ROUND(F${rr},2)&" m",IF(E${rr}<=F${rr},"Protegido","No protegido"))` }
    ], vacias(e.elementos));
    h.resumen([{ t: "Radio de la esfera rodante", f: R, u: "m" }, ...vacias(e.elementos).map((f, i) => { const rr = t.r0 + i; return { t: String(f.elemento || `Elemento ${i + 1}`), texto: true, f: `B${rr}&" de "&C${rr}&" m: protege un radio de "&ROUND(F${rr},2)&" m a "&D${rr}&" m de altura"` }; })]);
  },
  fvArreglo(wb, e) {
    const h = new Hoja(wb, "x Arreglo FV", "Arreglo fotovoltaico e inversor (RETIE literal x; NTC 2050 Sección 690; IEC 62548)");
    h.seccion("Módulo fotovoltaico (ficha técnica)");
    const pmod = h.dato("Potencia máxima Pmax (STC)", n(e.pmod, 550), "W"), voc = h.dato("Tensión de circuito abierto Voc", n(e.voc, 49.9), "V"), vmp = h.dato("Tensión de máxima potencia Vmp", n(e.vmp, 41.96), "V");
    const isc = h.dato("Corriente de cortocircuito Isc", n(e.isc, 14), "A"), imp = h.dato("Corriente de máxima potencia Imp", n(e.imp, 13.11), "A");
    const bVoc = h.dato("Coeficiente de temperatura de Voc", n(e.bVoc, -0.27), "%/°C"), bVmp = h.dato("Coeficiente de temperatura de Vmp", n(e.bVmp, -0.35), "%/°C");
    h.dato("Coeficiente de temperatura de Pmax", n(e.gPmax, -0.35), "%/°C");
    const noct = h.dato("NOCT", n(e.noct, 45), "°C"), vmaxMod = h.dato("Tensión máxima del sistema del módulo", n(e.vmaxMod, 1500), "V"), fusMax = h.dato("Fusible máximo en serie del módulo", n(e.fusibleMax, 25), "A");
    h.seccion("Inversor (ficha técnica)");
    const pac = h.dato("Potencia nominal AC", n(e.pac, 100), "kW"), vac = h.dato("Tensión AC (línea-línea en trifásico)", n(e.vac, 480), "V"), fases = h.dato("Fases (3 o 1)", e.fases === "1" ? 1 : 3, "");
    const vdcMax = h.dato("Tensión DC máxima de entrada", n(e.vdcMax, 1100), "V"), vMin = h.dato("Tensión MPPT mínima a plena carga", n(e.vmpptMin, 550), "V"), vMax = h.dato("Tensión MPPT máxima", n(e.vmpptMax, 850), "V");
    const idcMax = h.dato("Corriente máxima de entrada por MPPT", n(e.idcMax, 32), "A"), iscMax = h.dato("Corriente de cortocircuito máxima por MPPT", n(e.iscMax, 40), "A"), nMppt = h.dato("Número de entradas MPPT", n(e.nMppt, 10), "");
    h.seccion("Configuración adoptada y condiciones del sitio");
    const ns = h.dato("Módulos en serie por string", n(e.ns, 18), ""), np = h.dato("Strings en paralelo por MPPT", n(e.np, 2), ""), nUso = h.dato("Entradas MPPT utilizadas", n(e.mpptUsados, 6), "");
    const tmin = h.dato("Temperatura ambiente mínima histórica", n(e.tmin, 15), "°C"), tmax = h.dato("Temperatura ambiente máxima de diseño", n(e.tmax, 40), "°C");
    const ilrMin = h.dato("Relación DC/AC mínima aceptada", n(e.ilrMin, 0.9), ""), ilrMax = h.dato("Relación DC/AC máxima aceptada", n(e.ilrMax, 1.35), ""), ucpv = h.dato("Ucpv del DPS de corriente continua (0 = sin dato)", n(e.ucpv, 0), "V");
    h.seccion("Cálculos");
    const tc = h.calc("Temperatura máxima de celda", `${tmax}+(${noct}-20)/800*1000`, "°C");
    const vocMax = h.calc("Voc del módulo a la temperatura mínima", `${voc}*(1+${bVoc}/100*(${tmin}-25))`, "V");
    const vmpMin = h.calc("Vmp del módulo a la temperatura máxima de celda", `${vmp}*(1+${bVmp}/100*(${tc}-25))`, "V");
    const vmpMax = h.calc("Vmp del módulo a la temperatura mínima", `${vmp}*(1+${bVmp}/100*(${tmin}-25))`, "V");
    const vOc = h.calc("Voc máxima del string", `${ns}*${vocMax}`, "V"), vMpMin = h.calc("Vmp mínima del string", `${ns}*${vmpMin}`, "V"), vMpMax = h.calc("Vmp máxima del string", `${ns}*${vmpMax}`, "V");
    const nsMaxDC = h.calc("Módulos en serie máximos por tensión DC", `ROUNDDOWN(MIN(${vdcMax},${vmaxMod})/${vocMax},0)`, ""), nsMaxMp = h.calc("Módulos en serie máximos por tensión MPPT máxima", `ROUNDDOWN(${vMax}/${vmpMax},0)`, "");
    const nsMax = h.calc("Módulos en serie máximos", `MIN(${nsMaxDC},${nsMaxMp})`, ""), nsMin = h.calc("Módulos en serie mínimos (por tensión MPPT mínima)", `ROUNDUP(${vMin}/${vmpMin},0)`, "");
    const iIsc = h.calc("Corriente de cortocircuito por MPPT (1,25 × Np × Isc)", `${np}*${isc}*1.25`, "A"), iImp = h.calc("Corriente de operación por MPPT", `${np}*${imp}`, "A");
    const nMod = h.calc("Número total de módulos", `${ns}*${np}*${nUso}`, ""), pdc = h.calc("Potencia pico del arreglo", `${nMod}*${pmod}/1000`, "kWp"), ilr = h.calc("Relación DC/AC", `${pdc}/${pac}`, "");
    const iac = h.calc("Corriente nominal AC del inversor", `IF(${fases}=3,${pac}*1000/(SQRT(3)*${vac}),${pac}*1000/${vac})`, "A");
    const iInv = h.calc("Corriente inversa hacia un string en falla", `(${np}-1)*${isc}*1.25`, "A");
    h.seccion("Verificaciones");
    h.verif("Voc del string ≤ tensión DC máxima del inversor", `${vOc}<=${vdcMax}`, "IEC 62548 / NTC 2050 690-7");
    h.verif("Voc del string ≤ tensión máxima del módulo", `${vOc}<=${vmaxMod}`, "IEC 61730");
    h.verif("Vmp mínima del string ≥ tensión MPPT mínima", `${vMpMin}>=${vMin}`, "Ficha del inversor");
    h.verif("Vmp máxima del string ≤ tensión MPPT máxima", `${vMpMax}<=${vMax}`, "Ficha del inversor");
    h.verif("Corriente de cortocircuito por MPPT ≤ admisible", `${iIsc}<=${iscMax}`, "NTC 2050 690-8");
    h.verif("Corriente de operación por MPPT ≤ admisible", `${iImp}<=${idcMax}`, "Ficha del inversor");
    h.verif("Entradas MPPT utilizadas ≤ disponibles", `${nUso}<=${nMppt}`, "Ficha del inversor");
    h.verif("Relación DC/AC dentro del rango aceptado", `AND(${ilr}>=${ilrMin},${ilr}<=${ilrMax})`, "Criterio de diseño");
    h.verif("DPS DC: Ucpv ≥ Voc máxima del string (si hay dato)", `OR(${ucpv}=0,${ucpv}>=${vOc})`, "IEC 61643-31");
    h.resumen([
      { t: "Arreglo", texto: true, f: `${nMod}&" módulos de "&${pmod}&" W = "&ROUND(${pdc},2)&" kWp: "&${nUso}&" MPPT × "&${np}&" strings × "&${ns}&" módulos en serie"` },
      { t: "Inversor", texto: true, f: `${pac}&" kW, "&${vac}&" V "&IF(${fases}=3,"trifásico","monofásico")&" ("&ROUND(${iac},1)&" A)"` },
      { t: "Rango admisible de módulos en serie", texto: true, f: `${nsMin}&" a "&${nsMax}&" módulos (adoptado: "&${ns}&")"` },
      { t: "Relación DC/AC", f: ilr, u: "" }, { t: "Voc máxima del string (especificar DPS y conductores DC)", f: vOc, u: "V" },
      { t: "Fusibles de string", texto: true, f: `IF(${iInv}>${fusMax},"Requeridos: la corriente inversa supera el fusible máximo del módulo","No requeridos: la corriente inversa no supera el fusible máximo del módulo")` }
    ]);
  },
  fvProduccion(wb, e, r, p, ctx) {
    const h = new Hoja(wb, "x Producción FV", "Producción y balance energético (RETIE literal x; CREG 174 de 2021; IEC 61724-1)");
    const a = ctx.fvArreglo || {};
    const pdc = h.dato("Potencia pico del arreglo", n(e.pdc, a.pdc ?? 100), "kWp"), hsp = h.dato("Horas sol pico en el plano del arreglo", n(e.hsp, 5), "h/día");
    const tamb = h.dato("Temperatura ambiente media en horas de sol", n(e.tambSol, 30), "°C"), g = h.dato("Irradiancia media en horas de sol", n(e.gMedia, 800), "W/m²");
    const gP = h.dato("Coeficiente de temperatura de Pmax", n(e.gPmax, a.gPmax ?? -0.35), "%/°C"), noct = h.dato("NOCT", n(e.noct, a.noct ?? 45), "°C");
    h.seccion("Pérdidas");
    const ps = h.dato("Suciedad", n(e.pSuciedad, 3), "%"), pso = h.dato("Sombreado", n(e.pSombra, 0), "%"), pm = h.dato("Dispersión entre módulos (mismatch)", n(e.pMismatch, 2), "%");
    const pdcw = h.dato("Cableado DC", n(e.pCableDC, 1.5), "%"), ef = h.dato("Eficiencia europea del inversor", n(e.efInversor, 98), "%"), pacw = h.dato("Cableado AC", n(e.pCableAC, 1), "%"), pd = h.dato("Indisponibilidad", n(e.pDisp, 1), "%");
    const deg = h.dato("Degradación anual de los módulos", n(e.degradacion, 0.5), "%/año"), anios = h.dato("Vida útil de análisis", n(e.anios, 25), "años");
    h.seccion("Consumo y tarifas (balance según la CREG 174 de 2021)");
    const cons = h.dato("Consumo anual del usuario", n(e.consumo, 0), "kWh/año"), sim = h.dato("Simultaneidad (fracción consumida en el momento)", n(e.simultaneidad, 70), "%");
    const tar = h.dato("Tarifa de energía (CU)", n(e.tarifa, 0), "$/kWh"), com = h.dato("Componente de comercialización", n(e.comercializacion, 0), "$/kWh"), bol = h.dato("Precio de bolsa de referencia", n(e.bolsa, 0), "$/kWh");
    h.seccion("Cálculos");
    const tc = h.calc("Temperatura media de celda", `${tamb}+(${noct}-20)/800*${g}`, "°C");
    const pt = h.calc("Pérdida por temperatura", `MAX(0,-${gP}*(${tc}-25))`, "%");
    const pr = h.calc("Rendimiento global PR", `(1-${pt}/100)*(1-${ps}/100)*(1-${pso}/100)*(1-${pm}/100)*(1-${pdcw}/100)*(${ef}/100)*(1-${pacw}/100)*(1-${pd}/100)`, "");
    const e1 = h.calc("Energía del primer año", `${pdc}*${hsp}*365*${pr}`, "kWh/año"), ye = h.calc("Rendimiento específico", `${e1}/${pdc}`, "kWh/kWp");
    const et = h.calc("Energía en la vida útil", `IF(${deg}=0,${e1}*${anios},${e1}*(1-(1-${deg}/100)^${anios})/(${deg}/100))`, "kWh");
    const au = h.calc("Autoconsumo", `MIN(${e1}*${sim}/100,IF(${cons}>0,${cons},${e1}*${sim}/100))`, "kWh/año"), ex = h.calc("Excedentes entregados a la red", `${e1}-${au}`, "kWh/año");
    const im = h.calc("Importaciones de la red", `MAX(0,${cons}-${au})`, "kWh/año"), pe = h.calc("Excedentes permutados", `MIN(${ex},${im})`, "kWh/año"), ve = h.calc("Excedentes vendidos", `MAX(0,${ex}-${im})`, "kWh/año");
    const ah = h.calc("Ahorro e ingresos anuales estimados", `${au}*${tar}+${pe}*(${tar}-${com})+${ve}*${bol}`, "COP/año");
    const cob = h.calc("Cobertura del consumo", `IF(${cons}>0,${e1}/${cons}*100,0)`, "%");
    h.seccion("Verificaciones");
    h.verif("PR dentro del rango típico (0,70 a 0,90)", `AND(${pr}>=0.7,${pr}<=0.9)`, "IEC 61724-1 (referencia)");
    h.resumen([
      { t: "Energía del primer año", f: e1, u: "kWh/año" }, { t: "Rendimiento específico", f: ye, u: "kWh/kWp" }, { t: "Rendimiento global PR", f: `${pr}*100`, u: "%" },
      { t: "Energía en la vida útil", f: et, u: "kWh" }, { t: "Cobertura del consumo anual", f: cob, u: "%" },
      { t: "Balance", texto: true, f: `"Autoconsumo "&ROUND(${au},0)&" kWh; excedentes "&ROUND(${ex},0)&" kWh (permutados "&ROUND(${pe},0)&", vendidos "&ROUND(${ve},0)&"); importaciones "&ROUND(${im},0)&" kWh"` },
      { t: "Ahorro e ingresos anuales estimados (indicativo)", f: ah, u: "COP/año" }
    ]);
  },
  fvConductores(wb, e, r, p, ctx) {
    const h = new Hoja(wb, "k-m Conductores FV", "Conductores y protecciones del sistema fotovoltaico (RETIE literales k y m; NTC 2050 690-8)");
    const a = ctx.fvArreglo || {};
    const dvMax = h.dato("Caída de tensión máxima por circuito", n(e.dvMax, 1.5), "%"), dvTot = h.dato("Caída de tensión máxima total (DC más AC)", n(e.dvTotalMax, 3), "%");
    const fases = h.dato("Fases del inversor (3 o 1)", a.tri === false ? 1 : 3, ""), fusReq = h.dato("Fusibles de string requeridos (1 = sí)", a.fusibles ? 1 : 0, "", "Resultado del arreglo FV"), fusMax = h.dato("Fusible máximo del módulo", a.fusMax ?? 25, "A");
    h.seccion("Circuitos");
    const prot = (c, iDis) => n(c.proteccion, 0) || N.PROTECCIONES_NORMALIZADAS.find((x) => x >= iDis - 1e-9) || 0;
    const filas = vacias(e.circuitos).map((c) => {
      const tipo = c.tipo || "DC string", dc = tipo.startsWith("DC");
      const base = n(c.corriente, NaN);
      const iBase = Number.isFinite(base) ? base : tipo === "DC string" ? a.isc ?? 0 : tipo === "DC agrupado" ? (a.isc ?? 0) * (a.np ?? 1) : a.iac ?? 0;
      const V = n(c.tension, NaN);
      return { ...c, tipo, iBase, v: Number.isFinite(V) ? V : dc ? a.vmpStr ?? 700 : a.vac ?? 480, prot: prot(c, (dc ? iBase * 1.25 : iBase) * 1.25) };
    });
    const t = h.tabla([
      { t: "Circuito", v: (f) => String(f.tramo || f.tipo), ancho: 18 }, { t: "Tipo", v: (f) => f.tipo, entrada: true, lista: ["DC string", "DC agrupado", "AC"], ancho: 12 },
      { t: "Mat.", v: (f) => (f.material === "Al" ? "Al" : "Cu"), entrada: true, lista: ["Cu", "Al"] }, { t: "Calibre", v: (f) => String(f.calibre || "10"), entrada: true },
      { t: "I base (A)", v: (f) => f.iBase, entrada: true, fmt: "0.0" }, { t: "T amb. (°C)", v: (f) => n(f.tAmb, n(p.tempAmbiente, 30)), entrada: true },
      { t: "+ °C por sol", v: (f) => n(f.adicional, 0), entrada: true }, { t: "Portadores", v: (f) => n(f.portadores, 2), entrada: true },
      { t: "L (m)", v: (f) => n(f.longitud, 0), entrada: true }, { t: "V (V)", v: (f) => f.v, entrada: true, fmt: "0" }, { t: "Protección (A)", v: (f) => f.prot, entrada: true },
      { t: "I máx. (A)", v: (f, rr) => `=IF(LEFT(B${rr},2)="DC",E${rr}*1.25,E${rr})`, fmt: "0.0" },
      { t: "I diseño 125 % (A)", v: (f, rr) => `=L${rr}*1.25`, fmt: "0.0" },
      { t: "Capacidad corregida 90 °C (A)", v: (f, rr) => `=VLOOKUP(D${rr},${T.cond},IF(C${rr}="Al",7,4),FALSE)*INDEX(${T.temp},MATCH(F${rr}+G${rr},${T.tempDesde},1),4)*INDEX(${T.agr},MATCH(H${rr},${T.agrDesde},1),2)`, fmt: "0.0" },
      { t: "Capacidad 75 °C (A)", v: (f, rr) => `=VLOOKUP(D${rr},${T.cond},IF(C${rr}="Al",6,3),FALSE)`, fmt: "0" },
      { t: "R (Ω/km)", v: (f, rr) => `=VLOOKUP(D${rr},${T.cond},IF(C${rr}="Al",11,9),FALSE)`, fmt: "0.000" },
      { t: "ΔV (%)", v: (f, rr) => `=IF(I${rr}=0,0,IF(LEFT(B${rr},2)="DC",2,IF(${fases}=3,SQRT(3),2))*L${rr}*I${rr}/1000*P${rr}/J${rr}*100)`, fmt: "0.00" },
      { t: "Tierra de equipos", v: (f, rr) => `=${sigNormTierra(`K${rr}`)}` },
      { t: "Resultado", v: (f, rr) => `=IF(AND(N${rr}>=L${rr},O${rr}>=M${rr},Q${rr}<=${dvMax},IF(B${rr}="DC string",IF(${fusReq}=1,AND(K${rr}>=M${rr},K${rr}<=${fusMax}),TRUE),AND(K${rr}>=M${rr},K${rr}<=${sigNorm(`N${rr}`, T.prot)}))),"Cumple","No cumple")` }
    ], filas);
    const R = (c) => `${c}${t.r0}:${c}${t.r1}`;
    const dvT = h.calc("Caída de tensión total (mayor DC más mayor AC)", `IFERROR(_xlfn.AGGREGATE(14,6,${R("Q")}/(LEFT(${R("B")},2)="DC"),1),0)+IFERROR(_xlfn.AGGREGATE(14,6,${R("Q")}/(${R("B")}="AC"),1),0)`, "%");
    h.verif("Caída de tensión total ≤ máxima", `${dvT}<=${dvTot}`, "Criterio de diseño");
    h.resumen(filas.map((f, i) => { const rr = t.r0 + i; return { t: String(f.tramo || f.tipo), texto: true, f: `"Conductor "&C${rr}&" "&D${rr}&" ("&B${rr}&"): capacidad "&ROUND(N${rr},1)&" A para "&ROUND(L${rr},1)&" A; protección "&IF(AND(B${rr}="DC string",${fusReq}=0),"no requerida",K${rr}&" A")&"; tierra "&R${rr}&"; caída "&ROUND(Q${rr},2)&" %"` }; }));
  },
  fvConexion(wb, e, r, p, ctx) {
    const h = new Hoja(wb, "x Conexión FV", "Conexión a la red de AGPE y GD (RETIE literal x; CREG 174 de 2021; IEEE 1547)");
    const a = ctx.fvArreglo || {};
    const tipo = h.dato("Tipo de generador (AGPE o GD)", e.tipo === "GD" ? "GD" : "AGPE", "");
    const pac = h.dato("Potencia nominal AC", n(e.pac, a.pac ?? 100), "kW"), v = h.dato("Tensión del punto de conexión", n(e.tension, (a.vac ?? 480) / 1000), "kV");
    const sk = h.dato("Potencia de cortocircuito en el punto de conexión", n(e.sk, 20), "MVA"), rx = h.dato("Relación R/X de la red", n(e.rxRed, 0.5), "");
    const dmin = h.dato("Demanda mínima del usuario en horas de sol", n(e.demandaMin, 0), "kW"), fp = h.dato("Factor de potencia de la inyección", Math.min(1, Math.max(0.8, n(e.fp, 1))), ""), dvMax = h.dato("Elevación de tensión máxima admitida", n(e.dvMax, 2), "%");
    const cap = h.dato("Capacidad disponible publicada por el operador de red (0 = sin dato)", n(e.capacidadDisponible, 0), "kW"), icu = h.dato("Capacidad de interrupción de los equipos (0 = sin dato)", n(e.icu, 0), "kA"), ap = h.dato("Aporte del inversor al cortocircuito (veces In)", n(e.aporte, 1.2), "");
    const ai = h.dato("Inversor con anti-isla certificada (Sí/No)", e.antiIsla === "No" ? "No" : "Sí", ""), med = h.dato("Medidor bidireccional (Sí/No)", e.medidor === "No" ? "No" : "Sí", "");
    h.seccion("Cálculos");
    const clase = h.calc("Clasificación y procedimiento", `IF(${tipo}="GD",IF(${pac}<=1000,"Generador distribuido (GD), hasta 1 MW","Fuera del rango de GD (más de 1 MW)"),IF(${pac}<=100,"AGPE hasta 0,1 MW: procedimiento simplificado, sin estudio de conexión",IF(${pac}<=1000,"AGPE entre 0,1 y 1 MW: requiere estudio de conexión simplificado","Autogenerador a gran escala (más de 1 MW)")))`, "");
    const z = h.calc("Impedancia de la red Z", `${v}^2/${sk}`, "Ω"), x = h.calc("Reactancia X", `${z}/SQRT(1+${rx}^2)`, "Ω"), rr = h.calc("Resistencia R", `${rx}*${x}`, "Ω");
    const pe = h.calc("Potencia exportada en el peor caso", `MAX(0,${pac}-${dmin})/1000`, "MW"), qe = h.calc("Potencia reactiva de la inyección", `${pe}*TAN(ACOS(${fp}))`, "MVAr");
    const dv = h.calc("Elevación de tensión en el punto de conexión", `(${pe}*${rr}+${qe}*${x})/${v}^2*100`, "%");
    const iac = h.calc("Corriente nominal del inversor", `${pac}*1000/(SQRT(3)*${v}*1000)`, "A");
    const ikr = h.calc("Cortocircuito de la red", `${sk}/(SQRT(3)*${v})`, "kA"), iki = h.calc("Aporte del inversor al cortocircuito", `${ap}*${iac}/1000`, "kA"), ikt = h.calc("Cortocircuito total", `${ikr}+${iki}`, "kA");
    const scr = h.calc("Relación de cortocircuito Sk / Pac", `${sk}*1000/${pac}`, "");
    h.seccion("Verificaciones");
    h.verif("Potencia dentro del límite de AGPE o GD (1 MW)", `${pac}<=1000`, "CREG 174 de 2021");
    h.verif("Potencia ≤ capacidad disponible del operador de red (si hay dato)", `OR(${cap}=0,${pac}<=${cap})`, "CREG 174 de 2021");
    h.verif("Elevación de tensión ≤ máxima admitida", `${dv}<=${dvMax}`, "Criterio de diseño / operador de red");
    h.verif("Capacidad de interrupción ≥ cortocircuito total (si hay dato)", `OR(${icu}=0,${icu}>=${ikt})`, "RETIE / IEC 60909");
    h.verif("Anti-isla certificada", `${ai}="Sí"`, "IEC 62116 / UL 1741");
    h.verif("Medidor bidireccional", `${med}="Sí"`, "CREG 174 de 2021");
    h.seccion("Ajustes de referencia de las protecciones de interconexión (IEEE 1547-2018, categoría II)");
    h.tabla([{ t: "Función", v: (f) => f[0], ancho: 30 }, { t: "Ajuste", v: (f) => f[1] }, { t: "Tiempo de despeje", v: (f) => f[2] }], N.AJUSTES_IEEE1547);
    h.resumen([
      { t: "Clasificación", texto: true, f: clase }, { t: "Elevación de tensión en el punto de conexión", f: dv, u: "%" },
      { t: "Cortocircuito total en el punto de conexión", f: ikt, u: "kA", nota: "Capacidad de interrupción mínima de los equipos" },
      { t: "Relación de cortocircuito Sk / Pac", f: scr, u: "", nota: "Mientras mayor, más robusta es la red frente a la inyección" },
      { t: "Requisitos de conexión", texto: true, valor: "Inversor con anti-isla certificada, medidor bidireccional y ajustes de protección aprobados por el operador de red; solicitud de conexión en la plataforma del operador (CREG 174 de 2021)." }
    ]);
  }
};

// Descripción corta de cada hoja de cálculo para el índice de la portada.
const DESCRIPCION_HOJA = {
  cargas: "Carga instalada, demanda, balance de fases y corriente del alimentador",
  conductores: "Calibre del conductor y protección de cada circuito de baja tensión",
  regulacion: "Caída de tensión por tramo y acumulada, y pérdidas",
  canalizaciones: "Llenado de tuberías y ductos",
  transformador: "Potencia, protecciones y cargabilidad del transformador de distribución",
  trafoPotencia: "Corrientes, cortocircuito pasante, TC y equipos del transformador de potencia",
  cortocircuito: "Corrientes de cortocircuito trifásica, monofásica y pico por barra",
  cableMT: "Capacidad, cortocircuito y caída de tensión de los cables de media tensión",
  coordinacion: "Tiempos de operación y márgenes entre protecciones",
  malla: "Tensiones de paso y contacto, resistencia y conductor de la malla",
  rayos: "Riesgo de pérdida de vidas humanas R1 por rayos",
  apantallamiento: "Zona protegida por mástiles y cables de guarda",
  aislamiento: "Selección del DPS y margen de protección del aislamiento",
  distancias: "Distancias mínimas de seguridad",
  mecanico: "Tensiones y flechas del conductor por cambio de estado",
  fvArreglo: "Módulos en serie y paralelo, tensiones y corrientes frente al inversor",
  fvProduccion: "Energía anual, PR, vida útil y balance con el consumo (CREG 174)",
  fvConductores: "Conductores, protecciones, tierra y caída de tensión DC y AC",
  fvConexion: "Clasificación AGPE/GD, elevación de tensión y requisitos de conexión"
};

function bandaTitulo(ws, texto, sub, cols) {
  ws.mergeCells(1, 1, 1, cols);
  const t = ws.getCell("A1"); t.value = texto; t.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } }; t.fill = relleno(C_NAVY); t.alignment = { vertical: "middle", indent: 1, wrapText: true };
  ws.getRow(1).height = 36;
  ws.mergeCells(2, 1, 2, cols);
  const s = ws.getCell("A2"); s.value = sub; s.font = { italic: true, size: 10, color: { argb: C_GRIS_TXT } }; s.alignment = { indent: 1 };
}

export async function construirLibro({ proyecto, resultados, guardados }, ExcelJS = window.ExcelJS) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AHÍNCO — Cinco S.A.S.";
  wb.calcProperties.fullCalcOnLoad = true;
  hojasCreadas.length = 0;
  const verif = esVerificacion(proyecto);
  const tituloDoc = verif ? "Verificación de la memoria de cálculo" : "Memoria de cálculo";
  proyectoActual = `${proyecto.nombre}${proyecto.cliente ? ` · ${proyecto.cliente}` : ""}`;

  // ---- portada (el índice se llena al final, cuando existen todas las hojas)
  const port = wb.addWorksheet("Portada", { properties: { tabColor: { argb: C_NAVY } }, pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  port.columns = [{ width: 32 }, { width: 62 }, { width: 50 }];
  bandaTitulo(port, `${tituloDoc} — ${proyecto.nombre}`, "Libro formulado generado con AHÍNCO — Cinco S.A.S.", 3);
  const datos = [["Tipo de documento", verif ? "Verificación de interventoría" : "Diseño"], ["Cliente", proyecto.cliente], ["Ubicación", proyecto.ubicacion], ["Altitud (m s. n. m.)", proyecto.altitud], ["Temperatura ambiente de diseño (°C)", proyecto.tempAmbiente], ...(verif ? [["Diseño revisado", proyecto.autorDiseno], ["Documentos revisados", proyecto.documentosRevisados]] : []), [verif ? "Interventor que verifica" : "Diseñador", proyecto.disenador], ["Matrícula profesional", proyecto.matricula]];
  let pr = 4;
  datos.forEach(([k, v]) => {
    const a = port.getCell(`A${pr}`); a.value = k; a.font = { bold: true, size: 10 }; a.fill = relleno(C_SECCION); a.border = BORDES;
    port.mergeCells(pr, 2, pr, 3);
    const b = port.getCell(`B${pr}`); b.value = v ?? ""; b.font = { size: 10 }; b.border = BORDES; b.alignment = { wrapText: true, horizontal: "left" };
    port.getRow(pr).height = String(v ?? "").length > 110 ? 30 : 16;
    pr++;
  });
  pr++;
  const guia = [
    ["Cómo usar este libro", ""],
    ["1. Celdas amarillas (letra azul)", "Son los datos de entrada. Puede cambiarlos: todo el libro se recalcula solo."],
    ["2. Celdas grises", "Son fórmulas. Están protegidas: se pueden ver y seleccionar, pero no modificar."],
    ["3. Columna «Cómo se calcula»", "Explica cada fórmula con el nombre de sus variables, para seguir el cálculo sin descifrar referencias de celdas."],
    ["4. Constantes", "Al inicio de cada hoja hay una tabla con los factores fijos que usan las fórmulas, su significado y la norma de donde salen."],
    ["5. Verde y rojo", "«Cumple» aparece en verde y «No cumple» en rojo. Si cambia un dato, el color cambia con el resultado."],
    ["6. Resumen de la selección", "Al final de cada hoja se resumen los equipos, componentes y especificaciones seleccionados, y el estado general de la hoja."],
    ["7. Hoja «Tablas»", "Contiene las tablas normativas (conductores, factores, protecciones, tuberías, curvas) que consultan las fórmulas."]
  ];
  guia.forEach(([a, b], i) => {
    const ca = port.getCell(`A${pr}`); ca.value = a;
    if (i === 0) { port.mergeCells(pr, 1, pr, 3); ca.font = { bold: true, size: 12, color: { argb: C_NAVY } }; ca.fill = relleno(C_SECCION); ca.border = { left: { style: "thick", color: { argb: C_NARANJA } } }; }
    else { ca.font = { bold: true, size: 10 }; port.mergeCells(pr, 2, pr, 3); const cb = port.getCell(`B${pr}`); cb.value = b; cb.font = { size: 10 }; cb.alignment = { wrapText: true }; }
    pr++;
  });
  if (i0Muestras(port, pr - guia.length + 1)) { /* muestras de color en la guía */ }
  pr++;
  const filaIndice = pr;

  // ---- literales
  const lit = wb.addWorksheet("Literales RETIE", { properties: { tabColor: { argb: C_NAVY } }, pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  lit.columns = [{ width: 6 }, { width: 62 }, { width: 9 }, { width: 80 }];
  bandaTitulo(lit, "Diseño detallado según el RETIE: literales a) a x)", FUENTE_LITERALES, 4);
  ["Lit.", "Contenido exigido", "Aplica", "Desarrollo / cálculo / justificación"].forEach((h, i) => { const c = lit.getCell(4, i + 1); c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }; c.fill = relleno(C_NAVY); c.border = BORDES; c.alignment = { vertical: "middle" }; });
  LITERALES.forEach((l, i) => {
    const d = proyecto.literales?.[l.l] || {};
    const mods = Object.entries(resultados).filter(([k, r]) => l.modulos.includes(r.modulo ?? k)).map(([k, r]) => `${MODULOS[r.modulo ?? k].titulo}${r.etiqueta ? ` — ${r.etiqueta}` : ""}`);
    const fila = lit.getRow(5 + i);
    const texto = d.aplica === "No" ? `No aplica: ${d.texto || ""}` : [mods.length ? `Ver hoja: ${mods.join("; ")}` : "", d.texto || ""].filter(Boolean).join(" — ") || "Pendiente";
    fila.values = [`${l.l})`, l.texto, d.aplica === "No" ? "No" : "Sí", texto];
    fila.alignment = { wrapText: true, vertical: "top" };
    fila.eachCell((c) => { c.border = BORDES; c.font = { size: 9.5 }; });
    lit.getCell(5 + i, 1).font = { bold: true, size: 10 };
    lit.getCell(5 + i, 3).alignment = { horizontal: "center", vertical: "top" };
    lit.getCell(5 + i, 3).fill = relleno(d.aplica === "No" ? "FFEDEFF2" : "FFE6F4EA");
    if (i % 2) [1, 2, 4].forEach((ci) => { lit.getCell(5 + i, ci).fill = relleno("FFFAFBFC"); });
    fila.height = Math.max(16, 13 * Math.max(Math.ceil(l.texto.length / 60), Math.ceil(texto.length / 78)) + 4);
  });
  lit.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];

  // ---- hallazgos (o pendientes) y supuestos, como valores: resumen para el oficio
  const hall = hallazgos(proyecto, resultados), sup = supuestos(proyecto, guardados || {});
  if (hall.length || sup.length) {
    const hs = wb.addWorksheet(verif ? "Hallazgos" : "Pendientes", { properties: { tabColor: { argb: "FFD64545" } }, pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    hs.columns = [{ width: 7 }, { width: 30 }, { width: 46 }, { width: 16 }, { width: 22 }, { width: 40 }, { width: 8 }];
    bandaTitulo(hs, verif ? "Hallazgos de la interventoría" : "Pendientes por corregir", verif ? "Criterios que no cumplen en el diseño revisado: el contratista debe aclararlos o corregirlos." : "Criterios que todavía no cumplen: corríjalos antes de entregar la memoria.", 7);
    const enc = (fila, textos) => textos.forEach((t, i) => { const c = hs.getCell(fila, i + 1); c.value = t; c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 }; c.fill = relleno(C_NAVY); c.border = BORDES; c.alignment = { wrapText: true, vertical: "middle" }; });
    let f = 4;
    enc(f++, ["N.º", "Cálculo", "Criterio", "Valor", "Límite", "Norma o referencia", "Lit."]);
    hall.forEach((h) => {
      hs.getRow(f).values = [h.codigo, h.calculo, h.criterio, h.valor, h.limite, h.norma, h.literales];
      hs.getRow(f).alignment = { wrapText: true, vertical: "top" };
      hs.getRow(f).eachCell((c) => { c.border = BORDES; c.font = { size: 9 }; });
      hs.getCell(f, 1).font = { bold: true, size: 9, color: { argb: "FFB42318" } };
      hs.getRow(f).height = 13 * Math.max(2, Math.ceil(h.criterio.length / 44), Math.ceil(h.norma.length / 38)) + 4;
      f++;
    });
    if (sup.length) {
      f++;
      hs.mergeCells(f, 1, f, 7);
      const st = hs.getCell(f, 1); st.value = "Supuestos y datos pendientes (valores marcados «(S)»)"; st.font = { bold: true, size: 11, color: { argb: C_NAVY } }; st.fill = relleno(C_SECCION); f++;
      enc(f, ["", "Origen", "Supuesto"]); hs.mergeCells(f, 3, f, 7); f++;
      sup.forEach((x) => {
        hs.getRow(f).values = ["", x.origen, x.texto]; hs.mergeCells(f, 3, f, 7);
        hs.getRow(f).alignment = { wrapText: true, vertical: "top" };
        [2, 3].forEach((ci) => { hs.getCell(f, ci).border = BORDES; hs.getCell(f, ci).font = { size: 9 }; });
        hs.getRow(f).height = 13 * Math.max(1, Math.ceil(x.texto.length / 125)) + 4;
        f++;
      });
    }
    hs.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];
  }
  hojaTablas(wb);
  const tablas = wb.getWorksheet("Tablas");
  tablas.properties.tabColor = { argb: "FF8A94A3" };
  tablas.views = [{ showGridLines: false }];

  // ---- hojas de cálculo en el orden de los literales
  const ctx = {};
  Object.entries(resultados).forEach(([k, r]) => { const m = r.modulo ?? k; if (r.salidas && !ctx[m]) ctx[m] = r.salidas; });
  const orden = ["rayos", "apantallamiento", "cargas", "aislamiento", "cortocircuito", "transformador", "trafoPotencia", "malla", "conductores", "cableMT", "mecanico", "coordinacion", "canalizaciones", "regulacion", "distancias", "fvArreglo", "fvProduccion", "fvConductores", "fvConexion"];
  const indice = [];
  for (const m of orden) {
    for (const [clave, r] of Object.entries(resultados)) {
      if ((r.modulo ?? clave) !== m || !guardados[clave]?.entradas) continue;
      etiquetaActual = r.etiqueta || ""; moduloActual = m;
      const antes = hojasCreadas.length;
      HOJAS[m](wb, guardados[clave].entradas, r, proyecto, ctx);
      if (hojasCreadas.length > antes) indice.push({ hoja: hojasCreadas[hojasCreadas.length - 1].ws.name, texto: `${MODULOS[m].titulo}${r.etiqueta ? ` — ${r.etiqueta}` : ""}`, desc: DESCRIPCION_HOJA[m] || "" });
    }
  }
  etiquetaActual = ""; moduloActual = "";
  hojasCreadas.forEach((h) => h.finalizar());
  tablas.orderNo = 1000;

  // ---- índice de la portada (con enlaces a cada hoja)
  let ir = filaIndice;
  port.mergeCells(ir, 1, ir, 3);
  const ti = port.getCell(`A${ir}`); ti.value = "Índice de hojas"; ti.font = { bold: true, size: 12, color: { argb: C_NAVY } }; ti.fill = relleno(C_SECCION); ti.border = { left: { style: "thick", color: { argb: C_NARANJA } } };
  ir++;
  ["Hoja", "Cálculo", "Qué contiene"].forEach((t, i) => { const c = port.getCell(ir, i + 1); c.value = t; c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } }; c.fill = relleno(C_NAVY); c.border = BORDES; });
  ir++;
  const fijas = [{ hoja: "Literales RETIE", texto: "Literales a) a x)", desc: "Qué exige el RETIE en cada literal y dónde se desarrolla" }, ...(hall.length || sup.length ? [{ hoja: verif ? "Hallazgos" : "Pendientes", texto: verif ? "Hallazgos" : "Pendientes", desc: "Criterios que no cumplen y supuestos por confirmar" }] : [])];
  [...fijas, ...indice, { hoja: "Tablas", texto: "Tablas normativas", desc: "Tablas que consultan las fórmulas" }].forEach((x) => {
    const a = port.getCell(`A${ir}`); a.value = { text: x.hoja, hyperlink: `#'${x.hoja}'!A1` }; a.font = { size: 10, color: { argb: C_AZUL }, underline: true };
    port.getCell(`B${ir}`).value = x.texto; port.getCell(`C${ir}`).value = x.desc;
    [1, 2, 3].forEach((ci) => { port.getCell(ir, ci).border = BORDES; if (ci > 1) port.getCell(ir, ci).font = { size: 10 }; });
    ir++;
  });
  port.views = [{ showGridLines: false }];

  // ---- protección: las fórmulas se ven pero no se cambian (las celdas de
  // entrada quedaron desbloqueadas al escribirlas)
  for (const ws of wb.worksheets) {
    await ws.protect(CLAVE_PROTECCION, { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true, sort: false, autoFilter: false });
  }
  return wb;
}

// Muestras de color junto a los pasos 1 y 2 de la guía.
function i0Muestras(ws, filaPaso1) {
  const a = ws.getCell(`A${filaPaso1}`); a.fill = relleno(C_AMARILLO); a.font = { bold: true, size: 10, color: { argb: C_AZUL } };
  const b = ws.getCell(`A${filaPaso1 + 1}`); b.fill = relleno(C_GRIS);
  const v = ws.getCell(`A${filaPaso1 + 4}`); v.font = { bold: true, size: 10, color: { argb: C_VERDE_TXT } };
  return true;
}

export async function descargarExcel(datos) {
  const { proyecto } = datos;
  const wb = await construirLibro(datos);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${esVerificacion(proyecto) ? "Verificacion" : "Memoria de calculo"} formulada - ${String(proyecto.nombre || "proyecto").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
