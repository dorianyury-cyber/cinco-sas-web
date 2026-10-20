// Parámetros de APU PRO: salario mínimo, auxilio de transporte, % prestacional y días
// hábiles por año; serie del IPP y tasas de cambio.
import { iniciarPagina, listarParametros, guardarParametros, eliminarParametros, leerSerie, guardarSerie, listarInsumos, esc, pesos, numero, fechaCorta, leerNumero, mostrarAlerta, limpiarAlerta, errorAmigable, hoyISO } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { ORDEN_TIPOS, jornalMO, variacionIPP } from "./ap-calculos.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");
let parametros = [], ipp = { puntos: [] }, monedas = [];

if (ctx) {
  try {
    const [p, s, m, ins] = await Promise.all([listarParametros(), leerSerie("ipp"), leerSerie("monedas"), listarInsumos()]);
    parametros = p; ipp = s || { puntos: [] }; monedas = m?.lista || [];
    pintarMenu(ctx, { activo: "parametros", conteos: Object.fromEntries(ORDEN_TIPOS.map((t) => [t, ins.filter((x) => x.tipo === t).length])) });
  } catch (err) {
    pintarMenu(ctx, { activo: "parametros" });
    mostrarAlerta(alerta, errorAmigable(err));
  }
  pintarParametros(); pintarIpp(); pintarMonedas(); conectar();
}

// ---------------------------------------------------------------- parámetros por año
function pintarParametros() {
  const el = $("tablaParametros");
  const anio = new Date().getFullYear();
  const aviso = parametros.some((p) => p.anio === anio) ? "" : `<p class="alert error">Falta registrar los parámetros de ${anio} (salario mínimo y auxilio de transporte del año).</p>`;
  if (!parametros.length) { el.innerHTML = `${aviso}<p class="text-muted">Sin parámetros registrados.</p>`; return; }
  el.innerHTML = `${aviso}<table class="ap-tabla">
    <thead><tr><th>Año</th><th class="ap-num">Salario mínimo</th><th class="ap-num">Aux. transporte</th><th class="ap-num">Prestaciones</th><th class="ap-num">Días hábiles</th><th class="ap-num">Jornal factor 1</th><th class="ap-num">Jornal factor 2</th><th class="ap-num">Jornal factor 4</th><th>Fuente</th><th></th></tr></thead>
    <tbody>${parametros.map((p) => `<tr>
      <td><strong>${p.anio}</strong></td><td class="ap-num">${pesos(p.smmlv)}</td><td class="ap-num">${pesos(p.auxTransporte)}</td><td class="ap-num">${numero(p.prestacional * 100, 1)} %</td><td class="ap-num">${p.diasHabiles}</td>
      ${[1, 2, 4].map((f) => `<td class="ap-num">${pesos(jornalMO(f, p)?.total)}</td>`).join("")}
      <td class="ap-celda-corta" title="${esc(p.fuente || "")}">${esc(p.fuente || "—")}</td>
      <td class="ap-celda-acciones"><button type="button" class="rt-icono-btn" data-editar="${p.anio}" title="Editar">✎</button>${ctx.esAdmin ? `<button type="button" class="rt-icono-btn" data-borrar="${p.anio}" title="Eliminar">🗑</button>` : ""}</td>
    </tr>`).join("")}</tbody></table>
    <p class="text-muted ap-nota">Jornal por día con prestaciones. Factor 1: ayudante; 2: técnico u oficial; 4: ingeniero residente.</p>`;
}
function abrirAnio(p = null) {
  limpiarAlerta($("anioDlgAlerta"));
  const base = p || parametros[0] || { prestacional: 0.6, diasHabiles: 21 };
  $("anioDlgTitulo").textContent = p ? `Parámetros de ${p.anio}` : "Agregar año";
  $("aAnio").value = p ? p.anio : new Date().getFullYear();
  $("aAnio").disabled = !!p;
  $("aSmmlv").value = p ? p.smmlv : "";
  $("aAux").value = p ? p.auxTransporte : "";
  $("aPrest").value = numero((base.prestacional ?? 0.6) * 100, 2);
  $("aDias").value = base.diasHabiles ?? 21;
  $("aFuente").value = p?.fuente || "";
  $("anioDlg").showModal();
}
async function guardarAnio() {
  const al = $("anioDlgAlerta");
  const datos = { anio: Number($("aAnio").value), smmlv: leerNumero($("aSmmlv").value), auxTransporte: leerNumero($("aAux").value), prestacional: (leerNumero($("aPrest").value) ?? 0) / 100, diasHabiles: Number($("aDias").value), fuente: $("aFuente").value.trim() };
  if (!(datos.anio >= 2015) || !(datos.smmlv > 0) || !(datos.auxTransporte >= 0) || !(datos.prestacional > 0) || !(datos.diasHabiles > 0)) return mostrarAlerta(al, "Completa todos los valores (año, salario mínimo, auxilio, prestaciones y días hábiles).");
  if (!$("aAnio").disabled && parametros.some((p) => p.anio === datos.anio)) return mostrarAlerta(al, `Ya existen parámetros de ${datos.anio}; edítalos desde la tabla.`);
  try {
    await guardarParametros(datos, ctx.user);
    parametros = [...parametros.filter((p) => p.anio !== datos.anio), datos].sort((a, b) => b.anio - a.anio);
    $("anioDlg").close();
    pintarParametros();
    mostrarAlerta(alerta, `Parámetros de ${datos.anio} guardados.`, "success");
  } catch (err) { mostrarAlerta(al, errorAmigable(err)); }
}

// ---------------------------------------------------------------- IPP
function pintarIpp() {
  const puntos = [...(ipp.puntos || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const v1 = variacionIPP(puntos, 1), v3 = variacionIPP(puntos, 3);
  $("ippResumen").innerHTML = puntos.length ? `<div class="ap-pares">
      <div><span>Último dato</span><strong>${numero(puntos[0].valor, 2)}</strong><small>${fechaCorta(puntos[0].fecha)}</small></div>
      ${v1 ? `<div><span>Variación último año</span><strong>${numero(v1.tasaAnual * 100, 2)} %</strong></div>` : ""}
      ${v3 ? `<div><span>Promedio anual 3 años</span><strong>${numero(v3.tasaAnual * 100, 2)} %</strong></div>` : ""}
      <div><span>Meses registrados</span><strong>${puntos.length}</strong></div>
    </div>` : '<p class="text-muted">Sin datos del IPP. Se cargan con la base inicial o mes a mes aquí.</p>';
  $("ippTabla").innerHTML = puntos.length ? `<table class="ap-tabla ap-tabla-mini"><thead><tr><th>Mes</th><th class="ap-num">Índice</th><th class="ap-num">Variación 12 meses</th></tr></thead><tbody>${puntos.slice(0, 36).map((p, i) => {
    const hace = puntos[i + 12];
    return `<tr><td>${esc(p.fecha.slice(0, 7))}</td><td class="ap-num">${numero(p.valor, 2)}</td><td class="ap-num">${hace ? numero((p.valor / hace.valor - 1) * 100, 2) + " %" : "—"}</td></tr>`;
  }).join("")}</tbody></table>` : "";
}
async function agregarIpp(e) {
  e.preventDefault();
  const mes = $("ippMes").value, valor = leerNumero($("ippValor").value);
  if (!mes || !(valor > 0)) return mostrarAlerta(alerta, "Escribe el mes y el valor del índice.");
  const [a, m] = mes.split("-").map(Number);
  const fecha = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`; // último día del mes, como la serie del DANE
  const puntos = [...(ipp.puntos || []).filter((p) => p.fecha.slice(0, 7) !== mes), { fecha, valor }];
  try {
    await guardarSerie("ipp", { ...ipp, puntos }, ctx.user);
    ipp.puntos = puntos;
    $("ippValor").value = "";
    pintarIpp();
    mostrarAlerta(alerta, `IPP de ${mes} guardado.`, "success");
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
}

// ---------------------------------------------------------------- monedas
function pintarMonedas() {
  $("monedas").innerHTML = `<table class="ap-tabla ap-tabla-edit"><thead><tr><th>Moneda</th><th class="ap-num">Valor en pesos</th><th>Fecha</th></tr></thead><tbody>${monedas.map((m, i) => `<tr>
    <td><input data-i="${i}" data-k="moneda" value="${esc(m.moneda)}"></td>
    <td><input data-i="${i}" data-k="valor" inputmode="decimal" value="${esc(String(m.valor).replace(".", ","))}" class="ap-num"></td>
    <td><input data-i="${i}" data-k="fecha" type="date" value="${esc(m.fecha || "")}"></td></tr>`).join("")}</tbody></table>`;
}
async function guardarMonedas() {
  const lista = monedas.map((m, i) => {
    const g = (k) => document.querySelector(`#monedas input[data-i="${i}"][data-k="${k}"]`)?.value ?? "";
    return { moneda: g("moneda").trim(), valor: leerNumero(g("valor")), fecha: g("fecha") || hoyISO(), fuente: m.fuente || "" };
  }).filter((m) => m.moneda && m.valor > 0);
  try {
    await guardarSerie("monedas", { lista }, ctx.user);
    monedas = lista;
    pintarMonedas();
    mostrarAlerta(alerta, "Tasas de cambio guardadas.", "success");
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
}

function conectar() {
  $("nuevoAnio").addEventListener("click", () => abrirAnio());
  $("anioGuardar").addEventListener("click", guardarAnio);
  $("anioForm").addEventListener("submit", (e) => { e.preventDefault(); guardarAnio(); });
  $("tablaParametros").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-editar]"), bo = e.target.closest("[data-borrar]");
    if (ed) abrirAnio(parametros.find((p) => String(p.anio) === ed.dataset.editar));
    if (bo && confirm(`¿Eliminar los parámetros de ${bo.dataset.borrar}?`)) {
      try { await eliminarParametros(bo.dataset.borrar); parametros = parametros.filter((p) => String(p.anio) !== bo.dataset.borrar); pintarParametros(); } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
    }
  });
  $("ippForm").addEventListener("submit", agregarIpp);
  $("agregarMoneda").addEventListener("click", () => { monedas.push({ moneda: "", valor: "", fecha: hoyISO() }); pintarMonedas(); });
  $("guardarMonedas").addEventListener("click", guardarMonedas);
  document.querySelectorAll("dialog").forEach((d) => {
    d.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", () => d.close()));
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  });
}
