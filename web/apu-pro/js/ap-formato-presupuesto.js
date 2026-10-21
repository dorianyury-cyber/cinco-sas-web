// Presupuesto en formato Cinco: hoja para pantalla/impresión y libro de Excel con una hoja
// de presupuesto (valores unitarios enlazados a las hojas de cada APU) y una hoja por APU.
import { esc, pesos, numero, fechaCorta, hoyISO } from "./ap-core.js";
import { hojaApu } from "./ap-formato.js";
import { normalizarExpresion } from "./ap-presupuesto.js";

const NOMBRE_IVA = (o) => (o.regimenIva === "total" ? `IVA ${numero(o.iva * 100, 0)} % sobre el subtotal` : `IVA ${numero(o.iva * 100, 0)} % sobre la utilidad`);
const TIPOS_PROYECTO = { obra: "Presupuesto de obra", consultoria: "Presupuesto de consultoría", interventoria: "Presupuesto de interventoría" };

function datosHtml(p, par) {
  const dato = (et, v, clase = "") => `<div class="cf-dato ${clase}"><span>${esc(et)}</span><strong>${v}</strong></div>`;
  return `<section class="cf-datos cf-datos-proy">
    ${dato("Proyecto", esc(p.codigo), "cf-codigo")}
    ${dato("Nombre", esc(p.nombre), "cf-nombre")}
    ${dato("Cliente", esc(p.cliente || "—"))}
    ${dato("Ubicación", esc(p.ubicacion || "—"))}
    ${dato("Parámetros", par ? `${par.anio} · salario mínimo ${pesos(par.smmlv)} · ${par.diasHabiles} días hábiles` : "—")}
    ${dato("Factor de materiales", `${numero(p.factorMateriales || 1, 4)}${p.justificacionFactor ? ` · ${esc(p.justificacionFactor)}` : ""}`, "cf-ancho")}
  </section>`;
}

// calc: calcularPresupuesto(); o: { parametros, fecha }
export function htmlPresupuesto(p, calc, o) {
  const sitios = calc.sitios, varios = sitios.length > 1;
  const encCant = varios ? sitios.map((s) => `<th class="cf-num">Cant. ${esc(s.nombre)}</th>`).join("") : '<th class="cf-num">Cantidad</th>';
  const ncols = 5 + (varios ? sitios.length : 1);
  return `<article class="cf-hoja cf-hoja-ancha">
    <header class="cf-cabeza">
      <img class="cf-logo" src="../assets/img/logo-texto-oscuro.png" alt="CINCO S.A.S.">
      <div class="cf-titulo"><h1>${esc(TIPOS_PROYECTO[p.tipo] || "Presupuesto")}</h1><p>Cinco S.A.S. — Construcción, Ingeniería y Consultoría</p></div>
      <dl class="cf-meta"><div><dt>Fecha</dt><dd>${fechaCorta(o.fecha || hoyISO())}</dd></div>${p.fechaPrecios ? `<div><dt>Precios</dt><dd>${fechaCorta(p.fechaPrecios)}</dd></div>` : ""}</dl>
    </header>
    ${datosHtml(p, o.parametros)}
    <table class="cf-tabla cf-tabla-presu">
      <thead><tr class="cf-enc"><th class="cf-centro">Ítem</th><th>Código APU</th><th>Descripción</th><th class="cf-centro">Und</th>${encCant}<th class="cf-num">Vr. unitario</th><th class="cf-num">Vr. total</th></tr></thead>
      ${calc.capitulos.map((cap) => `<tbody>
        <tr class="cf-cap"><th colspan="${ncols + 1}">${esc(cap.nombre)}</th></tr>
        ${cap.items.length ? cap.items.map((it) => `<tr>
          <td class="cf-centro">${it.numero}</td><td class="cf-ref">${esc(it.apu.codigo)}</td><td>${esc(it.apu.nombre)}</td><td class="cf-centro">${esc(it.apu.unidad)}</td>
          ${varios ? sitios.map((s) => `<td class="cf-num">${numero(it.cantidades[s.id], 3)}</td>`).join("") : `<td class="cf-num">${numero(it.cantidadTotal, 3)}</td>`}
          <td class="cf-num">${pesos(it.vu)}</td><td class="cf-num">${pesos(it.total)}</td></tr>`).join("") : `<tr><td colspan="${ncols + 1}" class="cf-vacio">Sin ítems</td></tr>`}
        <tr class="cf-sub"><td colspan="${ncols}">Subtotal ${esc(cap.nombre)}</td><td class="cf-num">${pesos(cap.subtotal)}</td></tr>
      </tbody>`).join("")}
    </table>
    ${resumenHtml(calc)}
    <footer class="cf-pie">Cinco S.A.S. — Construcción, Ingeniería y Consultoría · Generado con APU PRO · Valores unitarios = costo directo de cada APU; el AIU y el IVA se aplican al total.</footer>
  </article>`;
}

function resumenHtml(calc) {
  const o = calc.opciones, sitios = calc.sitios, varios = sitios.length > 1;
  const col = (fn) => (varios ? sitios.map((s) => `<td class="cf-num">${fn(calc.porSitio[s.id])}</td>`).join("") : "") + `<td class="cf-num">${fn(calc)}</td>`;
  return `<section class="cf-resumen"><table${varios ? ' class="cf-resumen-ancho"' : ""}>
    ${varios ? `<tr class="cf-enc-res"><td></td><td></td>${sitios.map((s) => `<td class="cf-num">${esc(s.nombre)}</td>`).join("")}<td class="cf-num">Total</td></tr>` : ""}
    <tr class="cf-cd"><td>A. Total costos directos</td><td></td>${col((x) => pesos(x.costoDirecto))}</tr>
    <tr><td>Administración</td><td class="cf-num">${numero(o.aiu.a * 100, 2)} %</td>${col((x) => pesos(x.a))}</tr>
    <tr><td>Imprevistos</td><td class="cf-num">${numero(o.aiu.i * 100, 2)} %</td>${col((x) => pesos(x.i))}</tr>
    <tr><td>Utilidad</td><td class="cf-num">${numero(o.aiu.u * 100, 2)} %</td>${col((x) => pesos(x.u))}</tr>
    <tr class="cf-st"><td>Subtotal</td><td></td>${col((x) => pesos(x.subtotal))}</tr>
    <tr><td>${NOMBRE_IVA(o)}</td><td></td>${col((x) => pesos(x.iva))}</tr>
    <tr class="cf-total"><td>Valor total</td><td></td>${col((x) => pesos(x.total))}</tr>
  </table></section>`;
}

// ---------------------------------------------------------------- Excel
const AMBAR = "FFFEB209", AMBAR_SUAVE = "FFFFF3D1", AZUL = "FF1F2732", GRIS = "FFF2F3F5", BORDE = "FFBFC4CC";
const borde = { top: { style: "thin", color: { argb: BORDE } }, left: { style: "thin", color: { argb: BORDE } }, bottom: { style: "thin", color: { argb: BORDE } }, right: { style: "thin", color: { argb: BORDE } } };
const MONEDA = '"$"#,##0';
const CANT = (v) => (Number.isInteger(Number(v)) ? "#,##0" : "#,##0.00##");
const relleno = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fuente = (extra = {}) => ({ name: "Calibri", size: 10, ...extra });
const colLetra = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

export function libroProyecto(ExcelJS, p, calc, o) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cinco S.A.S. — APU PRO";
  const logo = o.logo ? wb.addImage({ base64: o.logo, extension: "png" }) : null;
  const ws = wb.addWorksheet("Presupuesto", { pageSetup: { paperSize: 1, orientation: calc.sitios.length > 1 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }, views: [{ showGridLines: false, state: "frozen", ySplit: 9 }] });
  // Hojas de APU (una por APU distinto) para enlazar los valores unitarios.
  const hojas = new Map(), usados = new Set();
  const oApu = { ...o, redondeo: p.redondeo || "arriba", proyecto: `${p.codigo} — ${p.nombre}` };
  for (const cap of calc.capitulos) for (const it of cap.items) {
    const clave = `${it.apu.codigo}@${it.apu.version || 1}@${JSON.stringify(it.apu.lineas)}@${it.apu.rendimiento}`;
    if (hojas.has(clave)) { it.hoja = hojas.get(clave); continue; }
    let nombre = it.apu.codigo.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
    while (usados.has(nombre) || nombre === "Presupuesto") nombre = `${it.apu.codigo.slice(0, 27)}-${usados.size}`;
    usados.add(nombre);
    it.hoja = hojaApu(wb, nombre, { ...it.apu }, it.res, oApu, logo);
    hojas.set(clave, it.hoja);
  }

  const sitios = calc.sitios, varios = sitios.length > 1, nS = varios ? sitios.length : 1;
  // Columnas: A Ítem, B Código, C Descripción, D Und, cantidades (nS), Vr. unitario, totales (nS si varios), Total
  const cCant0 = 5, cVu = cCant0 + nS, cTot0 = cVu + 1, cTotal = varios ? cTot0 + nS : cTot0;
  const anchos = [7, 12, 52, 7, ...Array(nS).fill(11), 15, ...(varios ? Array(nS).fill(15) : []), 17];
  ws.columns = anchos.map((w) => ({ width: w }));
  const ultima = colLetra(cTotal);
  if (logo != null) ws.addImage(logo, { tl: { col: 0.1, row: 0.15 }, ext: { width: 150, height: 72 } });
  ws.getRow(1).height = 22; ws.getRow(2).height = 22;
  ws.mergeCells(`C1:${colLetra(cTotal - 1)}2`);
  Object.assign(ws.getCell("C1"), { value: (TIPOS_PROYECTO[p.tipo] || "Presupuesto").toUpperCase(), font: fuente({ size: 15, bold: true, color: { argb: AZUL } }), alignment: { vertical: "middle", horizontal: "center" } });
  ws.mergeCells(`C3:${colLetra(cTotal - 1)}3`);
  Object.assign(ws.getCell("C3"), { value: `${p.codigo} — ${p.nombre}`, font: fuente({ size: 11, bold: true }), alignment: { horizontal: "center", wrapText: true } });
  Object.assign(ws.getCell(`${ultima}1`), { value: "Fecha", font: fuente({ size: 8, color: { argb: "FF5A6270" } }), alignment: { horizontal: "right" } });
  Object.assign(ws.getCell(`${ultima}2`), { value: fechaCorta(o.fecha || hoyISO()), font: fuente({ bold: true }), alignment: { horizontal: "right" } });
  for (let c = 1; c <= cTotal; c++) ws.getCell(4, c).border = { bottom: { style: "medium", color: { argb: AMBAR } } };
  const par = o.parametros;
  const linea = (fila, texto) => { ws.mergeCells(fila, 1, fila, cTotal); Object.assign(ws.getCell(fila, 1), { value: texto, font: fuente({ size: 9, color: { argb: "FF3A4250" } }), alignment: { wrapText: true } }); };
  linea(5, `Cliente: ${p.cliente || "—"} · Ubicación: ${p.ubicacion || "—"}`);
  linea(6, `Parámetros ${par?.anio || ""}: salario mínimo ${pesos(par?.smmlv)} · auxilio de transporte ${pesos(par?.auxTransporte)} · prestaciones ${numero((par?.prestacional || 0) * 100, 0)} % · ${par?.diasHabiles || 21} días hábiles`);
  linea(7, `Factor de proyección de materiales: ${numero(p.factorMateriales || 1, 4)}${p.justificacionFactor ? ` (${p.justificacionFactor})` : ""}${p.fechaPrecios ? ` · Precios congelados el ${fechaCorta(p.fechaPrecios)}` : " · Precios vigentes de la base"}`);
  const enc = ["Ítem", "Código APU", "Descripción", "Und", ...(varios ? sitios.map((s) => `Cant. ${s.nombre}`) : ["Cantidad"]), "Vr. unitario", ...(varios ? sitios.map((s) => `Total ${s.nombre}`) : []), "Vr. total"];
  enc.forEach((h, j) => Object.assign(ws.getCell(9, j + 1), { value: h, font: fuente({ bold: true, size: 9, color: { argb: AZUL } }), fill: relleno(AMBAR), border: borde, alignment: { horizontal: "center", vertical: "middle", wrapText: true } }));
  ws.getRow(9).height = 30;

  let fila = 10;
  const subt = [];
  for (const cap of calc.capitulos) {
    ws.mergeCells(fila, 1, fila, cTotal);
    Object.assign(ws.getCell(fila, 1), { value: cap.nombre.toUpperCase(), font: fuente({ bold: true, color: { argb: AZUL } }), fill: relleno(GRIS), border: borde });
    fila++;
    const ini = fila;
    for (const it of cap.items) {
      const r = ws.getRow(fila);
      const celda = (c, v, fmt, extra = {}) => Object.assign(r.getCell(c), { value: v, numFmt: fmt, border: borde, font: fuente(), alignment: { vertical: "top", horizontal: c >= cCant0 ? "right" : c === 3 ? "left" : "center", wrapText: c === 3 }, ...extra });
      celda(1, it.numero); celda(2, it.apu.codigo); celda(3, it.apu.nombre); celda(4, it.apu.unidad);
      sitios.forEach((s, k) => { if (k < nS) { const c = it.cantidades[s.id]; const expr = it.cantidadesOrig?.[s.id]?.expresion; const ex = expr ? normalizarExpresion(expr) : ""; celda(cCant0 + k, ex && /[+*/()]|\d-/.test(ex) ? { formula: ex, result: c } : c, CANT(c)); } });
      celda(cVu, { formula: `'${it.hoja.hoja}'!${it.hoja.celdaCD}`, result: it.vu }, MONEDA);
      const vu = r.getCell(cVu).address;
      if (varios) {
        sitios.forEach((s, k) => celda(cTot0 + k, { formula: `ROUND(${vu}*${r.getCell(cCant0 + k).address},0)`, result: it.totales[s.id] }, MONEDA));
        celda(cTotal, { formula: `SUM(${colLetra(cTot0)}${fila}:${colLetra(cTot0 + nS - 1)}${fila})`, result: it.total }, MONEDA);
      } else celda(cTotal, { formula: `ROUND(${vu}*${r.getCell(cCant0).address},0)`, result: it.total }, MONEDA);
      if (it.apu.nombre.length > 70) r.height = Math.ceil(it.apu.nombre.length / 70) * 13;
      fila++;
    }
    ws.mergeCells(fila, 1, fila, (varios ? cTot0 : cTotal) - 1);
    Object.assign(ws.getCell(fila, 1), { value: `Subtotal ${cap.nombre}`, font: fuente({ bold: true }), fill: relleno(AMBAR_SUAVE), alignment: { horizontal: "right" }, border: borde });
    const totCols = varios ? [...sitios.map((_, k) => cTot0 + k), cTotal] : [cTotal];
    totCols.forEach((c, k) => Object.assign(ws.getCell(fila, c), { value: { formula: cap.items.length ? `SUM(${colLetra(c)}${ini}:${colLetra(c)}${fila - 1})` : "0", result: varios && k < nS ? cap.subtotales[sitios[k].id] : cap.subtotal }, numFmt: MONEDA, font: fuente({ bold: true }), fill: relleno(AMBAR_SUAVE), border: borde }));
    subt.push(fila);
    fila += 2;
  }
  // Resumen con AIU e IVA (por sitio si hay varios)
  const totCols = varios ? [...sitios.map((_, k) => cTot0 + k), cTotal] : [cTotal];
  const cPct = (varios ? cTot0 : cTotal) - 1;
  const res = (texto, pct, formulas, resultados, estilo = {}) => {
    ws.mergeCells(fila, 1, fila, cPct - 1);
    Object.assign(ws.getCell(fila, 1), { value: texto, font: fuente({ bold: !!estilo.bold, ...(estilo.font || {}) }), alignment: { horizontal: "right" }, border: borde, ...(estilo.fill ? { fill: estilo.fill } : {}) });
    Object.assign(ws.getCell(fila, cPct), { value: pct, numFmt: "0.00%", border: borde, font: fuente(estilo.font || {}), ...(estilo.fill ? { fill: estilo.fill } : {}) });
    totCols.forEach((c, k) => Object.assign(ws.getCell(fila, c), { value: { formula: formulas(colLetra(c)), result: resultados[k] }, numFmt: MONEDA, border: borde, font: fuente({ bold: true, ...(estilo.font || {}) }), ...(estilo.fill ? { fill: estilo.fill } : {}) }));
    return fila++;
  };
  const val = (campo) => (varios ? [...sitios.map((s) => calc.porSitio[s.id][campo]), calc[campo]] : [calc[campo]]);
  const fCd = res("A. TOTAL COSTOS DIRECTOS", null, (L) => subt.map((f) => `${L}${f}`).join("+") || "0", val("costoDirecto"), { bold: true, fill: relleno(AMBAR_SUAVE) });
  const pctF = (L) => `$${colLetra(cPct)}$${fila}`;
  const fA = res("Administración", calc.opciones.aiu.a, (L) => `${L}${fCd}*${pctF()}`, val("a"));
  const fI = res("Imprevistos", calc.opciones.aiu.i, (L) => `${L}${fCd}*${pctF()}`, val("i"));
  const fU = res("Utilidad", calc.opciones.aiu.u, (L) => `${L}${fCd}*${pctF()}`, val("u"));
  const fS = res("SUBTOTAL", null, (L) => `${L}${fCd}+${L}${fA}+${L}${fI}+${L}${fU}`, val("subtotal"), { bold: true });
  const fIva = res(NOMBRE_IVA(calc.opciones), calc.opciones.iva, (L) => (calc.opciones.regimenIva === "total" ? `${L}${fS}*${pctF()}` : `${L}${fU}*${pctF()}`), val("iva"));
  res("VALOR TOTAL", null, (L) => `${L}${fS}+${L}${fIva}`, val("total"), { bold: true, fill: relleno(AZUL), font: { color: { argb: AMBAR }, bold: true, size: 11 } });
  ws.pageSetup.printArea = `A1:${ultima}${fila}`;
  return wb;
}
