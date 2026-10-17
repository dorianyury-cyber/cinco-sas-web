// Libro de Excel formulado de AHÍNCO: un solo archivo con la portada, los
// literales a) a x) del RETIE, una hoja por cálculo y la hoja "Tablas" con
// las tablas normativas. Las celdas amarillas son datos de entrada y las
// demás son fórmulas vivas: el ingeniero puede cambiar un dato y Excel
// recalcula la memoria (también las verificaciones "Cumple / No cumple").
import * as N from "./rt-normas.js";
import { MODULOS } from "./rt-modulos.js";
import { LITERALES, FUENTE_LITERALES } from "./rt-literales.js";
import { SISTEMAS_BT, impedanciaConductor } from "./rt-calculos.js";

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
  T.curvas = `Tablas!$A$${iniC}:$C$${r - 1}`;
  ws.eachRow((row) => row.eachCell((c) => { c.border = BORDES; if (!c.font?.bold) c.font = { size: 9 }; }));
  return ws;
}

// ---------------------------------------------------------------- utilidades de hoja
// Identificación del cálculo que se está escribiendo (un módulo puede tener
// varios cálculos en el proyecto: la hoja lleva su etiqueta).
let etiquetaActual = "";
class Hoja {
  constructor(wb, nombre, titulo, anchos = [44, 18, 14, 50]) {
    const limpio = (t) => String(t).replace(/[\\/?*[\]:]/g, "-");
    const base = limpio(etiquetaActual ? `${nombre} ${etiquetaActual}` : nombre).slice(0, 31);
    let nombreHoja = base, k = 2;
    while (wb.getWorksheet(nombreHoja)) nombreHoja = `${base.slice(0, 27)} (${k++})`;
    this.ws = wb.addWorksheet(nombreHoja);
    this.ws.columns = anchos.map((w) => ({ width: w }));
    this.r = 1;
    const c = this.ws.getCell("A1");
    c.value = etiquetaActual ? `${titulo} — ${etiquetaActual}` : titulo; c.font = { bold: true, size: 13, color: { argb: NAVY } };
    this.r = 3;
  }
  nota(texto) { const c = this.ws.getCell(`A${this.r}`); c.value = texto; c.font = { italic: true, size: 9, color: { argb: "FF5C6570" } }; this.r++; }
  seccion(texto) { this.r++; const c = this.ws.getCell(`A${this.r}`); c.value = texto; c.font = { bold: true, color: { argb: NAVY } }; this.r++; }
  // Fila "Parámetro | valor | unidad | nota" — devuelve la dirección del valor.
  fila(etiqueta, valor, unidad = "", nota = "", entrada = false) {
    const r = this.r++;
    this.ws.getCell(`A${r}`).value = etiqueta;
    const c = this.ws.getCell(`B${r}`);
    c.value = typeof valor === "string" && valor.startsWith("=") ? { formula: valor.slice(1) } : valor;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: entrada ? AMARILLO : GRIS } };
    c.numFmt = typeof valor === "string" && !valor.startsWith("=") ? "@" : "General";
    this.ws.getCell(`C${r}`).value = unidad;
    if (nota) { const x = this.ws.getCell(`D${r}`); x.value = nota; x.font = { size: 9, color: { argb: "FF5C6570" } }; }
    [`A${r}`, `B${r}`, `C${r}`, `D${r}`].forEach((a) => { this.ws.getCell(a).border = BORDES; });
    return `$B$${r}`;
  }
  dato(etiqueta, valor, unidad, nota) { return this.fila(etiqueta, valor, unidad, nota, true); }
  calc(etiqueta, formula, unidad, nota) { return this.fila(etiqueta, `=${formula}`, unidad, nota, false); }
  verif(etiqueta, condicion, nota) { return this.calc(etiqueta, `IF(${condicion},"Cumple","No cumple")`, "", nota); }
  // Tabla por filas. columnas: [{t: encabezado, ancho, v: (fila, r) => valor | "=fórmula", entrada}]
  tabla(columnas, datos) {
    const ws = this.ws, r0 = this.r;
    columnas.forEach((c, i) => {
      const cel = ws.getCell(r0, i + 1);
      cel.value = c.t; cel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cel.alignment = { wrapText: true, vertical: "middle" }; cel.border = BORDES;
      if (c.ancho && (ws.getColumn(i + 1).width || 0) < c.ancho) ws.getColumn(i + 1).width = c.ancho;
    });
    datos.forEach((d, k) => {
      const r = r0 + 1 + k;
      columnas.forEach((c, i) => {
        const v = c.v(d, r), cel = ws.getCell(r, i + 1);
        cel.value = typeof v === "string" && v.startsWith("=") ? { formula: v.slice(1) } : v;
        cel.border = BORDES;
        cel.font = { size: 9 };
        if (c.entrada) cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMARILLO } };
        if (typeof v === "string" && !v.startsWith("=")) cel.numFmt = "@";
        else if (c.fmt) cel.numFmt = c.fmt;
      });
    });
    this.r = r0 + datos.length + 2;
    return { r0: r0 + 1, r1: r0 + datos.length, col: (k) => col(columnas.findIndex((c) => c.k === k)) };
  }
}
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
      { t: "Tipo", k: "tipo", v: (f) => String(f.tipo ?? ""), entrada: true }, { t: "Cant.", k: "cant", v: (f) => n(f.cantidad, 1), entrada: true },
      { t: "P unit. (W)", k: "pu", v: (f) => n(f.potencia), entrada: true }, { t: "fp", k: "fp", v: (f) => n(f.fp, 0.9), entrada: true },
      { t: "FD (%)", k: "fd", v: (f) => n(f.fd, 100), entrada: true }, { t: "Fases", k: "fs", v: (f) => String(f.fases || "A"), entrada: true },
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
    h.calc("Demanda máxima", `SUM(${R("K")})/1000`, "kVA");
    const ia = h.calc("Corriente fase A", `SUM(${R("L")})/${vln}`, "A"), ib = h.calc("Corriente fase B", `SUM(${R("M")})/${vln}`, "A"), ic = h.calc("Corriente fase C", `SUM(${R("N")})/${vln}`, "A");
    const lista = `IF(LEN(${fasesSis})=1,${ia},IF(LEN(${fasesSis})=2,MAX(${ia},${ib}),MAX(${ia},${ib},${ic})))`;
    const imax = h.calc("Corriente de la fase más cargada", lista, "A");
    const des = h.calc("Desbalance entre fases", `IF(LEN(${fasesSis})=1,0,IF(LEN(${fasesSis})=2,(MAX(${ia},${ib})-MIN(${ia},${ib}))/AVERAGE(${ia},${ib}),(MAX(${ia},${ib},${ic})-MIN(${ia},${ib},${ic}))/AVERAGE(${ia},${ib},${ic})))*100`, "%");
    h.calc("Corriente de diseño del alimentador", `${imax}+0.25*MAX(${R("O")})`, "A", "NTC 2050 430-24");
    const dmax = h.dato("Desbalance máximo admisible", n(e.desbalanceMax, 10), "%");
    h.verif("Verificación del desbalance", `${des}<=${dmax}`, "Criterio de diseño");
    h.verif("Factor de potencia promedio ≥ 0,90", `SUMPRODUCT(${R("I")},${R("G")})/100/SUM(${R("K")})>=0.9`, "Referencia Res. CREG 015 de 2018");
    void sInst;
  },
  conductores(wb, e, r, p) {
    const h = new Hoja(wb, "k-m Conductores", "Selección de conductores y protecciones (RETIE literales k y m; NTC 2050)");
    h.nota("El calibre adoptado es el que seleccionó AHÍNCO; cámbielo y la hoja verifica de nuevo capacidad, terminales y protección.");
    const sel = r?.tablas?.[0]?.filas || [];
    const filas = vacias(e.circuitos).map((f, i) => ({ ...f, cal: String(sel[i]?.[4] || "").replace(/ (AWG|kcmil)$/, "") || "4/0" }));
    const colAmp = (rr, tcol) => `IF($E${rr}="Al",4,1)+MATCH(${tcol}${rr},{60,75,90},0)`;
    h.tabla([
      { t: "Circ.", v: (f) => String(f.circuito ?? ""), entrada: true, ancho: 7 }, { t: "Descripción", v: (f) => String(f.descripcion ?? ""), entrada: true, ancho: 22 },
      { t: "I carga (A)", v: (f) => n(f.corriente), entrada: true }, { t: "Continua", v: (f) => String(f.continua || "Sí"), entrada: true },
      { t: "Mat.", v: (f) => (f.material === "Al" ? "Al" : "Cu"), entrada: true }, { t: "T aisl.", v: (f) => n(f.tAisl, 90), entrada: true },
      { t: "T term.", v: (f) => n(f.tTerm, 75), entrada: true }, { t: "Portad.", v: (f) => n(f.portadores, 3), entrada: true },
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
    h.calc("Pérdidas totales", `SUM(N${t.r0}:N${t.r1})`, "kW");
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
    h.tabla([
      { t: "Ducto", v: (d) => d.ducto, ancho: 14 }, { t: "Tipo (EMT/IMC/PVC40)", v: (d) => d.tipo, entrada: true }, { t: "Tamaño adoptado", v: (d) => d.tam, entrada: true },
      { t: "N.º conductores", v: (d, rr) => `=SUMIF(${rng("A")},A${rr},${rng("C")})` }, { t: "Área cond. (mm²)", v: (d, rr) => `=SUMIF(${rng("A")},A${rr},${rng("D")})`, fmt: "0.0" },
      { t: "Llenado máx. (%)", v: (d, rr) => `=IF(D${rr}=1,53,IF(D${rr}=2,31,40))` },
      { t: "Área tubería (mm²)", v: (d, rr) => `=VLOOKUP(C${rr},${T.tub},MATCH(B${rr},{"EMT","IMC","PVC40"},0)+1,FALSE)` },
      { t: "Llenado (%)", v: (d, rr) => `=E${rr}/G${rr}*100`, fmt: "0.0" }, { t: "Resultado", v: (d, rr) => `=IF(H${rr}<=F${rr},"Cumple","No cumple")` }
    ], ductos);
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
    h.calc("Fusible primario tipo K (≈ 1,5 Ip)", sigNorm(`1.5*${ip}`, T.fusK), "A");
    const inb = h.calc("Interruptor general BT", sigNorm(is, T.prot), "A");
    const cmax = h.dato("Cargabilidad máxima admisible", n(e.cargaMax, 80), "%");
    const carga = h.calc("Cargabilidad actual", `${dem}/${sn}*100`, "%"), fut = h.calc("Cargabilidad con crecimiento", `${sreq}/${sn}*100`, "%");
    h.verif("Cargabilidad actual", `${carga}<=${cmax}`);
    h.verif("Cargabilidad con crecimiento", `${fut}<=100`);
    h.verif("Protección del secundario (450-3(b))", `${inb}<=${sigNorm(`1.25*${is}`, T.prot)}`);
  },
  cortocircuito(wb, e, r, p, ctx) {
    const h = new Hoja(wb, "e Cortocircuito", "Cortocircuito según IEC 60909-0 (RETIE literales e y k)");
    const un = h.dato("Tensión nominal BT Un", n(e.uBT, ctx.transformador?.vs ?? 208), "V");
    const c = h.dato("Factor de tensión c", n(e.factorC, 1.05), "", "IEC 60909-0 Tabla 1");
    const umt = h.dato("Tensión nominal MT", n(e.uMT, 13.2), "kV"), sk = h.dato("S\"kQ de la red", n(e.sk, 250), "MVA"), rx = h.dato("R/X de la red", n(e.rxRed, 0.1), "");
    const sn = h.dato("Potencia del transformador", n(e.snTrafo, ctx.transformador?.sn ?? 150), "kVA");
    const uk = h.dato("ukr", n(e.uk, ctx.transformador?.z ?? 4), "%"), pk = h.dato("PkrT", n(e.pkTrafo, n(e.snTrafo, ctx.transformador?.sn ?? 150) * 0.012), "kW", "Vacío en AHÍNCO = 1,2 % de Sn");
    h.calc("Ik\" trifásica en MT", `${sk}/(SQRT(3)*${umt})`, "kA");
    const zq = h.calc("ZQ referida a BT", `1.1*${un}^2/(${sk}*1E6)`, "Ω");
    const xq = h.calc("XQ", `${zq}/SQRT(1+${rx}^2)`, "Ω"), rq = h.calc("RQ", `${rx}*${xq}`, "Ω");
    const zt = h.calc("ZT", `${uk}/100*${un}^2/(${sn}*1000)`, "Ω"), rt = h.calc("RT", `${pk}*1000*${un}^2/(${sn}*1000)^2`, "Ω");
    const xt = h.calc("XT", `SQRT(MAX(${zt}^2-${rt}^2,0))`, "Ω");
    const kt = h.calc("KT = 0,95·cmax/(1+0,6·xT)", `0.95*1.1/(1+0.6*${xt}/(${un}^2/(${sn}*1000)))`, "");
    const r1 = h.calc("R1 en bornes", `${rq}+${kt}*${rt}`, "Ω"), x1 = h.calc("X1 en bornes", `${xq}+${kt}*${xt}`, "Ω");
    h.seccion("Barras (Z0 del transformador Dyn ≈ Z1; Z0 de cables ≈ 4 Z1)");
    const barras = [{ barra: e.nombreBornes || "Bornes BT", L: 0, R: 0, X: 0, n: 1, icu: n(e.icuBornes, 0) }, ...vacias(e.cables).map((cb) => { const z = impedanciaConductor(cb.conductor, cb.canalizacion); return { barra: cb.barra, L: n(cb.longitud), R: z.R, X: z.X, n: n(cb.paralelos, 1), icu: n(cb.icu, 0) }; })];
    h.tabla([
      { t: "Barra", v: (b) => String(b.barra || ""), ancho: 20 }, { t: "L (m)", v: (b) => b.L, entrada: true }, { t: "R cable (Ω/km)", v: (b) => b.R, entrada: true, fmt: "0.0000" },
      { t: "X cable (Ω/km)", v: (b) => b.X, entrada: true, fmt: "0.0000" }, { t: "Paralelos", v: (b) => b.n, entrada: true },
      { t: "R1 (Ω)", v: (b, rr) => (b === barras[0] ? `=${r1}` : `=F${rr - 1}+C${rr}*B${rr}/1000/E${rr}`), fmt: "0.00000" },
      { t: "X1 (Ω)", v: (b, rr) => (b === barras[0] ? `=${x1}` : `=G${rr - 1}+D${rr}*B${rr}/1000/E${rr}`), fmt: "0.00000" },
      { t: "R0 (Ω)", v: (b, rr) => (b === barras[0] ? `=${kt}*${rt}` : `=H${rr - 1}+4*C${rr}*B${rr}/1000/E${rr}`), fmt: "0.00000" },
      { t: "X0 (Ω)", v: (b, rr) => (b === barras[0] ? `=${kt}*${xt}` : `=I${rr - 1}+4*D${rr}*B${rr}/1000/E${rr}`), fmt: "0.00000" },
      { t: "Ik\" 3F (kA)", v: (b, rr) => `=${c}*${un}/(SQRT(3)*SQRT(F${rr}^2+G${rr}^2))/1000`, fmt: "0.00" },
      { t: "κ", v: (b, rr) => `=1.02+0.98*EXP(-3*F${rr}/G${rr})`, fmt: "0.00" },
      { t: "ip (kA)", v: (b, rr) => `=K${rr}*SQRT(2)*J${rr}`, fmt: "0.00" },
      { t: "Ik\" 1F (kA)", v: (b, rr) => `=SQRT(3)*${c}*${un}/SQRT((2*F${rr}+H${rr})^2+(2*G${rr}+I${rr})^2)/1000`, fmt: "0.00" },
      { t: "Icu (kA)", v: (b) => b.icu, entrada: true }, { t: "Resultado", v: (b, rr) => `=IF(N${rr}=0,"Sin dato",IF(N${rr}>=J${rr},"Cumple","No cumple"))` }
    ], barras);
  },
  coordinacion(wb, e) {
    const h = new Hoja(wb, "m Coordinación", "Coordinación de protecciones IEC 60255-151 (RETIE literal m)");
    const cti = h.dato("Margen de coordinación CTI", n(e.cti, 0.3), "s");
    h.seccion("Protecciones (de aguas abajo hacia aguas arriba)");
    const rels = vacias(e.protecciones);
    const t = h.tabla([
      { t: "Protección", v: (f) => String(f.nombre || ""), ancho: 22 }, { t: "Curva (SI/VI/EI/LTI/DT)", v: (f) => String(f.curva || "SI"), entrada: true },
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
    h.calc("GPR", `${ig}*${rg}`, "V");
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
  },
  distancias(wb, e, r, p) {
    const h = new Hoja(wb, "u Distancias", "Distancias de seguridad (RETIE literal u)");
    const H = h.dato("Altitud", n(e.altitud, n(p.altitud, 0)), "m");
    const f = h.calc("Factor de altitud", `IF(${H}>1000,1+0.0125*(${H}-1000)/100,1)`, "");
    h.nota("Distancia base: tabla de distancias mínimas de seguridad del RETIE (verificar contra la versión vigente) o valor digitado.");
    const filas = vacias(e.puntos).map((x) => { const tipo = N.RETIE_DISTANCIAS.tipos[x.tipo] || N.RETIE_DISTANCIAS.tipos.e; const base = n(x.exigida, NaN); return { ...x, tipoN: tipo.nombre, base: Number.isFinite(base) ? base : tipo.v[x.tension] ?? null }; });
    h.tabla([
      { t: "Punto", v: (x) => String(x.punto || ""), ancho: 24 }, { t: "Tensión (kV)", v: (x) => String(x.tension || "") }, { t: "Tipo de distancia", v: (x) => x.tipoN, ancho: 40 },
      { t: "Distancia base (m)", v: (x) => x.base, entrada: true }, { t: "Exigida (m)", v: (x, rr) => `=IF(D${rr}="","",D${rr}*${f})`, fmt: "0.00" },
      { t: "Diseño (m)", v: (x) => n(x.diseno), entrada: true }, { t: "Resultado", v: (x, rr) => `=IF(E${rr}="","Sin dato",IF(F${rr}>=E${rr},"Cumple","No cumple"))` }
    ], filas);
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
    h.tabla(cols, hip);
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
        { t: "TC", v: (f) => String(f.nombre || ""), ancho: 18 }, { t: "Lado (AT/MT)", v: (f) => f.lado === "AT" ? "AT" : "MT", entrada: true },
        { t: "Función", v: (f) => String(f.funcion || "Protección"), entrada: true }, { t: "Ipn (A)", v: (f) => n(f.primaria), entrada: true }, { t: "ALF", v: (f) => n(f.alf, 20), entrada: true },
        { t: "I máx. circuito (A)", v: (f, rr) => `=IF(B${rr}="AT",${iAT},${iMT})`, fmt: "0" }, { t: "Ik vista (kA)", v: (f, rr) => `=IF(B${rr}="AT",${ikPas},${ikMT})`, fmt: "0.00" },
        { t: "Resultado", v: (f, rr) => `=IF(AND(F${rr}<=1.2*D${rr},OR(C${rr}<>"Protección",D${rr}*E${rr}>=G${rr}*1000)),"Cumple","No cumple")` }
      ], tcs);
    }
    const eq = vacias(e.equipos);
    if (eq.length) {
      h.seccion("Equipos en serie con el transformador");
      h.tabla([
        { t: "Equipo", v: (f) => String(f.equipo || ""), ancho: 24 }, { t: "Lado (AT/MT)", v: (f) => f.lado === "AT" ? "AT" : "MT", entrada: true },
        { t: "In (A)", v: (f) => n(f.inom), entrada: true }, { t: "Ik equipo (kA)", v: (f) => n(f.icc), entrada: true },
        { t: "I exigida (A)", v: (f, rr) => `=IF(B${rr}="AT",${iAT},${iMT})`, fmt: "0" }, { t: "Ik exigida (kA)", v: (f, rr) => `=IF(B${rr}="AT",${ikRed},${ikMT})`, fmt: "0.00" },
        { t: "Resultado", v: (f, rr) => `=IF(AND(C${rr}>=E${rr},OR(D${rr}=0,D${rr}>=F${rr})),"Cumple","No cumple")` }
      ], eq);
    }
  },
  cableMT(wb, e, r, p, ctx) {
    const h = new Hoja(wb, "k Cables MT", "Cables de media tensión (RETIE literal k; IEC 60502-2; IEC 60949)");
    const U = h.dato("Tensión nominal", n(e.tension, ctx.trafoPotencia ? ctx.trafoPotencia.vs / 1000 : 34.5), "kV");
    const fp = h.dato("Factor de potencia", n(e.fp, 0.9), ""), sen = h.calc("sen φ", `SQRT(1-${fp}^2)`, ""), dvMax = h.dato("Caída de tensión máxima", n(e.dvMax, 3), "%");
    const ik3 = ctx.cortocircuito?.barras?.[0]?.ik3;
    const ikDef = ctx.trafoPotencia?.ikMT ?? (Number.isFinite(ik3) ? ik3 / 1000 : 0);
    h.nota("K adiabático (IEC 60949): Cu XLPE/EPR 143, Al XLPE/EPR 94, Cu PVC 115, Al PVC 76. R vacía en AHÍNCO = resistencia a 90 °C calculada.");
    h.tabla([
      { t: "Circuito", v: (f) => String(f.circuito || ""), ancho: 16 }, { t: "Mat. (Cu/Al)", v: (f) => (f.material === "Cu" ? "Cu" : "Al"), entrada: true },
      { t: "Calibre", v: (f) => String(f.calibre || "750"), entrada: true }, { t: "Aisl.", v: (f) => String(f.aislamiento || "XLPE"), entrada: true },
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
    h.tabla([
      { t: "Elemento", v: (f) => String(f.elemento || ""), ancho: 26 }, { t: "Captador", v: (f) => String(f.captador || ""), ancho: 14 },
      { t: "Altura captador (m)", v: (f) => n(f.hCaptador), entrada: true }, { t: "Altura elemento (m)", v: (f) => n(f.hElemento), entrada: true },
      { t: "Distancia (m)", v: (f) => (f.distancia === "" || f.distancia == null ? "" : n(f.distancia)), entrada: true },
      { t: "Radio protegido (m)", v: (f, rr) => `=IF(D${rr}>=C${rr},0,MAX(0,IF(C${rr}>=${R},${R},SQRT(C${rr}*(2*${R}-C${rr})))-IF(D${rr}>=${R},${R},SQRT(D${rr}*(2*${R}-D${rr})))))`, fmt: "0.00" },
      { t: "Resultado", v: (f, rr) => `=IF(E${rr}="","Captador a <= "&ROUND(F${rr},2)&" m",IF(E${rr}<=F${rr},"Protegido","No protegido"))` }
    ], vacias(e.elementos));
  }
};

export function construirLibro({ proyecto, resultados, guardados }, ExcelJS = window.ExcelJS) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AHÍNCO — Cinco S.A.S.";
  wb.calcProperties.fullCalcOnLoad = true;
  // Portada.
  const port = wb.addWorksheet("Portada");
  port.columns = [{ width: 30 }, { width: 70 }];
  port.getCell("A1").value = `Memoria de cálculo — ${proyecto.nombre}`;
  port.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };
  [["Cliente", proyecto.cliente], ["Ubicación", proyecto.ubicacion], ["Altitud (m s. n. m.)", proyecto.altitud], ["Temperatura ambiente (°C)", proyecto.tempAmbiente], ["Diseñador", proyecto.disenador], ["Matrícula profesional", proyecto.matricula], ["Generado con", "AHÍNCO — Cinco S.A.S."], ["Convención", "Celdas amarillas = datos de entrada; celdas grises = fórmulas"]]
    .forEach(([k, v], i) => { port.getCell(`A${i + 3}`).value = k; port.getCell(`A${i + 3}`).font = { bold: true }; port.getCell(`B${i + 3}`).value = v ?? ""; });
  // Literales.
  const lit = wb.addWorksheet("Literales RETIE");
  lit.columns = [{ width: 6 }, { width: 70 }, { width: 9 }, { width: 70 }];
  lit.getCell("A1").value = `Diseño detallado — ${FUENTE_LITERALES}`; lit.getCell("A1").font = { bold: true, color: { argb: NAVY } };
  ["Lit.", "Contenido exigido", "Aplica", "Desarrollo / cálculo / justificación"].forEach((h, i) => { const c = lit.getCell(3, i + 1); c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; });
  LITERALES.forEach((l, i) => {
    const d = proyecto.literales?.[l.l] || {};
    const mods = Object.entries(resultados).filter(([k, r]) => l.modulos.includes(r.modulo ?? k)).map(([k, r]) => `${MODULOS[r.modulo ?? k].titulo}${r.etiqueta ? ` — ${r.etiqueta}` : ""}`);
    const fila = lit.getRow(4 + i);
    fila.values = [`${l.l})`, l.texto, d.aplica === "No" ? "No" : "Sí", d.aplica === "No" ? `No aplica: ${d.texto || ""}` : [mods.length ? `Ver hoja: ${mods.join("; ")}` : "", d.texto || ""].filter(Boolean).join(" — ") || "Pendiente"];
    fila.alignment = { wrapText: true, vertical: "top" };
  });
  hojaTablas(wb);
  // Hojas de cálculo en el orden de los literales.
  const ctx = {};
  Object.entries(resultados).forEach(([k, r]) => { const m = r.modulo ?? k; if (r.salidas && !ctx[m]) ctx[m] = r.salidas; });
  const orden = ["rayos", "apantallamiento", "cargas", "aislamiento", "cortocircuito", "transformador", "trafoPotencia", "malla", "conductores", "cableMT", "mecanico", "coordinacion", "canalizaciones", "regulacion", "distancias"];
  for (const m of orden) {
    for (const [clave, r] of Object.entries(resultados)) {
      if ((r.modulo ?? clave) !== m || !guardados[clave]?.entradas) continue;
      etiquetaActual = r.etiqueta || "";
      HOJAS[m](wb, guardados[clave].entradas, r, proyecto, ctx);
    }
  }
  etiquetaActual = "";
  // "Tablas" al final.
  wb.getWorksheet("Tablas").orderNo = 1000;
  return wb;
}

export async function descargarExcel(datos) {
  const { proyecto } = datos;
  const wb = construirLibro(datos);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Memoria de calculo formulada - ${String(proyecto.nombre || "proyecto").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
