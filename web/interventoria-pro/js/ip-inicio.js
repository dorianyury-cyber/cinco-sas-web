// Inicio de un contrato: indicadores principales (tiempo, avance técnico,
// avance financiero, personal, garantías) y TODAS las alertas de los
// módulos en un solo lugar, cada una con enlace a su módulo.
import { iniciarPagina, pintarEncabezado, esc, numero, moneda, aplicarAnchos, hrefModulo, imgModulo } from "./ip-core.js";
import { CAPITULOS } from "./ip-modulos.js";
import { cargarDatosContrato, resumirContrato } from "./ip-resumen.js";

const ctx = await iniciarPagina();
if (ctx) iniciar(ctx);

async function iniciar({ contrato, puede }) {
  pintarEncabezado(`${imgModulo("inicio", "ip-h1-foto")} Inicio`, contrato);

  const datos = await cargarDatosContrato(contrato.id);
  const { tecnico, ef, tiempo, diasRestantes, activos, garantiasMal, alertas: todas } = resumirContrato(contrato, datos);

  const barra = (pct, clase = "") => `<div class="ip-mini-pista"><div class="ip-mini-relleno ${clase}" data-ancho="${pct}"></div></div>`;
  const tile = (i, icon, valor, label, extra = "") => `
    <div class="stat-tile icon-tile cinta cinta-${i % 4}"><div class="icon">${icon}</div>
      <div class="text"><div class="value">${valor}</div><div class="label">${label}</div>${extra}</div></div>`;
  const cont = document.getElementById("inicioTarjetas");
  cont.innerHTML = `<div class="grid ip-tarjetas">
    ${tile(0, "⏱️", `${tiempo}%`, diasRestantes == null ? "Tiempo transcurrido" : diasRestantes >= 0 ? `Tiempo transcurrido · faltan ${diasRestantes} días` : `Plazo vencido hace ${-diasRestantes} días`, barra(tiempo))}
    ${tile(1, "📊", `${numero(tecnico.real, 1)}%`, `Avance técnico (programado ${numero(tecnico.programado, 1)}%)`, barra(tecnico.real, tecnico.real < tecnico.programado - 5 ? "ip-rojo" : ""))}
    ${tile(2, "💰", `${numero(ef.pct, 1)}%`, `Avance financiero · ${moneda(ef.ejecutado)} de ${moneda(ef.valorTotal)}`, barra(ef.pct))}
    ${tile(3, "👷", activos, "Personal activo en el contrato")}
    ${tile(0, garantiasMal ? "⚠️" : "🛡️", garantiasMal ? garantiasMal : datos.garantias.length, garantiasMal ? "Garantías vencidas o por vencer" : "Garantías vigentes")}
  </div>`;
  aplicarAnchos(cont);

  // ---------------------------------------------------------- alertas
  document.getElementById("inicioAlertas").innerHTML = `<h2>⚠️ Para revisar (${todas.length})</h2>` + (todas.length
    ? `<ul class="ip-alertas">${todas.map((a) => `<li class="ip-alerta-${a.nivel}"><a href="${hrefModulo(a.modulo.id)}">${esc(a.modulo.label)}</a> — ${esc(a.texto)}</li>`).join("")}</ul>`
    : `<p class="ip-sin-margen">✅ Todo al día: ningún módulo tiene alertas.</p>`)
    + (puede.enviarAvisos ? `<div class="ip-acciones-centro"><a class="btn secondary" href="avisos.html">📧 Avisar al gestor por correo</a></div>` : "");

  // ---------------------------------------------------------- capítulos
  document.getElementById("inicioCapitulos").innerHTML = `<h2>📚 Capítulos del informe</h2><div class="ip-capitulos">${CAPITULOS.map((c) => {
    const n = todas.filter((a) => c.items.some((it) => it.m === a.modulo.id)).length;
    const primero = c.items[0];
    return `<a class="ip-capitulo" href="${primero.href || hrefModulo(primero.m, primero.cap)}">${imgModulo(`cap-${c.id}`, "ip-capitulo-foto")}
      <span><strong>${c.numero}. ${esc(c.label)}</strong><br><span class="text-muted">${esc(c.desc)}</span></span>
      ${n ? `<span class="badge warn">${n}</span>` : '<span class="badge ok">✓</span>'}</a>`;
  }).join("")}</div>`;
}
