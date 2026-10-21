// Editor de una revisión de oferta de terceros: importación de la tabla del presupuesto
// (Excel o texto pegado), datos de AIU e IVA, ítems con su APU de referencia de APU PRO,
// verificaciones automáticas, hallazgos del revisor e informe (RD para Informes y Excel).
import { iniciarPagina, leerRevision, guardarRevision, listarApus, listarInsumos, listarParametros, parametrosVigentes, esc, pesos, numero, leerNumero, mostrarAlerta, limpiarAlerta, errorAmigable, colgroupProporcional, aplicarAnchos } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { calcularApu } from "./ap-apu.js";
import { normalizar } from "./ap-calculos.js";
import { logoBase64 } from "./ap-formato.js";
import * as RV from "./ap-revision-motor.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");
const id = new URLSearchParams(location.search).get("id");
let rev = null, apus = new Map(), insumos = new Map(), parametros = null, indice = [], sugerencias = new Map(), precios = new Map();
let res = null, hallazgos = [], sucio = false, selItem = null, matriz = null, lectura = null, editando = null;


async function iniciar() {
  try {
    const [r, lista, ins, par] = await Promise.all([leerRevision(id), listarApus(), listarInsumos(), listarParametros()]);
    if (!r) throw new Error("No se encontró la revisión.");
    rev = { ajustes: {}, hallazgos: [], items: [], capitulos: [], ...r };
    apus = new Map(lista.map((a) => [a.codigo, a]));
    insumos = new Map(ins.map((x) => [x.codigo, x]));
    parametros = parametrosVigentes(par);
    indice = RV.indiceApus(lista);
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
function recalcular() {
  res = RV.revisar(rev, { precioApu });
  hallazgos = RV.hallazgosRevision(rev, res);
  const inc = hallazgos.filter((h) => h.incluir);
  $("nItems").textContent = rev.items.length;
  $("nHallazgos").textContent = inc.length;
  pintarResumen();
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
  </div>`;
}

function mostrarSeccion() {
  const sec = location.hash.slice(1) || (rev.items.length ? "items" : "importar");
  document.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== sec));
  document.querySelectorAll("#pestanas [data-sec]").forEach((a) => a.classList.toggle("activa", a.dataset.sec === sec));
  if (sec === "items") pintarItems();
  if (sec === "hallazgos") pintarHallazgos();
  if (sec === "informe") pintarInforme();
}

// ---------------------------------------------------------------- importar
const letra = (j) => (j >= 26 ? String.fromCharCode(64 + Math.floor(j / 26)) : "") + String.fromCharCode(65 + (j % 26));
async function leerArchivo() {
  const f = $("archivo").files[0];
  if (!f) return;
  limpiarAlerta(alerta);
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
function leerPegado() {
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
  const capNom = Object.fromEntries(lectura.capitulos.map((c) => [c.num, c.nombre]));
  const enc = ["Cap.", "Ítem", "Descripción", "Und", "Cantidad", "V. unitario", "V. total"];
  const filas = lectura.items.slice(0, 14).map((it) => [`${it.cap} ${capNom[it.cap] ? "· " + capNom[it.cap] : ""}`, it.item, it.desc, it.und, numero(it.cant, 4), pesos(it.vu, 2), pesos(it.vt)]);
  $("previa").innerHTML = filas.length ? `${colgroupProporcional(enc, filas)}<thead><tr>${enc.map((h, j) => `<th class="${j > 3 ? "ap-num" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((v, j) => `<td class="${j > 3 ? "ap-num" : ""}" title="${esc(v)}">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>` : "";
  aplicarAnchos($("previa"));
}
function usarItems() {
  if (!lectura?.items.length) return mostrarAlerta(alerta, "No hay ítems para usar: revisa las columnas.");
  if (rev.items.length && !confirm(`La revisión ya tiene ${rev.items.length} ítems. ¿Reemplazarlos por los ${lectura.items.length} leídos? Se pierden las referencias a APU asignadas.`)) return;
  rev.items = lectura.items;
  rev.capitulos = lectura.capitulos;
  if (lectura.totalDetectado && !rev.totalDeclarado) { rev.totalDeclarado = lectura.totalDetectado; $("rTotal").value = numero(lectura.totalDetectado, 0); }
  selItem = null;
  calcularSugerencias();
  cambio();
  mostrarAlerta(alerta, `Se cargaron ${rev.items.length} ítems. Registra ahora el AIU y el IVA de la oferta y guarda.`, "success");
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
        <strong>${esc(v.titulo)}</strong> <small class="text-muted">${esc(v.tema)} · impacto ${esc(RV.impactoTexto(h))}</small>
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
  $("consolidado").innerHTML = `<p class="ap-nota"><b>Concepto:</b> ${esc(RV.CONCEPTOS[rev.concepto] || `${RV.conceptoSugerido(inc)} (sugerido; se fija en «Datos, AIU e IVA»)`)}</p>` + (inc.length
    ? `<div class="tabla-scroll"><table class="ap-tabla" id="tablaConsolidado">${colgroupProporcional(enc, filas)}<thead><tr>${enc.map((x, j) => `<th class="${j === 4 ? "ap-num" : ""}">${x}</th>`).join("")}</tr></thead>
      <tbody>${filas.map((f) => `<tr>${f.map((v, j) => `<td class="${j === 4 ? "ap-num" : ""}" title="${esc(v)}">${j === 1 ? `<span class="badge ${BADGE_SEV[v]}">${esc(v)}</span>` : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : `<p class="text-muted">Sin hallazgos incluidos.</p>`);
  aplicarAnchos($("consolidado"));
}
const nombreArchivo = (s) => s.replace(/[\\/:*?"<>|]/g, "").slice(0, 90);
function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function descargarRD() {
  if (!rev.items.length) return mostrarAlerta(alerta, "Importa primero los ítems de la oferta.");
  const inf = RV.informeRD(rev, res, hallazgos, { firmaNombre: ctx.perfil?.nombre || "", firmaCargo: ctx.perfil?.cargo || "" });
  descargar(new Blob([JSON.stringify(inf, null, 2)], { type: "application/json" }), nombreArchivo(`RD ${rev.codigo} ${rev.nombre} - importar en Informes.json`));
}
async function descargarExcel() {
  if (!rev.items.length) return mostrarAlerta(alerta, "Importa primero los ítems de la oferta.");
  const btn = $("descargarExcel");
  btn.disabled = true;
  try {
    const wb = RV.libroRevision(window.ExcelJS, rev, res, hallazgos, { logo: await logoBase64() });
    const buf = await wb.xlsx.writeBuffer();
    descargar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nombreArchivo(`${rev.codigo} Revisión ${rev.nombre}.xlsx`));
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); } finally { btn.disabled = false; }
}

// ---------------------------------------------------------------- guardar
async function guardar() {
  const btn = $("guardarBtn");
  rev.resumen = RV.resumenRevision(rev, res, hallazgos);
  const tam = JSON.stringify(rev).length;
  if (tam > 900000) return mostrarAlerta(alerta, `La revisión es demasiado grande para guardarse (${Math.round(tam / 1024)} KB): divide la oferta en partes.`);
  btn.disabled = true;
  try {
    await guardarRevision(id, rev, ctx.user);
    marcarSucio(false);
    mostrarAlerta(alerta, "Revisión guardada.", "success");
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); } finally { btn.disabled = false; }
}

function conectar() {
  window.addEventListener("hashchange", mostrarSeccion);
  window.addEventListener("beforeunload", (e) => { if (sucio) { e.preventDefault(); e.returnValue = ""; } });
  $("guardarBtn").addEventListener("click", guardar);
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
