// Cálculo rápido: lista de cálculos por área; cada uno abre la página de
// cálculo sin proyecto (calculo.html?rapido=1&m=módulo).
import { iniciarPagina, esc, modulosPorArea } from "./rt-core.js";
import { MODULOS, AREAS } from "./rt-modulos.js";
import { menuInicio } from "./rt-shell.js";

const ctx = await iniciarPagina();
if (ctx) {
  menuInicio(ctx, { activo: "rapido" });
  const borrador = (m) => { try { return !!localStorage.getItem(`ahinco-rapido-${m}`); } catch { return false; } };
  document.getElementById("modulos").className = "rt-selector-areas rt-rapido-areas";
  document.getElementById("modulos").innerHTML = Object.entries(AREAS).map(([a, info]) => `<section class="card rt-selector-area ${info.clase}"><h3>${esc(info.nombre)}</h3><div class="rt-selector-lista">
    ${modulosPorArea(a).map((m) => `<a class="rt-selector-item" href="calculo.html?rapido=1&m=${m}"><span class="rt-modulo-icono">${MODULOS[m].icono}</span><span><strong>${esc(MODULOS[m].titulo)}</strong><small>${esc(MODULOS[m].objeto)}</small>${borrador(m) ? "<em>Hay un borrador guardado</em>" : ""}</span></a>`).join("")}
  </div></section>`).join("");
}
