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
      { titulo: "Corriente del alimentador con motores", formula: "I alim = I fase máx + 0,25 × I motor mayor (NTC 2050 430.24)", sustitucion: `${fmt(iMax, 1)} + 0,25 × ${fmt(iMotorMayor, 1)}`, resultado: `${fmt(iAlim, 1)} A` }
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
    // 240.4(B): se permite la protección normalizada inmediatamente superior
    // si la capacidad no coincide con un valor normalizado (≤ 800 A).
    const inPermitido = limite ? limite : (In <= 800 ? sigNormal(N.PROTECCIONES_NORMALIZADAS, ampFinal) : ampFinal);
    if (In == null || In > inPermitido) continue;
    return { calibre: cal, ft, fa, iDis, ampAisl, ampTerm, ampFinal: limite ? Math.min(limite, ampFinal) : ampFinal, In, protMax };
  }
  return { calibre: null, ft, fa, iDis };
}

export function conductores(e, proyecto = {}) {
  const tAmbDef = num(proyecto.tempAmbiente, 30);
  const verificaciones = [], circ = [];
  const tabla = filas(e.circuitos).map((c) => {
    const I = num(c.corriente), mat = c.material === "Al" ? "Al" : "Cu";
    const sel = seleccionarConductor({ corriente: I, continua: c.continua !== "No", material: mat, tAisl: num(c.tAisl, 90), tTerm: num(c.tTerm, 75), portadores: num(c.portadores, 3), tAmb: num(c.tAmb, tAmbDef) });
    const icc = num(c.icc, 0), icu = num(c.icu, 0);
    if (!sel.calibre) {
      verificaciones.push({ criterio: `Circuito ${c.circuito}: conductor disponible`, norma: "NTC 2050 Tabla 310.15(B)(16)", valor: `${fmt(I, 1)} A`, limite: "≤ 1000 kcmil", cumple: false });
      return [c.circuito || "", c.descripcion || "", fmt(I, 1), mat, "—", "—", "—", "—", "—", "—", "—", "—"];
    }
    verificaciones.push({ criterio: `Circuito ${c.circuito}: protección ≤ capacidad del conductor`, norma: "NTC 2050 240.4; RETIE 2024 art. 3.27.3 c", valor: `${sel.In} A`, limite: `${fmt(sel.ampFinal, 1)} A (o normalizado inmediato)`, cumple: true });
    if (icc > 0 && icu > 0) verificaciones.push({ criterio: `Circuito ${c.circuito}: capacidad de interrupción`, norma: "NTC 2050 110.9; RETIE 2024 art. 3.17.19", valor: `${fmt(icu, 1)} kA`, limite: `≥ ${fmt(icc, 1)} kA`, cumple: icu >= icc });
    // Conductor y protección que trae el diseño (opcionales): se comparan con la carga y con la ampacidad corregida.
    const [matDis, calDis] = String(c.dis || "").split(":");
    const hayDis = !!(calDis && N.AMPACIDAD[matDis]?.[calDis]);
    let capacidadAdoptada = sel.ampFinal, protAdoptada = sel.In;
    if (hayDis) {
      const amp = N.AMPACIDAD[matDis][calDis], tA = num(c.tAisl, 90), tT = num(c.tTerm, 75);
      const ampAisl = amp[N.COLUMNA_TEMP[tA]] * (factorTemp(num(c.tAmb, tAmbDef), N.COLUMNA_TEMP[tA]) ?? 0) * factorAgrup(num(c.portadores, 3)), ampTerm = amp[N.COLUMNA_TEMP[tT]];
      const capacidad = Math.min(ampAisl, ampTerm), iDis = I * (c.continua !== "No" ? 1.25 : 1);
      capacidadAdoptada = capacidad;
      if (num(c.protDis, 0) > 0) protAdoptada = num(c.protDis, 0);
      const nombreCal = `${matDis} ${N.etiquetaCalibre(calDis)}`;
      verificaciones.push({ criterio: `Circuito ${c.circuito}: conductor del diseño (${nombreCal}) soporta la carga`, norma: "NTC 2050 210.19(A)(1) y 310.15(B)(16)", valor: `${fmt(capacidad, 1)} A`, limite: `≥ ${fmt(iDis, 1)} A`, cumple: ampTerm >= iDis && ampAisl >= I });
      const prot = num(c.protDis, 0);
      if (prot > 0) {
        const limitePequeno = N.LIMITE_PEQUENOS[matDis]?.[calDis]; // 240.4(D): 14, 12 y 10 AWG Cu = 15, 20 y 30 A
        const permitido = limitePequeno ? Math.min(limitePequeno, capacidad) : capacidad <= 800 ? sigNormal(N.PROTECCIONES_NORMALIZADAS, capacidad) : capacidad; // 240.4(B): el valor normalizado inmediato superior, hasta 800 A
        verificaciones.push({ criterio: `Circuito ${c.circuito}: protección del diseño (${prot} A) sobre el conductor ${nombreCal}`, norma: "NTC 2050 240.4; RETIE 2024 art. 3.27.3 c", valor: `${prot} A`, limite: `≤ ${fmt(permitido, 0)} A (ampacidad ${fmt(capacidad, 1)} A)`, cumple: prot <= permitido + 1e-9 });
      }
    }
    // Con conductor del diseño, ese es el adoptado (tabla, unifilar y Excel); el mínimo calculado se muestra aparte para comparar.
    const matAdop = hayDis ? matDis : mat, calAdop = hayDis ? calDis : sel.calibre;
    const aislamiento = ({ 60: "60 °C (TW)", 75: "75 °C (THWN)", 90: "90 °C (THHN/THWN-2)" })[num(c.tAisl, 90)] || `${num(c.tAisl, 90)} °C`;
    circ.push({ circuito: c.circuito || "", descripcion: c.descripcion || "", I, material: matAdop, calibre: calAdop, In: protAdoptada, calibreMinimo: sel.calibre, aislamiento, icu });
    return [c.circuito || "", c.descripcion || "", fmt(I, 1), matAdop, N.etiquetaCalibre(calAdop), `${mat} ${N.etiquetaCalibre(sel.calibre)}`, aislamiento, fmt(sel.ft, 2), fmt(sel.fa, 2), fmt(capacidadAdoptada, 1), `${protAdoptada} A`, icu ? `${fmt(icu, 1)} kA` : "—"];
  });
  return {
    resumen: [{ etiqueta: "Circuitos dimensionados", valor: String(tabla.length), unidad: "" }],
    salidas: { circuitos: circ },
    tablas: [{ titulo: "Selección de conductores y protecciones", encabezados: ["Circ.", "Descripción", "I carga (A)", "Mat.", "Conductor adoptado", "Mínimo requerido", "Aislamiento", "Ft", "Fa", "Capacidad corregida (A)", "Protección", "Icu"], filas: tabla }],
    pasos: [
      { titulo: "Corriente de diseño", formula: "I diseño = 1,25 × I carga continua + I no continua", sustitucion: "NTC 2050 210.19(A) y 215.2", resultado: "Por circuito" },
      { titulo: "Capacidad corregida del conductor", formula: "I corregida = I tabla (T aislamiento) × Ft × Fa ≥ I carga", sustitucion: "Ft: Tabla 310.15(B)(16) (temperatura ambiente); Fa: 310.15(B)(3)(a) (más de 3 portadores)", resultado: "Por circuito" },
      { titulo: "Temperatura de los terminales", formula: "I tabla (T terminales) ≥ I diseño", sustitucion: "NTC 2050 110.14(C)", resultado: "Por circuito" },
      { titulo: "Protección", formula: "I diseño ≤ In ≤ I corregida (o el normalizado inmediato superior, 240.4(B))", sustitucion: "Valores normalizados NTC 2050 240.6(A)", resultado: "Por circuito" }
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

// Resistencia a la temperatura de operación T: R(T) = R75 × (k + T) / (k + 75), con k = 234,5 (Cu) o 228,1 (Al).
export function factorResistenciaTemp(conductor, temperatura) {
  const T = num(temperatura, 75), tipo = String(conductor || "Cu").split(":")[0];
  if (tipo === "aereo") return 1;
  const k = tipo === "Al" ? 228.1 : 234.5;
  return (k + T) / (k + 75);
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
    const z0 = impedanciaConductor(t.conductor, t.canalizacion, num(t.dmg, 1000));
    const z = { ...z0, R: z0.R * factorResistenciaTemp(t.conductor, e.temperatura) };
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
    verificaciones.push({ criterio: `Tramo ${c.t.tramo || c.t.hasta}: regulación parcial`, norma: "RETIE 2024 Libro 3, Título 26 f (acometida ≤ 3 %); NTC 2050 210.19(A)(1) Nota informativa 4", valor: `${fmt(c.dVp, 2)} %`, limite: `≤ ${fmt(limP, 1)} %`, cumple: c.dVp <= limP });
    verificaciones.push({ criterio: `Hasta ${c.t.hasta || c.t.tramo}: regulación acumulada`, norma: "RETIE 2024 Libro 3, Título 26 f (alimentadores y circuitos ramales ≤ 5 %); NTC 2050 215.2(A)(1) Nota informativa 2", valor: `${fmt(ac, 2)} %`, limite: `≤ ${fmt(limT, 1)} %`, cumple: ac <= limT });
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
    notas: ["RETIE 2024 (Libro 3, Título 26, literal f): la regulación en la acometida no puede superar el 3 %, calculada en el dispositivo de corte, y la caída de tensión en alimentadores y circuitos ramales a la carga plena de diseño no puede superar el 5 %. Si la acometida es un tramo de la tabla, el acumulado del 5 % se cuenta desde el dispositivo de corte (sin la acometida)."],
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
    { criterio: "Protección del secundario", norma: "NTC 2050 450.3(B)", valor: `${interruptor} A`, limite: `≤ ${fmt(1.25 * is, 0)} A (125 % In) o normalizado inmediato`, cumple: interruptor <= sigNormal(N.PROTECCIONES_NORMALIZADAS, 1.25 * is) }
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
  const z0pct = num(e.z0Trafo, NaN);
  const zt0 = Number.isFinite(z0pct) && z0pct > 0 ? esc(zt, z0pct / uk) : zt; // Z0 del fabricante con la misma relación R/X
  let z1 = suma(zq, zt), z0 = x0zz > 0 ? cplx(0, x0zz) : zt0;
  // Aportes por barra: grupos de motores (impedancia en paralelo, IEC 60909-0 §3.8) y
  // generación con inversores (fuente de corriente k × In, IEC 60909-0 §3.9).
  const clave = (t) => String(t || "").trim().toLowerCase();
  const motores = filas(e.motores).map((m) => {
    const P = num(m.potencia, 0) * 1000, mt = m.tipo === "MT", rel = num(m.ilr, mt ? 6 : 5), fe = num(m.fpEta, 0.8);
    const Sr = P / fe, ZM = (1 / rel) * (Un * Un) / Sr, rx = mt ? 0.15 : 0.42, XM = ZM / Math.sqrt(1 + rx * rx);
    return { barra: clave(m.barra), nombre: m.barra || "", P, Sr, ZM, z: cplx(rx * XM, XM), Ir: Sr / (Math.sqrt(3) * Un) };
  }).filter((m) => m.P > 0);
  const gens = filas(e.generacion).map((g) => ({ barra: clave(g.barra), nombre: g.barra || "", S: num(g.potencia, 0) * 1000, k: num(g.factor, 1.2) })).filter((g) => g.S > 0).map((g) => ({ ...g, I: (g.k * g.S) / (Math.sqrt(3) * Un) }));
  const iGen = gens.reduce((s, g) => s + g.I, 0);
  const par = (a, b) => { const den = suma(a, b), num2 = cplx(a.r * b.r - a.x * b.x, a.r * b.x + a.x * b.r); const m2 = den.r * den.r + den.x * den.x; return cplx((num2.r * den.r + num2.x * den.x) / m2, (num2.x * den.r - num2.r * den.x) / m2); };
  // Equivalente de Thévenin de secuencia positiva visto desde cada barra (radial).
  // Barras en cadena radial: impedancia serie desde la barra anterior (la primera, la de la
  // red más el transformador) y Z0 acumulada.
  const nodos = [{ nombre: e.nombreBornes || (Un > 1000 ? "Barra del secundario" : "Bornes BT del transformador"), icu: e.icuBornes, zs: z1, z1red: z1, z0: { ...z0 } }];
  filas(e.cables).forEach((cb) => {
    const zc = impedanciaConductor(cb.conductor, cb.canalizacion);
    const L = num(cb.longitud) / 1000, n = Math.max(1, num(cb.paralelos, 1));
    const z = cplx((zc.R * L) / n, (zc.X * L) / n);
    const r0 = num(cb.r0, NaN), x0 = num(cb.x0, NaN);
    const zc0 = Number.isFinite(r0) && Number.isFinite(x0) ? cplx((r0 * L) / n, (x0 * L) / n) : esc(z, 4); // Z0 del fabricante o ≈ 4 Z1
    z1 = suma(z1, z); z0 = suma(z0, zc0);
    nodos.push({ nombre: cb.barra || "Barra", icu: cb.icu, zs: z, z1red: { ...z1 }, z0: { ...z0 }, cable: { conductor: cb.conductor, longitud: num(cb.longitud), paralelos: n } });
  });
  // Motores de cada barra en paralelo (null = sin motores).
  const zMot = nodos.map((nd) => motores.filter((m) => m.barra === clave(nd.nombre)).reduce((z, m) => (z ? par(z, m.z) : m.z), null));
  const pp = (x, y) => (x && y ? par(x, y) : x || y);
  // Thévenin hacia la fuente (izquierda) y hacia los motores de aguas abajo (derecha).
  const izq = [], der = new Array(nodos.length).fill(null);
  nodos.forEach((nd, k) => { izq[k] = k === 0 ? nd.zs : suma(nd.zs, pp(izq[k - 1], zMot[k - 1])); });
  for (let k = nodos.length - 2; k >= 0; k--) { const aguas = pp(zMot[k + 1], der[k + 1]); der[k] = aguas ? suma(nodos[k + 1].zs, aguas) : null; }
  nodos.forEach((nd, k) => {
    const zth = pp(pp(izq[k], zMot[k]), der[k]);
    const ik3red = (c * Un) / (Math.sqrt(3) * mod(nd.z1red));
    const ik3m = (c * Un) / (Math.sqrt(3) * mod(zth)); // red + motores
    const ik3 = ik3m + iGen; // los inversores se suman en forma aritmética (conservador)
    const kappa = 1.02 + 0.98 * Math.exp(-3 * (zth.r / Math.max(zth.x, 1e-9)));
    const ik1 = (Math.sqrt(3) * c * Un) / mod(suma(esc(zth, 2), nd.z0)) + iGen;
    barras.push({ nombre: nd.nombre, cable: nd.cable || null, z1: { ...zth }, ik3, ik3red, aporte: ik3 - ik3red, ip: kappa * Math.SQRT2 * ik3m + Math.SQRT2 * iGen, ik1, kappa, icu: num(nd.icu, 0) });
  });
  const ikMT = skq / (Math.sqrt(3) * UnMT);
  const verificaciones = barras.filter((b) => b.icu > 0).map((b) => ({ criterio: `${b.nombre}: capacidad de interrupción`, norma: "NTC 2050 110.9; RETIE 2024 art. 3.17.19; IEC 60947-2", valor: `${fmt(b.icu, 1)} kA`, limite: `≥ ${fmt(b.ik3 / 1000, 2)} kA`, cumple: b.icu * 1000 >= b.ik3 }));
  return {
    resumen: [
      { etiqueta: "Ik\" trifásica en la red (primario)", valor: fmt(ikMT / 1000, 2), unidad: "kA" },
      { etiqueta: "Ik\" trifásica en el secundario", valor: fmt(barras[0].ik3 / 1000, 2), unidad: "kA" },
      { etiqueta: "Ik\" monofásica en el secundario", valor: fmt(barras[0].ik1 / 1000, 2), unidad: "kA" }
    ],
    salidas: { barras: barras.map((b) => ({ nombre: b.nombre, ik3: b.ik3, ik1: b.ik1, icu: b.icu, cable: b.cable })), uMT: UnMT / 1000, uBT: Un, sk: skq / 1e6, motores: motores.map((m) => ({ barra: m.nombre, kw: m.P / 1000 })), generacion: gens.map((g) => ({ barra: g.nombre, kva: g.S / 1000 })) },
    tablas: [
      { titulo: "Impedancias referidas al secundario", encabezados: ["Elemento", "R (mΩ)", "X (mΩ)", "Z (mΩ)"], filas: [
        ["Red equivalente", fmt(zq.r * 1000, 3), fmt(zq.x * 1000, 3), fmt(mod(zq) * 1000, 3)],
        [`Transformador (KT = ${fmt(KT, 3)})`, fmt(zt.r * 1000, 3), fmt(zt.x * 1000, 3), fmt(mod(zt) * 1000, 3)]
      ] },
      { titulo: "Corrientes de cortocircuito por barra", encabezados: ["Barra", "R (mΩ)", "X (mΩ)", "Ik\" 3F (kA)", "Aporte motores y generación (kA)", "κ", "ip (kA)", "Ik\" 1F (kA)", "Icu (kA)"], filas: barras.map((b) => [b.nombre, fmt(b.z1.r * 1000, 3), fmt(b.z1.x * 1000, 3), fmt(b.ik3 / 1000, 2), b.aporte > 0.5 ? fmt(b.aporte / 1000, 2) : "—", fmt(b.kappa, 2), fmt(b.ip / 1000, 2), fmt(b.ik1 / 1000, 2), b.icu ? fmt(b.icu, 1) : "—"]) },
      ...(motores.length || gens.length ? [{ titulo: "Aportes al cortocircuito (IEC 60909-0)", encabezados: ["Fuente", "Barra", "Potencia", "Impedancia o corriente"], filas: [...motores.map((m) => ["Grupo de motores", m.nombre, `${fmt(m.P / 1000, 1)} kW (SrM = ${fmt(m.Sr / 1000, 1)} kVA)`, `ZM = ${fmt(m.ZM * 1000, 2)} mΩ (IrM = ${fmt(m.Ir, 0)} A)`]), ...gens.map((g) => ["Generación con inversores", g.nombre, `${fmt(g.S / 1000, 1)} kVA`, `${fmt(g.k, 2)} × In = ${fmt(g.I, 0)} A`])] }] : [])
    ],
    pasos: [
      { titulo: "Red equivalente referida al secundario", formula: "ZQ = c × Un² / S\"kQ; XQ = ZQ / √(1 + (R/X)²)", sustitucion: `1,1 × ${fmt(Un, 0)}² / ${fmt(skq / 1e6, 1)} MVA`, resultado: `ZQ = ${fmt(ZQ * 1000, 3)} mΩ` },
      { titulo: "Transformador", formula: "ZT = ukr × Un² / SrT; RT = PkrT × Un² / SrT²; KT = 0,95 × cmax / (1 + 0,6 xT)", sustitucion: `ukr = ${fmt(uk, 1)} %; PkrT = ${fmt(pk / 1000, 2)} kW; SrT = ${fmt(sn / 1000, 1)} kVA`, resultado: `ZT = ${fmt(ZT * 1000, 3)} mΩ; KT = ${fmt(KT, 3)}` },
      { titulo: "Corriente trifásica", formula: "Ik\" = c × Un / (√3 × |Z1|)", sustitucion: `c = ${fmt(c, 2)} (IEC 60909-0 Tabla 1)`, resultado: "Por barra" },
      ...(motores.length || gens.length ? [{ titulo: "Aporte de motores y generación", formula: "ZM = (IrM / ILR) × Un² / SrM con RM/XM = 0,42 (grupos de BT) o 0,15 (MT), en paralelo con la red en su barra; inversores: fuente de corriente k × In sumada a Ik\" e ip", sustitucion: `${motores.length} grupo(s) de motores; ${gens.length} generador(es) con inversores (${fmt(iGen, 0)} A)`, resultado: "Por barra" }] : []),
      { titulo: "Corriente monofásica a tierra", formula: "Ik1\" = √3 × c × Un / |2 Z1 + Z0|", sustitucion: `${x0zz > 0 ? `Z0 = X0 del transformador zig-zag = ${fmt(x0zz, 2)} Ω (secundario en delta)` : Number.isFinite(z0pct) && z0pct > 0 ? `Z0 del transformador = ${fmt(z0pct, 2)} % (fabricante)` : "Z0 del transformador Dyn o YNyn con terciario en delta ≈ Z1"}; Z0 de cables: R0 y X0 del fabricante o ≈ 4 Z1 (IEC 60909-2)`, resultado: "Por barra" },
      { titulo: "Corriente pico", formula: "ip = κ × √2 × Ik\"; κ = 1,02 + 0,98 e^(−3R/X)", sustitucion: "IEC 60909-0 ec. 55", resultado: "Por barra" }
    ],
    verificaciones,
    conclusion: verificaciones.length ? veredicto(verificaciones, "Los interruptores tienen capacidad de interrupción suficiente.", "Hay interruptores con capacidad de interrupción insuficiente.") : `La corriente de cortocircuito trifásica en el secundario es ${fmt(barras[0].ik3 / 1000, 2)} kA; con ella se especifica la capacidad de interrupción de los equipos.`
  };
}

// ================================================================ 7. COORDINACIÓN DE PROTECCIONES (IEC 60255)
export function tiempoRele(p, I) {
  if (p.curva === "PUNTOS") {
    // Curva digitada: interpolación log-log; por debajo del primer punto no opera.
    const pts = N.puntosCurva(p.puntos);
    if (pts.length < 2 || !(I >= pts[0][0])) return Infinity;
    if (I >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    const k = pts.findIndex(([i]) => i > I);
    const [[i1, t1], [i2, t2]] = [pts[k - 1], pts[k]];
    return Math.pow(10, Math.log10(t1) + ((Math.log10(I) - Math.log10(i1)) * (Math.log10(t2) - Math.log10(t1))) / (Math.log10(i2) - Math.log10(i1)));
  }
  const is = num(p.pickup), tms = num(p.tms, 0.1), curva = N.CURVAS_IEC[p.curva] || N.CURVAS_IEC.SI;
  if (!(I > is * 1.0001) || is <= 0) return Infinity;
  let t = p.curva === "DT" ? tms : tms * (curva.k / (Math.pow(I / is, curva.a) - 1) + curva.b);
  const iinst = num(p.inst, 0);
  if (iinst > 0 && I >= iinst) t = Math.min(t, num(p.tinst, 0.05));
  return t;
}
// Pares de protecciones sucesivas del mismo tipo (fase con fase, tierra con tierra), en el
// orden de la tabla (de aguas abajo hacia aguas arriba).
export const esTierra = (r) => String(r.tipo || "").startsWith("Tierra");
export function paresCoordinacion(rels) {
  const pares = [];
  for (const tierra of [false, true]) {
    const idx = rels.map((r, i) => (esTierra(r) === tierra ? i : -1)).filter((i) => i >= 0);
    for (let k = 0; k + 1 < idx.length; k++) pares.push({ a: idx[k], b: idx[k + 1], tierra });
  }
  return pares;
}
export function coordinacion(e) {
  const rels = filas(e.protecciones);
  // «desde»: protección más cercana a la falla; solo se verifican los pares desde ella hacia aguas arriba.
  const pos = (nombre) => rels.findIndex((r) => String(r.nombre || "").trim().toLowerCase() === String(nombre || "").trim().toLowerCase());
  const fallas = filas(e.fallas).map((f) => ({ punto: f.punto || "", I: num(f.corriente), tierra: String(f.tipo || "").startsWith("A tierra"), desde: Math.max(0, pos(f.desde)) }));
  const cti = num(e.cti, 0.3);
  const verificaciones = [];
  // Una protección de tierra solo ve fallas a tierra; las de fase ven todas.
  const ve = (r, f) => !esTierra(r) || f.tierra;
  const tabla = fallas.map((f) => [f.punto, f.tierra ? "A tierra" : "Trifásica", fmt(f.I, 0), ...rels.map((r) => { if (!ve(r, f)) return "—"; const t = tiempoRele(r, f.I); return Number.isFinite(t) ? fmt(t, 3) : "No opera"; })]);
  const pares = paresCoordinacion(rels);
  fallas.forEach((f) => {
    pares.forEach(({ a, b, tierra }) => {
      if ((tierra && !f.tierra) || a < f.desde) return;
      const t1 = tiempoRele(rels[a], f.I), t2 = tiempoRele(rels[b], f.I);
      if (Number.isFinite(t1) && Number.isFinite(t2)) verificaciones.push({ criterio: `${f.punto}: ${rels[b].nombre} respalda a ${rels[a].nombre}${tierra ? " (tierra)" : ""}`, norma: "IEEE 242 / IEC 60255 — margen de coordinación", valor: `${fmt(t2 - t1, 3)} s`, limite: `≥ ${fmt(cti, 2)} s`, cumple: t2 - t1 >= cti - 1e-9 });
    });
  });
  const inrush = num(e.iInrush, 0);
  if (inrush > 0 && rels.length) {
    const r = rels.filter((x) => !esTierra(x)).at(-1) || rels[rels.length - 1], t = tiempoRele(r, inrush);
    verificaciones.push({ criterio: `${r.nombre}: no dispara con la corriente de energización`, norma: "IEEE C37.91 (punto de inrush a 0,1 s)", valor: Number.isFinite(t) ? `${fmt(t, 3)} s` : "No opera", limite: "> 0,10 s", cumple: !Number.isFinite(t) || t > 0.1 });
  }
  return {
    resumen: [{ etiqueta: "Pares coordinados", valor: `${verificaciones.filter((v) => v.cumple).length} de ${verificaciones.length}`, unidad: "" }],
    salidas: { reles: rels.map((r) => ({ ...r })), tensionRef: num(e.tensionRef, NaN) },
    tablas: [
      { titulo: "Ajustes de las protecciones", encabezados: ["Protección", "Tipo", "Curva", "I arranque (A)", "TMS / TD / t (s)", "I instantánea (A)", "t inst. (s)"], filas: rels.map((r) => [r.nombre || "", esTierra(r) ? "Tierra (51N)" : "Fase", r.curva === "PUNTOS" ? `Por puntos: ${N.puntosCurva(r.puntos).map(([i, t]) => `${fmt(i, 0)} A–${fmt(t, t >= 10 ? 0 : t >= 1 ? 1 : 3)} s`).join("; ")}` : (N.CURVAS_IEC[r.curva] || N.CURVAS_IEC.SI).nombre, r.curva === "PUNTOS" ? "—" : fmt(num(r.pickup), 0), r.curva === "PUNTOS" ? "—" : fmt(num(r.tms), 3), num(r.inst) ? fmt(num(r.inst), 0) : "—", num(r.inst) ? fmt(num(r.tinst, 0.05), 2) : "—"]) },
      { titulo: "Tiempos de operación (s) por corriente de falla", encabezados: ["Punto de falla", "Falla", "I (A)", ...rels.map((r) => r.nombre || "")], filas: tabla }
    ],
    pasos: [
      { titulo: "Curvas de tiempo inverso", formula: "t = TMS × (k / ((I / Is)^α − 1) + B); curva por puntos: interpolación log-log entre los puntos del fabricante", sustitucion: "IEC 60255-151 (B = 0): SI k = 0,14 α = 0,02; VI k = 13,5 α = 1; EI k = 80 α = 2; LTI k = 120 α = 1. IEEE C37.112: MI k = 0,0515 α = 0,02 B = 0,114; VI k = 19,61 α = 2 B = 0,491; EI k = 28,2 α = 2 B = 0,1217", resultado: "Por protección y corriente" },
      { titulo: "Margen de coordinación", formula: "t aguas arriba − t aguas abajo ≥ CTI", sustitucion: `CTI = ${fmt(cti, 2)} s; pares sucesivos del mismo tipo (fase con fase en todas las fallas; tierra con tierra en las fallas a tierra)`, resultado: "Por par de protecciones y punto de falla" }
    ],
    verificaciones,
    grafico: { tipo: "tcc", reles: rels, fallas, inrush },
    conclusion: veredicto(verificaciones, "Las protecciones quedan coordinadas con el margen exigido.", "Hay pares de protecciones sin margen suficiente: ajuste TMS o arranques.")
  };
}

// ================================================================ 8. MALLA DE PUESTA A TIERRA (IEEE 80-2013)
// Resistividad aparente Wenner en un suelo de dos capas (Sunde; IEEE 81-2012):
// ρa = ρ1 [1 + 4 Σ Kⁿ (1/√(1 + (2nh/a)²) − 1/√(4 + (2nh/a)²))], K = (ρ2 − ρ1)/(ρ2 + ρ1).
export function rhoWenner2capas(a, r1, r2, h) {
  const K = (r2 - r1) / (r2 + r1);
  let suma = 0;
  for (let n = 1, kn = K; n <= 2000 && Math.abs(kn) > 1e-9; n++, kn *= K) {
    const x = (2 * n * h) / a;
    suma += kn * (1 / Math.sqrt(1 + x * x) - 1 / Math.sqrt(4 + x * x));
  }
  return r1 * (1 + 4 * suma);
}
// Ajuste de ρ1, ρ2 y h a las mediciones por mínimos cuadrados del error
// relativo (Nelder-Mead sobre el logaritmo de los parámetros, varios arranques).
export function ajusteDosCapas(med) {
  const err = ([l1, l2, lh]) => med.reduce((s, m) => s + ((rhoWenner2capas(m.a, Math.exp(l1), Math.exp(l2), Math.exp(lh)) - m.rho) / m.rho) ** 2, 0);
  const nm = (x0) => {
    let S = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + 0.4 : v)))].map((x) => ({ x, f: err(x) }));
    for (let it = 0; it < 600; it++) {
      S.sort((p, q) => p.f - q.f);
      if (Math.abs(S[3].f - S[0].f) < 1e-14) break;
      const c = [0, 1, 2].map((j) => (S[0].x[j] + S[1].x[j] + S[2].x[j]) / 3);
      const pt = (t) => { const x = c.map((v, j) => v + t * (S[3].x[j] - v)); return { x, f: err(x) }; };
      const r = pt(-1);
      if (r.f < S[0].f) { const e2 = pt(-2); S[3] = e2.f < r.f ? e2 : r; }
      else if (r.f < S[2].f) S[3] = r;
      else { const k = pt(r.f < S[3].f ? -0.5 : 0.5); if (k.f < Math.min(r.f, S[3].f)) S[3] = k; else S = S.map((p, i) => (i ? { x: p.x.map((v, j) => S[0].x[j] + 0.5 * (v - S[0].x[j])), f: 0 } : p)).map((p) => ({ x: p.x, f: err(p.x) })); }
    }
    S.sort((p, q) => p.f - q.f);
    return S[0];
  };
  const r1 = med[0].rho, r2 = med[med.length - 1].rho;
  const mejor = [0.5, 1, 2, 4, 8, 16].map((h) => nm([Math.log(r1), Math.log(r2), Math.log(h)])).sort((p, q) => p.f - q.f)[0];
  const [p1, p2, ph] = mejor.x.map(Math.exp);
  return { r1: p1, r2: p2, h: ph, rms: Math.sqrt(mejor.f / med.length) * 100 };
}
// Impedancia equivalente de un cable de guarda o neutro con sus puestas a tierra
// (Endrenyi; IEEE 80-2000 §15.9 y ec. C.7): Zeq = Zs/2 + √(Zs × Rtg), complejos [re, im].
const cMul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const cDiv = ([a, b], [c, d]) => { const m = c * c + d * d; return [(a * c + b * d) / m, (b * c - a * d) / m]; };
const cSqrt = ([a, b]) => { const m = Math.hypot(a, b), r = Math.sqrt((m + a) / 2), i = Math.sign(b || 1) * Math.sqrt(Math.max(0, (m - a) / 2)); return [r, i]; };
const cAbs = ([a, b]) => Math.hypot(a, b);
export function zEndrenyi(zs, rt) { const q = cSqrt(cMul(zs, [rt, 0])); return [zs[0] / 2 + q[0], zs[1] / 2 + q[1]]; }
export function factorDivision({ nL, zsL, rtg, nF, zsF, rdg, rg }) {
  const adm = [];
  if (nL > 0) adm.push(cDiv([nL, 0], zEndrenyi(zsL, rtg)));
  if (nF > 0) adm.push(cDiv([nF, 0], zEndrenyi(zsF, rdg)));
  if (!adm.length) return { sf: 1, zeq: null };
  const zeq = cDiv([1, 0], adm.reduce((s, y) => [s[0] + y[0], s[1] + y[1]], [0, 0]));
  return { sf: cAbs(zeq) / cAbs([zeq[0] + rg, zeq[1]]), zeq };
}

export function malla(e) {
  const rhoS0 = num(e.rhoS, 3000), hs = num(e.hs, 0.1), rhos = rhoS0;
  const dosCapas = e.modeloSuelo === "dosCapas";
  const med = filas(e.mediciones).map((m) => ({ a: num(m.a, 0), rho: num(m.rhoA, 0) })).filter((m) => m.a > 0 && m.rho > 0).sort((p, q) => p.a - q.a);
  let suelo = null;
  if (dosCapas && med.length >= 3) {
    const aj = ajusteDosCapas(med);
    const av1 = med.reduce((t, m) => t + m.rho, 0) / med.length, av2 = (Math.max(...med.map((m) => m.rho)) + Math.min(...med.map((m) => m.rho))) / 2;
    suelo = { ...aj, K: (aj.r2 - aj.r1) / (aj.r2 + aj.r1), av1, av2 };
  }
  const rho = suelo ? suelo.av2 : num(e.rho, 100);
  const If = num(e.ifalla, 5000), sfDig = num(e.sf, 100) / 100, tf = num(e.tf, 0.5), tc = num(e.tc, tf), XR = num(e.xr, 10);
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
  // Conductor (IEEE 80 ec. 37).
  const Areq = (Df * If / 1000) / Math.sqrt(((mat.TCAP * 1e-4) / (tc * mat.ar * mat.rr)) * Math.log((mat.K0 + mat.Tm) / (mat.K0 + Ta)));
  const Acal = N.SECCION_MM2[cal] || 67.43;
  // Geometría.
  const nx = Math.round(Lx / D) + 1, ny = Math.round(Ly / D) + 1;
  const LC = ny * Lx + nx * Ly, Lp = 2 * (Lx + Ly), A = Lx * Ly, LR = nR * Lr, LT = LC + LR;
  const Rg = rho * (1 / LT + (1 / Math.sqrt(20 * A)) * (1 + 1 / (1 + h * Math.sqrt(20 / A))));
  const div = e.sfModo === "calculado" ? factorDivision({ nL: num(e.nLineas, 0), zsL: [num(e.zsLineaR, 1.24), num(e.zsLineaX, 0.55)], rtg: num(e.rtg, 10), nF: num(e.nAlim, 0), zsF: [num(e.zsAlimR, 0.11), num(e.zsAlimX, 0.11)], rdg: num(e.rdg, 25), rg: Rg }) : null;
  const Sf = div ? div.sf : sfDig;
  const IG = Df * Sf * If;
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
  // RETIE 2024 art. 3.12.1 g: sin capa superficial, la tensión de contacto tampoco puede
  // superar la Tabla 3.12.1.a; la resistencia de la Tabla 3.12.3.a es solo de referencia.
  const sinCapa = !(hs > 0 && rhos > 0);
  const retC = N.retieContactoMax(tf, e.acceso);
  const tensionesOk = Em <= Etouch && Es <= Estep && (!sinCapa || Em <= retC.v);
  // Suelo de dos capas: sensibilidad con la capa superior para paso y contacto y
  // la inferior para la resistencia (IEEE 80 §13.4.2.1), como referencia.
  const sens = suelo ? { em: (suelo.r1 * Km * Ki * IG) / LM, es: (suelo.r1 * Ks * Ki * IG) / LS, rg: (Rg * suelo.r2) / rho } : null;
  const notasSuelo = [];
  if (dosCapas && !suelo) notasSuelo.push("Modelo de dos capas seleccionado sin al menos tres mediciones válidas: se usó la resistividad uniforme digitada.");
  if (suelo) {
    notasSuelo.push(`Suelo de dos capas (IEEE 81): ρ1 = ${fmt(suelo.r1, 1)} Ω·m hasta ${fmt(suelo.h, 2)} m, ρ2 = ${fmt(suelo.r2, 1)} Ω·m, K = ${fmt(suelo.K, 3)} (error RMS del ajuste ${fmt(suelo.rms, 2)} %). Las ecuaciones de la IEEE 80 son de suelo uniforme: se usó la resistividad equivalente ρa(av2) = ${fmt(suelo.av2, 1)} Ω·m (IEEE 80 Anexo E).`);
    notasSuelo.push(suelo.K < 0 ? "K negativo (capa superior más resistiva): las tensiones de paso y contacto en la superficie tienden a ser mayores que en suelo uniforme; las varillas que alcanzan la capa inferior reducen la resistencia de forma notable (IEEE 80 §13.4.2.3)." : "K positivo (capa inferior más resistiva): las varillas aportan poco y la corriente tiende a salir por la capa superior; conviene ampliar el área de la malla (IEEE 80 §13.4.2.3).");
    if (suelo.rms > 5) notasSuelo.push(`El ajuste de dos capas tiene un error RMS de ${fmt(suelo.rms, 1)} %: el suelo puede requerir un modelo de más capas (software especializado).`);
    if (Math.max(suelo.r1, suelo.r2) / Math.min(suelo.r1, suelo.r2) > 5) notasSuelo.push("Contraste de resistividades mayor que 5: el modelo uniforme equivalente puede no ser conservador; confirme con un programa de dos capas o multicapa.");
  }
  const notaTransf = GPR <= Etouch ? `El GPR (${fmt(GPR, 0)} V) es menor que la tensión de contacto tolerable: no hay riesgo por tensiones transferidas (IEEE 80 §16, paso 7).` : `El GPR (${fmt(GPR, 0)} V) supera la tensión de contacto tolerable: los elementos metálicos que salen de la subestación (cercas, rieles, tuberías, neutros, pantallas y circuitos de comunicaciones) pueden transferir hasta ese potencial; aíslelos, sepárelos o use dispositivos de neutralización (IEEE 80 §17).`;
  const verificaciones = [
    { criterio: "Tensión de contacto (de malla)", norma: "IEEE 80-2013 §16", valor: `${fmt(Em, 1)} V`, limite: `≤ ${fmt(Etouch, 1)} V`, cumple: Em <= Etouch },
    { criterio: "Tensión de paso", norma: "IEEE 80-2013 §16", valor: `${fmt(Es, 1)} V`, limite: `≤ ${fmt(Estep, 1)} V`, cumple: Es <= Estep },
    ...(sinCapa ? [{ criterio: `Tensión de contacto sin capa superficial (${e.acceso === "ocupacional" ? "ocupacional" : "público en general"}, despeje ${retC.fila})`, norma: "RETIE 2024 Libro 3, art. 3.12.1 g, Tabla 3.12.1.a", valor: `${fmt(Em, 1)} V`, limite: `≤ ${fmt(retC.v, 0)} V`, cumple: Em <= retC.v }] : []),
    { criterio: "Resistencia de puesta a tierra", norma: `RETIE 2024 Tabla 3.12.3.a (referencia): ${ret.nombre}`, valor: `${fmt(Rg, 2)} Ω`, limite: tensionesOk && Rg > ret.max ? `≤ ${fmt(ret.max, 0)} Ω de referencia; se acepta el valor de diseño porque las tensiones de paso y contacto cumplen (Parágrafo 1 del art. 3.12.3)` : `≤ ${fmt(ret.max, 0)} Ω (o tensiones de paso y contacto dentro de los límites)`, cumple: Rg <= ret.max || tensionesOk },
    { criterio: "Sección del conductor de la malla", norma: "IEEE 80-2013 ec. 37 (fusión)", valor: `${fmt(Acal, 1)} mm² (${N.etiquetaCalibre(cal)})`, limite: `≥ ${fmt(Areq, 1)} mm²`, cumple: Acal >= Areq }
  ];
  return {
    resumen: [
      { etiqueta: "Resistencia de la malla", valor: fmt(Rg, 2), unidad: "Ω" },
      { etiqueta: "Elevación de potencial (GPR)", valor: fmt(GPR, 0), unidad: "V" },
      { etiqueta: "Tensión de contacto / tolerable", valor: `${fmt(Em, 0)} / ${fmt(Etouch, 0)}`, unidad: "V" },
      { etiqueta: "Tensión de paso / tolerable", valor: `${fmt(Es, 0)} / ${fmt(Estep, 0)}`, unidad: "V" }
    ],
    tablas: [...(suelo ? [{ titulo: "Modelo del suelo a partir de las mediciones Wenner (IEEE 81)", encabezados: ["Separación a (m)", "ρa medida (Ω·m)", "ρa modelo de dos capas (Ω·m)", "Diferencia (%)"], filas: med.map((m) => { const c = rhoWenner2capas(m.a, suelo.r1, suelo.r2, suelo.h); return [fmt(m.a, 2), fmt(m.rho, 1), fmt(c, 1), fmt((c / m.rho - 1) * 100, 2)]; }) }] : []), { titulo: "Parámetros de la malla", encabezados: ["Parámetro", "Valor"], filas: [
      ["Dimensiones", `${fmt(Lx, 1)} m × ${fmt(Ly, 1)} m (A = ${fmt(A, 1)} m²)`], ["Espaciamiento / profundidad", `${fmt(D, 2)} m / ${fmt(h, 2)} m`],
      ["Conductores", `${nx} × ${fmt(Ly, 1)} m + ${ny} × ${fmt(Lx, 1)} m; LC = ${fmt(LC, 1)} m`], ["Varillas", `${nR} × ${fmt(Lr, 2)} m${nR ? (rodsPer ? " (en el perímetro)" : " (en el interior)") : ""}`],
      ["Resistividad de diseño", suelo ? `${fmt(rho, 1)} Ω·m (ρa(av2) del modelo de dos capas; ρa(av1) = ${fmt(suelo.av1, 1)} Ω·m)` : `${fmt(rho, 1)} Ω·m (suelo uniforme)`], ["Corriente de malla IG", `${fmt(IG, 0)} A (Df = ${fmt(Df, 3)}, Sf = ${fmt(Sf * 100, 1)} %${div ? `, calculado: Zeq = ${fmt(div.zeq?.[0] ?? 0, 3)} + j${fmt(div.zeq?.[1] ?? 0, 3)} Ω` : ""})`], ["Factores", `Cs = ${fmt(Cs, 3)}; n = ${fmt(n, 2)}; Km = ${fmt(Km, 3)}; Ks = ${fmt(Ks, 3)}; Ki = ${fmt(Ki, 3)}`],
      ...(sens ? [["Referencia: ρ1 para paso y contacto, ρ2 para resistencia (IEEE 80 §13.4.2.1)", `Em = ${fmt(sens.em, 0)} V; Es = ${fmt(sens.es, 0)} V; Rg = ${fmt(sens.rg, 2)} Ω`]] : [])
    ] }],
    pasos: [
      ...(suelo ? [{ titulo: "Modelo de suelo de dos capas", formula: "ρa = ρ1 [1 + 4 Σ Kⁿ (1/√(1 + (2nh/a)²) − 1/√(4 + (2nh/a)²))]; K = (ρ2 − ρ1)/(ρ2 + ρ1); ρ1, ρ2 y h por mínimos cuadrados", sustitucion: `${med.length} mediciones Wenner de ${fmt(med[0].a, 2)} a ${fmt(med[med.length - 1].a, 2)} m`, resultado: `ρ1 = ${fmt(suelo.r1, 1)} Ω·m; ρ2 = ${fmt(suelo.r2, 1)} Ω·m; h = ${fmt(suelo.h, 2)} m; RMS = ${fmt(suelo.rms, 2)} %` },
        { titulo: "Resistividad uniforme equivalente", formula: "ρa(av2) = (ρa máx + ρa mín) / 2 (IEEE 80 Anexo E)", sustitucion: `ρa(av1) = promedio = ${fmt(suelo.av1, 1)} Ω·m`, resultado: `ρ = ${fmt(suelo.av2, 1)} Ω·m` }] : []),
      ...(div ? [{ titulo: "Factor de división de corriente", formula: "Zeq = Zs/2 + √(Zs Rt) por línea (Endrenyi); Sf = |Zeq / (Zeq + Rg)|", sustitucion: `${num(e.nLineas, 0)} línea(s) con cable de guarda y ${num(e.nAlim, 0)} alimentador(es) con neutro; Zeq = ${fmt(div.zeq?.[0] ?? 0, 3)} + j${fmt(div.zeq?.[1] ?? 0, 3)} Ω; Rg = ${fmt(Rg, 3)} Ω`, resultado: `Sf = ${fmt(Sf * 100, 1)} %` }] : []),
      { titulo: "Factor de reducción de la capa superficial", formula: "Cs = 1 − 0,09 (1 − ρ/ρs) / (2 hs + 0,09)", sustitucion: `ρ = ${fmt(rho, 0)}; ρs = ${fmt(rhos, 0)} Ω·m; hs = ${fmt(hs, 3)} m`, resultado: `Cs = ${fmt(Cs, 3)}` },
      { titulo: `Tensiones tolerables (persona de ${num(e.peso, 70) >= 70 ? 70 : 50} kg)`, formula: `E contacto = (1000 + 1,5 Cs ρs) × ${k} / √ts; E paso = (1000 + 6 Cs ρs) × ${k} / √ts`, sustitucion: `ts = ${fmt(tf, 2)} s`, resultado: `E contacto = ${fmt(Etouch, 1)} V; E paso = ${fmt(Estep, 1)} V` },
      { titulo: "Corriente de malla", formula: "IG = Df × Sf × 3I0; Df = √(1 + Ta/tf (1 − e^(−2tf/Ta)))", sustitucion: `X/R = ${fmt(XR, 1)} → Ta = ${fmt(TaDc, 4)} s`, resultado: `IG = ${fmt(IG, 0)} A` },
      { titulo: "Sección mínima del conductor", formula: "A = I / √((TCAP × 10⁻⁴ / (tc αr ρr)) × ln((K0 + Tm) / (K0 + Ta)))", sustitucion: `${mat.nombre}; tc = ${fmt(tc, 2)} s`, resultado: `${fmt(Areq, 1)} mm²` },
      { titulo: "Resistencia de la malla (Sverak)", formula: "Rg = ρ [1/LT + 1/√(20A) (1 + 1/(1 + h√(20/A)))]", sustitucion: `LT = ${fmt(LT, 1)} m; A = ${fmt(A, 1)} m²`, resultado: `Rg = ${fmt(Rg, 3)} Ω; GPR = ${fmt(GPR, 0)} V` },
      { titulo: "Tensión de malla", formula: "Em = ρ Km Ki IG / LM", sustitucion: `Km = ${fmt(Km, 3)}; Ki = ${fmt(Ki, 3)}; LM = ${fmt(LM, 1)} m`, resultado: `Em = ${fmt(Em, 1)} V` },
      { titulo: "Tensión de paso", formula: "Es = ρ Ks Ki IG / LS", sustitucion: `Ks = ${fmt(Ks, 3)}; LS = ${fmt(LS, 1)} m`, resultado: `Es = ${fmt(Es, 1)} V` }
    ],
    verificaciones,
    notas: [...notasSuelo, notaTransf],
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
  const icDps = num(e.icDps, 0), ikNodo = num(e.ikNodo, 0);
  if (icDps > 0 && ikNodo > 0) verificaciones.push({ criterio: "Capacidad de cortocircuito del DPS frente a la falla en su nodo", norma: "RETIE 2024 Libro 3, art. 3.17.14 f", valor: `${fmt(icDps, 1)} kA${e.protSerie === "Sí" ? " (con protección en serie)" : ""}`, limite: `≥ ${fmt(ikNodo, 1)} kA o protección de sobrecorriente en serie`, cumple: icDps >= ikNodo || e.protSerie === "Sí" });
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
    notas: ["RETIE 2024 3.3.3.1: toda subestación (transformador) y toda transición de línea aérea a cable aislado de media, alta o extra alta tensión deben tener DPS; en los demás casos la necesidad se define con una evaluación del riesgo por sobretensiones (uso, coordinación de aislamiento, densidad de rayos, topografía y resistividad, personas y equipos).", "RETIE 2024 art. 3.17.14: coordinación según IEC 61643-12 (c.a.) o IEC 61643-32 (FV); conexión lo más corta posible (en BT, distancia «b» ≤ 50 cm); en media, alta y extra alta tensión los conductores de conexión a la red y a tierra no pueden ser menores que 6 AWG; la capacidad de cortocircuito del DPS debe coordinarse con la falla del nodo."],
    conclusion: veredicto(verificaciones, "El DPS seleccionado protege el aislamiento con margen suficiente.", "La coordinación de aislamiento no cumple: revise el DPS, su ubicación o el BIL del equipo.")
  };
}

// ================================================================ 11. DISTANCIAS DE SEGURIDAD (RETIE)
export function distancias(e, proyecto = {}) {
  const H = num(e.altitud, num(proyecto.altitud, 0));
  const D = N.RETIE_DISTANCIAS, verificaciones = [];
  let altas = false, sobre98 = false;
  const tabla = filas(e.puntos).map((p) => {
    const tipo = D.tipos[p.tipo] || D.tipos.e;
    const base = num(p.exigida, NaN);
    const tablaV = tipo.v[p.tension];
    const fAlt = N.factorAltitudDistancia(p.tension, H);
    if (fAlt > 1) altas = true;
    if (Number(p.tension) >= 230) sobre98 = true;
    const req = (Number.isFinite(base) ? base : tablaV ?? NaN) * fAlt;
    const dis = num(p.diseno);
    const ok = Number.isFinite(req) && dis >= req;
    const tTxt = D.textoTension[p.tension] || `${p.tension} kV`;
    verificaciones.push({ criterio: `${p.punto || "Punto"}: ${tipo.nombre}`, norma: Number.isFinite(base) ? "Valor digitado por el diseñador" : `RETIE 2024 ${tipo.tabla}${fAlt > 1 ? " y Nota 2 del art. 3.10" : ""}`, valor: `${fmt(dis, 2)} m`, limite: Number.isFinite(req) ? `≥ ${fmt(req, 2)} m` : `El RETIE 2024 (${tipo.tabla}) no da valor para ${tTxt}: digite la distancia exigida`, cumple: Number.isFinite(req) ? ok : false });
    return [p.punto || "", tTxt, tipo.nombre, Number.isFinite(base) ? "Digitada" : `${tipo.tabla}`, fAlt > 1 ? fmt(fAlt, 3) : "1", Number.isFinite(req) ? fmt(req, 2) : "—", fmt(dis, 2), Number.isFinite(req) ? (ok ? "Cumple" : "No cumple") : "Sin dato"];
  });
  const tablas = [{ titulo: "Distancias mínimas de seguridad", encabezados: ["Punto", "Tensión", "Tipo de distancia", "Fuente", "Factor altitud", "Exigida (m)", "Diseño (m)", "Resultado"], filas: tabla }];
  const pasos = [{ titulo: "Distancia exigida", formula: "d exigida = d tabla RETIE × factor de altitud", sustitucion: H > 1000 ? `Altitud ${fmt(H, 0)} m: factor = 1 + 3 % × (H − 1000)/300 = ${fmt(1 + (0.03 * (H - 1000)) / 300, 3)}, solo para tensiones de más de 57,5 kV; a 57,5 kV o menos el factor es 1` : "Altitud ≤ 1000 m: factor 1", resultado: "Por punto" }];
  const resumen = [{ etiqueta: "Puntos verificados", valor: String(tabla.length), unidad: "" }];
  const S = N.RETIE_SERVIDUMBRE[e.servidumbre];
  if (S?.ancho) {
    const conEc = e.servidumbreEc === "si";
    const sEc = 2 * (num(e.servA, 0) + num(e.servB, 0) + num(e.servC, 0));
    const minimo = conEc ? Math.max(0.9 * S.ancho, sEc) : S.ancho;
    const anchoD = num(e.servidumbreAncho, NaN);
    pasos.push({ titulo: "Ancho de la zona de servidumbre", formula: conEc ? "S = 2 × (A + B + C); mínimo = máx(0,9 × ancho de la tabla; S)" : "Ancho mínimo de la Tabla 3.19.1.a", sustitucion: conEc ? `S = 2 × (${fmt(num(e.servA, 0), 2)} + ${fmt(num(e.servB, 0), 2)} + ${fmt(num(e.servC, 0), 2)}) = ${fmt(sEc, 2)} m; 0,9 × ${S.ancho} = ${fmt(0.9 * S.ancho, 2)} m` : `${S.nombre}: ${S.ancho} m`, resultado: `${fmt(minimo, 2)} m` });
    verificaciones.push({ criterio: "Ancho de la zona de servidumbre ≥ mínimo", norma: conEc ? "RETIE 2024 art. 3.19.1 h, Tabla 3.19.1.a y Nota 5 (ecuación 7, CIGRE 348)" : "RETIE 2024 art. 3.19.1 h, Tabla 3.19.1.a", valor: Number.isFinite(anchoD) ? `${fmt(anchoD, 2)} m` : "Sin dato", limite: `≥ ${fmt(minimo, 2)} m`, cumple: Number.isFinite(anchoD) && anchoD >= minimo - 1e-9 });
    if (e.servidumbreAmpliacion !== "si") verificaciones.push({ criterio: "Ancho de la zona de servidumbre ≤ máximo (tabla + 10 %)", norma: "RETIE 2024 Tabla 3.19.1.a, Nota 3", valor: Number.isFinite(anchoD) ? `${fmt(anchoD, 2)} m` : "Sin dato", limite: `≤ ${fmt(1.1 * S.ancho, 2)} m`, cumple: Number.isFinite(anchoD) && anchoD <= 1.1 * S.ancho + 1e-9 });
    resumen.push({ etiqueta: "Ancho mínimo de servidumbre", valor: fmt(minimo, 2), unidad: "m" });
    tablas.push({ titulo: "Zona de servidumbre", encabezados: ["Línea", "Ancho de la tabla (m)", "Mínimo exigido (m)", "Máximo (m)", "Diseño (m)"], filas: [[S.nombre, fmt(S.ancho, 0), fmt(minimo, 2), e.servidumbreAmpliacion === "si" ? "Reserva para ampliación" : fmt(1.1 * S.ancho, 2), Number.isFinite(anchoD) ? fmt(anchoD, 2) : "—"]] });
  }
  return {
    resumen, tablas, pasos, verificaciones,
    notas: [
      "Distancias del RETIE 2024 (Res. 40117 de 2024, modificada por la Res. 40284 de 2026), Libro 3: Tabla 3.10.1.a (zonas con construcciones) y Tabla 3.10.2.a (lugares y situaciones). Se miden desde la parte energizada más cercana al sitio de posible contacto (Nota 3) y aplican a conductores desnudos; no se aplican a cable aislado con pantalla ni a conductores aislados de baja tensión (Nota 7).",
      "Si la tensión no está en las tablas, se cumple la de la tensión inmediatamente superior (Nota 5). Para redes de media tensión con cable cubierto, espaciadores y señalización, la distancia horizontal de la Tabla 3.10.1.a puede reducirse hasta en 30 % (Nota 9): digite ese valor como distancia exigida.",
      "En redes públicas no se permiten edificaciones debajo de los conductores ni redes de uso público sobre edificaciones; la distancia «a» solo aplica cuando el tenedor de la instalación tiene control absoluto de la instalación y de la edificación.",
      ...(altas ? ["Corrección por altitud (Nota 2 del art. 3.10): para tensiones de más de 57,5 kV, las distancias aumentan 3 % por cada 300 m sobre 1000 m de altitud."] : []),
      ...(sobre98 ? ["Para tensiones línea-tierra de más de 98 kV (230 y 500 kV), el RETIE exige aumentar las distancias de la Tabla 3.10.2.a o reducir el campo eléctrico para limitar a 5 mA rms la corriente de estado estacionario por efecto electrostático en el vehículo o equipo más grande esperado bajo la línea, con la flecha del conductor a 50 °C (Nota 1 de la Tabla 3.10.2.a)."] : []),
      "Los cruces entre líneas (Tabla 3.10.3.a), las distancias entre conductores en la misma estructura (Tablas 3.10.4.a y b) y las distancias para trabajos cerca de partes energizadas (Tabla 3.10.5.b) se verifican digitando la distancia exigida."
    ],
    conclusion: veredicto(verificaciones, "Todas las distancias de diseño cumplen las mínimas de seguridad del RETIE 2024.", "Hay distancias de diseño por debajo de las mínimas de seguridad o fuera de los anchos de servidumbre.")
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
    { criterio: "Tensión mecánica de tendido (EDS) frente al máximo del RETIE", norma: "RETIE 2024 Libro 3, art. 3.19.6 b y 3.20.6.1 a (≤ 25 % de la rotura)", valor: `${fmt(num(e.eds, 18), 1)} %`, limite: "≤ 25 %", cumple: num(e.eds, 18) <= 25 },
    { criterio: "Tensión de cada día (EDS)", norma: "Criterio de diseño (CIGRÉ: 18 a 22 % de la carga de rotura)", valor: `${fmt(num(e.eds, 18), 1)} %`, limite: `≤ ${fmt(num(e.edsMax, 22), 0)} %`, cumple: num(e.eds, 18) <= num(e.edsMax, 22) },
    { criterio: "Tensión máxima en las hipótesis de carga", norma: "Factor de seguridad ≥ 2 (≤ 50 % de la rotura)", valor: `${fmt(maxT / g, 0)} kgf (${fmt((maxT / rotN) * 100, 1)} %)`, limite: "≤ 50 %", cumple: maxT <= 0.5 * rotN }
  ];
  if (alturaAmarre > 0 && libre > 0) verificaciones.push({ criterio: "Distancia al suelo con flecha máxima", norma: "RETIE 2024 art. 3.10.2, Tabla 3.10.2.a", valor: `${fmt(alturaAmarre - maxF, 2)} m`, limite: `≥ ${fmt(libre, 2)} m`, cumple: alturaAmarre - maxF >= libre });
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
    notas: ["RETIE 2024 Libro 3, art. 3.17.28: el transformador de más de 1000 V debe tener protección de sobrecorriente al menos en el primario, coordinada (literal i); si su potencia supera 2 MVA, debe protegerse contra sobrepresiones dinámicas por arco interno, con actuación en los primeros milisegundos, según la NFPA 850 (literal l); las distancias o barreras contra fuego siguen la IEC 61936-1 numeral 8.7.2 (literal d).", "La impedancia uk se toma sobre la potencia indicada (normalmente la ONAN); confirme la base con el protocolo de pruebas del fabricante.", "La corriente de falla en el lado AT de los equipos se toma igual a la de la red (falla en la barra AT)."],
    conclusion: veredicto(verificaciones, `El transformador de ${fmt(sOnan, 0)}/${fmt(sOnaf, 0)} MVA y los equipos asociados son coherentes con las corrientes nominales y de cortocircuito.`, "Hay incoherencias entre el transformador y los equipos o la soportabilidad especificada.")
  };
}

// ================================================================ 14. CABLES DE MEDIA TENSIÓN
// Capacidad de corriente con factores de corrección, soportabilidad al
// cortocircuito (método adiabático IEC 60949) y caída de tensión.
const K_ADIABATICO = { "Cu-XLPE": 143, "Al-XLPE": 94, "Cu-EPR": 143, "Al-EPR": 94, "Cu-PVC": 115, "Al-PVC": 76 };
// Capacidad de corriente de cables de 2001 a 35 000 V enterrados (NTC 2050 / NEC Tablas
// 310.60(C)(77) a (86)). Calibres intermedios (300, 400, 600 kcmil) se interpolan por sección.
export function ampacidadTablaMT({ instalacion = "ductoUni", material = "Al", circuitos = 1, kV = 13.2, tc = 90, calibre }) {
  const inst = N.INSTALACIONES_MT[instalacion];
  if (!inst) return { amp: NaN, ref: "" };
  const tabla = material === "Cu" ? inst.cu : inst.al;
  const disponibles = Object.keys(inst.detalles).map(Number);
  const nc = disponibles.find((c) => c >= circuitos) ?? Math.max(...disponibles);
  const det = inst.detalles[nc], clase = kV <= 5 ? 5 : 35, col = Number(tc) >= 105 ? 105 : 90;
  const fila = N.AMPACIDAD_MT[`${tabla}|${det}`][clase][col];
  const ref = `NTC 2050 Tabla 310.60(C)(${tabla}), Detalle ${det}, ${clase === 5 ? "2001-5000 V" : "5001-35 000 V"}, ${col} °C`;
  const notas = [];
  if (circuitos > nc) notas.push(`la tabla llega a ${nc} circuitos y hay ${circuitos}: requiere cálculo IEC 60287 / Neher-McGrath (S)`);
  else if (nc !== circuitos) notas.push(`se usó la tabla de ${nc} circuitos (la siguiente mayor)`);
  const i = N.CALIBRES_MT.indexOf(String(calibre));
  if (i >= 0) return { amp: fila[i] ?? NaN, ref, notas: fila[i] == null ? [...notas, "calibre no listado para esta tensión"] : notas };
  const S = N.SECCION_MM2[calibre];
  const sec = N.CALIBRES_MT.map((c) => N.SECCION_MM2[c]);
  const k = sec.findIndex((x) => x > S);
  if (!S || k <= 0 || fila[k - 1] == null || fila[k] == null) return { amp: NaN, ref, notas: [...notas, "calibre fuera de la tabla"] };
  const amp = fila[k - 1] + ((fila[k] - fila[k - 1]) * (S - sec[k - 1])) / (sec[k] - sec[k - 1]);
  return { amp, ref, notas: [...notas, `interpolada por sección entre ${N.CALIBRES_MT[k - 1]} y ${N.CALIBRES_MT[k]} (S)`] };
}

export function cableMT(e, proyecto = {}, ctx = {}) {
  const U = num(e.tension, ctx.trafoPotencia ? ctx.trafoPotencia.vs / 1000 : 34.5), dvMax = num(e.dvMax, 3);
  const ik3cc = ctx.cortocircuito?.barras?.[0]?.ik3;
  const ikDef = ctx.trafoPotencia?.ikMT ?? (Number.isFinite(ik3cc) ? ik3cc / 1000 : 0);
  const verificaciones = [];
  const inst = e.instalacion || "ductoUni", nCirc = num(e.nCircuitos, 1), tcMT = num(e.tempConductor, 90) >= 105 ? 105 : 90;
  const tSuelo = num(e.tempSuelo, 20), extra = num(e.profundidadExtra, 0);
  const fTemp = Math.sqrt(Math.max(0, tcMT - tSuelo) / (tcMT - 20)), fProf = Math.max(0, 1 - (0.06 * extra) / 0.3);
  const notasAmp = [];
  const tabla = filas(e.circuitos).map((c) => {
    const mat = c.material === "Cu" ? "Cu" : "Al", ais = c.aislamiento || "XLPE";
    const S = N.SECCION_MM2[c.calibre] ?? num(c.calibre, 0);
    const manual = Number.isFinite(num(c.ampacidad, NaN)) && num(c.ampacidad, 0) > 0;
    const tb = manual ? null : ampacidadTablaMT({ instalacion: inst, material: mat, circuitos: nCirc, kV: U, tc: tcMT, calibre: String(c.calibre) });
    const base = manual ? num(c.ampacidad) : tb.amp;
    const amp = base * num(c.factor, 1) * (manual ? 1 : fTemp * fProf);
    if (tb) notasAmp.push(`${c.circuito || "Circuito"}: ${tb.ref}${tb.notas.length ? ` — ${tb.notas.join("; ")}` : ""}.`);
    const I = num(c.corriente), L = num(c.longitud) / 1000;
    const rho20 = mat === "Cu" ? 0.017241 : 0.028264, alfa = mat === "Cu" ? 0.00393 : 0.00403;
    const R = num(c.r, 0) || (S > 0 ? (rho20 / S) * 1000 * (1 + alfa * 70) : 0), X = num(c.x, 0.13);
    const fp = num(e.fp, 0.9), sen = Math.sqrt(1 - fp * fp);
    const dv = U > 0 ? (Math.sqrt(3) * I * L * (R * fp + X * sen)) / (U * 1000) * 100 : 0;
    const K = K_ADIABATICO[`${mat}-${ais}`] || 94, t = num(c.tDespeje, 0.5);
    const ikAdm = (K * S) / Math.sqrt(t) / 1000, ik = num(c.icc, ikDef);
    const nombre = c.circuito || "Circuito";
    verificaciones.push({ criterio: `${nombre}: capacidad de corriente`, norma: manual ? "Datos del fabricante con factores de corrección (IEC 60502-2)" : `${tb.ref.replace(/, Detalle.*/, "")} con corrección por temperatura y profundidad`, valor: `${fmt(I, 0)} A`, limite: Number.isFinite(amp) ? `≤ ${fmt(amp, 0)} A` : "Sin capacidad de tabla para este calibre", cumple: I <= amp });
    if (ik > 0) verificaciones.push({ criterio: `${nombre}: soportabilidad al cortocircuito`, norma: `IEC 60949 (adiabático, K = ${K})`, valor: `${fmt(ik, 2)} kA`, limite: `≤ ${fmt(ikAdm, 2)} kA en ${fmt(t, 2)} s`, cumple: ik <= ikAdm });
    if (num(c.inCelda, 0)) verificaciones.push({ criterio: `${nombre}: celda o protección`, norma: "IEC 62271-200 — In de la celda ≥ corriente del circuito", valor: `${fmt(num(c.inCelda), 0)} A`, limite: `≥ ${fmt(I, 0)} A`, cumple: num(c.inCelda) >= I });
    if (L > 0) verificaciones.push({ criterio: `${nombre}: caída de tensión`, norma: "Criterio del operador de red (RETIE 2024 3.3.1.1 literal p)", valor: `${fmt(dv, 2)} %`, limite: `≤ ${fmt(dvMax, 1)} %`, cumple: dv <= dvMax });
    return [nombre, `${mat} ${N.etiquetaCalibre(String(c.calibre))} ${ais}`, fmt(S, 1), manual ? `${fmt(base, 0)} (fabricante)` : `${fmt(base, 0)} (tabla${tb.notas.some((x) => x.includes("(S)")) ? ", S" : ""})`, fmt(amp, 0), fmt(I, 0), ik ? fmt(ik, 2) : "—", fmt(ikAdm, 2), L ? fmt(dv, 2) : "—"];
  });
  return {
    resumen: [{ etiqueta: "Circuitos verificados", valor: String(tabla.length), unidad: "" }, { etiqueta: "Ik\" en la barra", valor: ikDef ? fmt(ikDef, 2) : "—", unidad: "kA" }],
    tablas: [{ titulo: "Verificación de cables de media tensión", encabezados: ["Circuito", "Cable", "S (mm²)", "Ampacidad base (A)", "Ampacidad corregida (A)", "I diseño (A)", "Ik (kA)", "Ik admisible (kA)", "ΔV (%)"], filas: tabla }],
    pasos: [
      { titulo: "Capacidad de corriente", formula: "I adm = I tabla × √((Tc − Ts)/(Tc − 20)) × (1 − 0,06 × Δprof/0,3 m) × factor adicional (NTC 2050 310.60(C)(4) y nota de profundidad)", sustitucion: `${(N.INSTALACIONES_MT[inst] || {}).nombre || inst}; ${nCirc} circuito(s); conductor a ${tcMT} °C; suelo a ${fmt(tSuelo, 0)} °C (Ft = ${fmt(fTemp, 3)}); ${fmt(extra, 2)} m más profundo que la Figura 310.60 (Fp = ${fmt(fProf, 3)}). Con ampacidad del fabricante se aplica solo el factor adicional`, resultado: "Por circuito" },
      { titulo: "Cortocircuito en el conductor", formula: "I adm = K × S / √t (IEC 60949, 90 → 250 °C)", sustitucion: "K = 143 (Cu XLPE), 94 (Al XLPE)", resultado: "Por circuito" },
      { titulo: "Caída de tensión", formula: "ΔV % = √3 × I × L × (R cos φ + X sen φ) / U × 100", sustitucion: `U = ${fmt(U, 1)} kV; R a 90 °C (calculada si no se digita)`, resultado: "Por circuito" }
    ],
    verificaciones,
    notas: [...notasAmp, "Las tablas suponen resistividad térmica del suelo de 90 °C·cm/W y factor de carga 100 %: con otro suelo o más circuitos, use el factor adicional o un cálculo IEC 60287 / Neher-McGrath.", "La pantalla metálica del cable debe verificarse para la corriente de falla a tierra con los datos del fabricante."],
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

// ================================================================ 16. ARREGLO FOTOVOLTAICO E INVERSOR (IEC 62548 / NTC 2050 Sec. 690)
// Módulos en serie y en paralelo según las temperaturas extremas del sitio,
// verificados contra los límites del inversor y del módulo.
export function fvArreglo(e) {
  const pmod = num(e.pmod, 550), voc = num(e.voc, 49.9), vmp = num(e.vmp, 41.96), isc = num(e.isc, 14), imp = num(e.imp, 13.11);
  const bVoc = num(e.bVoc, -0.27), bVmp = num(e.bVmp, -0.35), gP = num(e.gPmax, -0.35), noct = num(e.noct, 45);
  const vmaxMod = num(e.vmaxMod, 1500), fusMax = num(e.fusibleMax, 25);
  const vdcMax = num(e.vdcMax, 1100), vMin = num(e.vmpptMin, 550), vMax = num(e.vmpptMax, 850), idcMax = num(e.idcMax, 32), iscMax = num(e.iscMax, 40);
  const nMppt = num(e.nMppt, 10), pac = num(e.pac, 100), vac = num(e.vac, 480), tri = e.fases !== "1";
  const ns = Math.max(1, Math.round(num(e.ns, 18))), np = Math.max(1, Math.round(num(e.np, 2))), nUso = Math.max(1, Math.round(num(e.mpptUsados, 6)));
  const tmin = num(e.tmin, 15), tmax = num(e.tmax, 40), ucpv = num(e.ucpv, 0);
  const tcMax = tmax + ((noct - 20) / 800) * 1000;
  const vocMax = voc * (1 + (bVoc / 100) * (tmin - 25)), vmpMin = vmp * (1 + (bVmp / 100) * (tcMax - 25)), vmpMax = vmp * (1 + (bVmp / 100) * (tmin - 25));
  const vOcStr = ns * vocMax, vMpMinStr = ns * vmpMin, vMpMaxStr = ns * vmpMax;
  const nsMax = Math.floor(Math.min(vdcMax, vmaxMod) / vocMax), nsMin = Math.ceil(vMin / vmpMin), nsMaxMppt = Math.floor(vMax / vmpMax);
  const iMpptIsc = np * isc * 1.25, iMpptImp = np * imp;
  const nMod = ns * np * nUso, pdc = (nMod * pmod) / 1000, ilr = pac > 0 ? pdc / pac : 0;
  const iac = tri ? (pac * 1000) / (Math.sqrt(3) * vac) : (pac * 1000) / vac;
  const pdcCaliente = pdc * (1 + (gP / 100) * (tcMax - 25));
  // Corriente inversa hacia un string en falla: la de los demás strings en paralelo.
  const iInversa = (np - 1) * isc * 1.25, fusibles = iInversa > fusMax;
  const ilrMin = num(e.ilrMin, 0.9), ilrMax = num(e.ilrMax, 1.35);
  const verificaciones = [
    { criterio: "Tensión de circuito abierto del string a la temperatura mínima frente al inversor", norma: "IEC 62548 §6 / NTC 2050 690.7", valor: `${fmt(vOcStr, 0)} V`, limite: `≤ ${fmt(vdcMax, 0)} V`, cumple: vOcStr <= vdcMax },
    { criterio: "Tensión de circuito abierto del string frente a la tensión máxima del módulo", norma: "IEC 61730 / ficha del módulo", valor: `${fmt(vOcStr, 0)} V`, limite: `≤ ${fmt(vmaxMod, 0)} V`, cumple: vOcStr <= vmaxMod },
    { criterio: "Tensión de máxima potencia a la temperatura máxima de celda dentro del rango MPPT", norma: "IEC 62548 / ficha del inversor", valor: `${fmt(vMpMinStr, 0)} V`, limite: `≥ ${fmt(vMin, 0)} V`, cumple: vMpMinStr >= vMin },
    { criterio: "Tensión de máxima potencia a la temperatura mínima dentro del rango MPPT", norma: "IEC 62548 / ficha del inversor", valor: `${fmt(vMpMaxStr, 0)} V`, limite: `≤ ${fmt(vMax, 0)} V`, cumple: vMpMaxStr <= vMax },
    { criterio: "Corriente de cortocircuito por MPPT (1,25 × Isc)", norma: "NTC 2050 690.8(A) / ficha del inversor", valor: `${fmt(iMpptIsc, 1)} A`, limite: `≤ ${fmt(iscMax, 1)} A`, cumple: iMpptIsc <= iscMax },
    { criterio: "Corriente de operación por MPPT", norma: "Ficha del inversor (corriente máxima de entrada)", valor: `${fmt(iMpptImp, 1)} A`, limite: `≤ ${fmt(idcMax, 1)} A`, cumple: iMpptImp <= idcMax },
    { criterio: "Entradas MPPT utilizadas", norma: "Ficha del inversor", valor: String(nUso), limite: `≤ ${nMppt}`, cumple: nUso <= nMppt },
    { criterio: "Relación DC/AC (potencia pico / potencia del inversor)", norma: "Criterio de diseño", valor: fmt(ilr, 2), limite: `${fmt(ilrMin, 2)} a ${fmt(ilrMax, 2)}`, cumple: ilr >= ilrMin && ilr <= ilrMax }
  ];
  if (ucpv > 0) verificaciones.push({ criterio: "Tensión del DPS de corriente continua frente a la tensión máxima del string", norma: "IEC 61643-31 / IEC 60364-7-712 (Ucpv ≥ Voc máx.)", valor: `${fmt(ucpv, 0)} V`, limite: `≥ ${fmt(vOcStr, 0)} V`, cumple: ucpv >= vOcStr });
  return {
    resumen: [
      { etiqueta: "Potencia pico del arreglo", valor: fmt(pdc, 2), unidad: "kWp" },
      { etiqueta: "Configuración", valor: `${nUso} × ${np} × ${ns}`, unidad: "MPPT × strings × módulos" },
      { etiqueta: "Relación DC/AC", valor: fmt(ilr, 2), unidad: "" },
      { etiqueta: "Voc máx. del string", valor: fmt(vOcStr, 0), unidad: "V" }
    ],
    salidas: { pdc, pac, vac, tri, isc, imp, ns, np, nUso, vocStr: vOcStr, vmpStr: ns * vmp, vmpMinStr: vMpMinStr, iac, fusMax, gPmax: gP, noct, fusibles },
    tablas: [
      { titulo: "Tensiones del módulo y del string", encabezados: ["Condición", "Temperatura de celda", "Módulo (V)", "String de " + ns + " módulos (V)", "Límite"], filas: [
        ["Circuito abierto a temperatura mínima", `${fmt(tmin, 1)} °C`, fmt(vocMax, 2), fmt(vOcStr, 0), `≤ ${fmt(Math.min(vdcMax, vmaxMod), 0)} V`],
        ["Máxima potencia a temperatura máxima", `${fmt(tcMax, 1)} °C`, fmt(vmpMin, 2), fmt(vMpMinStr, 0), `≥ ${fmt(vMin, 0)} V`],
        ["Máxima potencia a temperatura mínima", `${fmt(tmin, 1)} °C`, fmt(vmpMax, 2), fmt(vMpMaxStr, 0), `≤ ${fmt(vMax, 0)} V`]
      ] },
      { titulo: "Configuración del arreglo", encabezados: ["Parámetro", "Valor"], filas: [
        ["Módulos en serie admisibles", `${nsMin} a ${Math.min(nsMax, nsMaxMppt)} (adoptado: ${ns})`], ["Strings en paralelo por MPPT", String(np)], ["Entradas MPPT utilizadas", `${nUso} de ${nMppt}`],
        ["Número total de módulos", String(nMod)], ["Potencia pico (STC)", `${fmt(pdc, 2)} kWp`], ["Potencia pico a la temperatura máxima de celda", `${fmt(pdcCaliente, 2)} kW`],
        ["Inversor", `${fmt(pac, 1)} kW, ${fmt(vac, 0)} V ${tri ? "trifásico" : "monofásico"} (${fmt(iac, 1)} A)`],
        ["Fusibles de string", fusibles ? `Requeridos: la corriente inversa (${fmt(iInversa, 1)} A) supera el fusible máximo del módulo (${fmt(fusMax, 0)} A)` : `No requeridos: corriente inversa ${fmt(iInversa, 1)} A ≤ fusible máximo del módulo ${fmt(fusMax, 0)} A`]
      ] }
    ],
    pasos: [
      { titulo: "Temperatura máxima de celda", formula: "Tc = Tamb máx. + (NOCT − 20) / 800 × 1000", sustitucion: `${fmt(tmax, 1)} + (${fmt(noct, 0)} − 20) / 800 × 1000`, resultado: `${fmt(tcMax, 1)} °C` },
      { titulo: "Tensión de circuito abierto máxima", formula: "Voc máx. = Voc × (1 + βVoc × (Tmín − 25))", sustitucion: `${fmt(voc, 2)} × (1 + ${fmt(bVoc, 2)} % × (${fmt(tmin, 1)} − 25))`, resultado: `${fmt(vocMax, 2)} V por módulo; ${fmt(vOcStr, 0)} V el string` },
      { titulo: "Tensión de máxima potencia mínima", formula: "Vmp mín. = Vmp × (1 + βVmp × (Tc máx. − 25))", sustitucion: `${fmt(vmp, 2)} × (1 + ${fmt(bVmp, 2)} % × (${fmt(tcMax, 1)} − 25))`, resultado: `${fmt(vmpMin, 2)} V por módulo; ${fmt(vMpMinStr, 0)} V el string` },
      { titulo: "Módulos en serie", formula: "Ns máx. = Vdc máx. / Voc máx.; Ns mín. = V MPPT mín. / Vmp mín.", sustitucion: `${fmt(Math.min(vdcMax, vmaxMod), 0)} / ${fmt(vocMax, 2)}; ${fmt(vMin, 0)} / ${fmt(vmpMin, 2)}`, resultado: `${nsMin} ≤ Ns ≤ ${Math.min(nsMax, nsMaxMppt)}` },
      { titulo: "Corriente por MPPT", formula: "I = Np × 1,25 × Isc (NTC 2050 690.8)", sustitucion: `${np} × 1,25 × ${fmt(isc, 2)}`, resultado: `${fmt(iMpptIsc, 1)} A` },
      { titulo: "Potencia y relación DC/AC", formula: "Pdc = N módulos × Pmod; DC/AC = Pdc / Pac", sustitucion: `${nMod} × ${fmt(pmod, 0)} W; ${fmt(pdc, 2)} / ${fmt(pac, 1)}`, resultado: `${fmt(pdc, 2)} kWp; ${fmt(ilr, 2)}` }
    ],
    verificaciones,
    notas: ["Los datos del módulo y del inversor deben tomarse de sus fichas técnicas. Temperaturas del sitio: mínima histórica y máxima de diseño (IDEAM)."],
    conclusion: veredicto(verificaciones, `Arreglo de ${nMod} módulos (${fmt(pdc, 2)} kWp) en ${nUso} MPPT con ${np} string(s) de ${ns} módulos: compatible con el inversor de ${fmt(pac, 1)} kW.`, "La configuración del arreglo no es compatible con el inversor o el módulo.")
  };
}

// ================================================================ 17. PRODUCCIÓN Y BALANCE ENERGÉTICO (AGPE / GD)
export function fvProduccion(e, proyecto = {}, ctx = {}) {
  const a = ctx.fvArreglo || {};
  const pdc = num(e.pdc, a.pdc ?? 100), hsp = num(e.hsp, 5), tamb = num(e.tambSol, 30), g = num(e.gMedia, 800);
  const gP = num(e.gPmax, a.gPmax ?? -0.35), noct = num(e.noct, a.noct ?? 45);
  const tcel = tamb + ((noct - 20) / 800) * g;
  const pTemp = Math.max(0, -gP * (tcel - 25));
  const perdidas = [
    ["Temperatura de celda", pTemp, `Tc = ${fmt(tcel, 1)} °C con ${fmt(g, 0)} W/m²; γ = ${fmt(gP, 2)} %/°C`],
    ["Suciedad", num(e.pSuciedad, 3), "Polvo y suciedad entre limpiezas"], ["Sombreado", num(e.pSombra, 0), "Obstáculos y sombras entre filas"],
    ["Dispersión entre módulos (mismatch)", num(e.pMismatch, 2), ""], ["Cableado DC", num(e.pCableDC, 1.5), "Ver «Conductores y protecciones del sistema FV»"],
    ["Inversor", 100 - num(e.efInversor, 98), `Eficiencia europea ${fmt(num(e.efInversor, 98), 1)} %`], ["Cableado AC", num(e.pCableAC, 1), ""],
    ["Indisponibilidad", num(e.pDisp, 1), "Mantenimientos y fallas"]
  ];
  const pr = perdidas.reduce((p, [, l]) => p * (1 - l / 100), 1);
  const e1 = pdc * hsp * 365 * pr, yieldEsp = pdc > 0 ? e1 / pdc : 0;
  const deg = num(e.degradacion, 0.5), anios = Math.max(1, Math.round(num(e.anios, 25)));
  let eTotal = 0; const porAnio = [];
  for (let k = 1; k <= anios; k++) { const ek = e1 * Math.pow(1 - deg / 100, k - 1); eTotal += ek; if ([1, 5, 10, 15, 20, 25, anios].includes(k) && !porAnio.some((x) => x[0] === k)) porAnio.push([k, ek]); }
  const consumo = num(e.consumo, 0), simult = num(e.simultaneidad, 70) / 100;
  const auto = Math.min(e1 * simult, consumo || e1 * simult), exced = e1 - auto, impo = Math.max(0, consumo - auto);
  const permuta = Math.min(exced, impo), venta = Math.max(0, exced - impo);
  const tarifa = num(e.tarifa, 0), comerc = num(e.comercializacion, 0), bolsa = num(e.bolsa, 0);
  const ahorro = auto * tarifa + permuta * (tarifa - comerc) + venta * bolsa;
  const verificaciones = [{ criterio: "Rendimiento global del sistema (PR) dentro del rango típico", norma: "IEC 61724-1 (referencia de diseño)", valor: fmt(pr, 3), limite: "0,70 a 0,90", cumple: pr >= 0.7 && pr <= 0.9 }];
  return {
    resumen: [
      { etiqueta: "Energía del primer año", valor: fmt(e1 / 1000, 1), unidad: "MWh/año" },
      { etiqueta: "Rendimiento específico", valor: fmt(yieldEsp, 0), unidad: "kWh/kWp·año" },
      { etiqueta: "Rendimiento global PR", valor: fmt(pr * 100, 1), unidad: "%" },
      ...(consumo ? [{ etiqueta: "Cobertura del consumo", valor: fmt((e1 / consumo) * 100, 1), unidad: "%" }] : [])
    ],
    salidas: { e1, pr, autoconsumo: auto, excedentes: exced },
    tablas: [
      { titulo: "Pérdidas y rendimiento global (PR)", encabezados: ["Pérdida", "%", "Observación"], filas: [...perdidas.map(([n, l, o]) => [n, fmt(l, 2), o]), ["Rendimiento global PR = Π (1 − pérdida)", fmt(pr * 100, 1), ""]] },
      { titulo: "Producción a lo largo de la vida útil", encabezados: ["Año", "Energía (MWh)"], filas: [...porAnio.map(([k, ek]) => [String(k), fmt(ek / 1000, 1)]), [`Total ${anios} años`, fmt(eTotal / 1000, 0)]] },
      ...(consumo ? [{ titulo: "Balance energético anual (CREG 174 de 2021)", encabezados: ["Concepto", "kWh/año", "Valoración"], filas: [
        ["Consumo anual del usuario", fmt(consumo, 0), ""], ["Autoconsumo (energía generada y consumida en sitio)", fmt(auto, 0), tarifa ? `$ ${fmt(auto * tarifa, 0)} a la tarifa` : ""],
        ["Excedentes entregados a la red", fmt(exced, 0), ""], ["— permutados (hasta igualar las importaciones)", fmt(permuta, 0), tarifa ? `$ ${fmt(permuta * (tarifa - comerc), 0)} a tarifa menos comercialización` : ""],
        ["— vendidos (por encima de las importaciones)", fmt(venta, 0), bolsa ? `$ ${fmt(venta * bolsa, 0)} a precio de bolsa` : ""], ["Importaciones de la red", fmt(impo, 0), ""],
        ...(tarifa ? [["Ahorro e ingresos anuales estimados", "", `$ ${fmt(ahorro, 0)}`]] : [])
      ] }] : [])
    ],
    pasos: [
      { titulo: "Temperatura media de celda", formula: "Tc = Tamb + (NOCT − 20) / 800 × G", sustitucion: `${fmt(tamb, 1)} + (${fmt(noct, 0)} − 20) / 800 × ${fmt(g, 0)}`, resultado: `${fmt(tcel, 1)} °C → pérdida ${fmt(pTemp, 2)} %` },
      { titulo: "Rendimiento global", formula: "PR = Π (1 − pérdida i)", sustitucion: perdidas.map(([n, l]) => `${n.split(" ")[0]} ${fmt(l, 1)} %`).join("; "), resultado: `PR = ${fmt(pr, 3)}` },
      { titulo: "Energía del primer año", formula: "E = Pdc × HSP × 365 × PR", sustitucion: `${fmt(pdc, 2)} kWp × ${fmt(hsp, 2)} h × 365 × ${fmt(pr, 3)}`, resultado: `${fmt(e1, 0)} kWh/año (${fmt(yieldEsp, 0)} kWh/kWp)` },
      { titulo: "Degradación", formula: "E año n = E1 × (1 − d)^(n − 1)", sustitucion: `d = ${fmt(deg, 2)} %/año`, resultado: `${fmt(eTotal / 1000, 0)} MWh en ${anios} años` },
      ...(consumo ? [{ titulo: "Balance", formula: "Autoconsumo = E × simultaneidad; excedentes = E − autoconsumo; permuta = mín(excedentes, importaciones)", sustitucion: `Simultaneidad ${fmt(simult * 100, 0)} %`, resultado: `Excedentes ${fmt(exced, 0)} kWh; permuta ${fmt(permuta, 0)} kWh; venta ${fmt(venta, 0)} kWh` }] : [])
    ],
    verificaciones,
    notas: ["Las horas sol pico (HSP) deben tomarse del Atlas de Radiación Solar del IDEAM o de una base satelital (NASA POWER, PVGIS) para el sitio y la inclinación del arreglo.", "La valoración económica es indicativa: depende de la tarifa vigente, del comercializador y de las reglas de la CREG 174 de 2021 aplicables al usuario."],
    conclusion: `El sistema de ${fmt(pdc, 2)} kWp produciría unos ${fmt(e1 / 1000, 1)} MWh el primer año (PR ${fmt(pr * 100, 1)} %)${consumo ? `, el ${fmt((e1 / consumo) * 100, 0)} % del consumo anual` : ""}.`
  };
}

// ================================================================ 18. CONDUCTORES Y PROTECCIONES DEL SISTEMA FV (NTC 2050 690.8)
export function fvConductores(e, proyecto = {}, ctx = {}) {
  const a = ctx.fvArreglo || {};
  const dvMax = num(e.dvMax, 1.5), dvTotalMax = num(e.dvTotalMax, 3);
  const verificaciones = [];
  let dvDC = 0, dvAC = 0;
  const tabla = filas(e.circuitos).map((c) => {
    const tipo = c.tipo || "DC string", dc = tipo.startsWith("DC");
    const base = num(c.corriente, NaN);
    const iBase = Number.isFinite(base) ? base : tipo === "DC string" ? a.isc ?? 0 : tipo === "DC agrupado" ? (a.isc ?? 0) * (a.np ?? 1) : a.iac ?? 0;
    const iMax = dc ? iBase * 1.25 : iBase; // 690.8(A): 125 % de Isc por irradiancia
    const iDis = iMax * 1.25; // 690.8(B) y 215.2: 125 % adicional
    const cal = String(c.calibre || "10"), mat = c.material === "Al" ? "Al" : "Cu";
    const tabla = N.AMPACIDAD[mat][cal] || [0, 0, 0];
    const tAmb = num(c.tAmb, num(proyecto.tempAmbiente, 30)) + num(c.adicional, 0);
    const ft = (N.FACTOR_TEMPERATURA.find(([hasta]) => tAmb <= hasta) || [0, 0, 0, 0])[3] ?? 0;
    const fa = (N.FACTOR_AGRUPAMIENTO.find(([hasta]) => num(c.portadores, 2) <= hasta) || [0, 0.35])[1];
    const amp90 = tabla[2] * ft * fa, amp75 = tabla[1];
    const prot = num(c.proteccion, 0) || sigNormal(N.PROTECCIONES_NORMALIZADAS, iDis) || 0;
    const t9 = N.TABLA9[cal] || [0.1, 0.1, 1, 1, 1];
    const R = mat === "Al" ? t9[4] : t9[2], X = t9[0];
    const L = num(c.longitud, 0) / 1000, V = num(c.tension, NaN);
    const vRef = Number.isFinite(V) ? V : dc ? a.vmpStr ?? 700 : a.vac ?? 480;
    const dv = dc ? ((2 * iMax * R * L) / vRef) * 100 : ((a.tri === false ? 2 : Math.sqrt(3)) * iMax * L * R / vRef) * 100;
    if (dc) dvDC = Math.max(dvDC, dv); else dvAC = Math.max(dvAC, dv);
    const tierra = (N.TIERRA_EQUIPOS.find(([lim]) => prot <= lim) || N.TIERRA_EQUIPOS[N.TIERRA_EQUIPOS.length - 1])[1];
    const nom = c.tramo || tipo;
    verificaciones.push({ criterio: `${nom}: capacidad corregida del conductor (90 °C)`, norma: "NTC 2050 690.8(B)(2) — I máx. con factores de corrección", valor: `${fmt(amp90, 1)} A`, limite: `≥ ${fmt(iMax, 1)} A`, cumple: amp90 >= iMax });
    verificaciones.push({ criterio: `${nom}: capacidad en los terminales (75 °C)`, norma: "NTC 2050 690.8(B)(1) y 110.14(C) — 125 % de I máx.", valor: `${fmt(amp75, 1)} A`, limite: `≥ ${fmt(iDis, 1)} A`, cumple: amp75 >= iDis });
    if (tipo === "DC string" && a.fusibles) verificaciones.push({ criterio: `${nom}: fusible de string`, norma: "NTC 2050 690.9 — entre 1,56 Isc y el fusible máximo del módulo", valor: `${fmt(prot, 0)} A`, limite: `${fmt(iDis, 1)} a ${fmt(a.fusMax ?? 25, 0)} A`, cumple: prot >= iDis - 1e-9 && prot <= (a.fusMax ?? 25) });
    else if (tipo !== "DC string") verificaciones.push({ criterio: `${nom}: protección contra sobrecorriente`, norma: "NTC 2050 690.9 y 240.4", valor: `${fmt(prot, 0)} A`, limite: `≥ ${fmt(iDis, 1)} A y ≤ capacidad del conductor`, cumple: prot >= iDis - 1e-9 && prot <= (sigNormal(N.PROTECCIONES_NORMALIZADAS, amp90) || amp90) });
    if (L > 0) verificaciones.push({ criterio: `${nom}: caída de tensión`, norma: dc ? "Criterio de diseño (IEC 62548 recomienda limitar las pérdidas DC)" : "Criterio de diseño", valor: `${fmt(dv, 2)} %`, limite: `≤ ${fmt(dvMax, 1)} %`, cumple: dv <= dvMax });
    return [nom, `${mat} ${N.etiquetaCalibre(cal)}`, fmt(iBase, 1), fmt(iMax, 1), fmt(iDis, 1), fmt(amp90, 1), fmt(amp75, 0), tipo === "DC string" && !a.fusibles ? "No requerida" : `${fmt(prot, 0)} A`, N.etiquetaCalibre(tierra), L ? fmt(dv, 2) : "—"];
  });
  if (dvAC > 0) verificaciones.push({ criterio: "Caída de tensión entre la salida del inversor y el punto de conexión", norma: "RETIE 2024 Libro 3, art. 3.17.21 d", valor: `${fmt(dvAC, 2)} %`, limite: "≤ 3 %", cumple: dvAC <= 3 + 1e-9 });
  if (dvDC + dvAC > 0) verificaciones.push({ criterio: "Caída de tensión total (DC más AC)", norma: "Criterio de diseño", valor: `${fmt(dvDC + dvAC, 2)} %`, limite: `≤ ${fmt(dvTotalMax, 1)} %`, cumple: dvDC + dvAC <= dvTotalMax });
  return {
    resumen: [{ etiqueta: "Circuitos verificados", valor: String(tabla.length), unidad: "" }, { etiqueta: "Caída de tensión DC + AC", valor: fmt(dvDC + dvAC, 2), unidad: "%" }],
    tablas: [{ titulo: "Conductores y protecciones del sistema fotovoltaico", encabezados: ["Circuito", "Conductor", "I base (A)", "I máx. (A)", "I diseño 125 % (A)", "Capacidad corregida 90 °C (A)", "Capacidad 75 °C (A)", "Protección", "Tierra de equipos", "ΔV (%)"], filas: tabla }],
    pasos: [
      { titulo: "Corriente máxima", formula: "DC: I máx. = 1,25 × Isc (string) o 1,25 × Np × Isc (agrupado); AC: I máx. = I nominal del inversor", sustitucion: "NTC 2050 690.8(A)", resultado: "Por circuito" },
      { titulo: "Corriente de diseño", formula: "I diseño = 1,25 × I máx. (DC: 1,56 × Isc)", sustitucion: "NTC 2050 690.8(B) y 215.2", resultado: "Por circuito" },
      { titulo: "Capacidad del conductor", formula: "I 90 °C × Ft × Fa ≥ I máx.; I 75 °C ≥ I diseño", sustitucion: "NTC 2050 Tabla 310.15(B)(16); temperatura con el incremento por exposición solar", resultado: "Por circuito" },
      { titulo: "Caída de tensión", formula: "DC: ΔV = 2 I L R / V; AC trifásico: ΔV = √3 I L R / V", sustitucion: "R de la NTC 2050 Cap. 9 Tabla 9", resultado: `DC ${fmt(dvDC, 2)} %; AC ${fmt(dvAC, 2)} %` },
      { titulo: "Puesta a tierra de equipos", formula: "Calibre según la protección", sustitucion: "NTC 2050 Tabla 250.122", resultado: "Por circuito" }
    ],
    verificaciones,
    notas: ["Para circuitos DC use conductor fotovoltaico (PV wire) de doble aislamiento, resistente a rayos UV, con tensión nominal ≥ Voc máx. del string."],
    conclusion: veredicto(verificaciones, "Los conductores y protecciones del sistema fotovoltaico cumplen.", "Hay conductores o protecciones del sistema fotovoltaico que no cumplen.")
  };
}

// ================================================================ 19. CONEXIÓN A LA RED (CREG 174 DE 2021)
export function fvConexion(e, proyecto = {}, ctx = {}) {
  const a = ctx.fvArreglo || {};
  const tipo = e.tipo === "GD" ? "GD" : "AGPE";
  const pac = num(e.pac, a.pac ?? 100), vkv = num(e.tension, (a.vac ?? 480) / 1000), sk = num(e.sk, 20), rx = num(e.rxRed, 0.5);
  const dmin = num(e.demandaMin, 0), fp = Math.min(1, Math.max(0.8, num(e.fp, 1))), dvMax = num(e.dvMax, 2);
  const capDisp = num(e.capacidadDisponible, 0), icu = num(e.icu, 0), fAporte = num(e.aporte, 1.2);
  const Z = (vkv * vkv) / sk, X = Z / Math.sqrt(1 + rx * rx), R = rx * X;
  const pExp = Math.max(0, pac - dmin) / 1000, qExp = pExp * Math.tan(Math.acos(fp));
  const dv = ((pExp * R + qExp * X) / (vkv * vkv)) * 100;
  const iac = (pac * 1000) / (Math.sqrt(3) * vkv * 1000);
  const ikRed = sk / (Math.sqrt(3) * vkv), ikInv = (fAporte * iac) / 1000, ikTot = ikRed + ikInv;
  const scr = pac > 0 ? (sk * 1000) / pac : 0;
  const clase = tipo === "GD" ? (pac <= 1000 ? "Generador distribuido (GD), hasta 1 MW" : "Fuera del rango de GD (> 1 MW)")
    : pac <= 100 ? "AGPE hasta 0,1 MW: procedimiento simplificado, sin estudio de conexión" : pac <= 1000 ? "AGPE entre 0,1 y 1 MW: requiere estudio de conexión simplificado" : "Autogenerador a gran escala (> 1 MW): fuera del alcance de AGPE";
  const verificaciones = [
    { criterio: `Potencia dentro del límite de ${tipo}`, norma: "CREG 174 de 2021 (AGPE y GD hasta 1 MW)", valor: `${fmt(pac, 1)} kW`, limite: "≤ 1.000 kW", cumple: pac <= 1000 },
    { criterio: "Elevación de tensión en el punto de conexión por la inyección", norma: "Criterio de diseño (verificar el límite con el operador de red; NTC 1340)", valor: `${fmt(dv, 2)} %`, limite: `≤ ${fmt(dvMax, 1)} %`, cumple: dv <= dvMax },
    { criterio: "Inversor con protección anti-isla certificada", norma: "CREG 174 de 2021 (IEC 62116, UL 1741 o IEEE 1547); RETIE 2024 art. 3.18.2", valor: e.antiIsla === "No" ? "No" : "Sí", limite: "Sí", cumple: e.antiIsla !== "No" },
    { criterio: "Medidor bidireccional en la frontera", norma: "CREG 174 de 2021 y código de medida (CREG 038 de 2014)", valor: e.medidor === "No" ? "No" : "Sí", limite: "Sí", cumple: e.medidor !== "No" }
  ];
  if (capDisp > 0) verificaciones.splice(1, 0, { criterio: "Potencia frente a la capacidad disponible publicada por el operador de red", norma: "CREG 174 de 2021 — disponibilidad de capacidad del circuito", valor: `${fmt(pac, 1)} kW`, limite: `≤ ${fmt(capDisp, 1)} kW`, cumple: pac <= capDisp });
  if (icu > 0) verificaciones.push({ criterio: "Capacidad de interrupción de los equipos con el aporte del inversor", norma: "IEC 60909-0 (aporte del inversor ≈ 1,1 a 1,5 In); RETIE 2024 art. 3.17.19", valor: `${fmt(icu, 1)} kA`, limite: `≥ ${fmt(ikTot, 2)} kA`, cumple: icu >= ikTot });
  return {
    resumen: [
      { etiqueta: "Clasificación", valor: tipo, unidad: "" },
      { etiqueta: "Elevación de tensión en el punto de conexión", valor: fmt(dv, 2), unidad: "%" },
      { etiqueta: "Relación de cortocircuito Sk / Pac", valor: fmt(scr, 0), unidad: "" }
    ],
    tablas: [
      { titulo: "Conexión a la red", encabezados: ["Parámetro", "Valor"], filas: [
        ["Tipo de generador", clase], ["Potencia nominal AC", `${fmt(pac, 1)} kW`], ["Tensión del punto de conexión", `${fmt(vkv, 3)} kV`],
        ["Potencia de cortocircuito en el punto de conexión", `${fmt(sk, 2)} MVA (Z = ${fmt(Z * 1000, 2)} mΩ, R/X = ${fmt(rx, 2)})`],
        ["Potencia exportada en el peor caso", `${fmt(pExp * 1000, 1)} kW (demanda mínima ${fmt(dmin, 1)} kW)`],
        ["Corriente nominal del inversor", `${fmt(iac, 1)} A`], ["Cortocircuito de la red / aporte del inversor", `${fmt(ikRed, 2)} kA / ${fmt(ikInv, 3)} kA`]
      ] },
      { titulo: "Ajustes de referencia de las protecciones de interconexión (IEEE 1547-2018, categoría II)", encabezados: ["Función", "Ajuste", "Tiempo de despeje"], filas: N.AJUSTES_IEEE1547 }
    ],
    pasos: [
      { titulo: "Impedancia de la red en el punto de conexión", formula: "Z = U² / Sk; X = Z / √(1 + (R/X)²); R = (R/X) × X", sustitucion: `${fmt(vkv, 3)}² / ${fmt(sk, 2)}`, resultado: `R = ${fmt(R * 1000, 2)} mΩ; X = ${fmt(X * 1000, 2)} mΩ` },
      { titulo: "Elevación de tensión", formula: "ΔU / U = (P × R + Q × X) / U²", sustitucion: `P = ${fmt(pExp * 1000, 1)} kW; fp = ${fmt(fp, 2)}`, resultado: `${fmt(dv, 2)} %` },
      { titulo: "Aporte al cortocircuito", formula: "Ik inversor ≈ factor × In", sustitucion: `${fmt(fAporte, 2)} × ${fmt(iac, 1)} A`, resultado: `${fmt(ikInv * 1000, 0)} A; total ${fmt(ikTot, 2)} kA` }
    ],
    verificaciones,
    notas: ["Los ajustes de las protecciones de interconexión son de referencia: los definitivos los fija el operador de red en la aprobación de la conexión.", "Antes de la solicitud de conexión, consulte en la página del operador de red la capacidad disponible del circuito o transformador (CREG 174 de 2021)."],
    conclusion: veredicto(verificaciones, `${clase}. La conexión cumple los criterios verificados.`, `${clase}. Hay criterios de conexión que no se cumplen.`)
  };
}

// ================================================================ 20. ARCO ELÉCTRICO (IEEE 1584-2018)
// Modelo empírico de la IEEE 1584-2018 para sistemas trifásicos de 208 V a
// 15 kV. Implementación propia, validada con los ejemplos D.1 (4,16 kV) y D.2
// (480 V) del Anexo D de la norma; sigue el mismo tratamiento de la biblioteca
// abierta arcflash (Li-aung Yip, MIT) para la corriente reducida en BT.
// Unidades internas: kV, kA, mm, ms, J/cm².
const L10 = Math.log10;
function poli(coef, x) { return coef.reduce((s, k, i) => s + k * Math.pow(x, coef.length - 1 - i), 0); }
function cfEncerramiento(ec, V, h, w, d) {
  if (ec === "VOA" || ec === "HOA") return { cf: 1, tipo: "Al aire libre", ees: null };
  const tipo = V < 0.6 && h < 508 && w < 508 && d <= 203.2 ? "Shallow" : "Typical";
  const [A, B] = { VCB: [4, 20], VCBB: [10, 24], HCB: [10, 22] }[ec];
  const eq1112 = (dim) => (660.4 + (dim - 660.4) * ((V + A) / B)) / 25.4;
  const mmIn = 0.03937;
  let w1, h1;
  if (w < 508) w1 = tipo === "Typical" ? 20 : mmIn * w; else if (w <= 660.4) w1 = mmIn * w; else if (w <= 1244.6) w1 = eq1112(w); else w1 = eq1112(1244.6);
  if (h < 508) h1 = tipo === "Typical" ? 20 : mmIn * h; else if (h <= 660.4) h1 = mmIn * h;
  else if (h <= 1244.6) h1 = ec === "VCB" ? mmIn * h : eq1112(h); else h1 = ec === "VCB" ? 49 : eq1112(1244.6);
  const ees = (h1 + w1) / 2;
  const [b1, b2, b3] = N.IEEE1584.t7[`${tipo}|${ec}`];
  const x = b1 * ees * ees + b2 * ees + b3;
  return { cf: tipo === "Typical" ? x : 1 / x, tipo: tipo === "Typical" ? "Típico" : "Poco profundo", ees, w1, h1 };
}
export function arco1584({ ec = "VCB", voc, ibf, g, dist, h, w, d, tFull, tMin }) {
  const T = N.IEEE1584, V = voc, lv = V <= 0.6;
  const fuera = [];
  if (V < 0.208 || V > 15) fuera.push("tensión fuera de 0,208 a 15 kV");
  if (lv ? g < 6.35 || g > 76.2 : g < 19.05 || g > 254) fuera.push(`separación G fuera del rango (${lv ? "6,35 a 76,2" : "19,05 a 254"} mm)`);
  if (dist < 305) fuera.push("distancia de trabajo menor que 305 mm");
  if (lv ? ibf < 0.5 || ibf > 106 : ibf < 0.2 || ibf > 65) fuera.push(`corriente de falla fuera del rango (${lv ? "0,5 a 106" : "0,2 a 65"} kA)`);
  if (!(ec === "VOA" || ec === "HOA") && w < 4 * g) fuera.push("ancho del encerramiento menor que 4 G");
  const enc = cfEncerramiento(ec, V, h, w, d);
  const iInt = (v) => { const k = T.t1[`${ec}|${v}`]; return Math.pow(10, k[0] + k[1] * L10(ibf) + k[2] * L10(g)) * poli(k.slice(3), ibf); };
  const interp = (x6, x27, x143) => {
    const x1 = ((x27 - x6) / 2.1) * (V - 2.7) + x27, x2 = ((x143 - x27) / 11.6) * (V - 14.3) + x143, x3 = (x1 * (2.7 - V)) / 2.1 + (x2 * (V - 0.6)) / 2.1;
    return V <= 2.7 ? x3 : x2;
  };
  const finalBT = (i600) => 1 / Math.sqrt(Math.pow(0.6 / V, 2) * (1 / (i600 * i600) - (0.36 - V * V) / (0.36 * ibf * ibf)));
  const varCf = poli(T.t2[ec], V), red = 1 - 0.5 * varCf;
  const tabla = (v) => (v <= 0.6 ? T.t3 : v === 2.7 ? T.t4 : T.t5)[ec];
  const eInt = (v, ia, t, ia600) => {
    const k = tabla(v);
    const den = poli([k[3], k[4], k[5], k[6], k[7], k[8], k[9], 0], ibf);
    return (12.552 / 50) * t * Math.pow(10, k[0] + k[1] * L10(g) + (k[2] * (ia600 ?? ia)) / den + k[10] * L10(ibf) + k[12] * L10(ia) + L10(1 / enc.cf) + k[11] * L10(dist));
  };
  const afbDeE = (v, e) => { const k12 = tabla(v)[11]; return Math.pow(5.0208 / (e / Math.pow(dist, k12)), 1 / k12); };
  const caso = (reducido, t) => {
    if (lv) {
      const i600 = iInt(0.6), ia = finalBT(i600) * (reducido ? red : 1);
      const e = eInt(V, ia, t, i600);
      return { iarc: ia, e, afb: afbDeE(V, e) };
    }
    const i = [0.6, 2.7, 14.3].map((v) => iInt(v) * (reducido ? red : 1));
    const es = [0.6, 2.7, 14.3].map((v, k) => eInt(v, i[k], t));
    const afbs = [0.6, 2.7, 14.3].map((v, k) => afbDeE(v, es[k]));
    return { iarc: interp(...i), e: interp(...es), afb: interp(...afbs), intermedias: { i, es, afbs } };
  };
  const full = caso(false, tFull), min = caso(true, tMin ?? tFull);
  return { full, min, varCf, red, enc, fuera };
}

// Tiempo de despeje (ms) de una protección de la coordinación para una corriente de arco
// (kA en la tensión del punto): se refiere la corriente a la tensión de la coordinación,
// se suma la apertura del interruptor y se limita a 2 s (IEEE 1584-2018 §6.9.1).
export function tiempoArcoDesdeRele(rel, iarcKA, vPunto, vRef, aperturaMs) {
  const iRef = (iarcKA * 1000 * vPunto) / (Number.isFinite(vRef) && vRef > 0 ? vRef : vPunto);
  const t = tiempoRele(rel, iRef);
  if (!Number.isFinite(t)) return { ms: 2000, iRef, nota: "la protección no opera con esa corriente: se limita a 2 s (S)" };
  // Una curva por puntos (fusible o interruptor) ya es de despeje total: no se suma apertura.
  const ms = t * 1000 + (rel.curva === "PUNTOS" ? 0 : aperturaMs);
  return ms > 2000 ? { ms: 2000, iRef, nota: "tiempo mayor que 2 s: se limita a 2 s (S)" } : { ms, iRef, nota: "" };
}

export function arcoElectrico(e, proyecto = {}, ctx = {}) {
  const eppDisp = num(e.eppDisponible, 8), apertura = num(e.tApertura, 50);
  const reles = ctx.coordinacion?.reles || [], vRef = ctx.coordinacion?.tensionRef;
  const verificaciones = [], notasT = [];
  const filasT = filas(e.puntos).map((p) => {
    const eq = N.IEEE1584.equipos[p.equipo] || N.IEEE1584.equipos.swBT;
    const dato = (k, def) => { const x = num(p[k], NaN); return Number.isFinite(x) ? x : def; };
    const barra = (ctx.cortocircuito?.barras || []).find((b) => b.nombre.trim().toLowerCase() === String(p.punto || "").trim().toLowerCase());
    const ent = { ec: p.configuracion || "VCB", voc: dato("tension", 0.48), ibf: dato("ibf", barra ? barra.ik3 / 1000 : 25), deCorto: !Number.isFinite(num(p.ibf, NaN)) && !!barra };
    const geo = { ec: ent.ec, voc: ent.voc, ibf: ent.ibf, g: dato("gap", eq.G), dist: dato("distancia", eq.D), h: dato("alto", eq.h), w: dato("ancho", eq.w), d: dato("fondo", eq.d) };
    // Tiempos: digitados, o de la protección de la coordinación con el mismo nombre (con la
    // corriente de arco plena y la reducida), o 100 ms supuestos.
    const rel = reles.find((x) => String(x.nombre || "").trim().toLowerCase() === String(p.proteccion || "").trim().toLowerCase() && p.proteccion);
    let tFull = dato("tiempo", NaN), tMin = dato("tiempoMin", NaN);
    ent.origenT = "digitado";
    if (!Number.isFinite(tFull) && rel) {
      const pre = arco1584({ ...geo, tFull: 1, tMin: 1 });
      const a = tiempoArcoDesdeRele(rel, pre.full.iarc, ent.voc, vRef, apertura), b = tiempoArcoDesdeRele(rel, pre.min.iarc, ent.voc, vRef, apertura);
      tFull = a.ms; if (!Number.isFinite(tMin)) tMin = b.ms;
      ent.origenT = `curva de «${rel.nombre}»`;
      notasT.push(`${p.punto || eq.nombre}: tiempos de «${rel.nombre}» con ${fmt(a.iRef, 0)} A y ${fmt(b.iRef, 0)} A referidos a ${fmt(Number.isFinite(vRef) ? vRef : ent.voc, 2)} kV, ${rel.curva === "PUNTOS" ? "curva de despeje total (sin apertura adicional)" : `más ${fmt(apertura, 0)} ms de apertura`}${[a.nota, b.nota].filter(Boolean).length ? ` — ${[...new Set([a.nota, b.nota].filter(Boolean))].join("; ")}` : ""}.`);
      if (!Number.isFinite(vRef)) notasT.push("(S) La coordinación no indica a qué tensión están referidas sus corrientes: se supuso la tensión de cada punto.");
    } else if (!Number.isFinite(tFull)) {
      tFull = 100; ent.origenT = "supuesto";
      notasT.push(`(S) ${p.punto || eq.nombre}: sin tiempo digitado ni protección de la coordinación; se supusieron 100 ms.`);
    }
    if (!Number.isFinite(tMin)) tMin = tFull;
    ent.t = tFull; ent.tm = tMin;
    const r = arco1584({ ...geo, tFull, tMin });
    // Fuera de 0,208 a 15 kV el modelo extrapola sin sentido: no se reportan valores.
    if (ent.voc < 0.208 || ent.voc > 15) [r.full, r.min].forEach((c) => { c.iarc = c.e = c.afb = NaN; });
    const eCal = Math.max(r.full.e, r.min.e) / 4.184, afb = r.full.e >= r.min.e ? r.full.afb : r.min.afb;
    const cat = N.CATEGORIAS_EPP.find(([lim]) => eCal <= lim);
    const nombre = p.punto || eq.nombre;
    if (r.fuera.length) verificaciones.push({ criterio: `${nombre}: dentro del rango de validez del modelo`, norma: "IEEE 1584-2018 §4.2", valor: r.fuera.join("; "), limite: "Dentro del rango", cumple: false });
    verificaciones.push({ criterio: `${nombre}: energía incidente frente al EPP disponible`, norma: "NFPA 70E 130.5; RETIE 2024 art. 3.10.5", valor: `${fmt(eCal, 2)} cal/cm²`, limite: `≤ ${fmt(eppDisp, 1)} cal/cm²`, cumple: eCal <= eppDisp });
    verificaciones.push({ criterio: `${nombre}: energía incidente menor que 40 cal/cm²`, norma: "NFPA 70E (por encima no hay EPP normalizado: trabajar desenergizado)", valor: `${fmt(eCal, 2)} cal/cm²`, limite: "≤ 40 cal/cm²", cumple: eCal <= 40 });
    const catCorta = Number.isNaN(eCal) ? "Fuera del modelo" : !cat ? "No trabajar energizado (> 40 cal/cm²)" : cat[0] <= 1.2 ? "Sin requisito" : cat[1].replace(/ \(.*\)$/, "");
    return { nombre, r, eCal, afb, catCorta, cat: Number.isNaN(eCal) ? "Fuera del modelo IEEE 1584 (0,208 a 15 kV): use otro método" : cat ? cat[1] : "Mayor que 40 cal/cm²: no trabajar energizado", eq, p, ent };
  });
  const peor = filasT.reduce((m, f) => (f.eCal > (m?.eCal ?? -1) ? f : m), null);
  return {
    resumen: peor ? [
      { etiqueta: "Mayor energía incidente", valor: fmt(peor.eCal, 2), unidad: "cal/cm²" },
      { etiqueta: "En", valor: peor.nombre, unidad: "" },
      { etiqueta: "Frontera de arco", valor: fmt(peor.afb / 1000, 2), unidad: "m" }
    ] : [],
    tablas: [
      { titulo: "Energía incidente y frontera de arco por punto (IEEE 1584-2018)", encabezados: ["Punto", "Voc (kV)", "Ibf (kA)", "Iarc (kA)", "Iarc red. (kA)", "E (cal/cm²)", "Frontera (m)", "EPP mínimo"], filas: filasT.map((f) => [f.nombre, fmt(f.ent.voc, f.ent.voc < 1 ? 3 : 1), fmt(f.ent.ibf, 1) + (f.ent.deCorto ? " (S)" : ""), fmt(f.r.full.iarc, 2), fmt(f.r.min.iarc, 2), fmt(f.eCal, 2), fmt(f.afb / 1000, 2), f.catCorta]) },
      { titulo: "Detalle del cálculo por punto", encabezados: ["Punto", "Electrodos", "Encerramiento (EES, tipo)", "CF", "VarCf / factor", "t plena / reducida (ms)", "E plena (J/cm²)", "E reducida (J/cm²)", "Gobierna"], filas: filasT.map((f) => [f.nombre, f.ent.ec, f.r.enc.ees ? `${fmt(f.r.enc.ees, 2)} pulg., ${f.r.enc.tipo}` : f.r.enc.tipo, fmt(f.r.enc.cf, 3), `${fmt(f.r.varCf, 3)} / ${fmt(f.r.red, 3)}`, `${fmt(f.ent.t, 0)} / ${fmt(f.ent.tm, 0)} (${f.ent.origenT})`, fmt(f.r.full.e, 2), fmt(f.r.min.e, 2), f.r.full.e >= f.r.min.e ? "Corriente plena" : "Corriente reducida"]) }
    ],
    pasos: [
      { titulo: "Corriente de arco intermedia", formula: "Iarc,Voc = 10^(k1 + k2 lg Ibf + k3 lg G) × (k4 Ibf⁶ + … + k9 Ibf + k10)", sustitucion: "Tabla 1 de la IEEE 1584-2018 a 600, 2700 y 14 300 V", resultado: "Por punto" },
      { titulo: "Corriente de arco final", formula: "Voc > 600 V: interpolación entre 600, 2700 y 14 300 V; Voc ≤ 600 V: ecuación 25", sustitucion: "IEEE 1584-2018 ecuaciones 16 a 25", resultado: "Por punto" },
      { titulo: "Corriente de arco reducida", formula: "Iarc,mín = Iarc × (1 − 0,5 VarCf)", sustitucion: "VarCf de la Tabla 2 (ecuación 2); se evalúa con el tiempo de despeje a esa corriente", resultado: "Por punto" },
      { titulo: "Factor de tamaño del encerramiento", formula: "EES = (alto₁ + ancho₁) / 2; CF = b1 EES² + b2 EES + b3 (típico) o su inverso (poco profundo)", sustitucion: "Tablas 6 y 7, ecuaciones 11 a 15", resultado: "Por punto" },
      { titulo: "Energía incidente", formula: "E = 12,552/50 × T × 10^(k1 + k2 lg G + k3 Iarc / f(Ibf) + k11 lg Ibf + k12 lg D + k13 lg Iarc + lg(1/CF))", sustitucion: "Tablas 3 a 5; se toma la mayor entre corriente plena y reducida", resultado: "Por punto" },
      { titulo: "Frontera de arco", formula: "Distancia a la que la energía incidente es 1,2 cal/cm² (5,0 J/cm²)", sustitucion: "Misma ecuación de energía despejada para D", resultado: "Por punto" }
    ],
    verificaciones,
    notas: [...notasT, ...(filasT.some((f) => f.eCal >= 1.2) ? [`Aviso obligatorio (RETIE 2024 Libro 3, art. 3.10.5 d): en ${filasT.filter((f) => f.eCal >= 1.2).map((f) => `«${f.nombre}»`).join(", ")} la energía incidente es igual o mayor que 5 J/cm² (1,2 cal/cm²); allí se debe fijar un aviso con la frontera de arco eléctrico, los datos de este riesgo y la leyenda «riesgo de arco eléctrico».`] : []), ...(filasT.some((f) => f.ent.deCorto) ? ["(S) Ibf tomada del cálculo de cortocircuito del proyecto (barra con el mismo nombre del punto)."] : []), "El tiempo de arco es el tiempo de despeje de la protección aguas arriba a la corriente de arco (tome los tiempos de la coordinación de protecciones). Con la corriente reducida el tiempo suele ser mayor.", "Cada equipo debe rotularse con la energía incidente, la frontera de arco y el EPP requerido."],
    conclusion: peor ? veredicto(verificaciones, `La mayor energía incidente es ${fmt(peor.eCal, 2)} cal/cm² en «${peor.nombre}» (${peor.cat}).`, "Hay puntos con energía incidente por encima del EPP disponible o fuera del rango del modelo: reduzca el tiempo de despeje o trabaje desenergizado.") : filasT.length ? "Ningún punto está dentro del rango de tensión del modelo IEEE 1584 (0,208 a 15 kV): use otro método." : "Agregue los puntos a evaluar."
  };
}

// ================================================================ 21. CAMPOS ELECTROMAGNÉTICOS (RETIE)
// Campo eléctrico por simulación de cargas con imágenes (coeficientes de potencial de Maxwell)
// y campo magnético por Biot-Savart sin imágenes (la profundidad de retorno por tierra a 60 Hz
// es de cientos de metros), para conductores rectos e infinitos a la altura de la flecha.
const EPS0 = 8.854187817e-12, MU0 = 4e-7 * Math.PI;
function resolverLineal(A, b) {
  const n = b.length, M = A.map((f, i) => [...f, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    [M[k], M[p]] = [M[p], M[k]];
    for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}
// Radio equivalente de un haz de n subconductores de diámetro d (mm) con separación s (mm).
export const radioEquivalente = (dmm, n = 1, smm = 0) => { const r = dmm / 2000; if (n <= 1) return r; const R = smm / 1000 / (2 * Math.sin(Math.PI / n)); return Math.pow(n * r * Math.pow(R, n - 1), 1 / n); };
export function camposPerfil(conds, puntos, yp = 1) {
  const n = conds.length;
  const P = conds.map((a, i) => conds.map((b, j) => (i === j ? Math.log((2 * a.y) / a.req) : Math.log(Math.hypot(a.x - b.x, a.y + b.y) / Math.hypot(a.x - b.x, a.y - b.y))) / (2 * Math.PI * EPS0)));
  const vre = conds.map((c) => c.v * Math.cos(c.ang)), vim = conds.map((c) => c.v * Math.sin(c.ang));
  const qre = resolverLineal(P, vre), qim = resolverLineal(P, vim);
  const k = 1 / (2 * Math.PI * EPS0);
  return { P, qre, qim, perfil: puntos.map((xp) => {
    let exr = 0, exi = 0, eyr = 0, eyi = 0, bxr = 0, bxi = 0, byr = 0, byi = 0;
    conds.forEach((c, i) => {
      const dx = xp - c.x, d1 = dx * dx + (yp - c.y) ** 2, d2 = dx * dx + (yp + c.y) ** 2;
      const fx = k * (dx / d1 - dx / d2), fy = k * ((yp - c.y) / d1 - (yp + c.y) / d2);
      exr += qre[i] * fx; exi += qim[i] * fx; eyr += qre[i] * fy; eyi += qim[i] * fy;
      const g = MU0 / (2 * Math.PI * d1), ir = c.i * Math.cos(c.ang), ii = c.i * Math.sin(c.ang);
      bxr += -ir * (yp - c.y) * g; bxi += -ii * (yp - c.y) * g; byr += ir * dx * g; byi += ii * dx * g;
    });
    return { x: xp, E: Math.sqrt(exr ** 2 + exi ** 2 + eyr ** 2 + eyi ** 2) / 1000, B: Math.sqrt(bxr ** 2 + bxi ** 2 + byr ** 2 + byi ** 2) * 1e6 };
  }) };
}
export function puntosPerfil(desde, hasta, paso, borde) {
  const s = new Set();
  for (let x = desde; x <= hasta + 1e-9; x += paso) s.add(Math.round(x * 1000) / 1000);
  if (borde > 0) { s.add(-borde); s.add(borde); }
  return [...s].sort((a, b) => a - b);
}
export function camposEM(e) {
  const yp = num(e.alturaMedida, 1), anchoServ = num(e.servidumbre, 0), borde = anchoServ / 2;
  const lim = { eP: num(e.ePublico, 4.16), bP: num(e.bPublico, 200), eO: num(e.eOcupacional, 8.3), bO: num(e.bOcupacional, 1000) };
  const conds = filas(e.conductores).map((c) => ({ nombre: c.conductor || "", x: num(c.x, 0), y: num(c.y, 10), req: radioEquivalente(num(c.diametro, 20), num(c.subconductores, 1), num(c.separacion, 0)), v: (num(c.tension, 0) * 1000) / Math.sqrt(3), ang: (num(c.angulo, 0) * Math.PI) / 180, i: num(c.corriente, 0), d: num(c.diametro, 20) })).filter((c) => c.y > 0);
  if (!conds.length) return { resumen: [], tablas: [], pasos: [], verificaciones: [], conclusion: "Agregue los conductores." };
  const pts = puntosPerfil(num(e.xDesde, -30), num(e.xHasta, 30), Math.max(0.1, num(e.paso, 1)), borde);
  const { perfil } = camposPerfil(conds, pts, yp);
  const maxDe = (f, filtro = () => true) => perfil.filter(filtro).reduce((m, p) => (p[f] > (m?.[f] ?? -1) ? p : m), null);
  const eMax = maxDe("E"), bMax = maxDe("B");
  const dentro = (p) => borde <= 0 || Math.abs(p.x) <= borde + 1e-9, enBorde = (p) => borde > 0 && Math.abs(Math.abs(p.x) - borde) < 1e-6, fuera = (p) => borde <= 0 || Math.abs(p.x) >= borde - 1e-9;
  const eDentro = maxDe("E", dentro), bDentro = maxDe("B", dentro), eFuera = maxDe("E", fuera), bFuera = maxDe("B", fuera);
  const verificaciones = [];
  if (borde > 0) {
    verificaciones.push({ criterio: "Campo eléctrico dentro de la servidumbre (exposición ocupacional)", norma: "RETIE 2024 art. 3.11.1, Tabla 3.11.1.a", valor: `${fmt(eDentro.E, 2)} kV/m`, limite: `≤ ${fmt(lim.eO, 2)} kV/m`, cumple: eDentro.E <= lim.eO });
    verificaciones.push({ criterio: "Densidad de flujo magnético dentro de la servidumbre (exposición ocupacional)", norma: "RETIE 2024 art. 3.11.1, Tabla 3.11.1.a", valor: `${fmt(bDentro.B, 1)} µT`, limite: `≤ ${fmt(lim.bO, 0)} µT`, cumple: bDentro.B <= lim.bO });
  }
  verificaciones.push({ criterio: borde > 0 ? "Campo eléctrico desde el borde de la servidumbre hacia afuera (público)" : "Campo eléctrico en todo el perfil (público)", norma: "RETIE 2024 art. 3.11.1, Tabla 3.11.1.a", valor: `${fmt(eFuera.E, 2)} kV/m`, limite: `≤ ${fmt(lim.eP, 2)} kV/m`, cumple: eFuera.E <= lim.eP });
  verificaciones.push({ criterio: borde > 0 ? "Densidad de flujo magnético desde el borde de la servidumbre hacia afuera (público)" : "Densidad de flujo magnético en todo el perfil (público)", norma: "RETIE 2024 art. 3.11.1, Tabla 3.11.1.a", valor: `${fmt(bFuera.B, 1)} µT`, limite: `≤ ${fmt(lim.bP, 0)} µT`, cumple: bFuera.B <= lim.bP });
  const z200 = perfil.filter((p) => p.B > 200), z1000 = perfil.filter((p) => p.B > 1000);
  const rango = (z) => `de ${fmt(Math.min(...z.map((p) => p.x)), 1)} a ${fmt(Math.max(...z.map((p) => p.x)), 1)} m del eje`;
  const zonas = [...(z200.length ? [`Zona con más de 200 µT (${rango(z200)}): debe señalarse en el plano (RETIE 2024 art. 3.11.1).`] : []), ...(z1000.length ? [`Zona con más de 1000 µT (${rango(z1000)}): acceso restringido (RETIE 2024 art. 3.11.1).`] : [])];
  const muestra = perfil.filter((p, i) => enBorde(p) || i % Math.max(1, Math.round(perfil.length / 25)) === 0 || p === eMax || p === bMax);
  return {
    resumen: [
      { etiqueta: "Campo eléctrico máximo", valor: fmt(eMax.E, 2), unidad: "kV/m" },
      { etiqueta: "Densidad de flujo magnético máxima", valor: fmt(bMax.B, 1), unidad: "µT" },
      ...(borde > 0 ? [{ etiqueta: "En el borde de la servidumbre (E / B)", valor: `${fmt(maxDe("E", enBorde).E, 2)} / ${fmt(maxDe("B", enBorde).B, 1)}`, unidad: "kV/m / µT" }] : [])
    ],
    tablas: [
      { titulo: "Conductores", encabezados: ["Conductor", "x (m)", "Altura (m)", "Radio equivalente (mm)", "Tensión fase-tierra (kV)", "Ángulo (°)", "Corriente (A)"], filas: conds.map((c) => [c.nombre, fmt(c.x, 2), fmt(c.y, 2), fmt(c.req * 1000, 2), fmt(c.v / 1000, 2), fmt((c.ang * 180) / Math.PI, 0), fmt(c.i, 0)]) },
      { titulo: `Perfil lateral a ${fmt(yp, 2)} m sobre el suelo`, encabezados: ["Distancia al eje (m)", "E (kV/m)", "B (µT)", "Zona"], filas: muestra.map((p) => [fmt(p.x, 1), fmt(p.E, 3), fmt(p.B, 2), borde > 0 ? (enBorde(p) ? "Borde de la servidumbre" : dentro(p) ? "Servidumbre" : "Público") : "—"]) }
    ],
    pasos: [
      { titulo: "Cargas de los conductores", formula: "[q] = [P]⁻¹ [V]; Pii = ln(2 hi / req) / (2π ε0); Pij = ln(D'ij / Dij) / (2π ε0)", sustitucion: "Coeficientes de potencial de Maxwell con imágenes en el suelo; haces con radio equivalente req = (n r R^(n−1))^(1/n); cables de guarda a potencial cero", resultado: `${conds.length} conductores` },
      { titulo: "Campo eléctrico", formula: "E = Σ qi / (2π ε0) × (r − ri) / |r − ri|² − (r − ri') / |r − ri'|² (con la imagen ri')", sustitucion: `Componentes horizontal y vertical como fasores; E = √(|Ex|² + |Ey|²) a ${fmt(yp, 2)} m`, resultado: `Máximo ${fmt(eMax.E, 2)} kV/m en x = ${fmt(eMax.x, 1)} m` },
      { titulo: "Densidad de flujo magnético", formula: "B = Σ μ0 Ii / (2π |r − ri|) (Biot-Savart, sin imágenes)", sustitucion: "Corrientes de fase como fasores; la corriente inducida en los cables de guarda se desprecia", resultado: `Máximo ${fmt(bMax.B, 1)} µT en x = ${fmt(bMax.x, 1)} m` }
    ],
    verificaciones,
    notas: ["Límites del RETIE 2024 (Res. 40117, mod. Res. 40284 de 2026; Libro 3, art. 3.11.1, Tabla 3.11.1.a), calculados a 1 m sobre el suelo: público 4,16 kV/m y 200 µT; ocupacional (8 h) 8,3 kV/m y 1000 µT.", ...zonas, "RETIE 2024 3.3.3.2: en líneas de transmisión de 57,5 kV o más se verifica en el límite de la servidumbre; en edificaciones a menos de 15 m de partes de más de 100 kV, o a menos de 3 m de una servidumbre o de una subestación de más de 100 kV, se calculan los campos en fachadas, balcones, azoteas, ventanas y pisos más cercanos (agregue esos puntos con su altura); en proyectos con circuitos, acometidas o ramales de 1000 A o más se calcula donde haya permanencia prolongada o circulación del público, con los límites del público.", "La altura de los conductores es la del punto más bajo de la catenaria (caso más desfavorable). Para subestaciones, modele los barrajes como conductores."],
    conclusion: veredicto(verificaciones, `Los campos cumplen los límites de exposición: máximo ${fmt(eMax.E, 2)} kV/m y ${fmt(bMax.B, 1)} µT.`, "Hay puntos del perfil que superan los límites de exposición: aumente la altura o la servidumbre, o cambie la disposición de las fases.")
  };
}

// ================================================================ 22. CÁLCULO ECONÓMICO DE CONDUCTORES (IEC 60287-3-2)
// CT = CI + I²max × RL × L × F; F = Np × Nc × (T × P + D) × Q / (1 + i/100);
// Q = Σ r^(n−1) = (1 − r^N)/(1 − r); r = (1 + a/100)² (1 + b/100)(1 + c/100)/(1 + i/100).
// RL a la temperatura (θ − θa)/3 + θa (IEC 60287-3-2 §4), a partir de la resistencia AC a 75 °C de
// la NTC 2050 Cap. 9 Tabla 9 (tubo de PVC).
export function factorEconomico({ np = 3, nc = 1, T, P, D = 0, N, a = 0, b = 0, c = 0, i }) {
  const r = (Math.pow(1 + a / 100, 2) * (1 + b / 100) * (1 + c / 100)) / (1 + i / 100);
  const Q = Math.abs(r - 1) < 1e-12 ? N : (1 - Math.pow(r, N)) / (1 - r);
  return { r, Q, F: (np * nc * (T * P + D) * Q) / (1 + i / 100) };
}
export function conductorEconomico(e) {
  const mat = e.material === "Al" ? "Al" : "Cu", imax = num(e.imax, 150), L = num(e.longitud, 100);
  const tmax = num(e.tempMax, 75), ta = num(e.tempAmb, 30), tm = (tmax - ta) / 3 + ta, k0 = mat === "Cu" ? 234.5 : 228;
  const mu = num(e.factorPerdidas, 0.5), T = mu * 8760;
  const P = num(e.precioEnergia, 900) / 1000, D = num(e.cargoDemanda, 0) / 1000; // COP/Wh y COP/(W·año)
  const ef = factorEconomico({ np: num(e.np, 3), nc: num(e.nc, 1), T, P, D, N: num(e.vida, 25), a: num(e.crecimientoCarga, 1), b: num(e.crecimientoPrecio, 0), c: num(e.crecimientoPerdidas, 0), i: num(e.descuento, 8) });
  const col = tmax >= 90 ? 2 : tmax >= 75 ? 1 : 0;
  const cand = filas(e.candidatos).map((f) => {
    const cal = String(f.calibre), t9 = N.TABLA9[cal], S = N.SECCION_MM2[cal] || 0;
    const r75 = t9 ? t9[mat === "Cu" ? 2 : 4] : NaN, RL = (r75 * (k0 + tm)) / (k0 + 75) / 1000; // Ω/m
    const CI = num(f.costo, 0) * L, CJ = imax * imax * RL * L * ef.F;
    const amp = (N.AMPACIDAD[mat][cal] || [])[col] ?? NaN;
    return { cal, S, RL, CI, CJ, CT: CI + CJ, amp, adm: amp >= imax };
  }).filter((c) => c.S > 0 && Number.isFinite(c.RL)).sort((p, q) => p.S - q.S);
  // Rango económico de corriente de cada calibre (IEC 60287-3-2 ec. 12 y 13).
  cand.forEach((c, k) => {
    const lim = (o) => (o ? Math.sqrt(Math.abs(c.CI - o.CI) / (ef.F * L * Math.abs(o.RL - c.RL))) : NaN);
    c.iInf = k > 0 ? lim(cand[k - 1]) : 0; c.iSup = k < cand.length - 1 ? lim(cand[k + 1]) : Infinity;
  });
  const adm = cand.filter((c) => c.adm);
  const eco = adm.reduce((m, c) => (c.CT < (m?.CT ?? Infinity) ? c : m), null), tec = adm[0];
  const verificaciones = [];
  const prop = String(e.calibreDiseno || "");
  const cp = cand.find((c) => c.cal === prop);
  const enRango = cp && imax >= cp.iInf - 1e-9 && imax <= cp.iSup + 1e-9;
  const notaDiseno = cp ? [enRango ? `El calibre de diseño ${N.etiquetaCalibre(prop)} está en su rango económico de corriente (${fmt(cp.iInf, 0)} a ${Number.isFinite(cp.iSup) ? fmt(cp.iSup, 0) : "∞"} A).` : `El calibre de diseño ${N.etiquetaCalibre(prop)} no es el económico: su rango económico es ${fmt(cp.iInf, 0)} a ${Number.isFinite(cp.iSup) ? fmt(cp.iSup, 0) : "∞"} A y la corriente es ${fmt(imax, 0)} A; con ${eco ? N.etiquetaCalibre(eco.cal) : "otro calibre"} el costo total en la vida útil baja ${eco ? fmt((cp.CT - eco.CT) / 1e6, 2) : "—"} millones (recomendación, no requisito del RETIE).`] : [];
  if (cp) verificaciones.push({ criterio: `Calibre de diseño ${N.etiquetaCalibre(prop)} con capacidad de corriente suficiente`, norma: "NTC 2050 Tabla 310.15(B)(16)", valor: `${fmt(imax, 0)} A`, limite: `≤ ${fmt(cp.amp, 0)} A`, cumple: cp.adm });
  return {
    resumen: eco ? [
      { etiqueta: "Calibre económico", valor: N.etiquetaCalibre(eco.cal), unidad: "" },
      { etiqueta: "Costo total en la vida útil", valor: fmt(eco.CT / 1e6, 2), unidad: "millones" },
      ...(tec && tec !== eco ? [{ etiqueta: "Ahorro frente al calibre mínimo técnico", valor: fmt((tec.CT - eco.CT) / 1e6, 2), unidad: "millones" }] : [])
    ] : [],
    tablas: [{ titulo: "Costo total por calibre (valor presente)", encabezados: ["Calibre", "S (mm²)", `RL a ${fmt(tm, 1)} °C (Ω/km)`, "Capacidad (A)", "CI (millones)", "CJ (millones)", "CT (millones)", "Rango económico (A)"], filas: cand.map((c) => [N.etiquetaCalibre(c.cal) + (c === eco ? " ★" : ""), fmt(c.S, 1), fmt(c.RL * 1000, 4), `${fmt(c.amp, 0)}${c.adm ? "" : " (insuficiente)"}`, fmt(c.CI / 1e6, 2), fmt(c.CJ / 1e6, 2), fmt(c.CT / 1e6, 2), `${fmt(c.iInf, 0)} a ${Number.isFinite(c.iSup) ? fmt(c.iSup, 0) : "∞"}`]) }],
    pasos: [
      { titulo: "Factor económico", formula: "F = Np × Nc × (T × P + D) × Q / (1 + i/100); Q = (1 − r^N)/(1 − r); r = (1 + a/100)² (1 + b/100)(1 + c/100)/(1 + i/100)", sustitucion: `T = ${fmt(mu, 2)} × 8760 = ${fmt(T, 0)} h/año; P = ${fmt(P * 1000, 1)} $/kWh; N = ${fmt(num(e.vida, 25), 0)} años; i = ${fmt(num(e.descuento, 8), 1)} %; r = ${fmt(ef.r, 5)}; Q = ${fmt(ef.Q, 3)}`, resultado: `F = ${fmt(ef.F, 2)} $/W` },
      { titulo: "Resistencia de operación", formula: "RL a θm = (θ − θa)/3 + θa; RL(θm) = R75 × (k + θm)/(k + 75)", sustitucion: `θ = ${fmt(tmax, 0)} °C; θa = ${fmt(ta, 0)} °C; k = ${k0} (${mat})`, resultado: `θm = ${fmt(tm, 1)} °C` },
      { titulo: "Costo total por calibre", formula: "CT = CI + I²max × RL × L × F", sustitucion: `Imax = ${fmt(imax, 0)} A; L = ${fmt(L, 0)} m`, resultado: eco ? `Mínimo: ${N.etiquetaCalibre(eco.cal)}` : "Sin calibres con capacidad suficiente" },
      { titulo: "Rango económico de corriente", formula: "I = √((CI − CI1) / (F × L × (RL1 − RL)))", sustitucion: "Límite inferior con el calibre menor y superior con el mayor (IEC 60287-3-2 ec. 12 y 13)", resultado: "Por calibre" }
    ],
    verificaciones,
    notas: [...notaDiseno, "Los costos instalados por metro de circuito son datos del proyecto (cotizaciones de conductor, canalización y mano de obra); los valores de ejemplo son ilustrativos.", "El calibre económico suele ser mayor que el mínimo por capacidad de corriente: la inversión adicional se recupera con menores pérdidas durante la vida útil."],
    conclusion: eco ? (verificaciones.length ? veredicto(verificaciones, `El calibre de menor costo total en la vida útil es ${N.etiquetaCalibre(eco.cal)} (${fmt(eco.CT / 1e6, 2)} millones)${enRango ? "; el calibre de diseño está en su rango económico" : ""}.`, "El calibre de diseño no tiene capacidad de corriente suficiente.") : `El calibre de menor costo total en la vida útil es ${N.etiquetaCalibre(eco.cal)} (${fmt(eco.CT / 1e6, 2)} millones).`) : "Ningún calibre candidato tiene capacidad de corriente suficiente."
  };
}

// ================================================================ 23. ARMÓNICOS Y FACTOR K (IEEE 519 / IEEE C57.110)
// Corrientes armónicas de cada grupo de carga sumadas en forma aritmética por orden (conservador);
// THDi, TDD, distorsión de tensión estimada en el PCC (Vh % = 100 × h × Ih / Isc), factor K
// (UL 1561), factor de pérdidas armónicas FHL y reducción de capacidad del transformador
// (IEEE C57.110), y corriente en el neutro por armónicos triples de cargas monofásicas.
export function espectroGrupo(g) {
  const base = g.espectro === "personalizado" ? Object.fromEntries(N.puntosCurva(String(g.personalizado || "").replace(/%/g, ""))) : (N.ESPECTROS[g.espectro] || N.ESPECTROS.lineal).h;
  return Object.fromEntries(N.ORDENES_ARMONICOS.map((h) => [h, num(base[h], 0)]));
}
export function limitesIEEE519(iscIl, kv) {
  const c = N.IEEE519_CORRIENTE.find(([hasta]) => iscIl < hasta) || N.IEEE519_CORRIENTE.at(-1);
  const v = N.IEEE519_TENSION.find(([hasta]) => kv <= hasta) || N.IEEE519_TENSION.at(-1);
  const ind = (h) => (h < 11 ? c[1] : h < 17 ? c[2] : h < 23 ? c[3] : h < 35 ? c[4] : c[5]);
  return { ind, tdd: c[6], vInd: v[1], thdv: v[2] };
}
export function armonicos(e, proyecto = {}, ctx = {}) {
  const V = num(e.tension, ctx.transformador?.vs ?? 208);
  const grupos = filas(e.grupos).map((g) => ({ nombre: g.grupo || "", I1: num(g.corriente, 0), mono: g.monofasica === "Sí", esp: espectroGrupo(g), tipo: (N.ESPECTROS[g.espectro] || N.ESPECTROS.lineal).nombre })).filter((g) => g.I1 > 0);
  if (!grupos.length) return { resumen: [], tablas: [], pasos: [], verificaciones: [], conclusion: "Agregue los grupos de carga." };
  const I1 = grupos.reduce((s, g) => s + g.I1, 0);
  const Ih = Object.fromEntries(N.ORDENES_ARMONICOS.map((h) => [h, grupos.reduce((s, g) => s + (g.I1 * g.esp[h]) / 100, 0)]));
  const sumH2 = N.ORDENES_ARMONICOS.reduce((s, h) => s + Ih[h] ** 2, 0);
  const Irms = Math.sqrt(I1 * I1 + sumH2), thdi = (Math.sqrt(sumH2) / I1) * 100;
  const IL = num(e.corrienteDemanda, NaN) > 0 ? num(e.corrienteDemanda) : I1;
  const iscKA = num(e.isc, NaN) > 0 ? num(e.isc) : (ctx.cortocircuito?.barras?.[0]?.ik3 ?? NaN) / 1000;
  const Isc = iscKA * 1000, ratio = Isc / IL, tdd = (Math.sqrt(sumH2) / IL) * 100;
  const lim = limitesIEEE519(Number.isFinite(ratio) ? ratio : 0, V / 1000);
  const vh = Object.fromEntries(N.ORDENES_ARMONICOS.map((h) => [h, Number.isFinite(Isc) ? (100 * h * Ih[h]) / Isc : NaN]));
  const thdv = Math.sqrt(N.ORDENES_ARMONICOS.reduce((s, h) => s + (vh[h] || 0) ** 2, 0));
  const sumH2h2 = N.ORDENES_ARMONICOS.reduce((s, h) => s + (Ih[h] * h) ** 2, 0);
  const K = (I1 * I1 + sumH2h2) / (Irms * Irms), FHL = K; // con todas las corrientes, K (UL 1561) = FHL (IEEE C57.110)
  const sn = num(e.snTrafo, ctx.transformador?.sn ?? NaN), pec = num(e.pec, 8) / 100;
  const iR = (sn * 1000) / (Math.sqrt(3) * V), fRed = Math.sqrt((1 + pec) / (1 + FHL * pec));
  const triples = [3, 9, 15, 21];
  const In = 3 * Math.sqrt(triples.reduce((s, h) => s + grupos.filter((g) => g.mono).reduce((t, g) => t + (g.I1 * g.esp[h]) / 100, 0) ** 2, 0));
  // RETIE 2024 3.3.3.6: con THDi ≥ 15 % los conductores se dimensionan con el factor de la
  // IEC 60364-5-52 Anexo E (Tabla E.52.1), según el contenido de tercer armónico de la fase.
  const h3 = (grupos.filter((g) => g.mono).reduce((t, g) => t + (g.I1 * g.esp[3]) / 100, 0) / I1) * 100;
  const e52 = N.factorArmonicosIEC(h3);
  const iDim = (e52.base === "neutro" ? In : Irms) / e52.f;
  const ampac = num(e.ampacidad, NaN);
  const verificaciones = [];
  if (thdi >= 15 && ampac > 0) verificaciones.push({ criterio: `Ampacidad del conductor con armónicos (THDi ${fmt(thdi, 1)} % ≥ 15 %)`, norma: "RETIE 2024 Libro 3, 3.3.3.6; IEC 60364-5-52 Anexo E, Tabla E.52.1", valor: `${fmt(ampac, 0)} A`, limite: `≥ ${fmt(iDim, 0)} A`, cumple: ampac >= iDim - 1e-9 });
  if (Number.isFinite(ratio)) {
    verificaciones.push({ criterio: "Distorsión total de demanda de corriente TDD en el PCC", norma: `IEEE 519-2014 Tabla 2 (ISC/IL = ${fmt(ratio, 0)})`, valor: `${fmt(tdd, 1)} %`, limite: `≤ ${fmt(lim.tdd, 1)} %`, cumple: tdd <= lim.tdd + 1e-9 });
    const peorH = N.ORDENES_ARMONICOS.reduce((m, h) => { const p = (Ih[h] / IL) * 100 / lim.ind(h); return p > m.p ? { h, p } : m; }, { h: 0, p: -1 });
    if (peorH.h) verificaciones.push({ criterio: `Armónico individual de corriente más exigido (orden ${peorH.h})`, norma: "IEEE 519-2014 Tabla 2", valor: `${fmt((Ih[peorH.h] / IL) * 100, 2)} %`, limite: `≤ ${fmt(lim.ind(peorH.h), 1)} %`, cumple: peorH.p <= 1 + 1e-9 });
    verificaciones.push({ criterio: "Distorsión armónica total de tensión THDv estimada en el PCC", norma: "IEEE 519-2014 Tabla 1", valor: `${fmt(thdv, 2)} %`, limite: `≤ ${fmt(lim.thdv, 1)} %`, cumple: thdv <= lim.thdv });
  }
  if (Number.isFinite(iR) && iR > 0) verificaciones.push({ criterio: "Corriente de la carga frente a la capacidad reducida del transformador por armónicos", norma: `IEEE C57.110 (FHL = ${fmt(FHL, 2)}, PEC-R = ${fmt(pec * 100, 0)} %)`, valor: `${fmt(Irms, 0)} A`, limite: `≤ ${fmt(fRed * iR, 0)} A (${fmt(fRed * 100, 1)} % de ${fmt(iR, 0)} A)`, cumple: Irms <= fRed * iR });
  const H = N.ORDENES_ARMONICOS;
  return {
    resumen: [
      { etiqueta: "THD de corriente", valor: fmt(thdi, 1), unidad: "%" },
      { etiqueta: "Factor K", valor: fmt(K, 2), unidad: "" },
      ...(Number.isFinite(thdv) && thdv > 0 ? [{ etiqueta: "THDv estimada en el PCC", valor: fmt(thdv, 2), unidad: "%" }] : []),
      { etiqueta: "Corriente en el neutro por armónicos triples", valor: fmt(In, 0), unidad: "A" },
      ...(thdi >= 15 ? [{ etiqueta: "Corriente para dimensionar el conductor (IEC 60364-5-52 Anexo E)", valor: fmt(iDim, 0), unidad: "A" }] : [])
    ],
    tablas: [
      { titulo: "Grupos de carga", encabezados: ["Grupo", "Espectro", "I fundamental (A)", "Monofásica"], filas: grupos.map((g) => [g.nombre, g.tipo, fmt(g.I1, 1), g.mono ? "Sí" : "No"]) },
      { titulo: "Espectro total de corriente", encabezados: ["Orden h", "Ih (A)", "Ih / I1 (%)", "Ih / IL (%)", "Límite IEEE 519 (%)", "Vh estimada (%)"], filas: H.filter((h) => Ih[h] > 0).map((h) => [String(h), fmt(Ih[h], 2), fmt((Ih[h] / I1) * 100, 2), fmt((Ih[h] / IL) * 100, 2), Number.isFinite(ratio) ? fmt(lim.ind(h), 1) : "—", Number.isFinite(vh[h]) ? fmt(vh[h], 2) : "—"]) }
    ],
    pasos: [
      { titulo: "Distorsión de corriente", formula: "THDi = √(Σ Ih²) / I1; TDD = √(Σ Ih²) / IL", sustitucion: `I1 = ${fmt(I1, 1)} A; IL = ${fmt(IL, 1)} A (corriente de demanda); Irms = ${fmt(Irms, 1)} A`, resultado: `THDi = ${fmt(thdi, 1)} %; TDD = ${fmt(tdd, 1)} %` },
      { titulo: "Distorsión de tensión en el PCC", formula: "Vh % = 100 × h × Ih / Isc; THDv = √(Σ Vh²) (fuente inductiva, sin resonancias)", sustitucion: Number.isFinite(Isc) ? `Isc = ${fmt(iscKA, 2)} kA; ISC/IL = ${fmt(ratio, 0)}` : "Sin corriente de cortocircuito", resultado: Number.isFinite(thdv) ? `THDv = ${fmt(thdv, 2)} %` : "—" },
      { titulo: "Factor K y FHL", formula: "K = Σ (Ih / Irms)² h²; FHL = Σ (Ih/I1)² h² / Σ (Ih/I1)² (iguales con el espectro completo)", sustitucion: "UL 1561 / IEEE C57.110", resultado: `K = ${fmt(K, 2)}` },
      { titulo: "Capacidad del transformador con armónicos", formula: "Imax / IR = √((1 + PEC-R) / (1 + FHL × PEC-R))", sustitucion: Number.isFinite(iR) ? `Sn = ${fmt(sn, 0)} kVA; IR = ${fmt(iR, 0)} A; PEC-R = ${fmt(pec * 100, 0)} %` : "Sin transformador", resultado: `${fmt(fRed * 100, 1)} % de la capacidad nominal` },
      { titulo: "Corriente en el neutro", formula: "IN = 3 × √(Σ I²h triples de cargas monofásicas), h = 3, 9, 15, 21", sustitucion: "Cargas monofásicas equilibradas entre fases", resultado: `IN = ${fmt(In, 0)} A (${fmt((In / I1) * 100, 0)} % de la corriente de fase)` },
      { titulo: "Dimensionamiento de conductores con armónicos (RETIE 2024 3.3.3.6)", formula: "IEC 60364-5-52 Tabla E.52.1: h3 ≤ 15 %: Irms; 15 a 33 %: Irms / 0,86; 33 a 45 %: IN / 0,86; > 45 %: IN", sustitucion: `Tercer armónico de las cargas monofásicas = ${fmt(h3, 1)} % de la fase; THDi = ${fmt(thdi, 1)} %${thdi >= 15 ? " (≥ 15 %: el RETIE exige aplicar el factor)" : " (< 15 %: el RETIE no exige el factor)"}`, resultado: `Factor ${fmt(e52.f, 2)} sobre la corriente de ${e52.base}: ${fmt(iDim, 0)} A` }
    ],
    verificaciones,
    notas: [...(thdi >= 15 && !(ampac > 0) ? [`THDi ≥ 15 %: el RETIE 2024 (3.3.3.6) exige dimensionar los conductores o barras con el factor de la IEC 60364-5-52 Anexo E: corriente de dimensionamiento ${fmt(iDim, 0)} A. Digite la ampacidad del conductor previsto para verificarlo.`] : []), `Con armónicos triples altos, el neutro se cuenta como conductor portador de corriente (NTC 2050 310.15(B)(5)(c)) y puede requerir una sección igual o mayor que la de las fases: corriente estimada ${fmt(In, 0)} A.`, "Las corrientes armónicas de los grupos se suman en forma aritmética (caso más desfavorable). Si hay bancos de condensadores, verifique la resonancia paralela (h ≈ √(Scc / Qc)).", "Los espectros de convertidores son los teóricos y el de fuentes conmutadas es típico: con mediciones del sitio use el espectro personalizado."],
    conclusion: verificaciones.length ? veredicto(verificaciones, `La distorsión armónica cumple los límites; factor K = ${fmt(K, 1)}.`, "La distorsión armónica supera algún límite: considere filtros, reactancias de línea, convertidores de más pulsos o un transformador con factor K.") : `THDi = ${fmt(thdi, 1)} %; factor K = ${fmt(K, 1)}.`
  };
}

// ================================================================ 24. ANÁLISIS DE RIESGOS ELÉCTRICOS (RETIE 2024, literal a)
// Matriz de la Tabla 1.5.1.4.1.a: para cada riesgo se cruza la probabilidad con la consecuencia
// de cada clase (personas, económicas, ambientales e imagen) y se toma el caso más crítico;
// se evalúa antes y después de las medidas de mitigación (riesgo residual).
export function riesgoElectrico(e) {
  const maxRiesgo = e.maximoResidual || "Medio";
  const rango = (n) => N.NIVELES_RIESGO.indexOf(n);
  const verificaciones = [];
  const filasR = filas(e.riesgos).map((r, i) => {
    const cons = ["personas", "economicas", "ambientales", "imagen"].map((k) => Math.min(5, Math.max(1, num(r[k], 1))));
    const niveles = cons.map((c) => N.nivelRiesgo(c, r.probabilidad));
    const inicial = niveles.reduce((m, x) => (rango(x) > rango(m) ? x : m), "Muy bajo");
    const consRes = Math.min(5, Math.max(1, num(r.consecuenciaResidual, Math.max(...cons))));
    const residual = N.nivelRiesgo(consRes, r.probabilidadResidual || r.probabilidad);
    const nombre = `${r.evento || "Riesgo"} por ${String(r.factor || "—").toLowerCase()}${r.fuente ? ` en ${r.fuente}` : ""}`;
    verificaciones.push({ criterio: `${nombre}: riesgo residual con las medidas adoptadas`, norma: "RETIE 2024 Libro 1, 1.5.1.4.1 (Tablas 1.5.1.4.1.a y b)", valor: residual, limite: `≤ ${maxRiesgo}`, cumple: rango(residual) <= rango(maxRiesgo) });
    return { n: i + 1, nombre, r, cons, inicial, residual, consRes };
  });
  const peorIni = filasR.reduce((m, f) => (rango(f.inicial) > rango(m) ? f.inicial : m), "Muy bajo");
  const peorRes = filasR.reduce((m, f) => (rango(f.residual) > rango(m) ? f.residual : m), "Muy bajo");
  const conteo = (campo) => N.NIVELES_RIESGO.slice().reverse().map((n) => `${n}: ${filasR.filter((f) => f[campo] === n).length}`).join(" · ");
  return {
    resumen: [
      { etiqueta: "Riesgos evaluados", valor: String(filasR.length), unidad: "" },
      { etiqueta: "Mayor riesgo sin medidas", valor: peorIni, unidad: "" },
      { etiqueta: "Mayor riesgo residual", valor: peorRes, unidad: "" }
    ],
    tablas: [
      { titulo: "Matriz de análisis de riesgos (RETIE 2024, Tabla 1.5.1.4.1.a)", encabezados: ["N.º", "Riesgo (evento por factor en la fuente)", "Tipo", "Prob.", "Consecuencias P / E / A / I", "Nivel sin medidas", "Medidas de mitigación", "Prob. y cons. residual", "Nivel residual"], filas: filasR.map((f) => [String(f.n), f.nombre, f.r.tipo || "Potencial", f.r.probabilidad || "E", f.cons.join(" / "), f.inicial, f.r.medidas || "—", `${f.r.probabilidadResidual || f.r.probabilidad || "E"} / ${f.consRes}`, f.residual]) },
      { titulo: "Decisiones y acciones según el nivel residual (Tabla 1.5.1.4.1.b)", encabezados: ["N.º", "Nivel residual", "Decisión y control"], filas: filasR.map((f) => [String(f.n), f.residual, N.DECISIONES_RIESGO[f.residual]]) }
    ],
    pasos: [
      { titulo: "Valoración por clase de consecuencia", formula: "Nivel = Matriz(consecuencia 1 a 5, probabilidad E a A) para personas, económicas, ambientales e imagen", sustitucion: "RETIE 2024 Libro 1, Tabla 1.5.1.4.1.a", resultado: `Sin medidas: ${conteo("inicial")}` },
      { titulo: "Nivel del riesgo", formula: "Se toma el caso más crítico de los cuatro cruces", sustitucion: "RETIE 2024 1.5.1.4.1 literal f", resultado: `Mayor: ${peorIni}` },
      { titulo: "Riesgo residual", formula: "Matriz(consecuencia residual, probabilidad residual) con las medidas de mitigación adoptadas", sustitucion: `Máximo admitido en el diseño: ${maxRiesgo}`, resultado: `Residual: ${conteo("residual")}` }
    ],
    verificaciones,
    notas: ["Consecuencias: 1 molestia funcional / daños leves / sin efecto / interna; 2 lesión menor / daños importantes / efecto menor / local; 3 incapacidad temporal / daños severos / contaminación localizada / regional; 4 incapacidad permanente parcial / daños mayores / contaminación mayor / nacional; 5 una o más muertes / daño grave / contaminación irreparable / internacional.", "En instalaciones con ALTO RIESGO o PELIGRO INMINENTE se debe interrumpir el funcionamiento, salvo donde la interrupción cause un riesgo mayor (RETIE 2024 1.5.1.4.3)."],
    conclusion: filasR.length ? veredicto(verificaciones, `Con las medidas adoptadas, ningún riesgo residual supera el nivel «${maxRiesgo}» (mayor residual: ${peorRes}).`, `Hay riesgos cuyo nivel residual supera «${maxRiesgo}»: adopte medidas adicionales de mitigación.`) : "Agregue los riesgos a evaluar."
  };
}

// ================================================================ 25. NIVEL DE TENSIÓN REQUERIDO (literal f)
// Compara los niveles de tensión candidatos para alimentar la demanda proyectada: corriente,
// caída de tensión (ΔV % = S × L × (R cos φ + X sen φ) / (10 V²), con S en kVA, L en km y V en kV),
// pérdidas y potencia máxima que el operador de red conecta en ese nivel. Recomienda el menor
// nivel viable. Niveles de tensión según la CREG 015 de 2018 (nivel 1 < 1 kV; 2: 1 a 30 kV;
// 3: 30 a 57,5 kV; 4: 57,5 kV o más) y tensiones normalizadas de la NTC 1340.
export const nivelCREG = (kv) => (kv < 1 ? 1 : kv < 30 ? 2 : kv < 57.5 ? 3 : 4);
// RETIE 2024 Libro 3, Título 9 (fase-fase, c.a.): BT ≤ 1 kV; MT > 1 kV y < 57,5 kV; AT 57,5 a 230 kV; EAT > 230 kV.
export const nivelRETIE = (kv) => (kv <= 1 ? "BT" : kv < 57.5 ? "MT" : kv <= 230 ? "AT" : "EAT");
export function nivelTension(e, proyecto = {}, ctx = {}) {
  const s0 = num(e.demanda, NaN) > 0 ? num(e.demanda) : ctx.cargas?.sDemKVA ?? 0;
  const g = num(e.crecimiento, 0), n = num(e.anios, 0), S = s0 * Math.pow(1 + g / 100, n);
  const fp = Math.min(1, Math.max(0.1, num(e.fp, 0.9))), sen = Math.sqrt(1 - fp * fp), L = num(e.distancia, 0) / 1000, dvMax = num(e.dvMax, 3);
  const cands = filas(e.candidatos).map((c) => {
    const V = num(c.tension, 0), R = num(c.r, 0), X = num(c.x, 0), cap = num(c.capacidad, 0), lim = num(c.limiteOR, 0);
    const I = V > 0 ? S / (Math.sqrt(3) * V) : NaN;
    const dv = V > 0 ? (S * L * (R * fp + X * sen)) / (10 * V * V) : NaN;
    const perd = V > 0 && S > 0 ? ((3 * I * I * R * L) / 1000 / (S * fp)) * 100 : 0;
    const motivos = [];
    if (cap > 0 && I > cap) motivos.push(`corriente ${fmt(I, 0)} A > capacidad ${fmt(cap, 0)} A`);
    if (dv > dvMax) motivos.push(`caída ${fmt(dv, 2)} % > ${fmt(dvMax, 1)} %`);
    if (lim > 0 && S > lim) motivos.push(`demanda ${fmt(S, 0)} kVA > límite del operador ${fmt(lim, 0)} kVA`);
    return { nombre: c.nivel || `${fmt(V, 3)} kV`, V, conductor: c.conductor || "", I, dv, perd, cap, lim, viable: V > 0 && !motivos.length, motivos, creg: nivelCREG(V) };
  }).filter((c) => c.V > 0).sort((a, b) => a.V - b.V);
  const rec = cands.find((c) => c.viable);
  const adop = cands.find((c) => c.nombre === e.adoptado) || null;
  const verificaciones = [];
  if (adop) verificaciones.push({ criterio: `Nivel adoptado «${adop.nombre}»: capacidad, caída de tensión y límite del operador`, norma: "RETIE 2024 literal f) / CREG 015 de 2018 / NTC 1340", valor: adop.viable ? `I = ${fmt(adop.I, 0)} A; ΔV = ${fmt(adop.dv, 2)} %` : adop.motivos.join("; "), limite: `Capacidad ${adop.cap ? fmt(adop.cap, 0) + " A" : "—"}; ΔV ≤ ${fmt(dvMax, 1)} %`, cumple: adop.viable });
  return {
    resumen: [
      { etiqueta: "Demanda proyectada", valor: fmt(S, 1), unidad: "kVA" },
      { etiqueta: "Menor nivel viable", valor: rec ? rec.nombre : "Ninguno", unidad: "" },
      ...(adop ? [{ etiqueta: "Nivel adoptado", valor: adop.nombre, unidad: "" }] : [])
    ],
    salidas: { demanda: S, recomendado: rec?.nombre || "", adoptado: adop?.nombre || rec?.nombre || "", tension: (adop || rec)?.V ?? NaN },
    tablas: [{ titulo: "Comparación de niveles de tensión", encabezados: ["Nivel", "Nivel CREG", "RETIE (Título 9)", "Conductor de referencia", "I (A)", "ΔV (%)", "Pérdidas (%)", "Resultado"], filas: cands.map((c) => [c.nombre + (c === rec ? " ★" : ""), String(c.creg), nivelRETIE(c.V), c.conductor, fmt(c.I, 1), fmt(c.dv, 2), fmt(c.perd, 2), c.viable ? "Viable" : `No viable: ${c.motivos.join("; ")}`]) }],
    pasos: [
      { titulo: "Demanda proyectada", formula: "S = S0 × (1 + g)^n", sustitucion: `S0 = ${fmt(s0, 1)} kVA${num(e.demanda, NaN) > 0 ? "" : " (del cuadro de cargas)"}; g = ${fmt(g, 1)} %; n = ${fmt(n, 0)} años`, resultado: `S = ${fmt(S, 1)} kVA` },
      { titulo: "Corriente y caída de tensión por nivel", formula: "I = S / (√3 V); ΔV % = S × L × (R cos φ + X sen φ) / (10 V²)", sustitucion: `L = ${fmt(L, 3)} km; cos φ = ${fmt(fp, 2)}; límite ΔV = ${fmt(dvMax, 1)} %`, resultado: "Por nivel" },
      { titulo: "Pérdidas", formula: "P pérdidas = 3 I² R L; % = P pérdidas / (S cos φ)", sustitucion: "R del conductor de referencia de cada nivel", resultado: "Por nivel" },
      { titulo: "Selección", formula: "Menor nivel que cumple capacidad, caída de tensión y límite del operador de red", sustitucion: "Niveles CREG 015 de 2018: 1 (< 1 kV), 2 (1 a 30 kV), 3 (30 a 57,5 kV), 4 (≥ 57,5 kV)", resultado: rec ? rec.nombre : "Ningún nivel candidato es viable" }
    ],
    verificaciones,
    notas: ["Los conductores de referencia, su capacidad y el límite de potencia por nivel son datos de entrada: tome los de la norma del operador de red del área (potencia máxima que conecta en baja tensión y en cada nivel de media tensión) y de la disponibilidad de su red.", "El nivel recomendado es el técnicamente viable de menor tensión; la decisión final considera también el costo de la conexión (transformador propio o red del operador) y la factibilidad que expida el operador de red."],
    conclusion: rec ? (adop ? veredicto(verificaciones, `El nivel adoptado «${adop.nombre}» es viable para ${fmt(S, 0)} kVA; el menor nivel viable es «${rec.nombre}».`, `El nivel adoptado «${adop.nombre}» no es viable; el menor nivel viable es «${rec.nombre}».`) : `Para ${fmt(S, 0)} kVA el menor nivel de tensión viable es «${rec.nombre}».`) : (S > 0 ? "Ningún nivel candidato es viable: revise los conductores o agregue un nivel de tensión mayor." : "Indique la demanda (o haga el cuadro de cargas).")
  };
}

// ================================================================ 26. DIAGRAMA UNIFILAR (literal r)
// Se arma con los datos del proyecto: red del operador, transformador (de distribución o de
// potencia), barras y cables del cortocircuito, circuitos con sus protecciones y calibres, y
// generación solar si la hay. Los datos que falten se digitan en el formulario.
const textoConductor = (cond) => { const [t, c] = String(cond || "").split(":"); return t === "aereo" ? (N.CONDUCTORES_AEREOS[c]?.nombre || c) : `${t === "Al" ? "Al" : "Cu"} ${N.etiquetaCalibre(c || "")}`; };
export function unifilar(e, proyecto = {}, ctx = {}) {
  const tp = ctx.trafoPotencia, td = ctx.transformador, cc = ctx.cortocircuito;
  const kvRed = num(e.tensionRed, NaN) > 0 ? num(e.tensionRed) : tp ? tp.vp / 1000 : td ? td.vp / 1000 : cc?.uMT ?? 13.2;
  const kva = num(e.potencia, NaN) > 0 ? num(e.potencia) : tp ? tp.sn : td?.sn ?? NaN;
  const vs = num(e.tensionSec, NaN) > 0 ? num(e.tensionSec) : tp ? tp.vs : td?.vs ?? cc?.uBT ?? NaN;
  const z = tp ? tp.z : td?.z;
  // Barras: las del primer cortocircuito (cadena) y, si hay varios cálculos de cortocircuito (uno por
  // tablero), las barras de los demás que no estén todavía.
  const clave = (s) => String(s || "").trim().toLowerCase();
  const barras = [];
  const aBarra = (b) => ({ nombre: b.nombre, ik3: b.ik3 / 1000, icu: b.icu || 0, cable: b.cable ? `${b.cable.paralelos > 1 ? `${b.cable.paralelos}× ` : ""}${textoConductor(b.cable.conductor)}, ${fmt(b.cable.longitud, 0)} m` : "" });
  const todosCc = ctx.cortocircuitoTodos?.length ? ctx.cortocircuitoTodos : cc ? [cc] : [];
  todosCc.forEach((c) => (c.barras || []).forEach((b) => { if (!barras.some((x) => clave(x.nombre) === clave(b.nombre))) barras.push(aBarra(b)); }));
  if (!barras.length) barras.push({ nombre: e.barraManual || (vs > 1000 ? "Barra del secundario" : "Tablero general"), ik3: NaN, icu: 0, cable: "" });
  const iCirc = Math.max(0, barras.findIndex((b) => clave(b.nombre) === clave(e.barraCircuitos)));
  const barraC = e.barraCircuitos && barras.some((b) => clave(b.nombre) === clave(e.barraCircuitos)) ? iCirc : barras.length > 1 ? 1 : 0;
  // Varios cálculos con una sola barra aguas abajo cada uno (tableros hermanos): se ordenan por nombre.
  if (todosCc.length > 1 && todosCc.every((c) => (c.barras || []).length <= barraC + 2)) {
    const post = barras.splice(barraC + 1).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
    barras.push(...post);
  }
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const omitir = String(e.circuitosOmitir || "").split(",").map(norm).map((s) => s.trim()).filter(Boolean);
  const todosCirc = (ctx.conductores?.circuitos || []).map((c) => ({ nombre: c.circuito, desc: c.descripcion, In: c.In, conductor: `${c.material} ${N.etiquetaCalibre(c.calibre)}`, I: c.I, icu: c.icu }));
  // La acometida principal es el cable entre barras (ya dibujado), no una salida del tablero.
  const esTronco = (c) => omitir.includes(norm(c.nombre).trim()) || (barras.length > 1 && /acometida principal|alimentador principal/.test(norm(c.desc)));
  // Un circuito que alimenta una de las barras de aguas abajo se dibuja como esa barra (con su cable real).
  const numeros = (s) => (norm(s).match(/\d+/) || [""])[0]; // primer número del texto
  const palabras = (s) => new Set((norm(s).match(/[a-z]{4,}/g) || []));
  const alimenta = (c, b) => numeros(c.desc) === numeros(b.nombre) && [...palabras(b.nombre)].some((p) => palabras(c.desc).has(p));
  const posteriores = barras.slice(barraC + 1);
  const circuitos = todosCirc.filter((c) => !esTronco(c) && !posteriores.some((b) => alimenta(c, b)));
  posteriores.forEach((b) => { const c = todosCirc.find((x) => !esTronco(x) && alimenta(x, b)); if (c) b.alim = { nombre: c.nombre, icu: c.icu }; });
  const fv = ctx.fvArreglo ? { kwp: ctx.fvArreglo.pdc, kw: ctx.fvArreglo.pac } : null;
  const motores = cc?.motores || [];
  const g = { tipo: "unifilar", red: { kv: kvRed, sk: cc?.sk }, protMT: e.proteccionMT || "", dps: e.dpsMT !== "No", medidor: e.medidor || "", trafo: Number.isFinite(kva) ? { kva, vp: kvRed, vs: vs / 1000, z, grupo: e.grupo || (tp ? "YNyn0(d)" : "Dyn5") } : null, barras, barraC, circuitos, fv, motores, subestacion: !!tp };
  const elementos = [
    ["Red del operador", `${fmt(kvRed, 1)} kV${cc?.sk ? `; S"k = ${fmt(cc.sk, 0)} MVA` : ""}`],
    ...(g.dps ? [["DPS", "Descargadores de sobretensión en la llegada"]] : []),
    ...(g.protMT ? [["Protección de media tensión", g.protMT]] : []),
    ...(g.trafo ? [["Transformador", `${fmt(kva, 0)} kVA; ${fmt(kvRed, 1)} / ${fmt(vs / 1000, 3)} kV; ${g.trafo.grupo}${z ? `; Z = ${fmt(z, 1)} %` : ""}`]] : []),
    ...(g.medidor ? [["Medida", g.medidor]] : []),
    ...barras.map((b, i) => [i ? `Barra ${b.nombre}` : `Barra ${b.nombre} (bornes)`, `${b.cable ? `${b.cable}; ` : ""}${Number.isFinite(b.ik3) ? `Ik" = ${fmt(b.ik3, 2)} kA` : ""}${b.icu ? `; Icu = ${fmt(b.icu, 1)} kA` : ""}`]),
    ...todosCirc.map((c) => [`Circuito ${c.nombre}`, `${c.desc}; ${c.conductor}; protección ${c.In} A; ${fmt(c.I, 1)} A`]),
    ...(fv ? [["Generación solar fotovoltaica", `${fmt(fv.kwp, 1)} kWp / ${fmt(fv.kw, 1)} kW AC`]] : []),
    ...motores.map((m) => ["Grupo de motores", `${m.barra}: ${fmt(m.kw, 1)} kW`])
  ];
  const faltan = [!g.trafo && "transformador (cálculo del transformador o potencia digitada)", !(cc?.barras || []).length && "barras y cables (cálculo de cortocircuito)", !todosCirc.length && "circuitos (cálculo de conductores)"].filter(Boolean);
  return {
    resumen: [{ etiqueta: "Elementos del diagrama", valor: String(elementos.length), unidad: "" }, { etiqueta: "Circuitos", valor: String(todosCirc.length), unidad: "" }],
    grafico: g,
    tablas: [{ titulo: "Elementos del diagrama unifilar", encabezados: ["Elemento", "Características"], filas: elementos }],
    pasos: [{ titulo: "Origen de los datos", formula: "El diagrama se genera con los cálculos del proyecto", sustitucion: "Transformador: cálculo del transformador o del transformador de potencia; barras, cables e Ik\": cortocircuito; circuitos: conductores y protecciones; generación: arreglo fotovoltaico", resultado: faltan.length ? `Faltan: ${faltan.join("; ")}` : "Completo" }],
    verificaciones: [],
    notas: ["El diagrama se actualiza solo cuando cambian los cálculos del proyecto. Para el plano de construcción (literal s), use este diagrama como base y complete la información de detalle (marcas, referencias y cuadros de cargas)."],
    conclusion: faltan.length ? `Diagrama unifilar parcial: faltan ${faltan.join("; ")}.` : `Diagrama unifilar generado con ${todosCirc.length} circuito(s) y ${barras.length} barra(s).`
  };
}

// ================================================================ 27. ILUMINACIÓN INTERIOR (RETILAP)
// Verificación de un diseño de iluminación interior frente al RETILAP 2024 (Res. 40150 de 2024, modificada por la Res. 40286 de 2026,
// Libro 3): niveles por recinto (Tabla 3.2.2.6.a), reflectancias, método del UGR, VEEI
// (Tabla 3.2.5.a), emergencia (art. 3.2.4), factor de mantenimiento, control y documentos.
// Los resultados fotométricos (Em, Uo, UGR, Ez) son los del software de cálculo.
const siNo = (v) => String(v || "").toLowerCase().startsWith("s");
export function iluminacion(e) {
  const A = N.RETILAP_AREAS, verificaciones = [], notas = [];
  const recintos = filas(e.recintos).map((r) => {
    const t = r.tipo === "personalizado" ? { nombre: "Personalizado", ref: "—", em: num(r.emReq, 0), uo: num(r.uoReq, 0), ugr: num(r.ugrReq, NaN), ez: NaN, veei: "otro" } : A[r.tipo] || A.oficina;
    const S = num(r.area, 0), P = num(r.potencia, 0), Em = num(r.em, 0), Uo = num(r.uo, NaN), ugr = num(r.ugr, NaN), Ez = num(r.ez, NaN), rho = num(r.rhoPiso, NaN), flujo = num(r.flujo, NaN);
    const veei = S > 0 && Em > 0 ? (P * 100) / (S * Em) : NaN;
    let lim = (N.RETILAP_VEEI[t.veei] || N.RETILAP_VEEI.otro).limite;
    if (Em > 600) lim = Math.min(lim, 2.5);
    const cu = flujo > 0 && S > 0 ? (Em * S) / (flujo * num(e.fm, 0.8)) : NaN;
    return { nombre: r.recinto || t.nombre, t, S, P, Em, Uo, ugr, Ez, rho, veei, lim, cu, giro: r.ugrGiro || "completo", emerg: r.emergencia || "No" };
  });
  recintos.forEach((r) => {
    const req = `${r.t.ref !== "—" ? `ref. ${r.t.ref}: ` : ""}Em >= ${r.t.em} lx; Uo >= ${fmt(r.t.uo, 2)}${Number.isFinite(r.t.ez) ? `; Ez >= ${r.t.ez} lx` : ""}`;
    const okEm = r.Em >= r.t.em, okUo = !Number.isFinite(r.Uo) || r.Uo >= r.t.uo - 1e-9, okEz = !Number.isFinite(r.Ez) || !Number.isFinite(r.t.ez) || r.Ez >= r.t.ez;
    verificaciones.push({ criterio: `${r.nombre}: iluminancia, uniformidad e iluminancia cilíndrica`, norma: "RETILAP 2024 Libro 3, Tabla 3.2.2.6.a; 3.2.1.3 y 3.2.1.5", valor: `${fmt(r.Em, 0)} lx; Uo ${Number.isFinite(r.Uo) ? fmt(r.Uo, 2) : "—"}${Number.isFinite(r.Ez) ? `; Ez ${fmt(r.Ez, 0)} lx` : ""}`, limite: req, cumple: okEm && okUo && okEz });
    if (Number.isFinite(r.ugr) && Number.isFinite(r.t.ugr)) verificaciones.push({ criterio: `${r.nombre}: deslumbramiento UGR`, norma: "RETILAP 2024 3.2.1.4 (CIE 117); Tabla 3.2.2.6.a", valor: fmt(r.ugr, 1), limite: `<= ${r.t.ugr}`, cumple: r.ugr <= r.t.ugr + 1e-9 });
    if (r.t.oficina && r.giro === "parcial") verificaciones.push({ criterio: `${r.nombre}: evaluación del UGR con observadores girando de 0° a 360° cada 15°`, norma: "RETILAP 2024 3.2.1.4 (obligatorio en oficinas y zonas de trabajo)", valor: "Barrido parcial sin justificación", limite: "Giro completo o campo visual limitado y justificado", cumple: false });
    if (Number.isFinite(r.veei)) verificaciones.push({ criterio: `${r.nombre}: valor de eficiencia energética VEEI`, norma: `RETILAP 2024 art. 3.2.5, Tabla 3.2.5.a (${r.Em > 600 ? "locales de más de 600 lx" : (N.RETILAP_VEEI[r.t.veei] || N.RETILAP_VEEI.otro).nombre.toLowerCase()})`, valor: `${fmt(r.veei, 2)} W/m² por 100 lx`, limite: `<= ${fmt(r.lim, 1)}`, cumple: r.veei <= r.lim + 1e-9 });
    if (Number.isFinite(r.cu) && r.cu > 1) verificaciones.push({ criterio: `${r.nombre}: coherencia del flujo con la iluminancia (método de los lúmenes)`, norma: "Control cruzado: Em <= Φ × FM / S", valor: `factor de utilización implícito ${fmt(r.cu, 2)}`, limite: "<= 1", cumple: false });
  });
  // Reflectancias del piso (RETILAP 3.2.1.1: 0,2 a 0,6 si no se conocen los acabados).
  const [pMin, pMax] = N.RETILAP_REFLECTANCIA.piso;
  const conRho = recintos.filter((r) => Number.isFinite(r.rho));
  if (conRho.length) {
    const fuera = conRho.filter((r) => r.rho < pMin || r.rho > pMax);
    const documentado = siNo(e.reflectanciasDocumentadas);
    verificaciones.push({ criterio: "Reflectancia del piso en el modelo de cálculo", norma: "RETILAP 2024 3.2.1.1 (piso 0,2 a 0,6 si no se documenta el acabado real)", valor: fuera.length ? `${fuera.length} recinto(s) fuera del rango: ${fuera.map((r) => `${r.nombre} ${fmt(r.rho, 0)} %`).join("; ")}` : "Todas dentro del rango", limite: documentado ? "Acabados reales documentados" : `${pMin} % a ${pMax} %`, cumple: !fuera.length || documentado });
  }
  // Emergencia de los baños y espacios antipánico.
  const sinEm = recintos.filter((r) => (r.t.emergencia || r.t.antipanico) && !siNo(r.emerg));
  if (recintos.some((r) => r.t.emergencia || r.t.antipanico)) verificaciones.push({ criterio: "Iluminación de emergencia calculada en baños y espacios antipánico", norma: "RETILAP 2024 3.2.4.1 num. 2 y 7; 3.2.4.7 (>= 0,5 lx; 1:40)", valor: sinEm.length ? `Sin cálculo: ${sinEm.map((r) => r.nombre).join("; ")}` : "Calculada en todos", limite: "Calculada", cumple: !sinEm.length });
  // Zonas de emergencia.
  const E = N.RETILAP_EMERGENCIA;
  const zonas = filas(e.emergencia).map((z) => ({ nombre: z.zona || "", t: E[z.tipo] || E.ruta, eh: num(z.ehmin, NaN), ev: num(z.evmin, NaN), rel: num(z.relacion, NaN), impar: z.impar || "Sí" }));
  zonas.forEach((z) => {
    const okEh = !Number.isFinite(z.t.eh) || (Number.isFinite(z.eh) && z.eh >= z.t.eh - 1e-9), okEv = !Number.isFinite(z.t.ev) || (Number.isFinite(z.ev) && z.ev >= z.t.ev - 1e-9), okRel = !Number.isFinite(z.rel) || z.rel <= 40 + 1e-9;
    const lim = [Number.isFinite(z.t.eh) ? `Eh min >= ${fmt(z.t.eh, 1)} lx` : "", Number.isFinite(z.t.ev) ? `Ev min >= ${z.t.ev} lx` : "", "Emax/Emin <= 40"].filter(Boolean).join("; ");
    verificaciones.push({ criterio: `Emergencia — ${z.nombre || z.t.nombre} (${z.t.nombre.toLowerCase()})`, norma: `RETILAP 2024 ${z.t.ref}`, valor: [Number.isFinite(z.eh) ? `Eh min ${fmt(z.eh, 2)} lx` : "", Number.isFinite(z.ev) ? `Ev min ${fmt(z.ev, 2)} lx` : "", Number.isFinite(z.rel) ? `1:${fmt(z.rel, 2)}` : ""].filter(Boolean).join("; "), limite: lim, cumple: okEh && okEv && okRel });
  });
  const pares = zonas.filter((z) => z.impar === "No");
  if (zonas.length) verificaciones.push({ criterio: "Mallas de cálculo de emergencia con número impar de puntos y separación <= 0,5 m", norma: "RETILAP 2024 art. 3.2.4", valor: pares.length ? `Con número par: ${pares.map((z) => z.nombre).join("; ")}` : "Todas impares", limite: "Número impar en ambas direcciones", cumple: !pares.length });
  const autonomia = num(e.autonomia, 60), raE = num(e.raEmergencia, 70);
  verificaciones.push({ criterio: "Autonomía de la iluminación de emergencia", norma: "RETILAP 2024 3.2.4.2 num. 4", valor: `${fmt(autonomia, 0)} min`, limite: ">= 60 min", cumple: autonomia >= 60 });
  verificaciones.push({ criterio: "Índice de reproducción cromática de las luminarias de emergencia", norma: "RETILAP 2024 3.2.4.2 num. 5", valor: `Ra ${fmt(raE, 0)}`, limite: ">= 70", cumple: raE >= 70 });
  // Factor de mantenimiento, control y documentos.
  const fm = num(e.fm, 0.8);
  verificaciones.push({ criterio: `Factor de mantenimiento (${fmt(fm, 2)}) calculado por equipo, entorno y programa de mantenimiento`, norma: "RETILAP 2024 3.2.1.10.1; ISO/CIE TS 22012", valor: siNo(e.fmCalculado) ? "Calculado y documentado" : "Adoptado como hipótesis", limite: "Calculado (fLF × fS × fLM × fSM)", cumple: siNo(e.fmCalculado) });
  const sTotal = recintos.reduce((s, r) => s + r.S, 0), sEdif = num(e.areaConstruida, NaN) > 0 ? num(e.areaConstruida) : sTotal;
  if (sEdif > 500) {
    verificaciones.push({ criterio: "Sistema de control del alumbrado (edificación de más de 500 m²)", norma: "RETILAP 2024 art. 3.2.6", valor: siNo(e.control) ? "Especificado" : "No especificado", limite: "Al menos una forma de control automático", cumple: siNo(e.control) });
    if (recintos.some((r) => r.t.corredor)) verificaciones.push({ criterio: "Sensores de presencia a prueba de fallo en corredores de circulación (apagado <= 20 min)", norma: "RETILAP 2024 art. 3.2.6", valor: siNo(e.sensoresCorredores) ? "Especificados" : "No especificados", limite: "Especificados", cumple: siNo(e.sensoresCorredores) });
  }
  const detallado = sTotal >= 100 || siNo(e.altaConcentracion);
  [["planos", "Plano con distribución de luminarias, mallas, alturas de montaje y cuadro de cantidades", "3.1.4.2 num. 3 a"], ["fichas", "Fichas técnicas e instrucciones de instalación de las luminarias", "3.1.4.2 num. 3 b; 3.1.3.1"], ["declaracion", "Declaración de cumplimiento del RETILAP firmada por el diseñador", "3.1.4.2 num. 3 c"], ["mantenimiento", "Programa de mantenimiento", "3.1.4.2 num. 3 d; 3.2.1.10"], ...(detallado ? [["analisis", "Documento de análisis del proyecto (orientación, condiciones ambientales, visita al sitio)", "3.1.4.1"]] : [])].forEach(([k, txt, ref]) => {
    verificaciones.push({ criterio: txt, norma: `RETILAP 2024 ${ref}`, valor: siNo(e[k]) ? "Entregado" : "No entregado", limite: "Entregado", cumple: siNo(e[k]) });
  });
  const pTotal = recintos.reduce((s, r) => s + r.P, 0);
  const malos = recintos.filter((r) => r.Em < r.t.em || (Number.isFinite(r.Uo) && r.Uo < r.t.uo - 1e-9));
  notas.push("Los valores Em, Uo, UGR y Ez son los resultados del software de cálculo (iluminancia mantenida, con el factor de mantenimiento ya aplicado); AHÍNCO los verifica frente al RETILAP y calcula el VEEI. La iluminancia cilíndrica, la de paredes y la de techos se exigen en el diseño, no en la inspección (Tabla 3.2.2.6.a, columnas 7 a 9).");
  notas.push("VEEI = P × 100 / (S × Em) con P la potencia de las luminarias y sus auxiliares; incluye el alumbrado general y el direccional (solo se exceptúan vitrinas y zonas de exposición). Para locales con más de 600 lx el límite es 2,5.");
  if (conRho.some((r) => r.rho > pMax)) notas.push("Un piso con reflectancia alta aumenta las interreflexiones: sobrestima la iluminancia y la uniformidad, y eleva la luminancia de fondo, lo que reduce el UGR calculado. Recalcule con la reflectancia del acabado real.");
  return {
    resumen: [
      { etiqueta: "Recintos verificados", valor: String(recintos.length), unidad: "" },
      { etiqueta: "Superficie iluminada", valor: fmt(sTotal, 1), unidad: "m²" },
      { etiqueta: "Potencia de iluminación", valor: fmt(pTotal, 0), unidad: "W" },
      { etiqueta: "Tipo de diseño exigido", valor: detallado ? "Detallado" : "Básico", unidad: "" }
    ],
    salidas: { area: sTotal, potencia: pTotal },
    tablas: [
      { titulo: "Niveles de iluminación y eficiencia por recinto (RETILAP Tabla 3.2.2.6.a y 3.2.5.a)", encabezados: ["Recinto", "Ref.", "S (m²)", "P (W)", "Em / exigido (lx)", "Uo / exigido", "UGR / máx.", "Ez / exigido (lx)", "Piso (%)", "VEEI / límite"], filas: recintos.map((r) => [r.nombre, r.t.ref, fmt(r.S, 2), fmt(r.P, 1), `${fmt(r.Em, 0)} / ${r.t.em}`, `${Number.isFinite(r.Uo) ? fmt(r.Uo, 2) : "—"} / ${fmt(r.t.uo, 2)}`, `${Number.isFinite(r.ugr) ? fmt(r.ugr, 1) : "—"} / ${Number.isFinite(r.t.ugr) ? r.t.ugr : "—"}`, `${Number.isFinite(r.Ez) ? fmt(r.Ez, 0) : "—"} / ${Number.isFinite(r.t.ez) ? r.t.ez : "—"}`, Number.isFinite(r.rho) ? fmt(r.rho, 0) : "—", Number.isFinite(r.veei) ? `${fmt(r.veei, 2)} / ${fmt(r.lim, 1)}` : "—"]) },
      ...(zonas.length ? [{ titulo: "Iluminación de emergencia (RETILAP art. 3.2.4)", encabezados: ["Zona", "Tipo", "Eh min (lx)", "Ev min (lx)", "Emax/Emin", "Exigido", "Malla impar"], filas: zonas.map((z) => [z.nombre, z.t.nombre, Number.isFinite(z.eh) ? fmt(z.eh, 2) : "—", Number.isFinite(z.ev) ? fmt(z.ev, 2) : "—", Number.isFinite(z.rel) ? `1:${fmt(z.rel, 2)}` : "—", [Number.isFinite(z.t.eh) ? `Eh >= ${fmt(z.t.eh, 1)}` : "", Number.isFinite(z.t.ev) ? `Ev >= ${z.t.ev}` : ""].filter(Boolean).join("; "), z.impar]) }] : [])
    ],
    pasos: [
      { titulo: "Requisitos por recinto", formula: "Em >= Em(tabla); Uo = Emin / Em >= Uo(tabla); UGR <= UGRL; Em,z >= Em,z(tabla)", sustitucion: "RETILAP Tabla 3.2.2.6.a según el tipo de tarea o actividad de cada recinto", resultado: malos.length ? `${malos.length} recinto(s) bajo el nivel exigido` : "Todos los recintos alcanzan Em y Uo" },
      { titulo: "Valor de eficiencia energética", formula: "VEEI = P × 100 / (S × Em)", sustitucion: `P total = ${fmt(pTotal, 0)} W; S total = ${fmt(sTotal, 1)} m²`, resultado: "Por recinto, frente a la Tabla 3.2.5.a" },
      { titulo: "Control cruzado por el método de los lúmenes", formula: "CU = Em × S / (Φ × FM) <= 1", sustitucion: `FM = ${fmt(fm, 2)}; Φ = flujo total de las luminarias del recinto (opcional)`, resultado: recintos.some((r) => Number.isFinite(r.cu)) ? recintos.filter((r) => Number.isFinite(r.cu)).map((r) => `${r.nombre}: CU ${fmt(r.cu, 2)}`).join("; ") : "Sin flujos digitados" }
    ],
    verificaciones, notas,
    conclusion: veredicto(verificaciones, "El diseño de iluminación cumple los requisitos verificados del RETILAP.", "El diseño de iluminación no cumple todos los requisitos verificados del RETILAP.")
  };
}

export const CALCULOS = { iluminacion, cargas, conductores, regulacion, canalizaciones, transformador, cortocircuito, coordinacion, malla, rayos, aislamiento, distancias, mecanico, trafoPotencia, cableMT, apantallamiento, fvArreglo, fvProduccion, fvConductores, fvConexion, arcoElectrico, camposEM, conductorEconomico, armonicos, riesgoElectrico, nivelTension, unifilar };
