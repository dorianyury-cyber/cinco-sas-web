// Lista de revisiones de ofertas de terceros: fila de una línea, panel de la revisión
// seleccionada arriba (fila 1 por defecto) y creación de revisiones nuevas.
import { iniciarPagina, listarRevisiones, crearRevision, eliminarRevision, esc, pesos, fechaCorta, hoyISO, mostrarAlerta, limpiarAlerta, errorAmigable, colgroupProporcional, aplicarAnchos } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { normalizar } from "./ap-calculos.js";
import { CONCEPTOS, BASES, REGIMENES } from "./ap-revision-motor.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");
let revisiones = [], seleccion = decodeURIComponent(location.hash.slice(1)) || null;

if (ctx) {
  try { revisiones = await listarRevisiones(); } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  pintarMenu(ctx, { activo: "revisiones", revisiones: revisiones.length });
  conectar();
  pintar();
}

function numeroRv(c) { return Number(String(c).match(/(\d+)/)?.[1]) || 0; }
function hallazgosTxt(r) { const s = r.resumen || {}; return `${s.mayores ?? 0} / ${s.menores ?? 0} / ${s.observaciones ?? 0}`; }
function filtrados() {
  const palabras = normalizar($("buscar").value).split(" ").filter(Boolean);
  return revisiones
    .filter((r) => { if (!palabras.length) return true; const t = normalizar(`${r.codigo} ${r.nombre} ${r.oferente || ""} ${r.cliente || ""}`); return palabras.every((w) => t.includes(w)); })
    .sort((a, b) => numeroRv(b.codigo) - numeroRv(a.codigo));
}

function pintar() {
  const lista = filtrados();
  $("cuenta").textContent = `${lista.length} de ${revisiones.length}`;
  if (!seleccion || !lista.some((r) => r.id === seleccion)) seleccion = lista[0]?.id || null;
  const enc = ["Código", "Oferta", "Oferente", "Contratante", "Ítems", "Valor oferta", "Hallazgos M / m / O", "Actualizado"];
  const filas = lista.map((r) => [r.codigo, r.nombre, r.oferente || "—", r.cliente || "—", String(r.resumen?.items ?? 0), pesos(r.resumen?.total ?? 0), hallazgosTxt(r), fechaCorta(r.actualizadoEn)]);
  const num = (j) => (j === 4 || j === 5 ? "ap-num" : "");
  const tabla = $("tabla");
  tabla.innerHTML = lista.length ? `${colgroupProporcional(enc, filas)}
    <thead><tr>${enc.map((h, j) => `<th class="${num(j)}">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${lista.map((r, i) => `<tr data-id="${esc(r.id)}" class="${r.id === seleccion ? "ap-sel" : ""}">${filas[i].map((v, j) => `<td class="${num(j)}" title="${esc(v)}">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>`
    : `<tbody><tr><td class="text-muted">${revisiones.length ? "Ninguna revisión coincide." : "Todavía no hay revisiones."}</td></tr></tbody>`;
  aplicarAnchos(tabla);
  pintarDetalle();
}

function pintarDetalle() {
  const el = $("vistaPrevia");
  const r = revisiones.find((x) => x.id === seleccion);
  if (!r) { el.innerHTML = `<p class="text-muted">${revisiones.length ? "Ninguna revisión coincide con la búsqueda." : "Crea la primera revisión con «＋ Nueva revisión»."}</p>`; return; }
  const par = (et, v) => `<div><span>${esc(et)}</span><strong>${v}</strong></div>`;
  const s = r.resumen || {};
  const aiu = r.aiu ? `${Math.round((r.aiu.a || 0) * 1000) / 10} / ${Math.round((r.aiu.i || 0) * 1000) / 10} / ${Math.round((r.aiu.u || 0) * 1000) / 10} %` : "—";
  el.innerHTML = `
    <div class="ap-vp-cabeza">
      <h2>${esc(r.codigo)} — ${esc(r.nombre)}</h2>
      <div class="rt-acciones">
        <a class="btn" href="revision.html?id=${encodeURIComponent(r.id)}">Abrir revisión</a>
        ${ctx.esAdmin || r.creadoPor === ctx.user.email ? '<button type="button" class="btn secondary ap-peligro" id="vpEliminar">Eliminar</button>' : ""}
      </div>
    </div>
    <div class="ap-pares ap-pares-apu">
      ${par("Oferente", esc(r.oferente || "—"))}
      ${par("Contratante", esc(r.cliente || "—"))}
      ${par("Fecha de la oferta", r.fechaOferta ? fechaCorta(r.fechaOferta) : "—")}
      ${par("Ítems", String(s.items ?? 0))}
      ${par("Valor de la oferta", pesos(s.total ?? 0))}
      ${par("Valores de los ítems", esc(r.base ? BASES[r.base].split(" (")[0] : "—"))}
      ${par("AIU", aiu)}
      ${par("IVA", esc(r.regimenIva ? REGIMENES[r.regimenIva] : "—"))}
      ${par("Hallazgos mayores", String(s.mayores ?? 0))}
      ${par("Hallazgos menores", String(s.menores ?? 0))}
      ${par("Observaciones", String(s.observaciones ?? 0))}
      ${par("Concepto", esc(CONCEPTOS[r.concepto] || "Por definir"))}
      ${par("Creada por", esc(r.creadoPor || "—"))}
    </div>`;
  el.querySelector("#vpEliminar")?.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar la revisión ${r.codigo} — ${r.nombre}? Esta acción no se puede deshacer.`)) return;
    try { await eliminarRevision(r.id); revisiones = revisiones.filter((x) => x.id !== r.id); seleccion = null; pintar(); mostrarAlerta(alerta, `Se eliminó ${r.codigo}.`, "success"); } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });
}

function abrirNuevo() {
  limpiarAlerta($("nuevoAlerta"));
  const max = Math.max(0, ...revisiones.map((r) => numeroRv(r.codigo)));
  $("nCodigo").value = `RV-${String(max + 1).padStart(3, "0")}`;
  ["nNombre", "nOferente", "nCliente", "nFecha"].forEach((id) => { $(id).value = ""; });
  $("nuevoDlg").showModal();
}
async function crear() {
  const al = $("nuevoAlerta");
  const codigo = $("nCodigo").value.trim().toUpperCase(), nombre = $("nNombre").value.trim();
  if (!codigo || !nombre) return mostrarAlerta(al, "Escribe el código y la oferta que se revisa.");
  if (revisiones.some((r) => r.codigo === codigo)) return mostrarAlerta(al, `Ya existe una revisión con el código ${codigo}.`);
  const datos = {
    codigo, nombre, oferente: $("nOferente").value.trim(), cliente: $("nCliente").value.trim(), fechaOferta: $("nFecha").value || "",
    fechaRevision: hoyISO(), documento: "", base: "cd", aiu: { a: 0, i: 0, u: 0 }, iva: 0.19, regimenIva: "total", totalDeclarado: null,
    capitulos: [], items: [], ajustes: {}, hallazgos: [], concepto: "", conceptoTexto: "", recomendaciones: "", limitaciones: "", objeto: "",
    resumen: { items: 0, total: 0, mayores: 0, menores: 0, observaciones: 0 }
  };
  try {
    const id = await crearRevision(datos, ctx.user);
    location.href = `revision.html?id=${encodeURIComponent(id)}#importar`;
  } catch (err) { mostrarAlerta(al, errorAmigable(err)); }
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
  $("crearBtn").addEventListener("click", crear);
  $("nuevoForm").addEventListener("submit", (e) => { e.preventDefault(); crear(); });
  document.querySelectorAll("dialog").forEach((d) => {
    d.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", () => d.close()));
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  });
}
