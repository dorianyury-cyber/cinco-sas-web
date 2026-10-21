// APU PRO — lectura de ofertas en PDF (presupuesto y APU) a partir de la posición del texto.
// Recibe la librería pdf.js (window.pdfjsLib en el navegador, pdfjs-dist en pruebas) y no
// depende del DOM: agrupa el texto en líneas, reconoce las tablas por sus encabezados y
// asigna cada trozo de texto a la columna con la que más se superpone.
import { normalizar } from "./ap-calculos.js";
import { aNumero } from "./ap-revision-motor.js";

// ---------------------------------------------------------------- texto por líneas
export async function leerPaginas(pdfjsLib, datos, { progreso = () => {} } = {}) {
  const doc = await pdfjsLib.getDocument({ data: datos, isEvalSupported: false }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const vp = p.getViewport({ scale: 1 });
    const tc = await p.getTextContent();
    paginas.push({ n, ancho: vp.width, lineas: lineasDeTexto(tc.items, vp.height) });
    progreso(n, doc.numPages);
  }
  return paginas;
}
export function lineasDeTexto(items, alto) {
  // El ancho se limita con el tamaño de la letra: algunos PDF informan anchos exagerados y el
  // texto invadiría la columna vecina.
  const ancho = (i) => Math.min(i.width || 0, String(i.str).trim().length * (Math.hypot(i.transform[0], i.transform[1]) || 10) * 0.7);
  const trozos = items.filter((i) => String(i.str || "").trim()).map((i) => ({ s: i.str.replace(/\s+/g, " ").trim(), x0: i.transform[4], x1: i.transform[4] + ancho(i), y: alto - i.transform[5], fs: Math.hypot(i.transform[0], i.transform[1]) || 8 }));
  trozos.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const lineas = [];
  for (const t of trozos) {
    const l = lineas.find((x) => Math.abs(x.y - t.y) <= 2.5);
    if (l) l.trozos.push(t); else lineas.push({ y: t.y, trozos: [t] });
  }
  // Paradas de tabulación: posiciones donde muchas líneas empiezan un trozo (inicio de una
  // columna). Las palabras no se unen a través de ellas.
  const cuenta = new Map();
  for (const l of lineas) for (const t of l.trozos) { const k = Math.round(t.x0); cuenta.set(k, (cuenta.get(k) || 0) + 1); }
  const minimo = Math.max(4, lineas.length * 0.2);
  const esParada = (x) => [-1, 0, 1].some((d) => (cuenta.get(Math.round(x) + d) || 0) >= minimo);
  for (const l of lineas) {
    l.trozos.sort((a, b) => a.x0 - b.x0);
    // Une los trozos que se tocan (pdf.js a veces parte una palabra o un número) y las palabras
    // de una misma frase (algunos PDF traen cada palabra por separado: «Suministro,» «hincado,»).
    // Entre columnas el espacio es mucho mayor que el de una palabra. No se unen trozos que se
    // montan: a veces pdf.js informa un ancho de más y un código («2-40») quedaría pegado.
    const celdas = [];
    for (const t of l.trozos) {
      const ult = celdas[celdas.length - 1];
      const hueco = ult ? t.x0 - ult.x1 : 0;
      if (ult && hueco < 0.6 && hueco > -1.5) { ult.s += t.s; ult.x1 = Math.max(ult.x1, t.x1); }
      else if (ult && hueco >= 0.6 && hueco < Math.min(ult.fs, t.fs) * 0.55 && !RE_CODIGO.test(ult.s) && !RE_CODIGO.test(t.s) && !esNumero(ult.s) && !esNumero(t.s) && !esParada(t.x0)) { ult.s += ` ${t.s}`; ult.x1 = Math.max(ult.x1, t.x1); }
      else celdas.push({ ...t });
    }
    l.celdas = celdas;
    l.texto = celdas.map((c) => c.s).join(" ");
    l.norm = normalizar(l.texto);
    delete l.trozos;
  }
  return lineas.sort((a, b) => a.y - b.y);
}

// Columnas a partir de una línea de encabezados: cada una ocupa desde la mitad del espacio
// con la anterior hasta la mitad con la siguiente.
function columnasDe(celdas) {
  const cs = celdas.map((c) => ({ titulo: c.s, norm: normalizar(c.s), centro: (c.x0 + c.x1) / 2 }));
  return cs.map((c, k) => ({ ...c, desde: k ? (cs[k - 1].centro + c.centro) / 2 : -Infinity, hasta: k < cs.length - 1 ? (c.centro + cs[k + 1].centro) / 2 : Infinity }));
}
function columnaDe(celda, cols) {
  let mejor = -1, solape = -1;
  cols.forEach((c, k) => {
    const s = Math.min(celda.x1, c.hasta) - Math.max(celda.x0, c.desde);
    if (s > solape) { solape = s; mejor = k; }
  });
  return mejor;
}
const esNumero = (s) => aNumero(s) != null;
// Reparte las celdas de una línea en la fila f. Una descripción corta empieza muy a la
// izquierda y caería en la columna del código: el texto que no tiene forma de código y cae
// en una columna de ítem, APU o código se pasa a la descripción.
function asignar(f, celdas, cols, jDesc) {
  for (const c of celdas) {
    let j = columnaDe(c, cols);
    const deCodigo = jDesc >= 0 && j !== jDesc && /^(item|apu|cod|no\b|n°|nº|num)/.test(cols[j].norm);
    if (deCodigo && ((!RE_CODIGO.test(c.s.trim().replace(/\.$/, "")) && !esNumero(c.s)) || f[j])) j = jDesc;
    // Una unidad nunca es un número ni un texto largo: es el final de la descripción.
    else if (jDesc >= 0 && /^(und|unid|un\b|u\.?\s?m|medida)/.test(cols[j].norm) && (esNumero(c.s) || c.s.length > 8 || /\s/.test(c.s.trim()))) j = jDesc;
    f[j] = f[j] ? `${f[j]} ${c.s}` : c.s;
  }
  return f;
}
const RE_CODIGO = /^[A-Za-z]{0,5}[-.]?\d+([.\-_]\d+)*[A-Za-z]?$/;

// Las líneas de texto entre dos filas con valores (anclas) se reparten cortando en el mayor
// espacio vertical: lo de arriba del corte es de la fila de arriba y lo de abajo, de la de
// abajo (sirve para celdas centradas, alineadas arriba y de varias líneas). En empate, si la
// de abajo ya trae su descripción en su línea, el texto es de la de arriba. Cada fila tiene
// { y, conDesc }; unir(línea, ancla) junta el texto.
function repartir(anclas, sueltas, unir) {
  const cadena = (ls, desde, haciaAbajo) => {
    const out = [];
    let y = desde;
    for (const x of haciaAbajo ? ls : [...ls].reverse()) { if (Math.abs(x.y - y) > (out.length ? 12 : 16)) break; out.push(x); y = x.y; }
    return out;
  };
  for (let i = -1; i < anclas.length; i++) {
    const A = anclas[i] || null, B = anclas[i + 1] || null;
    const ls = sueltas.filter((x) => (!A || x.y > A.y) && (!B || x.y < B.y));
    if (!ls.length || (!A && !B)) continue;
    if (!A) { for (const x of cadena(ls, B.y, false)) unir(x, B); continue; }
    if (!B) { for (const x of cadena(ls, A.y, true)) unir(x, A); continue; }
    // Si ambas filas traen su descripción en su propia línea, las celdas van alineadas arriba:
    // lo que hay entre ellas es de la de arriba.
    if (A.conDesc && B.conDesc) { for (const x of cadena(ls, A.y, true)) unir(x, A); continue; }
    const ys = [A.y, ...ls.map((x) => x.y), B.y];
    const gaps = ys.slice(1).map((y, k) => y - ys[k]);
    const max = Math.max(...gaps);
    const corte = B.conDesc ? gaps.lastIndexOf(max) : gaps.indexOf(max);
    for (const x of cadena(ls.slice(0, corte), A.y, true)) unir(x, A);
    for (const x of cadena(ls.slice(corte), B.y, false)) unir(x, B);
  }
}

// ---------------------------------------------------------------- presupuesto
const RE_DESC = /descrip|actividad|concepto|detalle/;
const RE_CANT = /^cant/;
const RE_VU = /unit|precio|^v\/?r\.? ?u|^valor u/;
const firmaEnc = (cols) => cols.map((c) => c.norm.replace(/[^a-z]/g, "").slice(0, 6)).join("|");
// Devuelve la tabla del presupuesto como matriz (fila 0 = encabezados) para el mismo lector
// que se usa con Excel. Se toman las páginas cuyo encabezado tiene descripción, cantidad y
// valor unitario; si hay varios formatos, el que más páginas ocupa.
export function tablaPresupuesto(paginas) {
  const candidatas = [];
  for (const p of paginas) for (let k = 0; k < p.lineas.length; k++) {
    const l = p.lineas[k];
    if (p.lineas.some((x) => RE_INICIO_APU.test(x.norm))) break; // páginas de APU
    if (l.celdas.length < 4) continue;
    const ns = l.celdas.map((c) => normalizar(c.s));
    if (ns.some((n) => RE_DESC.test(n)) && ns.some((n) => RE_CANT.test(n)) && ns.some((n) => RE_VU.test(n)) && ns.every((n) => n.length <= 30)) {
      const cols = columnasDe(l.celdas);
      candidatas.push({ pagina: p, k, cols, firma: firmaEnc(cols) });
      break;
    }
  }
  if (!candidatas.length) return null;
  const cuenta = {};
  for (const c of candidatas) cuenta[c.firma] = (cuenta[c.firma] || 0) + 1;
  const firma = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
  const usadas = candidatas.filter((c) => c.firma === firma);
  const cols = usadas[0].cols;
  const jDesc = cols.findIndex((c) => RE_DESC.test(c.norm));
  const jCod = cols.findIndex((c, j) => j !== jDesc && /^(item|apu|cod|no\b|n°|nº|num)/.test(c.norm));
  const numericas = new Set(cols.map((c, j) => (RE_CANT.test(c.norm) || RE_VU.test(c.norm) || /total|parcial|valor/.test(c.norm) ? j : -1)).filter((j) => j >= 0));
  const matriz = [cols.map((c) => c.titulo)];
  const conEncabezado = new Map(candidatas.map((c) => [c.pagina, c]));
  const usadasN = [];
  let xDescPrevio = null, colsPag = null;
  for (const pagina of paginas) {
    // La tabla sigue en las páginas sin encabezado hasta una página de APU o con otra tabla.
    const cand = conEncabezado.get(pagina);
    if (pagina.lineas.some((x) => RE_INICIO_APU.test(x.norm)) || (cand && cand.firma !== firma)) { colsPag = null; continue; }
    if (cand) colsPag = cand.cols;
    if (!colsPag) continue;
    const kEnc = cand ? cand.k : -1;
    const encabezado = normalizar(colsPag.map((c) => c.titulo).join(" "));
    const filas = [];
    pagina.lineas.forEach((l, i) => {
      // El encabezado (repetido en cada capítulo o página) se omite.
      if (i === kEnc || l.norm === encabezado) return;
      const f = Array(cols.length).fill("");
      asignar(f, l.celdas, colsPag, jDesc);
      const ancla = [...numericas].some((j) => esNumero(f[j]));
      // Línea sin números ni código de ítem: continuación de una descripción (aunque empiece
      // debajo de otra columna, como pasa con las palabras que sobran de la línea anterior).
      // (Los números dentro de la descripción, como «12 m X 510 kg», no cuentan.)
      const enDesc = (c) => columnaDe(c, colsPag) === jDesc;
      const conCodigo = jCod >= 0 && RE_CODIGO.test(String(f[jCod]).trim().replace(/\.$/, ""));
      const soloTexto = !ancla && !conCodigo;
      // Arriba del encabezado o en una página sin él solo valen las filas con valores (y sus
      // continuaciones): lo demás son títulos y datos de la página.
      filas.push({ y: l.y, f, ancla, soloTexto, conCodigo, fuera: !cand || i < kEnc, x0: l.celdas[0].x0, texto: l.texto, xDesc: l.celdas.find(enDesc)?.x0, conDesc: !!f[jDesc] });
    });
    // Una página sin encabezado ni ítems con código no es parte de la tabla.
    if (!cand && !filas.some((x) => x.ancla && x.conCodigo)) { colsPag = null; continue; }
    usadasN.push(pagina.n);
    // Las descripciones partidas en varias líneas (arriba y abajo de la fila con números) se
    // unen a la fila más cercana. Una continuación empieza donde empiezan las descripciones;
    // un título de capítulo empieza en otro lado (margen o centrado) y queda como fila propia.
    const anclas = filas.filter((x) => x.ancla);
    // Dónde empiezan las descripciones: se mide en las filas de ítems (con código), no en las
    // de subtotal, que suelen ir centradas; si la página no tiene, vale la de la anterior.
    const xs = anclas.filter((a) => a.conCodigo).map((a) => a.xDesc).filter((x) => x != null).sort((a, b) => a - b);
    const xDesc = xs.length ? (xDescPrevio = xs[Math.floor(xs.length / 2)]) : xDescPrevio;
    const extra = new Map();
    const sueltas = filas.filter((x) => x.soloTexto && (xDesc == null || Math.abs(x.x0 - xDesc) <= 8));
    repartir(anclas, sueltas, (x, a) => { x.f.fill(""); x.f[jDesc] = x.texto; if (!extra.has(a)) extra.set(a, []); extra.get(a).push(x); x.unida = true; });
    for (const x of filas) {
      if (x.unida || (x.fuera && !x.ancla)) continue;
      if (extra.has(x)) {
        const partes = [...extra.get(x), x].sort((a, b) => a.y - b.y).map((p) => p.f[jDesc]).filter(Boolean);
        x.f[jDesc] = partes.join(" ");
      }
      if (x.f.some(Boolean)) matriz.push(x.f);
    }
  }
  return { matriz, paginas: usadasN };
}

// ---------------------------------------------------------------- APU
const RE_INICIO_APU = /analisis de precios? unitarios?|analisis unitario|^a\.?\s?p\.?\s?u\.?(\s|$)/;
const SECCIONES = [
  ["EQ", /^(equipos?|herramientas?|maquinaria)/],
  ["ED", /^(epp|dotacion|elementos de proteccion)/],
  ["MA", /^materiales?/],
  ["TR", /^(transportes?|acarreos?)/],
  ["MO", /^mano de obra/],
  ["IND", /^(costos? indirectos?|a\.?\s?i\.?\s?u)/]
];
const sinOrdinal = (n) => n.replace(/^([ivx]+|[a-e]|\d+)[.)-]\s*/, "");
function seccionDe(l) {
  if (l.celdas.length > 2) return null;
  const n = sinOrdinal(l.norm);
  return SECCIONES.find(([, re]) => re.test(n))?.[0] || null;
}
// Papel de cada columna de una tabla de insumos según su título.
function papeles(cols) {
  const p = {};
  const ns = cols.map((c) => c.norm);
  const busca = (re, excluir = []) => ns.findIndex((n, j) => re.test(n) && !excluir.includes(j));
  p.desc = busca(/descrip|trabajador|vehiculo|maquinaria|insumo|concepto|nombre|personal|cargo/);
  p.cod = busca(/^(ref|cod|item)/, [p.desc]);
  p.und = busca(/^unid|^und|^u\.?\s?m/);
  p.cant = busca(/^cant/);
  p.desp = busca(/desperd/);
  p.rend = busca(/rend/);
  const numericas = ns.map((n, j) => (/v\/?r|valor|parcial|total|precio|jornal|tarifa|costo|importe|prestac/.test(n) ? j : -1)).filter((j) => j >= 0);
  p.parcial = numericas.length ? numericas[numericas.length - 1] : cols.length - 1;
  for (const re of [/jornal total/, /precio/, /valor d|tarifa|valor hora/, /valor unit|v\/?r\.? ?unit|costo unit/, /jornal/]) {
    const j = busca(re, [p.parcial]);
    if (j >= 0) { p.precio = j; break; }
  }
  return p;
}
const ultimoNumero = (l) => { for (let k = l.celdas.length - 1; k >= 0; k--) { const v = aNumero(l.celdas[k].s); if (v != null) return v; } return null; };
const porcentaje = (l) => { const c = l.celdas.find((x) => /%\s*$/.test(x.s)); return c ? aNumero(c.s) : null; };

export function leerApus(paginas) {
  const lineas = paginas.flatMap((p) => p.lineas.map((l) => ({ ...l, pagina: p.n })));
  // Cortes: cada título «Análisis de precios unitarios» empieza un APU, salvo que el tramo no
  // traiga encabezado de ítem (continuación de la página anterior).
  const tramos = [];
  let actual = null;
  for (const l of lineas) {
    if (RE_INICIO_APU.test(l.norm)) { actual = { lineas: [] }; tramos.push(actual); continue; }
    if (actual) actual.lineas.push(l);
  }
  const apus = [];
  for (const t of tramos) {
    const a = leerApu(t.lineas);
    if (!a) continue;
    if (!a.item && apus.length && !a.desc) { const prev = apus[apus.length - 1]; for (const k of Object.keys(a.secciones)) (prev.secciones[k] ||= []).push(...a.secciones[k]); Object.assign(prev, Object.fromEntries(Object.entries(a).filter(([k, v]) => ["cd", "pu", "sai"].includes(k) && v != null))); continue; }
    apus.push(a);
  }
  // Un APU de verdad tiene insumos con valor y algún total (descarta menciones en el texto).
  return apus.filter((a) => (a.item || a.desc) && Object.values(a.secciones).some((ls) => ls.length) && (a.cd != null || a.pu != null || Object.keys(a.sub).length));
}

function leerApu(lineas) {
  const a = { item: "", desc: "", und: "", cant: null, pagina: lineas[0]?.pagina, secciones: {}, sub: {}, aiu: {}, cd: null, sai: null, pu: null };
  let sec = null, cols = null, pap = null, filas = [];
  const cerrar = () => {
    if (!sec || !filas.length) { filas = []; return; }
    const anclas = filas.filter((x) => x.num);
    for (const x of anclas) x.conDesc = !!x.d;
    repartir(anclas, filas.filter((x) => !x.num && x.d), (x, c) => c.extra.push(x));
    for (const x of anclas) {
      const d = [...x.extra, x].sort((p, q) => p.y - q.y).map((p) => p.d).filter(Boolean).join(" ");
      (a.secciones[sec] ||= []).push({ d, u: x.u, c: x.c, p: x.p, r: x.r, dp: x.dp, v: x.v, ...(x.cod ? { cod: x.cod } : {}) });
    }
    filas = [];
  };
  for (let k = 0; k < lineas.length; k++) {
    const l = lineas[k];
    const n = l.norm;
    // Encabezado del ítem: «ITEM | DESCRIPCIÓN | UNIDAD | CANTIDAD» (o «Código APU | Nombre del
    // APU | Unidad | Rendimiento») y las líneas que le siguen pegadas.
    if (!a.item && !sec && /^(item|cod|apu)/.test(n) && /descrip|nombre|actividad/.test(n)) {
      const cs = columnasDe(l.celdas);
      const jI = cs.findIndex((c) => /^(item|cod|apu)/.test(c.norm)), jD = cs.findIndex((c) => /descrip|nombre|actividad/.test(c.norm)), jU = cs.findIndex((c) => /^unid|^und/.test(c.norm)), jC = cs.findIndex((c) => /^cant/.test(c.norm)), jR = cs.findIndex((c) => /^rend/.test(c.norm));
      let yPrev = l.y;
      for (let m = k + 1; m < Math.min(lineas.length, k + 6); m++) {
        const lm = lineas[m];
        if (seccionDe(lm) || lm.y - yPrev > (m === k + 1 ? 22 : 14) || /^(categoria|parametros|dias|fecha|cliente|objeto|contrat|nit|grupo)/.test(lm.norm)) break;
        yPrev = lm.y;
        if (jR >= 0) { const fr = asignar(Array(cs.length).fill(""), lm.celdas, cs, jD); if (fr[jR] && a.rend == null) a.rend = aNumero(fr[jR]); }
        const f = Array(cs.length).fill("");
        asignar(f, lm.celdas, cs, jD);
        // El ítem debe tener forma de código; un texto bajo esa columna es parte de la descripción.
        if (f[jI] && !a.item && RE_CODIGO.test(f[jI].trim())) a.item = f[jI].trim();
        else if (f[jI]) f[jD] = [f[jI], f[jD]].filter(Boolean).join(" ");
        if (f[jD]) a.desc = a.desc ? `${a.desc} ${f[jD]}` : f[jD];
        if (jU >= 0 && f[jU] && !a.und) a.und = f[jU];
        if (jC >= 0 && f[jC] && a.cant == null) a.cant = aNumero(f[jC]);
      }
      continue;
    }
    if (!a.item) { const m = l.texto.match(/^(?:item|ítem|apu|c[oó]digo)\s*(?:n[o°º.]*)?\s*[:.]\s*(\S+)\s*(.*)$/i); if (m) { a.item = m[1]; if (m[2] && !a.desc) a.desc = m[2]; continue; } }
    const s = seccionDe(l);
    if (s) { cerrar(); sec = s; cols = null; pap = null; continue; }
    if (/^sub ?total/.test(n) || /^subtotal/.test(sinOrdinal(n))) {
      if (/antes de iva/.test(n)) { a.sai = ultimoNumero(l); continue; }
      if (sec && sec !== "IND" && sec !== "FIN") a.sub[sec] = ultimoNumero(l);
      cerrar(); continue;
    }
    if (/total costos? directos?|costo directo total|^costo directo/.test(n)) { cerrar(); a.cd = ultimoNumero(l); sec = "FIN"; continue; }
    if (/precio unitario|valor unitario total|precio total|valor total (del )?(item|apu)/.test(n)) { const v = ultimoNumero(l); if (v != null) a.pu = v; continue; }
    if (/^administraci/.test(n)) { a.aiu.a = { pct: porcentaje(l), v: ultimoNumero(l) }; continue; }
    if (/^imprevist/.test(n)) { a.aiu.i = { pct: porcentaje(l), v: ultimoNumero(l) }; continue; }
    if (/^utilidad/.test(n)) { a.aiu.u = { pct: porcentaje(l), v: ultimoNumero(l) }; continue; }
    if (/\biva\b/.test(n) && sec === "IND" || /^iva\b/.test(n)) { a.iva = { pct: porcentaje(l), v: ultimoNumero(l) }; continue; }
    if (!sec || sec === "IND" || sec === "FIN") continue;
    // Encabezado de columnas de la sección.
    if (!cols && l.celdas.length >= 3 && l.celdas.every((c) => !esNumero(c.s) || /^\d$/.test(c.s.trim())) && /descrip|trabajador|vehiculo|maquinaria|insumo|concepto|cargo|personal/.test(n)) {
      // Títulos de columna en dos o tres renglones («Vr. mensual o» / «unitario»): se juntan
      // las líneas pegadas que solo traen títulos y se apilan los que caen en la misma columna.
      const vecinas = [lineas[k - 1], lineas[k + 1]].filter((x) => x && Math.abs(x.y - l.y) <= 6 && x.celdas.every((c) => !esNumero(c.s)) && !seccionDe(x));
      const celdas = [l, ...vecinas].flatMap((x) => x.celdas.map((c) => ({ ...c, y: x.y }))).sort((p, q) => p.x0 - q.x0);
      const grupos = [];
      for (const c of celdas) {
        const g = grupos[grupos.length - 1];
        if (g && c.x0 <= g.x1 + 2) { g.partes.push(c); g.x1 = Math.max(g.x1, c.x1); } else grupos.push({ x0: c.x0, x1: c.x1, partes: [c] });
      }
      cols = columnasDe(grupos.map((g) => ({ x0: g.x0, x1: g.x1, s: g.partes.sort((p, q) => p.y - q.y).map((p) => p.s).join(" ") })));
      pap = papeles(cols);
      if (vecinas.includes(lineas[k + 1])) k++;
      continue;
    }
    if (!cols) continue;
    const f = Array(cols.length).fill("");
    for (const c of l.celdas) { const j = columnaDe(c, cols); f[j] = f[j] ? `${f[j]} ${c.s}` : c.s; }
    const num = (j) => (j != null && j >= 0 ? aNumero(f[j]) : null);
    const v = num(pap.parcial);
    // Descripción: la columna de descripción o, si está vacía, el texto no numérico más largo.
    let d = pap.desc >= 0 ? f[pap.desc] : "";
    if (!d) d = f.filter((x, j) => x && !esNumero(x) && j !== pap.und).sort((p, q) => q.length - p.length)[0] || "";
    const cod = pap.cod >= 0 && RE_CODIGO.test(String(f[pap.cod]).trim()) ? f[pap.cod].trim() : "";
    filas.push({ y: l.y, d: d.trim(), u: pap.und >= 0 ? f[pap.und] : "", c: num(pap.cant), p: num(pap.precio), r: num(pap.rend), dp: num(pap.desp), v, cod: /[a-z]/i.test(cod) ? cod : "", num: v != null, extra: [] });
  }
  cerrar();
  for (const k of ["a", "i", "u"]) if (a.aiu[k]?.pct != null && a.aiu[k].pct > 1) a.aiu[k].pct /= 100;
  if (!a.item && !a.desc && !Object.keys(a.secciones).length) return null;
  return a;
}
