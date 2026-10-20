// Editor de un APU: datos generales, las líneas de los cinco capítulos con búsqueda de
// insumos de la base, cálculo en vivo, guardado como nueva versión y versiones anteriores.
//   apu.html            → nuevo APU
//   apu.html?c=APU-286  → editar
//   apu.html?copiar=X   → nuevo APU a partir de una copia de X
import { iniciarPagina, leerApu, guardarApu, listarVersionesApu, listarApus, listarInsumos, listarParametros, parametrosVigentes, esc, pesos, numero, fechaCorta, leerNumero, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { TIPOS, ORDEN_TIPOS } from "./ap-calculos.js";
import { CAPITULOS, calcularApu, precioConAiu, validarApu } from "./ap-apu.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");
const q = new URLSearchParams(location.search);
const codigoEditar = q.get("c"), codigoCopiar = q.get("copiar");
let insumos = new Map(), parametros = [], todos = [], apu = null, editando = false;
let lineas = { MA: [], MO: [], EH: [], ED: [], TV: [] };
// Dotación básica de una cuadrilla (las 10 prendas que repiten los APU de Cinco).
const DOTACION_BASICA = ["ED-1", "ED-2", "ED-3", "ED-4", "ED-5", "ED-6", "ED-7", "ED-8", "ED-9", "ED-10"];

if (ctx) await iniciar();

async function iniciar() {
  try {
    const [ins, par, lista] = await Promise.all([listarInsumos(), listarParametros(), listarApus()]);
    insumos = new Map(ins.map((x) => [x.codigo, x])); parametros = par; todos = lista;
    pintarMenu(ctx, { activo: "apus", apus: lista.length, conteos: Object.fromEntries(ORDEN_TIPOS.map((t) => [t, ins.filter((x) => x.tipo === t).length])) });
    // Una lista de sugerencias por tipo de insumo («código — descripción»).
    $("datalists").innerHTML = ORDEN_TIPOS.map((t) => `<datalist id="dl-${t}">${ins.filter((x) => x.tipo === t).sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true })).map((x) => `<option value="${esc(`${x.codigo} — ${x.descripcion}`)}"></option>`).join("")}</datalist>`).join("");
    $("dlCategorias").innerHTML = [...new Set(lista.map((a) => a.categoria).filter(Boolean))].sort().map((c) => `<option value="${esc(c)}"></option>`).join("");
    $("aAnio").innerHTML = par.map((p) => `<option value="${p.anio}">${p.anio}</option>`).join("");
    const vig = parametrosVigentes(par);
    if (vig) $("aAnio").value = String(vig.anio);

    const base = codigoEditar || codigoCopiar;
    if (base) {
      apu = await leerApu(base);
      if (!apu) throw new Error(`No existe el APU ${base}.`);
    }
    editando = !!codigoEditar;
    cargarEnFormulario(apu, { copia: !!codigoCopiar });
    if (editando) pintarVersiones();
  } catch (err) {
    if (!document.querySelector("#sidebar nav")) pintarMenu(ctx, { activo: "apus" });
    mostrarAlerta(alerta, errorAmigable(err));
  }
  conectar();
}

function siguienteCodigoApu() {
  const max = Math.max(0, ...todos.map((a) => Number(String(a.codigo).match(/^APU-(\d+)$/)?.[1]) || 0));
  return `APU-${max + 1}`;
}

function cargarEnFormulario(a, { copia = false } = {}) {
  $("titulo").textContent = editando ? `${a.codigo} — ${a.nombre}` : copia ? `Nuevo APU (copia de ${a.codigo})` : "Nuevo APU";
  $("aCodigo").value = editando ? a.codigo : siguienteCodigoApu();
  $("aCodigo").disabled = editando;
  $("aNombre").value = a?.nombre ? (copia ? `${a.nombre} (copia)` : a.nombre) : "";
  $("aUnidad").value = a?.unidad || "";
  $("aRend").value = a?.rendimiento != null ? String(a.rendimiento).replace(".", ",") : "";
  $("aCategoria").value = a?.categoria || "";
  $("aNotas").value = a?.notas || "";
  lineas = Object.fromEntries(ORDEN_TIPOS.map((t) => [t, (a?.lineas?.[t] || []).map((l) => ({ ...l }))]));
  if (editando) { $("volver").href = `apus.html#${encodeURIComponent(a.codigo)}`; }
  pintarCapitulos();
}

// ---------------------------------------------------------------- capítulos
function pintarCapitulos() {
  $("capitulos").innerHTML = CAPITULOS.map(({ tipo, letra, nombre }) => `
    <section class="card ap-cap-edit" data-tipo="${tipo}">
      <div class="ap-cap-edit-cabeza">
        <h2>${letra}. ${esc(nombre)} <span class="ap-subtotal" data-subtotal="${tipo}"></span></h2>
        <div class="rt-acciones">
          ${tipo === "ED" ? '<button type="button" class="btn secondary ap-btn" data-dotacion>＋ Dotación básica por cuadrilla</button>' : ""}
          <button type="button" class="btn secondary ap-btn" data-agregar="${tipo}">＋ Agregar ${esc(TIPOS[tipo].singular.toLowerCase())}</button>
        </div>
      </div>
      ${lineas[tipo].length ? `<table class="ap-tabla ap-tabla-lineas">
        <colgroup>${(tipo === "MA" ? [44, 11, 9, 7, 13, 12, 4] : tipo === "ED" ? [44, 13, 11, 7, 13, 8, 4] : [44, 11, 9, 7, 14, 11, 4]).map((x) => `<col data-ancho="${x}">`).join("")}</colgroup>
        <thead><tr><th>Insumo</th><th class="ap-num">${tipo === "ED" ? "Personas" : "Cantidad"}</th><th class="ap-num">${tipo === "MA" ? "Desp. %" : tipo === "ED" ? "Cantidad" : ""}</th><th>Und</th><th class="ap-num">${tipo === "MO" ? "Jornal + prest." : tipo === "MA" ? "Vr. unitario" : "Vr. mensual"}</th><th class="ap-num">Vr. total</th><th></th></tr></thead>
        <tbody>${lineas[tipo].map((l, i) => filaHtml(tipo, l, i)).join("")}</tbody></table>`
        : '<p class="text-muted ap-nota">Sin líneas en este capítulo.</p>'}
    </section>`).join("");
  document.querySelectorAll("#capitulos col[data-ancho]").forEach((c) => { c.style.width = `${c.dataset.ancho}%`; });
  recalcular();
}
function textoInsumo(codigo) {
  const x = insumos.get(codigo);
  return codigo ? (x ? `${codigo} — ${x.descripcion}` : codigo) : "";
}
function filaHtml(tipo, l, i) {
  const ed = tipo === "ED";
  return `<tr data-tipo="${tipo}" data-i="${i}">
    <td><input class="ap-in-insumo" list="dl-${tipo}" value="${esc(textoInsumo(l.codigo))}" placeholder="Escribe el código o parte de la descripción"></td>
    <td class="ap-num">${ed ? `<select class="ap-in-modo"><option value="cuadrilla"${l.modo !== "fija" ? " selected" : ""}>Cuadrilla</option><option value="fija"${l.modo === "fija" ? " selected" : ""}>Fija</option></select>` : `<input class="ap-in-cant ap-num" inputmode="decimal" value="${esc(l.cantidad != null ? String(l.cantidad).replace(".", ",") : "")}">`}</td>
    <td class="ap-num">${tipo === "MA" ? `<input class="ap-in-desp ap-num" inputmode="decimal" value="${l.desperdicio ? esc(String(l.desperdicio * 100).replace(".", ",")) : ""}" placeholder="0">` : ed ? `<input class="ap-in-cant ap-num" inputmode="decimal" value="${l.modo === "fija" && l.cantidad != null ? esc(String(l.cantidad).replace(".", ",")) : ""}"${l.modo === "fija" ? "" : " disabled"}>` : ""}</td>
    <td data-c="unidad"></td><td class="ap-num" data-c="unitario"></td><td class="ap-num" data-c="total"></td>
    <td><button type="button" class="rt-icono-btn ap-quitar" title="Quitar línea">✕</button></td>
  </tr>`;
}

function parametrosAnio() { return parametros.find((p) => String(p.anio) === $("aAnio").value) || parametrosVigentes(parametros); }
function apuDelFormulario() {
  return {
    codigo: $("aCodigo").value.trim().toUpperCase(), nombre: $("aNombre").value.trim(), unidad: $("aUnidad").value.trim(),
    rendimiento: leerNumero($("aRend").value), categoria: $("aCategoria").value.trim(), notas: $("aNotas").value.trim(),
    lineas: Object.fromEntries(ORDEN_TIPOS.map((t) => [t, lineas[t].map((l) => {
      const o = { codigo: l.codigo || "" };
      if (t === "ED") { o.modo = l.modo === "fija" ? "fija" : "cuadrilla"; if (o.modo === "fija") o.cantidad = l.cantidad ?? null; }
      else o.cantidad = l.cantidad ?? null;
      if (t === "MA" && l.desperdicio) o.desperdicio = l.desperdicio;
      return o;
    })]))
  };
}

function recalcular() {
  const datos = apuDelFormulario();
  const r = calcularApu(datos, { insumo: (c) => insumos.get(c) || null, parametros: parametrosAnio() });
  for (const { tipo } of CAPITULOS) {
    const sub = document.querySelector(`[data-subtotal="${tipo}"]`);
    if (sub) sub.textContent = r.subtotales[tipo] ? pesos(r.subtotales[tipo]) : "";
    r.capitulos[tipo].forEach((f, i) => {
      const tr = document.querySelector(`tr[data-tipo="${tipo}"][data-i="${i}"]`);
      if (!tr) return;
      tr.querySelector('[data-c="unidad"]').textContent = f.unidad || "";
      tr.querySelector('[data-c="unitario"]').textContent = f.unitario == null ? "—" : pesos(f.unitario, f.unitario < 100 ? 2 : 0);
      tr.querySelector('[data-c="total"]').textContent = pesos(f.total);
      if (tipo === "ED" && lineas.ED[i]?.modo !== "fija") tr.querySelector(".ap-in-cant").placeholder = numero(r.personas, 2);
      tr.classList.toggle("ap-fila-falta", !!lineas[tipo][i]?.codigo && f.falta);
    });
  }
  const ref = precioConAiu(r.costoDirecto);
  const p = parametrosAnio();
  const avisos = [...new Set(r.avisos.filter((x) => !/^: /.test(x)))];
  $("resumen").innerHTML = `<div class="ap-pares ap-pares-apu">
      <div><span>Costo directo</span><strong class="ap-grande">${pesos(r.costoDirecto)}</strong></div>
      ${CAPITULOS.map(({ tipo, letra }) => `<div><span>${letra}. ${esc(TIPOS[tipo].nombre)}</span><strong>${pesos(r.subtotales[tipo])}</strong></div>`).join("")}
      <div><span>Cuadrilla</span><strong>${numero(r.personas, 2)} personas</strong></div>
      <div><span>Con AIU 15/5/5 e IVA sobre la utilidad</span><strong>${pesos(ref.total)}</strong></div>
      <div><span>Parámetros</span><strong>${p ? `${p.anio} · ${p.diasHabiles} días hábiles` : "sin registrar"}</strong></div>
    </div>${avisos.length ? `<p class="alert error ap-obs">${esc(avisos.slice(0, 6).join(" · "))}</p>` : ""}`;
}

// ---------------------------------------------------------------- versiones
async function pintarVersiones() {
  try {
    const vers = await listarVersionesApu(apu.codigo);
    $("versionesCard").classList.toggle("hidden", !vers.length);
    $("versiones").innerHTML = `<table class="ap-tabla ap-tabla-mini"><thead><tr><th>Versión</th><th>Fecha</th><th>Autor</th><th>Nota</th><th class="ap-num">Rend.</th><th></th></tr></thead><tbody>${vers.map((v) => `<tr>
      <td>v${v.version}${v.version === apu.version ? ' <span class="badge ok">vigente</span>' : ""}</td><td>${fechaCorta(v.creadoEn)}</td><td>${esc(v.creadoPor || "—")}</td><td title="${esc(v.nota || "")}">${esc(v.nota || "—")}</td><td class="ap-num">${numero(v.rendimiento, 3)}</td>
      <td class="ap-celda-acciones">${v.version !== apu.version ? `<button type="button" class="btn secondary ap-btn" data-cargar="${esc(v.id)}">Cargar</button>` : ""}</td></tr>`).join("")}</tbody></table>`;
    $("versiones").querySelectorAll("[data-cargar]").forEach((b) => b.addEventListener("click", () => {
      const v = vers.find((x) => x.id === b.dataset.cargar);
      cargarEnFormulario({ ...apu, ...v, codigo: apu.codigo });
      $("aNota").value = `Restaura la versión ${v.version}`;
      mostrarAlerta(alerta, `Se cargó la versión ${v.version}. Revisa y pulsa «Guardar APU» para dejarla vigente.`, "info");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
}

// ---------------------------------------------------------------- eventos
function conectar() {
  const cap = $("capitulos");
  cap.addEventListener("input", (e) => {
    const tr = e.target.closest("tr[data-tipo]");
    if (!tr) return;
    const l = lineas[tr.dataset.tipo][Number(tr.dataset.i)];
    if (e.target.classList.contains("ap-in-insumo")) l.codigo = (e.target.value.match(/^\s*([A-Z]{1,3}-\d+)/i)?.[1] || "").toUpperCase();
    if (e.target.classList.contains("ap-in-cant")) l.cantidad = leerNumero(e.target.value);
    if (e.target.classList.contains("ap-in-desp")) { const d = leerNumero(e.target.value); l.desperdicio = d ? d / 100 : 0; }
    recalcular();
  });
  cap.addEventListener("change", (e) => {
    const tr = e.target.closest("tr[data-tipo]");
    if (!tr) return;
    const l = lineas[tr.dataset.tipo][Number(tr.dataset.i)];
    if (e.target.classList.contains("ap-in-insumo") && l.codigo) e.target.value = textoInsumo(l.codigo);
    if (e.target.classList.contains("ap-in-modo")) {
      l.modo = e.target.value;
      const cant = tr.querySelector(".ap-in-cant");
      cant.disabled = l.modo !== "fija";
      if (l.modo !== "fija") { cant.value = ""; delete l.cantidad; }
      recalcular();
    }
  });
  cap.addEventListener("click", (e) => {
    const agregar = e.target.closest("[data-agregar]");
    if (agregar) {
      const t = agregar.dataset.agregar;
      lineas[t].push(t === "ED" ? { codigo: "", modo: "cuadrilla" } : { codigo: "", cantidad: t === "MA" ? null : 1 });
      pintarCapitulos();
      const filas = document.querySelectorAll(`tr[data-tipo="${t}"]`);
      filas[filas.length - 1]?.querySelector(".ap-in-insumo")?.focus();
      return;
    }
    if (e.target.closest("[data-dotacion]")) {
      const ya = new Set(lineas.ED.map((l) => l.codigo));
      DOTACION_BASICA.filter((c) => insumos.has(c) && !ya.has(c)).forEach((c) => lineas.ED.push({ codigo: c, modo: "cuadrilla" }));
      pintarCapitulos();
      return;
    }
    const quitar = e.target.closest(".ap-quitar");
    if (quitar) {
      const tr = quitar.closest("tr[data-tipo]");
      lineas[tr.dataset.tipo].splice(Number(tr.dataset.i), 1);
      pintarCapitulos();
    }
  });
  ["aRend", "aAnio"].forEach((id) => $(id).addEventListener(id === "aAnio" ? "change" : "input", recalcular));
  $("guardar").addEventListener("click", guardar);
}

async function guardar() {
  limpiarAlerta(alerta);
  const datos = apuDelFormulario();
  // Las líneas vacías (sin insumo) se descartan al guardar.
  for (const t of ORDEN_TIPOS) datos.lineas[t] = datos.lineas[t].filter((l) => l.codigo);
  const errores = validarApu(datos);
  const desconocidos = ORDEN_TIPOS.flatMap((t) => datos.lineas[t].filter((l) => !insumos.has(l.codigo)).map((l) => l.codigo));
  if (desconocidos.length) errores.push(`Estos códigos no están en la base de insumos: ${[...new Set(desconocidos)].join(", ")}.`);
  if (errores.length) { mostrarAlerta(alerta, errores.join(" ")); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  if (editando) Object.assign(datos, { origen: apu.origen, fechaOrigen: apu.fechaOrigen, valorOrigen: apu.valorOrigen, observacionesOrigen: apu.observacionesOrigen, codigosAnteriores: apu.codigosAnteriores, factorMaterialesOrigen: apu.factorMaterialesOrigen, redondeoOrigen: apu.redondeoOrigen });
  else if (codigoCopiar) Object.assign(datos, { codigosAnteriores: [], origen: `Copia de ${codigoCopiar}` });
  const btn = $("guardar");
  btn.disabled = true;
  try {
    const version = await guardarApu(datos, ctx.user, { nuevo: !editando, nota: $("aNota").value.trim() || (editando ? "" : codigoCopiar ? `Creado a partir de ${codigoCopiar}` : "Creado en APU PRO") });
    location.href = `apus.html#${encodeURIComponent(datos.codigo)}`;
    if (editando) mostrarAlerta(alerta, `${datos.codigo} guardado (versión ${version}).`, "success");
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); window.scrollTo({ top: 0, behavior: "smooth" }); } finally { btn.disabled = false; }
}
