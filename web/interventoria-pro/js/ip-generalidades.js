// Generalidades de Interventoría PRO: propósito, principios, roles, flujo
// de trabajo, convenciones y, por capítulo, qué controla cada módulo (de
// ip-guias.js). Redactado en términos generales; lo específico, solo como
// ejemplo.
import { iniciarPagina, pintarEncabezado, esc, imgModulo, hrefModulo } from "./ip-core.js";
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
    <h2 class="ip-gen-titulo" id="gen-capitulos">Qué controla cada capítulo</h2>
    <p class="text-muted ip-descripcion">Cada módulo explica en su parte superior qué se controla, cómo se controla y qué revisa el aplicativo por sí solo.</p>
    <div class="ip-informe-grid">${capitulos}</div>`;

  // El contenido se arma después de cargar: se lleva a la sección pedida
  // (#gen-...) a mano, también cuando se elige otra desde el menú sin
  // salir de la página.
  const irASeccion = () => {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  irASeccion();
  window.addEventListener("hashchange", irASeccion);
}
