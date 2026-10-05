// Tablero de contratos: todos los contratos visibles para la persona (el
// gestor ve todos; el equipo, los suyos) en una tabla de una línea por
// contrato con su semáforo, y abajo el detalle del seleccionado (la fila 1
// por defecto). El estado de cada contrato se calcula con ip-resumen.js,
// igual que en Inicio.
import { iniciarPagina, pintarEncabezado, esc, numero, moneda, fechaCorta, aplicarAnchos, hrefModulo, imgModulo, fijarContratoActivo, hoyISO } from "./ip-core.js";
import { cargarDatosContrato, resumirContrato } from "./ip-resumen.js";

const SEMAFORO = {
  riesgo: { icono: "🔴", texto: "En riesgo", badge: "danger" },
  atencion: { icono: "🟡", texto: "Atención", badge: "warn" },
  ok: { icono: "🟢", texto: "Al día", badge: "ok" }
};
const INACTIVOS = ["Terminado", "Liquidado"];

const ctx = await iniciarPagina({ requiereContrato: false });
if (ctx) iniciar(ctx);

async function iniciar({ contratos, contrato: activo }) {
  pintarEncabezado(`${imgModulo("tablero", "ip-h1-foto")} Tablero de contratos`, null);
  const tarjetasEl = document.getElementById("tbTarjetas");
  const listaEl = document.getElementById("tbLista");
  const detalleEl = document.getElementById("tbDetalle");
  const filtroEl = document.getElementById("tbFiltro");
  const soloActivosEl = document.getElementById("tbSoloActivos");
  const contadorEl = document.getElementById("tbContador");

  if (!contratos.length) {
    tarjetasEl.innerHTML = `<div class="card"><p class="text-muted ip-sin-margen">No tienes contratos todavía. <a href="contratos.html">Ir a Contratos</a>.</p></div>`;
    return;
  }

  // De a 4 contratos a la vez para no saturar la conexión.
  const filas = [];
  let hechos = 0;
  const pendientes = [...contratos];
  async function trabajador() {
    while (pendientes.length) {
      const c = pendientes.shift();
      try {
        filas.push({ c, r: resumirContrato(c, await cargarDatosContrato(c.id)) });
      } catch (err) {
        filas.push({ c, error: err });
      }
      hechos++;
      tarjetasEl.innerHTML = `<div class="card"><p class="text-muted ip-sin-margen">Revisando los contratos… ${hechos} de ${contratos.length}</p></div>`;
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, contratos.length) }, trabajador));
  const orden = { riesgo: 0, atencion: 1, ok: 2 };
  filas.sort((a, b) => (orden[a.r?.semaforo] ?? 3) - (orden[b.r?.semaforo] ?? 3) || String(a.c.numero || "").localeCompare(String(b.c.numero || ""), "es", { numeric: true }));

  let seleccionado = null;
  const esActivo = (c) => !INACTIVOS.includes(c.estado);

  function visibles() {
    return filas.filter((f) => (!soloActivosEl.checked || esActivo(f.c)) && (!filtroEl.value || f.r?.semaforo === filtroEl.value));
  }

  function pintarTarjetas() {
    const base = filas.filter((f) => !soloActivosEl.checked || esActivo(f.c));
    const n = (s) => base.filter((f) => f.r?.semaforo === s).length;
    const alertas = base.reduce((s, f) => s + (f.r?.alertas.length || 0), 0);
    const tile = (i, icon, valor, label) => `<div class="stat-tile icon-tile cinta cinta-${i}"><div class="icon">${icon}</div><div class="text"><div class="value">${valor}</div><div class="label">${label}</div></div></div>`;
    tarjetasEl.innerHTML = `<div class="grid ip-tarjetas ip-tarjetas-5">
      ${tile(0, "📁", base.length, soloActivosEl.checked ? "Contratos activos" : "Contratos")}
      ${tile(1, "🔴", n("riesgo"), "En riesgo")}
      ${tile(2, "🟡", n("atencion"), "Requieren atención")}
      ${tile(3, "🟢", n("ok"), "Al día")}
      ${tile(0, "⚠️", alertas, "Alertas en total")}
    </div>`;
  }

  const barra = (pct, rojo) => `<div class="ip-mini-pista"><div class="ip-mini-relleno ${rojo ? "ip-rojo" : ""}" data-ancho="${pct}"></div></div>`;
  function textoPlazo(r) {
    if (r.diasRestantes == null) return "-";
    return r.diasRestantes >= 0 ? `${r.diasRestantes} d` : `−${-r.diasRestantes} d`;
  }

  function pintarLista() {
    const rows = visibles();
    contadorEl.textContent = `${rows.length} de ${filas.length} contrato(s)`;
    if (!rows.length) {
      listaEl.innerHTML = `<div class="card"><p class="text-muted ip-sin-margen">Ningún contrato coincide con el filtro.</p></div>`;
      detalleEl.innerHTML = "";
      return;
    }
    if (!seleccionado || !rows.some((f) => f.c.id === seleccionado)) seleccionado = rows[0].c.id;
    listaEl.innerHTML = `<div class="card ip-tabla-card"><div class="tabla-scroll"><table class="tabla-densa ip-tabla ip-tabla-tablero">
      <colgroup><col class="ip-w10"><col class="ip-w11"><col><col class="ip-w9"><col class="ip-w11"><col class="ip-w13"><col class="ip-w11"><col class="ip-w9"></colgroup>
      <thead><tr><th>Estado</th><th>Contrato</th><th>Contratante · objeto</th><th>Faltan</th><th>Tiempo</th><th>Avance técnico</th><th>Financiero</th><th>Alertas</th></tr></thead>
      <tbody>${rows.map(({ c, r, error }) => {
        const sel = c.id === seleccionado ? " ip-fila-activa" : "";
        if (error) return `<tr class="ip-fila${sel}" data-id="${c.id}"><td><span class="badge danger">Error</span></td><td><strong>${esc(c.numero || "-")}</strong></td><td colspan="6">No se pudo leer este contrato.</td></tr>`;
        const s = SEMAFORO[r.semaforo];
        return `<tr class="ip-fila${sel}" data-id="${c.id}">
          <td><span class="badge ${s.badge}">${s.icono} ${s.texto}</span></td>
          <td><strong>${esc(c.numero || "-")}</strong></td>
          <td title="${esc(`${c.contratante || ""} · ${c.objeto || ""}`)}">${esc(c.contratante || "-")}<span class="text-muted"> · ${esc(c.objeto || "")}</span></td>
          <td class="${r.plazoVencido ? "ip-texto-rojo" : ""}" title="${r.plazoVencido ? "Plazo vencido" : "Días para terminar"}">${textoPlazo(r)}</td>
          <td><div class="ip-celda-barra"><span>${r.tiempo}%</span>${barra(r.tiempo)}</div></td>
          <td><div class="ip-celda-barra"><span>${numero(r.tecnico.real, 1)}% <span class="text-muted">/ ${numero(r.tecnico.programado, 1)}</span></span>${barra(r.tecnico.real, r.atrasado)}</div></td>
          <td><div class="ip-celda-barra"><span>${numero(r.ef.pct, 1)}%</span>${barra(r.ef.pct)}</div></td>
          <td>${r.alertas.length ? `${r.rojas ? `<span class="badge danger">${r.rojas}</span> ` : ""}${r.alertas.length - r.rojas ? `<span class="badge warn">${r.alertas.length - r.rojas}</span>` : ""}` : '<span class="badge ok">0</span>'}</td>
        </tr>`;
      }).join("")}</tbody></table></div></div>`;
    aplicarAnchos(listaEl);
    listaEl.querySelectorAll("tr.ip-fila").forEach((tr) => tr.addEventListener("click", () => {
      seleccionado = tr.dataset.id;
      listaEl.querySelectorAll("tr.ip-fila").forEach((x) => x.classList.toggle("ip-fila-activa", x === tr));
      pintarDetalle();
    }));
    pintarDetalle();
  }

  // Detalle compacto "Etiqueta: valor" + todas las alertas del contrato.
  function pintarDetalle() {
    const f = filas.find((x) => x.c.id === seleccionado);
    if (!f) { detalleEl.innerHTML = ""; return; }
    const { c, r } = f;
    const dato = (k, v) => `<div class="ip-dato"><span>${k}:</span> <strong>${v || "-"}</strong></div>`;
    detalleEl.innerHTML = `<div class="cards-row ip-tablero-detalle">
      <div class="card cinta cinta-0">
        <h2>📁 Contrato ${esc(c.numero || "")}</h2>
        <div class="ip-datos">
          ${dato("Contratante", esc(c.contratante))}
          ${dato("Tipo", esc(c.tipo || "Servicios"))}
          ${dato("Estado", esc(c.estado || "Activo"))}
          ${dato("Director / interventor", esc(c.director))}
          ${dato("Inicio", fechaCorta(c.fechaInicio))}
          ${dato("Terminación", fechaCorta(c.fechaFin))}
          ${dato("Valor", c.valorInicial ? moneda(r ? r.ef.valorTotal : c.valorInicial) : "-")}
          ${r ? dato("Ejecutado", `${moneda(r.ef.ejecutado)} (${numero(r.ef.pct, 1)}%)`) : ""}
          ${r ? dato("Avance técnico", `${numero(r.tecnico.real, 1)}% de ${numero(r.tecnico.programado, 1)}% programado`) : ""}
          ${r ? dato("Personal activo", r.activos) : ""}
        </div>
        <p class="text-muted ip-dato-objeto">${esc(c.objeto || "")}</p>
        <div class="ip-acciones-centro">
          <button type="button" class="btn" data-abrir="inicio.html">Abrir contrato</button>
          <button type="button" class="btn secondary" data-abrir="informe.html">Informe mensual</button>
          <button type="button" class="btn secondary" data-abrir="avisos.html">📧 Avisos</button>
        </div>
      </div>
      <div class="card cinta cinta-1">
        <h2>⚠️ Para revisar (${r ? r.alertas.length : 0})</h2>
        ${!r ? '<p class="text-muted ip-sin-margen">No se pudo leer este contrato.</p>'
          : r.alertas.length ? `<ul class="ip-alertas">${r.alertas.map((a) => `<li class="ip-alerta-${a.nivel}"><a href="${hrefModulo(a.modulo.id)}" data-modulo="1">${esc(a.modulo.label)}</a> — ${esc(a.texto)}</li>`).join("")}</ul>`
          : '<p class="ip-sin-margen">✅ Todo al día: ningún módulo tiene alertas.</p>'}
      </div>
    </div>`;
    // Ir a cualquier página de ese contrato lo deja como contrato activo.
    detalleEl.querySelectorAll("[data-abrir]").forEach((b) => b.addEventListener("click", () => { fijarContratoActivo(c.id); location.href = b.dataset.abrir; }));
    detalleEl.querySelectorAll("a[data-modulo]").forEach((a) => a.addEventListener("click", () => fijarContratoActivo(c.id)));
  }

  function pintarTodo() { pintarTarjetas(); pintarLista(); }
  filtroEl.addEventListener("change", pintarLista);
  soloActivosEl.addEventListener("change", pintarTodo);
  if (activo) seleccionado = activo.id;
  pintarTodo();

  // ---------------------------------------------------------- Excel
  document.getElementById("tbExcelBtn").addEventListener("click", async () => {
    const ExcelJS = window.ExcelJS;
    if (!ExcelJS) { alert("No se pudo cargar el generador de Excel."); return; }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Tablero");
    // Anchos según el contenido esperado de cada columna.
    ws.columns = [
      { header: "Estado", key: "estado", width: 12 }, { header: "Contrato", key: "numero", width: 14 },
      { header: "Contratante", key: "contratante", width: 30 }, { header: "Objeto", key: "objeto", width: 60 },
      { header: "Inicio", key: "inicio", width: 12 }, { header: "Terminación", key: "fin", width: 12 },
      { header: "Días restantes", key: "dias", width: 10 }, { header: "Tiempo %", key: "tiempo", width: 9 },
      { header: "Avance técnico %", key: "real", width: 10 }, { header: "Programado %", key: "prog", width: 10 },
      { header: "Financiero %", key: "fin_pct", width: 10 }, { header: "Alertas rojas", key: "rojas", width: 9 },
      { header: "Alertas totales", key: "alertas", width: 9 }, { header: "Detalle de alertas", key: "detalle", width: 80 }
    ];
    visibles().forEach(({ c, r }) => ws.addRow({
      estado: r ? SEMAFORO[r.semaforo].texto : "Error", numero: c.numero || "", contratante: c.contratante || "", objeto: c.objeto || "",
      inicio: fechaCorta(c.fechaInicio), fin: fechaCorta(c.fechaFin), dias: r?.diasRestantes ?? "", tiempo: r?.tiempo ?? "",
      real: r ? Number(r.tecnico.real.toFixed(1)) : "", prog: r ? Number(r.tecnico.programado.toFixed(1)) : "", fin_pct: r ? Number(r.ef.pct.toFixed(1)) : "",
      rojas: r?.rojas ?? "", alertas: r?.alertas.length ?? "", detalle: r ? r.alertas.map((a) => `${a.modulo.label}: ${a.texto}`).join("\n") : ""
    }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9820B" } };
    ws.getRow(1).alignment = { wrapText: true, vertical: "middle" };
    ws.eachRow((row, i) => { if (i > 1) row.alignment = { wrapText: true, vertical: "top" }; });
    const buffer = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = `Tablero de contratos ${hoyISO()}.xlsx`;
    a.click();
  });
}
