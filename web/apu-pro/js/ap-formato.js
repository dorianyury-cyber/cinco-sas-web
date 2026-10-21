// Formato Cinco de un APU: hoja para pantalla/impresión (HTML) y libro de Excel con
// fórmulas, con la estructura de los reportes de Cinco S.A.S. (logo, bandas ámbar,
// capítulos A a E, subtotales, costo directo, AIU, IVA y valor total).
import { esc, pesos, numero, fechaCorta, hoyISO } from "./ap-core.js";
import { CAPITULOS, precioConAiu } from "./ap-apu.js";

// Columnas comunes a los cinco capítulos (A a G), para que todo quede alineado.
export const COLUMNAS = {
  MA: ["Referencia", "Descripción", "Unidad", "Cantidad", "Vr. unitario", "Desperdicio", "Vr. total"],
  MO: ["Referencia", "Cargo", "Fac. salarial", "Cantidad", "Jornal", "Prestaciones", "Vr. total"],
  EH: ["Referencia", "Descripción", "Unidad", "Cantidad", "Vr. mensual", "", "Vr. total"],
  ED: ["Referencia", "Descripción", "Unidad", "Personas", "Vr. mensual", "", "Vr. total"],
  TV: ["Referencia", "Descripción", "Unidad", "Cantidad", "Vr. mensual o unitario", "", "Vr. total"]
};
const ANCHOS = [10, 37, 8, 12, 12, 9, 12]; // % en pantalla
const NOMBRE_IVA = (o) => (o.regimenIva === "total" ? `IVA ${numero(o.iva * 100, 0)} % sobre el subtotal` : `IVA ${numero(o.iva * 100, 0)} % sobre la utilidad`);

function filaHtml(tipo, f) {
  const c = (v, num = true) => `<td class="${num ? "cf-num" : ""}">${v}</td>`;
  const falta = f.falta ? ' <span class="cf-aviso">no está en la base</span>' : f.unitario == null ? ' <span class="cf-aviso">sin precio</span>' : "";
  const ref = `<td class="cf-ref">${esc(f.codigo)}</td><td>${esc(f.descripcion || "—")}${falta}</td>`;
  if (tipo === "MO") return `<tr>${ref}${c(numero(f.factor, 2))}${c(numero(f.cantidad, 3))}${c(pesos(f.jornal))}${c(pesos(f.prestaciones))}${c(pesos(f.total))}</tr>`;
  const unit = f.unitario == null ? "—" : pesos(f.unitario, f.unitario < 100 ? 2 : 0) + (tipo === "TV" && f.porUnidad ? " /und" : "");
  const extra = tipo === "MA" ? (f.desperdicio ? `${numero(f.desperdicio * 100, 1)} %` : "—") : "";
  const cant = tipo === "ED" && f.modo !== "fija" ? `${numero(f.cantidad, 3)}<small> cuadrilla</small>` : numero(f.cantidad, 4);
  return `<tr>${ref}<td class="cf-centro">${esc(f.unidad)}</td>${c(cant)}${c(unit)}${c(extra)}${c(pesos(f.total))}</tr>`;
}

// apu, res (calcularApu), opciones: { parametros, aiu: {a,i,u}, iva, regimenIva, proyecto, fecha }
export function htmlFormatoApu(apu, res, o) {
  const t = precioConAiu(res.costoDirecto, o);
  const p = o.parametros;
  return `<article class="cf-hoja">
    <header class="cf-cabeza">
      <img class="cf-logo" src="../assets/img/logo-texto-oscuro.png" alt="CINCO S.A.S.">
      <div class="cf-titulo">
        <h1>Análisis de precios unitarios</h1>
        <p>${o.proyecto ? esc(o.proyecto) : "Biblioteca de APU de Cinco S.A.S."}</p>
      </div>
      <dl class="cf-meta"><div><dt>Fecha</dt><dd>${fechaCorta(o.fecha || hoyISO())}</dd></div><div><dt>Versión</dt><dd>${apu.version || 1}</dd></div></dl>
    </header>

    <section class="cf-datos">
      <div class="cf-dato cf-codigo"><span>Código APU</span><strong>${esc(apu.codigo)}</strong></div>
      <div class="cf-dato cf-nombre"><span>Nombre del APU</span><strong>${esc(apu.nombre)}</strong></div>
      <div class="cf-dato"><span>Unidad</span><strong>${esc(apu.unidad)}</strong></div>
      <div class="cf-dato"><span>Rendimiento</span><strong>${numero(apu.rendimiento, 3)} ${esc(apu.unidad)}/día</strong></div>
      <div class="cf-dato"><span>Categoría</span><strong>${esc(apu.categoria || "—")}</strong></div>
      <div class="cf-dato cf-ancho"><span>Parámetros ${p?.anio || ""}</span><strong>${p ? `Salario mínimo ${pesos(p.smmlv)} · Aux. transporte ${pesos(p.auxTransporte)} · Prestaciones ${numero(p.prestacional * 100, 0)} % · ${p.diasHabiles} días hábiles` : "Sin parámetros"}</strong></div>
    </section>

    ${CAPITULOS.map(({ tipo, letra, nombre }) => {
      const filas = res.capitulos[tipo] || [];
      return `<table class="cf-tabla">
        <colgroup>${ANCHOS.map((a) => `<col data-ancho="${a}">`).join("")}</colgroup>
        <thead><tr class="cf-cap"><th colspan="7">${letra}. ${esc(nombre)}</th></tr>
        <tr class="cf-enc">${COLUMNAS[tipo].map((h, j) => `<th class="${j >= 3 ? "cf-num" : j === 2 ? "cf-centro" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${filas.length ? filas.map((f) => filaHtml(tipo, f)).join("") : '<tr><td colspan="7" class="cf-vacio">Sin insumos en este capítulo</td></tr>'}</tbody>
        <tfoot><tr class="cf-sub"><td colspan="6">Subtotal ${letra}</td><td class="cf-num">${pesos(res.subtotales[tipo])}</td></tr></tfoot>
      </table>`;
    }).join("")}

    <section class="cf-resumen">
      <table>
        <tr class="cf-cd"><td>Costo directo (A + B + C + D + E)</td><td></td><td class="cf-num">${pesos(res.costoDirecto)}</td></tr>
        <tr><td>Administración</td><td class="cf-num">${numero(o.aiu.a * 100, 2)} %</td><td class="cf-num">${pesos(t.a)}</td></tr>
        <tr><td>Imprevistos</td><td class="cf-num">${numero(o.aiu.i * 100, 2)} %</td><td class="cf-num">${pesos(t.i)}</td></tr>
        <tr><td>Utilidad</td><td class="cf-num">${numero(o.aiu.u * 100, 2)} %</td><td class="cf-num">${pesos(t.u)}</td></tr>
        <tr class="cf-st"><td>Subtotal costo directo + AIU</td><td></td><td class="cf-num">${pesos(t.subtotal)}</td></tr>
        <tr><td>${NOMBRE_IVA(o)}</td><td></td><td class="cf-num">${pesos(t.iva)}</td></tr>
        <tr class="cf-total"><td>Valor total del APU</td><td></td><td class="cf-num">${pesos(t.total)}</td></tr>
      </table>
    </section>
    <footer class="cf-pie">Cinco S.A.S. — Construcción, Ingeniería y Consultoría · Generado con APU PRO · ${o.proyecto ? "Precios del proyecto" : "Precios de la base de insumos vigentes a la fecha"}; cada línea se redondea ${o.redondeo === "normal" ? "al peso más cercano" : "hacia arriba al peso"}.</footer>
  </article>`;
}

// ---------------------------------------------------------------- Excel
const AMBAR = "FFFEB209", AMBAR_SUAVE = "FFFFF3D1", AZUL = "FF1F2732", GRIS = "FFF2F3F5", BORDE = "FFBFC4CC";
const borde = { top: { style: "thin", color: { argb: BORDE } }, left: { style: "thin", color: { argb: BORDE } }, bottom: { style: "thin", color: { argb: BORDE } }, right: { style: "thin", color: { argb: BORDE } } };
const MONEDA = '"$"#,##0', MONEDA2 = '"$"#,##0.00';
// Formato de cantidad sin coma final en los enteros (4 en vez de «4,»).
const CANT = (v) => (Number.isInteger(Number(v)) ? "#,##0" : "#,##0.00##");

// items: [{ apu, res }]; opciones: igual que htmlFormatoApu + logo (base64 PNG sin prefijo).
export function libroFormatoApus(ExcelJS, items, o) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cinco S.A.S. — APU PRO";
  const logo = o.logo ? wb.addImage({ base64: o.logo, extension: "png" }) : null;
  const usados = new Set();
  for (const { apu, res } of items) {
    let nombre = apu.codigo.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
    while (usados.has(nombre)) nombre = `${nombre.slice(0, 28)}-${usados.size}`;
    usados.add(nombre);
    hojaApu(wb, nombre, apu, res, o, logo);
  }
  return wb;
}

export function hojaApu(wb, nombre, apu, res, o, logo) {
  const RED = o.redondeo === "normal" ? "ROUND" : "ROUNDUP"; // mismo redondeo del cálculo
  const ws = wb.addWorksheet(nombre, { pageSetup: { paperSize: 1, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 12 }, { width: 46 }, { width: 10 }, { width: 11 }, { width: 15 }, { width: 13 }, { width: 16 }];
  const p = o.parametros || {};
  const set = (dir, valor, estilo = {}) => { const c = ws.getCell(dir); c.value = valor; Object.assign(c, estilo); return c; };
  const relleno = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const fuente = (extra = {}) => ({ name: "Calibri", size: 10, ...extra });

  // Encabezado: logo, título y fecha
  ws.getRow(1).height = 22; ws.getRow(2).height = 22; ws.getRow(3).height = 18;
  if (logo != null) ws.addImage(logo, { tl: { col: 0.1, row: 0.15 }, ext: { width: 150, height: 72 } });
  ws.mergeCells("C1:F2");
  set("C1", "ANÁLISIS DE PRECIOS UNITARIOS", { font: fuente({ size: 15, bold: true, color: { argb: AZUL } }), alignment: { vertical: "middle", horizontal: "center" } });
  ws.mergeCells("C3:F3");
  set("C3", o.proyecto || "Biblioteca de APU de Cinco S.A.S.", { font: fuente({ size: 10, color: { argb: "FF5A6270" } }), alignment: { horizontal: "center" } });
  set("G1", "Fecha", { font: fuente({ size: 8, color: { argb: "FF5A6270" } }), alignment: { horizontal: "right" } });
  set("G2", fechaCorta(o.fecha || hoyISO()), { font: fuente({ bold: true }), alignment: { horizontal: "right" } });
  set("G3", `Versión ${apu.version || 1}`, { font: fuente({ size: 8, color: { argb: "FF5A6270" } }), alignment: { horizontal: "right" } });
  for (let c = 1; c <= 7; c++) ws.getCell(4, c).border = { bottom: { style: "medium", color: { argb: AMBAR } } };

  // Datos del APU (G6 = rendimiento y G8 = días hábiles: los usan las fórmulas)
  const etiqueta = (dir) => Object.assign(ws.getCell(dir), { font: fuente({ bold: true, size: 9, color: { argb: AZUL } }), fill: relleno(AMBAR), border: borde, alignment: { vertical: "middle", horizontal: "center", wrapText: true } });
  const valor = (dir) => Object.assign(ws.getCell(dir), { font: fuente({ size: 10 }), border: borde, alignment: { vertical: "middle", wrapText: true } });
  set("A5", "Código APU"); etiqueta("A5");
  ws.mergeCells("B5:E5"); set("B5", "Nombre del APU"); etiqueta("B5");
  set("F5", "Unidad"); etiqueta("F5");
  set("G5", "Rendimiento (und/día)"); etiqueta("G5");
  set("A6", apu.codigo); valor("A6").alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells("B6:E6"); set("B6", apu.nombre); valor("B6");
  set("F6", apu.unidad); valor("F6").alignment = { horizontal: "center", vertical: "middle" };
  set("G6", Number(apu.rendimiento) || 0); valor("G6").numFmt = CANT(apu.rendimiento);
  ws.getRow(6).height = Math.max(18, Math.ceil(String(apu.nombre).length / 62) * 14);
  set("A7", "Categoría"); etiqueta("A7");
  ws.mergeCells("B7:E7"); set("B7", apu.categoria || "—"); valor("B7");
  set("F7", "Días hábiles"); etiqueta("F7");
  set("G7", Number(p.diasHabiles) || 21); valor("G7");
  ws.mergeCells("A8:G8");
  set("A8", p.anio ? `Parámetros ${p.anio}: salario mínimo ${pesos(p.smmlv)} · auxilio de transporte ${pesos(p.auxTransporte)} · prestaciones ${numero(p.prestacional * 100, 0)} % · jornal = (factor × salario mínimo + auxilio${p.auxModo === "porFactor" ? " × factor" : ""} si el factor ≤ 2) ÷ días hábiles` : "Sin parámetros del año", { font: fuente({ size: 8.5, italic: true, color: { argb: "FF5A6270" } }), alignment: { wrapText: true } });
  ws.getRow(8).height = 24;

  // Capítulos
  let fila = 10;
  const subtotales = [];
  for (const { tipo, letra, nombre: nom } of CAPITULOS) {
    ws.mergeCells(fila, 1, fila, 7);
    Object.assign(ws.getCell(fila, 1), { value: `${letra}. ${nom.toUpperCase()}`, font: fuente({ bold: true, size: 10.5, color: { argb: AZUL } }), fill: relleno(AMBAR), alignment: { vertical: "middle" }, border: borde });
    ws.getRow(fila).height = 18;
    fila++;
    COLUMNAS[tipo].forEach((h, j) => Object.assign(ws.getCell(fila, j + 1), { value: h, font: fuente({ bold: true, size: 9 }), fill: relleno(GRIS), border: borde, alignment: { horizontal: j >= 2 ? "center" : "left", vertical: "middle", wrapText: true } }));
    fila++;
    const ini = fila;
    const filas = res.capitulos[tipo] || [];
    if (!filas.length) {
      ws.mergeCells(fila, 1, fila, 6);
      Object.assign(ws.getCell(fila, 1), { value: "Sin insumos en este capítulo", font: fuente({ italic: true, size: 9, color: { argb: "FF8A919C" } }), border: borde });
      Object.assign(ws.getCell(fila, 7), { value: 0, numFmt: MONEDA, border: borde });
      fila++;
    }
    for (const f of filas) {
      const r = ws.getRow(fila);
      const celda = (c, v, fmt, extra = {}) => Object.assign(r.getCell(c), { value: v, numFmt: fmt, border: borde, font: fuente(), alignment: { vertical: "top", horizontal: c >= 3 ? "right" : "left", wrapText: c === 2 }, ...extra });
      celda(1, f.codigo, undefined, { alignment: { horizontal: "center", vertical: "top" } });
      celda(2, f.descripcion || "");
      const dir = (c) => r.getCell(c).address;
      if (tipo === "MO") {
        celda(3, f.factor ?? null, CANT(f.factor));
        celda(4, f.cantidad, CANT(f.cantidad));
        celda(5, f.jornal != null ? Math.round(f.jornal * 100) / 100 : null, MONEDA);
        celda(6, f.prestaciones != null ? Math.round(f.prestaciones * 100) / 100 : null, MONEDA);
        celda(7, { formula: `IFERROR(${RED}((${dir(5)}+${dir(6)})*${dir(4)}/$G$6,0),0)`, result: f.total }, MONEDA);
      } else {
        celda(3, f.unidad, undefined, { alignment: { horizontal: "center", vertical: "top" } });
        celda(4, f.cantidad, CANT(f.cantidad));
        celda(5, f.unitario, f.unitario != null && f.unitario < 100 ? MONEDA2 : MONEDA);
        if (tipo === "MA") {
          celda(6, f.desperdicio || 0, "0.0%");
          celda(7, { formula: `${RED}(${dir(5)}*(1+${dir(6)})*${dir(4)},0)`, result: f.total }, MONEDA);
        } else {
          celda(6, null);
          const formula = tipo === "TV" && f.porUnidad ? `${RED}(${dir(5)}*${dir(4)},0)` : `IFERROR(${RED}(${dir(5)}*(${dir(4)}/$G$7)/$G$6,0),0)`;
          celda(7, { formula, result: f.total }, MONEDA);
        }
      }
      if (String(f.descripcion || "").length > 58) r.height = Math.ceil(String(f.descripcion).length / 58) * 13;
      fila++;
    }
    ws.mergeCells(fila, 1, fila, 6);
    Object.assign(ws.getCell(fila, 1), { value: `Subtotal ${letra}`, font: fuente({ bold: true }), fill: relleno(AMBAR_SUAVE), alignment: { horizontal: "right" }, border: borde });
    Object.assign(ws.getCell(fila, 7), { value: { formula: `SUM(G${ini}:G${fila - 1})`, result: res.subtotales[tipo] }, numFmt: MONEDA, font: fuente({ bold: true }), fill: relleno(AMBAR_SUAVE), border: borde });
    subtotales.push(`G${fila}`);
    fila += 2;
  }

  // Resumen: costo directo, AIU, IVA y total
  const t = precioConAiu(res.costoDirecto, o);
  const resumen = (texto, pct, formula, resultado, estilo = {}) => {
    ws.mergeCells(fila, 1, fila, 5);
    Object.assign(ws.getCell(fila, 1), { value: texto, font: fuente({ bold: !!estilo.bold, ...(estilo.font || {}) }), alignment: { horizontal: "right" }, border: borde, ...(estilo.fill ? { fill: estilo.fill } : {}) });
    Object.assign(ws.getCell(fila, 6), { value: pct, numFmt: "0.00%", border: borde, font: fuente(estilo.font || {}), ...(estilo.fill ? { fill: estilo.fill } : {}) });
    Object.assign(ws.getCell(fila, 7), { value: { formula, result: resultado }, numFmt: MONEDA, border: borde, font: fuente({ bold: true, ...(estilo.font || {}) }), ...(estilo.fill ? { fill: estilo.fill } : {}) });
    return fila++;
  };
  const fCd = resumen("COSTO DIRECTO (A + B + C + D + E)", null, subtotales.join("+"), res.costoDirecto, { bold: true, fill: relleno(AMBAR_SUAVE) });
  const fA = resumen("Administración", o.aiu.a, `G${fCd}*F${fila}`, t.a);
  const fI = resumen("Imprevistos", o.aiu.i, `G${fCd}*F${fila}`, t.i);
  const fU = resumen("Utilidad", o.aiu.u, `G${fCd}*F${fila}`, t.u);
  const fS = resumen("SUBTOTAL COSTO DIRECTO + AIU", null, `G${fCd}+G${fA}+G${fI}+G${fU}`, t.subtotal, { bold: true });
  const fIva = resumen(NOMBRE_IVA(o), o.iva, o.regimenIva === "total" ? `G${fS}*F${fila}` : `G${fU}*F${fila}`, t.iva);
  resumen("VALOR TOTAL DEL APU", null, `G${fS}+G${fIva}`, t.total, { bold: true, fill: relleno(AZUL), font: { color: { argb: AMBAR }, bold: true, size: 11 } });
  fila++;
  ws.mergeCells(fila, 1, fila, 7);
  Object.assign(ws.getCell(fila, 1), { value: `Cinco S.A.S. — Construcción, Ingeniería y Consultoría · Generado con APU PRO. ${o.redondeo === "normal" ? "Cada línea se redondea al peso más cercano (ROUND)." : "Cada línea se redondea hacia arriba al peso (ROUNDUP)."}`, font: fuente({ size: 8, italic: true, color: { argb: "FF8A919C" } }) });
  ws.pageSetup.printArea = `A1:G${fila}`;
  return { hoja: nombre, celdaCD: `G${fCd}` };
}

// Logo de Cinco en base64 (para el Excel).
export async function logoBase64() {
  try {
    const r = await fetch("../assets/img/logo-texto-oscuro.png");
    const b = await r.blob();
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.readAsDataURL(b); });
  } catch (e) { return null; }
}
