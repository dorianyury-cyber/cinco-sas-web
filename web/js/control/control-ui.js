// Comportamiento común de las páginas del módulo interno (web/control/*):
//
// 0. Menú lateral: el menú superior se convierte en una barra lateral como la de los
//    aplicativos (APU PRO, AHÍNCO). Se arma aquí, sobre el HTML de cada página, y conserva
//    los id que usan los scripts (userEmail, logoutBtn, navOrdenesTrabajo).
// 1. Cabecera fija: la franja de la página ("Uso interno · Contratos") y la barra de
//    acciones quedan siempre visibles al bajar.
// 2. Barra de acciones: el botón "+ Nuevo…" (o el desplegable "+ Nueva
//    oferta/carta/informe", que aquí se convierte en un botón que lo abre) y
//    los filtros de la lista suben a una sola fila dentro de la cabecera
//    fija, para ganar espacio vertical.
// 3. Teclado: las flechas ↑ ↓ recorren la lista seleccionable
//    (.control-tabla-seleccionable), igual que hacer clic en la fila —
//    también con el cursor dentro del buscador.
//
// Los elementos se MUEVEN (no se copian): conservan sus id y los listeners
// que les pone el script de cada página. Si el contenedor original de un
// elemento está oculto (ej. la vista del jefe en Órdenes de Trabajo cuando
// entra un participante), el elemento también se oculta en la barra.

const contenedorPagina = document.querySelector("section.section > .container");
const header = document.querySelector(".site-header");
const banner = document.querySelector(".page-banner");

function fueraDeModalYFormulario(el) {
  return !el.closest(".modal-backdrop, .modal, form, details:not([id])");
}

// Barra lateral: reemplaza la cabecera superior. Devuelve el <main> donde queda el contenido.
function armarMenuLateral() {
  if (!header) return null;
  const archivo = location.pathname.split("/").pop() || "contratos.html";
  const activa = { "contrato.html": "contratos.html", "documento.html": "documentos.html" }[archivo] || archivo;
  const item = (href, icono, texto, extra = "") => `<a href="${href}"${extra} class="${activa === href ? "active" : ""}"><span class="ctl-nav-icono">${icono}</span>${texto}</a>`;
  const aside = document.createElement("aside");
  aside.className = "sidebar ctl-sidebar";
  aside.innerHTML = `<div class="ctl-sidebar-cabeza">
      <a href="../conecta.html" class="ctl-brand"><img class="ctl-logo-oscuro" src="../assets/img/logo.png" alt="CINCO S.A.S."><img class="ctl-logo-claro" src="../assets/img/logo-texto-oscuro.png" alt="CINCO S.A.S."><span>Control interno<small>Contratos y documentos</small></span></a>
      <button type="button" class="ctl-menu-movil" id="ctlMenuMovil" aria-expanded="false">☰ Menú</button>
    </div>
    <nav class="ctl-nav">
      <a href="../conecta.html" class="ctl-volver">← Cinco Conecta</a>
      ${item("contratos.html", "📋", "Contratos")}
      <div class="ctl-nav-titulo">Gestión</div>
      ${item("documentos.html", "📑", "Documentos")}
      ${item("correspondencia.html", "✉️", "Correspondencia")}
      ${item("informes.html", "📊", "Informes")}
      ${item("ofertas.html", "💼", "Ofertas")}
      ${item("ordenes-trabajo.html", "🛠", "Orden de trabajo", ' id="navOrdenesTrabajo"')}
      <div class="ctl-nav-titulo">Administración</div>
      ${item("empleados.html", "👥", "Empleados")}
      ${item("cambiar-clave.html", "🔒", "Cambiar clave")}
    </nav>
    <div class="ctl-espacio"></div>
    <div class="ctl-usuario">
      <span id="userEmail"></span>
      <button type="button" id="logoutBtn" class="ctl-salir">Cerrar sesión</button>
    </div>`;
  const main = document.createElement("main");
  main.className = "main ctl-main";
  const shell = document.createElement("div");
  shell.className = "app-shell ctl-shell";
  shell.append(aside, main);
  header.parentNode.insertBefore(shell, header);
  header.remove();
  // Todo lo demás de la página (franja, secciones) pasa al contenido; los scripts y las ventanas modales se quedan.
  Array.from(document.body.children).forEach((el) => {
    if (el === shell || el.tagName === "SCRIPT" || el.matches(".modal-backdrop, .modal, dialog")) return;
    main.appendChild(el);
  });
  document.body.classList.add("ctl-con-menu");
  const movil = aside.querySelector("#ctlMenuMovil");
  movil.addEventListener("click", () => {
    const abierto = aside.classList.toggle("ctl-menu-abierto");
    movil.setAttribute("aria-expanded", String(abierto));
    movil.textContent = abierto ? "✕ Cerrar" : "☰ Menú";
  });
  return main;
}

function armarCabeceraFija(main) {
  if (!main) return null;
  const cabecera = document.createElement("div");
  cabecera.className = "control-cabecera-fija";
  main.prepend(cabecera);
  if (banner) cabecera.appendChild(banner);
  return cabecera;
}

function armarBarraAcciones(cabecera) {
  if (!cabecera || !contenedorPagina) return;

  const botonNuevo = Array.from(contenedorPagina.querySelectorAll('button[id^="nuevo"], button[id^="nueva"]'))
    .find(fueraDeModalYFormulario);
  const detallesNuevo = Array.from(contenedorPagina.querySelectorAll("details.control-nuevo[id]"))
    .find((d) => !d.parentElement.closest("details, .modal"));
  const filtros = Array.from(contenedorPagina.querySelectorAll(".control-filtros-lista, .control-filtros"))
    .find(fueraDeModalYFormulario);
  if (!botonNuevo && !detallesNuevo && !filtros) return;

  const barra = document.createElement("div");
  barra.className = "control-barra-acciones";
  const interior = document.createElement("div");
  interior.className = "container control-barra-acciones-interior";
  barra.appendChild(interior);
  cabecera.appendChild(barra);

  const movidos = [];
  function mover(el) {
    const marcador = document.createElement("span");
    marcador.hidden = true;
    el.parentNode.insertBefore(marcador, el);
    interior.appendChild(el);
    movidos.push({ el, marcador });
  }

  if (botonNuevo) {
    botonNuevo.classList.add("control-btn-nuevo");
    mover(botonNuevo);
  } else if (detallesNuevo) {
    // El desplegable (con el formulario adentro) se queda en su sitio; en la
    // barra va un botón que lo abre y lleva hasta él.
    const summary = detallesNuevo.querySelector(":scope > summary");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "control-btn-nuevo";
    boton.textContent = (summary?.textContent || "+ Nuevo").trim();
    boton.addEventListener("click", () => {
      detallesNuevo.open = true;
      detallesNuevo.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const marcador = document.createElement("span");
    marcador.hidden = true;
    detallesNuevo.parentNode.insertBefore(marcador, detallesNuevo);
    interior.appendChild(boton);
    // Sigue la visibilidad del desplegable (oculto para quien no es gestor).
    movidos.push({ el: boton, marcador, sigue: detallesNuevo });
  }
  if (filtros) mover(filtros);

  // Un elemento movido se oculta en la barra si su lugar original quedó
  // dentro de algo oculto, o si lo que sigue (el desplegable) está oculto.
  //
  // OJO: classList.toggle(clase, x) con x = undefined NO fuerza nada — se
  // comporta como un toggle simple (alterna). Eso, dentro del
  // MutationObserver de abajo, cambiaba la clase en cada llamada y volvía
  // a disparar el observer sin fin (la página se congelaba). Por eso el
  // valor se fuerza a booleano y solo se toca la clase si de verdad cambia.
  function ponerClase(el, clase, activa) {
    if (el.classList.contains(clase) !== activa) el.classList.toggle(clase, activa);
  }
  function sincronizarVisibilidad() {
    let visibles = 0;
    movidos.forEach(({ el, marcador, sigue }) => {
      const oculto = Boolean(marcador.closest(".oculto, [hidden]:not(span)")) || Boolean(sigue && sigue.classList.contains("oculto"));
      ponerClase(el, "control-oculto-por-origen", oculto);
      if (!oculto && !el.classList.contains("oculto")) visibles++;
    });
    ponerClase(barra, "oculto", visibles === 0);
  }
  sincronizarVisibilidad();
  // Agrupado a un cuadro de pantalla: aunque la página cambie muchas clases
  // seguidas (pintar la tabla), se revisa una sola vez.
  let pendiente = false;
  new MutationObserver(() => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; sincronizarVisibilidad(); });
  }).observe(document.body, {
    attributes: true, attributeFilter: ["class", "hidden"], subtree: true
  });
}

// Alto real de la cabecera fija → variable CSS, para que al saltar a una
// fila o a un formulario no quede tapado por ella.
function publicarAltoCabecera(cabecera) {
  if (!cabecera) return;
  const actualizar = () => document.documentElement.style.setProperty("--alto-cabecera", `${cabecera.offsetHeight}px`);
  actualizar();
  new ResizeObserver(actualizar).observe(cabecera);
}

function navegacionConFlechas() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (document.querySelector(".modal-backdrop.open")) return;
    const t = e.target;
    if (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
    if (t.tagName === "INPUT" && !["text", "search"].includes(t.type)) return;
    if (t.tagName === "INPUT" && t.closest("form, .modal")) return;

    const tabla = Array.from(document.querySelectorAll("table.control-tabla-seleccionable"))
      .find((tb) => tb.offsetParent !== null && tb.querySelector("tbody tr[data-id]"));
    if (!tabla) return;
    const filas = Array.from(tabla.querySelectorAll("tbody tr[data-id]")).filter((tr) => tr.offsetParent !== null);
    if (filas.length === 0) return;

    e.preventDefault();
    const actual = filas.findIndex((tr) => tr.classList.contains("control-fila-fijada"));
    const destino = actual < 0 ? 0 : Math.min(filas.length - 1, Math.max(0, actual + (e.key === "ArrowDown" ? 1 : -1)));
    if (destino === actual) return;
    const id = filas[destino].dataset.id;
    filas[destino].click();
    // La página puede volver a pintar la tabla al seleccionar: se busca la
    // fila de nuevo por su id antes de llevarla a la vista.
    const fila = tabla.querySelector(`tbody tr[data-id="${CSS.escape(id)}"]`) || filas[destino];
    fila.scrollIntoView({ block: "nearest" });
  });
}

const cabecera = armarCabeceraFija(armarMenuLateral());
armarBarraAcciones(cabecera);
publicarAltoCabecera(cabecera);
navegacionConFlechas();
