// Generalidades de Interventoría PRO: propósito, principios, roles, flujo
// de trabajo, convenciones y, por capítulo, qué controla cada módulo (de
// ip-guias.js). Redactado en términos generales; lo específico, solo como
// ejemplo.
import { iniciarPagina, pintarEncabezado, esc, imgModulo, hrefModulo, SECCIONES_GENERALIDADES } from "./ip-core.js";
import { CAPITULOS, MODULOS } from "./ip-modulos.js";
import { GUIAS, GENERALIDADES as G } from "./ip-guias.js";

const ctx = await iniciarPagina({ requiereContrato: false });
if (ctx) {
  pintarEncabezado(`${imgModulo("generalidades", "ip-h1-foto")} Generalidades`, ctx.contrato);
  const capitulos = CAPITULOS.map((cap, i) => {
    const items = cap.items.map((it) => {
      if (it.href) return `<li><a href="${it.href}">${esc(it.label)}</a> — datos básicos del contrato, sus frentes y su equipo.</li>`;
      const mod = MODULOS[it.m];
      const g = GUIAS[it.m];
      return `<li><a href="${hrefModulo(it.m, it.cap)}">${esc(it.label || mod.label)}</a> — ${esc(g ? g.que : mod.desc)}</li>`;
    }).join("");
    return `<div class="card cinta cinta-${i % 4}"><h2>${imgModulo(`cap-${cap.id}`, "ip-capitulo-foto")} ${cap.numero}. ${esc(cap.label)}</h2><ul class="ip-gen-lista">${items}</ul></div>`;
  }).join("");

  document.getElementById("generalidadesContenido").innerHTML = `
    <div class="card cinta cinta-0 ip-gen-intro" id="gen-que">
      <h2>¿Qué es Interventoría PRO?</h2>
      <p>${esc(G.proposito)}</p>
    </div>
    <div class="cards-row" id="gen-roles">
      <div class="card cinta cinta-1"><h2>Principios de uso</h2><ul class="ip-gen-lista">${G.principios.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
      <div class="card cinta cinta-2"><h2>Roles</h2><ul class="ip-gen-lista">${G.roles.map(([r, d]) => `<li><strong>${esc(r)}:</strong> ${esc(d)}</li>`).join("")}</ul></div>
    </div>
    <div class="card cinta cinta-3" id="gen-flujo"><h2>Flujo de trabajo</h2>
      <ol class="ip-gen-flujo">${G.flujo.map(([e, d]) => `<li><strong>${esc(e)}.</strong> ${esc(d)}</li>`).join("")}</ol>
    </div>
    <div id="gen-rutina">
      <h2 class="ip-gen-titulo">Rutina de la interventoría</h2>
      <p class="text-muted ip-descripcion">Lo que el grupo interventor debería revisar cada día, cada semana y cada mes. Cada actividad lleva al módulo donde se hace.</p>
      <div class="ip-rutina">${G.rutina.map((r, i) => `<div class="card cinta cinta-${(i + 1) % 4}">
        <h2>${r.icono} ${esc(r.periodo)}</h2><p class="text-muted ip-rutina-desc">${esc(r.desc)}</p>
        <ul class="ip-rutina-lista">${r.items.map(([t, href]) => `<li>${href ? `<a href="${href}">${esc(t)}</a>` : esc(t)}</li>`).join("")}</ul>
      </div>`).join("")}</div>
    </div>
    <div class="card cinta cinta-0" id="gen-convenciones"><h2>Convenciones</h2><ul class="ip-gen-lista">${G.convenciones.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
    <div id="gen-capitulos">
      <h2 class="ip-gen-titulo">Qué controla cada capítulo</h2>
      <p class="text-muted ip-descripcion">Cada módulo explica en su parte superior qué se controla, cómo se controla y qué revisa el aplicativo por sí solo.</p>
      <div class="ip-informe-grid">${capitulos}</div>
    </div>
    <div class="ip-gen-nav" id="genNav"></div>`;

  // Desde un submenú de "Conoce el aplicativo" (#gen-...) se muestra SOLO
  // esa sección, con anterior / siguiente y "Ver todas"; sin ancla se ve
  // la página completa. Funciona también al cambiar de tema sin salir.
  const nav = document.getElementById("genNav");
  const secciones = SECCIONES_GENERALIDADES.filter((s) => document.getElementById(s.id));
  const mostrar = () => {
    const id = location.hash.slice(1);
    const i = secciones.findIndex((s) => s.id === id);
    document.querySelectorAll('.sidebar a[href^="generalidades.html#"]').forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `generalidades.html#${id}`));
    secciones.forEach((s) => document.getElementById(s.id).classList.toggle("hidden", i >= 0 && s.id !== id));
    if (i < 0) {
      nav.innerHTML = "";
      pintarEncabezado(`${imgModulo("generalidades", "ip-h1-foto")} Generalidades`, ctx.contrato);
      return;
    }
    const s = secciones[i];
    pintarEncabezado(`${imgModulo(s.foto, "ip-h1-foto")} ${esc(s.label)}`, ctx.contrato, "Conoce el aplicativo");
    const ant = secciones[i - 1], sig = secciones[i + 1];
    nav.innerHTML = `${ant ? `<a class="btn secondary" href="#${ant.id}">← ${esc(ant.label)}</a>` : "<span></span>"}
      <a class="btn secondary" href="generalidades.html">Ver todas las secciones</a>
      ${sig ? `<a class="btn secondary" href="#${sig.id}">${esc(sig.label)} →</a>` : "<span></span>"}`;
    window.scrollTo({ top: 0 });
  };
  mostrar();
  window.addEventListener("hashchange", mostrar);
}
