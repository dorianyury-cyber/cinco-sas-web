// Menú lateral de AHÍNCO: mismo lenguaje visual que Interventoría PRO
// (tarjeta flotante con la franja naranja, secciones en mayúscula, cajón
// "☰ Menú" en el celular). Dos variantes: la lista de proyectos y el
// interior de un proyecto (secciones + cálculos agrupados por área).
import { esc, cerrarSesion, clavesDe, tituloCalculo, estadoModulo, modulosPorArea } from "./rt-core.js";
import { MODULOS, AREAS } from "./rt-modulos.js";
import { hallazgos, modoDe, esVerificacion } from "./rt-hallazgos.js";

const urlProyecto = (id, seccion = "resumen") => `proyecto.html?id=${encodeURIComponent(id)}#${seccion}`;
export const urlCalculo = (id, clave) => `calculo.html?id=${encodeURIComponent(id)}&k=${encodeURIComponent(clave)}`;

function cabeza() {
  return `<div class="ip-sidebar-cabeza">
      <a href="inicio.html" class="brand rt-brand"><img class="rt-logo-oscuro" src="../assets/img/logo.png" alt="CINCO S.A.S."><img class="rt-logo-claro" src="../assets/img/logo-texto-oscuro.png" alt="CINCO S.A.S."><span>AHÍNCO<small>Memorias de cálculo RETIE</small></span></a>
      <button type="button" class="ip-menu-movil" id="rtMenuMovil" aria-expanded="false">☰ Menú</button>
    </div>`;
}
function caja(ctx) {
  return `<div class="spacer"></div>
    <div class="user-box rt-user-box">
      <strong>${esc(ctx.perfil?.nombre || ctx.user.email)}</strong>
      <div class="rt-user-acciones">
        <button type="button" class="rt-icono-btn" id="rtTema" title="Cambiar modo claro/oscuro">🌓</button>
        <a class="rt-icono-btn" href="../control/cambiar-clave.html" title="Cambiar contraseña">🔒</a>
        <button type="button" class="rt-icono-btn" id="rtSalir" title="Cerrar sesión">⏻</button>
      </div>
    </div>`;
}
function conectar(aside) {
  document.body.classList.add("rt-con-menu");
  aside.querySelector("#rtSalir")?.addEventListener("click", cerrarSesion);
  aside.querySelector("#rtTema")?.addEventListener("click", () => document.querySelector(".theme-toggle")?.click());
  const movil = aside.querySelector("#rtMenuMovil");
  movil?.addEventListener("click", () => {
    const abierto = aside.classList.toggle("ip-menu-abierto");
    movil.setAttribute("aria-expanded", String(abierto));
    movil.textContent = abierto ? "✕ Cerrar" : "☰ Menú";
  });
}
const punto = (clase) => `<span class="rt-punto rt-punto-${clase}" aria-hidden="true"></span>`;

// ---------------------------------------------------------------- lista de proyectos
export function menuInicio(ctx, { filtro = "todos", conteos = {}, activo = "" } = {}) {
  const aside = document.getElementById("sidebar");
  const item = (f, icono, texto) => `<a href="inicio.html#${f}" data-filtro="${f}" class="${!activo && filtro === f ? "active" : ""}"><span class="rt-nav-icono">${icono}</span>${esc(texto)}${conteos[f] !== undefined ? `<span class="rt-nav-cuenta">${conteos[f]}</span>` : ""}</a>`;
  aside.innerHTML = `${cabeza()}
    <nav>
      <div class="rt-nav-titulo">Proyectos</div>
      ${item("todos", "📁", "Todos")}
      ${item("diseno", "📐", "Diseño")}
      ${item("verificacion", "🔎", "Verificación")}
      <div class="rt-nav-titulo">Acciones</div>
      <a href="inicio.html#nuevo" id="rtNuevo"><span class="rt-nav-icono">＋</span>Nuevo proyecto</a>
      <a href="rapido.html" class="${activo === "rapido" ? "active" : ""}"><span class="rt-nav-icono">⚡</span>Cálculo rápido</a>
      ${activo ? "" : '<a href="#" id="rtImportar"><span class="rt-nav-icono">⬆</span>Importar proyecto</a>'}
      <div class="rt-nav-titulo">Ayuda</div>
      <a href="acerca.html" class="${activo === "acerca" ? "active" : ""}"><span class="rt-nav-icono">ℹ</span>Alcance y validación</a>
    </nav>${caja(ctx)}`;
  conectar(aside);
  return aside;
}

// ---------------------------------------------------------------- dentro de un proyecto
// activo: "resumen" | "datos" | "literales" | "hallazgos" | "documentos" | clave de un cálculo.
export function menuProyecto(ctx, { proyecto, guardados, resultados, activo }) {
  const aside = document.getElementById("sidebar");
  const modo = modoDe(proyecto);
  const nHall = hallazgos(proyecto, resultados).length;
  const sec = (s, icono, texto, extra = "") => `<a href="${urlProyecto(proyecto.id, s)}" data-seccion="${s}" class="${activo === s ? "active" : ""}"><span class="rt-nav-icono">${icono}</span>${esc(texto)}${extra}</a>`;
  const areas = Object.entries(AREAS).map(([a, info]) => {
    const claves = modulosPorArea(a).flatMap((m) => clavesDe(m, guardados));
    if (!claves.length) return "";
    const abierta = true;
    return `<details class="rt-nav-area ${info.clase}"${abierta ? " open" : ""}>
        <summary>${esc(info.nombre)}<span class="rt-nav-cuenta">${claves.length}</span></summary>
        ${claves.map((k) => {
          const r = resultados[k], e = estadoModulo(r);
          const clase = e.clase === "ok" ? "ok" : e.clase === "danger" ? "mal" : "nulo";
          const texto = r?.etiqueta || MODULOS[r?.modulo || k.split("-")[0]].titulo;
          return `<a href="${urlCalculo(proyecto.id, k)}" class="rt-nav-calc${activo === k ? " active" : ""}" title="${esc(r ? tituloCalculo(r) : texto)} — ${esc(e.texto)}">${punto(clase)}<span class="rt-nav-texto"><span>${esc(MODULOS[r?.modulo || k.split("-")[0]].titulo)}</span>${r?.etiqueta ? `<small>${esc(r.etiqueta)}</small>` : ""}</span></a>`;
        }).join("")}
      </details>`;
  }).join("");
  aside.innerHTML = `${cabeza()}
    <nav>
      <a href="inicio.html" class="rt-volver">← Todos los proyectos</a>
      <div class="rt-nav-proyecto">
        <strong title="${esc(proyecto.nombre)}">${esc(proyecto.nombre)}</strong>
        <span class="rt-modo rt-modo-${esVerificacion(proyecto) ? "verificacion" : "diseno"}">${esc(modo.nombre)}</span>
      </div>
      ${sec("resumen", "◎", "Resumen")}
      ${sec("datos", "🗂", "Datos del proyecto")}
      ${sec("literales", "📋", "Literales a) a x)")}
      <div class="rt-nav-titulo">Cálculos</div>
      ${areas || '<p class="rt-nav-vacio">Todavía no hay cálculos.</p>'}
      <a href="#" class="rt-nav-agregar" id="rtAgregarCalc">＋ Agregar cálculo</a>
      <div class="rt-nav-titulo">Entregables</div>
      ${sec("hallazgos", esVerificacion(proyecto) ? "🔎" : "🛠", modo.hallazgos, nHall ? `<span class="rt-nav-cuenta rt-nav-cuenta-mal">${nHall}</span>` : "")}
      ${sec("documentos", "📄", "Documentos")}
      ${sec("versiones", "🕓", "Versiones")}
      <div class="rt-nav-titulo">Ayuda</div>
      <a href="acerca.html"><span class="rt-nav-icono">ℹ</span>Alcance y validación</a>
    </nav>${caja(ctx)}
    <dialog class="rt-dialogo" id="rtSelector">
      <div class="rt-dialogo-cabeza"><h2>Agregar cálculo</h2><button type="button" class="rt-icono-btn" id="rtSelectorCerrar" title="Cerrar">✕</button></div>
      <p class="text-muted">Un mismo cálculo puede repetirse en el proyecto, por ejemplo la coordinación de aislamiento a 115 kV y a 34,5 kV.</p>
      ${Object.entries(AREAS).map(([a, info]) => `<section class="rt-selector-area ${info.clase}"><h3>${esc(info.nombre)}</h3><div class="rt-selector-lista">
        ${modulosPorArea(a).map((m) => `<a class="rt-selector-item" href="calculo.html?id=${encodeURIComponent(proyecto.id)}&m=${m}&nuevo=1"><span class="rt-modulo-icono">${MODULOS[m].icono}</span><span><strong>${esc(MODULOS[m].titulo)}</strong><small>${esc(MODULOS[m].objeto)}</small>${clavesDe(m, guardados).length ? `<em>${clavesDe(m, guardados).length} en el proyecto</em>` : ""}</span></a>`).join("")}
      </div></section>`).join("")}
    </dialog>`;
  conectar(aside);
  const dlg = aside.querySelector("#rtSelector");
  aside.querySelector("#rtAgregarCalc").addEventListener("click", (e) => { e.preventDefault(); dlg.showModal(); });
  aside.querySelector("#rtSelectorCerrar").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  return aside;
}

// Marca la sección activa (proyecto.html cambia de sección sin recargar).
export function marcarSeccion(seccion) {
  document.querySelectorAll("#sidebar [data-seccion]").forEach((a) => a.classList.toggle("active", a.dataset.seccion === seccion));
}
