// Editor de una revisión de oferta de terceros: importación de la oferta (PDF con presupuesto
// y APU, Excel o texto pegado), datos de AIU e IVA, ítems con su APU de referencia de APU PRO,
// APU e insumos del oferente, verificaciones automáticas, hallazgos del revisor e informe
// (RD para Informes y Excel).
import { iniciarPagina, leerRevision, guardarRevision, leerApusRevision, guardarApusRevision, listarApus, listarInsumos, listarParametros, parametrosVigentes, esc, pesos, numero, leerNumero, mostrarAlerta, limpiarAlerta, errorAmigable, colgroupProporcional, aplicarAnchos } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { calcularApu } from "./ap-apu.js";
import { normalizar, valorMensual } from "./ap-calculos.js";
import { logoBase64 } from "./ap-formato.js";
import * as RV from "./ap-revision-motor.js";
import { leerPaginas, tablaPresupuesto, leerApus } from "./ap-pdf.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");
const id = new URLSearchParams(location.search).get("id");
let rev = null, apus = new Map(), insumos = new Map(), parametros = null, indice = [], indiceIns = [], sugerencias = new Map(), sugIns = new Map(), precios = new Map();
let res = null, hallazgos = [], sucio = false, apusSucio = false, selItem = null, selApu = null, selIns = null, matriz = null, lectura = null, lecturaApus = [], editando = null;
let apusOferta = []; // APU del oferente leídos del PDF (se guardan aparte, en bloques)


async function iniciar() {
  try {
    const [r, lista, ins, par, apo] = await Promise.all([leerRevision(id), listarApus(), listarInsumos(), listarParametros(), leerApusRevision(id).catch(() => [])]);
    if (!r) throw new Error("No se encontró la revisión.");
    rev = { ajustes: {}, hallazgos: [], items: [], capitulos: [], refInsumos: {}, ...r };
    apusOferta = apo;
    apus = new Map(lista.map((a) => [a.codigo, a]));
    insumos = new Map(ins.map((x) => [x.codigo, x]));
    parametros = parametrosVigentes(par);
    indice = RV.indiceApus(lista);
    indiceIns = RV.indiceApus(ins.map((x) => ({ codigo: x.codigo, nombre: `${x.descripcion}`, unidad: x.unidad, tipo: x.tipo })));
    pintarMenu(ctx, { activo: "revisiones" });
    $("dlApus").innerHTML = lista.sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true })).map((a) => `<option value="${esc(`${a.codigo} — ${a.nombre}`)}"></option>`).join("");
    $("volver").href = `revisiones.html#${encodeURIComponent(id)}`;
    llenarSelects();
    pintarDatos();
    calcularSugerencias();
    recalcular();
    mostrarSeccion();
    conectar();
  } catch (err) {
    pintarMenu(ctx, { activo: "revisiones" });
    mostrarAlerta(alerta, errorAmigable(err));
  }
}

// ---------------------------------------------------------------- cálculo
function precioApu(codigo) {
  if (!precios.has(codigo)) {
    const a = apus.get(codigo);
    precios.set(codigo, a ? calcularApu(a, { insumo: (c) => insumos.get(c) || null, parametros }).costoDirecto : null);
  }
  return precios.get(codigo);
}
function calcularSugerencias() {
  sugerencias = new Map();
  for (const it of rev.items) if (!it.ref?.codigo) sugerencias.set(it.id, RV.sugerirApus(it, indice, 3));
}
// Precio de un insumo de la base de APU PRO (mano de obra: jornal con prestaciones).
function precioInsumo(codigo) {
  const x = insumos.get(codigo);
  if (!x) return null;
  if (x.tipo === "MO") { const r = calcularApu({ rendimiento: 1, lineas: { MO: [{ codigo, cantidad: 1 }] } }, { insumo: (c) => insumos.get(c) || null, parametros, redondeo: "normal" }); return r.costoDirecto || null; }
  // Equipos y transporte: el oferente los cobra por día; la base los tiene por mes.
  if (x.tipo === "EH" || x.tipo === "TV") { if (x.base === "unidad") return Number(x.precio) || null; const m = valorMensual(x); return m ? m / (Number(parametros?.diasHabiles) || 21) : null; }
  if (x.tipo === "ED") return null;
  return x.precio != null ? Number(x.precio) : null;
}
function recalcular() {
  res = RV.revisar(rev, { precioApu, apus: apusOferta, precioInsumo });
  hallazgos = RV.hallazgosRevision(rev, res);
  const inc = hallazgos.filter((h) => h.incluir);
  $("nItems").textContent = rev.items.length;
  $("nHallazgos").textContent = inc.length;
  $("nApus").textContent = apusOferta.length;
  $("nInsumos").textContent = res.apus?.insumos.length || 0;
  $("pestanaApus").classList.toggle("hidden", !apusOferta.length);
  $("pestanaInsumos").classList.toggle("hidden", !apusOferta.length);
  pintarResumen();
}
function calcularSugIns() {
  sugIns = new Map();
  for (const e of res?.apus?.insumos || []) if (!rev.refInsumos?.[e.clave]) {
    const tipo = { MA: "MA", MO: "MO", EQ: "EH", ED: "ED", TR: "TV" }[e.sec];
    sugIns.set(e.clave, RV.sugerirApus({ desc: e.d, und: e.u }, indiceIns.filter((x) => !tipo || insumos.get(x.codigo)?.tipo === tipo), 3));
  }
}
function marcarSucio(v = true) {
  sucio = v;
  $("sucio").classList.toggle("hidden", !v);
}
function cambio() { marcarSucio(); recalcular(); }

function pintarResumen() {
  $("titulo").textContent = `${rev.codigo} — ${rev.nombre}`;
  $("subtitulo").textContent = [rev.oferente, rev.cliente].filter(Boolean).join(" → ");
  document.title = `${rev.codigo} — APU PRO`;
  const inc = hallazgos.filter((h) => h.incluir), F = res.F;
  const dif = res.declarado ? res.declarado - res.total : null;
  $("resumen").innerHTML = `<div class="ap-pares ap-pares-apu">
    <div><span>Valor de la oferta</span><strong class="ap-grande">${pesos(res.valorFinal)}</strong></div>
    <div><span>Costo directo</span><strong>${pesos(res.comp.cd)}</strong></div>
    <div><span>AIU ${numero((F.aiu.a || 0) * 100, 1)}/${numero((F.aiu.i || 0) * 100, 1)}/${numero((F.aiu.u || 0) * 100, 1)} %</span><strong>${pesos(res.comp.a + res.comp.i + res.comp.u)}</strong></div>
    <div><span>IVA ${F.reg === "utilidad" ? "sobre la utilidad" : F.reg === "total" ? "sobre el subtotal" : "no se liquida"}</span><strong>${pesos(res.comp.iva)}</strong></div>
    <div><span>Total recalculado</span><strong>${pesos(res.total)}</strong>${dif != null ? `<small>${Math.abs(dif) < 1000 ? "coincide con el declarado" : `${dif < 0 ? "-" : ""}${pesos(Math.abs(dif))} frente al declarado`}</small>` : ""}</div>
    <div><span>Ítems / capítulos</span><strong>${rev.items.length} / ${res.capitulos.length}</strong></div>
    <div><span>Hallazgos M / m / O</span><strong>${inc.filter((h) => h.sev === "Mayor").length} / ${inc.filter((h) => h.sev === "Menor").length} / ${inc.filter((h) => h.sev === "Observación").length}</strong></div>
    <div><span>Comparados con APU PRO</span><strong>${res.comparados.length}</strong></div>
  </div>${res.baseSugerida ? `<div class="alert info show ap-aviso-base">El total no cuadra con lo registrado, pero sí cuadra si los valores de los ítems son «${esc(RV.BASES[res.baseSugerida].split(" (")[0])}». <button type="button" class="btn ap-btn" id="usarBase">Usar «${esc(RV.BASES[res.baseSugerida].split(" (")[0])}»</button></div>` : ""}`;
  $("usarBase")?.addEventListener("click", () => { rev.base = res.baseSugerida; pintarDatos(); cambio(); mostrarSeccion(); });
}

function mostrarSeccion() {
  const sec = location.hash.slice(1) || (rev.items.length ? "items" : "importar");
  document.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== sec));
  document.querySelectorAll("#pestanas [data-sec]").forEach((a) => a.classList.toggle("activa", a.dataset.sec === sec));
  if (sec === "items") pintarItems();
  if (sec === "apus") pintarApus();
  if (sec === "insumos") { if (!sugIns.size) calcularSugIns(); pintarInsumos(); }
  if (sec === "hallazgos") pintarHallazgos();
  if (sec === "informe") pintarInforme();
}

// ---------------------------------------------------------------- importar
const letra = (j) => (j >= 26 ? String.fromCharCode(64 + Math.floor(j / 26)) : "") + String.fromCharCode(65 + (j % 26));
async function leerArchivo() {
  const f = $("archivo").files[0];
  if (!f) return;
  limpiarAlerta(alerta);
  if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") return leerPdf(f);
  lecturaApus = [];
  try {
    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(await f.arrayBuffer());
    const hojas = wb.worksheets.map((ws) => {
      const m = RV.hojaAMatriz(ws), d = RV.detectarColumnas(m);
      return { nombre: ws.name, m, d, n: RV.extraerItems(m, d).items.length };
    });
    if (!hojas.length) throw new Error("El archivo no tiene hojas.");
    const mejor = hojas.reduce((a, b) => (b.n > a.n ? b : a));
    $("hoja").innerHTML = hojas.map((h, k) => `<option value="${k}">${esc(h.nombre)} (${h.n} ítems)</option>`).join("");
    $("hoja").value = String(hojas.indexOf(mejor));
    $("hojaCampo").classList.remove("hidden");
    $("hoja").onchange = () => { const h = hojas[Number($("hoja").value)]; mostrarMapeo(h.m, h.d); };
    if (!rev.documento) { rev.documento = f.name; $("rDocumento").value = f.name; }
    mostrarMapeo(mejor.m, mejor.d);
  } catch (err) { mostrarAlerta(alerta, `No se pudo leer el Excel: ${errorAmigable(err)}`); }
}
// PDF: se lee el texto de cada página con pdf.js (en el navegador, sin enviar el archivo a
// ningún servidor), se reconstruye la tabla del presupuesto y se leen los APU.
async function leerPdf(f) {
  const prog = $("progresoPdf");
  $("hojaCampo").classList.add("hidden");
  try {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error("No se cargó el lector de PDF.");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "../js/vendor/pdfjs/pdf.worker.min.js";
    const paginas = await leerPaginas(pdfjsLib, new Uint8Array(await f.arrayBuffer()), { progreso: (n, total) => { prog.textContent = `Leyendo la página ${n} de ${total}…`; } });
    const conTexto = paginas.filter((p) => p.lineas.length > 3).length;
    if (!conTexto) throw new Error("El PDF no tiene texto: parece escaneado (imágenes). Pide al oferente el PDF original o el Excel de la oferta.");
    lecturaApus = leerApus(paginas);
    const tp = tablaPresupuesto(paginas);
    prog.textContent = `PDF de ${paginas.length} páginas${conTexto < paginas.length ? ` (${paginas.length - conTexto} sin texto)` : ""}: presupuesto en ${tp ? `${tp.paginas.length} página(s)` : "ninguna página"} y ${lecturaApus.length} APU.`;
    if (!rev.documento) { rev.documento = f.name; $("rDocumento").value = f.name; }
    if (!tp) {
      if (!lecturaApus.length) throw new Error("No se encontró en el PDF una tabla de presupuesto (encabezados de descripción, cantidad y valor unitario) ni APU.");
      mostrarAlerta(alerta, "No se encontró la tabla del presupuesto; se leyeron solo los APU. Puedes pegar la tabla del presupuesto abajo.", "info");
      $("mapeoCard").classList.remove("hidden");
      lectura = { items: [], capitulos: [], avisos: [] };
      $("lectura").textContent = `Se leyeron ${lecturaApus.length} APU.`;
      return;
    }
    mostrarMapeo(tp.matriz, RV.detectarColumnas(tp.matriz));
  } catch (err) { prog.textContent = ""; mostrarAlerta(alerta, `No se pudo leer el PDF: ${errorAmigable(err)}`); }
}
function leerPegado() {
  lecturaApus = [];
  const m = RV.textoAMatriz($("pegado").value);
  if (!m.length || !m[0].length) return mostrarAlerta(alerta, "Pega primero la tabla del presupuesto.");
  limpiarAlerta(alerta);
  mostrarMapeo(m, RV.detectarColumnas(m));
}
function mostrarMapeo(m, d) {
  matriz = m;
  const enc = (j) => {
    const t = d.fila >= 0 ? String(m[d.fila][j] ?? "").trim() : String(m.find((f) => String(f[j] ?? "").trim())?.[j] ?? "").trim();
    return `${letra(j)}${t ? `: ${t.slice(0, 22)}` : ""}`;
  };
  const ancho = m[0]?.length || 0;
  $("mapeo").innerHTML = `<label>Fila de encabezados<input type="number" id="mFila" min="0" value="${d.fila + 1}" title="0 si la tabla no tiene encabezados"></label>` +
    Object.entries(RV.COLUMNAS).map(([k, nombre]) => `<label>${esc(nombre)}<select data-col="${k}"><option value="-1">—</option>${Array.from({ length: ancho }, (_, j) => `<option value="${j}" ${d.columnas[k] === j ? "selected" : ""}>${esc(enc(j))}</option>`).join("")}</select></label>`).join("");
  $("mapeoCard").classList.remove("hidden");
  $("mapeo").querySelectorAll("select, input").forEach((el) => el.addEventListener("change", releer));
  releer();
}
function releer() {
  const columnas = {};
  $("mapeo").querySelectorAll("select[data-col]").forEach((s) => { columnas[s.dataset.col] = Number(s.value); });
  const fila = Math.max(0, Number($("mFila").value) || 0) - 1;
  lectura = RV.extraerItems(matriz, { fila, columnas });
  const suma = lectura.items.reduce((s, it) => s + (Number(it.vt) || 0), 0);
  $("lectura").innerHTML = lectura.items.length
    ? `Se leyeron <b>${lectura.items.length} ítems</b> en <b>${lectura.capitulos.length} capítulos</b>; suman ${pesos(suma)}${lectura.totalDetectado ? ` y la tabla trae un total de ${pesos(lectura.totalDetectado)}` : ""}.${(() => { const n = lectura.items.filter((it) => it.vtCalculado).length; return !n ? "" : n === lectura.items.length ? " El valor total de los ítems se calculó (cantidad × valor unitario) porque no se indicó su columna." : ` En ${n} ítem(s) la celda del valor total venía vacía o con una fórmula sin resultado guardado: se calculó como cantidad × valor unitario.`; })()}`
    : esc(lectura.avisos.join(" "));
  if (lecturaApus.length) $("lectura").innerHTML += ` Del PDF se leyeron además <b>${lecturaApus.length} APU</b> del oferente (${lecturaApus.reduce((s, a) => s + Object.values(a.secciones).reduce((t, ls) => t + ls.length, 0), 0)} líneas de insumos).`;
  const capNom = Object.fromEntries(lectura.capitulos.map((c) => [c.num, c.nombre]));
  const enc = ["Cap.", "Ítem", "Descripción", "Und", "Cantidad", "V. unitario", "V. total"];
  const filas = lectura.items.slice(0, 14).map((it) => [`${it.cap} ${capNom[it.cap] ? "· " + capNom[it.cap] : ""}`, it.item, it.desc, it.und, numero(it.cant, 4), pesos(it.vu, 2), pesos(it.vt)]);
  $("previa").innerHTML = filas.length ? `${colgroupProporcional(enc, filas)}<thead><tr>${enc.map((h, j) => `<th class="${j > 3 ? "ap-num" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((v, j) => `<td class="${j > 3 ? "ap-num" : ""}" title="${esc(v)}">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>` : "";
  aplicarAnchos($("previa"));
}
function usarItems() {
  if (!lectura?.items.length && !lecturaApus.length) return mostrarAlerta(alerta, "No hay ítems para usar: revisa las columnas.");
  if (lectura?.items.length) {
    if (rev.items.length && !confirm(`La revisión ya tiene ${rev.items.length} ítems. ¿Reemplazarlos por los ${lectura.items.length} leídos? Se pierden las referencias a APU asignadas.`)) return;
    rev.items = lectura.items;
    rev.capitulos = lectura.capitulos;
    if (lectura.totalDetectado && !rev.totalDeclarado) { rev.totalDeclarado = lectura.totalDetectado; $("rTotal").value = numero(lectura.totalDetectado, 0); }
  }
  if (lecturaApus.length) {
    if (apusOferta.length && !confirm(`La revisión ya tiene ${apusOferta.length} APU del oferente. ¿Reemplazarlos por los ${lecturaApus.length} leídos?`)) return;
    apusOferta = lecturaApus;
    apusSucio = true;
    sugIns = new Map();
  }
  selItem = null; selApu = null; selIns = null;
  // Con los APU se deduce qué incluyen los valores del presupuesto, el AIU y el IVA.
  let deducido = "";
  if (lecturaApus.length && rev.items.length) {
    const d = RV.datosDesdeApus(rev.items, apusOferta);
    if (d.base) rev.base = d.base;
    if (d.aiu.a != null || d.aiu.i != null || d.aiu.u != null) rev.aiu = { a: d.aiu.a || 0, i: d.aiu.i || 0, u: d.aiu.u || 0 };
    if (d.iva != null) rev.iva = d.iva;
    if (d.regimenIva) rev.regimenIva = d.regimenIva;
    pintarDatos();
    if (d.base) deducido = ` Según los APU, los valores de los ítems son «${RV.BASES[d.base].split(" (")[0]}», con AIU ${numero((rev.aiu.a || 0) * 100, 2)} / ${numero((rev.aiu.i || 0) * 100, 2)} / ${numero((rev.aiu.u || 0) * 100, 2)} % e IVA del ${numero((rev.iva || 0) * 100, 2)} % ${rev.regimenIva === "utilidad" ? "sobre la utilidad" : "sobre el subtotal"}: ya quedó registrado; confírmalo en «Datos, AIU e IVA».`;
  }
  calcularSugerencias();
  cambio();
  mostrarAlerta(alerta, `Se cargaron ${rev.items.length} ítems${apusOferta.length ? ` y ${apusOferta.length} APU del oferente` : ""}.${deducido || " Registra ahora el AIU y el IVA de la oferta y guarda."}`, "success");
  location.hash = "datos";
}

// ---------------------------------------------------------------- datos
function llenarSelects() {
  $("rBase").innerHTML = Object.entries(RV.BASES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  $("rRegimen").innerHTML = Object.entries(RV.REGIMENES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  $("rConcepto").innerHTML = `<option value="">Sugerido según los hallazgos</option>` + Object.entries(RV.CONCEPTOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  $("hSev").innerHTML = RV.SEVERIDADES.map((s) => `<option>${s}</option>`).join("");
}
const pct = (v) => (v == null ? "" : String(Math.round(v * 100000) / 1000).replace(".", ","));
function pintarDatos() {
  const v = (id, x) => { $(id).value = x ?? ""; };
  v("rCodigo", rev.codigo); v("rNombre", rev.nombre); v("rFecha", rev.fechaOferta); v("rOferente", rev.oferente); v("rCliente", rev.cliente); v("rDocumento", rev.documento);
  v("rBase", rev.base || "cd"); v("rA", pct(rev.aiu?.a)); v("rI", pct(rev.aiu?.i)); v("rU", pct(rev.aiu?.u)); v("rIva", pct(rev.iva));
  v("rRegimen", rev.regimenIva || "total"); v("rTotal", rev.totalDeclarado ? numero(rev.totalDeclarado, 0) : "");
  v("rConcepto", rev.concepto || ""); v("rConceptoTexto", rev.conceptoTexto); v("rRecomendaciones", rev.recomendaciones);
  v("rObjeto", rev.objeto); v("rLimitaciones", rev.limitaciones || RV.LIMITACIONES);
}
function leerDatos() {
  const t = (id) => $(id).value.trim();
  const p = (id) => (leerNumero($(id).value) ?? 0) / 100;
  Object.assign(rev, {
    codigo: t("rCodigo").toUpperCase() || rev.codigo, nombre: t("rNombre") || rev.nombre, fechaOferta: t("rFecha"), oferente: t("rOferente"), cliente: t("rCliente"), documento: t("rDocumento"),
    base: $("rBase").value, aiu: { a: p("rA"), i: p("rI"), u: p("rU") }, iva: p("rIva"), regimenIva: $("rRegimen").value, totalDeclarado: leerNumero($("rTotal").value),
    concepto: $("rConcepto").value, conceptoTexto: t("rConceptoTexto"), recomendaciones: t("rRecomendaciones"), objeto: t("rObjeto"),
    limitaciones: t("rLimitaciones") === RV.LIMITACIONES ? "" : t("rLimitaciones")
  });
  cambio();
}

// ---------------------------------------------------------------- ítems
const capNombre = (num) => rev.capitulos.find((c) => String(c.num) === String(num))?.nombre || "";
const numerosDe = (it) => (res.porItem[it.id] || []).map((k) => hallazgos.find((h) => h.clave === k && h.incluir)?.numero).filter(Boolean);
function itemsFiltrados() {
  const palabras = normalizar($("buscarItem").value).split(" ").filter(Boolean);
  const f = $("filtroItems").value;
  const comp = new Map(res.comparados.map((c) => [c.id, c]));
  return rev.items.filter((it) => {
    if (palabras.length) { const t = normalizar(`${it.item} ${it.desc}`); if (!palabras.every((w) => t.includes(w))) return false; }
    if (f === "obs") return numerosDe(it).length > 0;
    if (f === "sinref") return !it.ref?.codigo;
    if (f === "sugerida") return !it.ref?.codigo && (sugerencias.get(it.id) || []).length > 0;
    if (f === "encima") return comp.get(it.id)?.estado === "Por encima";
    return true;
  });
}
function celdaRef(it, c) {
  if (it.ref?.codigo) return `${it.ref.codigo}${c ? "" : " (sin precio)"}`;
  const s = sugerencias.get(it.id)?.[0];
  return s ? `≈ ${s.codigo} · ${Math.round(s.puntaje * 100)} %` : "—";
}
function pintarItems() {
  const lista = itemsFiltrados();
  $("cuentaItems").textContent = `${lista.length} de ${rev.items.length}`;
  if (!selItem || !lista.some((it) => it.id === selItem)) selItem = lista[0]?.id || null;
  const comp = new Map(res.comparados.map((c) => [c.id, c]));
  const enc = ["Cap.", "Ítem", "Descripción", "Und", "Cantidad", "V. unitario", "V. total", "APU PRO", "Dif.", "Hallazgos"];
  const filas = lista.map((it) => {
    const c = comp.get(it.id);
    return [it.cap, it.item, it.desc, it.und || "—", numero(it.cant, 4), pesos(it.vu), pesos(it.vt), celdaRef(it, c), c ? `${c.dif >= 0 ? "+" : ""}${Math.round(c.dif * 100)} %` : "", numerosDe(it).join(", ")];
  });
  const num = (j) => (j >= 4 && j <= 6 || j === 8 ? "ap-num" : "");
  const tabla = $("tablaItems");
  tabla.innerHTML = lista.length ? `${colgroupProporcional(enc, filas.map((f) => f.map((v, j) => (j === 8 ? "+100 %" : j === 7 ? "≈ APU-000 · 00 %" : v))), { max: 40 })}
    <thead><tr>${enc.map((h, j) => `<th class="${num(j)}">${h}</th>`).join("")}</tr></thead>
    <tbody>${lista.map((it, i) => {
      const c = comp.get(it.id);
      return `<tr data-id="${esc(it.id)}" class="${it.id === selItem ? "ap-sel" : ""}">${filas[i].map((v, j) => {
        const clase = j === 8 && c ? (c.estado === "Por encima" ? "ap-txt-danger" : c.estado === "Por debajo" ? "ap-txt-warn" : "ap-txt-ok") : j === 7 && !it.ref?.codigo ? "text-muted" : "";
        return `<td class="${num(j)} ${clase}" title="${esc(v)}">${esc(v)}</td>`;
      }).join("")}</tr>`;
    }).join("")}</tbody>`
    : `<tbody><tr><td class="text-muted">${rev.items.length ? "Ningún ítem coincide." : "Todavía no hay ítems: impórtalos en la pestaña «Importar»."}</td></tr></tbody>`;
  aplicarAnchos(tabla);
  pintarItem();
}
function pintarItem() {
  const el = $("itemDetalle");
  const it = rev.items.find((x) => x.id === selItem);
  if (!it) { el.innerHTML = `<p class="text-muted">${rev.items.length ? "Ningún ítem coincide con la búsqueda." : "Importa la tabla del presupuesto en la pestaña «Importar»."}</p>`; return; }
  const c = res.comparados.find((x) => x.id === it.id);
  const par = (et, v) => `<div><span>${esc(et)}</span><strong>${v}</strong></div>`;
  const calc = it.cant != null && it.vu != null ? Math.round(it.cant * it.vu) : null;
  const sug = sugerencias.get(it.id) || [];
  const ref = it.ref?.codigo ? apus.get(it.ref.codigo) : null;
  const marcas = (res.porItem[it.id] || []).map((k) => hallazgos.find((h) => h.clave === k)).filter((h) => h?.incluir);
  el.innerHTML = `
    <div class="ap-vp-cabeza"><h2>Ítem ${esc(it.item)} — ${esc(it.desc)}</h2></div>
    <div class="ap-pares ap-pares-apu">
      ${par("Capítulo", esc(`${it.cap}${capNombre(it.cap) ? " · " + capNombre(it.cap) : ""}`))}
      ${par("Unidad", esc(it.und || "—"))}
      ${par("Cantidad", numero(it.cant, 4))}
      ${par("Valor unitario", pesos(it.vu, 2))}
      ${par("Valor total", pesos(it.vt))}
      ${par("Cantidad × valor unitario", calc == null ? "—" : `${pesos(calc)}${it.vt != null && Math.abs(calc - it.vt) > 1 ? ` <span class="badge danger">dif. ${pesos(it.vt - calc)}</span>` : ""}`)}
      ${par("Valor final (con AIU e IVA)", pesos((Number(it.vt) || 0) * res.F.aFinal))}
      ${par("Fila en la tabla", String(it.fila || "—"))}
      ${par("Hallazgos", marcas.length ? marcas.map((h) => `${esc(h.numero)} ${esc(h.titulo || h.tema)}`).join("; ") : "—")}
    </div>
    <div class="ap-ref">
      <h3>APU de referencia (APU PRO)</h3>
      ${ref ? `<div class="ap-pares ap-pares-apu">
          ${par("APU", `<a href="apus.html#${encodeURIComponent(ref.codigo)}" target="_blank" rel="noopener">${esc(ref.codigo)}</a> ${esc(ref.nombre)}`)}
          ${par("Unidad", esc(ref.unidad || "—"))}
          ${par("Costo directo APU PRO", pesos(precioApu(ref.codigo)))}
          ${c ? par(`Referencia en la base de la oferta`, pesos(c.ref)) + par("Diferencia", `${c.dif >= 0 ? "+" : ""}${Math.round(c.dif * 100)} % <span class="badge ${c.estado === "Por encima" ? "danger" : c.estado === "Por debajo" ? "warn" : "ok"}">${c.estado}</span>`) : ""}
        </div>
        ${normalizar(ref.unidad) !== normalizar(it.und) && it.und ? `<p class="text-muted ap-nota">La unidad del APU (${esc(ref.unidad)}) no coincide con la del ítem (${esc(it.und)}): confirma que sean comparables.</p>` : ""}
        <div class="rt-acciones"><button type="button" class="btn secondary ap-btn" id="quitarRef">Quitar referencia</button></div>`
      : `<p class="text-muted ap-nota">Sin referencia. ${sug.length ? "Sugerencias por parecido de la descripción (confírmalas solo si el alcance es equivalente):" : "No hay APU parecidos en la biblioteca."}</p>
        <div class="ap-sugerencias">${sug.map((s) => `<button type="button" class="ap-sug" data-codigo="${esc(s.codigo)}" title="Usar como referencia"><b>${esc(s.codigo)}</b> ${esc(s.nombre)} <span class="badge ${s.puntaje >= 0.7 ? "ok" : s.puntaje >= 0.45 ? "warn" : "muted"}">${Math.round(s.puntaje * 100)} %</span> <small>${pesos(precioApu(s.codigo))}</small></button>`).join("")}</div>`}
      <div class="ap-fila-form"><label class="ap-crece">Buscar otro APU<input list="dlApus" id="refBuscar" placeholder="Código o nombre del APU"></label><button type="button" class="btn secondary ap-btn" id="refAsignar">Asignar</button></div>
    </div>
    <details class="ap-corregir">
      <summary>Corregir datos del ítem (errores de lectura)</summary>
      <div class="ap-fila-form">
        <label>Unidad<input id="eUnd" value="${esc(it.und || "")}"></label>
        <label>Cantidad<input id="eCant" inputmode="decimal" value="${esc(it.cant ?? "")}"></label>
        <label>Valor unitario<input id="eVu" inputmode="decimal" value="${esc(it.vu ?? "")}"></label>
        <label>Valor total<input id="eVt" inputmode="decimal" value="${esc(it.vt ?? "")}"></label>
        <button type="button" class="btn secondary ap-btn" id="eAplicar">Aplicar</button>
      </div>
    </details>`;
  const asignar = (codigo) => {
    if (!apus.has(codigo)) return mostrarAlerta(alerta, `No existe el APU ${codigo} en la biblioteca.`);
    it.ref = { codigo, confirmada: true };
    sugerencias.delete(it.id);
    cambio(); pintarItems();
  };
  el.querySelectorAll(".ap-sug").forEach((b) => b.addEventListener("click", () => asignar(b.dataset.codigo)));
  el.querySelector("#refAsignar").addEventListener("click", () => asignar($("refBuscar").value.split(" — ")[0].trim()));
  el.querySelector("#quitarRef")?.addEventListener("click", () => { delete it.ref; sugerencias.set(it.id, RV.sugerirApus(it, indice, 3)); cambio(); pintarItems(); });
  el.querySelector("#eAplicar").addEventListener("click", () => {
    it.und = $("eUnd").value.trim(); it.cant = RV.aNumero($("eCant").value); it.vu = RV.aNumero($("eVu").value); it.vt = RV.aNumero($("eVt").value);
    delete it.vtCalculado;
    cambio(); pintarItems();
  });
}
function confirmarSugerencias() {
  let n = 0;
  for (const it of rev.items) {
    const s = sugerencias.get(it.id)?.[0];
    if (!it.ref?.codigo && s && s.puntaje >= 0.7) { it.ref = { codigo: s.codigo, confirmada: true }; sugerencias.delete(it.id); n++; }
  }
  if (!n) return mostrarAlerta(alerta, "No hay sugerencias con parecido de 70 % o más.", "info");
  cambio(); pintarItems();
  mostrarAlerta(alerta, `Se confirmaron ${n} referencias. Revísalas: el parecido es por la descripción, no por el alcance.`, "success");
}

// ---------------------------------------------------------------- verificaciones y hallazgos
const BADGE_SEV = { Mayor: "danger", Menor: "warn", "Observación": "muted" };
function pintarHallazgos() {
  const porClave = new Map(hallazgos.map((h) => [h.clave, h]));
  $("verificaciones").innerHTML = res.verificaciones.map((v) => {
    if (v.estado !== "hallazgo") return `<div class="ap-verif"><span class="badge ${v.estado === "ok" ? "ok" : "muted"}">${v.estado === "ok" ? "Conforme" : "Información"}</span><div><strong>${esc(v.titulo)}</strong><p>${esc(v.texto)}</p></div></div>`;
    const h = porClave.get(v.clave), a = rev.ajustes?.[v.clave] || {};
    return `<div class="ap-verif ap-verif-h ${h.incluir ? "" : "ap-excluido"}" data-clave="${esc(v.clave)}">
      <span class="badge ${BADGE_SEV[h.sev]}">${h.incluir ? esc(h.numero) : "Excluido"}</span>
      <div>
        <strong>${esc(v.titulo)}</strong> <small class="text-muted">${esc(v.tema)} · impacto ${esc(RV.impactoTexto(h))}${h.superpone?.length ? ` · se superpone con ${esc(h.superpone.join(", "))}` : ""}</small>
        <p>${esc(v.texto)}</p>
        <div class="ap-fila-form">
          <label class="ap-check"><input type="checkbox" data-a="incluir" ${h.incluir ? "checked" : ""}> Incluir en el informe</label>
          <label>Severidad<select data-a="sev">${RV.SEVERIDADES.map((s) => `<option ${s === h.sev ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label class="ap-crece">Comentario adicional<input data-a="comentario" value="${esc(a.comentario || "")}" placeholder="Se agrega al texto del hallazgo"></label>
        </div>
        <label class="ap-accion">Acción requerida<textarea data-a="accion" rows="2">${esc(a.accion || v.accion || "")}</textarea></label>
      </div>
    </div>`;
  }).join("") || `<p class="text-muted">Importa los ítems para ver las verificaciones.</p>`;
  $("verificaciones").querySelectorAll("[data-clave]").forEach((caja) => {
    const clave = caja.dataset.clave;
    caja.querySelectorAll("[data-a]").forEach((el) => {
      const ev = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, () => {
        rev.ajustes ||= {};
        const a = (rev.ajustes[clave] ||= {});
        a[el.dataset.a] = el.type === "checkbox" ? el.checked : el.value;
        cambio();
        if (ev === "change") pintarHallazgos();
      });
    });
  });
  pintarManuales();
}
function pintarManuales() {
  const porClave = new Map(hallazgos.map((h) => [h.clave, h]));
  const lista = rev.hallazgos || [];
  if (!lista.length) { $("manuales").innerHTML = `<p class="text-muted ap-nota">Sin hallazgos del revisor.</p>`; return; }
  const enc = ["No.", "Severidad", "Tema", "Hallazgo", "Ítems", "Impacto", ""];
  const filas = lista.map((m) => { const h = porClave.get(m.id); return [h?.incluir ? h.numero : "Excluido", m.sev, m.tema || "—", m.titulo ? `${m.titulo}: ${m.hallazgo}` : m.hallazgo, m.items || "—", RV.impactoTexto(h || m), "acciones"]; });
  $("manuales").innerHTML = `<div class="tabla-scroll"><table class="ap-tabla" id="tablaManuales">${colgroupProporcional(enc, filas, { max: 50 })}
    <thead><tr>${enc.map((x) => `<th>${x}</th>`).join("")}</tr></thead>
    <tbody>${lista.map((m, i) => `<tr data-id="${esc(m.id)}">${filas[i].slice(0, 6).map((v, j) => `<td class="${j === 5 ? "ap-num" : ""}" title="${esc(v)}">${j === 1 ? `<span class="badge ${BADGE_SEV[v]}">${esc(v)}</span>` : esc(v)}</td>`).join("")}
      <td class="ap-celda-acciones"><label class="ap-check" title="Incluir en el informe"><input type="checkbox" data-incluir ${m.incluir !== false ? "checked" : ""}></label><button type="button" class="rt-icono-btn" data-editar title="Editar">✎</button><button type="button" class="rt-icono-btn" data-borrar title="Eliminar">🗑</button></td></tr>`).join("")}</tbody></table></div>`;
  aplicarAnchos($("manuales"));
  $("manuales").querySelectorAll("tr[data-id]").forEach((tr) => {
    const m = lista.find((x) => x.id === tr.dataset.id);
    tr.querySelector("[data-editar]").addEventListener("click", () => abrirHallazgo(m));
    tr.querySelector("[data-borrar]").addEventListener("click", () => { if (!confirm("¿Eliminar este hallazgo?")) return; rev.hallazgos = lista.filter((x) => x !== m); cambio(); pintarHallazgos(); });
    tr.querySelector("[data-incluir]").addEventListener("change", (e) => { m.incluir = e.target.checked; cambio(); pintarHallazgos(); });
  });
}
function abrirHallazgo(m = null) {
  editando = m;
  limpiarAlerta($("hallazgoAlerta"));
  $("hallazgoTitulo").textContent = m ? "Editar hallazgo" : "Nuevo hallazgo";
  const v = (id, x) => { $(id).value = x ?? ""; };
  v("hSev", m?.sev || "Mayor"); v("hTema", m?.tema); v("hTitulo", m?.titulo); v("hTexto", m?.hallazgo); v("hItems", m?.items);
  v("hImpacto", m?.impacto != null ? numero(m.impacto, 0) : ""); v("hImpactoTexto", m?.impactoTexto); v("hAccion", m?.accion);
  $("hallazgoDlg").showModal();
}
function guardarHallazgo() {
  const texto = $("hTexto").value.trim();
  if (!texto) return mostrarAlerta($("hallazgoAlerta"), "Describe el hallazgo.");
  const datos = { sev: $("hSev").value, tema: $("hTema").value.trim() || "General", titulo: $("hTitulo").value.trim(), hallazgo: texto, items: $("hItems").value.trim(), impacto: leerNumero($("hImpacto").value), impactoTexto: $("hImpactoTexto").value.trim(), accion: $("hAccion").value.trim() };
  rev.hallazgos ||= [];
  if (editando) Object.assign(editando, datos);
  else rev.hallazgos.push({ id: `m${Date.now().toString(36)}`, incluir: true, ...datos });
  $("hallazgoDlg").close();
  cambio(); pintarHallazgos();
}

// ---------------------------------------------------------------- informe
function pintarInforme() {
  const inc = hallazgos.filter((h) => h.incluir);
  const enc = ["No.", "Severidad", "Tema", "Hallazgo", "Impacto estimado"];
  const filas = inc.map((h) => [h.numero, h.sev, h.tema, h.titulo || h.hallazgo, RV.impactoTexto(h)]);
    const sinDup = RV.totalSinDuplicar(inc);
  $("consolidado").innerHTML = `<p class="ap-nota"><b>Concepto:</b> ${esc(RV.CONCEPTOS[rev.concepto] || `${RV.conceptoSugerido(inc)} (sugerido; se fija en «Datos, AIU e IVA»)`)}</p><p class="ap-nota"><b>Total estimado sin duplicar:</b> ${pesos(sinDup.total)}${sinDup.omitidos.length ? ` <span class="text-muted">(no se suman ${esc(sinDup.omitidos.map((h) => h.numero).join(", "))}, que se superponen con otros; los valores «hasta» y por justificar tampoco)</span>` : ""}</p>` + (inc.length
    ? `<div class="tabla-scroll"><table class="ap-tabla" id="tablaConsolidado">${colgroupProporcional(enc, filas)}<thead><tr>${enc.map((x, j) => `<th class="${j === 4 ? "ap-num" : ""}">${x}</th>`).join("")}</tr></thead>
      <tbody>${filas.map((f) => `<tr>${f.map((v, j) => `<td class="${j === 4 ? "ap-num" : ""}" title="${esc(v)}">${j === 1 ? `<span class="badge ${BADGE_SEV[v]}">${esc(v)}</span>` : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : `<p class="text-muted">Sin hallazgos incluidos.</p>`);
  aplicarAnchos($("consolidado"));
}
// Nombre de archivo sin caracteres prohibidos; se recorta el nombre, nunca la extensión.
const nombreArchivo = (s, ext) => `${s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 90).trim()}${ext}`;
function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function descargarRD() {
  if (!rev.items.length) return mostrarAlerta(alerta, "Importa primero los ítems de la oferta.");
  const inf = RV.informeRD(rev, res, hallazgos, { firmaNombre: ctx.perfil?.nombre || "", firmaCargo: ctx.perfil?.cargo || "" });
  descargar(new Blob([JSON.stringify(inf, null, 2)], { type: "application/json" }), nombreArchivo(`RD ${rev.codigo} ${rev.nombre} - importar en Informes`, ".json"));
}
async function descargarExcel() {
  if (!rev.items.length) return mostrarAlerta(alerta, "Importa primero los ítems de la oferta.");
  const btn = $("descargarExcel");
  btn.disabled = true;
  try {
    const wb = RV.libroRevision(window.ExcelJS, rev, res, hallazgos, { logo: await logoBase64() });
    const buf = await wb.xlsx.writeBuffer();
    descargar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nombreArchivo(`${rev.codigo} Revisión ${rev.nombre}`, ".xlsx"));
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); } finally { btn.disabled = false; }
}

// ---------------------------------------------------------------- APU del oferente
const codN = (c) => normalizar(c).replace(/\s+/g, "");
function estadoApu(a) {
  const v = res.apus?.vinculos.find((x) => x.apu === a);
  if (!v) return { txt: "Sin ítem", clase: "muted", v };
  if (v.dif != null && Math.abs(v.dif) > Math.max(1, Math.abs(v.ref || 0) * 0.001)) return { txt: "Difiere", clase: "danger", v };
  if ((res.apus?.malos || []).some((m) => m.a === a)) return { txt: "Aritmética", clase: "warn", v };
  return { txt: "Conforme", clase: "ok", v };
}
function marcasApu(a) {
  const it = rev.items.find((x) => codN(x.item) === codN(a.item));
  return it ? numerosDe(it) : [];
}
function apusFiltrados() {
  const palabras = normalizar($("buscarApu").value).split(" ").filter(Boolean);
  const f = $("filtroApus").value;
  return apusOferta.map((a, n) => ({ a, n })).filter(({ a }) => {
    if (palabras.length) { const t = normalizar(`${a.item} ${a.desc}`); if (!palabras.every((w) => t.includes(w))) return false; }
    const e = estadoApu(a);
    if (f === "obs") return marcasApu(a).length > 0 || e.clase !== "ok";
    if (f === "difiere") return e.txt === "Difiere";
    if (f === "sinItem") return e.txt === "Sin ítem";
    return true;
  });
}
function pintarApus() {
  const lista = apusFiltrados();
  $("cuentaApus").textContent = `${lista.length} de ${apusOferta.length}`;
  if (selApu == null || !lista.some((x) => x.n === selApu)) selApu = lista[0]?.n ?? null;
  const enc = ["Ítem", "Descripción", "Und", "Costo directo", "Precio APU", "Presupuesto", "Estado", "Hallazgos"];
  const filas = lista.map(({ a }) => { const e = estadoApu(a); const it = e.v ? rev.items.find((x) => x.id === e.v.id) : null; return [a.item || "—", a.desc || "—", a.und || "", pesos(a.cd), pesos(e.v?.ref ?? a.pu), it ? pesos(it.vu) : "—", e.txt, marcasApu(a).join(", ")]; });
  const num = (j) => (j >= 3 && j <= 5 ? "ap-num" : "");
  const tabla = $("tablaApus");
  tabla.innerHTML = lista.length ? `${colgroupProporcional(enc, filas, { max: 45 })}
    <thead><tr>${enc.map((h, j) => `<th class="${num(j)}">${h}</th>`).join("")}</tr></thead>
    <tbody>${lista.map(({ a, n }, i) => `<tr data-n="${n}" class="${n === selApu ? "ap-sel" : ""}">${filas[i].map((v, j) => `<td class="${num(j)}" title="${esc(v)}">${j === 6 ? `<span class="badge ${estadoApu(a).clase}">${esc(v)}</span>` : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>`
    : `<tbody><tr><td class="text-muted">Ningún APU coincide.</td></tr></tbody>`;
  aplicarAnchos(tabla);
  pintarApu();
}
function pintarApu() {
  const el = $("apuDetalle");
  const a = apusOferta[selApu];
  if (!a) { el.innerHTML = `<p class="text-muted">Sin APU seleccionado.</p>`; return; }
  const e = estadoApu(a), it = e.v ? rev.items.find((x) => x.id === e.v.id) : null;
  const par = (et, v) => `<div><span>${esc(et)}</span><strong>${v}</strong></div>`;
  const malo = (res.apus?.malos || []).find((m) => m.a === a);
  const tablaSec = (k, ls) => {
    const enc = ["Insumo", "Und", "Cantidad", "Precio", "Rend.", "Desp.", "Valor"];
    const filas = ls.map((x) => [`${x.cod ? x.cod + " · " : ""}${x.d}`, x.u || "", numero(x.c, 4), pesos(x.p), numero(x.r, 2), x.dp != null ? `${numero(x.dp * 100, 1)} %` : "", pesos(x.v)]);
    const suma = ls.reduce((s, x) => s + (Number(x.v) || 0), 0);
    return `<table class="ap-tabla ap-tabla-apu ap-tabla-oferta">${colgroupProporcional(enc, filas, { max: 50 })}
      <thead><tr class="ap-cap-titulo"><th colspan="7">${esc(RV.SECCIONES_APU[k] || k)}</th></tr><tr>${enc.map((h, j) => `<th class="${j >= 2 ? "ap-num" : ""}">${h}</th>`).join("")}</tr></thead>
      <tbody>${filas.map((f) => `<tr>${f.map((v, j) => `<td class="${j >= 2 ? "ap-num" : ""}" title="${esc(v)}">${esc(v)}</td>`).join("")}</tr>`).join("")}
      <tr class="ap-fila-total"><td colspan="6">Subtotal${a.sub?.[k] != null && Math.abs(a.sub[k] - suma) > 2 ? ` (el APU dice ${pesos(a.sub[k])})` : ""}</td><td class="ap-num">${pesos(suma)}</td></tr></tbody></table>`;
  };
  el.innerHTML = `
    <div class="ap-vp-cabeza"><h2>APU ${esc(a.item || "sin código")} — ${esc(a.desc || "sin descripción")}</h2></div>
    <div class="ap-pares ap-pares-apu">
      ${par("Unidad", esc(a.und || "—"))}
      ${par("Página del PDF", String(a.pagina || "—"))}
      ${par("Costo directo", pesos(a.cd))}
      ${par("AIU", ["a", "i", "u"].map((k) => (a.aiu?.[k]?.pct != null ? `${numero(a.aiu[k].pct * 100, 1)} %` : "—")).join(" / "))}
      ${par("Precio del APU", pesos(e.v?.ref ?? a.pu))}
      ${par("En el presupuesto", it ? `${pesos(it.vu)} · ${numero(it.cant, 4)} ${esc(it.und || "")}` : "No está")}
      ${par("Estado", `<span class="badge ${e.clase}">${esc(e.txt)}</span>`)}
      ${par("Hallazgos", esc(marcasApu(a).join(", ") || "—"))}
    </div>
    ${malo ? `<p class="ap-nota ap-txt-danger">${esc(malo.prob.join("; "))}</p>` : ""}
    <div class="ap-hoja">${Object.entries(a.secciones).map(([k, ls]) => tablaSec(k, ls)).join("")}</div>`;
  aplicarAnchos(el);
}

// ---------------------------------------------------------------- insumos del oferente
function insumosFiltrados() {
  const palabras = normalizar($("buscarInsumo").value).split(" ").filter(Boolean);
  const sec = $("filtroInsumos").value;
  return (res.apus?.insumos || []).filter((e) => (!sec || e.sec === sec) && (!palabras.length || palabras.every((w) => normalizar(e.d).includes(w))));
}
function pintarInsumos() {
  const lista = insumosFiltrados();
  $("cuentaInsumos").textContent = `${lista.length} de ${res.apus?.insumos.length || 0}`;
  if (!selIns || !lista.some((e) => e.clave === selIns)) selIns = lista[0]?.clave || null;
  const comp = new Map((res.apus?.comparadosIns || []).map((c) => [c.clave, c]));
  const enc = ["Insumo", "Und", "Cantidad total", "Precio(s)", "Valor final", "APU", "APU PRO", "Dif."];
  const filas = lista.map((e) => {
    const c = comp.get(e.clave), ref = rev.refInsumos?.[e.clave], s = sugIns.get(e.clave)?.[0];
    return [e.d, e.u || "", numero(e.q, 2), e.preciosLista.length > 1 ? `${pesos(e.preciosLista[0])} a ${pesos(e.preciosLista[e.preciosLista.length - 1])}` : pesos(e.preciosLista[0]), pesos(e.valorFinal), String(e.apus.length), ref || (s ? `≈ ${s.codigo} · ${Math.round(s.puntaje * 100)} %` : "—"), c ? `${c.dif >= 0 ? "+" : ""}${Math.round(c.dif * 100)} %` : ""];
  });
  const num = (j) => (j >= 2 && j <= 5 || j === 7 ? "ap-num" : "");
  const tabla = $("tablaInsumos");
  tabla.innerHTML = lista.length ? `${colgroupProporcional(enc, filas.map((f) => f.map((v, j) => (j === 7 ? "+100 %" : v))), { max: 45 })}
    <thead><tr>${enc.map((h, j) => `<th class="${num(j)}">${h}</th>`).join("")}</tr></thead>
    <tbody>${lista.map((e, i) => { const c = comp.get(e.clave); return `<tr data-k="${esc(e.clave)}" class="${e.clave === selIns ? "ap-sel" : ""}">${filas[i].map((v, j) => `<td class="${num(j)} ${j === 7 && c ? (c.estado === "Por encima" ? "ap-txt-danger" : c.estado === "Por debajo" ? "ap-txt-warn" : "ap-txt-ok") : j === 6 && !rev.refInsumos?.[e.clave] ? "text-muted" : ""}" title="${esc(v)}">${esc(v)}</td>`).join("")}</tr>`; }).join("")}</tbody>`
    : `<tbody><tr><td class="text-muted">Ningún insumo coincide.</td></tr></tbody>`;
  aplicarAnchos(tabla);
  pintarInsumo();
}
function pintarInsumo() {
  const el = $("insumoDetalle");
  const e = (res.apus?.insumos || []).find((x) => x.clave === selIns);
  if (!e) { el.innerHTML = `<p class="text-muted">Sin insumo seleccionado.</p>`; return; }
  const par = (et, v) => `<div><span>${esc(et)}</span><strong>${v}</strong></div>`;
  const c = (res.apus?.comparadosIns || []).find((x) => x.clave === e.clave);
  const ref = rev.refInsumos?.[e.clave] ? insumos.get(rev.refInsumos[e.clave]) : null;
  const sug = sugIns.get(e.clave) || [];
  el.innerHTML = `
    <div class="ap-vp-cabeza"><h2>${esc(e.d)}</h2></div>
    <div class="ap-pares ap-pares-apu">
      ${par("Sección", esc(RV.SECCIONES_APU[e.sec] || e.sec))}
      ${par("Unidad", esc(e.u || "—"))}
      ${par("Cantidad en el presupuesto", numero(e.q, 2))}
      ${par("Precio(s) en los APU", e.preciosLista.map((p) => pesos(p)).join(" · ") || "—")}
      ${par("Valor en el valor final", pesos(e.valorFinal))}
      ${par("APU que lo usan", esc(e.apus.slice(0, 12).join(", ") + (e.apus.length > 12 ? "…" : "")))}
    </div>
    <div class="ap-ref">
      <h3>Insumo equivalente en la base de APU PRO</h3>
      ${ref ? `<div class="ap-pares ap-pares-apu">
          ${par("Insumo", `${esc(ref.codigo)} ${esc(ref.descripcion)}`)}
          ${par("Unidad", esc(ref.unidad || "—"))}
          ${par("Precio de referencia", pesos(precioInsumo(ref.codigo)))}
          ${c ? par("Diferencia", `${c.dif >= 0 ? "+" : ""}${Math.round(c.dif * 100)} % <span class="badge ${c.estado === "Por encima" ? "danger" : c.estado === "Por debajo" ? "warn" : "ok"}">${c.estado}</span>`) : ""}
        </div><div class="rt-acciones"><button type="button" class="btn secondary ap-btn" id="quitarRefIns">Quitar referencia</button></div>`
      : `<p class="text-muted ap-nota">Sin referencia. ${sug.length ? "Sugerencias por parecido de la descripción:" : "No hay insumos parecidos en la base."}</p>
        <div class="ap-sugerencias">${sug.map((s) => `<button type="button" class="ap-sug" data-codigo="${esc(s.codigo)}"><b>${esc(s.codigo)}</b> ${esc(s.nombre)} <span class="badge ${s.puntaje >= 0.7 ? "ok" : s.puntaje >= 0.45 ? "warn" : "muted"}">${Math.round(s.puntaje * 100)} %</span> <small>${pesos(precioInsumo(s.codigo))}</small></button>`).join("")}</div>`}
    </div>`;
  const asignar = (codigo) => { rev.refInsumos = { ...(rev.refInsumos || {}), [e.clave]: codigo }; sugIns.delete(e.clave); cambio(); pintarInsumos(); };
  el.querySelectorAll(".ap-sug").forEach((b) => b.addEventListener("click", () => asignar(b.dataset.codigo)));
  el.querySelector("#quitarRefIns")?.addEventListener("click", () => { const r = { ...(rev.refInsumos || {}) }; delete r[e.clave]; rev.refInsumos = r; calcularSugIns(); cambio(); pintarInsumos(); });
}
function confirmarSugIns() {
  let n = 0;
  for (const e of res.apus?.insumos || []) { const s = sugIns.get(e.clave)?.[0]; if (!rev.refInsumos?.[e.clave] && s && s.puntaje >= 0.7) { rev.refInsumos = { ...(rev.refInsumos || {}), [e.clave]: s.codigo }; sugIns.delete(e.clave); n++; } }
  if (!n) return mostrarAlerta(alerta, "No hay sugerencias de insumos con parecido de 70 % o más.", "info");
  cambio(); pintarInsumos();
  mostrarAlerta(alerta, `Se confirmaron ${n} referencias de insumos. Revísalas: el parecido es por la descripción.`, "success");
}

// ---------------------------------------------------------------- ajustes del revisor en un archivo
// Lo que el revisor decide (referencias de insumos y de APU, ajustes de los hallazgos automáticos,
// hallazgos propios, concepto y datos de la oferta) se exporta y se carga como archivo
// «apupro-ajustes-revision». Al cargar se mezcla con lo que ya tiene la revisión y queda sin
// guardar, para revisarlo antes de pulsar «Guardar».
const CAMPOS_DATOS = ["nombre", "oferente", "cliente", "fechaOferta", "documento", "base", "aiu", "iva", "regimenIva", "totalDeclarado"];
const CAMPOS_TEXTO = ["concepto", "conceptoTexto", "recomendaciones", "objeto", "limitaciones"];
function exportarAjustes() {
  const refsItems = Object.fromEntries(rev.items.filter((it) => it.ref?.codigo).map((it) => [it.item, it.ref.codigo]));
  const json = {
    formato: "apupro-ajustes-revision", version: 1, revision: rev.codigo, generado: new Date().toISOString(),
    datos: Object.fromEntries(CAMPOS_DATOS.map((k) => [k, rev[k] ?? null])),
    ...Object.fromEntries(CAMPOS_TEXTO.map((k) => [k, rev[k] || ""])),
    refInsumos: rev.refInsumos || {}, refItems: refsItems, ajustes: rev.ajustes || {}, hallazgos: rev.hallazgos || []
  };
  descargar(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }), nombreArchivo(`${rev.codigo} ajustes de la revisión`, ".json"));
}
async function cargarAjustes() {
  const f = $("ajustesArchivo").files[0];
  $("ajustesArchivo").value = "";
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j?.formato !== "apupro-ajustes-revision") throw new Error("El archivo no es de ajustes de una revisión de APU PRO.");
    const resumen = [];
    if (j.datos) {
      const cambios = CAMPOS_DATOS.filter((k) => j.datos[k] != null && JSON.stringify(j.datos[k]) !== JSON.stringify(rev[k]));
      for (const k of cambios) rev[k] = j.datos[k];
      if (cambios.length) resumen.push(`datos de la oferta (${cambios.length})`);
    }
    const textos = CAMPOS_TEXTO.filter((k) => j[k]);
    for (const k of textos) rev[k] = j[k];
    if (textos.length) resumen.push("concepto y textos del informe");
    // Referencias de insumos: las del archivo reemplazan; null en el archivo quita la referencia.
    if (j.refInsumos) {
      const r = { ...(rev.refInsumos || {}) };
      let n = 0;
      for (const [k, v] of Object.entries(j.refInsumos)) { if (v) { if (insumos.has(v)) { r[k] = v; n++; } } else if (k in r) { delete r[k]; n++; } }
      rev.refInsumos = r;
      if (n) resumen.push(`${n} referencias de insumos`);
    }
    if (j.refItems) {
      let n = 0;
      for (const it of rev.items) { const c = j.refItems[it.item]; if (c && apus.has(c)) { it.ref = { codigo: c, confirmada: true }; n++; } }
      if (n) resumen.push(`${n} APU de referencia de ítems`);
    }
    if (j.ajustes) { rev.ajustes = { ...(rev.ajustes || {}), ...j.ajustes }; resumen.push("ajustes de hallazgos automáticos"); }
    if (Array.isArray(j.hallazgos)) {
      const titulo = (h) => normalizar(h.titulo || h.hallazgo).slice(0, 80);
      const nuevos = j.hallazgos.filter((h) => !(rev.hallazgos || []).some((x) => titulo(x) === titulo(h)));
      rev.hallazgos = [...(rev.hallazgos || []), ...nuevos.map((h) => ({ incluir: true, ...h, id: h.id && !(rev.hallazgos || []).some((x) => x.id === h.id) ? h.id : `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}` }))];
      if (nuevos.length) resumen.push(`${nuevos.length} hallazgos del revisor`);
    }
    pintarDatos();
    calcularSugerencias();
    cambio();
    calcularSugIns();
    mostrarSeccion();
    mostrarAlerta(alerta, resumen.length ? `Se cargaron: ${resumen.join(", ")}. Revisa y pulsa «Guardar».` : "El archivo no trae cambios para esta revisión.", resumen.length ? "success" : "info");
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
}

// ---------------------------------------------------------------- guardar
async function guardar() {
  const btn = $("guardarBtn");
  rev.resumen = { ...RV.resumenRevision(rev, res, hallazgos), apus: apusOferta.length };
  const tam = JSON.stringify(rev).length;
  if (tam > 900000) return mostrarAlerta(alerta, `La revisión es demasiado grande para guardarse (${Math.round(tam / 1024)} KB): divide la oferta en partes.`);
  btn.disabled = true;
  try {
    if (apusSucio) { btn.textContent = "Guardando APU…"; await guardarApusRevision(id, apusOferta); apusSucio = false; }
    await guardarRevision(id, rev, ctx.user);
    marcarSucio(false);
    mostrarAlerta(alerta, "Revisión guardada.", "success");
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); } finally { btn.disabled = false; btn.textContent = "💾 Guardar"; }
}

function conectar() {
  window.addEventListener("hashchange", mostrarSeccion);
  window.addEventListener("beforeunload", (e) => { if (sucio) { e.preventDefault(); e.returnValue = ""; } });
  $("guardarBtn").addEventListener("click", guardar);
  $("exportarAjustesBtn").addEventListener("click", exportarAjustes);
  $("cargarAjustesBtn").addEventListener("click", () => $("ajustesArchivo").click());
  $("ajustesArchivo").addEventListener("change", cargarAjustes);
  $("archivo").addEventListener("change", leerArchivo);
  $("leerPegado").addEventListener("click", leerPegado);
  $("usarItems").addEventListener("click", usarItems);
  ["datosForm", "aiuForm", "conceptoForm", "textosForm"].forEach((f) => {
    $(f).addEventListener("change", leerDatos);
    $(f).addEventListener("submit", (e) => e.preventDefault());
  });
  let t = null;
  $("buscarItem").addEventListener("input", () => { clearTimeout(t); t = setTimeout(pintarItems, 150); });
  $("filtroItems").addEventListener("change", pintarItems);
  $("tablaItems").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    selItem = tr.dataset.id;
    $("tablaItems").querySelectorAll("tr.ap-sel").forEach((r) => r.classList.remove("ap-sel"));
    tr.classList.add("ap-sel");
    pintarItem();
  });
  $("confirmarSug").addEventListener("click", confirmarSugerencias);
  $("buscarApu").addEventListener("input", () => { clearTimeout(t); t = setTimeout(pintarApus, 150); });
  $("filtroApus").addEventListener("change", pintarApus);
  $("tablaApus").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-n]");
    if (!tr) return;
    selApu = Number(tr.dataset.n);
    $("tablaApus").querySelectorAll("tr.ap-sel").forEach((r) => r.classList.remove("ap-sel"));
    tr.classList.add("ap-sel");
    pintarApu();
  });
  $("buscarInsumo").addEventListener("input", () => { clearTimeout(t); t = setTimeout(pintarInsumos, 150); });
  $("filtroInsumos").addEventListener("change", pintarInsumos);
  $("tablaInsumos").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-k]");
    if (!tr) return;
    selIns = tr.dataset.k;
    $("tablaInsumos").querySelectorAll("tr.ap-sel").forEach((r) => r.classList.remove("ap-sel"));
    tr.classList.add("ap-sel");
    pintarInsumo();
  });
  $("confirmarSugIns").addEventListener("click", confirmarSugIns);
  $("agregarHallazgo").addEventListener("click", () => abrirHallazgo());
  $("hallazgoGuardar").addEventListener("click", guardarHallazgo);
  $("descargarRD").addEventListener("click", descargarRD);
  $("descargarExcel").addEventListener("click", descargarExcel);
  document.querySelectorAll("dialog").forEach((d) => {
    d.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", () => d.close()));
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  });
}

// Al final: las constantes de arriba ya están inicializadas cuando arranca la página.
if (ctx) await iniciar();
