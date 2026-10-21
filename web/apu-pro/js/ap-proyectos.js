// Lista de proyectos de APU PRO: fila de una línea, panel del proyecto seleccionado arriba
// (fila 1 por defecto) y creación de proyectos nuevos.
import { iniciarPagina, listarProyectos, crearProyecto, eliminarProyecto, listarParametros, parametrosVigentes, esc, pesos, numero, fechaCorta, mostrarAlerta, limpiarAlerta, errorAmigable, colgroupProporcional, aplicarAnchos } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { normalizar } from "./ap-calculos.js";
import { nuevoId } from "./ap-presupuesto.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");
const TIPOS = { obra: "Obra", consultoria: "Consultoría", interventoria: "Interventoría" };
let proyectos = [], parametros = [], seleccion = decodeURIComponent(location.hash.slice(1)) || null;

if (ctx) {
  try {
    [proyectos, parametros] = await Promise.all([listarProyectos(), listarParametros()]);
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  pintarMenu(ctx, { activo: "proyectos", proyectos: proyectos.length });
  conectar();
  pintar();
}

function numeroPr(c) { return Number(String(c).match(/(\d+)/)?.[1]) || 0; }
function filtrados() {
  const palabras = normalizar($("buscar").value).split(" ").filter(Boolean);
  return proyectos
    .filter((p) => { if (!palabras.length) return true; const t = normalizar(`${p.codigo} ${p.nombre} ${p.cliente || ""} ${p.ubicacion || ""}`); return palabras.every((w) => t.includes(w)); })
    .sort((a, b) => numeroPr(b.codigo) - numeroPr(a.codigo));
}

function pintar() {
  const lista = filtrados();
  $("cuenta").textContent = `${lista.length} de ${proyectos.length}`;
  if (!seleccion || !lista.some((p) => p.id === seleccion)) seleccion = lista[0]?.id || null;
  const enc = ["Código", "Nombre", "Cliente", "Tipo", "Ítems", "Valor total", "Actualizado"];
  const filas = lista.map((p) => [p.codigo, p.nombre, p.cliente || "—", TIPOS[p.tipo] || p.tipo || "—", String(p.resumen?.items ?? 0), pesos(p.resumen?.total ?? 0), fechaCorta(p.actualizadoEn)]);
  const tabla = $("tabla");
  tabla.innerHTML = lista.length ? `${colgroupProporcional(enc, filas)}
    <thead><tr>${enc.map((h, j) => `<th class="${j === 4 || j === 5 ? "ap-num" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${lista.map((p, i) => `<tr data-id="${esc(p.id)}" class="${p.id === seleccion ? "ap-sel" : ""}">${filas[i].map((v, j) => `<td class="${j === 4 || j === 5 ? "ap-num" : ""}" title="${esc(v)}">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>`
    : `<tbody><tr><td class="text-muted">${proyectos.length ? "Ningún proyecto coincide." : "Todavía no hay proyectos."}</td></tr></tbody>`;
  aplicarAnchos(tabla);
  pintarDetalle();
}

function pintarDetalle() {
  const el = $("vistaPrevia");
  const p = proyectos.find((x) => x.id === seleccion);
  if (!p) { el.innerHTML = `<p class="text-muted">${proyectos.length ? "Ningún proyecto coincide con la búsqueda." : "Crea el primer proyecto con «＋ Nuevo proyecto»."}</p>`; return; }
  const par = (et, v) => `<div><span>${esc(et)}</span><strong>${v}</strong></div>`;
  const r = p.resumen || {};
  el.innerHTML = `
    <div class="ap-vp-cabeza">
      <h2>${esc(p.codigo)} — ${esc(p.nombre)}</h2>
      <div class="rt-acciones">
        <a class="btn" href="proyecto.html?id=${encodeURIComponent(p.id)}">Abrir presupuesto</a>
        <a class="btn secondary" href="presupuesto-formato.html?id=${encodeURIComponent(p.id)}">🖨 Formato Cinco</a>
        ${ctx.esAdmin || p.creadoPor === ctx.user.email ? '<button type="button" class="btn secondary ap-peligro" id="vpEliminar">Eliminar</button>' : ""}
      </div>
    </div>
    <div class="ap-pares ap-pares-apu">
      ${par("Cliente", esc(p.cliente || "—"))}
      ${par("Ubicación", esc(p.ubicacion || "—"))}
      ${par("Tipo", esc(TIPOS[p.tipo] || "—"))}
      ${par("Sitios", esc((p.sitios || []).map((s) => s.nombre).join(", ") || "—"))}
      ${par("Capítulos / ítems", `${(p.capitulos || []).length} / ${r.items ?? 0}`)}
      ${par("Costo directo", pesos(r.costoDirecto ?? 0))}
      ${par("Valor total", pesos(r.total ?? 0))}
      ${par("AIU", `${numero((p.aiu?.a ?? 0.15) * 100, 2)} / ${numero((p.aiu?.i ?? 0.05) * 100, 2)} / ${numero((p.aiu?.u ?? 0.05) * 100, 2)} %`)}
      ${par("IVA", p.regimenIva === "total" ? "Sobre el subtotal" : "Sobre la utilidad")}
      ${par("Factor de materiales", numero(p.factorMateriales || 1, 4))}
      ${par("Parámetros", String(p.anioParametros || "—"))}
      ${par("Precios", p.fechaPrecios ? `Congelados el ${fechaCorta(p.fechaPrecios)}` : "Vigentes de la base")}
      ${par("Creado por", esc(p.creadoPor || "—"))}
    </div>`;
  el.querySelector("#vpEliminar")?.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar el proyecto ${p.codigo} — ${p.nombre} y sus versiones? Esta acción no se puede deshacer.`)) return;
    try { await eliminarProyecto(p.id); proyectos = proyectos.filter((x) => x.id !== p.id); seleccion = null; pintar(); mostrarAlerta(alerta, `Se eliminó ${p.codigo}.`, "success"); } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });
}

function abrirNuevo() {
  limpiarAlerta($("nuevoAlerta"));
  const max = Math.max(38, ...proyectos.map((p) => numeroPr(p.codigo)));
  $("nCodigo").value = `PR-${max + 1}`;
  $("nAnio").innerHTML = parametros.map((p) => `<option value="${p.anio}">${p.anio}</option>`).join("");
  const vig = parametrosVigentes(parametros);
  if (vig) $("nAnio").value = String(vig.anio);
  ["nNombre", "nCliente", "nUbicacion"].forEach((id) => { $(id).value = ""; });
  $("nSitios").value = "Único";
  $("nuevoDlg").showModal();
}
async function crear() {
  const al = $("nuevoAlerta");
  const codigo = $("nCodigo").value.trim().toUpperCase(), nombre = $("nNombre").value.trim();
  if (!codigo || !nombre) return mostrarAlerta(al, "Escribe el código y el nombre del proyecto.");
  if (proyectos.some((p) => p.codigo === codigo)) return mostrarAlerta(al, `Ya existe un proyecto con el código ${codigo}.`);
  if (!parametros.length) return mostrarAlerta(al, "Registra primero los parámetros del año en «Parámetros e IPP».");
  const sitios = $("nSitios").value.split(",").map((s) => s.trim()).filter(Boolean).map((nombre) => ({ id: nuevoId(), nombre }));
  const datos = {
    codigo, nombre, tipo: $("nTipo").value, cliente: $("nCliente").value.trim(), ubicacion: $("nUbicacion").value.trim(),
    anioParametros: Number($("nAnio").value), aiu: { a: 0.15, i: 0.05, u: 0.05 }, iva: 0.19, regimenIva: "utilidad",
    factorMateriales: 1, justificacionFactor: "", redondeo: "arriba",
    sitios: sitios.length ? sitios : [{ id: nuevoId(), nombre: "Único" }],
    capitulos: [{ id: nuevoId(), nombre: "Preliminares", items: [] }],
    precios: null, fechaPrecios: null, estado: "borrador", resumen: { items: 0, costoDirecto: 0, total: 0 }
  };
  try {
    const id = await crearProyecto(datos, ctx.user);
    location.href = `proyecto.html?id=${encodeURIComponent(id)}`;
  } catch (err) { mostrarAlerta(al, errorAmigable(err)); }
}

// Importa un proyecto exportado (formato apupro-proyecto): se crea como proyecto nuevo.
async function importar() {
  const f = $("importarArchivo").files[0];
  $("importarArchivo").value = "";
  if (!f) return;
  try {
    const json = JSON.parse(await f.text());
    if (json?.formato !== "apupro-proyecto" || !json.proyecto?.codigo || !Array.isArray(json.proyecto.capitulos)) throw new Error("El archivo no es un proyecto de APU PRO.");
    const { id: _, creadoPor, creadoEn, actualizadoPor, actualizadoEn, ...p } = json.proyecto;
    if (proyectos.some((x) => x.codigo === p.codigo)) p.codigo = `${p.codigo}-IMP`;
    if (!confirm(`Se creará el proyecto ${p.codigo} — ${p.nombre} con ${p.capitulos.reduce((s, c) => s + (c.items || []).length, 0)} ítems. ¿Continuar?`)) return;
    const id = await crearProyecto(p, ctx.user);
    location.href = `proyecto.html?id=${encodeURIComponent(id)}`;
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
}

function conectar() {
  let t = null;
  $("buscar").addEventListener("input", () => { clearTimeout(t); t = setTimeout(pintar, 150); });
  $("tabla").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    seleccion = tr.dataset.id;
    $("tabla").querySelectorAll("tr.ap-sel").forEach((r) => r.classList.remove("ap-sel"));
    tr.classList.add("ap-sel");
    pintarDetalle();
  });
  $("nuevoBtn").addEventListener("click", abrirNuevo);
  $("importarBtn").addEventListener("click", () => $("importarArchivo").click());
  $("importarArchivo").addEventListener("change", importar);
  $("crearBtn").addEventListener("click", crear);
  $("nuevoForm").addEventListener("submit", (e) => { e.preventDefault(); crear(); });
  document.querySelectorAll("dialog").forEach((d) => {
    d.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", () => d.close()));
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  });
}
