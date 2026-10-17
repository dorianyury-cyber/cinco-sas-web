// Lista de proyectos de AHÍNCO y creación de uno nuevo.
import { iniciarPagina, listarProyectos, crearProyecto, importarProyecto, esc, fechaCorta, mostrarAlerta, errorAmigable } from "./rt-core.js";

const ctx = await iniciarPagina();
if (ctx) {
  const lista = document.getElementById("proyectos");
  const alerta = document.getElementById("listaAlerta");
  const card = document.getElementById("nuevoCard");

  async function pintar() {
    try {
      const proyectos = await listarProyectos();
      lista.innerHTML = proyectos.length
        ? proyectos.map((p) => `
          <a class="rt-proyecto-card" href="proyecto.html?id=${encodeURIComponent(p.id)}">
            <strong>${esc(p.nombre)}</strong>
            <span class="text-muted">${esc([p.cliente, p.ubicacion].filter(Boolean).join(" · ") || "Sin cliente ni ubicación")}</span>
            <span class="text-muted">${esc(p.tipoDiseno || "Diseño detallado")} · actualizado ${esc(fechaCorta(p.actualizadoEn))}</span>
          </a>`).join("")
        : `<div class="card"><p class="ip-sin-margen">Todavía no hay proyectos. Usa «+ Nuevo proyecto» para crear el primero.</p></div>`;
    } catch (err) {
      mostrarAlerta(alerta, errorAmigable(err));
      lista.innerHTML = "";
    }
  }

  document.getElementById("nuevoBtn").addEventListener("click", () => { card.classList.remove("hidden"); document.getElementById("pNombre").focus(); });
  document.getElementById("cancelarBtn").addEventListener("click", () => card.classList.add("hidden"));
  document.getElementById("crearBtn").addEventListener("click", async () => {
    const nombre = document.getElementById("pNombre").value.trim();
    const al = document.getElementById("nuevoAlerta");
    if (!nombre) { mostrarAlerta(al, "Escribe el nombre del proyecto."); return; }
    try {
      const id = await crearProyecto({
        nombre,
        cliente: document.getElementById("pCliente").value.trim(),
        ubicacion: document.getElementById("pUbicacion").value.trim(),
        altitud: Number(document.getElementById("pAltitud").value) || 0,
        tempAmbiente: Number(document.getElementById("pTemp").value) || 30,
        tipoDiseno: document.getElementById("pTipo").value,
        descripcion: document.getElementById("pDescripcion").value.trim(),
        disenador: ctx.perfil.nombre || ctx.user.email,
        matricula: "",
        literales: {}
      }, ctx.user);
      window.location.href = `proyecto.html?id=${encodeURIComponent(id)}`;
    } catch (err) {
      mostrarAlerta(al, errorAmigable(err));
    }
  });
  // Importar un proyecto exportado (datos generales, literales y cálculos).
  const archivo = document.getElementById("importarArchivo");
  document.getElementById("importarBtn").addEventListener("click", () => archivo.click());
  archivo.addEventListener("change", async () => {
    const f = archivo.files[0];
    archivo.value = "";
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (!confirm(`¿Importar el proyecto «${json?.proyecto?.nombre || f.name}» con ${Object.keys(json?.calculos || {}).length} cálculos? Se crea como un proyecto nuevo a tu nombre.`)) return;
      const { id } = await importarProyecto(json, ctx.user);
      window.location.href = `proyecto.html?id=${encodeURIComponent(id)}`;
    } catch (err) {
      mostrarAlerta(alerta, err instanceof SyntaxError ? "El archivo no es un JSON válido." : errorAmigable(err));
    }
  });
  pintar();
}
