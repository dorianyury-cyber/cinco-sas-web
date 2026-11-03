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

  function pintarLista() {
    const f = filtroActual();
    const vis = proyectos.filter((p) => f === "todos" || (f === "verificacion") === esVerificacion(p));
    document.getElementById("tituloLista").textContent = f === "todos" ? "Proyectos" : f === "diseno" ? "Proyectos de diseño" : "Verificaciones de interventoría";
    lista.innerHTML = vis.length
      ? vis.map((p) => {
        const verif = esVerificacion(p);
        return `<a class="rt-proyecto-card" href="proyecto.html?id=${encodeURIComponent(p.id)}#resumen">
            <span class="rt-modo rt-modo-${verif ? "verificacion" : "diseno"}">${esc(MODOS[verif ? "verificacion" : "diseno"].nombre)}</span>
            <strong>${esc(p.nombre)}</strong>
            <span class="text-muted">${esc([p.cliente, p.ubicacion].filter(Boolean).join(" · ") || "Sin cliente ni ubicación")}</span>
            <span class="rt-proyecto-pie">Actualizado ${esc(fechaCorta(p.actualizadoEn))}</span>
          </a>`;
      }).join("")
      : `<div class="card rt-vacio-card"><p>${proyectos.length ? "No hay proyectos de este tipo." : "Todavía no hay proyectos. Elija uno de los caminos de arriba."}</p></div>`;
  }

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
