// Inicio de un contrato: indicadores principales (tiempo, avance técnico,
// avance financiero, personal, garantías) y TODAS las alertas de los
// módulos en un solo lugar, cada una con enlace a su módulo.
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, iniciarPagina, pintarEncabezado, esc, numero, moneda, diasEntre, hoyISO, aplicarAnchos, hrefModulo, imgModulo } from "./ip-core.js";
import { MODULOS, CAPITULOS, avancePonderado, estadoFinanciero } from "./ip-modulos.js";

const ctx = await iniciarPagina();
if (ctx) iniciar(ctx);

async function iniciar({ contrato }) {
  pintarEncabezado(`${imgModulo("inicio", "ip-h1-foto")} Inicio`, contrato);

  // Todas las colecciones que necesitan las alertas, una sola lectura c/u.
  const conAlertas = Object.values(MODULOS).filter((m) => m.alertas && !m.porCapitulo);
  const colecciones = new Set(["personal", "actividades", "financiero", "garantias"]);
  conAlertas.forEach((m) => { colecciones.add(m.coleccion); (m.necesita || []).forEach((c) => colecciones.add(c)); });
  const datos = {};
  await Promise.all([...colecciones].map(async (c) => {
    const snap = await getDocs(collection(db, "ipContratos", contrato.id, c));
    datos[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }));

  // ---------------------------------------------------------- tarjetas
  const tecnico = avancePonderado(datos.actividades);
  const ef = estadoFinanciero(contrato, datos.financiero);
  const hoy = hoyISO();
  const tiempo = contrato.fechaInicio && contrato.fechaFin
    ? Math.max(0, Math.min(100, Math.round((diasEntre(contrato.fechaInicio, hoy) / (diasEntre(contrato.fechaInicio, contrato.fechaFin) || 1)) * 100)))
    : 0;
  const diasRestantes = contrato.fechaFin ? diasEntre(hoy, contrato.fechaFin) : null;
  const activos = datos.personal.filter((p) => p.estado !== "Retirado" && (!p.fechaRetiro || p.fechaRetiro >= hoy)).length;
  const garantiasMal = datos.garantias.filter((g) => MODULOS.garantias.validar(g).nivel !== "ok").length;

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
  const todas = [];
  conAlertas.forEach((m) => {
    const ctxM = { contrato, registros: datos[m.coleccion] || [], datos };
    (m.alertas(ctxM) || []).forEach((a) => todas.push({ ...a, modulo: m }));
  });
  todas.sort((a, b) => (a.nivel === "danger" ? 0 : 1) - (b.nivel === "danger" ? 0 : 1));
  document.getElementById("inicioAlertas").innerHTML = `<h2>⚠️ Para revisar (${todas.length})</h2>` + (todas.length
    ? `<ul class="ip-alertas">${todas.map((a) => `<li class="ip-alerta-${a.nivel}"><a href="${hrefModulo(a.modulo.id)}">${esc(a.modulo.label)}</a> — ${esc(a.texto)}</li>`).join("")}</ul>`
    : `<p class="ip-sin-margen">✅ Todo al día: ningún módulo tiene alertas.</p>`)
    + `<div class="ip-acciones-centro"><a class="btn secondary" href="avisos.html">📧 Avisar al gestor por correo</a></div>`;

  // ---------------------------------------------------------- capítulos
  document.getElementById("inicioCapitulos").innerHTML = `<h2>📚 Capítulos del informe</h2><div class="ip-capitulos">${CAPITULOS.map((c) => {
    const n = todas.filter((a) => c.items.some((it) => it.m === a.modulo.id)).length;
    const primero = c.items[0];
    return `<a class="ip-capitulo" href="${primero.href || hrefModulo(primero.m, primero.cap)}">${imgModulo(`cap-${c.id}`, "ip-capitulo-foto")}
      <span><strong>${c.numero}. ${esc(c.label)}</strong><br><span class="text-muted">${esc(c.desc)}</span></span>
      ${n ? `<span class="badge warn">${n}</span>` : '<span class="badge ok">✓</span>'}</a>`;
  }).join("")}</div>`;
}
