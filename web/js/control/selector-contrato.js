// Selector de "Contrato relacionado" con ventana emergente: el <select> nativo
// cortaba el nombre del contrato (y en tema oscuro su lista se veía mal), así que
// se oculta y en su lugar queda un botón con el número y el nombre COMPLETOS del
// contrato elegido; al pulsarlo se abre un modal con buscador y la lista de
// contratos (número, nombre, cliente y estado), sin recortar nada.
//
// El <select> sigue siendo la fuente de verdad: cada página lo llena y lo lee
// igual que antes (selectContrato.value), y al elegir en el modal se le asigna el
// valor y se dispara "change". Las asignaciones directas que ya hace cada página
// (Editar, Duplicar, importar...) refrescan el botón solas porque se intercepta
// el setter de "value" en ese <select> concreto. Crea su propio modal la primera
// vez (mismo patrón que visor-ofertas.js), así la página no necesita HTML extra.

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const normal = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

let el = null;
let activo = null; // { select, contratos, boton } del selector que abrió el modal

function crearModal() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal selector-contrato-modal" role="dialog" aria-modal="true" aria-labelledby="selectorContratoTitulo">
      <div class="selector-contrato-encabezado">
        <h2 id="selectorContratoTitulo">Contrato relacionado</h2>
        <button type="button" class="control-btn-mini" data-s="cerrar">Cerrar</button>
      </div>
      <input type="text" data-s="buscar" placeholder="Buscar por número, nombre o cliente..." autocomplete="off">
      <ul class="selector-contrato-lista" data-s="lista"></ul>
    </div>`;
  document.body.appendChild(backdrop);
  const q = (k) => backdrop.querySelector(`[data-s="${k}"]`);
  el = { backdrop, buscar: q("buscar"), lista: q("lista") };
  q("cerrar").addEventListener("click", cerrar);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) cerrar(); });
  el.buscar.addEventListener("input", pintarLista);
  el.buscar.addEventListener("keydown", (e) => {
    // Enter elige el primer resultado de la búsqueda (sin enviar el formulario).
    if (e.key !== "Enter") return;
    e.preventDefault();
    const primero = el.lista.querySelector("li[data-id]");
    if (primero) elegir(primero.dataset.id);
  });
  el.lista.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (li) elegir(li.dataset.id);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el.backdrop.classList.contains("open")) cerrar(); });
}

// Contratos en el mismo orden de las opciones del <select> (cada página ya los
// ordena), con los datos completos del mapa que entrega la página.
function contratosDelSelect() {
  return [...activo.select.options]
    .filter((o) => o.value)
    .map((o) => ({ id: o.value, ...(activo.contratos[o.value] || { nombre: o.textContent }) }));
}

function pintarLista() {
  const t = normal(el.buscar.value);
  const actual = activo.select.value;
  const lista = contratosDelSelect().filter((c) => !t || normal(`${c.codigo} ${c.nombre} ${c.cliente}`).includes(t));
  const ninguno = t ? "" : `
    <li data-id="" class="selector-contrato-ninguno ${actual === "" ? "activa" : ""}">
      <span class="selector-contrato-nombre">Ninguno</span>
      <span class="text-muted">El documento no queda asociado a un contrato.</span>
    </li>`;
  el.lista.innerHTML = ninguno + (lista.length === 0
    ? '<li class="text-muted selector-contrato-vacio">Ningún contrato coincide con la búsqueda.</li>'
    : lista.map((c) => `
        <li data-id="${esc(c.id)}" class="${c.id === actual ? "activa" : ""}">
          <span class="selector-contrato-fila">
            <strong class="selector-contrato-codigo">${esc(c.codigo || "(sin código)")}</strong>
            ${c.estado === "cerrado" ? '<span class="selector-contrato-estado">Cerrado</span>' : ""}
          </span>
          <span class="selector-contrato-nombre">${esc(c.nombre || "—")}</span>
          ${c.cliente ? `<span class="text-muted">${esc(c.cliente)}</span>` : ""}
        </li>`).join(""));
  el.lista.querySelector("li.activa")?.scrollIntoView({ block: "nearest" });
}

function elegir(id) {
  const { select, boton } = activo;
  if (select.value !== id) {
    select.value = id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  cerrar();
  boton.focus();
}

function abrir(selector) {
  if (!el) crearModal();
  activo = selector;
  el.buscar.value = "";
  pintarLista();
  el.backdrop.classList.add("open");
  el.buscar.focus();
}

function cerrar() {
  el.backdrop.classList.remove("open");
}

function pintarBoton(select, contratos, boton) {
  const c = select.value ? contratos[select.value] : null;
  boton.innerHTML = c
    ? `<span class="selector-contrato-codigo">${esc(c.codigo || "(sin código)")}</span>
       <span class="selector-contrato-nombre">${esc(c.nombre || "—")}</span>
       ${c.cliente ? `<span class="text-muted">${esc(c.cliente)}</span>` : ""}`
    : '<span class="text-muted">Ninguno — pulsa para elegir un contrato</span>';
}

// contratos: { [id]: {codigo, nombre, cliente, estado} } — el mismo mapa
// contratosPorId que ya arma cada página al llenar el <select>.
export function mejorarSelectorContrato(select, contratos) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "selector-contrato-boton";
  if (select.id) {
    boton.id = `${select.id}Boton`;
    document.querySelector(`label[for="${select.id}"]`)?.setAttribute("for", boton.id);
  }
  select.hidden = true;
  select.after(boton);

  const refrescar = () => pintarBoton(select, contratos, boton);
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(select, "value", {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); refrescar(); },
  });
  select.addEventListener("change", refrescar);
  // form.reset() devuelve el <select> a "Ninguno" sin pasar por el setter.
  select.form?.addEventListener("reset", () => setTimeout(refrescar));

  boton.addEventListener("click", () => abrir({ select, contratos, boton }));
  refrescar();
}
