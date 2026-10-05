// Informe mensual de Interventoría PRO en Word (.docx). El contenido lo
// arma ip-informe-contenido.js (bloques neutros, los mismos del PDF); aquí
// solo se dibujan con la librería docx autoalojada (web/js/vendor/
// docx.iife.js -> window.docx), con el mismo estilo de los informes de
// Cinco S.A.S.: encabezado navy con logo, títulos numerados, índice nativo
// de Word, tablas con encabezado navy y anchos proporcionales al contenido.

import { mesLargo } from "./ip-core.js";
import { construirInforme, finDeMes, fechaLarga, tituloInforme } from "./ip-informe-contenido.js";

const NAVY = "1F2732";
const AMBER = "FEB209";
const MUTED = "5C6570";
const LOGO_NAVY = "../assets/img/logo.png";
const LOGO_CLARO = "../assets/img/logo-texto-oscuro.png";
const PX_POR_MM = 96 / 25.4;

function cargarImagen(url, fondo = "#ffffff", tipo = "image/jpeg") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.fillStyle = fondo; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      c.toBlob((bl) => (bl ? bl.arrayBuffer().then((buffer) => resolve({ buffer, ancho: c.width, alto: c.height })) : reject(new Error("imagen"))), tipo, 0.88);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Anchos de columna proporcionales al contenido real, con mínimo y máximo.
function anchosProporcionales(encabezados, filas) {
  const largo = encabezados.map((h, i) => Math.max(4, ...[h, ...filas.map((f) => String(f[i] ?? ""))].map((t) => Math.min(t.length, 60))));
  const total = largo.reduce((s, n) => s + n, 0);
  const pct = largo.map((n) => Math.max(5, Math.min(55, (n / total) * 100)));
  const suma = pct.reduce((s, n) => s + n, 0);
  return pct.map((p) => (p / suma) * 100);
}

export async function generarInformeMensual({ contrato, ym, datos, elaboradoPor, cargo, incluir = null, fotosIncluir = null, radicado = "" }) {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, ShadingType, WidthType,
    Header, Footer, AlignmentType, PageNumber, VerticalAlign, HeadingLevel, LevelFormat, BorderStyle, TableOfContents, PageBreak
  } = window.docx;

  const { bloques } = await construirInforme({ contrato, ym, datos, elaboradoPor, cargo, incluir, fotosIncluir });
  const esObra = contrato.tipo === "Obra";
  const corte = finDeMes(ym);
  const titulo = tituloInforme(contrato);

  const T = (texto, o = {}) => new TextRun({ text: String(texto ?? ""), size: o.size || 20, bold: o.bold, italics: o.italics, color: o.color, font: "Arial" });
  const P = (texto, o = {}) => new Paragraph({ alignment: o.align || AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 120, line: 276 }, children: [T(texto, o)] });
  const REF = "numeracion-informe";
  const borde = { style: BorderStyle.SINGLE, size: 4, color: "C9CED6" };
  const bordes = { top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde };

  function tabla(encabezados, filas, { anchos, tam = 16, alinearNum = [] } = {}) {
    const pct = anchos || anchosProporcionales(encabezados, filas);
    const celda = (txt, i, esEnc) => new TableCell({
      width: { size: pct[i], type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      shading: esEnc ? { type: ShadingType.CLEAR, fill: NAVY, color: "auto" } : undefined,
      margins: { top: 40, bottom: 40, left: 70, right: 70 },
      children: String(txt ?? "").split("\n").map((linea) => new Paragraph({
        alignment: esEnc ? AlignmentType.CENTER : alinearNum.includes(i) ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: linea, size: tam, bold: esEnc, color: esEnc ? "FFFFFF" : "1C1F24", font: "Arial" })]
      }))
    });
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: bordes,
      rows: [
        new TableRow({ tableHeader: true, children: encabezados.map((h, i) => celda(h, i, true)) }),
        ...filas.map((f) => new TableRow({ children: f.map((v, i) => celda(v, i, false)) }))
      ]
    });
  }

  const cuerpo = [];
  for (const bl of bloques) {
    if (bl.tipo === "titulo1") {
      cuerpo.push(new Paragraph({ heading: HeadingLevel.HEADING_1, numbering: { reference: REF, level: 0 }, spacing: { before: 280, after: 140 }, children: [new TextRun({ text: bl.texto.toUpperCase(), bold: true, color: NAVY, size: 24, font: "Arial" })] }));
    } else if (bl.tipo === "titulo2") {
      cuerpo.push(new Paragraph({ heading: HeadingLevel.HEADING_2, numbering: { reference: REF, level: 1 }, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: bl.texto, bold: true, color: NAVY, size: 21, font: "Arial" })] }));
    } else if (bl.tipo === "parrafo") {
      cuerpo.push(P(bl.texto, bl.nota ? { italics: true, color: MUTED } : {}));
    } else if (bl.tipo === "tabla") {
      cuerpo.push(tabla(bl.encabezados, bl.filas, bl));
      cuerpo.push(P("", { after: 80 }));
    } else if (bl.tipo === "imagen") {
      try {
        const img = await cargarImagen(bl.dataUrl || bl.url, "#ffffff", "image/png");
        const anchoPx = Math.round(170 * PX_POR_MM);
        cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: img.buffer, type: "png", transformation: { width: anchoPx, height: Math.round(anchoPx * (img.alto / img.ancho)) } })] }));
        if (bl.nombre) cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [T(`Figura. ${bl.nombre}.`, { size: 17, italics: true, color: MUTED })] }));
      } catch (e) { cuerpo.push(P("(No se pudo cargar la imagen)", { italics: true, color: MUTED })); }
    } else if (bl.tipo === "fotos") {
      // Una sola tabla de 2 columnas (una fila por cada par de fotos), con
      // cada foto ajustada a un recuadro de 78 × 58 mm sin deformarse:
      // ocupa mucho menos alto que una foto por bloque.
      const filas = [];
      for (let i = 0; i < bl.fotos.length; i += 2) {
        const celdas = await Promise.all(bl.fotos.slice(i, i + 2).map(async (f) => {
          const hijos = [];
          try {
            const img = await cargarImagen(f.url);
            let anchoMm = 78, altoMm = anchoMm * (img.alto / img.ancho);
            if (altoMm > 58) { altoMm = 58; anchoMm = altoMm * (img.ancho / img.alto); }
            hijos.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: img.buffer, type: "jpg", transformation: { width: Math.round(anchoMm * PX_POR_MM), height: Math.round(altoMm * PX_POR_MM) } })] }));
          } catch (e) {
            hijos.push(new Paragraph({ children: [T("(No se pudo cargar la foto)", { italics: true, color: MUTED, size: 16 })] }));
          }
          hijos.push(new Paragraph({ spacing: { before: 40 }, children: [T(f.observacion, { bold: true, size: 16 })] }));
          hijos.push(new Paragraph({ children: [T(f.fecha, { size: 15, italics: true, color: MUTED })] }));
          return new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: hijos });
        }));
        if (celdas.length === 1) celdas.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [] })] }));
        filas.push(new TableRow({ cantSplit: true, children: celdas }));
      }
      if (filas.length) cuerpo.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordes, rows: filas }));
    } else if (bl.tipo === "firma") {
      cuerpo.push(new Paragraph({ spacing: { before: 600 }, children: [T("______________________________________")] }));
      cuerpo.push(new Paragraph({ children: [T(bl.nombre, { bold: true })] }));
      cuerpo.push(new Paragraph({ children: [T(bl.cargo, { color: MUTED })] }));
      cuerpo.push(new Paragraph({ children: [T(bl.empresa, { color: MUTED, size: 18 })] }));
    }
  }

  // ---- encabezado, pie y portada
  let logoNavy = null, logoClaro = null;
  try { logoNavy = await cargarImagen(LOGO_NAVY, `#${NAVY}`, "image/png"); } catch (e) { /* sin logo */ }
  try { logoClaro = await cargarImagen(LOGO_CLARO, "#ffffff", "image/png"); } catch (e) { /* sin logo */ }
  const nada = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const sinBordes = { top: nada, bottom: nada, left: nada, right: nada, insideHorizontal: nada, insideVertical: nada };
  const celdaNavy = (hijos, pct, alin = AlignmentType.LEFT) => new TableCell({ width: { size: pct, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" }, verticalAlign: VerticalAlign.CENTER, margins: { top: 120, bottom: 120, left: 180, right: 180 }, children: hijos.map((h) => new Paragraph({ alignment: alin, children: [h] })) });
  const encabezado = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: sinBordes,
    rows: [new TableRow({ children: [
      celdaNavy(logoNavy ? [new ImageRun({ data: logoNavy.buffer, type: "png", transformation: { height: Math.round(12 * PX_POR_MM), width: Math.round(12 * PX_POR_MM * (logoNavy.ancho / logoNavy.alto)) } })] : [T("")], 40),
      celdaNavy([new TextRun({ text: `${titulo} — ${mesLargo(ym)}`, bold: true, color: "FFFFFF", size: 16, font: "Arial" }), new TextRun({ text: `Contrato ${contrato.numero || ""}`, color: AMBER, size: 15, font: "Arial" })], 60, AlignmentType.RIGHT)
    ] })]
  });
  const pie = new Paragraph({ alignment: AlignmentType.RIGHT, children: [
    new TextRun({ text: `${radicado ? `Radicado ${radicado} · ` : ""}Interventoría PRO · Cinco S.A.S. · Página `, color: MUTED, size: 14, font: "Arial" }),
    new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 14, font: "Arial" }),
    new TextRun({ text: " de ", color: MUTED, size: 14, font: "Arial" }),
    new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 14, font: "Arial" })
  ] });

  const portada = [];
  if (logoClaro) portada.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 400 }, children: [new ImageRun({ data: logoClaro.buffer, type: "png", transformation: { height: Math.round(30 * PX_POR_MM), width: Math.round(30 * PX_POR_MM * (logoClaro.ancho / logoClaro.alto)) } })] }));
  portada.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: titulo.toUpperCase(), bold: true, size: 34, color: NAVY, font: "Arial" })] }));
  portada.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [new TextRun({ text: mesLargo(ym).toUpperCase(), bold: true, size: 26, color: "D99400", font: "Arial" })] }));
  portada.push(tabla(["INFORME", ""], [
    ...(radicado ? [["Radicado", radicado]] : []),
    ["Contrato N.º", contrato.numero || "-"], ["Objeto", contrato.objeto || "-"], ["Contratante", contrato.contratante || "-"],
    [esObra ? "Contratista / proveedor" : "Contratista", contrato.contratista || "-"],
    ["Interventor", "CONSTRUCCIÓN, INGENIERÍA Y CONSULTORÍA – CINCO S.A.S."],
    ["Periodo del informe", `${fechaLarga(`${ym}-01`)} al ${fechaLarga(corte)}`]
  ], { anchos: [30, 70], tam: 19 }));
  portada.push(new Paragraph({ children: [new PageBreak()] }));
  portada.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "CONTENIDO", bold: true, color: NAVY, size: 24, font: "Arial" })] }));
  portada.push(new TableOfContents("Contenido", { hyperlink: true, headingStyleRange: "1-2" }));
  portada.push(new Paragraph({ children: [new PageBreak()] }));

  const doc = new Document({
    features: { updateFields: true },
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    numbering: { config: [{ reference: REF, levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 360, hanging: 360 } } } },
      { level: 1, format: LevelFormat.DECIMAL, text: "%1.%2.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 576, hanging: 576 } } } }
    ] }] },
    sections: [{
      // Izquierda 1 cm más ancha (1247 + 567 twips) para archivar en carpeta física.
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1134, bottom: 1134, left: 1814, right: 1134, header: 340, footer: 340 } } },
      headers: { default: new Header({ children: [encabezado] }) },
      footers: { default: new Footer({ children: [pie] }) },
      children: [...portada, ...cuerpo]
    }]
  });
  return Packer.toBlob(doc);
}
