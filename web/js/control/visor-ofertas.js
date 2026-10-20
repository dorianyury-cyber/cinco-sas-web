// Visor de ofertas reutilizable desde cualquier documento (informes, correspondencia,
// contratos...): lista a la izquierda, PDF real de la oferta (generarOfertaPDF, el mismo
// del módulo Ofertas) a la derecha, con búsqueda y Anterior/Siguiente. Crea su propio
// modal la primera vez que se abre (reutiliza las clases .visor-ofertas-* de styles.css),
// así la página que lo usa no necesita HTML adicional.
import { generarOfertaPDF } from "./ofertas-pdf.js";

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const normal = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

let el = null;
let ofertas = [];
let idActual = null;
const cache = new Map();

function crearModal() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal visor-ofertas">
      <div class="visor-ofertas-encabezado">
        <h2 data-v="titulo">Ofertas</h2>
        <input type="text" data-v="buscar" placeholder="Buscar por radicado, título o cliente...">
        <button type="button" class="control-btn-mini" data-v="cerrar">Cerrar</button>
      </div>
      <p class="text-muted" data-v="nota" style="margin:0 0 8px;"></p>
      <div class="visor-ofertas-cuerpo">
        <ul class="visor-ofertas-lista" data-v="lista"></ul>
        <div class="visor-ofertas-panel">
          <div class="visor-ofertas-barra">
            <button type="button" class="control-btn-mini" data-v="anterior" title="Oferta anterior">◀</button>
            <span class="visor-ofertas-titulo" data-v="actual"></span>
            <button type="button" class="control-btn-mini" data-v="siguiente" title="Oferta siguiente">▶</button>
            <button type="button" class="control-btn-mini" data-v="descargar">Descargar PDF</button>
          </div>
          <div class="visor-ofertas-pdf" data-v="pdf"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  const q = (k) => backdrop.querySelector(`[data-v="${k}"]`);
  el = { backdrop, titulo: q("titulo"), buscar: q("buscar"), nota: q("nota"), lista: q("lista"), actual: q("actual"), pdf: q("pdf"), descargar: q("descargar") };
  q("cerrar").addEventListener("click", cerrar);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) cerrar(); });
  el.buscar.addEventListener("input", pintarLista);
  q("anterior").addEventListener("click", () => mover(-1));
  q("siguiente").addEventListener("click", () => mover(1));
  el.lista.addEventListener("click", (e) => { const li = e.target.closest("li[data-id]"); if (li) mostrar(li.dataset.id); });
  el.descargar.addEventListener("click", async () => {
    const of = ofertas.find((x) => x.id === idActual);
    if (!of) return;
    el.descargar.disabled = true;
    try { (await generarOfertaPDF(of)).save(`${of.radicado || "oferta"}.pdf`); } finally { el.descargar.disabled = false; }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el.backdrop.classList.contains("open")) cerrar(); });
}

function filtradas() {
  const t = normal(el.buscar.value);
  return t ? ofertas.filter((of) => normal(`${of.radicado} ${of.titulo} ${of.cliente} ${of.lineaServicio}`).includes(t)) : ofertas;
}

function pintarLista() {
  const lista = filtradas();
  el.lista.innerHTML = lista.length === 0
    ? '<li class="text-muted visor-ofertas-vacio">Ninguna oferta coincide.</li>'
    : lista.map((of) => `
        <li data-id="${esc(of.id)}" class="${of.id === idActual ? "activa" : ""}">
          <span><strong>${esc(of.radicado || "")}</strong> · ${esc(of.lineaServicio || "—")} · ${of.tipo === "obra" ? "Obra" : "Servicio"}</span>
          <span class="visor-ofertas-item-titulo">${esc(of.titulo || "")}</span>
          <span class="text-muted">${esc(of.cliente || "—")}${of.creadoEn?.toDate ? " · " + of.creadoEn.toDate().toLocaleDateString("es-CO") : ""}</span>
        </li>`).join("");
  el.lista.querySelector("li.activa")?.scrollIntoView({ block: "nearest" });
}

async function mostrar(id) {
  const of = ofertas.find((x) => x.id === id);
  if (!of) return;
  idActual = id;
  pintarLista();
  el.actual.textContent = `${of.radicado || ""} — ${of.cliente || "sin cliente"}`;
  let url = cache.get(id);
  if (!url) {
    el.pdf.innerHTML = '<p class="text-muted visor-ofertas-cargando">Generando vista previa...</p>';
    try {
      url = (await generarOfertaPDF(of)).output("bloburl");
      cache.set(id, url);
    } catch (err) {
      if (idActual === id) el.pdf.innerHTML = `<p class="form-alert error show">No se pudo generar el PDF de esta oferta: ${esc(err.message || String(err))}</p>`;
      return;
    }
  }
  if (idActual !== id) return; // se eligió otra mientras se generaba
  el.pdf.innerHTML = `<iframe title="PDF de ${esc(of.radicado || "")}" src="${url}#view=FitH"></iframe>`;
}

function mover(paso) {
  const lista = filtradas();
  if (!lista.length) return;
  const i = lista.findIndex((of) => of.id === idActual);
  const sig = lista[Math.min(lista.length - 1, Math.max(0, i < 0 ? 0 : i + paso))];
  if (sig && sig.id !== idActual) mostrar(sig.id);
}

function cerrar() {
  el.backdrop.classList.remove("open");
  el.pdf.innerHTML = "";
  cache.forEach((u) => URL.revokeObjectURL(u));
  cache.clear();
}

// Ofertas relacionadas con un documento: las del mismo contrato y, si no tiene contrato o
// no hay ninguna, las del mismo cliente (comparando el nombre sin tildes ni mayúsculas).
export function ofertasRelacionadas(todas, { contratoId, cliente } = {}) {
  const porContrato = contratoId ? todas.filter((of) => of.contratoId === contratoId) : [];
  if (porContrato.length) return { lista: porContrato, criterio: "del mismo contrato" };
  const c = normal(cliente);
  const porCliente = c ? todas.filter((of) => { const oc = normal(of.cliente); return oc && (oc.includes(c) || c.includes(oc)); }) : [];
  if (porCliente.length) return { lista: porCliente, criterio: "del mismo cliente" };
  return { lista: [], criterio: "" };
}

// titulo: encabezado del visor; lista: ofertas a mostrar; nota: texto bajo el encabezado.
export function abrirVisorOfertas({ titulo = "Ofertas", lista = [], nota = "" } = {}) {
  if (!el) crearModal();
  ofertas = [...lista];
  el.titulo.textContent = titulo;
  el.nota.textContent = nota;
  el.nota.style.display = nota ? "" : "none";
  el.buscar.value = "";
  el.backdrop.classList.add("open");
  if (!ofertas.length) {
    el.lista.innerHTML = '<li class="text-muted visor-ofertas-vacio">Todavía no hay ofertas registradas.</li>';
    el.pdf.innerHTML = "";
    el.actual.textContent = "";
    return;
  }
  mostrar(ofertas[0].id);
}

// ---- uso desde cualquier página: escucha la colección de ofertas una sola vez y arma el
// botón «👁 Ofertas relacionadas (n)» para el panel de acciones del documento seleccionado.
import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-control.js";
let ofertasCache = [];
export function escucharOfertas(alCambiar) {
  onSnapshot(query(collection(db, "ofertas"), orderBy("creadoEn", "desc")), (snap) => {
    ofertasCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    alCambiar?.();
  }, () => { ofertasCache = []; });
}
// referencia: texto del documento (p. ej. su radicado); contratoCodigo: para la nota.
export function botonOfertas({ contratoId, cliente, referencia = "", contratoCodigo = "" } = {}) {
  const rel = ofertasRelacionadas(ofertasCache, { contratoId, cliente });
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "control-btn-mini";
  btn.textContent = rel.lista.length ? `👁 Ofertas relacionadas (${rel.lista.length})` : "👁 Ver ofertas";
  btn.title = rel.lista.length ? `Ver el PDF de las ofertas ${rel.criterio}` : "No hay ofertas del mismo contrato o cliente: se muestran todas para buscar";
  btn.addEventListener("click", () => abrirVisorOfertas(rel.lista.length
    ? { titulo: `Ofertas relacionadas${referencia ? ` — ${referencia}` : ""}`, lista: rel.lista, nota: `Ofertas ${rel.criterio}${contratoCodigo ? ` (${contratoCodigo})` : ""}.` }
    : { titulo: "Ofertas", lista: ofertasCache, nota: "No hay ofertas del mismo contrato o cliente: se muestran todas; use el buscador." }));
  return btn;
}
