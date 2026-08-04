// Genera el mismo informe en Word (.docx) — versión simple del cuerpo
// (encabezado/pie con logo y radicado + títulos/párrafos/tablas/imágenes),
// para cuando el PDF automático no deja ajustar algo a mano. No replica la
// portada a página completa ni el índice con páginas reales del PDF (ver
// informes-pdf.js) — eso es mucho más trabajo y frágil de mantener en
// Word; si hace falta editar el documento, esta versión ya es suficiente.
//
// Mismo patrón/librería que correspondencia-docx.js (docx autoalojado en
// web/js/vendor/docx.iife.js, script clásico -> window.docx).

import { parsearHtmlARuns } from "./texto-rico.js";

const NAVY_HEX = "1F2732";
const MUTED_HEX = "5C6570";
const GRIS_CLARO_HEX = "F5F6F8";
const LOGO_URL = "../assets/img/logo.png";
// Mismo código/versión que informes-pdf.js — actualizar los dos si cambia
// el diseño del formato.
const CODIGO_FORMATO = "AC-FOR-002";
const VERSION_FORMATO = "1";

const TIPO_LABEL = {
  gestion: "Informe de gestión", mediciones: "Informe de mediciones",
  consultoria: "Informe de consultoría", interventoria: "Informe de interventoría",
  obra: "Informe de obra", capacitacion: "Informe de capacitación", otro: "Informe"
};

function rgbAHexDocx(rgb) {
  if (!rgb) return undefined;
  return rgb.map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Convierte el HTML de un párrafo (texto-rico.js) a TextRun de docx con
// negrilla/cursiva/color — igual que en correspondencia-docx.js.
function runsParaDocx(TextRun, html, tamano) {
  const runs = parsearHtmlARuns(html);
  const resultado = [];
  runs.forEach((run) => {
    if (run.salto) {
      if (resultado.length) resultado[resultado.length - 1].break = (resultado[resultado.length - 1].break || 0) + 1;
      return;
    }
    resultado.push({
      text: run.texto,
      size: tamano,
      ...(run.negrita ? { bold: true } : {}),
      ...(run.cursiva ? { italics: true } : {}),
      ...(run.color ? { color: rgbAHexDocx(run.color) } : {})
    });
  });
  return resultado.length ? resultado.map((opciones) => new TextRun(opciones)) : [new TextRun({ text: "", size: tamano })];
}

const PX_POR_MM = 96 / 25.4;
const DXA_POR_MM = 1440 / 25.4;
const MARGEN_MM = 20;
const ANCHO_UTIL_MM = 215.9 - MARGEN_MM * 2; // carta (Letter) menos márgenes
const ANCHO_UTIL_DXA = Math.round(ANCHO_UTIL_MM * DXA_POR_MM);

function cargarImagenParaDocx(url, colorFondo, formatoSalida, type) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = colorFondo;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("No se pudo procesar la imagen")); return; }
        blob.arrayBuffer().then((buffer) => resolve({ buffer, ancho: img.naturalWidth, alto: img.naturalHeight, type }));
      }, formatoSalida, 0.9);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function formatearFechaLarga(fechaISO) {
  const fecha = fechaISO ? new Date(fechaISO + "T12:00:00") : new Date();
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

function sinBordes() {
  const { BorderStyle } = window.docx;
  const nada = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: nada, bottom: nada, left: nada, right: nada, insideHorizontal: nada, insideVertical: nada };
}

// Anchos de columna proporcionales al contenido (más caracteres = más
// ancho), no partes iguales — mismo criterio que calcularAnchosColumna en
// informes-pdf.js (misma corrección: cada columna se garantiza su mínimo
// primero y el espacio que sobra se reparte solo entre las que pidieron
// más, para que una tabla con varias columnas no termine con todas más
// angostas que ese mínimo solo porque una pedía mucho espacio).
function anchosColumnaDocx(filas) {
  const numCols = Math.max(...filas.map((f) => f.length));
  const anchoMinDxa = 900;
  const anchoMaxDxa = ANCHO_UTIL_DXA * 0.6;

  const deseados = [];
  for (let c = 0; c < numCols; c++) {
    let maxLen = 0;
    filas.forEach((fila) => { const len = String(fila[c] || "").length; if (len > maxLen) maxLen = len; });
    deseados.push(Math.min(Math.max(maxLen * 95 + 300, anchoMinDxa), anchoMaxDxa));
  }

  const totalDeseado = deseados.reduce((a, b) => a + b, 0);
  if (totalDeseado <= ANCHO_UTIL_DXA) {
    const factor = ANCHO_UTIL_DXA / totalDeseado;
    return deseados.map((a) => Math.round(a * factor));
  }

  const espacioLibre = ANCHO_UTIL_DXA - anchoMinDxa * numCols;
  const extra = deseados.map((d) => Math.max(0, d - anchoMinDxa));
  const totalExtra = extra.reduce((a, b) => a + b, 0);
  if (espacioLibre <= 0 || totalExtra === 0) return deseados.map(() => Math.round(ANCHO_UTIL_DXA / numCols));
  return deseados.map((d, c) => Math.round(anchoMinDxa + (extra[c] / totalExtra) * espacioLibre));
}

export async function generarInformeDocxBlob(informe) {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
    ShadingType, WidthType, Header, Footer, AlignmentType, PageNumber, VerticalAlign, HeadingLevel, LevelFormat
  } = window.docx;

  // Numeración automática de Título 1..4 (1 / 1.1 / 1.1.1 / 1.1.1.1), como
  // la numeración multinivel nativa de Word ligada a un solo "numId": cada
  // nivel arranca su contador en 1 y Word lo reinicia solo al aparecer un
  // título de nivel superior (comportamiento por defecto de OOXML, no hay
  // que configurarlo aparte). Referenciada por nivel (0-3) desde cada
  // párrafo de título más abajo.
  const REF_NUMERACION_TITULOS = "numeracion-titulos";
  const numeracionTitulos = {
    reference: REF_NUMERACION_TITULOS,
    levels: [0, 1, 2, 3].map((nivel) => ({
      level: nivel,
      format: LevelFormat.DECIMAL,
      text: Array.from({ length: nivel + 1 }, (_, i) => `%${i + 1}`).join(".") + ".",
      alignment: AlignmentType.START,
      style: { paragraph: { indent: { left: nivel * 360, hanging: 360 } } }
    }))
  };

  // ---- encabezado: banda navy con el logo (mismo criterio que el PDF) ----
  let celdaLogo = [new Paragraph({ children: [] })];
  try {
    const logo = await cargarImagenParaDocx(LOGO_URL, `#${NAVY_HEX}`, "image/png", "png");
    const altoLogoPx = Math.round(14 * PX_POR_MM);
    const anchoLogoPx = Math.round(altoLogoPx * (logo.ancho / logo.alto));
    celdaLogo = [new Paragraph({ children: [new ImageRun({ data: logo.buffer, transformation: { width: anchoLogoPx, height: altoLogoPx }, type: "png" })] })];
  } catch (e) {
    // Sin logo si no carga — el documento se genera igual.
  }

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: sinBordes(),
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: NAVY_HEX, color: "auto" },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 150, bottom: 150, left: 200, right: 200 },
          children: celdaLogo
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: NAVY_HEX, color: "auto" },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 150, bottom: 150, left: 200, right: 200 },
          children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: informe.radicado || "", bold: true, color: "FFFFFF", size: 20 })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: TIPO_LABEL[informe.tipoInforme] || "Informe", color: "C7CCD3", size: 15 })] })
          ]
        })
      ]
    })]
  });

  // ---- pie de página: código/versión a la izquierda, radicado/página a la derecha ----
  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: sinBordes(),
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: `Código: ${CODIGO_FORMATO} · Versión: ${VERSION_FORMATO}`, color: MUTED_HEX, size: 13 })] })]
        }),
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `Radicado ${informe.radicado || ""} · Página `, color: MUTED_HEX, size: 13 }),
              new TextRun({ children: [PageNumber.CURRENT], color: MUTED_HEX, size: 13 }),
              new TextRun({ text: " de ", color: MUTED_HEX, size: 13 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED_HEX, size: 13 })
            ]
          })]
        })
      ]
    })]
  });

  // ---- portada resumida: título + datos del contrato en línea (no a
  // página completa, esta es la versión "simple" pensada para editar) ----
  const cuerpo = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: informe.titulo || "", bold: true, color: NAVY_HEX, size: 32 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: TIPO_LABEL[informe.tipoInforme] || "Informe", color: MUTED_HEX, size: 21 })] }),
    new Paragraph({ text: "" })
  ];
  const filaDato = (etiqueta, valor) => {
    if (!valor) return;
    cuerpo.push(new Paragraph({
      children: [
        new TextRun({ text: `${etiqueta} `, bold: true, color: NAVY_HEX, size: 19 }),
        new TextRun({ text: String(valor), color: MUTED_HEX, size: 19 })
      ]
    }));
  };
  filaDato("Contrato:", informe.contratoCodigo ? `${informe.contratoCodigo}${informe.contratoNumero ? " · N.º " + informe.contratoNumero : ""}` : null);
  filaDato("Objeto:", informe.contratoNombre);
  filaDato("Cliente:", informe.contratoCliente);
  filaDato("Supervisor:", informe.contratoSupervisor);
  filaDato("Elaborado por:", informe.firmaNombre ? `${informe.firmaNombre}${informe.firmaCargo ? " — " + informe.firmaCargo : ""}` : null);
  filaDato("Fecha:", formatearFechaLarga(informe.mes ? informe.mes + "-01" : null));
  cuerpo.push(new Paragraph({ text: "" }));

  // ---- cuerpo por bloques, en el mismo orden que en el editor ----
  const HEADING_POR_NIVEL = { titulo1: HeadingLevel.HEADING_1, titulo2: HeadingLevel.HEADING_2, titulo3: HeadingLevel.HEADING_3, titulo4: HeadingLevel.HEADING_4 };
  const NIVEL_NUMERACION = { titulo1: 0, titulo2: 1, titulo3: 2, titulo4: 3 };
  let numeroTabla = 0;
  let numeroFigura = 0;

  for (const bloque of informe.bloques || []) {
    if (bloque.tipo in HEADING_POR_NIVEL) {
      cuerpo.push(new Paragraph({
        heading: HEADING_POR_NIVEL[bloque.tipo],
        numbering: { reference: REF_NUMERACION_TITULOS, level: NIVEL_NUMERACION[bloque.tipo] },
        children: [new TextRun({ text: bloque.texto || "", bold: true, color: NAVY_HEX })]
      }));
      continue;
    }

    if (bloque.tipo === "tabla") {
      numeroTabla += 1;
      const filasCrudas = bloque.filas && bloque.filas.length ? bloque.filas : [[""]];
      const filas = filasCrudas.map((f) => (Array.isArray(f) ? f : f.celdas || []));
      const tituloTexto = `Tabla ${numeroTabla}. ${bloque.titulo || ""}`.trim();
      cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tituloTexto, bold: true, color: NAVY_HEX, size: 19 })] }));

      const anchos = anchosColumnaDocx(filas);
      const filasDocx = filas.map((fila, fi) => new TableRow({
        children: anchos.map((ancho, ci) => new TableCell({
          width: { size: ancho, type: WidthType.DXA },
          shading: fi === 0 ? { type: ShadingType.CLEAR, fill: GRIS_CLARO_HEX, color: "auto" } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: String(fila[ci] || ""), bold: fi === 0, size: 17 })] })]
        }))
      }));
      cuerpo.push(new Table({ width: { size: ANCHO_UTIL_DXA, type: WidthType.DXA }, rows: filasDocx }));

      if (bloque.nota) {
        cuerpo.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: bloque.nota, italics: true, color: MUTED_HEX, size: 17 })] }));
      }
      cuerpo.push(new Paragraph({ text: "" }));
      continue;
    }

    if (bloque.tipo === "imagen") {
      numeroFigura += 1;
      const nombreTexto = `Figura ${numeroFigura}. ${bloque.nombre || ""}`.trim();
      cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: nombreTexto, bold: true, color: NAVY_HEX, size: 19 })] }));
      try {
        const img = await cargarImagenParaDocx(bloque.url, "#ffffff", "image/jpeg", "jpg");
        let anchoPx = Math.round(ANCHO_UTIL_MM * PX_POR_MM * 0.85);
        let altoPx = Math.round(anchoPx * (img.alto / img.ancho));
        const altoMaximoPx = Math.round(90 * PX_POR_MM);
        if (altoPx > altoMaximoPx) { altoPx = altoMaximoPx; anchoPx = Math.round(altoPx * (img.ancho / img.alto)); }
        cuerpo.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: img.buffer, transformation: { width: anchoPx, height: altoPx }, type: "jpg" })]
        }));
      } catch (e) {
        cuerpo.push(new Paragraph({
          children: [new TextRun({ text: "⚠ No se pudo cargar esta imagen al generar el documento.", italics: true, color: "B23434", size: 19 })]
        }));
      }
      if (bloque.pieDeFoto) {
        cuerpo.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: bloque.pieDeFoto, italics: true, color: MUTED_HEX, size: 17 })] }));
      }
      cuerpo.push(new Paragraph({ text: "" }));
      continue;
    }

    // párrafo
    cuerpo.push(new Paragraph({ children: runsParaDocx(TextRun, bloque.texto, 21) }));
    cuerpo.push(new Paragraph({ text: "" }));
  }

  const documento = new Document({
    numbering: { config: [numeracionTitulos] },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // carta (Letter)
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 340, footer: 340 }
        }
      },
      headers: { default: new Header({ children: [headerTable] }) },
      footers: { default: new Footer({ children: [footerTable] }) },
      children: cuerpo
    }]
  });

  return Packer.toBlob(documento);
}

export async function descargarInformeDocx(informe) {
  const blob = await generarInformeDocxBlob(informe);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${informe.radicado}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
