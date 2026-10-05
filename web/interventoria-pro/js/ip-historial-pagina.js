// Historial de cambios del contrato activo: las últimas 1000 entradas, con
// filtros por módulo, persona, acción y texto, y exportación a Excel.
import { query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { iniciarPagina, pintarEncabezado, esc, imgModulo, errorAmigable } from "./ip-core.js";
import { refHistorial, ACCIONES, fechaHora } from "./ip-historial.js";
import { mostrarLibro } from "./ip-visor.js";

const ctx = await iniciarPagina({ permiso: "verHistorial" });
if (ctx) iniciar(ctx);

async function iniciar({ contrato }) {
  pintarEncabezado(`${imgModulo("historial", "ip-h1-foto")} Historial de cambios`, contrato);
  const lista = document.getElementById("hLista");
  const fMod = document.getElementById("hFiltroModulo");
  const fUsu = document.getElementById("hFiltroUsuario");
  const fAcc = document.getElementById("hFiltroAccion");
  const fTxt = document.getElementById("hBuscar");
  let entradas = [];
  try {
    const snap = await getDocs(query(refHistorial(contrato.id), orderBy("fecha", "desc"), limit(1000)));
    entradas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    lista.innerHTML = `<div class="alert error">${esc(errorAmigable(err))}</div>`;
    return;
  }
  const opciones = (sel, pares) => {
    sel.innerHTML += [...pares].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"))
      .map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
  };
  opciones(fMod, new Map(entradas.map((h) => [h.modulo, h.moduloLabel || h.modulo])));
  opciones(fUsu, new Map(entradas.map((h) => [h.usuario, h.usuarioNombre || h.usuario])));
  opciones(fAcc, new Map(entradas.map((h) => [h.accion, ACCIONES[h.accion] || h.accion])));

  const detalle = (h) => (h.cambios || []).map((c) => (h.accion === "editar" || h.accion === "contrato")
    ? `${c.etiqueta}: ${c.antes} → ${c.despues}`
    : `${c.etiqueta}: ${c.despues}`).join(" · ");

  function filtradas() {
    const t = fTxt.value.trim().toLowerCase();
    return entradas.filter((h) => (!fMod.value || h.modulo === fMod.value)
      && (!fUsu.value || h.usuario === fUsu.value)
      && (!fAcc.value || h.accion === fAcc.value)
      && (!t || `${h.moduloLabel} ${h.usuarioNombre} ${h.resumen} ${detalle(h)}`.toLowerCase().includes(t)));
  }
  function pintar() {
    const rows = filtradas();
    document.getElementById("hContador").textContent = `${rows.length} de ${entradas.length} cambio(s)`;
    if (!rows.length) {
      lista.innerHTML = `<div class="card"><p class="text-muted ip-sin-margen">${entradas.length ? "Ningún cambio coincide con los filtros." : "Aún no hay cambios registrados en este contrato."}</p></div>`;
      return;
    }
    const filas = rows.map((h) => `<tr class="ip-hist-${esc(h.accion)}">
      <td>${esc(fechaHora(h.fecha))}</td><td>${esc(h.usuarioNombre)}</td><td>${esc(ACCIONES[h.accion] || h.accion)}</td>
      <td>${esc(h.moduloLabel || h.modulo)}</td><td>${esc(h.resumen || "—")}</td><td class="ip-hist-cambios">${esc(detalle(h) || "—")}</td></tr>`).join("");
    lista.innerHTML = `<div class="card ip-tabla-card"><div class="tabla-scroll"><table class="tabla-compacta ip-tabla ip-tabla-hist">
      <colgroup><col class="ip-w12"><col class="ip-w12"><col class="ip-w10"><col class="ip-w12"><col class="ip-w18"><col></colgroup>
      <thead><tr><th>Fecha y hora</th><th>Persona</th><th>Acción</th><th>Módulo</th><th>Registro</th><th>Cambios</th></tr></thead>
      <tbody>${filas}</tbody></table></div></div>`;
  }
  [fMod, fUsu, fAcc].forEach((s) => s.addEventListener("change", pintar));
  fTxt.addEventListener("input", pintar);
  pintar();

  document.getElementById("hExcelBtn").addEventListener("click", async () => {
    const wb = new window.ExcelJS.Workbook();
    const ws = wb.addWorksheet("Historial");
    ws.columns = [
      { header: "Fecha y hora", key: "f", width: 18 }, { header: "Persona", key: "u", width: 26 },
      { header: "Acción", key: "a", width: 16 }, { header: "Módulo", key: "m", width: 26 },
      { header: "Registro", key: "r", width: 40 }, { header: "Cambios", key: "c", width: 80 }
    ];
    filtradas().forEach((h) => ws.addRow({ f: fechaHora(h.fecha), u: h.usuarioNombre, a: ACCIONES[h.accion] || h.accion, m: h.moduloLabel || h.modulo, r: h.resumen || "", c: detalle(h) }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2732" } };
    ws.getColumn("c").alignment = { wrapText: true, vertical: "top" };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    mostrarLibro(wb, `Historial de cambios (Contrato ${String(contrato.numero || "").replace(/[\/:*?"<>|]/g, "-")}).xlsx`, { titulo: "Vista previa — Historial de cambios", nota: `${filtradas().length} cambio(s) según los filtros actuales.` });
  });
}
