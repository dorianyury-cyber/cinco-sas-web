// Lista de proyectos de AHÍNCO (filtrable por tipo: diseño o verificación),
// creación de un proyecto nuevo e importación de uno exportado.
import { iniciarPagina, listarProyectos, crearProyecto, importarProyecto, validarImportacion, esc, fechaCorta, mostrarAlerta, errorAmigable } from "./rt-core.js";
import { menuInicio } from "./rt-shell.js";
import { MODOS, esVerificacion } from "./rt-hallazgos.js";

const ctx = await iniciarPagina();
if (ctx) {
  const lista = document.getElementById("proyectos");
  const alerta = document.getElementById("listaAlerta");
  const card = document.getElementById("nuevoCard");
  const archivo = document.getElementById("importarArchivo");
  let proyectos = [];
  const filtroActual = () => (["diseno", "verificacion"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "todos");

  // El formulario se adapta a lo elegido: en verificación pide el autor y los documentos revisados.
  const SIGUIENTE = {
    diseno: "Al crearlo sigue: agregar los cálculos, escribir los literales y descargar la memoria.",
    verificacion: "Al crearlo sigue: registrar los hallazgos (a mano o cargando los cálculos del diseñador), comentar los literales y descargar el informe."
  };
  function elegirModo(modo) {
    document.querySelectorAll('input[name="pModo"]').forEach((x) => { x.checked = x.value === modo; x.closest(".rt-modo-op").classList.toggle("activo", x.checked); });
    document.body.classList.toggle("rt-verificacion", modo === "verificacion");
    document.getElementById("nuevoTitulo").textContent = modo === "verificacion" ? "Nueva verificación de interventoría" : "Nuevo diseño";
    document.getElementById("nuevoSiguiente").textContent = SIGUIENTE[modo];
  }
  const abrirNuevo = (modo = filtroActual() === "verificacion" ? "verificacion" : "diseno") => {
    elegirModo(modo);
    card.classList.remove("hidden");
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("pNombre").focus({ preventScroll: true });
  };
  document.getElementById("rutas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ruta]");
    if (!b) return;
    if (b.dataset.ruta === "importar") archivo.click(); else abrirNuevo(b.dataset.ruta);
  });
  function pintarMenu() {
    const conteos = { todos: proyectos.length, diseno: proyectos.filter((p) => !esVerificacion(p)).length, verificacion: proyectos.filter(esVerificacion).length };
    const aside = menuInicio(ctx, { filtro: filtroActual(), conteos });
    aside.querySelector("#rtNuevo").addEventListener("click", (e) => { e.preventDefault(); abrirNuevo(); aside.classList.remove("ip-menu-abierto"); });
    aside.querySelector("#rtImportar").addEventListener("click", (e) => { e.preventDefault(); archivo.click(); });
  }

  // Lista de una línea por proyecto y panel de detalle arriba; arranca con la fila 1 seleccionada.
  let seleccionado = null;
  const buscar = document.getElementById("buscar");
  const visibles = () => {
    const f = filtroActual(), q = buscar.value.trim().toLowerCase();
    return proyectos.filter((p) => (f === "todos" || (f === "verificacion") === esVerificacion(p))
      && (!q || [p.nombre, p.cliente, p.ubicacion].some((t) => (t || "").toLowerCase().includes(q))));
  };
  const campo = (etiqueta, valor) => (valor ? `<div class="rt-vp-campo"><span class="rt-vp-etiqueta">${esc(etiqueta)}</span><span class="rt-vp-valor">${esc(valor)}</span></div>` : "");
  const grupo = (titulo, campos) => (campos.join("") ? `<div class="rt-vp-grupo"><div class="rt-vp-grupo-titulo">${esc(titulo)}</div>${campos.join("")}</div>` : "");
  function pintarDetalle(p) {
    const vp = document.getElementById("vistaPrevia");
    if (!p) { vp.innerHTML = `<p class="text-muted">${proyectos.length ? "No hay proyectos con este filtro." : "Todavía no hay proyectos. Use «Nuevo diseño», «Nueva verificación» o «Cargar .ahinco.json»."}</p>`; return; }
    const verif = esVerificacion(p), url = (s) => `proyecto.html?id=${encodeURIComponent(p.id)}#${s}`;
    const nHall = (p.hallazgosManuales || []).length;
    vp.innerHTML = `<div class="rt-vp-cabeza">
        <div class="rt-vp-titulo"><span class="rt-modo rt-modo-${verif ? "verificacion" : "diseno"}">${esc(MODOS[verif ? "verificacion" : "diseno"].nombre)}</span><strong title="${esc(p.nombre)}">${esc(p.nombre)}</strong></div>
        <div class="rt-vp-acciones">
          <a class="rt-barra-btn rt-barra-principal" href="${url("resumen")}">Abrir</a>
          <a class="rt-barra-btn" href="${url("hallazgos")}">${verif ? "Hallazgos" : "Pendientes"}</a>
          <a class="rt-barra-btn" href="${url("documentos")}">${verif ? "Informe" : "Memoria"}</a>
          <a class="rt-barra-btn" href="${url("versiones")}">Versiones</a>
        </div>
      </div>
      <div class="rt-vp-grupos">
        ${grupo("Proyecto", [campo("Cliente", p.cliente), campo("Ubicación", p.ubicacion), campo("Tipo", p.tipoDiseno)])}
        ${verif
          ? grupo("Diseño revisado", [campo("Autor", p.autorDiseno), campo("Documentos", p.documentosRevisados), campo("Hallazgos de revisión", nHall ? String(nHall) : "")])
          : grupo("Firma", [campo("Diseñador", p.disenador), campo("Matrícula", p.matricula)])}
        ${grupo("Registro", [campo("Radicado", p.radicado), campo(verif ? "Interventor" : "Creado por", verif ? p.disenador : p.creadoPor), campo("Actualizado", fechaCorta(p.actualizadoEn))])}
      </div>
      ${p.descripcion ? `<p class="rt-vp-desc" title="${esc(p.descripcion)}">${esc(p.descripcion)}</p>` : ""}`;
  }
  function pintarLista() {
    const f = filtroActual();
    const vis = visibles();
    document.getElementById("tituloLista").textContent = f === "todos" ? "Proyectos" : f === "diseno" ? "Proyectos de diseño" : "Verificaciones de interventoría";
    if (!vis.some((p) => p.id === seleccionado)) seleccionado = vis[0]?.id || null;
    lista.querySelector("tbody").innerHTML = vis.length
      ? vis.map((p) => {
        const verif = esVerificacion(p);
        const t = (v) => `<td title="${esc(v || "")}">${esc(v || "—")}</td>`;
        return `<tr data-id="${esc(p.id)}" class="${p.id === seleccionado ? "rt-fila-sel" : ""}">
            <td><span class="rt-modo rt-modo-${verif ? "verificacion" : "diseno"}">${esc(MODOS[verif ? "verificacion" : "diseno"].nombre)}</span></td>
            ${t(p.nombre)}${t(p.cliente)}${t(p.ubicacion)}<td>${esc(fechaCorta(p.actualizadoEn))}</td></tr>`;
      }).join("")
      : `<tr><td colspan="5" class="text-muted">Sin proyectos.</td></tr>`;
    pintarDetalle(vis.find((p) => p.id === seleccionado));
  }
  lista.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    seleccionado = tr.dataset.id;
    lista.querySelectorAll("tr[data-id]").forEach((x) => x.classList.toggle("rt-fila-sel", x === tr));
    pintarDetalle(proyectos.find((p) => p.id === seleccionado));
  });
  lista.addEventListener("dblclick", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) location.href = `proyecto.html?id=${encodeURIComponent(tr.dataset.id)}#resumen`;
  });
  buscar.addEventListener("input", pintarLista);

  async function cargar() {
    try { proyectos = await listarProyectos(); } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); proyectos = []; }
    pintarMenu(); pintarLista();
  }
  window.addEventListener("hashchange", () => { pintarMenu(); pintarLista(); });

  // ---- nuevo proyecto
  document.querySelectorAll('input[name="pModo"]').forEach((r) => r.addEventListener("change", () => elegirModo(r.value)));
  document.getElementById("cancelarBtn").addEventListener("click", () => card.classList.add("hidden"));
  document.getElementById("crearBtn").addEventListener("click", async () => {
    const nombre = document.getElementById("pNombre").value.trim();
    const al = document.getElementById("nuevoAlerta");
    if (!nombre) { mostrarAlerta(al, "Escribe el nombre del proyecto."); return; }
    const modo = document.querySelector('input[name="pModo"]:checked')?.value || "diseno";
    try {
      const id = await crearProyecto({
        nombre, modo,
        cliente: document.getElementById("pCliente").value.trim(),
        ubicacion: document.getElementById("pUbicacion").value.trim(),
        altitud: Number(document.getElementById("pAltitud").value) || 0,
        tempAmbiente: Number(document.getElementById("pTemp").value) || 30,
        tipoDiseno: document.getElementById("pTipo").value,
        descripcion: document.getElementById("pDescripcion").value.trim(),
        ...(modo === "verificacion" ? { autorDiseno: document.getElementById("pAutor").value.trim(), documentosRevisados: document.getElementById("pDocs").value.trim() } : {}),
        disenador: modo === "verificacion" ? "Interventoría Cinco S.A.S." : ctx.perfil.nombre || ctx.user.email,
        matricula: "",
        literales: {}
      }, ctx.user);
      window.location.href = `proyecto.html?id=${encodeURIComponent(id)}#resumen`;
    } catch (err) {
      mostrarAlerta(al, errorAmigable(err));
    }
  });

  // ---- importar un proyecto exportado (datos generales, literales y cálculos)
  archivo.addEventListener("change", async () => {
    const f = archivo.files[0];
    archivo.value = "";
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      validarImportacion(json);
      const nCalc = Object.keys(json?.calculos || {}).length, nHall = (json?.proyecto?.hallazgosManuales || []).length;
      if (!confirm(`¿Importar el proyecto «${json?.proyecto?.nombre || f.name}» con ${nCalc} cálculos${nHall ? ` y ${nHall} hallazgos de revisión` : ""}? Se crea como un proyecto nuevo a tu nombre.`)) return;
      const { id } = await importarProyecto(json, ctx.user);
      window.location.href = `proyecto.html?id=${encodeURIComponent(id)}#resumen`;
    } catch (err) {
      mostrarAlerta(alerta, err instanceof SyntaxError ? "El archivo no es un JSON válido." : errorAmigable(err));
    }
  });

  cargar().then(() => { if (location.hash === "#nuevo") abrirNuevo(); });
}
