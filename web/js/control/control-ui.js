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

// Tema claro/oscuro: el mismo interruptor y la misma preferencia guardada que usan APU PRO, AHÍNCO e Interventoría PRO.
const CLAVE_TEMA = "ip-theme";
(function aplicarTema() {
  let tema = null;
  try { tema = localStorage.getItem(CLAVE_TEMA); } catch (e) { /* sin almacenamiento */ }
  if (tema !== "light" && tema !== "dark") tema = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", tema);
})();

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
      ${item("inicio.html", "🏠", "Inicio")}
      <div class="ctl-nav-titulo">Contratos</div>
      ${item("contratos.html", "📋", "Contratos")}
      <div class="ctl-nav-titulo">Gestión</div>
      ${item("documentos.html", "📑", "Documentos")}
      ${item("correspondencia.html", "✉️", "Correspondencia")}
      ${item("informes.html", "📊", "Informes")}
      ${item("ofertas.html", "💼", "Ofertas")}
      ${item("ordenes-trabajo.html", "🛠", "Orden de trabajo", ' id="navOrdenesTrabajo"')}
      <div class="ctl-nav-titulo">Administración</div>
      ${item("empleados.html", "👥", "Empleados")}
    </nav>
    <div class="ctl-espacio"></div>
    <div class="ctl-usuario">
      <strong id="userEmail"></strong>
      <div class="ctl-iconos">
        <button type="button" class="ctl-icono-btn" id="ctlTema" title="Cambiar modo claro/oscuro">🌓</button>
        <a class="ctl-icono-btn" href="cambiar-clave.html" title="Cambiar clave">🔒</a>
        <button type="button" class="ctl-icono-btn" id="logoutBtn" title="Cerrar sesión">⏻</button>
      </div>
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
  // Páginas con lista: lo de arriba (título, barra, tarjeta de detalle) queda fijo y solo se mueve la tabla,
  // con los títulos de las columnas siempre visibles. La cadena de contenedores hasta la tabla se vuelve flexible.
  const tablas = [...main.querySelectorAll(".control-tabla-wrap")].filter((t) => !t.closest("details"));
  if (tablas.length) {
    document.body.classList.add("ctl-lista-fija");
    tablas.forEach((t) => { for (let p = t.parentElement; p && p !== main; p = p.parentElement) p.classList.add("ctl-cadena"); });
  }
  aside.querySelector("#ctlTema").addEventListener("click", () => {
    const nuevo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nuevo);
    try { localStorage.setItem(CLAVE_TEMA, nuevo); } catch (e) { /* sin almacenamiento */ }
  });
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

// Un desplegable de filtro con pocas opciones (estado, tipo, rol...) se muestra como un grupo de botones; el
// desplegable sigue existiendo (oculto) y se mantiene sincronizado, así que el script de la página no cambia.
function filtrosEnBotones(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll("select").forEach((sel) => {
    let grupo = null;
    const construir = () => {
      grupo?.remove();
      const opciones = Array.from(sel.options);
      sel.classList.toggle("ctl-chip-oculto", false);
      if (opciones.length < 2 || opciones.length > 5) return;
      if (opciones.some((op) => op.textContent.trim().length > 20)) return; // etiquetas largas (contratos, clientes): se dejan como lista
      grupo = document.createElement("div");
      grupo.className = "ctl-chips";
      grupo.setAttribute("role", "group");
      // Título corto del grupo («Estados», «Tipos») a partir del primer desplegable «Todos los estados», salvo si ya está dentro de una etiqueta.
      const m = !sel.closest("label") && /^(todos|todas) (los|las) (.+)$/i.exec(opciones[0].textContent.trim());
      if (m) { const t = document.createElement("span"); t.className = "ctl-chips-titulo"; t.textContent = m[3].charAt(0).toUpperCase() + m[3].slice(1); grupo.appendChild(t); }
      const botones = opciones.map((op) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ctl-chip";
        b.dataset.valor = op.value;
        b.textContent = op.value === "" ? (/^todas/i.test(op.textContent.trim()) ? "Todas" : "Todos") : op.textContent.trim();
        b.addEventListener("click", () => { sel.value = op.value; sel.dispatchEvent(new Event("change", { bubbles: true })); marcar(); });
        grupo.appendChild(b);
        return b;
      });
      const marcar = () => botones.forEach((b) => b.classList.toggle("activo", b.dataset.valor === sel.value));
      sel.addEventListener("change", marcar);
      marcar();
      sel.classList.add("ctl-chip-oculto");
      sel.parentNode.insertBefore(grupo, sel);
    };
    construir();
    // Si la página cambia las opciones después (por ejemplo, las carga de la base de datos), se reconstruye.
    new MutationObserver(construir).observe(sel, { childList: true });
  });
}

// "N registros" al final de la barra, según las filas visibles de la lista principal.
function contadorDeRegistros(interior) {
  const tabla = document.querySelector("table.control-tabla-seleccionable, table.control-tabla-documentos");
  if (!tabla || !interior) return;
  const cuenta = document.createElement("span");
  cuenta.className = "ctl-cuenta";
  interior.appendChild(cuenta);
  const actualizar = () => {
    const n = Array.from(tabla.querySelectorAll("tbody tr")).filter((tr) => tr.children.length > 1 && tr.style.display !== "none" && !tr.hidden).length;
    cuenta.textContent = `${n} ${n === 1 ? "registro" : "registros"}`;
  };
  actualizar();
  new MutationObserver(actualizar).observe(tabla, { childList: true, subtree: true });
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
    const textoNuevo = (summary?.textContent || "+ Nuevo").trim();
    boton.textContent = textoNuevo;
    // Con el menú lateral el desplegable no repite el botón: el de la barra abre y cierra el formulario.
    const conMenu = document.body.classList.contains("ctl-con-menu");
    if (conMenu) detallesNuevo.classList.add("ctl-sin-resumen");
    const sincronizar = () => {
      if (!conMenu) return;
      boton.textContent = detallesNuevo.open ? "✕ Cerrar" : textoNuevo;
      boton.classList.toggle("control-btn-abierto", detallesNuevo.open);
    };
    boton.addEventListener("click", () => {
      detallesNuevo.open = conMenu ? !detallesNuevo.open : true;
      if (detallesNuevo.open) detallesNuevo.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    detallesNuevo.addEventListener("toggle", sincronizar);
    const marcador = document.createElement("span");
    marcador.hidden = true;
    detallesNuevo.parentNode.insertBefore(marcador, detallesNuevo);
    interior.appendChild(boton);
    // Sigue la visibilidad del desplegable (oculto para quien no es gestor).
    movidos.push({ el: boton, marcador, sigue: detallesNuevo });
  }
  if (filtros) mover(filtros);
  if (document.body.classList.contains("ctl-con-menu")) { filtrosEnBotones(filtros); contadorDeRegistros(interior); }

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
