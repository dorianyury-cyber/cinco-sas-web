// APU PRO — revisión de presupuestos de terceros (puro: sin Firebase ni DOM).
// revision = {
//   base: "cd" | "conAiu" | "final"  (qué incluyen los valores de los ítems),
//   aiu: { a, i, u }, iva, regimenIva: "total" | "utilidad" | "ninguno", totalDeclarado,
//   capitulos: [{ num, nombre }],
//   items: [{ id, cap, item, desc, und, cant, vu, vt, fila, ref: { codigo, confirmada } }],
//   ajustes: { [clave]: { incluir, sev, accion, comentario } }   (sobre los hallazgos automáticos),
//   hallazgos: [{ id, sev, tema, hallazgo, items, impacto, accion }]  (hallazgos manuales)
// }
import { normalizar } from "./ap-calculos.js";

export const BASES = {
  cd: "Costo directo (el AIU y el IVA se suman al final)",
  conAiu: "Incluyen el AIU (el IVA se suma al final)",
  final: "Precio final (incluyen AIU e IVA)"
};
export const REGIMENES = { total: "Sobre el subtotal (costo directo + AIU)", utilidad: "Sobre la utilidad", ninguno: "No se liquida IVA" };
export const SEVERIDADES = ["Mayor", "Menor", "Observación"];
export const CONCEPTOS = {
  favorable: "Favorable",
  ajustes: "Favorable con ajustes",
  noFavorable: "No recomendable sin ajustes"
};
export const LIMITACIONES = "La revisión es documental: se basa en el presupuesto entregado por el oferente. No incluye visita de obra, toma completa de cantidades ni cotizaciones formales de mercado. Los precios de referencia de APU PRO corresponden a la base de precios de Cinco S.A.S. vigente a la fecha de la revisión y son indicativos. La aplicabilidad del régimen de IVA sobre la utilidad debe confirmarla un profesional tributario.";
export const COLUMNAS = { item: "Ítem", desc: "Descripción", und: "Unidad", cant: "Cantidad", vu: "Valor unitario", vt: "Valor total" };

// ---------------------------------------------------------------- lectura de tablas
// Valor de una celda de ExcelJS (fórmula, texto enriquecido, hipervínculo…) a número o texto.
export function valorCelda(v) {
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return valorCelda(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return valorCelda(v.text);
    if ("error" in v) return "";
  }
  return String(v);
}
export function hojaAMatriz(ws, { maxFilas = 6000, maxCols = 30 } = {}) {
  const m = [];
  const filas = Math.min(ws.rowCount || 0, maxFilas);
  for (let r = 1; r <= filas; r++) {
    const row = ws.getRow(r), f = [];
    for (let c = 1; c <= maxCols; c++) f.push(valorCelda(row.getCell(c).value));
    m.push(f);
  }
  return recortar(m);
}
// Texto pegado desde Excel (tabulaciones) o desde un PDF (dos o más espacios, o punto y coma).
export function textoAMatriz(texto) {
  const lineas = String(texto ?? "").replace(/\r/g, "").split("\n");
  const tab = lineas.some((l) => l.includes("\t"));
  const sep = tab ? /\t/ : lineas.some((l) => l.includes(";")) ? /;/ : / {2,}/;
  return recortar(lineas.map((l) => l.split(sep).map((x) => x.trim())));
}
function recortar(m) {
  let ancho = 0;
  for (const f of m) for (let j = f.length - 1; j >= 0; j--) if (String(f[j] ?? "").trim() !== "") { ancho = Math.max(ancho, j + 1); break; }
  return m.map((f) => Array.from({ length: ancho }, (_, j) => f[j] ?? ""));
}

// Número escrito como en Colombia («1.234.567,89», «3,5») o en Excel («1234567.89»).
export function aNumero(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim().replace(/[$\s ]/g, "").replace(/^cop/i, "");
  if (!s || !/^\(?-?[\d.,]+\)?%?$/.test(s) || !/\d/.test(s)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  const pct = s.endsWith("%");
  if (pct) s = s.slice(0, -1);
  const ult = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (ult >= 0) {
    const sep = s[ult], decimales = s.length - ult - 1;
    const veces = s.split(sep).length - 1, distintos = /,/.test(s) && /\./.test(s);
    if (decimales === 3 && (veces > 1 || !distintos)) s = s.replace(/[.,]/g, "");
    else s = s.slice(0, ult).replace(/[.,]/g, "") + "." + s.slice(ult + 1);
  }
  let n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (neg) n = -n;
  return pct ? n / 100 : n;
}

const RE_COL = {
  item: /^(item|no\.?|n°|nº|num|numero|cod|codigo|apu)\b/,
  desc: /descrip|actividad|concepto|detalle/,
  und: /^(und|unid|unidad|un|u\.? ?m\.?|medida)\b/,
  cant: /^cant/,
  vu: /unit|precio\b|^v\/?r\.? ?u|^valor u|^p\.? ?u\b/,
  vt: /total|parcial|^valor$|^importe/
};
// Busca la fila de encabezados y la columna de cada dato. Si no hay encabezados, adivina
// por el contenido (texto más largo = descripción; últimas tres columnas numéricas).
export function detectarColumnas(m) {
  for (let r = 0; r < Math.min(m.length, 80); r++) {
    const col = { item: -1, desc: -1, und: -1, cant: -1, vu: -1, vt: -1 };
    m[r].forEach((v, j) => {
      const t = normalizar(v);
      if (!t || t.length > 40) return;
      for (const k of ["vu", "cant", "desc", "und", "item", "vt"]) {
        if (col[k] === -1 && RE_COL[k].test(t) && !Object.values(col).includes(j)) { col[k] = j; break; }
      }
    });
    if (col.desc >= 0 && (col.cant >= 0 || col.vu >= 0)) return { fila: r, columnas: col };
  }
  return { fila: -1, columnas: adivinarColumnas(m) };
}
function adivinarColumnas(m) {
  const muestra = m.slice(0, 200), ancho = m[0]?.length || 0;
  const largo = [], numerica = [];
  for (let j = 0; j < ancho; j++) {
    const vals = muestra.map((f) => f[j]).filter((v) => String(v ?? "").trim() !== "");
    largo.push(vals.reduce((s, v) => s + String(v).length, 0) / (vals.length || 1));
    numerica.push(vals.length && vals.filter((v) => aNumero(v) != null).length / vals.length > 0.6);
  }
  const desc = largo.indexOf(Math.max(...largo));
  const nums = numerica.map((x, j) => (x && j > desc ? j : -1)).filter((j) => j >= 0);
  const [cant, vu, vt] = nums.slice(-3);
  const und = desc + 1 < ancho && !numerica[desc + 1] ? desc + 1 : -1;
  return { item: desc > 0 ? 0 : -1, desc, und, cant: cant ?? -1, vu: vu ?? -1, vt: vt ?? -1 };
}

const RE_RESUMEN = /^(sub ?total|total|valor total|costo directo|costos? directos?|administracion|imprevistos?|utilidad|iva|a\.?\s?i\.?\s?u\.?|aiu|valor (de la )?oferta|gran total)\b/;
// Recorre la tabla desde la fila siguiente a los encabezados: las filas con descripción y sin
// cantidad ni valor unitario son capítulos; las de totales se omiten (el mayor «total» que
// aparezca se propone como total declarado).
export function extraerItems(m, { fila = -1, columnas }) {
  const c = columnas, capitulos = [], items = [], avisos = [];
  let cap = null, totalDetectado = null, n = 0;
  const txt = (f, k) => (c[k] >= 0 ? String(f[c[k]] ?? "").trim() : "");
  const num = (f, k) => (c[k] >= 0 ? aNumero(f[c[k]]) : null);
  for (let r = fila + 1; r < m.length; r++) {
    const f = m[r];
    // Algunos formatos ponen el nombre del capítulo o el subtotal en otra columna (la del ítem).
    const desc = (txt(f, "desc") || String(f.find((v) => typeof v === "string" && v.trim().length > 3 && aNumero(v) == null) ?? "").trim()).replace(/\s+/g, " ");
    const nd = normalizar(desc);
    const vt = num(f, "vt");
    if (!desc) continue;
    if (RE_RESUMEN.test(nd)) {
      if (/^(total|valor total|gran total|valor (de la )?oferta)/.test(nd) && vt != null) totalDetectado = Math.max(totalDetectado || 0, vt);
      continue;
    }
    const cant = num(f, "cant"), vu = num(f, "vu"), codigo = txt(f, "item");
    if (cant == null && vu == null) {
      if (desc.length > 160) continue;
      cap = { num: codigo && codigo !== desc && codigo.length <= 12 ? codigo : String(capitulos.length + 1), nombre: desc };
      capitulos.push(cap);
      continue;
    }
    n++;
    const it = { id: `i${n}`, cap: cap ? cap.num : capituloDeCodigo(codigo), item: codigo || String(n), desc, und: txt(f, "und"), cant, vu, vt, fila: r + 1 };
    if (it.vt == null && cant != null && vu != null) { it.vt = Math.round(cant * vu); it.vtCalculado = true; }
    items.push(it);
  }
  if (!capitulos.length) {
    const vistos = [...new Set(items.map((it) => it.cap))];
    for (const k of vistos) capitulos.push({ num: k, nombre: vistos.length > 1 ? `Capítulo ${k}` : "Presupuesto" });
  }
  if (!items.length) avisos.push("No se encontraron ítems: revisa la fila de encabezados y las columnas.");
  return { capitulos, items, totalDetectado, avisos };
}
function capituloDeCodigo(codigo) {
  const m = String(codigo || "").match(/^\s*([A-Za-z]?\d+)[.\-_ ]/);
  return m ? m[1] : "1";
}

// ---------------------------------------------------------------- referencia en la biblioteca de APU
const VACIAS = new Set("de del la las el los en y o a al para con por sin e incluye incluido incluida suministro suministrar instalacion instalar montaje transporte tipo segun similar cada".split(" "));
const UNIDADES = { m: "m", ml: "m", mt: "m", mts: "m", metro: "m", metros: "m", m2: "m2", "m²": "m2", mt2: "m2", m3: "m3", "m³": "m3", und: "und", un: "und", u: "und", unidad: "und", unid: "und", kg: "kg", gl: "gl", global: "gl", glb: "gl", ls: "gl" };
const unidadNorm = (u) => UNIDADES[normalizar(u).replace(/[.\s]/g, "")] || normalizar(u).replace(/[.\s]/g, "");
function fichas(texto) {
  const t = normalizar(texto).replace(/(\d),(\d)/g, "$1.$2").replace(/[^a-z0-9./ ]/g, " ");
  const palabras = t.split(/\s+/).filter((w) => w && !VACIAS.has(w) && w.length > 1 || /^\d/.test(w));
  return { todas: new Set(palabras), numeros: new Set(palabras.filter((w) => /^\d/.test(w))) };
}
// Índice de la biblioteca para sugerir el APU más parecido a cada ítem.
export function indiceApus(apus) {
  return apus.map((a) => ({ codigo: a.codigo, nombre: a.nombre, unidad: unidadNorm(a.unidad), f: fichas(a.nombre) }));
}
export function sugerirApus(it, indice, cuantos = 3) {
  const f = fichas(it.desc), u = unidadNorm(it.und);
  if (!f.todas.size) return [];
  const res = [];
  for (const a of indice) {
    let comunes = 0;
    for (const w of f.todas) if (a.f.todas.has(w)) comunes++;
    if (!comunes) continue;
    let s = (2 * comunes) / (f.todas.size + a.f.todas.size);
    if (f.numeros.size && a.f.numeros.size) {
      let iguales = 0;
      for (const x of f.numeros) if (a.f.numeros.has(x)) iguales++;
      if (iguales < Math.min(f.numeros.size, a.f.numeros.size)) s *= 0.6;
    }
    if (u && a.unidad) s += u === a.unidad ? 0.1 : -0.15;
    if (s >= 0.25) res.push({ codigo: a.codigo, nombre: a.nombre, puntaje: Math.min(1, s) });
  }
  return res.sort((x, y) => y.puntaje - x.puntaje).slice(0, cuantos);
}

// ---------------------------------------------------------------- verificaciones
const pesosTxt = (v) => { const n = Math.round(Number(v) || 0); return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-CO"); };
const pctTxt = (v, d = 1) => `${(Number(v) * 100).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const lista = (its, max = 12) => {
  const c = its.map((it) => it.item);
  return c.length > max ? `${c.slice(0, max).join(", ")} y ${c.length - max} más` : c.join(", ");
};

// Factores para pasar de los valores de los ítems al costo directo y al valor final.
export function factores(rev) {
  const aiu = rev.aiu || { a: 0, i: 0, u: 0 }, iva = Number(rev.iva) || 0, A = (aiu.a || 0) + (aiu.i || 0) + (aiu.u || 0);
  const reg = rev.regimenIva || "total";
  const final = 1 + A + iva * (reg === "total" ? 1 + A : reg === "utilidad" ? aiu.u || 0 : 0);
  const base = rev.base === "conAiu" ? 1 + A : rev.base === "final" ? final : 1;
  return { aiu, iva, A, reg, final, base, aFinal: final / base };
}

// precioApu(codigo) → costo directo del APU en APU PRO (o null).
export function revisar(rev, { precioApu = () => null } = {}) {
  const items = rev.items || [];
  const F = factores(rev);
  const valor = (it) => (it.vt != null ? Number(it.vt) : (Number(it.cant) || 0) * (Number(it.vu) || 0));
  const sumaItems = items.reduce((s, it) => s + valor(it), 0);
  const cd = sumaItems / F.base;
  const comp = { cd, a: cd * (F.aiu.a || 0), i: cd * (F.aiu.i || 0), u: cd * (F.aiu.u || 0) };
  comp.subtotal = cd * (1 + F.A);
  comp.total = cd * F.final;
  comp.iva = comp.total - comp.subtotal;
  const total = comp.total;
  const declarado = Number(rev.totalDeclarado) || 0;
  const valorFinal = declarado || total;

  const capitulos = (rev.capitulos || []).map((c) => {
    const its = items.filter((it) => String(it.cap) === String(c.num));
    const v = its.reduce((s, it) => s + valor(it), 0);
    return { ...c, n: its.length, valor: v, final: v * F.aFinal, pct: total ? (v * F.aFinal) / total : 0 };
  });
  const sinCap = items.filter((it) => !(rev.capitulos || []).some((c) => String(c.num) === String(it.cap)));
  if (sinCap.length) capitulos.push({ num: "—", nombre: "Sin capítulo", n: sinCap.length, valor: sinCap.reduce((s, it) => s + valor(it), 0), final: sinCap.reduce((s, it) => s + valor(it), 0) * F.aFinal, pct: 0 });

  const V = [], porItem = {};
  const marcar = (its, clave) => its.forEach((it) => (porItem[it.id] ||= []).push(clave));
  const agregar = (v) => { V.push(v); if (v.estado === "hallazgo") marcar(v.itemsRef || [], v.clave); };

  // 1. Aritmética de cada ítem
  const conDatos = items.filter((it) => it.cant != null && it.vu != null && it.vt != null && !it.vtCalculado);
  const errores = conDatos.filter((it) => Math.abs(it.cant * it.vu - it.vt) > Math.max(1, Math.abs(it.cant) * 0.5 + 1, Math.abs(it.vt) * 0.001));
  if (errores.length) {
    const dif = errores.reduce((s, it) => s + (it.vt - it.cant * it.vu), 0) * F.aFinal;
    agregar({ clave: "aritmetica", titulo: "Aritmética de los ítems", estado: "hallazgo", sev: Math.abs(dif) > valorFinal * 0.005 ? "Mayor" : "Menor", tema: "Aritmética",
      texto: `En ${errores.length} ítem(s) la cantidad por el valor unitario no da el valor total registrado (${lista(errores)}). La diferencia neta es de ${pesosTxt(dif)} en el valor final (positiva: se cobra de más).`,
      itemsRef: errores, impacto: dif, accion: "Pedir al oferente que corrija los valores totales de los ítems y el total de la oferta." });
  } else if (conDatos.length) agregar({ clave: "aritmetica", titulo: "Aritmética de los ítems", estado: "ok", texto: `Las ${conDatos.length} operaciones de cantidad por valor unitario son correctas.` });

  // 2. Ítems incompletos
  const incompletos = items.filter((it) => !(Number(it.cant) > 0) || !(Number(it.vu) > 0) || !String(it.und || "").trim());
  if (incompletos.length) agregar({ clave: "incompletos", titulo: "Ítems incompletos", estado: "hallazgo", sev: "Menor", tema: "Consistencia",
    texto: `${incompletos.length} ítem(s) no tienen unidad, cantidad o valor unitario (${lista(incompletos)}).`, itemsRef: incompletos, impacto: null,
    accion: "Completar la unidad, la cantidad y el valor unitario de cada ítem." });
  else if (items.length) agregar({ clave: "incompletos", titulo: "Ítems completos", estado: "ok", texto: "Todos los ítems tienen unidad, cantidad y valor unitario." });

  // 3. Total declarado
  if (declarado > 0 && items.length) {
    const dif = declarado - total;
    if (Math.abs(dif) > Math.max(1000, declarado * 0.0005)) agregar({ clave: "total", titulo: "Total declarado", estado: "hallazgo", sev: Math.abs(dif) > declarado * 0.005 ? "Mayor" : "Menor", tema: "Aritmética",
      texto: `El total declarado (${pesosTxt(declarado)}) no coincide con la suma de los ítems con el AIU y el IVA declarados (${pesosTxt(total)}): diferencia de ${pesosTxt(dif)}.`, itemsRef: [], impacto: dif,
      accion: "Pedir al oferente la conciliación del total de la oferta con el presupuesto por ítems." });
    else agregar({ clave: "total", titulo: "Total declarado", estado: "ok", texto: `El total declarado (${pesosTxt(declarado)}) coincide con la suma de los ítems más el AIU y el IVA.` });
  }

  // 4. Régimen del IVA
  if (!items.length) agregar({ clave: "sinItems", titulo: "Sin ítems", estado: "info", texto: "Importa la tabla del presupuesto para revisarla." });
  else if (F.reg === "total" && F.iva > 0 && F.A > 0) {
    const ahorro = cd * F.iva * (1 + (F.aiu.a || 0) + (F.aiu.i || 0));
    agregar({ clave: "iva", titulo: "IVA sobre todo el subtotal", estado: "hallazgo", sev: "Mayor", tema: "IVA",
      texto: `El IVA del ${pctTxt(F.iva, 0)} se liquida sobre el costo directo más el AIU (${pesosTxt(comp.iva)}). En los contratos de construcción de inmuebles pactados con AIU el IVA se genera sobre la utilidad (Decreto 1372 de 1992, art. 3; DUR 1625 de 2016, art. 1.3.1.7.9), si el contrato califica como tal. Liquidado sobre la utilidad, el valor bajaría en ${pesosTxt(ahorro)}.`,
      itemsRef: [], impacto: ahorro, accion: "Definir con el área tributaria del contratante el régimen de IVA aplicable y pedir al oferente que declare si los precios de los insumos incluyen IVA." });
  } else if (F.reg === "utilidad") agregar({ clave: "iva", titulo: "IVA sobre la utilidad", estado: "ok", texto: "El IVA se liquida sobre la utilidad, como corresponde a un contrato con AIU." });
  else agregar({ clave: "iva", titulo: "IVA", estado: "info", texto: F.reg === "ninguno" ? "La oferta no liquida IVA: confirmar que el oferente no sea responsable de IVA o que los precios lo incluyan." : "La oferta no declara AIU: el IVA se liquida sobre el valor de los ítems." });

  // 5. AIU
  const { a = 0, i = 0, u = 0 } = F.aiu;
  if (a > 0.2 || i > 0.05 || u > 0.1 || F.A > 0.35) agregar({ clave: "aiu", titulo: "AIU por encima de los valores de referencia", estado: "hallazgo", sev: "Observación", tema: "AIU",
    texto: `El AIU declarado (A ${pctTxt(a)}, I ${pctTxt(i)}, U ${pctTxt(u)}; total ${pctTxt(F.A)}) supera alguno de los valores de referencia de Cinco S.A.S. (A hasta 20 %, I hasta 5 %, U hasta 10 %).`,
    itemsRef: [], impacto: null, accion: "Pedir el análisis de la administración (personal, pólizas, impuestos) que justifica el porcentaje." });
  else if (F.A > 0) agregar({ clave: "aiu", titulo: "AIU", estado: "ok", texto: `El AIU declarado (A ${pctTxt(a)}, I ${pctTxt(i)}, U ${pctTxt(u)}) está dentro de los valores de referencia.` });
  else agregar({ clave: "aiu", titulo: "AIU", estado: "info", texto: "No se registró el AIU de la oferta (Datos y AIU)." });

  // 6. Ítems repetidos y mismo ítem con precios distintos
  const grupos = new Map();
  for (const it of items) {
    const k = `${normalizar(it.desc).replace(/[^a-z0-9]+/g, " ").trim()}|${unidadNorm(it.und)}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(it);
  }
  // Repetir un ítem en capítulos distintos es normal (un frente o un circuito por capítulo);
  // repetirlo dentro del mismo capítulo puede ser una cantidad cobrada dos veces.
  const repetidos = [], distintos = [];
  let vRep = 0, vDist = 0;
  for (const g of grupos.values()) {
    if (g.length < 2) continue;
    const vus = g.map((it) => Number(it.vu) || 0), min = Math.min(...vus), max = Math.max(...vus);
    if (min > 0 && max / min > 1.01) { distintos.push(...g); vDist += g.reduce((s, it) => s + ((Number(it.vu) || 0) - min) * (Number(it.cant) || 0), 0) * F.aFinal; }
    const porCap = new Map();
    for (const it of g) { if (!porCap.has(String(it.cap))) porCap.set(String(it.cap), []); porCap.get(String(it.cap)).push(it); }
    for (const gc of porCap.values()) if (gc.length > 1) { repetidos.push(...gc); vRep += gc.slice(1).reduce((s, it) => s + valor(it), 0) * F.aFinal; }
  }
  if (distintos.length) agregar({ clave: "precioDistinto", titulo: "Mismo ítem con precios distintos", estado: "hallazgo", sev: "Menor", tema: "Consistencia",
    texto: `${distintos.length} ítems con la misma descripción y unidad tienen valores unitarios distintos según el capítulo (${lista(distintos)}). Llevados al menor precio, el valor bajaría en ${pesosTxt(vDist)}.`,
    itemsRef: distintos, impacto: vDist, accion: "Pedir la justificación de la diferencia o unificar el precio en el menor valor." });
  if (repetidos.length) agregar({ clave: "repetidos", titulo: "Ítems repetidos en un mismo capítulo", estado: "hallazgo", sev: "Menor", tema: "Cantidades",
    texto: `${repetidos.length} ítems aparecen más de una vez con la misma descripción y unidad dentro de un mismo capítulo (${lista(repetidos)}); pueden ser cantidades cobradas dos veces. Las repeticiones suman ${pesosTxt(vRep)}.`,
    itemsRef: repetidos, impacto: null, impactoTexto: `Hasta ${pesosTxt(vRep)}`, accion: "Verificar en planos o memorias que cada repetición corresponda a una cantidad distinta; retirar las duplicadas." });
  if (!distintos.length && !repetidos.length && items.length) agregar({ clave: "repetidos", titulo: "Ítems repetidos", estado: "ok", texto: "No hay ítems repetidos dentro de un capítulo ni ítems iguales con precios distintos." });

  // 7. Partidas globales
  const globales = items.filter((it) => unidadNorm(it.und) === "gl");
  if (globales.length) {
    const v = globales.reduce((s, it) => s + valor(it), 0) * F.aFinal;
    agregar({ clave: "globales", titulo: "Partidas globales", estado: "hallazgo", sev: v > valorFinal * 0.05 ? "Menor" : "Observación", tema: "Alcance",
      texto: `${globales.length} ítem(s) se cobran como global (${lista(globales)}), por ${pesosTxt(v)} (${pctTxt(valorFinal ? v / valorFinal : 0)} de la oferta): su precio no se puede verificar sin el desglose.`,
      itemsRef: globales, impacto: null, impactoTexto: `${pesosTxt(v)} sin desglose`, accion: "Pedir el APU o el desglose de cantidades y precios de cada partida global." });
  }

  // 8. Concentración del valor
  const orden = [...items].sort((x, y) => valor(y) - valor(x));
  let acum = 0, n80 = 0;
  for (const it of orden) { if (acum >= sumaItems * 0.8) break; acum += valor(it); n80++; }
  const pesados = orden.filter((it) => sumaItems && valor(it) / sumaItems > 0.1);
  const pareto = { n80, pct: items.length ? n80 / items.length : 0, top: orden.slice(0, 10).map((it) => ({ ...it, final: valor(it) * F.aFinal, pct: sumaItems ? valor(it) / sumaItems : 0 })) };
  if (pesados.length) agregar({ clave: "concentracion", titulo: "Ítems de alto peso", estado: "hallazgo", sev: "Observación", tema: "Concentración",
    texto: `${pesados.length} ítem(s) pesan cada uno más del 10 % de la oferta (${pesados.map((it) => `${it.item}: ${pctTxt(valor(it) / sumaItems)}`).join("; ")}); su cantidad y su precio deben verificarse con prioridad.`,
    itemsRef: pesados, impacto: null, accion: "Pedir el soporte de cantidades y cotizaciones de estos ítems." });
  if (items.length) agregar({ clave: "pareto", titulo: "Concentración del valor", estado: "info", texto: `${n80} de ${items.length} ítems (${pctTxt(pareto.pct)}) concentran el 80 % del valor: son los que conviene revisar primero.` });

  // 9. Comparación con la biblioteca de APU PRO
  const comparados = [];
  for (const it of items) {
    if (!it.ref?.codigo || !it.ref.confirmada || !(Number(it.vu) > 0)) continue;
    const cdRef = precioApu(it.ref.codigo);
    if (!(cdRef > 0)) continue;
    const ref = cdRef * F.base;
    const dif = it.vu / ref - 1;
    const estado = dif > 0.2 ? "Por encima" : dif < -0.2 ? "Por debajo" : "En rango";
    const exceso = estado === "Por encima" ? (it.vu - ref * 1.2) * (Number(it.cant) || 0) * F.aFinal : 0;
    comparados.push({ id: it.id, item: it.item, desc: it.desc, und: it.und, cant: it.cant, vu: it.vu, codigo: it.ref.codigo, ref, dif, estado, exceso });
  }
  const encima = comparados.filter((c) => c.estado === "Por encima"), debajo = comparados.filter((c) => c.estado === "Por debajo");
  const vExceso = encima.reduce((s, c) => s + c.exceso, 0);
  if (encima.length) agregar({ clave: "precios", titulo: "Precios por encima de APU PRO", estado: "hallazgo", sev: vExceso > valorFinal * 0.01 ? "Mayor" : "Menor", tema: "Precios",
    texto: `De ${comparados.length} ítems comparados con los APU de Cinco S.A.S., ${encima.length} superan en más del 20 % el precio de referencia (${encima.slice(0, 8).map((c) => `${c.item} +${Math.round(c.dif * 100)} %`).join("; ")}${encima.length > 8 ? "; …" : ""}). El exceso sobre el precio de referencia más un 20 % es de ${pesosTxt(vExceso)} en el valor final.`,
    itemsRef: items.filter((it) => encima.some((c) => c.id === it.id)), impacto: vExceso, accion: "Pedir al oferente los APU y las cotizaciones de soporte de estos ítems y ajustar los precios." });
  if (debajo.length) agregar({ clave: "preciosBajos", titulo: "Precios por debajo de APU PRO", estado: "hallazgo", sev: "Observación", tema: "Precios",
    texto: `${debajo.length} ítem(s) están más de un 20 % por debajo del precio de referencia (${debajo.slice(0, 8).map((c) => `${c.item} ${Math.round(c.dif * 100)} %`).join("; ")}): puede tratarse de una especificación menor o de un riesgo de reclamaciones posteriores.`,
    itemsRef: items.filter((it) => debajo.some((c) => c.id === it.id)), impacto: null, accion: "Confirmar la especificación (marca, referencia) de estos ítems." });
  if (comparados.length && !encima.length && !debajo.length) agregar({ clave: "precios", titulo: "Precios frente a APU PRO", estado: "ok", texto: `Los ${comparados.length} ítems comparados con los APU de Cinco S.A.S. están dentro de un ±20 % del precio de referencia.` });
  if (!comparados.length) agregar({ clave: "precios", titulo: "Precios frente a APU PRO", estado: "info", texto: "Ningún ítem tiene un APU de referencia confirmado: asígnalos en la pestaña Ítems para comparar precios." });

  return { F, sumaItems, comp, total, declarado, valorFinal, capitulos, verificaciones: V, porItem, pareto, comparados, vExceso };
}

// ---------------------------------------------------------------- hallazgos consolidados
// Automáticos (con los ajustes del revisor) + manuales, ordenados por severidad y numerados
// H-01… (Mayor y Menor) y OB-01… (observaciones), como en las revisiones anteriores.
export function hallazgosRevision(rev, res) {
  const aj = rev.ajustes || {};
  const auto = res.verificaciones.filter((v) => v.estado === "hallazgo").map((v) => {
    const a = aj[v.clave] || {};
    return { clave: v.clave, origen: "auto", incluir: a.incluir !== false, sev: a.sev || v.sev, tema: v.tema, hallazgo: a.comentario ? `${v.texto} ${a.comentario}` : v.texto,
      items: v.itemsRef?.length ? lista(v.itemsRef, 20) : "Todos", impacto: v.impacto, impactoTexto: v.impactoTexto || "", accion: a.accion || v.accion, titulo: v.titulo };
  });
  const manuales = (rev.hallazgos || []).map((h) => ({ ...h, clave: h.id, origen: "manual", incluir: h.incluir !== false, impacto: h.impacto == null || h.impacto === "" ? null : Number(h.impacto), impactoTexto: h.impactoTexto || "" }));
  const orden = { Mayor: 0, Menor: 1, "Observación": 2 };
  const todos = [...auto, ...manuales].sort((x, y) => (orden[x.sev] ?? 3) - (orden[y.sev] ?? 3) || (Math.abs(y.impacto || 0) - Math.abs(x.impacto || 0)));
  let h = 0, ob = 0;
  for (const x of todos) if (x.incluir) x.numero = x.sev === "Observación" ? `OB-${String(++ob).padStart(2, "0")}` : `H-${String(++h).padStart(2, "0")}`;
  return todos;
}
export const impactoTexto = (h) => (h.impacto != null && Number.isFinite(h.impacto) && h.impacto !== 0 ? pesosTxt(h.impacto) : h.impactoTexto || "-");

// Resumen que se guarda con la revisión (para el listado).
export function resumenRevision(rev, res, hallazgos) {
  const inc = hallazgos.filter((h) => h.incluir);
  return { items: (rev.items || []).length, total: Math.round(res.valorFinal || 0), mayores: inc.filter((h) => h.sev === "Mayor").length, menores: inc.filter((h) => h.sev === "Menor").length, observaciones: inc.filter((h) => h.sev === "Observación").length };
}

// ---------------------------------------------------------------- informe RD para Informes
// Las fuentes estándar del PDF de Informes no tienen emoji ni algunos símbolos.
export function textoSeguro(s) {
  return String(s ?? "").replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/≈/g, "aprox.").replace(/[→]/g, "->").replace(/[←]/g, "<-").replace(/Ω/g, "ohm").replace(/[✓✔]/g, "").replace(/[✕✖]/g, "x").replace(/⚠/g, "").replace(/√/g, "raíz").replace(/−/g, "-").replace(/±/g, "+/-").replace(/\s{2,}/g, " ").trim();
}
const escH = (s) => textoSeguro(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function informeRD(rev, res, hallazgos, { firmaNombre = "", firmaCargo = "" } = {}) {
  const T = (titulo, filas, nota = "") => ({ tipo: "tabla", titulo: textoSeguro(titulo), nota: textoSeguro(nota), filasEncabezado: 1, merges: [], centrados: [], filas: filas.map((f) => f.map((c) => textoSeguro(c))) });
  const H1 = (t) => ({ tipo: "titulo1", texto: textoSeguro(t) });
  const H2 = (t) => ({ tipo: "titulo2", texto: textoSeguro(t) });
  const P = (t) => ({ tipo: "parrafo", texto: t });
  const inc = hallazgos.filter((h) => h.incluir), F = res.F, items = rev.items || [];
  const oferta = `${escH(rev.nombre || "presupuesto")}${rev.oferente ? ` presentada por ${escH(rev.oferente)}` : ""}${rev.cliente ? ` a ${escH(rev.cliente)}` : ""}`;
  const fechaOf = rev.fechaOferta ? ` (versión del ${fechaLarga(rev.fechaOferta)})` : "";
  const conformes = res.verificaciones.filter((v) => v.estado === "ok");
  const conImpacto = inc.filter((h) => h.impacto && Number.isFinite(h.impacto) && h.impacto > 0 || h.impactoTexto);
  const bloques = [
    H1("Objeto y alcance de la revisión"),
    P(rev.objeto ? escH(rev.objeto) : `El presente informe consigna la revisión objetiva del presupuesto de la <b>${oferta}</b>${fechaOf}, por un valor total de ${pesosTxt(res.valorFinal)}${F.reg === "ninguno" ? "" : " IVA incluido"}.`),
    P("La revisión verifica la aritmética del presupuesto, la coherencia entre ítems, la estructura del AIU y del IVA, la concentración del valor y la razonabilidad de los precios unitarios frente a los análisis de precios unitarios (APU) de Cinco S.A.S. elaborados en APU PRO."),
    H1("Documento revisado"),
    T("Datos de la oferta", [
      ["Dato", "Valor"],
      ["Oferta", rev.nombre || "-"], ["Oferente", rev.oferente || "-"], ["Contratante", rev.cliente || "-"],
      ["Fecha de la oferta", rev.fechaOferta ? fechaLarga(rev.fechaOferta) : "-"], ["Documento", rev.documento || "-"],
      ["Capítulos / ítems", `${res.capitulos.length} / ${items.length}`],
      ["Los valores de los ítems son", BASES[rev.base || "cd"]],
      ["AIU", `A ${pctTxt(F.aiu.a || 0)} - I ${pctTxt(F.aiu.i || 0)} - U ${pctTxt(F.aiu.u || 0)}`],
      ["IVA", F.iva ? `${pctTxt(F.iva, 0)} ${minuscula(REGIMENES[F.reg])}` : "No se liquida"]
    ]),
    H1("Metodología"),
    P("Se importó la tabla del presupuesto y se recalcularon el valor de cada ítem (cantidad por valor unitario), los subtotales por capítulo, el costo directo, el AIU, el IVA y el total. Se buscaron ítems incompletos, repetidos o con precios distintos, partidas globales e ítems de alto peso, y se compararon los precios unitarios de los ítems con un APU equivalente en la biblioteca de Cinco S.A.S. Los hallazgos se califican así:"),
    T("Criterios de calificación", [
      ["Severidad", "Significado"],
      ["Mayor", "Afecta de forma importante el valor o el alcance; debe resolverse antes de contratar."],
      ["Menor", "Debe corregirse o aclararse; impacto económico acotado."],
      ["Observación", "Aspecto a tener en cuenta en la contratación o la ejecución."]
    ]),
    H1("Resumen económico de la oferta"),
    T("Valor por capítulo", [
      ["Cap.", "Descripción", "Ítems", "Valor final", "% del total"],
      ...res.capitulos.map((c) => [String(c.num), c.nombre, String(c.n), pesosTxt(c.final), pctTxt(c.pct)]),
      ["", "Total", String(items.length), pesosTxt(res.total), "100,0 %"]
    ], "Valor final de cada capítulo con el AIU y el IVA de la oferta."),
    T("Composición del valor", [
      ["Componente", "Valor", "% del costo directo"],
      ["Costo directo", pesosTxt(res.comp.cd), "100,0 %"],
      [`Administración ${pctTxt(F.aiu.a || 0)}`, pesosTxt(res.comp.a), pctTxt(F.aiu.a || 0)],
      [`Imprevistos ${pctTxt(F.aiu.i || 0)}`, pesosTxt(res.comp.i), pctTxt(F.aiu.i || 0)],
      [`Utilidad ${pctTxt(F.aiu.u || 0)}`, pesosTxt(res.comp.u), pctTxt(F.aiu.u || 0)],
      [`IVA ${F.iva ? pctTxt(F.iva, 0) + " " + minuscula(REGIMENES[F.reg]) : ""}`, pesosTxt(res.comp.iva), pctTxt(res.comp.cd ? res.comp.iva / res.comp.cd : 0)],
      ["Total recalculado", pesosTxt(res.total), pctTxt(res.comp.cd ? res.total / res.comp.cd : 0)],
      ...(res.declarado ? [["Total declarado en la oferta", pesosTxt(res.declarado), ""]] : [])
    ]),
    H1("Resumen de resultados"),
    P(`Se verificaron ${items.length} ítems en ${res.capitulos.length} capítulos. Resultado: ${inc.filter((h) => h.sev === "Mayor").length} hallazgos mayores, ${inc.filter((h) => h.sev === "Menor").length} menores y ${inc.filter((h) => h.sev === "Observación").length} observaciones. ${res.pareto.n80} ítems (${pctTxt(res.pareto.pct)}) concentran el 80 % del valor.`),
    ...(conImpacto.length ? [T("Impactos estimados sobre el valor final", [["Hallazgo", "Concepto", "Tema", "Valor estimado"], ...conImpacto.map((h) => [h.numero, h.titulo || h.tema, h.tema, impactoTexto(h)])], "Los impactos pueden superponerse entre sí y no deben sumarse sin revisarlos; los alcances por justificar no son ahorros seguros: dependen de la respuesta del oferente.")] : []),
    H1("Resultados de la revisión"),
    ...(conformes.length ? [H2("Aspectos verificados conformes"), P(conformes.map((v) => `• ${escH(v.texto)}`).join("<br>"))] : []),
    ...inc.flatMap((h) => [H2(`${h.numero}. ${h.titulo || h.tema}`), P(`${escH(h.hallazgo)}<br><b>Acción requerida:</b> ${escH(h.accion || "-")}`)]),
    ...(res.comparados.length ? [T("Ítems comparados con los APU de Cinco S.A.S.", [
      ["Ítem", "Descripción", "Und", "Cantidad", "Precio oferta", "Referencia APU PRO", "Diferencia", "Estado"],
      ...res.comparados.map((c) => [c.item, c.desc.length > 90 ? c.desc.slice(0, 87) + "..." : c.desc, c.und || "", numTxt(c.cant), pesosTxt(c.vu), `${pesosTxt(c.ref)} (${c.codigo})`, `${c.dif >= 0 ? "+" : ""}${Math.round(c.dif * 100)} %`, c.estado])
    ], `Referencia: costo directo del APU de Cinco S.A.S. con los precios vigentes de la base de APU PRO${rev.base === "cd" ? "" : ", llevado a la misma base de la oferta"}. Se considera en rango una diferencia de hasta +/-20 %.`)] : []),
    H1("Consolidado de hallazgos"),
    T("Hallazgos y acciones requeridas", [
      ["No.", "Hallazgo", "Ítems", "Severidad", "Impacto estimado", "Acción requerida"],
      ...inc.map((h) => [h.numero, h.hallazgo, String(h.items || "-").length > 60 ? String(h.items).slice(0, 57) + "..." : String(h.items || "-"), h.sev, impactoTexto(h), h.accion || "-"])
    ], "Impacto estimado sobre el valor final (con AIU e IVA). El detalle ítem por ítem está en el archivo Excel anexo."),
    H1("Concepto de la revisión"),
    P(`<b>Concepto: ${escH((CONCEPTOS[rev.concepto] || conceptoSugerido(inc)).toUpperCase())}.</b>`),
    ...(rev.conceptoTexto ? [P(escH(rev.conceptoTexto))] : []),
    ...(rev.recomendaciones ? [P(escH(rev.recomendaciones))] : []),
    H1("Limitaciones"),
    P(escH(rev.limitaciones || LIMITACIONES))
  ];
  return {
    titulo: textoSeguro(`Revisión de presupuesto - ${rev.nombre || rev.codigo}${rev.fechaOferta ? ` (${rev.fechaOferta.split("-").reverse().join("-")})` : ""}`),
    tipoInforme: "revisionDisenos", portada: "oscura", mes: (rev.fechaRevision || new Date().toISOString()).slice(0, 7),
    firmaNombre: textoSeguro(firmaNombre), firmaCargo: textoSeguro(firmaCargo), bloques
  };
}
export function conceptoSugerido(inc) {
  return inc.some((h) => h.sev === "Mayor") ? CONCEPTOS.noFavorable : inc.some((h) => h.sev === "Menor") ? CONCEPTOS.ajustes : CONCEPTOS.favorable;
}
function fechaLarga(iso) {
  const M = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return y && m && d ? `${d} de ${M[m - 1]} de ${y}` : String(iso);
}
const minuscula = (s) => String(s).replace(/^./, (c) => c.toLowerCase());
const numTxt = (v) => (v == null ? "-" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: 2 }));

// ---------------------------------------------------------------- Excel de detalle
const AZUL = "FF1F2732", AMBAR = "FFFEB209", GRIS = "FFF3F4F6";
const SEV_COLOR = { Mayor: "FFF8CBAD", Menor: "FFFFE699", "Observación": "FFDDEBF7" };
const MONEDA = '"$"#,##0';
const BORDE = { style: "thin", color: { argb: "FFD0D5DD" } };
// Ancho proporcional al contenido real (encabezado y percentil 80 de las celdas).
function anchos(enc, filas, { min = 6, max = 70 } = {}) {
  return enc.map((h, j) => {
    const l = filas.map((f) => String(f[j] ?? "").length).sort((a, b) => a - b);
    const p80 = l.length ? l[Math.min(l.length - 1, Math.floor(l.length * 0.8))] : 0;
    return Math.max(min, Math.min(max, Math.max(String(h).split(" ").reduce((m, w) => Math.max(m, w.length), 0) + 2, p80 + 2)));
  });
}
function hoja(wb, nombre, titulo, cols, filas, { colorFila, anchoMax } = {}) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 3 }] });
  const t = ws.getCell(1, 1);
  t.value = titulo; t.font = { bold: true, size: 13, color: { argb: AZUL } };
  const w = anchos(cols.map((c) => c.h), filas.map((f) => f.map((v, j) => (cols[j].n === MONEDA && typeof v === "number" ? pesosTxt(v) : typeof v === "object" && v ? "" : v))), { max: anchoMax || 70 });
  cols.forEach((c, j) => { ws.getColumn(j + 1).width = c.w || w[j]; });
  const hr = ws.getRow(3);
  cols.forEach((c, j) => {
    const cel = hr.getCell(j + 1);
    cel.value = c.h; cel.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    cel.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cel.border = { top: BORDE, left: BORDE, bottom: { style: "medium", color: { argb: AMBAR } }, right: BORDE };
  });
  hr.height = 30;
  filas.forEach((f, k) => {
    const row = ws.addRow(f);
    row.eachCell({ includeEmpty: true }, (cel, j) => {
      const c = cols[j - 1];
      if (!c) return;
      cel.border = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
      cel.alignment = { vertical: "top", wrapText: !!c.wrap, horizontal: c.al || (c.n ? "right" : "left") };
      if (c.n) cel.numFmt = c.n;
    });
    const col = colorFila?.(f, k);
    if (col) row.eachCell({ includeEmpty: true }, (cel) => { cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col } }; });
  });
  return ws;
}

export function libroRevision(ExcelJS, rev, res, hallazgos, { logo = null } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CINCO S.A.S. - APU PRO";
  const F = res.F, inc = hallazgos.filter((h) => h.incluir), items = rev.items || [];
  const titulo = `Revisión de presupuesto - ${rev.nombre || rev.codigo}${rev.oferente ? ` (${rev.oferente})` : ""}`;

  const wsR = hoja(wb, "Resumen", titulo,
    [{ h: "Cap." , al: "center" }, { h: "Descripción", wrap: true }, { h: "Ítems", al: "center" }, { h: "Valor de los ítems", n: MONEDA }, { h: "Valor final", n: MONEDA }, { h: "% del total", n: "0.0%" }],
    [...res.capitulos.map((c) => [c.num, c.nombre, c.n, Math.round(c.valor), Math.round(c.final), c.pct]),
      ["", "Total", items.length, Math.round(res.sumaItems), Math.round(res.total), 1]],
    { colorFila: (f) => (f[1] === "Total" ? GRIS : null), anchoMax: 60 });
  wsR.getRow(wsR.rowCount).font = { bold: true };
  const r0 = wsR.rowCount + 2;
  const filasComp = [["Costo directo", res.comp.cd], [`Administración ${pctTxt(F.aiu.a || 0)}`, res.comp.a], [`Imprevistos ${pctTxt(F.aiu.i || 0)}`, res.comp.i], [`Utilidad ${pctTxt(F.aiu.u || 0)}`, res.comp.u], [`IVA ${F.iva ? pctTxt(F.iva, 0) + " " + minuscula(REGIMENES[F.reg]) : ""}`, res.comp.iva], ["Total recalculado", res.total], ...(res.declarado ? [["Total declarado", res.declarado], ["Diferencia", res.declarado - res.total]] : [])];
  filasComp.forEach(([k, v], j) => {
    const row = wsR.getRow(r0 + j);
    row.getCell(2).value = k; row.getCell(5).value = Math.round(v); row.getCell(5).numFmt = MONEDA;
    if (/^Total/.test(k)) row.font = { bold: true };
  });
  if (logo) {
    const id = wb.addImage({ base64: logo, extension: "png" });
    wsR.addImage(id, { tl: { col: 6.2, row: 0.1 }, ext: { width: 150, height: 42 } });
  }

  hoja(wb, "Hallazgos", "Hallazgos y acciones requeridas",
    [{ h: "No.", al: "center" }, { h: "Severidad", al: "center" }, { h: "Tema" }, { h: "Hallazgo", wrap: true }, { h: "Ítems", wrap: true, w: 28 }, { h: "Impacto estimado", n: MONEDA, w: 22 }, { h: "Acción requerida", wrap: true }],
    inc.map((h) => [h.numero, h.sev, h.tema, h.hallazgo, h.items, h.impacto != null && Number.isFinite(h.impacto) && h.impacto !== 0 ? Math.round(h.impacto) : h.impactoTexto || "-", h.accion || "-"]),
    { colorFila: (f) => SEV_COLOR[f[1]], anchoMax: 60 });

  const numeros = Object.fromEntries(inc.map((h) => [h.clave, h.numero]));
  const comp = Object.fromEntries(res.comparados.map((c) => [c.id, c]));
  const wsI = hoja(wb, "Ítems", "Presupuesto de la oferta, ítem por ítem",
    [{ h: "Cap.", al: "center" }, { h: "Ítem", al: "center" }, { h: "Descripción", wrap: true }, { h: "Und", al: "center" }, { h: "Cantidad", n: "#,##0.00##" }, { h: "Valor unitario", n: MONEDA }, { h: "Valor total oferta", n: MONEDA }, { h: "Cantidad x valor unitario", n: MONEDA, w: 16 }, { h: "Diferencia", n: MONEDA, w: 13 }, { h: "Valor final", n: MONEDA, w: 16 }, { h: "APU PRO", al: "center", w: 11 }, { h: "Precio referencia", n: MONEDA }, { h: "Dif. frente a referencia", n: "0%" }, { h: "Hallazgos", wrap: true }],
    items.map((it) => {
      const c = comp[it.id];
      return [it.cap, it.item, it.desc, it.und, it.cant, it.vu, it.vt, null, null, null, c?.codigo || it.ref?.codigo || "", c ? Math.round(c.ref) : null, c ? c.dif : null, (res.porItem[it.id] || []).map((k) => numeros[k]).filter(Boolean).join(", ")];
    }),
    { colorFila: (f) => (f[13] ? "FFFFF4D6" : null), anchoMax: 55 });
  // Fórmulas: el revisor puede cambiar un dato y ver el recálculo.
  for (let r = 4; r <= wsI.rowCount; r++) {
    wsI.getCell(r, 8).value = { formula: `IFERROR(ROUND(E${r}*F${r},0),0)` };
    wsI.getCell(r, 9).value = { formula: `IFERROR(G${r}-H${r},0)` };
    wsI.getCell(r, 10).value = { formula: `IFERROR(ROUND(G${r}*${F.aFinal.toFixed(8)},0),0)` };
  }
  const tot = wsI.addRow(["", "", "Total", "", null, null, { formula: `SUM(G4:G${wsI.rowCount})` }, { formula: `SUM(H4:H${wsI.rowCount})` }, { formula: `SUM(I4:I${wsI.rowCount})` }, { formula: `SUM(J4:J${wsI.rowCount})` }]);
  tot.font = { bold: true };
  [7, 8, 9, 10].forEach((j) => { tot.getCell(j).numFmt = MONEDA; });
  return wb;
}
