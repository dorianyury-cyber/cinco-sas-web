// Menú lateral de APU PRO: mismo lenguaje visual que Interventoría PRO y AHÍNCO
// (tarjeta flotante, secciones en mayúscula, cajón "☰ Menú" en el celular).
import { esc, cerrarSesion } from "./ap-core.js";
import { TIPOS, ORDEN_TIPOS } from "./ap-calculos.js";

// activo: "tablero" | "parametros" | "insumos-MA" | "insumos-MO" | ...
// conteos: { MA: n, MO: n, ... } para mostrar junto a cada tipo de insumo.
export function pintarMenu(ctx, { activo = "", conteos = {} } = {}) {
  const aside = document.getElementById("sidebar");
  const item = (href, clave, icono, texto, extra = "") => `<a href="${href}" class="${activo === clave ? "active" : ""}"><span class="rt-nav-icono">${icono}</span>${esc(texto)}${extra}</a>`;
  const pronto = (icono, texto) => `<span class="ap-nav-pronto" title="Disponible en la siguiente fase"><span class="rt-nav-icono">${icono}</span>${esc(texto)}<small>Pronto</small></span>`;
  aside.innerHTML = `<div class="ip-sidebar-cabeza">
      <a href="inicio.html" class="brand rt-brand"><img class="rt-logo-oscuro" src="../assets/img/logo.png" alt="CINCO S.A.S."><img class="rt-logo-claro" src="../assets/img/logo-texto-oscuro.png" alt="CINCO S.A.S."><span>APU PRO<small>Presupuestos y APU</small></span></a>
      <button type="button" class="ip-menu-movil" id="apMenuMovil" aria-expanded="false">☰ Menú</button>
    </div>
    <nav>
      ${item("inicio.html", "tablero", "◎", "Tablero")}
      <div class="rt-nav-titulo">Presupuestos</div>
      ${pronto("📁", "Proyectos")}
      ${pronto("📚", "Biblioteca de APU")}
      <div class="rt-nav-titulo">Base de precios</div>
      ${ORDEN_TIPOS.map((t) => item(`insumos.html#${t}`, `insumos-${t}`, TIPOS[t].icono, TIPOS[t].nombre, conteos[t] !== undefined ? `<span class="rt-nav-cuenta">${conteos[t]}</span>` : "")).join("")}
      ${item("parametros.html", "parametros", "⚙", "Parámetros e IPP")}
    </nav>
    <div class="spacer"></div>
    <div class="user-box rt-user-box">
      <strong>${esc(ctx.perfil?.nombre || ctx.user.email)}</strong>
      <div class="rt-user-acciones">
        <button type="button" class="rt-icono-btn" id="apTema" title="Cambiar modo claro/oscuro">🌓</button>
        <a class="rt-icono-btn" href="../control/cambiar-clave.html" title="Cambiar contraseña">🔒</a>
        <button type="button" class="rt-icono-btn" id="apSalir" title="Cerrar sesión">⏻</button>
      </div>
    </div>`;
  document.body.classList.add("rt-con-menu");
  aside.querySelector("#apSalir").addEventListener("click", cerrarSesion);
  aside.querySelector("#apTema").addEventListener("click", () => document.querySelector(".theme-toggle")?.click());
  const movil = aside.querySelector("#apMenuMovil");
  movil.addEventListener("click", () => {
    const abierto = aside.classList.toggle("ip-menu-abierto");
    movil.setAttribute("aria-expanded", String(abierto));
    movil.textContent = abierto ? "✕ Cerrar" : "☰ Menú";
  });
  return aside;
}

// Marca el ítem activo sin repintar (insumos.html cambia de tipo con el #hash).
export function marcarActivo(clave) {
  document.querySelectorAll("#sidebar nav a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const k = href.startsWith("insumos.html#") ? `insumos-${href.split("#")[1]}` : href === "inicio.html" ? "tablero" : href === "parametros.html" ? "parametros" : "";
    a.classList.toggle("active", k === clave);
  });
}
