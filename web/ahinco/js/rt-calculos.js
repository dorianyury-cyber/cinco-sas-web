// Motor de cálculo de AHÍNCO. Funciones puras: reciben las entradas de un
// módulo (y los datos del proyecto) y devuelven un resultado neutro que la
// pantalla, la memoria en PDF/Word y el Excel presentan de la misma forma:
//   { resumen: [{etiqueta, valor, unidad}], tablas: [{titulo, encabezados, filas}],
//     pasos: [{titulo, formula, sustitucion, resultado}],
//     verificaciones: [{criterio, norma, valor, limite, cumple}], notas: [], conclusion, grafico? }
import * as N from "./rt-normas.js";

const PI = Math.PI;
export const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const num = (v, def = 0) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : def; };
const filas = (v) => (Array.isArray(v) ? v.filter((f) => f && Object.values(f).some((x) => x !== "" && x != null)) : []);
const sigNormal = (lista, x) => lista.find((v) => v >= x - 1e-9) ?? null;
function veredicto(verificaciones, okTexto, malTexto) {
  const fallan = verificaciones.filter((v) => v.cumple === false);
  return fallan.length ? `${malTexto} Criterios que no cumplen: ${fallan.map((v) => v.criterio).join("; ")}.` : okTexto;
}

// ---------------------------------------------------------------- sistemas de baja tensión

export const SISTEMAS_BT = {
  "1F2H": { nombre: "Monofásico 2 hilos 120 V", VLN: 120, VLL: 120, fases: ["A"] },
  "1F3H": { nombre: "Monofásico 3 hilos 120/240 V", VLN: 120, VLL: 240, fases: ["A", "B"] },
  "3F208": { nombre: "Trifásico 4 hilos 208/120 V", VLN: 120, VLL: 208, fases: ["A", "B", "C"] },
  "3F220": { nombre: "Trifásico 4 hilos 220/127 V", VLN: 127, VLL: 220, fases: ["A", "B", "C"] },
  "3F440": { nombre: "Trifásico 4 hilos 440/254 V", VLN: 254, VLL: 440, fases: ["A", "B", "C"] }
};

// ================================================================ 1. CUADRO DE CARGAS
export function cargas(e) {
  const sis = SISTEMAS_BT[e.sistema] || SISTEMAS_BT["3F208"];
  const fasesSis = sis.fases;
  const porFase = Object.fromEntries(fasesSis.map((f) => [f, 0]));
  let pInst = 0, sInst = 0, sDem = 0, pDem = 0, iMotorMayor = 0;
  const tabla = filas(e.circuitos).map((c) => {
    const cant = num(c.cantidad, 1), pu = num(c.potencia), fp = Math.min(1, Math.max(0.1, num(c.fp, 0.9))), fd = num(c.fd, 100) / 100;
    const P = cant * pu, S = P / fp, Sd = S * fd;
    pInst += P; sInst += S; sDem += Sd; pDem += P * fd;
    let fs = String(c.fases || "A").toUpperCase().split("").filter((f) => fasesSis.includes(f));
    if (!fs.length) fs = [fasesSis[0]];
    fs.forEach((f) => { porFase[f] += Sd / fs.length; });
    const vCirc = fs.length === 1 ? sis.VLN : fs.length === 2 ? sis.VLL : sis.VLL;
    const iCirc = fs.length === 3 ? S / (Math.sqrt(3) * sis.VLL) : S / vCirc;
    if (c.tipo === "Motor") iMotorMayor = Math.max(iMotorMayor, iCirc);
    return [c.circuito || "", c.descripcion || "", c.tipo || "", fmt(cant, 0), fmt(pu, 0), fmt(fp, 2), fmt(fd * 100, 0), fs.join(""), fmt(P / 1000, 3), fmt(S / 1000, 3), fmt(Sd / 1000, 3), fmt(iCirc, 1)];
  });
  const iFase = Object.fromEntries(fasesSis.map((f) => [f, porFase[f] / sis.VLN]));
  const valores = Object.values(iFase);
  const iMax = Math.max(...valores), iMin = Math.min(...valores), iProm = valores.reduce((s, v) => s + v, 0) / valores.length;
  const desbalance = valores.length > 1 && iProm > 0 ? ((iMax - iMin) / iProm) * 100 : 0;
  const iAlim = iMax + 0.25 * iMotorMayor;
  const fpProm = sDem > 0 ? pDem / sDem : 0;
  const verificaciones = [];
  if (valores.length > 1) verificaciones.push({ criterio: "Desbalance de corriente entre fases", norma: "Criterio de diseño (buena práctica)", valor: `${fmt(desbalance, 1)} %`, limite: `≤ ${fmt(num(e.desbalanceMax, 10), 0)} %`, cumple: desbalance <= num(e.desbalanceMax, 10) });
  verificaciones.push({ criterio: "Factor de potencia promedio de la demanda", norma: "Res. CREG 015 de 2018 (cobro de reactiva) — referencia", valor: fmt(fpProm, 2), limite: "≥ 0,90", cumple: fpProm >= 0.9 });
  return {
    resumen: [
      { etiqueta: "Carga instalada", valor: fmt(sInst / 1000, 2), unidad: "kVA" },
      { etiqueta: "Demanda máxima", valor: fmt(sDem / 1000, 2), unidad: "kVA" },
      { etiqueta: "Corriente de la fase más cargada", valor: fmt(iMax, 1), unidad: "A" },
      { etiqueta: "Corriente de diseño del alimentador", valor: fmt(iAlim, 1), unidad: "A" }
    ],
    salidas: { sDemKVA: sDem / 1000, iAlim, sistema: e.sistema },
    tablas: [
      { titulo: "Cuadro de cargas", encabezados: ["Circ.", "Descripción", "Tipo", "Cant.", "P unit. (W)", "fp", "FD (%)", "Fases", "P inst. (kW)", "S inst. (kVA)", "S dem. (kVA)", "I (A)"], filas: tabla },
      { titulo: "Balance de fases (demanda)", encabezados: ["Fase", "S (kVA)", "I (A)"], filas: fasesSis.map((f) => [f, fmt(porFase[f] / 1000, 3), fmt(iFase[f], 1)]) }
    ],
    pasos: [
      { titulo: "Potencia aparente instalada por circuito", formula: "S = (Cantidad × P unitaria) / fp", sustitucion: "Por circuito (ver cuadro)", resultado: `S instalada total = ${fmt(sInst / 1000, 2)} kVA` },
      { titulo: "Demanda máxima", formula: "S dem = Σ S × FD", sustitucion: `Factores de demanda por circuito (NTC 2050 Sección 220)`, resultado: `${fmt(sDem / 1000, 2)} kVA` },
      { titulo: "Corriente por fase", formula: "I fase = S fase / V fase-neutro", sustitucion: `V fase-neutro = ${sis.VLN} V`, resultado: fasesSis.map((f) => `${f}: ${fmt(iFase[f], 1)} A`).join(" · ") },
      { titulo: "Corriente del alimentador con motores", formula: "I alim = I fase máx + 0,25 × I motor mayor (NTC 2050 430-24)", sustitucion: `${fmt(iMax, 1)} + 0,25 × ${fmt(iMotorMayor, 1)}`, resultado: `${fmt(iAlim, 1)} A` }
    ],
    verificaciones,
    conclusion: veredicto(verificaciones, `La demanda máxima es de ${fmt(sDem / 1000, 2)} kVA en sistema ${sis.nombre}; el alimentador se diseña para ${fmt(iAlim, 1)} A.`, `La demanda máxima es de ${fmt(sDem / 1000, 2)} kVA; revise el balance de cargas.`)
  };
}

// ================================================================ 2. CONDUCTORES Y PROTECCIONES
function factorTemp(tamb, col) {
  const fila = N.FACTOR_TEMPERATURA.find((r) => tamb <= r[0]) || N.FACTOR_TEMPERATURA[N.FACTOR_TEMPERATURA.length - 1];
  return fila[col + 1];
}
const factorAgrup = (n) => N.FACTOR_AGRUPAMIENTO.find((r) => n <= r[0])[1];

export function seleccionarConductor({ corriente, continua, material = "Cu", tAisl = 90, tTerm = 75, portadores = 3, tAmb = 30 }) {
  const ft = factorTemp(tAmb, N.COLUMNA_TEMP[tAisl]);
  const fa = factorAgrup(portadores);
  const iDis = corriente * (continua ? 1.25 : 1);
  const lista = N.CALIBRES.filter((c) => N.AMPACIDAD[material][c]);
  for (const cal of lista) {
    const amp = N.AMPACIDAD[material][cal];
    const ampAisl = amp[N.COLUMNA_TEMP[tAisl]] * (ft ?? 0) * fa;
    const ampTerm = amp[N.COLUMNA_TEMP[tTerm]];
    let ampFinal = Math.min(ampAisl, ampTerm);
    const limite = N.LIMITE_PEQUENOS[material]?.[cal];
    const protMax = limite ? Math.min(limite, ampFinal) : ampFinal;
    if (ampTerm < iDis || ampAisl < corriente) continue;
    const In = sigNormal(N.PROTECCIONES_NORMALIZADAS, iDis);
    // 240-4(b): se permite la protección normalizada inmediatamente superior
    // si la capacidad no coincide con un valor normalizado (≤ 800 A).
    const inPermitido = limite ? limite : (In <= 800 ? sigNormal(N.PROTECCIONES_NORMALIZADAS, ampFinal) : ampFinal);
    if (In == null || In > inPermitido) continue;
    return { calibre: cal, ft, fa, iDis, ampAisl, ampTerm, ampFinal: limite ? Math.min(limite, ampFinal) : ampFinal, In, protMax };
  }
  return { calibre: null, ft, fa, iDis };
}

export function conductores(e, proyecto = {}) {
  const tAmbDef = num(proyecto.tempAmbiente, 30);
  const verificaciones = [];
  const tabla = filas(e.circuitos).map((c) => {
    const I = num(c.corriente), mat = c.material === "Al" ? "Al" : "Cu";
    const sel = seleccionarConductor({ corriente: I, continua: c.continua !== "No", material: mat, tAisl: num(c.tAisl, 90), tTerm: num(c.tTerm, 75), portadores: num(c.portadores, 3), tAmb: num(c.tAmb, tAmbDef) });
    const icc = num(c.icc, 0), icu = num(c.icu, 0);
    if (!sel.calibre) {
      verificaciones.push({ criterio: `Circuito ${c.circuito}: conductor disponible`, norma: "NTC 2050 Tabla 310-16", valor: `${fmt(I, 1)} A`, limite: "≤ 1000 kcmil", cumple: false });
      return [c.circuito || "", c.descripcion || "", fmt(I, 1), mat, "—", "—", "—", "—", "—", "—"];
    }
    verificaciones.push({ criterio: `Circuito ${c.circuito}: protección ≤ capacidad del conductor`, norma: "NTC 2050 240-3 y 240-4", valor: `${sel.In} A`, limite: `${fmt(sel.ampFinal, 1)} A (o normalizado inmediato)`, cumple: true });
    if (icc > 0 && icu > 0) verificaciones.push({ criterio: `Circuito ${c.circuito}: capacidad de interrupción`, norma: "NTC 2050 110-9 / RETIE", valor: `${fmt(icu, 1)} kA`, limite: `≥ ${fmt(icc, 1)} kA`, cumple: icu >= icc });
    return [c.circuito || "", c.descripcion || "", fmt(I, 1), mat, N.etiquetaCalibre(sel.calibre), fmt(sel.ft, 2), fmt(sel.fa, 2), fmt(sel.ampFinal, 1), `${sel.In} A`, icu ? `${fmt(icu, 1)} kA` : "—"];
  });
  return {
    resumen: [{ etiqueta: "Circuitos dimensionados", valor: String(tabla.length), unidad: "" }],
    tablas: [{ titulo: "Selección de conductores y protecciones", encabezados: ["Circ.", "Descripción", "I carga (A)", "Mat.", "Conductor", "Ft", "Fa", "Capacidad corregida (A)", "Protección", "Icu"], filas: tabla }],
    pasos: [
      { titulo: "Corriente de diseño", formula: "I diseño = 1,25 × I carga continua + I no continua", sustitucion: "NTC 2050 210-19(a) y 215-2", resultado: "Por circuito" },
      { titulo: "Capacidad corregida del conductor", formula: "I corregida = I tabla (T aislamiento) × Ft × Fa ≥ I carga", sustitucion: "Ft: Tabla 310-16 (temperatura ambiente); Fa: 310-15(b)(2)(a) (más de 3 portadores)", resultado: "Por circuito" },
      { titulo: "Temperatura de los terminales", formula: "I tabla (T terminales) ≥ I diseño", sustitucion: "NTC 2050 110-14(c)", resultado: "Por circuito" },
      { titulo: "Protección", formula: "I diseño ≤ In ≤ I corregida (o el normalizado inmediato superior, 240-4(b))", sustitucion: "Valores normalizados NTC 2050 240-6", resultado: "Por circuito" }
    ],
    verificaciones,
    conclusion: veredicto(verificaciones, "Todos los circuitos tienen conductor y protección coordinados según la NTC 2050.", "Hay circuitos que no cumplen.")
  };
}

// ================================================================ 3. REGULACIÓN DE TENSIÓN Y PÉRDIDAS
export function opcionesConductor() {
  const op = [];
  N.CALIBRES.forEach((c) => op.push({ valor: `Cu:${c}`, texto: `Cobre ${N.etiquetaCalibre(c)}` }));
  N.CALIBRES.filter((c) => N.TABLA9[c][4] != null).forEach((c) => op.push({ valor: `Al:${c}`, texto: `Aluminio ${N.etiquetaCalibre(c)}` }));
  Object.entries(N.CONDUCTORES_AEREOS).forEach(([k, v]) => op.push({ valor: `aereo:${k}`, texto: v.nombre }));
  return op;
}
export function impedanciaConductor(cond, canal = "PVC", dmg = 1000) {
  const [tipo, cal] = String(cond || "Cu:4/0").split(":");
  if (tipo === "aereo") {
    const a = N.CONDUCTORES_AEREOS[cal] || N.CONDUCTORES_AEREOS.raven;
    return { R: a.R75, X: 0.0754 * Math.log(Math.max(dmg, a.gmr * 2) / a.gmr), nombre: a.nombre };
  }
  const t = N.TABLA9[cal] || N.TABLA9["4/0"];
  const acero = canal === "acero";
  const R = tipo === "Al" ? t[4] : acero ? t[3] : t[2];
  return { R, X: acero ? t[1] : t[0], nombre: `${tipo === "Al" ? "Aluminio" : "Cobre"} ${N.etiquetaCalibre(cal)}` };
}

export function regulacion(e) {
  const V = num(e.tension, 208), trif = e.sistema !== "1F";
  const fp = Math.min(1, Math.max(0.1, num(e.fp, 0.9))), sen = Math.sqrt(1 - fp * fp);
  const k = trif ? Math.sqrt(3) : 2, kp = trif ? 3 : 2;
  const limP = num(e.limiteParcial, 3), limT = num(e.limiteTotal, 5);
  const tramos = filas(e.tramos);
  const res = {};
  const calc = tramos.map((t) => {
    const L = num(t.longitud) / 1000, S = num(t.carga) * 1000, n = Math.max(1, num(t.paralelos, 1));
    const z = impedanciaConductor(t.conductor, t.canalizacion, num(t.dmg, 1000));
    const I = trif ? S / (Math.sqrt(3) * V) : S / V;
    const dV = (k * I * L * (z.R * fp + z.X * sen)) / n;
    const dVp = (dV / V) * 100;
    const perdidas = (kp * I * I * z.R * L) / n;
    return { t, L, S, n, z, I, dV, dVp, perdidas };
  });
  calc.forEach((c) => { res[c.t.hasta || c.t.tramo] = c; });
  const acum = (c, prof = 0) => {
    if (prof > 50) return c.dVp;
    const padre = calc.find((p) => (p.t.hasta || p.t.tramo) === c.t.desde && p !== c);
    return c.dVp + (padre ? acum(padre, prof + 1) : 0);
  };
  const verificaciones = [];
  const tabla = calc.map((c) => {
    const ac = acum(c);
    verificaciones.push({ criterio: `Tramo ${c.t.tramo || c.t.hasta}: regulación parcial`, norma: "NTC 2050 210-19(a) NPN 4 / 215-2(b) NPN 2", valor: `${fmt(c.dVp, 2)} %`, limite: `≤ ${fmt(limP, 1)} %`, cumple: c.dVp <= limP });
    verificaciones.push({ criterio: `Hasta ${c.t.hasta || c.t.tramo}: regulación acumulada`, norma: "NTC 2050 215-2(b) NPN 2", valor: `${fmt(ac, 2)} %`, limite: `≤ ${fmt(limT, 1)} %`, cumple: ac <= limT });
    return [c.t.tramo || "", `${c.t.desde || ""} → ${c.t.hasta || ""}`, fmt(c.L * 1000, 1), fmt(c.S / 1000, 2), fmt(c.I, 1), `${c.n} × ${c.z.nombre}`, fmt(c.z.R, 4), fmt(c.z.X, 4), fmt(c.dV, 2), fmt(c.dVp, 2), fmt(ac, 2), fmt(c.perdidas / 1000, 3), fmt(c.S > 0 ? (c.perdidas / (c.S * fp)) * 100 : 0, 2)];
  });
  const totPerd = calc.reduce((s, c) => s + c.perdidas, 0);
  const maxAc = calc.length ? Math.max(...calc.map(acum)) : 0;
  return {
    resumen: [
      { etiqueta: "Regulación acumulada máxima", valor: fmt(maxAc, 2), unidad: "%" },
      { etiqueta: "Pérdidas totales de potencia", valor: fmt(totPerd / 1000, 3), unidad: "kW" }
    ],
    tablas: [{ titulo: "Regulación de tensión y pérdidas por tramo", encabezados: ["Tramo", "Recorrido", "L (m)", "S (kVA)", "I (A)", "Conductor", "R (Ω/km)", "X (Ω/km)", "ΔV (V)", "ΔV (%)", "ΔV acum. (%)", "Pérd. (kW)", "Pérd. (%)"], filas: tabla }],
    pasos: [
      { titulo: "Corriente del tramo", formula: trif ? "I = S / (√3 × V)" : "I = S / V", sustitucion: `V = ${fmt(V, 0)} V`, resultado: "Por tramo" },
      { titulo: "Caída de tensión", formula: `ΔV = ${trif ? "√3" : "2"} × I × L × (R cos φ + X sen φ) / n`, sustitucion: `cos φ = ${fmt(fp, 2)}; sen φ = ${fmt(sen, 3)}; R y X: NTC 2050 Cap. 9 Tabla 9 (cables) o catálogo (aéreos, X = 0,0754 ln(DMG/RMG) Ω/km a 60 Hz)`, resultado: "ΔV % = ΔV / V × 100" },
      { titulo: "Pérdidas de potencia", formula: `P pérd = ${kp} × I² × R × L / n`, sustitucion: "Por tramo", resultado: `${fmt(totPerd / 1000, 3)} kW en total` }
    ],
    verificaciones,
    conclusion: veredicto(verificaciones, `La regulación acumulada máxima es ${fmt(maxAc, 2)} %, dentro de los límites de diseño.`, "Hay tramos que superan la regulación admisible: aumente el calibre o el número de conductores en paralelo.")
  };
}

// ================================================================ 4. CANALIZACIONES
export function canalizaciones(e) {
  const grupos = {};
  filas(e.conductores).forEach((c) => {
    const k = c.ducto || "Ducto 1";
    (grupos[k] = grupos[k] || { tipo: c.tipo || "PVC40", tamano: c.tamano || "", items: [] });
    if (c.tipo) grupos[k].tipo = c.tipo;
    if (c.tamano) grupos[k].tamano = c.tamano;
    grupos[k].items.push({ calibre: c.calibre, cantidad: num(c.cantidad, 1) });
  });
  const verificaciones = [];
  const tabla = Object.entries(grupos).map(([nombre, g]) => {
    const n = g.items.reduce((s, i) => s + i.cantidad, 0);
    const area = g.items.reduce((s, i) => s + i.cantidad * (N.AREA_THHN[i.calibre] || 0), 0);
    const lim = N.LLENADO_MAX(n);
    const tub = N.TUBERIAS[g.tipo] || N.TUBERIAS.PVC40;
    const minimo = tub.areas.find(([, a]) => (a * lim) / 100 >= area);
    const areaDe = (t) => tub.areas.find(([k]) => k === t)?.[1];
    const tam = g.tamano && areaDe(g.tamano) ? g.tamano : minimo?.[0];
    const llen = tam ? (area / areaDe(tam)) * 100 : NaN;
    verificaciones.push({ criterio: `${nombre}: porcentaje de llenado`, norma: "NTC 2050 Cap. 9 Tabla 1", valor: tam ? `${fmt(llen, 1)} % en ${tam}"` : "sin tamaño suficiente", limite: `≤ ${lim} %`, cumple: Number.isFinite(llen) && llen <= lim });
    return [nombre, tub.nombre, g.items.map((i) => `${i.cantidad} × ${N.etiquetaCalibre(i.calibre)}`).join(" + "), String(n), fmt(area, 1), `${lim} %`, minimo ? `${minimo[0]}"` : "—", tam ? `${tam}"` : "—", fmt(llen, 1)];
  });
  return {
    resumen: [{ etiqueta: "Canalizaciones verificadas", valor: String(tabla.length), unidad: "" }],
    tablas: [{ titulo: "Llenado de canalizaciones (conductores THHN/THWN-2)", encabezados: ["Ducto", "Tipo", "Conductores", "N.º", "Área cond. (mm²)", "Llenado máx.", "Tamaño mínimo", "Tamaño adoptado", "Llenado (%)"], filas: tabla }],
    pasos: [
      { titulo: "Área ocupada", formula: "A cond = Σ n × área del conductor", sustitucion: "Áreas: NTC 2050 Cap. 9 Tabla 5", resultado: "Por ducto" },
      { titulo: "Llenado admisible", formula: "1 conductor: 53 %; 2: 31 %; más de 2: 40 %", sustitucion: "NTC 2050 Cap. 9 Tabla 1; áreas internas: Tabla 4", resultado: "Tamaño mínimo = menor tubería con área × llenado ≥ A cond" }
    ],
    verificaciones,
    conclusion: veredicto(verificaciones, "Todas las canalizaciones cumplen el porcentaje de llenado.", "Hay canalizaciones con llenado excesivo.")
  };
}

// ================================================================ 5. TRANSFORMADOR
export function transformador(e, proyecto = {}, ctx = {}) {
  const tri = e.tipo !== "monofasico";
  const sDem = num(e.demanda, ctx.cargas?.sDemKVA ?? 0);
  const crec = num(e.crecimiento, 20);
  const sReq = sDem * (1 + crec / 100);
  const lista = tri ? N.TRAFOS_TRIFASICOS : N.TRAFOS_MONOFASICOS;
  const sn = num(e.potenciaAdoptada, 0) || sigNormal(lista, sReq) || lista[lista.length - 1];
  const vp = num(e.vPrimario, 13.2) * 1000, vs = num(e.vSecundario, 208);
  const z = num(e.impedancia, 0) || N.impedanciaTipica(sn);
  const ip = tri ? (sn * 1000) / (Math.sqrt(3) * vp) : (sn * 1000) / vp;
  const is = tri ? (sn * 1000) / (Math.sqrt(3) * vs) : (sn * 1000) / vs;
  const icc = is / (z / 100);
  const fusible = sigNormal(N.FUSIBLES_K, 1.5 * ip);
  const interruptor = sigNormal(N.PROTECCIONES_NORMALIZADAS, is);
  const carga = (sDem / sn) * 100, cargaFut = (sReq / sn) * 100;
  const verificaciones = [
    { criterio: "Cargabilidad con la demanda actual", norma: "Criterio de diseño (NTC 2482 cargabilidad)", valor: `${fmt(carga, 1)} %`, limite: `≤ ${fmt(num(e.cargaMax, 100), 0)} %`, cumple: carga <= num(e.cargaMax, 100) },
    { criterio: "Cargabilidad con crecimiento proyectado", norma: "Criterio de diseño", valor: `${fmt(cargaFut, 1)} %`, limite: "≤ 100 %", cumple: cargaFut <= 100 },
    { criterio: "Protección del secundario", norma: "NTC 2050 450-3(b)", valor: `${interruptor} A`, limite: `≤ ${fmt(1.25 * is, 0)} A (125 % In) o normalizado inmediato`, cumple: interruptor <= sigNormal(N.PROTECCIONES_NORMALIZADAS, 1.25 * is) }
  ];
  return {
    resumen: [
      { etiqueta: "Potencia adoptada", valor: fmt(sn, sn % 1 ? 1 : 0), unidad: "kVA" },
      { etiqueta: "Cargabilidad actual", valor: fmt(carga, 1), unidad: "%" },
      { etiqueta: "Corriente de cortocircuito en bornes BT", valor: fmt(icc / 1000, 2), unidad: "kA" },
      { etiqueta: "Fusible primario", valor: `${fusible}K`, unidad: "" }
    ],
    salidas: { sn, z, is, iccBornes: icc / 1000, vs, vp },
    tablas: [{ titulo: "Datos del transformador seleccionado", encabezados: ["Parámetro", "Valor"], filas: [
      ["Tipo", tri ? "Trifásico" : "Monofásico"], ["Demanda máxima", `${fmt(sDem, 2)} kVA`], ["Crecimiento proyectado", `${fmt(crec, 0)} %`],
      ["Potencia requerida", `${fmt(sReq, 2)} kVA`], ["Potencia normalizada adoptada", `${fmt(sn, sn % 1 ? 1 : 0)} kVA (NTC ${tri ? "819" : "818"})`],
      ["Tensiones", `${fmt(vp / 1000, 1)} kV / ${fmt(vs, 0)} V`], ["Impedancia de cortocircuito", `${fmt(z, 1)} %${num(e.impedancia, 0) ? "" : " (típica; usar la de placa)"}`],
      ["Corriente nominal primaria", `${fmt(ip, 2)} A`], ["Corriente nominal secundaria", `${fmt(is, 1)} A`],
      ["Fusible primario tipo K", `${fusible}K`], ["Interruptor general BT", `${interruptor} A`]
    ] }],
    pasos: [
      { titulo: "Potencia requerida", formula: "S req = S dem × (1 + crecimiento)", sustitucion: `${fmt(sDem, 2)} × (1 + ${fmt(crec, 0)} %)`, resultado: `${fmt(sReq, 2)} kVA → ${fmt(sn, sn % 1 ? 1 : 0)} kVA normalizado` },
      { titulo: "Corrientes nominales", formula: tri ? "In = Sn / (√3 × V)" : "In = Sn / V", sustitucion: `Primaria: ${fmt(sn, 1)} kVA / ${tri ? "√3 × " : ""}${fmt(vp / 1000, 2)} kV; secundaria: ${fmt(sn, 1)} kVA / ${tri ? "√3 × " : ""}${fmt(vs, 0)} V`, resultado: `Ip = ${fmt(ip, 2)} A; Is = ${fmt(is, 1)} A` },
      { titulo: "Cortocircuito en bornes (barra infinita)", formula: "Icc = Is / (Z % / 100)", sustitucion: `${fmt(is, 1)} / ${fmt(z / 100, 3)}`, resultado: `${fmt(icc / 1000, 2)} kA` },
      { titulo: "Fusible primario", formula: "I fusible ≈ 1,5 × Ip (tipo K)", sustitucion: `1,5 × ${fmt(ip, 2)} = ${fmt(1.5 * ip, 2)} A`, resultado: `${fusible}K (verificar con la norma del operador de red)` }
    ],
    verificaciones,
    conclusion: veredicto(verificaciones, `Se adopta un transformador ${tri ? "trifásico" : "monofásico"} de ${fmt(sn, sn % 1 ? 1 : 0)} kVA con cargabilidad de ${fmt(carga, 1)} %.`, "El transformador no cumple la cargabilidad: aumente la potencia.")
  };
}

// ================================================================ 6. CORTOCIRCUITO (IEC 60909)
const cplx = (r, x) => ({ r, x });
const suma = (a, b) => cplx(a.r + b.r, a.x + b.x);
const esc = (a, k) => cplx(a.r * k, a.x * k);
const mod = (a) => Math.hypot(a.r, a.x);

export function cortocircuito(e, proyecto = {}, ctx = {}) {
  const UnMT = num(e.uMT, 13.2) * 1000, Un = num(e.uBT, ctx.transformador?.vs ?? 208);
  const c = num(e.factorC, 1.05);
  const skq = num(e.sk, 250) * 1e6, rxq = num(e.rxRed, 0.1);
  const sn = num(e.snTrafo, ctx.transformador?.sn ?? 150) * 1000, uk = num(e.uk, ctx.transformador?.z ?? 4), pk = num(e.pkTrafo, sn * 0.012 / 1000) * 1000;
  // Red equivalente referida a BT.
  const ZQ = (1.1 * Un * Un) / skq, XQ = ZQ / Math.sqrt(1 + rxq * rxq);
  const zq = cplx(rxq * XQ, XQ);
  // Transformador con factor de corrección KT (IEC 60909-0 ec. 12a).
  const ZT = (uk / 100) * (Un * Un) / sn, RT = (pk * Un * Un) / (sn * sn), XT = Math.sqrt(Math.max(ZT * ZT - RT * RT, 0));
  const xT = XT / ((Un * Un) / sn), KT = (0.95 * 1.1) / (1 + 0.6 * xT);
  const zt = esc(cplx(RT, XT), KT);
  const barras = [];
  // Secundario en delta con transformador zig-zag: Z0 = la del zig-zag (reactiva).
  const x0zz = num(e.x0Tierra, 0);
  let z1 = suma(zq, zt), z0 = x0zz > 0 ? cplx(0, x0zz) : zt;
  const registrar = (nombre, icu) => {
    const ik3 = (c * Un) / (Math.sqrt(3) * mod(z1));
    const kappa = 1.02 + 0.98 * Math.exp(-3 * (z1.r / Math.max(z1.x, 1e-9)));
    const ik1 = (Math.sqrt(3) * c * Un) / mod(suma(esc(z1, 2), z0));
    barras.push({ nombre, z1: { ...z1 }, ik3, ip: kappa * Math.SQRT2 * ik3, ik1, kappa, icu: num(icu, 0) });
  };
  registrar(e.nombreBornes || (Un > 1000 ? "Barra del secundario" : "Bornes BT del transformador"), e.icuBornes);
  filas(e.cables).forEach((cb) => {
    const zc = impedanciaConductor(cb.conductor, cb.canalizacion);
    const L = num(cb.longitud) / 1000, n = Math.max(1, num(cb.paralelos, 1));
    const z = cplx((zc.R * L) / n, (zc.X * L) / n);
    z1 = suma(z1, z); z0 = suma(z0, esc(z, 4));
    registrar(cb.barra || "Barra", cb.icu);
  });
  const ikMT = skq / (Math.sqrt(3) * UnMT);
  const verificaciones = barras.filter((b) => b.icu > 0).map((b) => ({ criterio: `${b.nombre}: capacidad de interrupción`, norma: "RETIE / NTC 2050 110-9; IEC 60947-2", valor: `${fmt(b.icu, 1)} kA`, limite: `≥ ${fmt(b.ik3 / 1000, 2)} kA`, cumple: b.icu * 1000 >= b.ik3 }));
  return {
    resumen: [
      { etiqueta: "Ik\" trifásica en la red (primario)", valor: fmt(ikMT / 1000, 2), unidad: "kA" },
      { etiqueta: "Ik\" trifásica en el secundario", valor: fmt(barras[0].ik3 / 1000, 2), unidad: "kA" },
      { etiqueta: "Ik\" monofásica en el secundario", valor: fmt(barras[0].ik1 / 1000, 2), unidad: "kA" }
    ],
    salidas: { barras: barras.map((b) => ({ nombre: b.nombre, ik3: b.ik3, ik1: b.ik1 })) },
    tablas: [
      { titulo: "Impedancias referidas al secundario", encabezados: ["Elemento", "R (mΩ)", "X (mΩ)", "Z (mΩ)"], filas: [
        ["Red equivalente", fmt(zq.r * 1000, 3), fmt(zq.x * 1000, 3), fmt(mod(zq) * 1000, 3)],
        [`Transformador (KT = ${fmt(KT, 3)})`, fmt(zt.r * 1000, 3), fmt(zt.x * 1000, 3), fmt(mod(zt) * 1000, 3)]
      ] },
      { titulo: "Corrientes de cortocircuito por barra", encabezados: ["Barra", "R (mΩ)", "X (mΩ)", "Ik\" 3F (kA)", "κ", "ip (kA)", "Ik\" 1F (kA)", "Icu (kA)"], filas: barras.map((b) => [b.nombre, fmt(b.z1.r * 1000, 3), fmt(b.z1.x * 1000, 3), fmt(b.ik3 / 1000, 2), fmt(b.kappa, 2), fmt(b.ip / 1000, 2), fmt(b.ik1 / 1000, 2), b.icu ? fmt(b.icu, 1) : "—"]) }
    ],
    pasos: [
      { titulo: "Red equivalente referida al secundario", formula: "ZQ = c × Un² / S\"kQ; XQ = ZQ / √(1 + (R/X)²)", sustitucion: `1,1 × ${fmt(Un, 0)}² / ${fmt(skq / 1e6, 1)} MVA`, resultado: `ZQ = ${fmt(ZQ * 1000, 3)} mΩ` },
      { titulo: "Transformador", formula: "ZT = ukr × Un² / SrT; RT = PkrT × Un² / SrT²; KT = 0,95 × cmax / (1 + 0,6 xT)", sustitucion: `ukr = ${fmt(uk, 1)} %; PkrT = ${fmt(pk / 1000, 2)} kW; SrT = ${fmt(sn / 1000, 1)} kVA`, resultado: `ZT = ${fmt(ZT * 1000, 3)} mΩ; KT = ${fmt(KT, 3)}` },
      { titulo: "Corriente trifásica", formula: "Ik\" = c × Un / (√3 × |Z1|)", sustitucion: `c = ${fmt(c, 2)} (IEC 60909-0 Tabla 1)`, resultado: "Por barra" },
      { titulo: "Corriente monofásica a tierra", formula: "Ik1\" = √3 × c × Un / |2 Z1 + Z0|", sustitucion: x0zz > 0 ? `Z0 = X0 del transformador zig-zag = ${fmt(x0zz, 2)} Ω (secundario en delta); Z0 de cables ≈ 4 Z1` : "Z0 del transformador Dyn o YNyn con terciario en delta ≈ Z1; Z0 de cables ≈ 4 Z1 (aproximación IEC 60909-2)", resultado: "Por barra" },
      { titulo: "Corriente pico", formula: "ip = κ × √2 × Ik\"; κ = 1,02 + 0,98 e^(−3R/X)", sustitucion: "IEC 60909-0 ec. 55", resultado: "Por barra" }
    ],
    verificaciones,
    conclusion: verificaciones.length ? veredicto(verificaciones, "Los interruptores tienen capacidad de interrupción suficiente.", "Hay interruptores con capacidad de interrupción insuficiente.") : `La corriente de cortocircuito trifásica en el secundario es ${fmt(barras[0].ik3 / 1000, 2)} kA; con ella se especifica la capacidad de interrupción de los equipos.`
  };
}

// ================================================================ 7. COORDINACIÓN DE PROTECCIONES (IEC 60255)
export function tiempoRele(p, I) {
  const is = num(p.pickup), tms = num(p.tms, 0.1), curva = N.CURVAS_IEC[p.curva] || N.CURVAS_IEC.SI;
  if (!(I > is * 1.0001) || is <= 0) return Infinity;
  let t = p.curva === "DT" ? tms : (tms * curva.k) / (Math.pow(I / is, curva.a) - 1);
  const iinst = num(p.inst, 0);
  if (iinst > 0 && I >= iinst) t = Math.min(t, num(p.tinst, 0.05));
  return t;
}
export function coordinacion(e) {
  const rels = filas(e.protecciones);
  const fallas = filas(e.fallas).map((f) => ({ punto: f.punto || "", I: num(f.corriente) }));
  const cti = num(e.cti, 0.3);
  const verificaciones = [];
  const tabla = fallas.map((f) => [f.punto, fmt(f.I, 0), ...rels.map((r) => { const t = tiempoRele(r, f.I); return Number.isFinite(t) ? fmt(t, 3) : "No opera"; })]);
  fallas.forEach((f) => {
    for (let i = 0; i + 1 < rels.length; i++) {
      const t1 = tiempoRele(rels[i], f.I), t2 = tiempoRele(rels[i + 1], f.I);
      if (Number.isFinite(t1) && Number.isFinite(t2)) verificaciones.push({ criterio: `${f.punto}: ${rels[i + 1].nombre} respalda a ${rels[i].nombre}`, norma: "IEEE 242 / IEC 60255 — margen de coordinación", valor: `${fmt(t2 - t1, 3)} s`, limite: `≥ ${fmt(cti, 2)} s`, cumple: t2 - t1 >= cti - 1e-9 });
    }
  });
  const inrush = num(e.iInrush, 0);
  if (inrush > 0 && rels.length) {
    const r = rels[rels.length - 1], t = tiempoRele(r, inrush);
    verificaciones.push({ criterio: `${r.nombre}: no dispara con la corriente de energización`, norma: "IEEE C37.91 (punto de inrush a 0,1 s)", valor: Number.isFinite(t) ? `${fmt(t, 3)} s` : "No opera", limite: "> 0,10 s", cumple: !Number.isFinite(t) || t > 0.1 });
  }
  return {
    resumen: [{ etiqueta: "Pares coordinados", valor: `${verificaciones.filter((v) => v.cumple).length} de ${verificaciones.length}`, unidad: "" }],
    tablas: [
      { titulo: "Ajustes de las protecciones", encabezados: ["Protección", "Curva", "I arranque (A)", "TMS / t (s)", "I instantánea (A)", "t inst. (s)"], filas: rels.map((r) => [r.nombre || "", (N.CURVAS_IEC[r.curva] || N.CURVAS_IEC.SI).nombre, fmt(num(r.pickup), 0), fmt(num(r.tms), 3), num(r.inst) ? fmt(num(r.inst), 0) : "—", num(r.inst) ? fmt(num(r.tinst, 0.05), 2) : "—"]) },
      { titulo: "Tiempos de operación (s) por corriente de falla", encabezados: ["Punto de falla", "I (A)", ...rels.map((r) => r.nombre || "")], filas: tabla }
    ],
    pasos: [
      { titulo: "Curvas de tiempo inverso", formula: "t = TMS × k / ((I / Is)^α − 1)", sustitucion: "IEC 60255-151: SI k = 0,14 α = 0,02; VI k = 13,5 α = 1; EI k = 80 α = 2; LTI k = 120 α = 1", resultado: "Por protección y corriente" },
      { titulo: "Margen de coordinación", formula: "t aguas arriba − t aguas abajo ≥ CTI", sustitucion: `CTI = ${fmt(cti, 2)} s`, resultado: "Por par de protecciones y punto de falla" }
    ],
    verificaciones,
    grafico: { tipo: "tcc", reles: rels, fallas, inrush },
    conclusion: veredicto(verificaciones, "Las protecciones quedan coordinadas con el margen exigido.", "Hay pares de protecciones sin margen suficiente: ajuste TMS o arranques.")
  };
}

// ================================================================ 8. MALLA DE PUESTA A TIERRA (IEEE 80-2013)
export function malla(e) {
  const rho = num(e.rho, 100), rhos = num(e.rhoS, 3000), hs = num(e.hs, 0.1);
  const If = num(e.ifalla, 5000), Sf = num(e.sf, 100) / 100, tf = num(e.tf, 0.5), tc = num(e.tc, tf), XR = num(e.xr, 10);
  const Lx = num(e.lx, 20), Ly = num(e.ly, 20), D = num(e.d, 5), h = num(e.h, 0.5);
  const cal = e.calibre || "2/0", dmm = N.DIAMETRO_COBRE_DESNUDO[cal] || 10.52, d = dmm / 1000;
  const mat = N.MATERIALES_SPT[e.material] || N.MATERIALES_SPT.cuDuro;
  const Ta = num(e.ta, 40), nR = num(e.varillas, 0), Lr = num(e.lVarilla, 2.4), rodsPer = e.varillasPerimetro !== "No";
  const k = num(e.peso, 70) >= 70 ? 0.157 : 0.116;
  // Capa superficial y tensiones tolerables.
  const Cs = hs > 0 && rhos > 0 ? 1 - (0.09 * (1 - rho / rhos)) / (2 * hs + 0.09) : 1;
  const ets = rhos > 0 && hs > 0 ? rhos : rho;
  const Etouch = ((1000 + 1.5 * Cs * ets) * k) / Math.sqrt(tf);
  const Estep = ((1000 + 6 * Cs * ets) * k) / Math.sqrt(tf);
  // Corriente de malla.
  const TaDc = XR / (2 * PI * 60);
  const Df = Math.sqrt(1 + (TaDc / tf) * (1 - Math.exp((-2 * tf) / TaDc)));
  const IG = Df * Sf * If;
  // Conductor (IEEE 80 ec. 37).
  const Areq = (Df * If / 1000) / Math.sqrt(((mat.TCAP * 1e-4) / (tc * mat.ar * mat.rr)) * Math.log((mat.K0 + mat.Tm) / (mat.K0 + Ta)));
  const Acal = N.SECCION_MM2[cal] || 67.43;
  // Geometría.
  const nx = Math.round(Lx / D) + 1, ny = Math.round(Ly / D) + 1;
  const LC = ny * Lx + nx * Ly, Lp = 2 * (Lx + Ly), A = Lx * Ly, LR = nR * Lr, LT = LC + LR;
  const Rg = rho * (1 / LT + (1 / Math.sqrt(20 * A)) * (1 + 1 / (1 + h * Math.sqrt(20 / A))));
  const GPR = IG * Rg;
  const na = (2 * LC) / Lp, nb = Math.sqrt(Lp / (4 * Math.sqrt(A))), n = na * nb;
  const Kii = nR > 0 && rodsPer ? 1 : 1 / Math.pow(2 * n, 2 / n);
  const Kh = Math.sqrt(1 + h / 1);
  const Km = (1 / (2 * PI)) * (Math.log((D * D) / (16 * h * d) + Math.pow(D + 2 * h, 2) / (8 * D * d) - h / (4 * d)) + (Kii / Kh) * Math.log(8 / (PI * (2 * n - 1))));
  const Ki = 0.644 + 0.148 * n;
  const LM = nR > 0 && rodsPer ? LC + (1.55 + 1.22 * (Lr / Math.sqrt(Lx * Lx + Ly * Ly))) * LR : LC + LR;
  const Em = (rho * Km * Ki * IG) / LM;
  const Ks = (1 / PI) * (1 / (2 * h) + 1 / (D + h) + (1 / D) * (1 - Math.pow(0.5, n - 2)));
  const LS = 0.75 * LC + 0.85 * LR;
  const Es = (rho * Ks * Ki * IG) / LS;
  const ret = N.RETIE_RESISTENCIA_SPT[e.tipoInstalacion] || N.RETIE_RESISTENCIA_SPT.subMT;
  const verificaciones = [
    { criterio: "Tensión de contacto (de malla)", norma: "IEEE 80-2013 §16", valor: `${fmt(Em, 1)} V`, limite: `≤ ${fmt(Etouch, 1)} V`, cumple: Em <= Etouch },
    { criterio: "Tensión de paso", norma: "IEEE 80-2013 §16", valor: `${fmt(Es, 1)} V`, limite: `≤ ${fmt(Estep, 1)} V`, cumple: Es <= Estep },
    { criterio: "Resistencia de puesta a tierra", norma: `RETIE — valor de referencia: ${ret.nombre}`, valor: `${fmt(Rg, 2)} Ω`, limite: `≤ ${fmt(ret.max, 0)} Ω`, cumple: Rg <= ret.max },
    { criterio: "Sección del conductor de la malla", norma: "IEEE 80-2013 ec. 37 (fusión)", valor: `${fmt(Acal, 1)} mm² (${N.etiquetaCalibre(cal)})`, limite: `≥ ${fmt(Areq, 1)} mm²`, cumple: Acal >= Areq }
  ];
  return {
    resumen: [
      { etiqueta: "Resistencia de la malla", valor: fmt(Rg, 2), unidad: "Ω" },
      { etiqueta: "Elevación de potencial (GPR)", valor: fmt(GPR, 0), unidad: "V" },
      { etiqueta: "Tensión de contacto / tolerable", valor: `${fmt(Em, 0)} / ${fmt(Etouch, 0)}`, unidad: "V" },
      { etiqueta: "Tensión de paso / tolerable", valor: `${fmt(Es, 0)} / ${fmt(Estep, 0)}`, unidad: "V" }
    ],
    tablas: [{ titulo: "Parámetros de la malla", encabezados: ["Parámetro", "Valor"], filas: [
      ["Dimensiones", `${fmt(Lx, 1)} m × ${fmt(Ly, 1)} m (A = ${fmt(A, 1)} m²)`], ["Espaciamiento / profundidad", `${fmt(D, 2)} m / ${fmt(h, 2)} m`],
      ["Conductores", `${nx} × ${fmt(Ly, 1)} m + ${ny} × ${fmt(Lx, 1)} m; LC = ${fmt(LC, 1)} m`], ["Varillas", `${nR} × ${fmt(Lr, 2)} m${nR ? (rodsPer ? " (en el perímetro)" : " (en el interior)") : ""}`],
      ["Corriente de malla IG", `${fmt(IG, 0)} A (Df = ${fmt(Df, 3)}, Sf = ${fmt(Sf * 100, 0)} %)`], ["Factores", `Cs = ${fmt(Cs, 3)}; n = ${fmt(n, 2)}; Km = ${fmt(Km, 3)}; Ks = ${fmt(Ks, 3)}; Ki = ${fmt(Ki, 3)}`]
    ] }],
    pasos: [
      { titulo: "Factor de reducción de la capa superficial", formula: "Cs = 1 − 0,09 (1 − ρ/ρs) / (2 hs + 0,09)", sustitucion: `ρ = ${fmt(rho, 0)}; ρs = ${fmt(rhos, 0)} Ω·m; hs = ${fmt(hs, 3)} m`, resultado: `Cs = ${fmt(Cs, 3)}` },
      { titulo: `Tensiones tolerables (persona de ${num(e.peso, 70) >= 70 ? 70 : 50} kg)`, formula: `E contacto = (1000 + 1,5 Cs ρs) × ${k} / √ts; E paso = (1000 + 6 Cs ρs) × ${k} / √ts`, sustitucion: `ts = ${fmt(tf, 2)} s`, resultado: `E contacto = ${fmt(Etouch, 1)} V; E paso = ${fmt(Estep, 1)} V` },
      { titulo: "Corriente de malla", formula: "IG = Df × Sf × 3I0; Df = √(1 + Ta/tf (1 − e^(−2tf/Ta)))", sustitucion: `X/R = ${fmt(XR, 1)} → Ta = ${fmt(TaDc, 4)} s`, resultado: `IG = ${fmt(IG, 0)} A` },
      { titulo: "Sección mínima del conductor", formula: "A = I / √((TCAP × 10⁻⁴ / (tc αr ρr)) × ln((K0 + Tm) / (K0 + Ta)))", sustitucion: `${mat.nombre}; tc = ${fmt(tc, 2)} s`, resultado: `${fmt(Areq, 1)} mm²` },
      { titulo: "Resistencia de la malla (Sverak)", formula: "Rg = ρ [1/LT + 1/√(20A) (1 + 1/(1 + h√(20/A)))]", sustitucion: `LT = ${fmt(LT, 1)} m; A = ${fmt(A, 1)} m²`, resultado: `Rg = ${fmt(Rg, 3)} Ω; GPR = ${fmt(GPR, 0)} V` },
      { titulo: "Tensión de malla", formula: "Em = ρ Km Ki IG / LM", sustitucion: `Km = ${fmt(Km, 3)}; Ki = ${fmt(Ki, 3)}; LM = ${fmt(LM, 1)} m`, resultado: `Em = ${fmt(Em, 1)} V` },
      { titulo: "Tensión de paso", formula: "Es = ρ Ks Ki IG / LS", sustitucion: `Ks = ${fmt(Ks, 3)}; LS = ${fmt(LS, 1)} m`, resultado: `Es = ${fmt(Es, 1)} V` }
    ],
    verificaciones,
    conclusion: veredicto(verificaciones, "La malla cumple tensiones de paso y contacto, resistencia y sección del conductor.", "La malla no cumple: reduzca el espaciamiento, agregue varillas o aumente el área o la capa superficial.")
  };
}

// ================================================================ 9. RIESGO POR RAYOS (IEC 62305-2 / NTC 4552-2)
export function rayos(e) {
  const L = num(e.largo, 20), W = num(e.ancho, 10), H = num(e.alto, 8), NG = num(e.ng, 5);
  const v = (tabla, k, def) => (tabla[k] || tabla[def]).v;
  const CD = v(N.CD_UBICACION, e.ubicacion, "rodeada_iguales");
  const AD = L * W + 2 * (3 * H) * (L + W) + PI * Math.pow(3 * H, 2);
  const ND = NG * AD * CD * 1e-6;
  const LL = num(e.longLinea, 1000), CI = e.lineaEnterrada === "Sí" ? 0.5 : 1, CE = num(e.ce, 0.5), CT = e.trafoLinea === "Sí" ? 0.2 : 1;
  const NL = NG * 40 * LL * CI * CE * CT * 1e-6;
  const nz = num(e.personasZona, 10), nt = Math.max(num(e.personasTotal, 10), nz), tz = num(e.horas, 8760);
  const frac = (nz / nt) * (tz / 8760);
  const rt = v(N.RT_SUELO, e.suelo, "agricola"), rp = v(N.RP_PROVISIONES, e.provisiones, "ninguna"), rf = v(N.RF_INCENDIO, e.incendio, "ordinario"), hz = v(N.HZ_PANICO, e.panico, "ninguno"), LF = v(N.LF_TIPO, e.tipoEstructura, "otro");
  const LA = rt * 1e-2 * frac, LB = rp * rf * hz * LF * frac;
  const evaluar = (sipra, dps, pta) => {
    const PB = v(N.PB_SIPRA, sipra, "ninguno"), PEB = v(N.PEB_DPS, dps, "ninguno"), PTA = v(N.PTA_MEDIDAS, pta, "ninguna");
    const PA = PTA * PB, PU = PTA * PEB, PV = PEB;
    const RA = ND * PA * LA, RB = ND * PB * LB, RU = NL * PU * LA, RV = NL * PV * LB;
    return { RA, RB, RU, RV, R1: RA + RB + RU + RV, PB, PEB, PTA };
  };
  const sinProt = evaluar("ninguno", "ninguno", "ninguna");
  const conProt = evaluar(e.sipra, e.dps, e.medidas);
  let recomendacion = null;
  if (conProt.R1 > N.RIESGO_TOLERABLE_R1) {
    outer: for (const s of ["ninguno", "IV", "III", "II", "I"]) for (const p of ["ninguno", "III-IV", "II", "I"]) {
      const r = evaluar(s, p, e.medidas);
      if (r.R1 <= N.RIESGO_TOLERABLE_R1) { recomendacion = { sipra: s, dps: p, R1: r.R1 }; break outer; }
    }
  }
  const verificaciones = [{ criterio: "Riesgo de pérdida de vidas humanas R1 con las medidas adoptadas", norma: "IEC 62305-2 / NTC 4552-2 (RT = 10⁻⁵)", valor: conProt.R1.toExponential(2), limite: "≤ 1,00e-5", cumple: conProt.R1 <= N.RIESGO_TOLERABLE_R1 }];
  const nivel = N.NIVELES_SIPRA[e.sipra];
  return {
    resumen: [
      { etiqueta: "Descargas directas a la estructura ND", valor: ND.toExponential(2), unidad: "/año" },
      { etiqueta: "R1 sin protección", valor: sinProt.R1.toExponential(2), unidad: "" },
      { etiqueta: "R1 con las medidas adoptadas", valor: conProt.R1.toExponential(2), unidad: "" }
    ],
    tablas: [
      { titulo: "Componentes de riesgo", encabezados: ["Componente", "Sin protección", "Con medidas adoptadas"], filas: [
        ["RA (lesiones por tensiones de paso y contacto)", sinProt.RA.toExponential(2), conProt.RA.toExponential(2)],
        ["RB (daño físico en la estructura)", sinProt.RB.toExponential(2), conProt.RB.toExponential(2)],
        ["RU (lesiones por descargas en la línea)", sinProt.RU.toExponential(2), conProt.RU.toExponential(2)],
        ["RV (daño físico por descargas en la línea)", sinProt.RV.toExponential(2), conProt.RV.toExponential(2)],
        ["R1 total", sinProt.R1.toExponential(2), conProt.R1.toExponential(2)]
      ] },
      { titulo: "Medidas de protección adoptadas", encabezados: ["Medida", "Valor"], filas: [
        ["Sistema de protección externo (SIPRA)", `${(N.PB_SIPRA[e.sipra] || N.PB_SIPRA.ninguno).nombre}${nivel ? ` — esfera rodante ${nivel.esfera} m, malla ${nivel.malla} m` : ""}`],
        ["DPS coordinados", (N.PEB_DPS[e.dps] || N.PEB_DPS.ninguno).nombre], ["Medidas contra tensiones de paso y contacto", (N.PTA_MEDIDAS[e.medidas] || N.PTA_MEDIDAS.ninguna).nombre]
      ] }
    ],
    pasos: [
      { titulo: "Área colectiva equivalente", formula: "AD = L W + 2 (3H)(L + W) + π (3H)²", sustitucion: `L = ${fmt(L, 1)}; W = ${fmt(W, 1)}; H = ${fmt(H, 1)} m`, resultado: `AD = ${fmt(AD, 1)} m²` },
      { titulo: "Número de descargas a la estructura", formula: "ND = NG × AD × CD × 10⁻⁶", sustitucion: `NG = ${fmt(NG, 2)} descargas/km²·año; CD = ${fmt(CD, 2)}`, resultado: `ND = ${ND.toExponential(3)}` },
      { titulo: "Descargas a la línea de servicio", formula: "NL = NG × 40 LL × CI × CE × CT × 10⁻⁶", sustitucion: `LL = ${fmt(LL, 0)} m; CI = ${CI}; CE = ${CE}; CT = ${CT}`, resultado: `NL = ${NL.toExponential(3)}` },
      { titulo: "Pérdidas", formula: "LA = rt × LT × (nz/nt)(tz/8760); LB = rp × rf × hz × LF × (nz/nt)(tz/8760)", sustitucion: `rt = ${rt}; rp = ${rp}; rf = ${rf}; hz = ${hz}; LF = ${LF}`, resultado: `LA = ${LA.toExponential(2)}; LB = ${LB.toExponential(2)}` },
      { titulo: "Riesgo R1", formula: "R1 = RA + RB + RU + RV", sustitucion: "RX = NX × PX × LX", resultado: `R1 = ${conProt.R1.toExponential(3)}` }
    ],
    verificaciones,
    notas: ["Análisis de R1 (pérdida de vidas humanas). Para estructuras con riesgo de explosión, hospitales o pérdida de servicio público, completar los componentes RC, RM, RW y RZ y los riesgos R2 a R4 de la IEC 62305-2.", "La densidad de descargas a tierra (NG) se toma del mapa de la NTC 4552-1 para el sitio."],
    conclusion: conProt.R1 <= N.RIESGO_TOLERABLE_R1 ? `Con las medidas adoptadas, R1 = ${conProt.R1.toExponential(2)} ≤ 10⁻⁵: el riesgo es tolerable.` : `R1 = ${conProt.R1.toExponential(2)} supera el tolerable.${recomendacion ? ` Combinación mínima que cumple: ${(N.PB_SIPRA[recomendacion.sipra]).nombre} con ${(N.PEB_DPS[recomendacion.dps]).nombre} (R1 = ${recomendacion.R1.toExponential(2)}).` : " Ninguna combinación de SIPRA y DPS lo cumple: revise las medidas de paso y contacto y de incendio."}`
  };
}

// ================================================================ 10. COORDINACIÓN DE AISLAMIENTO Y DPS (IEC 60071 / IEC 60099-5)
export function aislamiento(e, proyecto = {}) {
  const Um = num(e.um, 36), Us = num(e.us, 0) || Um, k = e.puestaTierra === "aislado" ? 1.73 : e.puestaTierra === "solido" ? 1.3 : 1.4;
  const H = num(e.altitud, num(proyecto.altitud, 0));
  const bil = num(e.bil, 170), ur = num(e.ur, 30), uc = num(e.uc, 24), ures = num(e.ures, 80), T = num(e.capTov, 1.1);
  const dist = num(e.distancia, 0), S = num(e.pendiente, 500);
  const tov = (k * Us) / Math.sqrt(3);
  const ucMin = Us / Math.sqrt(3), urMin = tov / T;
  const Ka = Math.exp(H / 8150);
  const vEquipo = ures + 2 * S * (dist / 300);
  const margen = ((bil / Ka) / vEquipo - 1) * 100;
  const fila = N.DISTANCIA_AIRE_BIL.find((r) => r[0] >= bil) || N.DISTANCIA_AIRE_BIL[N.DISTANCIA_AIRE_BIL.length - 1];
  const dAire = fila[1] * Ka;
  const normalizados = N.NIVELES_AISLAMIENTO[String(Um)] || [];
  const verificaciones = [
    { criterio: "Tensión de operación continua del DPS", norma: "IEC 60099-5 — Uc ≥ Us/√3", valor: `${fmt(uc, 1)} kV`, limite: `≥ ${fmt(ucMin, 1)} kV`, cumple: uc >= ucMin },
    { criterio: "Tensión asignada frente a sobretensiones temporales", norma: "IEC 60099-5 — Ur ≥ TOV / T", valor: `${fmt(ur, 1)} kV`, limite: `≥ ${fmt(urMin, 1)} kV`, cumple: ur >= urMin },
    { criterio: "Margen de protección al impulso tipo rayo", norma: "IEEE C62.22 / IEC 60071-2 (≥ 20 %)", valor: `${fmt(margen, 1)} %`, limite: "≥ 20 %", cumple: margen >= 20 }
  ];
  if (normalizados.length) verificaciones.push({ criterio: "BIL del equipo frente a los niveles normalizados para Um", norma: "IEC 60071-1 Tabla 2", valor: `${fmt(bil, 0)} kV`, limite: `≥ ${Math.min(...normalizados)} kV (normalizados: ${normalizados.join(" / ")} kV)`, cumple: bil >= Math.min(...normalizados) });
  return {
    resumen: [
      { etiqueta: "Sobretensión temporal TOV", valor: fmt(tov, 1), unidad: "kV" },
      { etiqueta: "Tensión en el equipo", valor: fmt(vEquipo, 1), unidad: "kV" },
      { etiqueta: "Margen de protección", valor: fmt(margen, 1), unidad: "%" },
      { etiqueta: "Distancia mínima en aire fase-tierra", valor: fmt(dAire, 0), unidad: "mm" }
    ],
    tablas: [{ titulo: "Coordinación de aislamiento", encabezados: ["Parámetro", "Valor"], filas: [
      ["Tensión máxima del equipo Um / de operación del sistema Us", `${fmt(Um, 1)} / ${fmt(Us, 1)} kV`], ["Puesta a tierra del neutro", e.puestaTierra === "aislado" ? "Aislado o no efectiva (k = 1,73)" : e.puestaTierra === "solido" ? "Sólida (k = 1,3)" : "Efectiva (k = 1,4)"],
      ["Altitud del sitio / factor Ka", `${fmt(H, 0)} m / ${fmt(Ka, 3)}`], ["BIL del equipo", `${fmt(bil, 0)} kV`],
      ["DPS: Ur / Uc / Ures (10 kA)", `${fmt(ur, 1)} / ${fmt(uc, 1)} / ${fmt(ures, 1)} kV`], ["Separación DPS-equipo", `${fmt(dist, 1)} m (pendiente ${fmt(S, 0)} kV/µs)`]
    ] }],
    pasos: [
      { titulo: "Sobretensión temporal", formula: "TOV = k × Us / √3", sustitucion: `${k} × ${fmt(Us, 1)} / √3`, resultado: `${fmt(tov, 1)} kV` },
      { titulo: "Selección del DPS", formula: "Uc ≥ Us/√3; Ur ≥ TOV / T", sustitucion: `T = ${fmt(T, 2)} p.u. (capacidad TOV del catálogo)`, resultado: `Uc mín = ${fmt(ucMin, 1)} kV; Ur mín = ${fmt(urMin, 1)} kV` },
      { titulo: "Corrección por altitud", formula: "Ka = e^(H/8150) (m = 1, impulso tipo rayo)", sustitucion: `H = ${fmt(H, 0)} m`, resultado: `Ka = ${fmt(Ka, 3)}` },
      { titulo: "Tensión en el equipo por la separación", formula: "Ve = Ures + 2 S d / v (v = 300 m/µs)", sustitucion: `${fmt(ures, 1)} + 2 × ${fmt(S, 0)} × ${fmt(dist, 1)} / 300`, resultado: `${fmt(vEquipo, 1)} kV` },
      { titulo: "Margen de protección", formula: "MP = (BIL / Ka) / Ve − 1", sustitucion: `(${fmt(bil, 0)} / ${fmt(Ka, 3)}) / ${fmt(vEquipo, 1)} − 1`, resultado: `${fmt(margen, 1)} %` },
      { titulo: "Distancia mínima en aire", formula: "d = d(BIL) × Ka", sustitucion: `IEC 60071-1 Anexo A: ${fila[1]} mm para ${fila[0]} kV`, resultado: `${fmt(dAire, 0)} mm` }
    ],
    verificaciones,
    conclusion: veredicto(verificaciones, "El DPS seleccionado protege el aislamiento con margen suficiente.", "La coordinación de aislamiento no cumple: revise el DPS, su ubicación o el BIL del equipo.")
  };
}

// ================================================================ 11. DISTANCIAS DE SEGURIDAD (RETIE)
export function distancias(e, proyecto = {}) {
  const H = num(e.altitud, num(proyecto.altitud, 0));
  const fAlt = H > 1000 ? 1 + 0.0125 * ((H - 1000) / 100) : 1;
  const verificaciones = [];
  const tabla = filas(e.puntos).map((p) => {
    const tipo = N.RETIE_DISTANCIAS.tipos[p.tipo] || N.RETIE_DISTANCIAS.tipos.e;
    const base = num(p.exigida, NaN);
    const tablaV = tipo.v[p.tension];
    const req = (Number.isFinite(base) ? base : tablaV ?? NaN) * fAlt;
    const dis = num(p.diseno);
    const ok = Number.isFinite(req) && dis >= req;
    verificaciones.push({ criterio: `${p.punto || "Punto"}: ${tipo.nombre.toLowerCase()}`, norma: Number.isFinite(base) ? "Valor digitado por el diseñador" : "RETIE — distancias mínimas de seguridad", valor: `${fmt(dis, 2)} m`, limite: Number.isFinite(req) ? `≥ ${fmt(req, 2)} m` : "Digite la distancia exigida", cumple: Number.isFinite(req) ? ok : false });
    return [p.punto || "", p.tension === "<1" ? "< 1 kV" : `${p.tension} kV`, tipo.nombre, Number.isFinite(req) ? fmt(req, 2) : "—", fmt(dis, 2), Number.isFinite(req) ? (ok ? "Cumple" : "No cumple") : "Sin dato"];
  });
  return {
    resumen: [{ etiqueta: "Puntos verificados", valor: String(tabla.length), unidad: "" }],
    tablas: [{ titulo: "Distancias mínimas de seguridad", encabezados: ["Punto", "Tensión", "Tipo de distancia", "Exigida (m)", "Diseño (m)", "Resultado"], filas: tabla }],
    pasos: [{ titulo: "Distancia exigida", formula: "d exigida = d tabla RETIE × factor de altitud", sustitucion: H > 1000 ? `Factor = 1 + 1,25 % por cada 100 m sobre 1000 m = ${fmt(fAlt, 3)}` : "Altitud ≤ 1000 m: factor 1", resultado: "Por punto" }],
    verificaciones,
    notas: ["Valores de la tabla de distancias mínimas de seguridad del RETIE. Verificar contra la versión vigente del reglamento antes de firmar la memoria; donde no hay valor cargado, el diseñador digita la distancia exigida."],
    conclusion: veredicto(verificaciones, "Todas las distancias de diseño cumplen las mínimas de seguridad.", "Hay distancias de diseño por debajo de las mínimas de seguridad.")
  };
}

// ================================================================ 12. CÁLCULO MECÁNICO DE CONDUCTORES
export function mecanico(e) {
  const base = N.CONDUCTORES_AEREOS[e.conductor];
  const c = base && e.conductor !== "personalizado" ? base : { nombre: "Conductor personalizado", area: num(e.area, 100), diametro: num(e.diametro, 13), peso: num(e.peso, 0.35), rotura: num(e.rotura, 3000), E: num(e.modulo, 75000), alfa: num(e.alfa, 19e-6) };
  const g = 9.80665, L = num(e.vano, 100);
  const EA = c.E * c.area, w0 = c.peso * g, rotN = c.rotura * g;
  const hip = filas(e.hipotesis).map((h) => ({ nombre: h.nombre || "", T: num(h.temperatura, 25), q: num(h.viento, 0) }));
  const hBase = hip.find((h) => /eds|diaria/i.test(h.nombre)) || hip[0] || { nombre: "EDS", T: 25, q: 0 };
  const T1 = (num(e.eds, 18) / 100) * rotN;
  const w = (h) => Math.hypot(w0, (h.q * c.diametro) / 1000);
  const w1 = w(hBase);
  const resolver = (h) => {
    const w2 = w(h);
    const A = T1 - (w1 * w1 * L * L * EA) / (24 * T1 * T1) - c.alfa * EA * (h.T - hBase.T);
    const B = (w2 * w2 * L * L * EA) / 24;
    let t = Math.max(T1, 1);
    for (let i = 0; i < 100; i++) { const f = t * t * (t - A) - B, df = 3 * t * t - 2 * A * t; const tn = t - f / df; if (Math.abs(tn - t) < 1e-6) { t = tn; break; } t = Math.max(tn, 1e-3); }
    return { ...h, w: w2, tension: t, flecha: (w2 * L * L) / (8 * t) };
  };
  const res = hip.map(resolver);
  const maxT = res.length ? Math.max(...res.map((r) => r.tension)) : 0;
  const maxF = res.length ? Math.max(...res.map((r) => r.flecha)) : 0;
  const alturaAmarre = num(e.alturaAmarre, 0), libre = num(e.distanciaMin, 0);
  const verificaciones = [
    { criterio: "Tensión de cada día (EDS)", norma: "Criterio de diseño (CIGRÉ: 18 a 22 % de la carga de rotura)", valor: `${fmt(num(e.eds, 18), 1)} %`, limite: `≤ ${fmt(num(e.edsMax, 22), 0)} %`, cumple: num(e.eds, 18) <= num(e.edsMax, 22) },
    { criterio: "Tensión máxima en las hipótesis de carga", norma: "Factor de seguridad ≥ 2 (≤ 50 % de la rotura)", valor: `${fmt(maxT / g, 0)} kgf (${fmt((maxT / rotN) * 100, 1)} %)`, limite: "≤ 50 %", cumple: maxT <= 0.5 * rotN }
  ];
  if (alturaAmarre > 0 && libre > 0) verificaciones.push({ criterio: "Distancia al suelo con flecha máxima", norma: "RETIE — distancias mínimas de seguridad", valor: `${fmt(alturaAmarre - maxF, 2)} m`, limite: `≥ ${fmt(libre, 2)} m`, cumple: alturaAmarre - maxF >= libre });
  return {
    resumen: [
      { etiqueta: "Tensión máxima", valor: fmt(maxT / g, 0), unidad: "kgf" },
      { etiqueta: "Flecha máxima", valor: fmt(maxF, 2), unidad: "m" }
    ],
    tablas: [
      { titulo: "Datos del conductor", encabezados: ["Parámetro", "Valor"], filas: [["Conductor", c.nombre], ["Área / diámetro", `${fmt(c.area, 1)} mm² / ${fmt(c.diametro, 2)} mm`], ["Peso", `${fmt(c.peso, 3)} kg/m`], ["Carga de rotura", `${fmt(c.rotura, 0)} kgf`], ["Módulo de elasticidad", `${fmt(c.E, 0)} N/mm²`], ["Coef. de dilatación", `${(c.alfa * 1e6).toFixed(1)} × 10⁻⁶ /°C`], ["Vano", `${fmt(L, 1)} m`]] },
      { titulo: "Tensiones y flechas por hipótesis", encabezados: ["Hipótesis", "T (°C)", "Viento (Pa)", "Carga (N/m)", "Tensión (kgf)", "% rotura", "Flecha (m)"], filas: res.map((r) => [r.nombre, fmt(r.T, 0), fmt(r.q, 0), fmt(r.w, 3), fmt(r.tension / g, 0), fmt((r.tension / rotN) * 100, 1), fmt(r.flecha, 2)]) }
    ],
    pasos: [
      { titulo: "Carga unitaria con viento", formula: "w = √(w0² + (q × d)²)", sustitucion: `w0 = ${fmt(w0, 3)} N/m; d = ${fmt(c.diametro, 2)} mm`, resultado: "Por hipótesis" },
      { titulo: "Condición inicial (EDS)", formula: "T1 = % EDS × carga de rotura", sustitucion: `${fmt(num(e.eds, 18), 1)} % × ${fmt(c.rotura, 0)} kgf a ${fmt(hBase.T, 0)} °C`, resultado: `T1 = ${fmt(T1 / g, 0)} kgf` },
      { titulo: "Ecuación de cambio de estado", formula: "T2² [T2 − T1 + w1² L² EA / (24 T1²) + α EA (θ2 − θ1)] = w2² L² EA / 24", sustitucion: `EA = ${fmt(EA, 0)} N; L = ${fmt(L, 1)} m`, resultado: "Se resuelve por Newton-Raphson para cada hipótesis" },
      { titulo: "Flecha", formula: "f = w L² / (8 T)", sustitucion: "Aproximación parabólica", resultado: `Flecha máxima = ${fmt(maxF, 2)} m` }
    ],
    verificaciones,
    conclusion: veredicto(verificaciones, `El conductor ${c.nombre} trabaja dentro de los límites mecánicos; flecha máxima ${fmt(maxF, 2)} m.`, "El cálculo mecánico no cumple: reduzca el tensado, el vano o cambie el conductor.")
  };
}

// ================================================================ 13. TRANSFORMADOR DE POTENCIA (subestaciones AT/MT)
// Corrientes por etapa de refrigeración y por toma extrema, cortocircuito
// pasante (IEC 60076-5, con la impedancia de la red) y verificación de los
// TC y de los equipos en serie con cada devanado.
export function trafoPotencia(e) {
  const sOnan = num(e.sOnan, 40), sOnaf = Math.max(num(e.sOnaf, sOnan), sOnan);
  const uAT = num(e.uAT, 115), uMT = num(e.uMT, 34.5), uk = num(e.uk, 9.5), tap = num(e.tapRango, 12.5);
  const baseUk = e.ukBase === "ONAF" ? sOnaf : sOnan;
  const ikRed = num(e.ikRed, 40), c = num(e.factorC, 1.1);
  const dem = num(e.demanda, 0), crec = num(e.crecimiento, 0), demFut = dem * (1 + crec / 100);
  const inAT = (s) => (s * 1000) / (Math.sqrt(3) * uAT), inMT = (s) => (s * 1000) / (Math.sqrt(3) * uMT);
  const iATmax = inAT(sOnaf) / (1 - tap / 100); // toma de menor tensión
  // Impedancias referidas al lado MT (Ω).
  const skRed = Math.sqrt(3) * uAT * ikRed; // MVA
  const ZQ = (c * uMT * uMT) / skRed, ZT = (uk / 100) * (uMT * uMT) / baseUk;
  const ikMT = (c * uMT) / (Math.sqrt(3) * (ZQ + ZT)); // kA
  const ikMTinf = (c * uMT) / (Math.sqrt(3) * ZT);
  const ikPasAT = ikMT * (uMT / uAT); // kA vistos desde AT
  const ikEsp = num(e.ikSoporta, 0), tEsp = num(e.tSoporta, 2);
  const lado = (l) => (l === "AT" ? { inom: iATmax, ik: ikRed, u: uAT } : { inom: inMT(sOnaf), ik: ikMT, u: uMT });
  const verificaciones = [];
  if (dem > 0) {
    verificaciones.push({ criterio: "Cargabilidad con la demanda proyectada (ONAF)", norma: "IEC 60076-7 / criterio del operador de red", valor: `${fmt((demFut / sOnaf) * 100, 1)} %`, limite: `≤ ${fmt(num(e.cargaMax, 100), 0)} %`, cumple: (demFut / sOnaf) * 100 <= num(e.cargaMax, 100) });
  }
  if (ikEsp > 0) verificaciones.push({ criterio: "Cortocircuito pasante frente a la soportabilidad especificada (lado AT)", norma: "IEC 60076-5 — corriente simétrica con la impedancia de la red", valor: `${fmt(ikPasAT, 2)} kA`, limite: `≤ ${fmt(ikEsp, 2)} kA (${fmt(tEsp, 0)} s, valor del plano o la especificación)`, cumple: ikPasAT <= ikEsp });
  const tcs = filas(e.tcs).map((t) => {
    const L = lado(t.lado), ipn = num(t.primaria), alf = num(t.alf, 20), proteccion = t.funcion === "Protección";
    const okTerm = ipn > 0 && L.inom <= 1.2 * ipn; // corriente térmica extendida 120 %
    const ikTC = t.lado === "AT" ? ikPasAT : ikMT;
    const okSat = !proteccion || ipn * alf >= ikTC * 1000;
    verificaciones.push({ criterio: `${t.nombre || "TC"} (${t.lado}, ${fmt(ipn, 0)} A): corriente nominal de la máquina`, norma: "IEC 61869-2 — corriente térmica extendida 120 %", valor: `${fmt(L.inom, 0)} A`, limite: `≤ ${fmt(1.2 * ipn, 0)} A`, cumple: okTerm });
    if (proteccion) verificaciones.push({ criterio: `${t.nombre || "TC"}: no satura con la falla pasante`, norma: `IEC 61869-2 — ALF ${fmt(alf, 0)} × Ipn`, valor: `${fmt(ikTC, 2)} kA`, limite: `≤ ${fmt((ipn * alf) / 1000, 2)} kA`, cumple: okSat });
    return [t.nombre || "", t.lado, t.funcion || "", `${fmt(ipn, 0)} A`, proteccion ? fmt(alf, 0) : "—", `${fmt(L.inom, 0)} A`, okTerm && okSat ? "Cumple" : "No cumple"];
  });
  const equipos = filas(e.equipos).map((q) => {
    const L = lado(q.lado), inq = num(q.inom), icq = num(q.icc);
    const okI = inq >= L.inom, okK = !icq || icq >= L.ik;
    verificaciones.push({ criterio: `${q.equipo || "Equipo"} (${q.lado}): corriente nominal`, norma: "IEC 62271-1 — In ≥ corriente máxima del circuito", valor: `${fmt(inq, 0)} A`, limite: `≥ ${fmt(L.inom, 0)} A`, cumple: okI });
    if (icq) verificaciones.push({ criterio: `${q.equipo || "Equipo"} (${q.lado}): corriente de cortocircuito`, norma: "IEC 62271-1 / -100 — Ik del equipo ≥ Ik de la barra", valor: `${fmt(icq, 1)} kA`, limite: `≥ ${fmt(L.ik, 2)} kA`, cumple: okK });
    return [q.equipo || "", q.lado, `${fmt(inq, 0)} A`, icq ? `${fmt(icq, 1)} kA` : "—", `${fmt(L.inom, 0)} A / ${fmt(L.ik, 2)} kA`, okI && okK ? "Cumple" : "No cumple"];
  });
  return {
    resumen: [
      { etiqueta: "Potencia ONAN / ONAF", valor: `${fmt(sOnan, 0)} / ${fmt(sOnaf, 0)}`, unidad: "MVA" },
      { etiqueta: "In MT (ONAF)", valor: fmt(inMT(sOnaf), 0), unidad: "A" },
      { etiqueta: "Ik\" en barra MT", valor: fmt(ikMT, 2), unidad: "kA" },
      { etiqueta: "Ik pasante vista desde AT", valor: fmt(ikPasAT, 2), unidad: "kA" }
    ],
    salidas: { sn: sOnan * 1000, z: uk, vs: uMT * 1000, vp: uAT * 1000, ikMT, ikAT: ikRed, inMT: inMT(sOnaf), inAT: iATmax },
    tablas: [
      { titulo: "Corrientes nominales del transformador", encabezados: ["Condición", "Potencia (MVA)", `I AT ${fmt(uAT, 1)} kV (A)`, `I MT ${fmt(uMT, 1)} kV (A)`], filas: [
        ["ONAN, toma central", fmt(sOnan, 1), fmt(inAT(sOnan), 1), fmt(inMT(sOnan), 1)],
        ["ONAF, toma central", fmt(sOnaf, 1), fmt(inAT(sOnaf), 1), fmt(inMT(sOnaf), 1)],
        [`ONAF, toma extrema (−${fmt(tap, 2)} %)`, fmt(sOnaf, 1), fmt(iATmax, 1), fmt(inMT(sOnaf), 1)]
      ] },
      { titulo: "Cortocircuito pasante (referido al lado MT)", encabezados: ["Elemento", "Valor"], filas: [
        ["Red en AT", `Ik" = ${fmt(ikRed, 1)} kA → S"kQ = ${fmt(skRed, 0)} MVA; ZQ = ${fmt(ZQ, 3)} Ω`],
        ["Transformador", `uk = ${fmt(uk, 2)} % sobre ${fmt(baseUk, 0)} MVA; ZT = ${fmt(ZT, 3)} Ω`],
        ["Ik\" en barra MT (con red / barra infinita)", `${fmt(ikMT, 2)} kA / ${fmt(ikMTinf, 2)} kA`],
        ["Ik pasante vista desde AT", `${fmt(ikPasAT, 2)} kA`]
      ] },
      ...(tcs.length ? [{ titulo: "Transformadores de corriente", encabezados: ["TC", "Lado", "Función", "Ipn", "ALF", "I máx. circuito", "Resultado"], filas: tcs }] : []),
      ...(equipos.length ? [{ titulo: "Equipos en serie con el transformador", encabezados: ["Equipo", "Lado", "In", "Ik equipo", "Exigido (In / Ik)", "Resultado"], filas: equipos }] : [])
    ],
    pasos: [
      { titulo: "Corrientes nominales", formula: "In = S / (√3 × U); en AT con la toma de menor tensión: In / (1 − rango)", sustitucion: `${fmt(sOnaf, 0)} MVA / (√3 × ${fmt(uAT, 1)} kV) / (1 − ${fmt(tap, 2)} %)`, resultado: `I AT máx. = ${fmt(iATmax, 1)} A; I MT = ${fmt(inMT(sOnaf), 1)} A` },
      { titulo: "Impedancia de la red referida a MT", formula: "ZQ = c × U MT² / S\"kQ; S\"kQ = √3 × U AT × Ik\" AT", sustitucion: `c = ${fmt(c, 2)}; Ik" AT = ${fmt(ikRed, 1)} kA`, resultado: `ZQ = ${fmt(ZQ, 4)} Ω` },
      { titulo: "Impedancia del transformador", formula: "ZT = uk × U MT² / Sbase", sustitucion: `${fmt(uk, 2)} % × ${fmt(uMT, 1)}² / ${fmt(baseUk, 0)}`, resultado: `ZT = ${fmt(ZT, 4)} Ω` },
      { titulo: "Cortocircuito pasante", formula: "Ik\" MT = c × U MT / (√3 × (ZQ + ZT)); Ik visto desde AT = Ik\" MT × U MT / U AT", sustitucion: "IEC 60076-5 §4.1 (incluye la impedancia de la red)", resultado: `${fmt(ikMT, 2)} kA en MT; ${fmt(ikPasAT, 2)} kA en AT` }
    ],
    verificaciones,
    notas: ["La impedancia uk se toma sobre la potencia indicada (normalmente la ONAN); confirme la base con el protocolo de pruebas del fabricante.", "La corriente de falla en el lado AT de los equipos se toma igual a la de la red (falla en la barra AT)."],
    conclusion: veredicto(verificaciones, `El transformador de ${fmt(sOnan, 0)}/${fmt(sOnaf, 0)} MVA y los equipos asociados son coherentes con las corrientes nominales y de cortocircuito.`, "Hay incoherencias entre el transformador y los equipos o la soportabilidad especificada.")
  };
}

// ================================================================ 14. CABLES DE MEDIA TENSIÓN
// Capacidad de corriente con factores de corrección, soportabilidad al
// cortocircuito (método adiabático IEC 60949) y caída de tensión.
const K_ADIABATICO = { "Cu-XLPE": 143, "Al-XLPE": 94, "Cu-EPR": 143, "Al-EPR": 94, "Cu-PVC": 115, "Al-PVC": 76 };
export function cableMT(e, proyecto = {}, ctx = {}) {
  const U = num(e.tension, ctx.trafoPotencia ? ctx.trafoPotencia.vs / 1000 : 34.5), dvMax = num(e.dvMax, 3);
  const ik3cc = ctx.cortocircuito?.barras?.[0]?.ik3;
  const ikDef = ctx.trafoPotencia?.ikMT ?? (Number.isFinite(ik3cc) ? ik3cc / 1000 : 0);
  const verificaciones = [];
  const tabla = filas(e.circuitos).map((c) => {
    const mat = c.material === "Cu" ? "Cu" : "Al", ais = c.aislamiento || "XLPE";
    const S = N.SECCION_MM2[c.calibre] ?? num(c.calibre, 0);
    const amp = num(c.ampacidad) * num(c.factor, 1);
    const I = num(c.corriente), L = num(c.longitud) / 1000;
    const rho20 = mat === "Cu" ? 0.017241 : 0.028264, alfa = mat === "Cu" ? 0.00393 : 0.00403;
    const R = num(c.r, 0) || (S > 0 ? (rho20 / S) * 1000 * (1 + alfa * 70) : 0), X = num(c.x, 0.13);
    const fp = num(e.fp, 0.9), sen = Math.sqrt(1 - fp * fp);
    const dv = U > 0 ? (Math.sqrt(3) * I * L * (R * fp + X * sen)) / (U * 1000) * 100 : 0;
    const K = K_ADIABATICO[`${mat}-${ais}`] || 94, t = num(c.tDespeje, 0.5);
    const ikAdm = (K * S) / Math.sqrt(t) / 1000, ik = num(c.icc, ikDef);
    const nombre = c.circuito || "Circuito";
    verificaciones.push({ criterio: `${nombre}: capacidad de corriente`, norma: "NTC 2050 Sec. 310 (> 2 kV) / IEC 60502-2 — datos del fabricante con factores de corrección", valor: `${fmt(I, 0)} A`, limite: `≤ ${fmt(amp, 0)} A`, cumple: I <= amp });
    if (ik > 0) verificaciones.push({ criterio: `${nombre}: soportabilidad al cortocircuito`, norma: `IEC 60949 (adiabático, K = ${K})`, valor: `${fmt(ik, 2)} kA`, limite: `≤ ${fmt(ikAdm, 2)} kA en ${fmt(t, 2)} s`, cumple: ik <= ikAdm });
    if (num(c.inCelda, 0)) verificaciones.push({ criterio: `${nombre}: celda o protección`, norma: "IEC 62271-200 — In de la celda ≥ corriente del circuito", valor: `${fmt(num(c.inCelda), 0)} A`, limite: `≥ ${fmt(I, 0)} A`, cumple: num(c.inCelda) >= I });
    if (L > 0) verificaciones.push({ criterio: `${nombre}: caída de tensión`, norma: "RETIE — regulación (criterio del operador de red)", valor: `${fmt(dv, 2)} %`, limite: `≤ ${fmt(dvMax, 1)} %`, cumple: dv <= dvMax });
    return [nombre, `${mat} ${N.etiquetaCalibre(String(c.calibre))} ${ais}`, fmt(S, 1), fmt(amp, 0), fmt(I, 0), ik ? fmt(ik, 2) : "—", fmt(ikAdm, 2), L ? fmt(dv, 2) : "—"];
  });
  return {
    resumen: [{ etiqueta: "Circuitos verificados", valor: String(tabla.length), unidad: "" }, { etiqueta: "Ik\" en la barra", valor: ikDef ? fmt(ikDef, 2) : "—", unidad: "kA" }],
    tablas: [{ titulo: "Verificación de cables de media tensión", encabezados: ["Circuito", "Cable", "S (mm²)", "Ampacidad corregida (A)", "I diseño (A)", "Ik (kA)", "Ik admisible (kA)", "ΔV (%)"], filas: tabla }],
    pasos: [
      { titulo: "Capacidad de corriente", formula: "I adm = I tabla × factores de corrección (temperatura, agrupamiento, resistividad térmica)", sustitucion: "Valor base de la tabla del fabricante o NTC 2050 Tablas 310-77 a 310-86", resultado: "Por circuito" },
      { titulo: "Cortocircuito en el conductor", formula: "I adm = K × S / √t (IEC 60949, 90 → 250 °C)", sustitucion: "K = 143 (Cu XLPE), 94 (Al XLPE)", resultado: "Por circuito" },
      { titulo: "Caída de tensión", formula: "ΔV % = √3 × I × L × (R cos φ + X sen φ) / U × 100", sustitucion: `U = ${fmt(U, 1)} kV; R a 90 °C (calculada si no se digita)`, resultado: "Por circuito" }
    ],
    verificaciones,
    notas: ["La pantalla metálica del cable debe verificarse para la corriente de falla a tierra con los datos del fabricante."],
    conclusion: veredicto(verificaciones, "Los cables de media tensión cumplen capacidad de corriente, cortocircuito y regulación.", "Hay cables de media tensión que no cumplen.")
  };
}

// ================================================================ 15. APANTALLAMIENTO (esfera rodante / modelo electrogeométrico)
export function apantallamiento(e) {
  let R, origen;
  if (e.metodo === "ieee998") {
    const bil = num(e.bil, 550), zs = num(e.zs, 350), kc = e.captador === "cable" ? 1 : 1.2;
    const ic = (2.2 * bil) / zs;
    R = 8 * kc * Math.pow(ic, 0.65);
    origen = `IEEE 998: Ic = 2,2 × BIL / Zs = 2,2 × ${fmt(bil, 0)} / ${fmt(zs, 0)} = ${fmt(ic, 2)} kA; S = 8 × ${kc} × Ic^0,65 = ${fmt(R, 1)} m`;
  } else {
    const nivel = N.NIVELES_SIPRA[e.nivel] || N.NIVELES_SIPRA.I;
    R = nivel.esfera;
    origen = `NTC 4552-3 / IEC 62305-3: nivel ${e.nivel || "I"} → radio ${R} m`;
  }
  const radio = (hm, h) => {
    if (h >= hm) return 0;
    const xc = hm >= R ? R : Math.sqrt(hm * (2 * R - hm));
    const xh = h >= R ? R : Math.sqrt(h * (2 * R - h));
    return Math.max(0, xc - xh);
  };
  const verificaciones = [];
  const tabla = filas(e.elementos).map((p) => {
    const hm = num(p.hCaptador), h = num(p.hElemento), d = num(p.distancia, NaN);
    const r = radio(hm, h), ok = d <= r;
    // Sin distancia: el radio queda como requisito para ubicar el captador.
    if (!Number.isFinite(d)) return [p.elemento || "", p.captador || "", fmt(hm, 1), fmt(h, 1), fmt(r, 2), "Por definir", `Captador a ≤ ${fmt(r, 2)} m`];
    verificaciones.push({ criterio: `${p.elemento || "Elemento"} protegido por ${p.captador || "captador"}`, norma: "Método de la esfera rodante (NTC 4552-3 / IEEE 998)", valor: `${fmt(d, 2)} m`, limite: `≤ ${fmt(r, 2)} m`, cumple: ok });
    return [p.elemento || "", p.captador || "", fmt(hm, 1), fmt(h, 1), fmt(r, 2), fmt(d, 2), ok ? "Protegido" : "No protegido"];
  });
  return {
    resumen: [{ etiqueta: "Radio de la esfera rodante", valor: fmt(R, 1), unidad: "m" }, { etiqueta: "Elementos protegidos", valor: verificaciones.length ? `${verificaciones.filter((v) => v.cumple).length} de ${verificaciones.length}` : "Por definir", unidad: "" }],
    tablas: [{ titulo: "Zona de protección por elemento", encabezados: ["Elemento", "Captador", "Altura captador (m)", "Altura elemento (m)", "Radio protegido (m)", "Distancia (m)", "Resultado"], filas: tabla }],
    pasos: [
      { titulo: "Radio de la esfera rodante", formula: e.metodo === "ieee998" ? "S = 8 k Ic^0,65; Ic = 2,2 BIL / Zs" : "Radio según el nivel de protección", sustitucion: origen, resultado: `R = ${fmt(R, 1)} m` },
      { titulo: "Radio protegido a la altura del elemento", formula: "r = √(hm (2R − hm)) − √(h (2R − h)) (hm ≤ R)", sustitucion: "Para hm > R se toma √(hm(2R − hm)) = R", resultado: "Por elemento" }
    ],
    verificaciones,
    notas: ["Cálculo en el plano del captador y el elemento (un mástil o un cable de guarda). Entre dos captadores la zona protegida es mayor; este cálculo queda del lado de la seguridad."],
    conclusion: verificaciones.length ? veredicto(verificaciones, "Todos los elementos quedan dentro de la zona protegida.", "Hay elementos fuera de la zona protegida: agregue o eleve captadores.") : `Con una esfera de ${fmt(R, 1)} m, cada captador debe quedar a la distancia horizontal indicada del elemento que protege.`
  };
}

export const CALCULOS = { cargas, conductores, regulacion, canalizaciones, transformador, cortocircuito, coordinacion, malla, rayos, aislamiento, distancias, mecanico, trafoPotencia, cableMT, apantallamiento };
