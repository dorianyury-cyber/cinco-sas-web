// Editor de un proyecto (presupuesto): capítulos con ítems tomados de la biblioteca de APU
// (copia congelada de cada APU), cantidades por sitio con memoria de cálculo, AIU, IVA,
// factor de proyección de materiales, congelamiento de precios y versiones entregadas.
import { iniciarPagina, leerProyecto, guardarProyecto, guardarVersionProyecto, listarVersionesProyecto, listarApus, listarInsumos, listarParametros, parametrosVigentes, leerSerie, esc, pesos, numero, fechaCorta, hoyISO, leerNumero, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { variacionIPP, factorProyeccion, valorMensual, jornalMO } from "./ap-calculos.js";
import { calcularPresupuesto, evaluarCantidad, resolverInsumo, preciosUsados, copiaApu, nuevoId } from "./ap-presupuesto.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");
const id = new URLSearchParams(location.search).get("id");
let proyecto = null, base = new Map(), biblioteca = new Map(), parametros = [], ipp = null, sucio = false, calc = null;

if (ctx) await iniciar();

async function iniciar() {
  try {
    const [p, ins, apus, par, serie] = await Promise.all([leerProyecto(id), listarInsumos(), listarApus(), listarParametros(), leerSerie("ipp")]);
    if (!p) throw new Error("No se encontró el proyecto.");
    proyecto = p; base = new Map(ins.map((x) => [x.codigo, x])); biblioteca = new Map(apus.map((a) => [a.codigo, a])); parametros = par; ipp = serie;
    pintarMenu(ctx, { activo: "proyectos" });
    $("dlApus").innerHTML = [...biblioteca.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true })).map((a) => `<option value="${esc(`${a.codigo} — ${a.nombre}`)}"></option>`).join("");
    $("formatoBtn").href = `presupuesto-formato.html?id=${encodeURIComponent(id)}`;
    $("volver").href = `proyectos.html#${encodeURIComponent(id)}`;
    pintarTodo();
    conectar();
  } catch (err) {
    pintarMenu(ctx, { activo: "proyectos" });
    mostrarAlerta(alerta, errorAmigable(err));
  }
}

function parametrosProyecto() { return parametros.find((p) => p.anio === Number(proyecto.anioParametros)) || parametrosVigentes(parametros); }
function calcular() {
  calc = calcularPresupuesto(proyecto, { insumo: resolverInsumo(proyecto, base), parametros: parametrosProyecto() });
  return calc;
}
function marcarSucio(v = true) {
  sucio = v;
  $("sucio").classList.toggle("hidden", !v);
}

function pintarTodo() {
  $("titulo").textContent = `${proyecto.codigo} — ${proyecto.nombre}`;
  $("subtitulo").textContent = [proyecto.cliente, proyecto.ubicacion].filter(Boolean).join(" · ");
  document.title = `${proyecto.codigo} — APU PRO`;
  mostrarSeccion();
  pintarPresupuesto();
  pintarParametros();
  pintarPrecios();
}

function mostrarSeccion() {
  const sec = (location.hash.slice(1) || "presupuesto");
  document.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== sec));
  document.querySelectorAll("#pestanas [data-sec]").forEach((a) => a.classList.toggle("activa", a.dataset.sec === sec));
  if (sec === "versiones") pintarVersiones();
  if (sec === "precios") pintarPrecios();
}

// ---------------------------------------------------------------- resumen
function pintarResumen() {
  const c = calc, varios = c.sitios.length > 1;
  $("resumen").innerHTML = `<div class="ap-pares ap-pares-apu">
    <div><span>Costo directo</span><strong>${pesos(c.costoDirecto)}</strong></div>
    <div><span>AIU ${numero(c.opciones.aiu.a * 100, 1)}/${numero(c.opciones.aiu.i * 100, 1)}/${numero(c.opciones.aiu.u * 100, 1)} %</span><strong>${pesos(c.a + c.i + c.u)}</strong></div>
    <div><span>IVA ${c.opciones.regimenIva === "total" ? "sobre el subtotal" : "sobre la utilidad"}</span><strong>${pesos(c.iva)}</strong></div>
    <div><span>Valor total</span><strong class="ap-grande">${pesos(c.total)}</strong></div>
    ${varios ? c.sitios.map((s) => `<div><span>${esc(s.nombre)}</span><strong>${pesos(c.porSitio[s.id].total)}</strong></div>`).join("") : ""}
    <div><span>Ítems</span><strong>${c.items}</strong></div>
    <div><span>Precios</span><strong>${proyecto.fechaPrecios ? `Congelados ${fechaCorta(proyecto.fechaPrecios)}` : "Vigentes de la base"}</strong></div>
  </div>`;
}

// ---------------------------------------------------------------- presupuesto
function pintarPresupuesto() {
  calcular();
  const sitios = calc.sitios;
  const encCant = sitios.map((s) => `<th class="ap-num">${sitios.length > 1 ? `Cant. ${esc(s.nombre)}` : "Cantidad"}</th>`).join("");
  $("capitulos").innerHTML = calc.capitulos.map((cap, ci) => `
    <section class="card ap-cap-edit" data-cap="${ci}">
      <div class="ap-cap-edit-cabeza">
        <div class="ap-cap-nombre"><span class="ap-cap-num">${ci + 1}.</span><input class="ap-in-capnombre" value="${esc(cap.nombre)}"><span class="ap-subtotal" data-capsub="${ci}">${pesos(cap.subtotal)}</span></div>
        <div class="rt-acciones">
          <button type="button" class="rt-icono-btn" data-capmover="-1" title="Subir capítulo">↑</button>
          <button type="button" class="rt-icono-btn" data-capmover="1" title="Bajar capítulo">↓</button>
          <button type="button" class="rt-icono-btn" data-capquitar title="Quitar capítulo">✕</button>
        </div>
      </div>
      <table class="ap-tabla ap-tabla-lineas ap-tabla-presu">
        <colgroup><col data-ancho="4"><col data-ancho="${Math.max(20, 44 - sitios.length * 8)}"><col data-ancho="6">${sitios.map(() => `<col data-ancho="${sitios.length > 1 ? 9 : 12}">`).join("")}<col data-ancho="12"><col data-ancho="13"><col data-ancho="9"></colgroup>
        <thead><tr><th>#</th><th>APU</th><th>Und</th>${encCant}<th class="ap-num">Vr. unitario</th><th class="ap-num">Vr. total</th><th></th></tr></thead>
        <tbody>${cap.items.map((it, ii) => filaItem(ci, ii, it, sitios)).join("")}
          <tr class="ap-fila-nueva"><td></td><td colspan="${3 + sitios.length + 2}"><input class="ap-in-nuevo" data-nuevo="${ci}" list="dlApus" placeholder="＋ Agregar ítem: escribe el código o el nombre del APU"></td></tr>
        </tbody>
      </table>
    </section>`).join("");
  document.querySelectorAll("#capitulos col[data-ancho]").forEach((c) => { c.style.width = `${c.dataset.ancho}%`; });
  pintarResumen();
  pintarAvisos();
}
function filaItem(ci, ii, it, sitios) {
  const lib = biblioteca.get(it.apu.codigo);
  const nueva = lib && (lib.version || 1) > (it.apu.version || 1);
  return `<tr data-cap="${ci}" data-item="${ii}">
    <td class="ap-num">${it.numero}</td>
    <td class="ap-celda-apu" title="${esc(it.apu.nombre)}"><strong>${esc(it.apu.codigo)}</strong>${nueva ? ` <button type="button" class="badge warn ap-badge-btn" data-actualizar title="La biblioteca tiene la versión ${lib.version}; el ítem usa la ${it.apu.version || 1}">v${lib.version} disponible</button>` : ""} ${esc(it.apu.nombre)}</td>
    <td>${esc(it.apu.unidad)}</td>
    ${sitios.map((s) => { const c = it.cantidadesOrig?.[s.id]; const texto = c?.expresion ?? (c?.valor != null ? String(c.valor).replace(".", ",") : ""); return `<td class="ap-num"><input class="ap-in-cant ap-num" data-sitio="${esc(s.id)}" value="${esc(texto)}" placeholder="0" title="Puede escribir una operación: 10*2+22*2+7"><small class="ap-eval" data-eval="${esc(s.id)}">${c?.expresion && /[+\-*/()x]/i.test(c.expresion) ? `= ${numero(it.cantidades[s.id], 3)}` : ""}</small></td>`; }).join("")}
    <td class="ap-num" data-c="vu">${pesos(it.vu)}</td>
    <td class="ap-num" data-c="total">${pesos(it.total)}</td>
    <td class="ap-celda-acciones"><a class="rt-icono-btn" href="apu-formato.html?p=${encodeURIComponent(id)}&i=${encodeURIComponent(it.id)}" title="Ver el APU en formato Cinco">🖨</a><button type="button" class="rt-icono-btn" data-mover="-1" title="Subir">↑</button><button type="button" class="rt-icono-btn" data-quitar title="Quitar ítem">✕</button></td>
  </tr>`;
}
// Recalcula y actualiza solo los números (sin repintar los campos, para no perder el foco).
function actualizarNumeros() {
  calcular();
  calc.capitulos.forEach((cap, ci) => {
    const sub = document.querySelector(`[data-capsub="${ci}"]`);
    if (sub) sub.textContent = pesos(cap.subtotal);
    cap.items.forEach((it, ii) => {
      const tr = document.querySelector(`tr[data-cap="${ci}"][data-item="${ii}"]`);
      if (!tr) return;
      tr.querySelector('[data-c="total"]').textContent = pesos(it.total);
      tr.querySelector('[data-c="vu"]').textContent = pesos(it.vu);
      for (const s of calc.sitios) {
        const ev = tr.querySelector(`[data-eval="${s.id}"]`);
        const c = it.cantidadesOrig?.[s.id];
        if (ev) ev.textContent = c?.expresion && /[+\-*/()x]/i.test(c.expresion) ? (evaluarCantidad(c.expresion) == null ? "no válida" : `= ${numero(it.cantidades[s.id], 3)}`) : "";
      }
    });
  });
  pintarResumen();
  pintarAvisos();
}
function pintarAvisos() {
  const el = $("avisos");
  el.classList.toggle("hidden", !calc.avisos.length);
  el.textContent = calc.avisos.slice(0, 8).join(" · ") + (calc.avisos.length > 8 ? ` · y ${calc.avisos.length - 8} más` : "");
}

// ---------------------------------------------------------------- parámetros
function pintarParametros() {
  const p = proyecto;
  const v = (id, x) => { $(id).value = x ?? ""; };
  v("pCodigo", p.codigo); v("pNombre", p.nombre); v("pTipo", p.tipo || "obra"); v("pCliente", p.cliente); v("pUbicacion", p.ubicacion); v("pDescripcion", p.descripcion);
  const pct = (x) => numero((x ?? 0) * 100, 4);
  v("pA", pct(p.aiu?.a)); v("pI", pct(p.aiu?.i)); v("pU", pct(p.aiu?.u)); v("pIva", pct(p.iva ?? 0.19));
  v("pRegimen", p.regimenIva || "utilidad"); v("pRedondeo", p.redondeo || "arriba");
  $("pAnio").innerHTML = parametros.map((x) => `<option value="${x.anio}">${x.anio}</option>`).join("");
  v("pAnio", String(p.anioParametros || parametrosVigentes(parametros)?.anio || ""));
  v("pFactor", numero(p.factorMateriales || 1, 4)); v("pJustif", p.justificacionFactor);
  pintarSugerencia();
  pintarSitios();
}
function pintarSugerencia() {
  const v1 = variacionIPP(ipp?.puntos, 1), v3 = variacionIPP(ipp?.puntos, 3);
  if (!v1) { $("sugerencia").innerHTML = '<p class="text-muted ap-nota">Sin datos suficientes del IPP para sugerir un factor.</p>'; return; }
  const anios = Number($("sugerencia").dataset.anios || 1);
  const f1 = factorProyeccion(v1.tasaAnual, anios), f3 = v3 ? factorProyeccion(v3.tasaAnual, anios) : null;
  $("sugerencia").innerHTML = `<div class="ap-fila-form">
      <label>Años hasta la construcción <input id="sAnios" inputmode="decimal" value="${numero(anios, 2)}"></label>
      <button type="button" class="btn secondary ap-btn" data-usar="${f1}">Usar ${numero(f1, 4)} (IPP último año ${numero(v1.tasaAnual * 100, 2)} %)</button>
      ${f3 ? `<button type="button" class="btn secondary ap-btn" data-usar="${f3}">Usar ${numero(f3, 4)} (IPP promedio 3 años ${numero(v3.tasaAnual * 100, 2)} %)</button>` : ""}
    </div><p class="text-muted ap-nota">IPP hasta ${fechaCorta(v1.hasta)}. Factor = (1 + variación anual) elevado a los años.</p>`;
}
function pintarSitios() {
  $("sitios").innerHTML = `<table class="ap-tabla ap-tabla-edit"><thead><tr><th>Sitio</th><th class="ap-num">Total</th><th></th></tr></thead><tbody>${(proyecto.sitios || []).map((s, k) => `<tr>
    <td><input data-sitionombre="${k}" value="${esc(s.nombre)}"></td><td class="ap-num">${pesos(calc?.porSitio?.[s.id]?.total)}</td>
    <td class="ap-celda-acciones">${(proyecto.sitios || []).length > 1 ? `<button type="button" class="rt-icono-btn" data-sitioquitar="${k}" title="Quitar sitio">✕</button>` : ""}</td></tr>`).join("")}</tbody></table>`;
}
function leerParametros() {
  const p = proyecto;
  const pct = (id, def) => { const x = leerNumero($(id).value); return (x == null ? def : x) / 100; };
  Object.assign(p, {
    codigo: $("pCodigo").value.trim().toUpperCase() || p.codigo, nombre: $("pNombre").value.trim() || p.nombre, tipo: $("pTipo").value,
    cliente: $("pCliente").value.trim(), ubicacion: $("pUbicacion").value.trim(), descripcion: $("pDescripcion").value.trim(),
    aiu: { a: pct("pA", 15), i: pct("pI", 5), u: pct("pU", 5) }, iva: pct("pIva", 19), regimenIva: $("pRegimen").value,
    anioParametros: Number($("pAnio").value) || p.anioParametros, redondeo: $("pRedondeo").value,
    factorMateriales: leerNumero($("pFactor").value) || 1, justificacionFactor: $("pJustif").value.trim()
  });
}

// ---------------------------------------------------------------- precios
function pintarPrecios() {
  const usados = preciosUsados(proyecto, base);
  const cong = proyecto.precios || null;
  $("estadoPrecios").innerHTML = cong
    ? `<p><span class="badge ok">Congelados</span> El presupuesto usa los precios guardados el <strong>${fechaCorta(proyecto.fechaPrecios)}</strong> (${Object.keys(cong).length} insumos). Si cambian los precios de la base, el presupuesto no se mueve.</p>`
    : `<p><span class="badge warn">Vigentes</span> El presupuesto usa los precios actuales de la base de insumos (${Object.keys(usados).length} insumos). Congélalos al entregar el presupuesto para que no cambie.</p>`;
  $("congelar").textContent = cong ? "🔒 Volver a congelar con los precios de hoy" : "🔒 Congelar precios ahora";
  $("liberar").classList.toggle("hidden", !cong);
  if (!cong) { $("comparacion").innerHTML = ""; return; }
  const p = parametrosProyecto();
  const unit = (x) => (!x ? null : x.tipo === "MO" ? jornalMO(x.factorSalarial, p)?.total : x.tipo === "MA" ? x.precio : x.base === "unidad" ? x.precio : valorMensual(x));
  const filas = Object.values(cong).map((c) => { const v = base.get(c.codigo); const a = unit(c), b = unit(v); return { c, a, b, d: a && b ? b / a - 1 : null }; }).filter((f) => f.d && Math.abs(f.d) > 0.0001).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  $("comparacion").innerHTML = filas.length ? `<h3 class="ap-subtitulo">Insumos cuyo precio vigente cambió desde el congelamiento (${filas.length})</h3>
    <table class="ap-tabla ap-tabla-mini"><thead><tr><th>Código</th><th>Descripción</th><th class="ap-num">Congelado</th><th class="ap-num">Vigente</th><th class="ap-num">Cambio</th></tr></thead><tbody>${filas.slice(0, 60).map((f) => `<tr><td>${esc(f.c.codigo)}</td><td title="${esc(f.c.descripcion)}">${esc(f.c.descripcion)}</td><td class="ap-num">${pesos(f.a)}</td><td class="ap-num">${pesos(f.b)}</td><td class="ap-num">${f.d > 0 ? "+" : ""}${numero(f.d * 100, 1)} %</td></tr>`).join("")}</tbody></table>`
    : '<p class="text-muted ap-nota">Ningún precio de la base ha cambiado desde el congelamiento.</p>';
}

// ---------------------------------------------------------------- versiones
async function pintarVersiones() {
  try {
    const vers = await listarVersionesProyecto(id);
    $("versiones").innerHTML = vers.length ? `<table class="ap-tabla ap-tabla-mini"><thead><tr><th>Versión</th><th>Fecha</th><th>Autor</th><th>Nota</th><th class="ap-num">Valor total</th></tr></thead><tbody>${vers.map((v) => `<tr><td>v${v.numero}</td><td>${fechaCorta(v.creadoEn)}</td><td>${esc(v.creadoPor || "—")}</td><td title="${esc(v.nota || "")}">${esc(v.nota || "—")}</td><td class="ap-num">${pesos(v.resumen?.total)}</td></tr>`).join("")}</tbody></table>` : '<p class="text-muted ap-nota">Todavía no hay versiones entregadas.</p>';
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
}

// ---------------------------------------------------------------- guardar
function resumen() { calcular(); return { items: calc.items, costoDirecto: calc.costoDirecto, total: calc.total, porSitio: Object.fromEntries(calc.sitios.map((s) => [s.nombre, calc.porSitio[s.id].total])) }; }
async function guardar() {
  limpiarAlerta(alerta);
  leerParametros();
  const btn = $("guardarBtn");
  btn.disabled = true;
  try {
    proyecto.resumen = resumen();
    await guardarProyecto(id, proyecto, ctx.user);
    marcarSucio(false);
    $("titulo").textContent = `${proyecto.codigo} — ${proyecto.nombre}`;
    mostrarAlerta(alerta, "Presupuesto guardado.", "success");
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); } finally { btn.disabled = false; }
}

// ---------------------------------------------------------------- eventos
function itemDe(el) {
  const tr = el.closest("tr[data-item]");
  return tr ? { ci: Number(tr.dataset.cap), ii: Number(tr.dataset.item) } : null;
}
function agregarItem(ci, texto) {
  const codigo = (String(texto).match(/^\s*(APU-[\w.-]+)/i)?.[1] || "").toUpperCase();
  const a = biblioteca.get(codigo);
  if (!a) { mostrarAlerta(alerta, `No se encontró el APU «${texto}» en la biblioteca.`); return false; }
  const cantidades = Object.fromEntries((proyecto.sitios || []).map((s) => [s.id, { valor: 0 }]));
  proyecto.capitulos[ci].items.push({ id: nuevoId(), apu: copiaApu(a), cantidades });
  marcarSucio();
  pintarPresupuesto();
  const filas = document.querySelectorAll(`tr[data-cap="${ci}"][data-item]`);
  filas[filas.length - 1]?.querySelector(".ap-in-cant")?.focus();
  return true;
}
function conectar() {
  window.addEventListener("hashchange", mostrarSeccion);
  window.addEventListener("beforeunload", (e) => { if (sucio) { e.preventDefault(); e.returnValue = ""; } });
  $("guardarBtn").addEventListener("click", guardar);
  $("exportarBtn").addEventListener("click", () => {
    leerParametros();
    const { id: _, creadoEn, actualizadoEn, ...p } = proyecto;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ formato: "apupro-proyecto", version: 1, exportado: new Date().toISOString(), proyecto: p })], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${proyecto.codigo} - ${proyecto.nombre.slice(0, 60).replace(/[\/:*?"<>|]/g, "")}.apupro.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); guardar(); } });
  $("formatoBtn").addEventListener("click", (e) => { if (sucio && !confirm("Hay cambios sin guardar. El formato muestra lo último guardado. ¿Abrirlo de todos modos?")) e.preventDefault(); });
  const caps = $("capitulos");
  caps.addEventListener("input", (e) => {
    if (e.target.classList.contains("ap-in-cant")) {
      const k = itemDe(e.target);
      const it = proyecto.capitulos[k.ci].items[k.ii];
      const texto = e.target.value.trim();
      const sitio = e.target.dataset.sitio;
      it.cantidades = it.cantidades || {};
      it.cantidades[sitio] = !texto ? { valor: 0 } : /[+*/()x]|\d\s*-/i.test(texto) ? { expresion: texto, valor: evaluarCantidad(texto) ?? 0 } : { valor: evaluarCantidad(texto) ?? 0 };
      marcarSucio();
      actualizarNumeros();
    }
    if (e.target.classList.contains("ap-in-capnombre")) {
      proyecto.capitulos[Number(e.target.closest("[data-cap]").dataset.cap)].nombre = e.target.value;
      marcarSucio();
    }
  });
  caps.addEventListener("change", (e) => {
    if (e.target.classList.contains("ap-in-nuevo") && e.target.value.trim()) {
      if (!agregarItem(Number(e.target.dataset.nuevo), e.target.value)) e.target.select();
    }
  });
  caps.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("ap-in-nuevo")) { e.preventDefault(); e.target.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  caps.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const sec = b.closest("[data-cap]");
    const ci = Number(sec?.dataset.cap);
    const k = itemDe(b);
    if (b.hasAttribute("data-quitar") && k) {
      const it = proyecto.capitulos[k.ci].items[k.ii];
      if (!confirm(`¿Quitar el ítem ${it.apu.codigo} — ${it.apu.nombre}?`)) return;
      proyecto.capitulos[k.ci].items.splice(k.ii, 1);
    } else if (b.hasAttribute("data-mover") && k) {
      const items = proyecto.capitulos[k.ci].items, j = k.ii + Number(b.dataset.mover);
      if (j < 0 || j >= items.length) return;
      [items[k.ii], items[j]] = [items[j], items[k.ii]];
    } else if (b.hasAttribute("data-actualizar") && k) {
      const it = proyecto.capitulos[k.ci].items[k.ii];
      const lib = biblioteca.get(it.apu.codigo);
      if (!confirm(`¿Actualizar ${it.apu.codigo} de la versión ${it.apu.version || 1} a la ${lib.version} de la biblioteca?`)) return;
      it.apu = copiaApu(lib);
    } else if (b.hasAttribute("data-capquitar")) {
      const cap = proyecto.capitulos[ci];
      if (cap.items.length && !confirm(`El capítulo «${cap.nombre}» tiene ${cap.items.length} ítems. ¿Quitarlo con sus ítems?`)) return;
      proyecto.capitulos.splice(ci, 1);
    } else if (b.hasAttribute("data-capmover")) {
      const j = ci + Number(b.dataset.capmover), cs = proyecto.capitulos;
      if (j < 0 || j >= cs.length) return;
      [cs[ci], cs[j]] = [cs[j], cs[ci]];
    } else return;
    marcarSucio();
    pintarPresupuesto();
  });
  $("agregarCap").addEventListener("click", () => {
    const nombre = prompt("Nombre del capítulo:", "Nuevo capítulo");
    if (!nombre) return;
    proyecto.capitulos.push({ id: nuevoId(), nombre: nombre.trim(), items: [] });
    marcarSucio();
    pintarPresupuesto();
  });
  // Parámetros: cualquier cambio recalcula
  ["datosForm", "aiuForm", "factorForm"].forEach((f) => {
    $(f).addEventListener("input", () => { leerParametros(); marcarSucio(); actualizarNumeros(); });
    $(f).addEventListener("change", () => { leerParametros(); marcarSucio(); pintarPresupuesto(); });
  });
  $("sugerencia").addEventListener("input", (e) => { if (e.target.id === "sAnios") { $("sugerencia").dataset.anios = String(leerNumero(e.target.value) || 1); const pos = e.target.selectionStart; pintarSugerencia(); const n = $("sAnios"); n.focus(); n.setSelectionRange(pos, pos); } });
  $("sugerencia").addEventListener("click", (e) => {
    const b = e.target.closest("[data-usar]");
    if (!b) return;
    $("pFactor").value = numero(Number(b.dataset.usar), 4);
    if (!$("pJustif").value) $("pJustif").value = `Proyección con IPP a ${numero(Number($("sugerencia").dataset.anios || 1), 2)} años (${b.textContent.replace(/^Usar [\d.,]+ /, "").replace(/[()]/g, "")})`;
    leerParametros(); marcarSucio(); pintarPresupuesto();
  });
  $("sitios").addEventListener("input", (e) => {
    const k = e.target.dataset.sitionombre;
    if (k == null) return;
    proyecto.sitios[Number(k)].nombre = e.target.value;
    marcarSucio();
  });
  $("sitios").addEventListener("change", () => pintarPresupuesto());
  $("sitios").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sitioquitar]");
    if (!b) return;
    const s = proyecto.sitios[Number(b.dataset.sitioquitar)];
    if (!confirm(`¿Quitar el sitio «${s.nombre}» y sus cantidades?`)) return;
    proyecto.sitios.splice(Number(b.dataset.sitioquitar), 1);
    marcarSucio(); pintarPresupuesto(); pintarSitios();
  });
  $("agregarSitio").addEventListener("click", () => {
    const nombre = prompt("Nombre del sitio:", `Sitio ${(proyecto.sitios || []).length + 1}`);
    if (!nombre) return;
    proyecto.sitios.push({ id: nuevoId(), nombre: nombre.trim() });
    marcarSucio(); pintarPresupuesto(); pintarSitios();
  });
  $("congelar").addEventListener("click", () => {
    proyecto.precios = preciosUsados(proyecto, base);
    proyecto.fechaPrecios = hoyISO();
    marcarSucio(); pintarPresupuesto(); pintarPrecios();
    mostrarAlerta(alerta, `Se congelaron ${Object.keys(proyecto.precios).length} precios con fecha de hoy. Guarda el presupuesto para conservarlos.`, "info");
  });
  $("liberar").addEventListener("click", () => {
    if (!confirm("¿Volver a los precios vigentes de la base? El presupuesto cambiará si los precios han cambiado.")) return;
    proyecto.precios = null; proyecto.fechaPrecios = null;
    marcarSucio(); pintarPresupuesto(); pintarPrecios();
  });
  $("guardarVersion").addEventListener("click", async () => {
    if (sucio && !confirm("Hay cambios sin guardar; primero se guardará el presupuesto. ¿Continuar?")) return;
    try {
      if (sucio) await guardar();
      const n = await guardarVersionProyecto(id, proyecto, resumen(), ctx.user, $("vNota").value.trim());
      $("vNota").value = "";
      mostrarAlerta(alerta, `Versión ${n} guardada.`, "success");
      pintarVersiones();
    } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });
}
