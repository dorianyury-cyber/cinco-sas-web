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
    // «1.500» es mil quinientos; «0,317» o «0.250» son decimales (nadie escribe miles con cero adelante).
    if (decimales === 3 && (veces > 1 || !distintos) && !/^0[.,]/.test(s)) s = s.replace(/[.,]/g, "");
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

const RE_RESUMEN = /^(sub ?total|total|valor total|costo directo|costos? directos?|costos? indirectos?|costo total|precio total|administracion|imprevistos?|utilidad|iva|a\.?\s?i\.?\s?u\.?|aiu|valor (de la )?oferta|gran total)\b/;
// Total de la oferta: el mayor de estos renglones (no los de capítulo ni los de costo directo).
const RE_TOTAL = /^(total|valor total|gran total|valor (de la )?oferta|costo total|precio total)/;
const RE_NO_TOTAL = /capitulo|\bcap\b|parcial|grupo|directo|indirecto/;
// Recorre la tabla desde la fila siguiente a los encabezados: las filas con descripción y sin
// cantidad ni valor unitario son capítulos; las de totales se omiten (el mayor «total» que
// aparezca se propone como total declarado).
export function extraerItems(m, { fila = -1, columnas }) {
  const c = columnas, capitulos = [], items = [], avisos = [];
  let cap = null, totalDetectado = null, n = 0, pendientes = [];
  const txt = (f, k) => (c[k] >= 0 ? String(f[c[k]] ?? "").trim() : "");
  const num = (f, k) => (c[k] >= 0 ? aNumero(f[c[k]]) : null);
  for (let r = fila + 1; r < m.length; r++) {
    const f = m[r];
    // Algunos formatos ponen el nombre del capítulo o el subtotal en otra columna (la del ítem).
    const desc = (txt(f, "desc") || String(f.find((v) => typeof v === "string" && v.trim().length > 3 && aNumero(v) == null) ?? "").trim()).replace(/\s+/g, " ");
    const nd = normalizar(desc).replace(/^([a-e]|\d+|[ivx]+)[.)]\s+/, ""); // «A. TOTAL COSTOS DIRECTOS»
    const vt = num(f, "vt");
    if (!desc) continue;
    if (RE_RESUMEN.test(nd)) {
      if (RE_TOTAL.test(nd) && !RE_NO_TOTAL.test(nd) && vt != null) totalDetectado = Math.max(totalDetectado || 0, vt);
      continue;
    }
    let cant = num(f, "cant");
    const vu = num(f, "vu"), codigo = txt(f, "item");
    if (cant == null && vu == null) {
      if (desc.length > 160) continue;
      // Fila con nombre y valor, sin cantidad ni precio: subtotal de un capítulo que se nombra
      // al final (debajo de sus ítems). Si el capítulo no se abrió antes, se nombra con ella.
      if (vt != null) {
        if (!cap && pendientes.length) {
          const nuevo = { num: String(capitulos.length + 1), nombre: desc };
          capitulos.push(nuevo);
          for (const it of pendientes) it.cap = nuevo.num;
        }
        pendientes = [];
        cap = null;
        continue;
      }
      cap = { num: codigo && codigo !== desc && codigo.length <= 12 ? codigo : String(capitulos.length + 1), nombre: desc };
      capitulos.push(cap);
      continue;
    }
    // «2,500» puede ser dos y medio o dos mil quinientos: decide la aritmética del ítem.
    const crudo = c.cant >= 0 ? String(f[c.cant] ?? "").trim() : "";
    const cuadra = (q) => Math.abs(q * vu - vt) <= Math.max(2, Math.abs(vt) * 0.002);
    if (cant != null && vu != null && vt != null && /^\d{1,3}[.,]\d{3}$/.test(crudo) && !cuadra(cant) && cuadra(cant / 1000)) cant /= 1000;
    n++;
    const it = { id: `i${n}`, cap: cap ? cap.num : capituloDeCodigo(codigo), item: codigo || String(n), desc, und: txt(f, "und"), cant, vu, vt, fila: r + 1 };
    if (it.vt == null && cant != null && vu != null) { it.vt = Math.round(cant * vu); it.vtCalculado = true; }
    if (!cap) pendientes.push(it);
    items.push(it);
  }
  // Ítems que quedaron sin capítulo después del último capítulo nombrado al final.
  if (capitulos.length && pendientes.some((it) => !capitulos.some((k) => k.num === it.cap))) {
    const resto = { num: String(capitulos.length + 1), nombre: "Otros ítems" };
    capitulos.push(resto);
    for (const it of pendientes) it.cap = resto.num;
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
  const primera = palabras.find((w) => !/^\d/.test(w)) || "";
  return { todas: new Set(palabras), numeros: new Set(palabras.filter((w) => /^\d/.test(w))), primera: primera.replace(/(es|s)$/, "") };
}
// Palabras que distinguen material o tipo: dos insumos con distintivos distintos no son el mismo.
const DISTINTIVOS = new Set("emt imc rmc pvc lshf thhn thwn thw xlpe acsr aaac cu al aluminio cobre galvanizado galvanizada acero inoxidable hierro concreto madera fibra cat5e cat6 cat6a cat7 cat7a utp ftp stp monofasico trifasico bifasico led sodio metal sch ranurado roscado presion".split(" "));
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
    // Las medidas mandan: «Tubo EMT 1/2"» no es «Tubo EMT 1 1/2"», ni «caja 40x40x20» una caja
    // sin medida. Si ambos traen números y no son los mismos, el parecido cae a la mitad; si
    // solo uno los trae, baja un cuarto.
    if (f.numeros.size && a.f.numeros.size) {
      const iguales = f.numeros.size === a.f.numeros.size && [...f.numeros].every((x) => a.f.numeros.has(x));
      if (!iguales) s *= 0.5;
    } else if (f.numeros.size || a.f.numeros.size) s *= 0.75;
    // El material o tipo también: un tubo EMT no es un tubo PVC, ni un cable LSHF uno THHN.
    const tf = [...f.todas].filter((w) => DISTINTIVOS.has(w)), ta = [...a.f.todas].filter((w) => DISTINTIVOS.has(w));
    const soloF = tf.filter((w) => !ta.includes(w)), soloA = ta.filter((w) => !tf.includes(w));
    if (soloF.length && soloA.length) s *= 0.45;
    else if (soloF.length || soloA.length) s *= 0.8;
    // Y el sustantivo principal (la primera palabra): «buching» no es «curva».
    if (f.primera && a.f.primera && f.primera !== a.f.primera) s *= 0.6;
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
// apus: APU del oferente leídos del PDF; precioInsumo(codigo) → precio del insumo en la base
// de APU PRO (o null), para los insumos con referencia confirmada en rev.refInsumos.
export function revisar(rev, { precioApu = () => null, apus = [], precioInsumo = () => null } = {}) {
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
  // Si el total no cuadra con lo registrado pero sí con otra base («precio final», «con AIU»),
  // el error es del registro, no de la oferta: se avisa qué cambiar y no se cuenta como hallazgo.
  let baseSugerida = null;
  if (declarado > 0 && items.length) {
    const cuadra = (t) => Math.abs(declarado - t) <= Math.max(1000, declarado * 0.0005);
    if (!cuadra(total)) baseSugerida = ["final", "conAiu", "cd"].find((b) => b !== (rev.base || "cd") && cuadra((sumaItems / factores({ ...rev, base: b }).base) * F.final)) || null;
  }
  if (baseSugerida) agregar({ clave: "total", titulo: "Revisa qué incluyen los valores de los ítems", estado: "info",
    texto: `El total declarado (${pesosTxt(declarado)}) cuadra si los valores de los ítems son «${BASES[baseSugerida].split(" (")[0]}», no «${BASES[rev.base || "cd"].split(" (")[0]}» como está registrado. Corrígelo en «Datos, AIU e IVA».` });
  else if (declarado > 0 && items.length) {
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
    texto: `De ${comparados.length} ítems comparados con los APU de Cinco S.A.S., ${encima.length} superan en más del 20 % el precio de referencia (${encima.slice(0, 8).map((c) => `${c.item} +${Math.round(c.dif * 100)} %`).join("; ")}${encima.length > 8 ? ", entre otros" : ""}). El exceso sobre el precio de referencia más un 20 % es de ${pesosTxt(vExceso)} en el valor final.`,
    itemsRef: items.filter((it) => encima.some((c) => c.id === it.id)), impacto: vExceso, accion: "Pedir al oferente los APU y las cotizaciones de soporte de estos ítems y ajustar los precios." });
  if (debajo.length) agregar({ clave: "preciosBajos", titulo: "Precios por debajo de APU PRO", estado: "hallazgo", sev: "Observación", tema: "Precios",
    texto: `${debajo.length} ítem(s) están más de un 20 % por debajo del precio de referencia (${debajo.slice(0, 8).map((c) => `${c.item} ${Math.round(c.dif * 100)} %`).join("; ")}): puede tratarse de una especificación menor o de un riesgo de reclamaciones posteriores.`,
    itemsRef: items.filter((it) => debajo.some((c) => c.id === it.id)), impacto: null, accion: "Confirmar la especificación (marca, referencia) de estos ítems." });
  if (comparados.length && !encima.length && !debajo.length) agregar({ clave: "precios", titulo: "Precios frente a APU PRO", estado: "ok", texto: `Los ${comparados.length} ítems comparados con los APU de Cinco S.A.S. están dentro de un ±20 % del precio de referencia.` });
  if (!comparados.length) agregar({ clave: "precios", titulo: "Precios frente a APU PRO", estado: "info", texto: "Ningún ítem tiene un APU de referencia confirmado: asígnalos en la pestaña Ítems para comparar precios." });

  const resApus = apus.length ? revisarApus(rev, apus, { F, items, valor, valorFinal, agregar, precioInsumo }) : null;

  return { F, sumaItems, comp, total, declarado, valorFinal, capitulos, verificaciones: V, porItem, pareto, comparados, vExceso, apus: resApus, baseSugerida: baseSugerida || resApus?.baseSugerida || null };
}

// Lo que dicen los APU del oferente sobre la oferta: qué incluyen los valores del presupuesto
// (si el precio de cada ítem es el costo directo, el precio con AIU o el precio final de su APU),
// el AIU y el IVA más frecuentes. Sirve para prellenar «Datos, AIU e IVA» al importar un PDF.
export function datosDesdeApus(items, apus) {
  const porCodigo = new Map(apus.map((a) => [codNorm(a.item), a]));
  const votos = { cd: 0, conAiu: 0, final: 0 };
  const cerca = (x, y) => x != null && y != null && Math.abs(x - y) <= Math.max(1, Math.abs(y) * 0.001);
  for (const it of items) {
    const a = porCodigo.get(codNorm(it.item));
    if (!a || it.vu == null) continue;
    if (cerca(it.vu, a.pu)) votos.final++;
    else if (cerca(it.vu, a.sai)) votos.conAiu++;
    else if (cerca(it.vu, a.cd)) votos.cd++;
  }
  const moda = (vals) => { const c = new Map(); for (const v of vals) if (v != null) { const k = Math.round(v * 10000) / 10000; c.set(k, (c.get(k) || 0) + 1); } return [...c.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] ?? null; };
  const base = Object.entries(votos).sort((p, q) => q[1] - p[1])[0];
  const pct = (k) => moda(apus.map((a) => a.aiu?.[k]?.pct));
  const ivaPct = moda(apus.map((a) => a.iva?.pct));
  // IVA sobre el subtotal o sobre la utilidad: el que reproduce el valor del IVA de los APU.
  let regimen = null;
  const conIva = apus.filter((a) => a.iva?.v != null && a.cd != null);
  if (conIva.length && ivaPct != null) {
    const sobreTotal = conIva.filter((a) => cerca(a.iva.v, (a.sai ?? a.cd * (1 + (pct("a") || 0) + (pct("i") || 0) + (pct("u") || 0))) * ivaPct)).length;
    const sobreU = conIva.filter((a) => a.aiu?.u?.v != null && cerca(a.iva.v, a.aiu.u.v * ivaPct)).length;
    regimen = sobreTotal >= sobreU ? (sobreTotal ? "total" : null) : "utilidad";
  }
  return { base: base[1] ? base[0] : null, votos, aiu: { a: pct("a"), i: pct("i"), u: pct("u") }, iva: ivaPct, regimenIva: regimen };
}

// ---------------------------------------------------------------- APU del oferente
// apu = { item, desc, und, rend, secciones: { MA|MO|EQ|ED|TR: [{ d, u, c, p, r, dp, v, cod }] },
//         sub: { MA, … }, cd, aiu: { a|i|u: { pct, v } }, iva: { pct, v }, sai, pu, pagina }
export const SECCIONES_APU = { MA: "Materiales", MO: "Mano de obra", EQ: "Equipos y herramientas", ED: "EPP y dotación", TR: "Transporte" };
const codNorm = (c) => normalizar(c).replace(/\s+/g, "");
export const claveInsumo = (l) => `${normalizar(l.d).replace(/[^a-z0-9]+/g, " ").trim()}|${unidadNorm(l.u)}`;
const RE_DIRECCION = /ingenier|capataz|residente|director|inspector|supervisor|profesional|\bsst\b|\bhse\b|siso|coordinador/;

function revisarApus(rev, apus, { F, items, valor, valorFinal, agregar, precioInsumo }) {
  const tol = (x) => Math.max(2, Math.abs(x) * 0.002);
  const porCodigo = new Map(apus.map((a) => [codNorm(a.item), a]));
  const cantDe = new Map(); // cantidad del presupuesto que usa cada APU
  const vinculos = [];
  const sinApu = [], difieren = [];
  let vDif = 0;
  for (const it of items) {
    const a = porCodigo.get(codNorm(it.item));
    if (!a) { sinApu.push(it); continue; }
    cantDe.set(a, (cantDe.get(a) || 0) + (Number(it.cant) || 0));
    // El valor del APU que corresponde a la base de los valores de la oferta.
    const ref = rev.base === "cd" ? a.cd : rev.base === "conAiu" ? a.sai ?? (a.cd != null ? a.cd * (1 + F.A) : null) : a.pu ?? a.sai ?? null;
    const dif = ref != null && it.vu != null ? it.vu - ref : null;
    vinculos.push({ id: it.id, item: it.item, apu: a, ref, dif });
    if (dif != null && Math.abs(dif) > Math.max(1, Math.abs(it.vu) * 0.001)) { difieren.push(it); vDif += dif * (Number(it.cant) || 0) * F.aFinal; }
  }
  const usados = new Set(vinculos.map((v) => v.apu));
  const huerfanos = apus.filter((a) => !usados.has(a));
  const qty = (a) => cantDe.get(a) || 0;

  // Si la mayoría de los precios coincide con otra columna de los APU (por ejemplo, el precio
  // final cuando se registró «costo directo»), el error es del registro, no de la oferta.
  const deducida = datosDesdeApus(items, apus).base;
  const baseSugerida = deducida && deducida !== (rev.base || "cd") && difieren.length > vinculos.length * 0.5 ? deducida : null;
  if (baseSugerida) agregar({ clave: "apuPrecio", titulo: "Revisa qué incluyen los valores de los ítems", estado: "info",
    texto: `Los valores unitarios del presupuesto coinciden con el «${BASES[baseSugerida].split(" (")[0]}» de sus APU, no con el «${BASES[rev.base || "cd"].split(" (")[0]}» registrado. Corrígelo en «Datos, AIU e IVA» para comparar bien.` });
  else if (difieren.length) agregar({ clave: "apuPrecio", titulo: "Precio del presupuesto distinto al de su APU", estado: "hallazgo", sev: Math.abs(vDif) > valorFinal * 0.005 ? "Mayor" : "Menor", tema: "Consistencia",
    texto: `En ${difieren.length} ítem(s) el valor unitario del presupuesto no coincide con el precio de su APU (${lista(difieren)}). La diferencia neta es de ${pesosTxt(vDif)} en el valor final (positiva: el presupuesto cobra más que el APU).`,
    itemsRef: difieren, impacto: vDif, accion: "Pedir al oferente que concilie el presupuesto con los APU; prevalece el menor valor." });
  else if (vinculos.length) agregar({ clave: "apuPrecio", titulo: "Presupuesto y APU", estado: "ok", texto: `Los ${vinculos.length} ítems con APU tienen el mismo precio en el presupuesto y en su análisis.` });
  if (sinApu.length) agregar({ clave: "sinApu", titulo: "Ítems sin APU", estado: "hallazgo", sev: "Menor", tema: "Consistencia",
    texto: `${sinApu.length} ítem(s) del presupuesto no tienen análisis de precio unitario en la oferta (${lista(sinApu)}), por lo que su precio no se puede verificar.`,
    itemsRef: sinApu, impacto: null, impactoTexto: `${pesosTxt(sinApu.reduce((s, it) => s + valor(it), 0) * F.aFinal)} sin APU`, accion: "Pedir los APU faltantes." });
  if (huerfanos.length) agregar({ clave: "apuSinItem", titulo: "APU que no están en el presupuesto", estado: "hallazgo", sev: "Observación", tema: "Consistencia",
    texto: `${huerfanos.length} APU no corresponden a ningún ítem del presupuesto (${huerfanos.slice(0, 12).map((a) => a.item || "sin código").join(", ")}${huerfanos.length > 12 ? ", entre otros" : ""}).`, itemsRef: [], impacto: null, accion: "Aclarar con el oferente si sobran o si falta el ítem en el presupuesto." });

  // Aritmética interna de cada APU: secciones contra su subtotal, subtotales contra el costo
  // directo y AIU contra sus porcentajes.
  const malos = [];
  for (const a of apus) {
    const prob = [];
    for (const [k, ls] of Object.entries(a.secciones)) {
      const s = ls.reduce((t, x) => t + (Number(x.v) || 0), 0);
      if (a.sub?.[k] != null && Math.abs(s - a.sub[k]) > tol(a.sub[k])) prob.push(`${SECCIONES_APU[k] || k}: líneas ${pesosTxt(s)} y subtotal ${pesosTxt(a.sub[k])}`);
    }
    const subs = Object.keys(a.secciones).map((k) => a.sub?.[k] ?? a.secciones[k].reduce((t, x) => t + (Number(x.v) || 0), 0)).reduce((t, x) => t + x, 0);
    if (a.cd != null && Math.abs(subs - a.cd) > tol(a.cd)) prob.push(`costo directo ${pesosTxt(a.cd)} y suma de secciones ${pesosTxt(subs)}`);
    for (const k of ["a", "i", "u"]) { const x = a.aiu?.[k]; if (x?.pct != null && x.v != null && a.cd != null && Math.abs(a.cd * x.pct - x.v) > tol(x.v) + 1) prob.push(`${{ a: "administración", i: "imprevistos", u: "utilidad" }[k]} ${pesosTxt(x.v)} en vez de ${pesosTxt(a.cd * x.pct)}`); }
    if (prob.length) malos.push({ a, prob });
  }
  if (malos.length) agregar({ clave: "apuAritmetica", titulo: "Aritmética de los APU", estado: "hallazgo", sev: "Menor", tema: "Aritmética",
    texto: `${malos.length} APU tienen operaciones que no cuadran: ${malos.slice(0, 6).map((m) => `${m.a.item} (${m.prob[0]})`).join("; ")}${malos.length > 6 ? ", entre otros" : ""}.`,
    itemsRef: items.filter((it) => malos.some((m) => codNorm(m.a.item) === codNorm(it.item))), impacto: null, accion: "Pedir al oferente que corrija los APU." });
  else agregar({ clave: "apuAritmetica", titulo: "Aritmética de los APU", estado: "ok", texto: `Las sumas de los ${apus.length} APU (secciones, costo directo y AIU) son correctas.` });

  // APU sin descripción y APU de suministro sin materiales.
  const sinDesc = apus.filter((a) => !a.desc || codNorm(a.desc) === codNorm(a.item));
  if (sinDesc.length) agregar({ clave: "apuSinDesc", titulo: "APU sin descripción", estado: "hallazgo", sev: "Menor", tema: "Consistencia",
    texto: `${sinDesc.length} APU no ${sinDesc.length === 1 ? "describe" : "describen"} la actividad (${sinDesc.map((a) => a.item).join(", ")}): el alcance de lo que se paga queda indefinido.`,
    itemsRef: items.filter((it) => sinDesc.some((a) => codNorm(a.item) === codNorm(it.item))), impacto: null, accion: "Pedir la descripción completa de la actividad." });
  const sinMat = apus.filter((a) => /suministr/.test(normalizar(a.desc)) && !(a.secciones.MA || []).some((x) => Number(x.v) > 0));
  if (sinMat.length) agregar({ clave: "apuSinMateriales", titulo: "APU de suministro sin materiales", estado: "hallazgo", sev: "Menor", tema: "Consistencia",
    texto: `${sinMat.length} APU dicen «suministro» pero no incluyen materiales (${sinMat.map((a) => a.item).join(", ")}): el precio solo cubre mano de obra y equipo, lo que abre la puerta a reclamaciones posteriores.`,
    itemsRef: items.filter((it) => sinMat.some((a) => codNorm(a.item) === codNorm(it.item))), impacto: null, impactoTexto: "Riesgo de adicionales", accion: "Pedir que se completen los APU o que el oferente declare por escrito que el precio incluye los materiales." });

  // Ítems de cada APU (para llevar a valor final lo que se encuentre dentro de los APU).
  const itemsDe = new Map();
  for (const v of vinculos) { const it = items.find((x) => x.id === v.id); if (it) { if (!itemsDe.has(v.apu)) itemsDe.set(v.apu, []); itemsDe.get(v.apu).push(it); } }
  const itemsDeApus = (lista) => [...new Set(lista.flatMap((a) => itemsDe.get(a) || []))];
  const vtDe = (lista) => itemsDeApus(lista).reduce((s, it) => s + valor(it), 0) * F.aFinal;
  const mat = (a) => (a.secciones.MA || []).filter((x) => Number(x.v) > 0 && x.d);

  // Accesorio cobrado dos veces: un material que va dentro de muchos APU (una unidad por salida,
  // como una caja) y además se cobra como ítem aparte cuyo APU es casi solo ese material.
  const usoPorClave = new Map();
  for (const a of apus) for (const x of mat(a)) if (Number(x.c) > 0 && Number(x.c) <= 2) { const k = claveInsumo(x); if (!usoPorClave.has(k)) usoPorClave.set(k, new Set()); usoPorClave.get(k).add(a); }
  const dobles = new Map();
  for (const a of apus) {
    const ms = mat(a);
    if (!ms.length) continue;
    const principal = ms.reduce((m, x) => (x.v > m.v ? x : m));
    const totalMa = ms.reduce((s, x) => s + x.v, 0);
    if (principal.v < totalMa * 0.6) continue;
    const k = claveInsumo(principal);
    const otros = [...(usoPorClave.get(k) || [])].filter((b) => b !== a && claveInsumo(mat(b).reduce((m, x) => (x.v > m.v ? x : m), { v: -1 })) !== k);
    if (otros.length >= 5) { const e = dobles.get(k) || { d: principal.d, u: principal.u, separados: [], otros: new Set() }; e.separados.push(a); otros.forEach((b) => e.otros.add(b)); dobles.set(k, e); }
  }
  if (dobles.size) {
    const grupos = [...dobles.values()].map((e) => { const its = itemsDeApus(e.separados); return { ...e, its, unidades: its.reduce((s, it) => s + (Number(it.cant) || 0), 0), v: vtDe(e.separados) }; }).sort((p, q) => q.v - p.v);
    const v = grupos.reduce((s, g) => s + g.v, 0);
    agregar({ clave: "accesoriosDobles", titulo: "Accesorios cobrados dentro de los APU y aparte", estado: "hallazgo", sev: v > valorFinal * 0.01 ? "Mayor" : "Menor", tema: "Cantidades",
      texto: `Hay accesorios que ya van dentro de muchos APU (una o dos unidades por salida) y además se cobran como ítems separados; pueden ser cantidades cobradas dos veces: ${grupos.map((g) => `«${g.d}»: incluida en ${g.otros.size} APU y ${numTxt(g.unidades)} unidades aparte (${lista(g.its, 8)}), hasta ${pesosTxt(g.v)}`).join("; ")}.`,
      itemsRef: grupos.flatMap((g) => g.its), insumosRef: grupos.map((g) => `MA|${claveInsumo({ d: g.d, u: g.u })}`), fuente: "ambos", impacto: null, impactoTexto: `Hasta ${pesosTxt(v)}`, accion: "Pedir la justificación de cada unidad cobrada aparte (derivación, paso, soporte adicional) con su ubicación en planos; retirar las que dupliquen las incluidas en cada salida." });
  }

  // Consumibles con peso atípico: filtros, discos, brocas o lijas que pesan más del 15 % del APU.
  const RE_CONSUMIBLE = /filtro|disco (de corte|diamante|abrasivo|para)|broca|lija|abrasiv|segueta|guante|brocha|rodillo|estopa|consumible/;
  const consumos = [];
  for (const a of apus) for (const x of mat(a)) if (RE_CONSUMIBLE.test(normalizar(x.d)) && !/disco duro/.test(normalizar(x.d)) && a.cd > 0 && x.v / a.cd > 0.15) consumos.push({ a, x });
  if (consumos.length) {
    const v = consumos.reduce((s, { a, x }) => s + x.v * qty(a), 0) * F.final;
    const its = itemsDeApus(consumos.map((c) => c.a));
    agregar({ clave: "consumibles", titulo: "Consumibles con peso atípico en los APU", estado: "hallazgo", sev: v > valorFinal * 0.01 ? "Mayor" : "Menor", tema: "Insumos",
      texto: `En ${consumos.length} APU un consumible pesa más del 15 % del costo directo: ${consumos.slice(0, 6).map(({ a, x }) => `${a.item}: ${numTxt(x.c)} ${x.u || "und"} de «${x.d}» a ${pesosTxt(x.p)} = ${pesosTxt(x.v)} (${Math.round((x.v / a.cd) * 100)} % del APU)`).join("; ")}${consumos.length > 6 ? ", entre otros" : ""}. En toda la obra suman ${pesosTxt(v)}.`,
      itemsRef: its, insumosRef: consumos.map(({ x }) => `MA|${claveInsumo(x)}`), fuente: "insumos", impacto: v, accion: "Pedir la justificación del consumo y ajustarlo a un valor razonable (los consumibles suelen ser una fracción menor del costo)." });
  }

  // Obra civil (cielo raso, drywall, regatas, pintura…) ejecutada por la cuadrilla eléctrica.
  const RE_CIVIL = /cielo|drywall|panel yeso|pintura|resane|regata|demolic|desmonte de panel|muro|mamposter|estuco|enchape|panete|pañete|losa|anden/;
  const RE_OFICIO_CIVIL = /oficial|albañil|albanil|drywall|pintor|obrero|maestro de obra|estucador|enchapador/;
  const civiles = apus.filter((a) => RE_CIVIL.test(normalizar(a.desc)) && (a.secciones.MO || []).length && !(a.secciones.MO || []).some((x) => RE_OFICIO_CIVIL.test(normalizar(x.d))) && (a.secciones.MO || []).some((x) => /electric/.test(normalizar(x.d))));
  if (civiles.length) {
    const v = vtDe(civiles);
    agregar({ clave: "obraCivil", titulo: "Obra civil ejecutada por la cuadrilla eléctrica", estado: "hallazgo", sev: v > valorFinal * 0.05 ? "Mayor" : "Observación", tema: "Alcance",
      texto: `${civiles.length} actividades de obra civil (${civiles.slice(0, 6).map((a) => `${a.item} ${a.desc.toLowerCase()}`).join("; ")}${civiles.length > 6 ? ", entre otros" : ""}) suman ${pesosTxt(v)} (${pctTxt(valorFinal ? v / valorFinal : 0)} de la oferta) y sus APU las asignan a electricistas, sin oficiales de obra civil. Debe verificarse que el alcance sea necesario para la instalación eléctrica (aperturas y reposiciones) y no un reemplazo completo.`,
      itemsRef: itemsDeApus(civiles), impacto: null, impactoTexto: `${pesosTxt(v)} por justificar`, accion: "Pedir el soporte del alcance de obra civil (planos o estado existente) y los APU con la cuadrilla y los rendimientos de esos oficios." });
  }

  // Partidas globales en cifras redondas dentro de los APU (precios sin desglose).
  const redondas = [];
  for (const a of apus) for (const x of [...mat(a), ...(a.secciones.EQ || [])]) if (Number(x.v) >= 300000 && Number(x.p) >= 300000 && Number(x.p) % 10000 === 0 && (!x.u || /^(gl|global|und|un|u|unid)\.?$/i.test(String(x.u).trim()))) redondas.push({ a, x });
  if (redondas.length) {
    const apusR = [...new Set(redondas.map((r) => r.a))];
    agregar({ clave: "globalesApu", titulo: "Partidas globales en cifras redondas dentro de los APU", estado: "hallazgo", sev: "Menor", tema: "Precios",
      texto: `${apusR.length} APU usan partidas globales en cifras redondas, sin desglose ni cotización: ${redondas.slice(0, 6).map(({ a, x }) => `${a.item}: «${x.d}» ${pesosTxt(x.p)}`).join("; ")}${redondas.length > 6 ? ", entre otros" : ""}.`,
      itemsRef: itemsDeApus(apusR), impacto: null, impactoTexto: `${pesosTxt(vtDe(apusR))} sin desglose`, accion: "Pedir el desglose de cada partida (materiales, cantidades y cotización)." });
  }

  // Insumos: cantidades y valores en todo el presupuesto (cantidad del APU × cantidad del ítem).
  const insumos = new Map();
  for (const a of apus) for (const [sec, ls] of Object.entries(a.secciones)) for (const x of ls) {
    if (!(Number(x.v) > 0)) continue;
    const k = `${sec}|${claveInsumo(x)}`;
    // Materiales: cantidad × (1 + desperdicio). Mano de obra, equipos y transporte: jornales o
    // días = cantidad ÷ rendimiento (el de la línea o el del APU).
    const rend = Number(x.r) || Number(a.rend) || 0;
    const e = insumos.get(k) || { clave: k, sec, d: x.d, u: x.u || (sec === "MO" ? "jornal" : sec === "EQ" || sec === "TR" ? (rend ? "día" : "") : ""), cod: x.cod || "", precios: new Map(), q: 0, valor: 0, apus: new Set() };
    const porUnidad = sec === "MA" || sec === "ED" || !rend;
    const q = (porUnidad ? (Number(x.c) || (sec === "MA" ? 1 : 0)) * (1 + (Number(x.dp) || 0)) : (Number(x.c) || 1) / rend) * qty(a);
    e.q += q;
    e.valor += x.v * qty(a);
    if (x.p != null) e.precios.set(x.p, (e.precios.get(x.p) || 0) + q);
    e.apus.add(a.item);
    insumos.set(k, e);
  }
  const listaIns = [...insumos.values()].map((e) => ({ ...e, apus: [...e.apus], preciosLista: [...e.precios.keys()].sort((p, q) => p - q), valorFinal: e.valor * F.final }));
  listaIns.sort((p, q) => q.valor - p.valor);

  // Mismo insumo con precios distintos (materiales).
  const varios = listaIns.filter((e) => e.sec === "MA" && e.preciosLista.length > 1 && e.preciosLista[e.preciosLista.length - 1] / e.preciosLista[0] > 1.01);
  let vVarios = 0;
  for (const e of varios) { const min = e.preciosLista[0]; for (const [p, q] of e.precios) vVarios += (p - min) * q * F.final; }
  if (varios.length) agregar({ clave: "insumoPrecios", titulo: "Mismo insumo con precios distintos", estado: "hallazgo", sev: vVarios > valorFinal * 0.005 ? "Mayor" : "Menor", tema: "Precios",
    texto: `${varios.length} materiales tienen precios distintos según el APU: ${varios.slice(0, 5).map((e) => `${e.d} (${pesosTxt(e.preciosLista[0])} a ${pesosTxt(e.preciosLista[e.preciosLista.length - 1])})`).join("; ")}${varios.length > 5 ? ", entre otros" : ""}. Llevados al menor precio, el valor bajaría en ${pesosTxt(vVarios)}.`,
    itemsRef: items.filter((it) => varios.some((e) => e.apus.some((c) => codNorm(c) === codNorm(it.item)))), insumosRef: varios.map((e) => e.clave), fuente: "insumos", impacto: vVarios, accion: "Pedir la justificación o unificar cada insumo en su menor precio." });

  // Jornales: un mismo cargo con jornal distinto; personal de dirección en el costo directo.
  const cargos = listaIns.filter((e) => e.sec === "MO");
  const jornalesVarios = cargos.filter((e) => e.preciosLista.length > 1 && e.preciosLista[e.preciosLista.length - 1] / e.preciosLista[0] > 1.01);
  if (jornalesVarios.length) agregar({ clave: "jornales", titulo: "Jornales distintos para un mismo cargo", estado: "hallazgo", sev: "Observación", tema: "Mano de obra",
    texto: `${jornalesVarios.map((e) => `${e.d}: ${e.preciosLista.map(pesosTxt).join(", ")}`).join("; ")}.`, itemsRef: [], impacto: null, accion: "Pedir que se unifiquen los jornales por cargo." });
  else if (cargos.length) agregar({ clave: "jornales", titulo: "Jornales", estado: "ok", texto: `Jornales uniformes en todos los APU: ${cargos.slice(0, 6).map((e) => `${e.d} ${pesosTxt(e.preciosLista[0])}`).join("; ")}.` });
  const direccion = cargos.filter((e) => RE_DIRECCION.test(normalizar(e.d)));
  const vDir = direccion.reduce((s, e) => s + e.valorFinal, 0);
  if (direccion.length && F.aiu.a > 0) agregar({ clave: "direccion", titulo: "Personal de dirección en el costo directo", estado: "hallazgo", sev: "Observación", tema: "Mano de obra",
    texto: `Los APU incluyen en el costo directo personal de dirección o supervisión (${direccion.map((e) => e.d).join(", ")}) por ${pesosTxt(vDir)} en el valor final, además del ${pctTxt(F.aiu.a)} de administración.`,
    itemsRef: [], impacto: null, impactoTexto: `${pesosTxt(vDir)} por aclarar`, accion: "Confirmar que el personal de dirección no se cobre también en la administración." });

  // Insumos comparados con la base de APU PRO (referencias confirmadas por el revisor).
  const comparadosIns = [];
  for (const e of listaIns) {
    const cod = rev.refInsumos?.[e.clave];
    const base = cod ? precioInsumo(cod) : null;
    if (!(base > 0) || !e.preciosLista.length) continue;
    const p = e.preciosLista[e.preciosLista.length - 1];
    const dif = p / base - 1;
    const estado = dif > 0.2 ? "Por encima" : dif < -0.2 ? "Por debajo" : "En rango";
    let exceso = 0;
    if (estado === "Por encima") for (const [pp, q] of e.precios) if (pp > base * 1.2) exceso += (pp - base * 1.2) * q * F.final;
    comparadosIns.push({ clave: e.clave, d: e.d, u: e.u, q: e.q, p, codigo: cod, base, dif, estado, exceso });
  }
  const encimaIns = comparadosIns.filter((c) => c.estado === "Por encima");
  const vIns = encimaIns.reduce((s, c) => s + c.exceso, 0);
  if (encimaIns.length) agregar({ clave: "insumosBase", titulo: "Insumos por encima de la base de APU PRO", estado: "hallazgo", sev: vIns > valorFinal * 0.01 ? "Mayor" : "Menor", tema: "Precios",
    texto: `De ${comparadosIns.length} insumos comparados con la base de precios de Cinco S.A.S., ${encimaIns.length} superan en más del 20 % el precio de referencia (${encimaIns.slice(0, 6).map((c) => `${c.d} +${Math.round(c.dif * 100)} %`).join("; ")}${encimaIns.length > 6 ? ", entre otros" : ""}). El exceso sobre la referencia más un 20 % es de ${pesosTxt(vIns)} en el valor final.`,
    itemsRef: items.filter((it) => encimaIns.some((c) => (insumos.get(c.clave)?.apus || new Set()).has(it.item))), insumosRef: encimaIns.map((c) => c.clave), fuente: "insumos", impacto: vIns, accion: "Pedir cotizaciones de soporte de estos insumos y ajustar los APU." });

  // Días-cuadrilla: cantidad del ítem ÷ rendimiento de la cuadrilla (el de mano de obra o el del APU).
  let dias = 0;
  for (const v of vinculos) { const r = (v.apu.secciones.MO || []).find((x) => Number(x.r) > 0)?.r || v.apu.rend; const it = items.find((x) => x.id === v.id); if (r > 0 && it?.cant) dias += it.cant / r; }
  if (dias > 0) agregar({ clave: "diasCuadrilla", titulo: "Plazo según los rendimientos", estado: "info", texto: `Los rendimientos de los APU suman unos ${Math.round(dias)} días-cuadrilla: con el plazo de la obra se puede estimar cuántas cuadrillas simultáneas exige.` });

  return { vinculos, sinApu, huerfanos, malos, insumos: listaIns, comparadosIns, dias, baseSugerida };
}

// ---------------------------------------------------------------- hallazgos consolidados
// Automáticos (con los ajustes del revisor) + manuales, ordenados por severidad y numerados
// H-01… (Mayor y Menor) y OB-01… (observaciones), como en las revisiones anteriores.
export function hallazgosRevision(rev, res) {
  const aj = rev.ajustes || {};
  const auto = res.verificaciones.filter((v) => v.estado === "hallazgo").map((v) => {
    const a = aj[v.clave] || {};
    return { clave: v.clave, origen: "auto", incluir: a.incluir !== false, sev: a.sev || v.sev, tema: v.tema, hallazgo: a.comentario ? `${v.texto} ${a.comentario}` : v.texto,
      items: v.itemsRef?.length ? lista(v.itemsRef, 20) : "Todos", impacto: v.impacto, impactoTexto: v.impactoTexto || "", accion: a.accion || v.accion, titulo: v.titulo,
      codigos: v.fuente === "insumos" ? new Set() : new Set((v.itemsRef || []).map((it) => codNorm(it.item))), insumos: new Set(v.insumosRef || []) };
  });
  // Los ítems de un hallazgo del revisor salen de lo que escribió («8-1, 8-2»).
  const manuales = (rev.hallazgos || []).map((h) => ({ ...h, clave: h.id, origen: "manual", incluir: h.incluir !== false, impacto: h.impacto == null || h.impacto === "" ? null : Number(h.impacto), impactoTexto: h.impactoTexto || "",
    codigos: new Set(String(h.items || "").split(/[,;]+|\s+y\s+/).map((c) => codNorm(c)).filter((c) => c && RE_CODIGO_ITEM.test(c))), insumos: new Set() }));
  const orden = { Mayor: 0, Menor: 1, "Observación": 2 };
  const todos = [...auto, ...manuales].sort((x, y) => (orden[x.sev] ?? 3) - (orden[y.sev] ?? 3) || (Math.abs(y.impacto || 0) - Math.abs(x.impacto || 0)));
  let h = 0, ob = 0;
  for (const x of todos) if (x.incluir) x.numero = x.sev === "Observación" ? `OB-${String(++ob).padStart(2, "0")}` : `H-${String(++h).padStart(2, "0")}`;
  // Superposición: dos hallazgos que cuentan el mismo dinero. Los de insumos (precio, consumo)
  // se superponen si comparten un insumo (la caja cara y la caja cobrada dos veces); los de
  // ítems, si comparten buena parte de sus ítems (30 % o más del menor).
  const inc = todos.filter((x) => x.incluir);
  for (const x of inc) x.superpone = [];
  for (let i = 0; i < inc.length; i++) for (let j = i + 1; j < inc.length; j++) {
    const A = inc[i].codigos, B = inc[j].codigos;
    let comunes = 0;
    for (const c of A) if (B.has(c)) comunes++;
    const porItems = A.size && B.size && comunes / Math.min(A.size, B.size) >= 0.3;
    const porInsumos = [...inc[i].insumos].some((k) => inc[j].insumos.has(k));
    if (porItems || porInsumos) { inc[i].superpone.push(inc[j].numero); inc[j].superpone.push(inc[i].numero); }
  }
  return todos;
}
const RE_CODIGO_ITEM = /^[a-z]{0,5}[-.]?\d+([.\-_]\d+)*[a-z]?$/;

// Total estimado de los impactos sin contar dos veces el mismo dinero: de mayor a menor se
// suman los impactos en pesos y se deja por fuera cada hallazgo que se superpone con uno ya
// sumado. Los «hasta $…» y «por justificar» no entran: no son ahorros seguros.
export function totalSinDuplicar(hallazgos) {
  const conValor = hallazgos.filter((h) => h.incluir && h.impacto != null && Number.isFinite(h.impacto) && h.impacto > 0).sort((a, b) => b.impacto - a.impacto);
  const sumados = [], omitidos = [];
  for (const h of conValor) {
    if (sumados.some((s) => (h.superpone || []).includes(s.numero))) omitidos.push(h);
    else sumados.push(h);
  }
  return { total: sumados.reduce((s, h) => s + h.impacto, 0), sumados, omitidos };
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
  const sinDup = totalSinDuplicar(inc);
  const bloques = [
    H1("Objeto y alcance de la revisión"),
    P(rev.objeto ? escH(rev.objeto) : `El presente informe consigna la revisión objetiva del presupuesto de la <b>${oferta}</b>${fechaOf}, por un valor total de ${pesosTxt(res.valorFinal)}${F.reg === "ninguno" ? "" : " IVA incluido"}.`),
    P("La revisión verifica la aritmética del presupuesto, la coherencia entre ítems, la estructura del AIU y del IVA, la concentración del valor y la razonabilidad de los precios unitarios frente a los análisis de precios unitarios (APU) de Cinco S.A.S. elaborados en APU PRO."),
    H2("Documento revisado"),
    T("Datos de la oferta", [
      ["Dato", "Valor"],
      ["Oferta", rev.nombre || "-"], ["Oferente", rev.oferente || "-"], ["Contratante", rev.cliente || "-"],
      ["Fecha de la oferta", rev.fechaOferta ? fechaLarga(rev.fechaOferta) : "-"], ["Documento", rev.documento || "-"],
      ["Capítulos / ítems / APU", `${res.capitulos.length} / ${items.length}${res.apus ? ` / ${res.apus.vinculos.length + res.apus.huerfanos.length}` : ""}`],
      ["Los valores de los ítems son", BASES[rev.base || "cd"]],
      ["AIU", `A ${pctTxt(F.aiu.a || 0)} - I ${pctTxt(F.aiu.i || 0)} - U ${pctTxt(F.aiu.u || 0)}`],
      ["IVA", F.iva ? `${pctTxt(F.iva, 0)} ${minuscula(REGIMENES[F.reg])}` : "No se liquida"]
    ]),
    H2("Metodología"),
    P(`Se importó la tabla del presupuesto${res.apus ? " y los análisis de precios unitarios (APU) del oferente" : ""} y se recalcularon el valor de cada ítem (cantidad por valor unitario), los subtotales por capítulo, el costo directo, el AIU, el IVA y el total. Se buscaron ítems incompletos, repetidos o con precios distintos, partidas globales e ítems de alto peso${res.apus ? "; en los APU se verificaron su aritmética, su coherencia con el presupuesto, los insumos con precios distintos, los consumibles y accesorios atípicos, la obra civil asignada a la cuadrilla eléctrica, los jornales y el personal de dirección, y se calcularon las cantidades de cada insumo en toda la obra" : ""}. Los precios se compararon con los APU y la base de precios de Cinco S.A.S. en APU PRO. Los hallazgos se califican así:`),
    T("Criterios de calificación", [
      ["Severidad", "Significado"],
      ["Mayor", "Afecta de forma importante el valor o el alcance; debe resolverse antes de contratar."],
      ["Menor", "Debe corregirse o aclararse; impacto económico acotado."],
      ["Observación", "Aspecto a tener en cuenta en la contratación o la ejecución."]
    ]),
    H1("Resumen de la oferta y de la revisión"),
    H2("Valor de la oferta"),
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
      ["Total recalculado", pesosTxt(res.total), ""],
      ...(res.declarado ? [["Total declarado en la oferta", pesosTxt(res.declarado), ""]] : [])
    ]),
    H2("Resultados"),
    P(`Se verificaron ${items.length} ítems en ${res.capitulos.length} capítulos. Resultado: ${inc.filter((h) => h.sev === "Mayor").length} hallazgos mayores, ${inc.filter((h) => h.sev === "Menor").length} menores y ${inc.filter((h) => h.sev === "Observación").length} observaciones. ${res.pareto.n80} ítems (${pctTxt(res.pareto.pct)}) concentran el 80 % del valor.`),
    ...(conImpacto.length ? [T("Impactos estimados sobre el valor final", [["Hallazgo", "Concepto", "Valor estimado", "Se superpone con"], ...conImpacto.map((h) => [h.numero, h.titulo || h.tema, impactoTexto(h), (h.superpone || []).join(", ") || "-"]), ["", "Total estimado sin duplicar", pesosTxt(sinDup.total), ""]],
      `El total suma los impactos en pesos de mayor a menor y deja por fuera los que se superponen con uno ya sumado${sinDup.omitidos.length ? ` (${sinDup.omitidos.map((h) => h.numero).join(", ")})` : ""}. Los valores «hasta» y los alcances por justificar no se suman: no son ahorros seguros, dependen de la respuesta del oferente.`)] : []),
    H1("Resultados de la revisión"),
    ...(conformes.length ? [H2("Aspectos verificados conformes"), P(conformes.map((v) => `• ${escH(v.texto)}`).join("<br>"))] : []),
    ...inc.flatMap((h) => [H2(`${h.numero}. ${h.titulo || h.tema}`), P(`${escH(h.hallazgo)}<br><b>Acción requerida:</b> ${escH(h.accion || "-")}${h.superpone?.length ? `<br><b>Superposición:</b> comparte ítems con ${h.superpone.join(", ")}; sus impactos no deben sumarse completos.` : ""}`)]),
    ...(res.comparados.length ? [T("Ítems comparados con los APU de Cinco S.A.S.", [
      ["Ítem", "Descripción", "Und", "Cantidad", "Precio oferta", "Referencia APU PRO", "Diferencia", "Estado"],
      ...res.comparados.map((c) => [c.item, c.desc.length > 90 ? c.desc.slice(0, 87) + "..." : c.desc, c.und || "", numTxt(c.cant), pesosTxt(c.vu), `${pesosTxt(c.ref)} (${c.codigo})`, `${c.dif >= 0 ? "+" : ""}${Math.round(c.dif * 100)} %`, c.estado])
    ], `Referencia: costo directo del APU de Cinco S.A.S. con los precios vigentes de la base de APU PRO${rev.base === "cd" ? "" : ", llevado a la misma base de la oferta"}. Se considera en rango una diferencia de hasta +/-20 %.`)] : []),
    ...(res.apus ? [
      H2("APU del oferente"),
      P(escH(`Se leyeron ${res.apus.vinculos.length + res.apus.huerfanos.length} APU de la oferta: ${res.apus.vinculos.length} corresponden a ítems del presupuesto${res.apus.sinApu.length ? `, ${res.apus.sinApu.length} ítems no tienen APU` : ""}${res.apus.huerfanos.length ? ` y ${res.apus.huerfanos.length} APU no están en el presupuesto` : ""}. Las cantidades de cada insumo en toda la obra se calcularon multiplicando la cantidad del APU por la cantidad del ítem.`)),
      T("Insumos de mayor peso (materiales)", [
        ["Insumo", "Und", "Cantidad en la obra", "Precio en los APU", "Valor final", "APU que lo usan"],
        ...res.apus.insumos.filter((e) => e.sec === "MA").slice(0, 15).map((e) => [e.d.length > 80 ? e.d.slice(0, 77) + "..." : e.d, e.u || "", numTxt(Math.round(e.q * 100) / 100), e.preciosLista.length > 1 ? `${pesosTxt(e.preciosLista[0])} a ${pesosTxt(e.preciosLista[e.preciosLista.length - 1])}` : pesosTxt(e.preciosLista[0]), pesosTxt(e.valorFinal), String(e.apus.length)])
      ], "Valor final con el AIU y el IVA de la oferta. Son los insumos cuyo precio conviene verificar con cotizaciones."),
      T("Jornales de los APU", [
        ["Cargo", "Jornal con prestaciones", "Valor final en la obra"],
        ...res.apus.insumos.filter((e) => e.sec === "MO").slice(0, 12).map((e) => [e.d, e.preciosLista.map(pesosTxt).join(" / "), pesosTxt(e.valorFinal)])
      ]),
      ...(res.apus.comparadosIns.length ? [T("Insumos comparados con la base de precios de Cinco S.A.S.", [
        ["Insumo", "Und", "Precio oferta", "Referencia APU PRO", "Diferencia", "Estado"],
        ...res.apus.comparadosIns.map((c) => [c.d, c.u || "", pesosTxt(c.p), `${pesosTxt(c.base)} (${c.codigo})`, `${c.dif >= 0 ? "+" : ""}${Math.round(c.dif * 100)} %`, c.estado])
      ], "Referencia: base de precios de APU PRO vigente a la fecha de la revisión. En rango: hasta +/-20 %.")] : [])
    ] : []),
    H1("Consolidado de hallazgos"),
    T("Hallazgos y acciones requeridas", [
      ["No.", "Hallazgo", "Ítems", "Severidad", "Impacto estimado", "Acción requerida"],
      // Cuadro resumen: el título del hallazgo (el texto completo está en «Resultados de la revisión»).
      ...inc.map((h) => [h.numero, h.titulo || (h.hallazgo.length > 140 ? h.hallazgo.slice(0, 137) + "..." : h.hallazgo), String(h.items || "-").length > 40 ? String(h.items).slice(0, 37) + "..." : String(h.items || "-"), h.sev, impactoTexto(h), h.accion || "-"])
    ], "Impacto estimado sobre el valor final (con AIU e IVA). El texto completo de cada hallazgo está en la sección «Resultados de la revisión» y el detalle ítem por ítem en el archivo Excel anexo."),
    H1("Concepto de la revisión"),
    P(`<b>Concepto: ${escH((CONCEPTOS[rev.concepto] || conceptoSugerido(inc)).toUpperCase())}.</b>`),
    ...(rev.conceptoTexto ? [P(escH(rev.conceptoTexto))] : []),
    ...(rev.recomendaciones ? [P(escH(rev.recomendaciones))] : []),
    H2("Limitaciones"),
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
// Formato Cinco (el mismo del presupuesto de APU PRO): logo, título, ficha de la oferta, línea
// ámbar, encabezados de tabla en ámbar, filas alternas, alturas según el texto y preparado
// para imprimir (horizontal, ajustado al ancho, encabezado repetido y «Página X de Y»).
const AZUL = "FF1F2732", AMBAR = "FFFEB209", AMBAR_SUAVE = "FFFFF3D1", GRIS = "FFF5F6F8", GRIS_TXT = "FF5A6270", BORDE_C = "FFD0D5DD";
const SEV_COLOR = { Mayor: "FFF8D0C4", Menor: "FFFFEBB0", "Observación": "FFDCE9F5" };
const SEV_TXT = { Mayor: "FF9B2C10", Menor: "FF7A5600", "Observación": "FF1F4E79" };
const MONEDA = '"$"#,##0';
const B = { style: "thin", color: { argb: BORDE_C } };
const BORDES = { top: B, left: B, bottom: B, right: B };
const fx = (extra = {}) => ({ name: "Calibri", size: 10, color: { argb: "FF1F2732" }, ...extra });
const relleno = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const letra = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
// Alto de fila para que el texto ajustado se vea completo (Excel no lo calcula al abrir).
const altoPara = (textos) => Math.max(16, ...textos.map(([t, ancho]) => Math.ceil(String(t ?? "").length / Math.max(4, ancho * 1.15)) * 12.8 + 3));

function hojaCinco(wb, nombre, { logo, rev, titulo, anchos, horizontal = true }) {
  const ws = wb.addWorksheet(nombre, {
    pageSetup: { paperSize: 1, orientation: horizontal ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 } },
    headerFooter: { oddFooter: `&L&8Cinco S.A.S. · APU PRO · ${(rev.codigo || "").replace(/&/g, "&&")}&C&8${titulo.replace(/&/g, "&&")}&R&8Página &P de &N` },
    views: [{ showGridLines: false }]
  });
  ws.columns = anchos.map((w) => ({ width: w }));
  const n = anchos.length;
  // El título empieza donde termina el logo (unos 165 px).
  let c0 = 1, px = 0;
  while (c0 < n && px < 165) { px += anchos[c0 - 1] * 7.2; c0++; }
  if (logo != null) ws.addImage(logo, { tl: { col: 0.15, row: 0.2 }, ext: { width: 150, height: 72 } });
  const anchoTitulo = anchos.slice(c0 - 1).reduce((t, w) => t + w, 0);
  ws.getRow(1).height = 24; ws.getRow(2).height = 24;
  ws.getRow(3).height = Math.max(20, altoPara([[`${rev.codigo || ""} · ${rev.nombre || ""}`, anchoTitulo * 0.9]]) + 2);
  ws.mergeCells(1, c0, 2, n);
  Object.assign(ws.getCell(1, c0), { value: titulo.toUpperCase(), font: fx({ size: 15, bold: true }), alignment: { vertical: "middle", horizontal: "left" } });
  ws.mergeCells(3, c0, 3, n);
  Object.assign(ws.getCell(3, c0), { value: `${rev.codigo ? rev.codigo + " · " : ""}${rev.nombre || ""}`, font: fx({ size: 11, bold: true, color: { argb: GRIS_TXT } }), alignment: { vertical: "middle", wrapText: true } });
  for (let c = 1; c <= n; c++) ws.getCell(4, c).border = { bottom: { style: "medium", color: { argb: AMBAR } } };
  ws.mergeCells(5, 1, 5, n);
  const datos = [rev.oferente && `Oferente: ${rev.oferente}`, rev.cliente && `Contratante: ${rev.cliente}`, rev.fechaOferta && `Oferta del ${fechaLarga(rev.fechaOferta)}`, `Revisión: ${fechaLarga(rev.fechaRevision || new Date().toISOString().slice(0, 10))}`].filter(Boolean).join("   ·   ");
  Object.assign(ws.getCell(5, 1), { value: datos, font: fx({ size: 9, color: { argb: GRIS_TXT } }), alignment: { vertical: "middle" } });
  ws.getRow(5).height = 18;
  ws.__fila = 7;
  return ws;
}
function tituloSeccion(ws, texto, n) {
  const f = ws.__fila;
  ws.mergeCells(f, 1, f, n);
  Object.assign(ws.getCell(f, 1), { value: texto.toUpperCase(), font: fx({ size: 10, bold: true, color: { argb: AZUL } }), border: { bottom: { style: "thin", color: { argb: AMBAR } } } });
  ws.getRow(f).height = 18;
  ws.__fila = f + 1;
}
// Tabla con encabezado ámbar. cols: [{ h, w (ancho de la columna, para calcular alturas), n (formato), al, wrap }]
function tabla(ws, cols, filas, { zebra = true, colorFila, repetir = false, total = null } = {}) {
  const h = ws.__fila;
  cols.forEach((c, j) => Object.assign(ws.getCell(h, j + 1), { value: c.h, font: fx({ size: 9, bold: true }), fill: relleno(AMBAR), border: BORDES, alignment: { horizontal: "center", vertical: "middle", wrapText: true } }));
  ws.getRow(h).height = altoPara(cols.map((c) => [c.h, c.w || 10]));
  if (repetir) { ws.pageSetup.printTitlesRow = `${h}:${h}`; ws.views = [{ showGridLines: false, state: "frozen", ySplit: h }]; }
  let f = h + 1;
  filas.forEach((fila, k) => {
    const r = ws.getRow(f);
    const color = colorFila?.(fila, k) || (zebra && k % 2 ? GRIS : null);
    cols.forEach((c, j) => {
      const cel = r.getCell(j + 1);
      cel.value = fila[j] ?? null;
      cel.border = BORDES;
      cel.font = fx(c.bold ? { bold: true } : {});
      cel.alignment = { vertical: "top", horizontal: c.al || (c.n ? "right" : "left"), wrapText: !!c.wrap };
      if (c.n) cel.numFmt = c.n;
      if (color) cel.fill = relleno(color);
    });
    r.height = altoPara(cols.map((c, j) => [c.wrap ? fila[j] : "", c.w || 10]));
    f++;
  });
  if (total) {
    const r = ws.getRow(f);
    cols.forEach((c, j) => {
      const cel = r.getCell(j + 1);
      cel.value = total[j] ?? null;
      cel.border = BORDES;
      cel.font = fx({ bold: true });
      cel.fill = relleno(AMBAR_SUAVE);
      cel.alignment = { vertical: "middle", horizontal: c.al || (c.n ? "right" : "left") };
      if (c.n) cel.numFmt = c.n;
    });
    r.height = 18;
    f++;
  }
  ws.__fila = f + 1;
  return { primera: h + 1, ultima: f - 1 - (total ? 1 : 0), filaTotal: total ? f - 1 : null };
}
const valorImpacto = (h) => (h.impacto != null && Number.isFinite(h.impacto) && h.impacto !== 0 ? Math.round(h.impacto) : h.impactoTexto || "-");

export function libroRevision(ExcelJS, rev, res, hallazgos, { logo = null } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cinco S.A.S. - APU PRO";
  const idLogo = logo ? wb.addImage({ base64: logo, extension: "png" }) : null;
  const F = res.F, inc = hallazgos.filter((h) => h.incluir), items = rev.items || [];
  const concepto = CONCEPTOS[rev.concepto] || conceptoSugerido(inc);

  // ---------- Resumen
  const aR = [8, 30, 12, 18, 18, 12];
  const wsR = hojaCinco(wb, "Resumen", { logo: idLogo, rev, titulo: "Revisión de presupuesto", anchos: aR, horizontal: false });
  tituloSeccion(wsR, "Datos de la oferta", aR.length);
  const ficha = [
    ["Oferta", rev.nombre || "-"], ["Oferente", rev.oferente || "-"], ["Contratante", rev.cliente || "-"],
    ["Fecha de la oferta", rev.fechaOferta ? fechaLarga(rev.fechaOferta) : "-"], ["Documento revisado", rev.documento || "-"],
    ["Capítulos / ítems / APU", `${res.capitulos.length} / ${items.length}${res.apus ? ` / ${res.apus.vinculos.length + res.apus.huerfanos.length}` : ""}`],
    ["Valores de los ítems", BASES[rev.base || "cd"]],
    ["AIU", `Administración ${pctTxt(F.aiu.a || 0)} · Imprevistos ${pctTxt(F.aiu.i || 0)} · Utilidad ${pctTxt(F.aiu.u || 0)}`],
    ["IVA", F.iva ? `${pctTxt(F.iva, 0)} ${minuscula(REGIMENES[F.reg])}` : "No se liquida"]
  ];
  for (const [et, v] of ficha) {
    const f = wsR.__fila;
    wsR.mergeCells(f, 1, f, 2); wsR.mergeCells(f, 3, f, aR.length);
    Object.assign(wsR.getCell(f, 1), { value: et, font: fx({ size: 9, bold: true, color: { argb: GRIS_TXT } }), fill: relleno(GRIS), border: BORDES, alignment: { vertical: "top" } });
    Object.assign(wsR.getCell(f, 3), { value: v, font: fx(), border: BORDES, alignment: { vertical: "top", wrapText: true } });
    wsR.getRow(f).height = altoPara([[v, 58]]);
    wsR.__fila = f + 1;
  }
  wsR.__fila++;
  // Concepto destacado.
  {
    const f = wsR.__fila;
    wsR.mergeCells(f, 1, f, 2); wsR.mergeCells(f, 3, f, aR.length);
    Object.assign(wsR.getCell(f, 1), { value: "CONCEPTO", font: fx({ bold: true, color: { argb: AMBAR } }), fill: relleno(AZUL), alignment: { vertical: "middle", horizontal: "center" } });
    Object.assign(wsR.getCell(f, 3), { value: concepto.toUpperCase(), font: fx({ bold: true, size: 11, color: { argb: "FFFFFFFF" } }), fill: relleno(AZUL), alignment: { vertical: "middle" } });
    wsR.getRow(f).height = 22;
    wsR.__fila = f + 1;
    if (rev.conceptoTexto) { const g = wsR.__fila; wsR.mergeCells(g, 1, g, aR.length); Object.assign(wsR.getCell(g, 1), { value: rev.conceptoTexto, font: fx(), alignment: { wrapText: true, vertical: "top" } }); wsR.getRow(g).height = altoPara([[rev.conceptoTexto, 95]]); wsR.__fila = g + 1; }
    wsR.__fila++;
  }
  tituloSeccion(wsR, "Valor por capítulo", aR.length);
  const tCap = tabla(wsR, [{ h: "Cap.", w: 8, al: "center" }, { h: "Capítulo", w: 30, wrap: true }, { h: "Ítems", w: 12, al: "center" }, { h: "", w: 18 }, { h: "Valor final", w: 18, n: MONEDA }, { h: "% del total", w: 12, n: "0.0%" }],
    res.capitulos.map((c) => [String(c.num), c.nombre, c.n, null, Math.round(c.final), c.pct]),
    { total: ["", "Total", items.length, null, Math.round(res.total), 1] });
  for (let f = tCap.primera - 1; f <= tCap.filaTotal; f++) wsR.mergeCells(f, 2, f, 4);
  tituloSeccion(wsR, "Composición del valor", aR.length);
  const comp = [["Costo directo", res.comp.cd, 1], [`Administración ${pctTxt(F.aiu.a || 0)}`, res.comp.a, F.aiu.a || 0], [`Imprevistos ${pctTxt(F.aiu.i || 0)}`, res.comp.i, F.aiu.i || 0], [`Utilidad ${pctTxt(F.aiu.u || 0)}`, res.comp.u, F.aiu.u || 0], [`IVA ${F.iva ? pctTxt(F.iva, 0) + " " + minuscula(REGIMENES[F.reg]) : ""}`, res.comp.iva, res.comp.cd ? res.comp.iva / res.comp.cd : 0]];
  const tComp = tabla(wsR, [{ h: "Componente", w: 50, wrap: true }, { h: "", w: 12 }, { h: "", w: 18 }, { h: "", w: 18 }, { h: "Valor", w: 18, n: MONEDA }, { h: "% del costo directo", w: 12, n: "0.0%" }],
    comp.map(([k, v, p]) => [k, null, null, null, Math.round(v), p]),
    { zebra: false, total: ["Total recalculado", null, null, null, Math.round(res.total), null] });
  for (let f = tComp.primera - 1; f <= tComp.filaTotal; f++) wsR.mergeCells(f, 1, f, 4);
  if (res.declarado) {
    const f = wsR.__fila - 1;
    wsR.mergeCells(f, 1, f, 4);
    const dif = res.declarado - res.total;
    Object.assign(wsR.getCell(f, 1), { value: `Total declarado en la oferta${Math.abs(dif) < 1000 ? " (coincide)" : ` (diferencia ${pesosTxt(dif)})`}`, font: fx({ size: 9, color: { argb: GRIS_TXT } }), alignment: { horizontal: "right" } });
    Object.assign(wsR.getCell(f, 5), { value: Math.round(res.declarado), numFmt: MONEDA, font: fx({ size: 9, color: { argb: GRIS_TXT } }) });
    wsR.__fila = f + 2;
  }
  tituloSeccion(wsR, "Resumen de hallazgos", aR.length);
  const sinDup = totalSinDuplicar(inc);
  const tH = tabla(wsR, [{ h: "No.", w: 8, al: "center", bold: true }, { h: "Hallazgo", w: 42, wrap: true }, { h: "", w: 12 }, { h: "Se superpone con", w: 18, al: "center", wrap: true }, { h: "Severidad", w: 18, al: "center" }, { h: "Impacto", w: 12, n: MONEDA, wrap: true }],
    inc.map((x) => [x.numero, x.titulo || x.tema, null, (x.superpone || []).join(", "), x.sev, valorImpacto(x)]),
    { zebra: false, colorFila: (f) => SEV_COLOR[f[4]], total: ["", "Total estimado sin duplicar", null, "", "", Math.round(sinDup.total)] });
  for (let f = tH.primera - 1; f <= tH.filaTotal; f++) wsR.mergeCells(f, 2, f, 3);
  {
    const f = wsR.__fila - 1;
    wsR.mergeCells(f, 1, f, 6);
    Object.assign(wsR.getCell(f, 1), { value: `Suma de los impactos en pesos sin contar dos veces el mismo dinero${sinDup.omitidos.length ? ` (se dejan por fuera ${sinDup.omitidos.map((h) => h.numero).join(", ")}, que se superponen con otros)` : ""}. Los valores «hasta» y los alcances por justificar no se suman.`, font: fx({ size: 8, italic: true, color: { argb: GRIS_TXT } }), alignment: { wrapText: true, vertical: "top" } });
    wsR.getRow(f).height = 26;
    wsR.__fila = f + 1;
  }
  wsR.getColumn(6).width = 16;
  wsR.pageSetup.printArea = `A1:F${wsR.__fila}`;

  // ---------- Hallazgos
  const aH = [8, 12, 13, 58, 22, 16, 12, 44];
  const wsH = hojaCinco(wb, "Hallazgos", { logo: idLogo, rev, titulo: "Hallazgos y acciones requeridas", anchos: aH });
  tabla(wsH, [{ h: "No.", w: 8, al: "center", bold: true }, { h: "Severidad", w: 12, al: "center" }, { h: "Tema", w: 13 }, { h: "Hallazgo", w: 58, wrap: true }, { h: "Ítems", w: 22, wrap: true }, { h: "Impacto estimado", w: 16, n: MONEDA, wrap: true }, { h: "Se superpone con", w: 12, al: "center", wrap: true }, { h: "Acción requerida", w: 44, wrap: true }],
    inc.map((x) => [x.numero, x.sev, x.tema, x.titulo ? `${x.titulo}. ${x.hallazgo}` : x.hallazgo, x.items, valorImpacto(x), (x.superpone || []).join(", "), x.accion || "-"]),
    { zebra: false, repetir: true, colorFila: (f) => SEV_COLOR[f[1]] });
  wsH.eachRow((r, i) => { if (i > 7) { const c = r.getCell(2); if (SEV_TXT[c.value]) c.font = fx({ bold: true, color: { argb: SEV_TXT[c.value] } }); } });

  // ---------- Ítems (con fórmulas: el revisor cambia un dato y ve el recálculo)
  const numeros = Object.fromEntries(inc.map((h) => [h.clave, h.numero]));
  const comp2 = Object.fromEntries(res.comparados.map((c) => [c.id, c]));
  // Las columnas de APU PRO solo van si algún ítem tiene APU de referencia.
  const conRef = res.comparados.length > 0;
  const colsRef = conRef ? [{ h: "APU PRO", w: 11, al: "center" }, { h: "Precio referencia", w: 14, n: MONEDA }, { h: "Dif. frente a referencia", w: 10, n: "0%" }] : [];
  const colsI = [{ h: "Cap.", w: 6, al: "center" }, { h: "Ítem", w: 8, al: "center" }, { h: "Descripción", w: conRef ? 48 : 60, wrap: true }, { h: "Und", w: 6, al: "center" }, { h: "Cantidad", w: 10, n: "#,##0.00##" }, { h: "Valor unitario", w: 14, n: MONEDA }, { h: "Valor total oferta", w: 15, n: MONEDA }, { h: "Cantidad × valor unitario", w: 15, n: MONEDA }, { h: "Diferencia", w: 12, n: MONEDA }, { h: "Valor final", w: 15, n: MONEDA }, ...colsRef, { h: "Hallazgos", w: 14, wrap: true }];
  const aI = colsI.map((c) => c.w);
  const wsI = hojaCinco(wb, "Ítems", { logo: idLogo, rev, titulo: "Presupuesto de la oferta, ítem por ítem", anchos: aI });
  const ordenNum = (x) => (x.startsWith("OB") ? 1000 : 0) + Number(x.replace(/\D/g, ""));
  const tI = tabla(wsI, colsI,
    items.map((it) => { const c = comp2[it.id]; const marcas = [...new Set((res.porItem[it.id] || []).map((k) => numeros[k]).filter(Boolean))].sort((p, q) => ordenNum(p) - ordenNum(q)).join(", "); return [it.cap, it.item, it.desc, it.und, it.cant, it.vu, it.vt, null, null, null, ...(conRef ? [c?.codigo || it.ref?.codigo || "", c ? Math.round(c.ref) : null, c ? c.dif : null] : []), marcas]; }),
    { repetir: true, colorFila: (f, k) => (f[f.length - 1] ? "FFFFF6DC" : k % 2 ? GRIS : null) });
  for (let r = tI.primera; r <= tI.ultima; r++) {
    wsI.getCell(r, 8).value = { formula: `IFERROR(ROUND(E${r}*F${r},0),0)` };
    wsI.getCell(r, 9).value = { formula: `IFERROR(G${r}-H${r},0)` };
    wsI.getCell(r, 10).value = { formula: `IFERROR(ROUND(G${r}*${F.aFinal.toFixed(8)},0),0)` };
  }
  const tot = wsI.getRow(tI.ultima + 1);
  [["C", "Total"], ["G", { formula: `SUM(G${tI.primera}:G${tI.ultima})` }], ["H", { formula: `SUM(H${tI.primera}:H${tI.ultima})` }], ["I", { formula: `SUM(I${tI.primera}:I${tI.ultima})` }], ["J", { formula: `SUM(J${tI.primera}:J${tI.ultima})` }]].forEach(([c, v]) => { tot.getCell(c).value = v; });
  for (let j = 1; j <= aI.length; j++) Object.assign(tot.getCell(j), { border: BORDES, font: fx({ bold: true }), fill: relleno(AMBAR_SUAVE), ...(j >= 7 && j <= 10 ? { numFmt: MONEDA } : {}) });
  tot.height = 18;

  if (res.apus) {
    const A = res.apus;
    const malos = new Map(A.malos.map((m) => [m.a, m.prob.join("; ")]));
    const filasApu = [...A.vinculos.map((v) => ({ a: v.apu, it: items.find((x) => x.id === v.id), ref: v.ref, dif: v.dif })), ...A.huerfanos.map((a) => ({ a, it: null, ref: a.pu, dif: null }))];
    const secs = Object.keys(SECCIONES_APU);
    const aA = [8, 44, 6, ...secs.map(() => 13), 14, 14, 14, 12, 30];
    const wsA = hojaCinco(wb, "APU oferente", { logo: idLogo, rev, titulo: "APU del oferente frente al presupuesto", anchos: aA });
    tabla(wsA, [{ h: "Ítem", w: 8, al: "center" }, { h: "Descripción", w: 44, wrap: true }, { h: "Und", w: 6, al: "center" }, ...secs.map((k) => ({ h: SECCIONES_APU[k], w: 13, n: MONEDA })), { h: "Costo directo", w: 14, n: MONEDA }, { h: "Precio APU", w: 14, n: MONEDA }, { h: "Valor unitario presupuesto", w: 14, n: MONEDA }, { h: "Diferencia", w: 12, n: MONEDA }, { h: "Observación", w: 30, wrap: true }],
      filasApu.map(({ a, it, ref, dif }) => [a.item, a.desc, a.und, ...secs.map((k) => (a.sub?.[k] ?? (a.secciones[k] ? a.secciones[k].reduce((s, x) => s + (Number(x.v) || 0), 0) : null))), a.cd, ref, it?.vu ?? null, dif, [it ? "" : "No está en el presupuesto", malos.get(a) || ""].filter(Boolean).join(". ")]),
      { repetir: true, colorFila: (f, k) => (f[f.length - 1] || (f[f.length - 2] && Math.abs(f[f.length - 2]) > 1) ? "FFFFF6DC" : k % 2 ? GRIS : null) });
    const compI = new Map(A.comparadosIns.map((c) => [c.clave, c]));
    const aN = [20, 50, 7, 13, 13, 13, 15, 15, 8, 11, 13, 9];
    const wsN = hojaCinco(wb, "Insumos", { logo: idLogo, rev, titulo: "Insumos de los APU en toda la obra", anchos: aN });
    tabla(wsN, [{ h: "Sección", w: 20 }, { h: "Insumo", w: 50, wrap: true }, { h: "Und", w: 7, al: "center" }, { h: "Cantidad en la obra", w: 13, n: "#,##0.00" }, { h: "Precio mínimo", w: 13, n: MONEDA }, { h: "Precio máximo", w: 13, n: MONEDA }, { h: "Valor (costo directo)", w: 15, n: MONEDA }, { h: "Valor final", w: 15, n: MONEDA }, { h: "N.º de APU", w: 8, al: "center" }, { h: "APU PRO", w: 11, al: "center" }, { h: "Precio referencia", w: 13, n: MONEDA }, { h: "Dif.", w: 9, n: "0%" }],
      A.insumos.map((e) => { const c = compI.get(e.clave); return [SECCIONES_APU[e.sec] || e.sec, e.d, e.u, Math.round(e.q * 100) / 100, e.preciosLista[0] ?? null, e.preciosLista[e.preciosLista.length - 1] ?? null, Math.round(e.valor), Math.round(e.valorFinal), e.apus.length, c?.codigo || "", c ? Math.round(c.base) : null, c ? c.dif : null]; }),
      { repetir: true, colorFila: (f, k) => (f[4] != null && f[5] != null && f[5] / f[4] > 1.01 ? "FFFFF6DC" : (f[11] ?? 0) > 0.2 ? "FFF8D0C4" : k % 2 ? GRIS : null) });
  }
  return wb;
}
