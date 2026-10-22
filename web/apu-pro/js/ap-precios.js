// Actualizar precios de la base de insumos: desde un Excel, por reajuste de IPP o desde una
// cotización en PDF. Todo termina en una propuesta que se revisa y se aplica por lotes.
import { iniciarPagina, listarInsumos, leerSerie, registrarPreciosLote, esc, pesos, fechaCorta, hoyISO, leerNumero, mostrarAlerta, limpiarAlerta, errorAmigable, colgroupProporcional, aplicarAnchos } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { logoBase64 } from "./ap-formato.js";
import { TIPOS, ORDEN_TIPOS, estadoPrecio, variacionIPP } from "./ap-calculos.js";
import { hojaAMatriz, textoAMatriz } from "./ap-revision-motor.js";
import { leerPaginas, tablaPresupuesto } from "./ap-pdf.js";
import * as PM from "./ap-precios-motor.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");
const TIPOS_PRECIO = ORDEN_TIPOS.filter((t) => t !== "MO"); // la mano de obra sale de los parámetros del año
let insumos = [], serie = { puntos: [] }, indice = null, lista = [], origen = "excel", titulo = "Propuesta", resumenExtra = "";

if (ctx) {
  try {
    [insumos, serie] = await Promise.all([listarInsumos(), leerSerie("ipp").then((s) => s || { puntos: [] })]);
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  indice = PM.crearIndice(insumos);
  pintarMenu(ctx, { activo: "precios", conteos: Object.fromEntries(ORDEN_TIPOS.map((t) => [t, insumos.filter((x) => x.tipo === t).length])) });
  iniciar();
}

function iniciar() {
  $("xTipo").innerHTML = `<option value="">Todos (sin mano de obra)</option>${TIPOS_PRECIO.map((t) => `<option value="${t}">${esc(TIPOS[t].nombre)}</option>`).join("")}`;
  $("xFecha").value = hoyISO(); $("pFecha").value = hoyISO(); $("iHasta").value = hoyISO();
  $("iTipos").innerHTML = TIPOS_PRECIO.map((t) => `<label class="ap-check"><input type="checkbox" value="${t}" ${t === "MA" ? "checked" : ""}> ${esc(TIPOS[t].nombre)}</label>`).join(" ");
  const v = variacionIPP(serie.puntos, 1), ult = [...(serie.puntos || [])].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  $("ippEstado").textContent = ult ? `Último dato del IPP: ${ult.fecha.slice(0, 7)}${v ? ` · variación de los últimos 12 meses: ${(v.tasaAnual * 100).toFixed(2).replace(".", ",")} %` : ""}.` : "Todavía no hay datos del IPP: cárgalos en Parámetros e IPP o usa una tasa anual digitada.";
  $("pestanas").addEventListener("click", (e) => { const b = e.target.closest("[data-origen]"); if (b) cambiarOrigen(b.dataset.origen); });
  $("xPlantilla").addEventListener("click", descargarPlantilla);
  $("xSubir").addEventListener("click", () => $("xArchivo").click());
  $("xArchivo").addEventListener("change", leerExcel);
  $("iModo").addEventListener("change", () => $("iTasaCaja").classList.toggle("hidden", $("iModo").value !== "tasa"));
  $("iCalcular").addEventListener("click", calcularIPP);
  $("pSubir").addEventListener("click", () => $("pArchivo").click());
  $("pArchivo").addEventListener("change", leerPdf);
  $("pLeerTexto").addEventListener("click", leerTextoPegado);
  $("verFiltro").addEventListener("change", pintarTabla);
  $("marcarSinAlertas").addEventListener("click", () => { lista.forEach((e) => { e.aplicar = !!e.p?.aplicar; }); pintarTabla(); });
  $("marcarTodas").addEventListener("click", () => { lista.forEach((e) => { e.aplicar = !!e.p && !e.p.error; }); pintarTabla(); });
  $("desmarcarTodo").addEventListener("click", () => { lista.forEach((e) => { e.aplicar = false; }); pintarTabla(); });
  $("aplicarBtn").addEventListener("click", aplicar);
  $("tablaPropuesta").addEventListener("change", (e) => {
    const id = e.target.dataset.id, ent = lista.find((x) => x.id === id);
    if (!ent) return;
    if (e.target.matches("input[type=checkbox]")) { ent.aplicar = e.target.checked; resumen(); return; }
    if (e.target.matches("select")) { elegir(ent, e.target.value); pintarTabla(); }
  });
}

function cambiarOrigen(o) {
  origen = o;
  document.querySelectorAll("#pestanas .ap-pestana").forEach((b) => b.classList.toggle("activa", b.dataset.origen === o));
  for (const k of ["excel", "ipp", "pdf"]) $(`origen-${k}`).classList.toggle("hidden", k !== o);
  limpiarAlerta(alerta);
}

// ---------------------------------------------------------------- entradas de la propuesta
const hoy = hoyISO;
function crearEntrada(f, i) {
  const e = PM.emparejar(f, indice);
  const p = e.ins ? PM.propuesta(e.ins, { ...f, metodo: e.metodo }, { hoy: hoy() }) : null;
  return { id: `e${i}`, origen: f, candidatos: e.candidatos, p, aplicar: !!p?.aplicar };
}
function elegir(ent, codigo) {
  const ins = codigo ? indice.porInsumo.get(codigo) : null;
  ent.p = ins ? PM.propuesta(ins, { ...ent.origen, metodo: "manual" }, { hoy: hoy() }) : null; // la elige una persona: sin aviso de parecido
  ent.aplicar = !!ent.p?.aplicar;
}
function mostrarPropuesta(entradas, tituloNuevo, extra = "") {
  lista = entradas; titulo = tituloNuevo; resumenExtra = extra;
  $("propuestaCard").classList.remove("hidden");
  pintarTabla();
  $("propuestaCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------- Excel
function filtroPlantilla() {
  const tipo = $("xTipo").value, est = $("xEstado").value;
  return insumos.filter((x) => (tipo ? x.tipo === tipo : x.tipo !== "MO")).filter((x) => {
    if (!est) return true;
    const e = x.precio == null || !x.fechaPrecio ? { clase: "muted" } : estadoPrecio(x.fechaPrecio);
    if (est === "viejos") return e.clase === "warn" || e.clase === "danger";
    return e.clase === est;
  }).sort((a, b) => (Number(a.codigo.replace(/\D+/g, "")) || 0) - (Number(b.codigo.replace(/\D+/g, "")) || 0));
}
async function descargarPlantilla() {
  limpiarAlerta(alerta);
  const filas = PM.filasPlantilla(filtroPlantilla());
  if (!filas.length) return mostrarAlerta(alerta, "No hay insumos con ese filtro.", "info");
  const btn = $("xPlantilla");
  btn.disabled = true;
  try {
    const wb = PM.libroPlantilla(window.ExcelJS, filas, { logo: await logoBase64() });
    const buf = await wb.xlsx.writeBuffer();
    descargar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Plantilla de precios APU PRO ${hoy()}.xlsx`);
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); } finally { btn.disabled = false; }
}
async function leerExcel() {
  const f = $("xArchivo").files[0];
  $("xArchivo").value = "";
  if (!f) return;
  limpiarAlerta(alerta);
  $("xProgreso").textContent = "Leyendo el archivo…";
  try {
    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(await f.arrayBuffer());
    const leidas = wb.worksheets.map((ws) => ({ ws, r: PM.leerFilasPrecios(hojaAMatriz(ws)) }));
    const mejor = leidas.reduce((a, b) => (b.r.filas.length > a.r.filas.length ? b : a), { r: { filas: [], omitidas: 0 } });
    if (!mejor.r.filas.length) throw new Error(mejor.r.omitidas ? "El archivo no tiene precios nuevos llenos." : "No se encontró una tabla con descripción o código y precio. Usa la plantilla o revisa los encabezados.");
    const fecha = $("xFecha").value, fuente = $("xFuente").value.trim() || f.name.replace(/\.[^.]+$/, "");
    const filas = mejor.r.filas.map((x) => ({ ...x, fecha: x.fecha || fecha, fuente: x.fuente || fuente }));
    $("xProgreso").textContent = `Hoja «${mejor.ws.name}»: ${filas.length} filas con precio${mejor.r.omitidas ? `; ${mejor.r.omitidas} sin precio nuevo (no se modifican)` : ""}.`;
    mostrarPropuesta(filas.map(crearEntrada), `Propuesta desde ${f.name}`);
  } catch (err) { $("xProgreso").textContent = ""; mostrarAlerta(alerta, `No se pudo leer el Excel: ${errorAmigable(err)}`); }
}

// ---------------------------------------------------------------- IPP
function calcularIPP() {
  limpiarAlerta(alerta);
  const tipos = [...document.querySelectorAll("#iTipos input:checked")].map((i) => i.value);
  if (!tipos.length) return mostrarAlerta(alerta, "Elige al menos un tipo de insumo.", "info");
  const hasta = $("iHasta").value || hoy();
  const minMeses = Math.max(1, Number($("iMeses").value) || 7);
  let tasa = null;
  if ($("iModo").value === "tasa") {
    const t = leerNumero($("iTasa").value);
    if (t == null) return mostrarAlerta(alerta, "Escribe la tasa anual en porcentaje, por ejemplo 5,5.", "info");
    tasa = t / 100;
  } else if (!(serie.puntos || []).length) return mostrarAlerta(alerta, "No hay datos del IPP: cárgalos en Parámetros e IPP o usa una tasa anual digitada.", "info");
  const r = PM.proponerIPP(insumos, serie.puntos, { hasta, tipos, minMeses, tasaAnual: tasa, hoy: hoy() });
  if (!r.propuestas.length) return mostrarAlerta(alerta, `No hay precios con ${minMeses} meses o más de antigüedad${r.sinIndice.length ? `, o el IPP no cubre sus fechas (${r.sinIndice.length} insumos)` : ""}.`, "info");
  const entradas = r.propuestas.map((p, i) => ({ id: `e${i}`, origen: null, candidatos: [], p, aplicar: p.aplicar }));
  mostrarPropuesta(entradas, "Propuesta de reajuste", r.sinIndice.length ? `${r.sinIndice.length} insumos no se reajustaron porque el IPP no cubre la fecha de su precio.` : "");
}

// ---------------------------------------------------------------- cotización
function filasCotizacion(matriz) {
  let filas = PM.filasDeCotizacion(matriz);
  if (!filas.length) filas = PM.leerFilasPrecios(matriz).filas;
  const fecha = $("pFecha").value, fuente = $("pFuente").value.trim(), iva = $("pIva").value === "si" ? true : $("pIva").value === "no" ? false : undefined;
  return filas.map((f) => ({ ...f, fecha: f.fecha || fecha, fuente: f.fuente || fuente, iva: f.iva ?? iva }));
}
function proponerCotizacion(filas, nombre) {
  if (!filas.length) throw new Error("No se encontraron ítems con descripción y valor unitario. Pega la tabla en el cuadro de abajo (descripción, unidad y valor unitario).");
  mostrarPropuesta(filas.map(crearEntrada), `Propuesta desde ${nombre}`);
}
async function leerPdf() {
  const f = $("pArchivo").files[0];
  $("pArchivo").value = "";
  if (!f) return;
  limpiarAlerta(alerta);
  const prog = $("pProgreso");
  try {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error("No se cargó el lector de PDF.");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "../js/vendor/pdfjs/pdf.worker.min.js";
    const paginas = await leerPaginas(pdfjsLib, new Uint8Array(await f.arrayBuffer()), { progreso: (n, total) => { prog.textContent = `Leyendo la página ${n} de ${total}…`; } });
    if (!paginas.some((p) => p.lineas.length > 3)) throw new Error("El PDF no tiene texto: parece escaneado. Pide la cotización en PDF original o en Excel.");
    if (!$("pFuente").value.trim()) $("pFuente").value = f.name.replace(/\.[^.]+$/, "");
    const tp = tablaPresupuesto(paginas);
    let filas = tp ? filasCotizacion(tp.matriz) : [];
    if (!filas.length) filas = filasCotizacion(textoAMatriz(paginas.flatMap((p) => p.lineas.map((l) => l.texto)).join("\n")));
    prog.textContent = `PDF de ${paginas.length} páginas: ${filas.length} ítems leídos.`;
    proponerCotizacion(filas, f.name);
  } catch (err) { prog.textContent = ""; mostrarAlerta(alerta, `No se pudo leer el PDF: ${errorAmigable(err)}`); }
}
function leerTextoPegado() {
  limpiarAlerta(alerta);
  const texto = $("pTexto").value;
  if (!texto.trim()) return mostrarAlerta(alerta, "Pega primero la tabla de la cotización.", "info");
  try { proponerCotizacion(filasCotizacion(textoAMatriz(texto)), "el texto pegado"); } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
}

// ---------------------------------------------------------------- tabla de la propuesta
const textoLargo = new Set(["Insumo", "En el archivo", "Fuente", "Alertas"]); // no deben quitarle ancho a precios y fechas
const pct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1).replace(".", ",")} %`);
function pintarTabla() {
  const filtro = $("verFiltro").value;
  const visibles = lista.filter((e) => !filtro || (filtro === "marcadas" ? e.aplicar : !e.p || e.p.alertas.some((a) => a.nivel !== "info")));
  $("propuestaTitulo").textContent = titulo;
  const conArchivo = lista.some((e) => e.origen?.desc);
  const enc = ["", "Insumo", ...(conArchivo ? ["En el archivo"] : []), "Und", "Actual", "Nuevo", "Var.", "Fecha", "Fuente", "Alertas"];
  const filas = visibles.map((e) => {
    const p = e.p;
    const dudoso = e.candidatos.length && (!p || p.metodo === "parecido");
    const insumo = dudoso
      ? `<select data-id="${e.id}" title="Elige el insumo de la base"><option value="">— ninguno —</option>${e.candidatos.map((c) => `<option value="${esc(c.codigo)}" ${p?.codigo === c.codigo ? "selected" : ""}>${esc(c.codigo)} — ${esc(c.descripcion).slice(0, 60)} (${Math.round(c.puntaje * 100)} %)</option>`).join("")}</select>`
      : p ? `${esc(p.codigo)} — ${esc(p.descripcion)}` : "—";
    const alertas = !p ? '<span class="badge muted" title="Elige el insumo de la lista">Sin emparejar</span>' : p.alertas.length
      ? p.alertas.map((a) => `<span class="badge ${a.nivel === "error" ? "danger" : a.nivel === "revisar" ? "warn" : "muted"}" title="${esc(a.texto)}">${a.nivel === "error" ? "Error" : a.nivel === "revisar" ? "Revisar" : "Info"}</span>`).join(" ") + ` <span class="ap-alerta-txt">${esc(p.alertas[0].texto)}</span>`
      : '<span class="badge ok">Sin alertas</span>';
    const nuevo = p ? pesos(p.valor) : pesos(e.origen?.valor);
    return [
      `<input type="checkbox" data-id="${e.id}" ${e.aplicar ? "checked" : ""} ${!p || p.error ? "disabled" : ""}>`,
      insumo,
      ...(conArchivo ? [esc(e.origen?.desc || "")] : []),
      esc(p?.unidad || e.origen?.und || ""),
      p?.actual != null ? pesos(p.actual) : "—",
      nuevo,
      p ? `<span class="${p.variacion != null && Math.abs(p.variacion) > PM.SALTO_ALERTA ? "ap-var-alta" : ""}">${pct(p.variacion)}</span>` : "—",
      p ? fechaCorta(p.fecha) : "—",
      esc(p?.fuente || e.origen?.fuente || ""),
      alertas
    ];
  });
  const numCols = new Set([enc.indexOf("Actual"), enc.indexOf("Nuevo"), enc.indexOf("Var.")]);
  $("tablaPropuesta").innerHTML = filas.length
    ? `${colgroupProporcional(enc.map((h, j) => (j === 0 ? "✓" : h)), filas.map((f) => f.map((c, j) => { const t = String(c).replace(/<[^>]+>/g, ""); return textoLargo.has(enc[j]) ? t.slice(0, enc[j] === "Insumo" ? 44 : 26) : t; })), { min: 5, max: 30 })}
       <thead><tr>${enc.map((h, j) => `<th class="${numCols.has(j) ? "ap-num" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
       <tbody>${filas.map((f) => `<tr>${f.map((v, j) => `<td class="${numCols.has(j) ? "ap-num" : ""}">${v}</td>`).join("")}</tr>`).join("")}</tbody>`
    : '<tbody><tr><td class="text-muted">Ninguna fila coincide con el filtro.</td></tr></tbody>';
  aplicarAnchos($("tablaPropuesta"));
  resumen();
}
function resumen() {
  const marcadas = lista.filter((e) => e.aplicar && e.p && !e.p.error).length;
  const alertas = lista.filter((e) => e.p && e.p.alertas.some((a) => a.nivel !== "info")).length;
  const sin = lista.filter((e) => !e.p).length;
  $("propuestaResumen").textContent = `${lista.length} filas · ${marcadas} marcadas para aplicar · ${alertas} con alertas · ${sin} sin emparejar.${resumenExtra ? ` ${resumenExtra}` : ""} Las filas con alertas «Revisar» vienen sin marcar: revísalas y márcalas si están bien.`;
  $("aplicarBtn").textContent = `Aplicar ${marcadas} precio${marcadas === 1 ? "" : "s"} marcado${marcadas === 1 ? "" : "s"}`;
  $("aplicarBtn").disabled = !marcadas;
}

// ---------------------------------------------------------------- aplicar
async function aplicar() {
  limpiarAlerta(alerta);
  const sel = lista.filter((e) => e.aplicar && e.p && !e.p.error);
  if (!sel.length) return;
  const repetidos = sel.map((e) => e.p.codigo).filter((c, i, a) => a.indexOf(c) !== i);
  if (repetidos.length) return mostrarAlerta(alerta, `Hay más de una fila marcada para ${[...new Set(repetidos)].slice(0, 5).join(", ")}: deja marcada solo una por insumo.`);
  const conAlerta = sel.filter((e) => e.p.alertas.some((a) => a.nivel === "revisar")).length;
  if (!confirm(`Se registrarán ${sel.length} precios nuevos en la base${conAlerta ? ` (${conAlerta} con alertas que marcaste a mano)` : ""}. Cada uno queda en el historial del insumo. ¿Continuar?`)) return;
  const btn = $("aplicarBtn");
  btn.disabled = true;
  try {
    const cambios = sel.map((e) => ({ codigo: e.p.codigo, valor: e.p.valor, fecha: e.p.fecha, fuente: e.p.fuente, url: e.p.url, metodo: e.p.metodo === "ipp" ? "ipp" : origen, incluyeIva: e.p.incluyeIva }));
    const nuevos = await registrarPreciosLote(insumos, cambios, ctx.user, (h, n) => { btn.textContent = `Guardando ${h} de ${n}…`; });
    const porCodigo = new Map(nuevos.map((x) => [x.codigo, x]));
    insumos = insumos.map((x) => porCodigo.get(x.codigo) || x);
    indice = PM.crearIndice(insumos);
    lista = [];
    $("propuestaCard").classList.add("hidden");
    mostrarAlerta(alerta, `Listo: se registraron ${nuevos.length} precios. Puedes verlos en cada insumo (con su historial).`, "success");
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); } finally { btn.disabled = false; }
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
