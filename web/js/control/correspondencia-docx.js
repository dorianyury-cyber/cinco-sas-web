// Genera la misma carta en Word (.docx), para cuando el PDF automático no
// deja el acomodo de imágenes como se necesita y hace falta ajustarlo a
// mano (cambiar tamaño/posición de una foto, por ejemplo).
//
// Depende de la librería docx autoalojada en web/js/vendor/docx.iife.js
// (script clásico, no módulo, por eso queda en window.docx).

const NAVY_HEX = "1F2732";
const MUTED_HEX = "5C6570";
const LOGO_URL = "../assets/img/logo.png";
// Código y versión del formato en blanco, tal como quedó registrado en el
// Listado Maestro de Documentos (documentos.html) — mismo criterio que en
// correspondencia-pdf.js, actualizar los dos si cambia la versión.
const CODIGO_FORMATO = "SC-FOR-001";
const VERSION_FORMATO = "1";
const PX_POR_MM = 96 / 25.4;
const MARGEN_MM = 20;
const ANCHO_UTIL_MM = 215.9 - MARGEN_MM * 2; // carta (Letter) menos márgenes

function cargarImagenParaDocx(url, colorFondo, formatoSalida, type) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Solo hace falta pedir CORS para URLs remotas (Storage) — pedirlo para
    // blob:/data: locales a veces hace que la carga falle sin necesidad.
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

export async function generarCartaDocxBlob(datos) {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
    ShadingType, WidthType, Header, Footer, AlignmentType, PageNumber, VerticalAlign
  } = window.docx;

  // ---- encabezado: banda navy con el logo (igual criterio que el PDF: el
  // logo tiene el texto en blanco, pensado para fondo oscuro) ----
  let celdaLogo = [new Paragraph({ children: [] })];
  try {
    const logo = await cargarImagenParaDocx(LOGO_URL, `#${NAVY_HEX}`, "image/png", "png");
    const altoLogoPx = Math.round(16 * PX_POR_MM);
    const anchoLogoPx = Math.round(altoLogoPx * (logo.ancho / logo.alto));
    celdaLogo = [new Paragraph({ children: [new ImageRun({ data: logo.buffer, transformation: { width: anchoLogoPx, height: altoLogoPx }, type: "png" })] })];
  } catch (e) {
    // Sin logo si no carga — la carta se genera igual.
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
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "CINCO S.A.S.", bold: true, color: "FFFFFF", size: 24 })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Construcción, Ingeniería y Consultoría S.A.S.", color: "C7CCD3", size: 15 })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "NIT. 900.338.346-1", color: "C7CCD3", size: 15 })] })
          ]
        })
      ]
    })]
  });

  // ---- pie de página: dirección a la izquierda, radicado/página a la derecha ----
  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: sinBordes(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: "Cinco S.A.S.", bold: true, color: NAVY_HEX, size: 15 })] }),
              new Paragraph({ children: [new TextRun({ text: "Calle 17 #47-21 B/Villa Café, Neiva (Huila) · gerencia.cincoltda@hotmail.com · Tel: 8768430", color: MUTED_HEX, size: 13 })] })
            ]
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `cinco-sas.web.app · Formato ${CODIGO_FORMATO} · Versión ${VERSION_FORMATO}`, color: MUTED_HEX, size: 13 })]
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `Radicado ${datos.radicado} · Página `, color: MUTED_HEX, size: 13 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: MUTED_HEX, size: 13 }),
                  new TextRun({ text: " de ", color: MUTED_HEX, size: 13 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED_HEX, size: 13 })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // ---- cuerpo: radicado/fecha, destinatario, asunto ----
  const cuerpo = [
    new Paragraph({ children: [new TextRun({ text: `Radicado: ${datos.radicado}`, color: MUTED_HEX, size: 17 })] }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `${datos.ciudad || "Neiva"}, ${formatearFechaLarga(datos.fecha)}`, color: MUTED_HEX, size: 17 })]
    }),
    new Paragraph({ text: "" }),
    new Paragraph({ children: [new TextRun({ text: "Señores", bold: true, color: NAVY_HEX, size: 21 })] }),
    ...(datos.destinatario || "").split("\n").filter(Boolean).map(
      (linea) => new Paragraph({ children: [new TextRun({ text: linea, size: 21 })] })
    ),
    new Paragraph({ text: "" }),
    new Paragraph({ children: [new TextRun({ text: `Asunto: ${datos.asunto || ""}`, bold: true, color: NAVY_HEX, size: 20 })] }),
    new Paragraph({ text: "" })
  ];

  // ---- bloques (texto/imagen), en el mismo orden que en el editor ----
  const bloques = datos.bloques && datos.bloques.length
    ? datos.bloques
    : [{ tipo: "texto", texto: datos.cuerpo || "" }];

  for (const bloque of bloques) {
    if (bloque.tipo === "imagen") {
      try {
        const img = await cargarImagenParaDocx(bloque.url, "#ffffff", "image/jpeg", "jpg");
        let anchoPx = Math.round(ANCHO_UTIL_MM * PX_POR_MM);
        let altoPx = Math.round(anchoPx * (img.alto / img.ancho));
        const altoMaximoPx = Math.round(90 * PX_POR_MM);
        if (altoPx > altoMaximoPx) { altoPx = altoMaximoPx; anchoPx = Math.round(altoPx * (img.ancho / img.alto)); }
        cuerpo.push(new Paragraph({
          children: [new ImageRun({ data: img.buffer, transformation: { width: anchoPx, height: altoPx }, type: "jpg" })]
        }));
        cuerpo.push(new Paragraph({ text: "" }));
      } catch (e) {
        // Antes esto fallaba en silencio — ahora queda visible que algo no
        // cargó, en vez de que el documento se vea "completo" sin estarlo.
        cuerpo.push(new Paragraph({
          children: [new TextRun({ text: "⚠ No se pudo cargar esta imagen al generar el documento.", italics: true, color: "B23434", size: 19 })]
        }));
        cuerpo.push(new Paragraph({ text: "" }));
      }
      continue;
    }
    // Un solo Enter pasa a la siguiente línea (como en Word); una línea en
    // blanco entre medio (doble Enter) arma un párrafo nuevo aparte.
    (bloque.texto || "").split(/\n{2,}/).forEach((parrafo) => {
      const lineas = parrafo.split("\n");
      const runs = lineas.map((linea, i) => {
        const opciones = { text: linea, size: 21 };
        if (i < lineas.length - 1) opciones.break = 1;
        return new TextRun(opciones);
      });
      cuerpo.push(new Paragraph({ children: runs }));
      cuerpo.push(new Paragraph({ text: "" }));
    });
  }

  // ---- cierre y firma ----
  cuerpo.push(new Paragraph({ children: [new TextRun({ text: "Cordialmente,", size: 21 })] }));
  cuerpo.push(new Paragraph({ text: "" }));
  cuerpo.push(new Paragraph({ text: "" }));
  cuerpo.push(new Paragraph({ children: [new TextRun({ text: datos.firmaNombre || "", bold: true, size: 21 })] }));
  if (datos.firmaCargo) cuerpo.push(new Paragraph({ children: [new TextRun({ text: datos.firmaCargo, size: 19 })] }));
  cuerpo.push(new Paragraph({ children: [new TextRun({ text: "Cinco S.A.S.", size: 19 })] }));

  const documento = new Document({
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

export async function descargarCartaDocx(datos) {
  const blob = await generarCartaDocxBlob(datos);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${datos.radicado}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
