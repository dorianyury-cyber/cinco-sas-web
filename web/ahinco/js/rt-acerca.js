// Página «Alcance y validación»: límites generales, validación, alcance y
// limitaciones de cada cálculo (rt-alcance.js) y mejoras previstas.
import { iniciarPagina, esc, modulosPorArea } from "./rt-core.js";
import { MODULOS, AREAS } from "./rt-modulos.js";
import { ALCANCE, VALIDACION, LIMITACIONES_GENERALES, MEJORAS } from "./rt-alcance.js";
import { menuInicio } from "./rt-shell.js";

const ctx = await iniciarPagina();
if (ctx) {
  menuInicio(ctx, { activo: "acerca" });
  const lista = (arr) => arr.map((t) => `<li>${esc(t)}</li>`).join("");
  document.getElementById("generales").innerHTML = lista(LIMITACIONES_GENERALES);
  document.getElementById("validacion").innerHTML = lista(VALIDACION);
  document.getElementById("modulos").innerHTML = Object.entries(AREAS).map(([a, info]) => `
    <section class="rt-alcance-area ${info.clase}">
      <h3>${esc(info.nombre)}</h3>
      ${modulosPorArea(a).map((m) => `<details class="rt-alcance">
        <summary>${MODULOS[m].icono} ${esc(MODULOS[m].titulo)}</summary>
        <p><strong>Método:</strong> ${esc(ALCANCE[m]?.metodo || "")}</p>
        <ul>${lista(ALCANCE[m]?.limitaciones || [])}</ul>
      </details>`).join("")}
    </section>`).join("");
  document.getElementById("mejoras").innerHTML = `<div class="tabla-scroll"><table class="rt-tabla-res"><colgroup><col class="rt-w-prioridad"><col></colgroup><thead><tr><th>Prioridad</th><th>Mejora</th></tr></thead><tbody>${MEJORAS.map(([p, t]) => `<tr><td><span class="badge ${p === "Alta" ? "danger" : p === "Media" ? "warn" : "muted"}">${esc(p)}</span></td><td>${esc(t)}</td></tr>`).join("")}</tbody></table></div>`;
}
