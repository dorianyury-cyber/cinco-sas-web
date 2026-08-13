// Genera el mismo informe en Word (.docx) — pensado para que, si el ajuste
// automático de espacios del PDF no queda bien del todo, se pueda bajar
// este Word, corregir a mano la distribución de imágenes/texto, y volver a
// subirlo como "versión final" (ver subirArchivoFinal en informes.js) sin
// que se vea como un documento distinto al PDF: misma portada a página
// completa, mismo encabezado/pie, e índice ("Contenido") con número de
// página REAL de Word (campo TOC nativo, no un número calculado a mano
// como en el PDF) — Word lo calcula solo al abrir el archivo gracias a
// features.updateFields más abajo. Las listas de gráficos/tablas van SIN
// número de página: se intentó con marcadores + campo PAGEREF (mismo
// mecanismo que el índice) pero ese campo no se actualiza de forma
// confiable en Word — mejor una lista simple que un número que se queda
// en blanco.
//
// Lo que NO se puede igualar: en qué página cae cada bloque. El PDF mide
// milímetro a milímetro dónde corta cada página (ver informes-pdf.js);
// Word arma sus propias páginas con su propio motor de texto (letra por
// letra, según fuente/impresora), así que el corte de página real casi
// nunca va a calzar exacto entre los dos — se ve como el mismo documento,
// pero la distribución fina sigue siendo un ajuste manual en Word.
//
// Mismo patrón/librería que correspondencia-docx.js (docx autoalojado en
// web/js/vendor/docx.iife.js, script clásico -> window.docx).

import { parsearHtmlARuns } from "./texto-rico.js";
import {
  normalizarMerges, celdaCombinada, normalizarCentrados, celdaCentrada
} from "./tabla-celdas.js";

const NAVY_HEX = "1F2732";
const AMBER_HEX = "FEB209";
const AMBER_DARK_HEX = "D99400";
const MUTED_HEX = "5C6570";
const MUTED_CLARO_HEX = "C7CCD3";
const VALOR_OSCURO_HEX = "DCE0E5";
const GRIS_CLARO_HEX = "F5F6F8";
const LOGO_URL = "../assets/img/logo.png";
// El logo.png normal trae el texto "CINCO S.A.S." en blanco (pensado para
// fondo navy) — sobre la portada clara quedaría invisible, así que ahí se
// usa esta variante con el texto en negro (mismo criterio que
// informes-pdf.js).
const LOGO_URL_TEXTO_OSCURO = "../assets/img/logo-texto-oscuro.png";
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
const ANCHO_PAGINA_MM = 215.9; // carta (Letter)
const ALTO_PAGINA_MM = 279.4;
const ANCHO_UTIL_MM = ANCHO_PAGINA_MM - MARGEN_MM * 2;
const ANCHO_UTIL_DXA = Math.round(ANCHO_UTIL_MM * DXA_POR_MM);
const ANCHO_PAGINA_DXA = Math.round(ANCHO_PAGINA_MM * DXA_POR_MM);
const ALTO_PAGINA_DXA = Math.round(ALTO_PAGINA_MM * DXA_POR_MM);
const mmATw = (mm) => Math.round(mm * DXA_POR_MM);

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
function anchosColumnaDocx(filas, merges = []) {
  const numCols = Math.max(...filas.map((f) => f.length));
  // Con muchas columnas, 900dxa de mínimo por columna puede no caber ni una
  // vez en el ancho útil — se reduce el mínimo para dejar margen real que
  // repartir proporcionalmente, en vez de caer al reparto parejo de más
  // abajo.
  const anchoMinDxa = Math.min(900, (ANCHO_UTIL_DXA / numCols) * 0.6);
  const anchoMaxDxa = ANCHO_UTIL_DXA * 0.6;

  const deseados = [];
  for (let c = 0; c < numCols; c++) {
    let maxLen = 0;
    filas.forEach((fila, fi) => {
      if (celdaCombinada(merges, fi, c)) return;
      const len = String(fila[c] || "").length;
      if (len > maxLen) maxLen = len;
    });
    deseados.push(maxLen);
  }

  // El largo de una celda combinada se reparte entre las columnas que
  // abarca — ver el comentario largo en calcularAnchosColumna de
  // informes-pdf.js (misma lógica, adaptada a caracteres en vez de mm).
  merges.forEach((m) => {
    const texto = String(filas[m.fila]?.[m.col] || "");
    if (!texto) return;
    const largoPorColumna = texto.length / m.cols;
    for (let c = m.col; c < m.col + m.cols; c++) {
      if (largoPorColumna > deseados[c]) deseados[c] = largoPorColumna;
    }
  });

  for (let c = 0; c < numCols; c++) deseados[c] = Math.min(Math.max(deseados[c] * 95 + 300, anchoMinDxa), anchoMaxDxa);

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

// Suma "cantidad" valores consecutivos de un arreglo desde "inicio" — para
// juntar el ancho de varias columnas que abarca una celda combinada.
function sumaRango(valores, inicio, cantidad) {
  let total = 0;
  for (let i = inicio; i < inicio + cantidad; i++) total += valores[i];
  return total;
}

export async function generarInformeDocxBlob(informe) {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
    ShadingType, WidthType, Header, Footer, AlignmentType, PageNumber, VerticalAlign, HeadingLevel, LevelFormat,
    VerticalMergeType, BorderStyle, TableOfContents, HeightRule
  } = window.docx;

  const portadaClara = informe.portada === "clara";

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

  // ---- encabezado/pie de las páginas de contenido (banda navy con el
  // logo, mismo criterio que el PDF) — la portada, más abajo, no lleva. ----
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
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: informe.titulo || "", bold: true, color: "FFFFFF", size: 16 })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: TIPO_LABEL[informe.tipoInforme] || "Informe", color: MUTED_CLARO_HEX, size: 15 })] })
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

  // ---- portada a página completa (bleed real: sección propia sin
  // márgenes) — mismo diseño que la del PDF: logo, título, tipo de
  // informe, datos del contrato centrados, radicado y fecha abajo. Las
  // posiciones son proporciones tomadas de las coordenadas en mm que usa
  // dibujarPortada en informes-pdf.js, convertidas a "espacio antes" de
  // cada párrafo — no son idénticas pixel a pixel (Word no coloca texto
  // por coordenada absoluta), pero caen en el mismo lugar aproximado.
  let logoPortada = null;
  try {
    logoPortada = await cargarImagenParaDocx(
      portadaClara ? LOGO_URL_TEXTO_OSCURO : LOGO_URL,
      portadaClara ? "#ffffff" : `#${NAVY_HEX}`,
      "image/png", "png"
    );
  } catch (e) { /* se genera igual sin logo */ }

  const colorTitulo = portadaClara ? NAVY_HEX : "FFFFFF";
  const colorTipoPortada = portadaClara ? AMBER_DARK_HEX : AMBER_HEX;
  const colorEtiquetaPortada = portadaClara ? NAVY_HEX : "FFFFFF";
  const colorValorPortada = portadaClara ? MUTED_HEX : VALOR_OSCURO_HEX;
  const colorRadicadoPortada = portadaClara ? NAVY_HEX : "FFFFFF";
  const colorPiePortada = portadaClara ? MUTED_HEX : MUTED_CLARO_HEX;

  const contenidoPortada = [];
  if (logoPortada) {
    const altoLogoPx = Math.round(32 * PX_POR_MM);
    const anchoLogoPx = Math.round(altoLogoPx * (logoPortada.ancho / logoPortada.alto));
    contenidoPortada.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: mmATw(55) },
      children: [new ImageRun({ data: logoPortada.buffer, transformation: { width: anchoLogoPx, height: altoLogoPx }, type: "png" })]
    }));
  }
  contenidoPortada.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: mmATw(28) },
    children: [new TextRun({ text: informe.titulo || "", bold: true, color: colorTitulo, size: 40 })]
  }));
  contenidoPortada.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: mmATw(6) },
    children: [new TextRun({ text: TIPO_LABEL[informe.tipoInforme] || "Informe", color: colorTipoPortada, size: 24 })]
  }));

  // Cada salto de línea escrito a mano (ej. en "Cargo", que es una caja de
  // varias líneas) se respeta tal cual — un TextRun por renglón, con
  // "break" (salto de línea de Word) entre uno y el siguiente.
  const runsConSaltos = (valor) => {
    const opcionesLineas = String(valor).split("\n").map((linea) => ({ text: linea, color: colorValorPortada, size: 21 }));
    for (let i = 0; i < opcionesLineas.length - 1; i++) opcionesLineas[i].break = 1;
    return opcionesLineas.map((o) => new TextRun(o));
  };
  const filaDatoPortada = (etiqueta, valor) => {
    if (!valor) return;
    contenidoPortada.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: mmATw(3) },
      children: [
        new TextRun({ text: `${etiqueta} `, bold: true, color: colorEtiquetaPortada, size: 21 }),
        ...runsConSaltos(valor)
      ]
    }));
  };
  // La primera fila de datos lleva un salto más grande (el hueco entre el
  // subtítulo y el bloque de datos del contrato); las siguientes usan el
  // espaciado corto normal entre renglones de filaDatoPortada.
  const primeraFilaDatos = [];
  const pushDato = (etiqueta, valor) => { if (valor) primeraFilaDatos.push([etiqueta, valor]); };
  pushDato("Contrato:", informe.contratoCodigo ? `${informe.contratoCodigo}${informe.contratoNumero ? " · N.º " + informe.contratoNumero : ""}` : null);
  pushDato("Objeto:", informe.contratoNombre);
  pushDato("Cliente:", informe.contratoCliente);
  pushDato("Supervisor:", informe.contratoSupervisor);
  pushDato("Vigencia:", informe.contratoFechaInicio ? `${formatearFechaLarga(informe.contratoFechaInicio)} — ${informe.contratoFechaFin ? formatearFechaLarga(informe.contratoFechaFin) : "en curso"}` : null);
  pushDato("Elaborado por:", informe.firmaNombre ? `${informe.firmaNombre}${informe.firmaCargo ? " — " + informe.firmaCargo : ""}` : null);
  primeraFilaDatos.forEach(([etiqueta, valor], i) => {
    if (i === 0) {
      contenidoPortada.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: mmATw(35) },
        children: [
          new TextRun({ text: `${etiqueta} `, bold: true, color: colorEtiquetaPortada, size: 21 }),
          ...runsConSaltos(valor)
        ]
      }));
    } else {
      filaDatoPortada(etiqueta, valor);
    }
  });

  contenidoPortada.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: mmATw(38) },
    children: [new TextRun({ text: `Radicado: ${informe.radicado || ""}`, bold: true, color: colorRadicadoPortada, size: 22 })]
  }));
  contenidoPortada.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: mmATw(6) },
    children: [new TextRun({
      // Fecha de la portada: la del campo "Fecha" del formulario si se
      // puso una (día exacto); si no, el día 1 del "Mes"; si tampoco hay
      // mes, la fecha de hoy (ver formatearFechaLarga).
      text: `Cinco S.A.S. · ${formatearFechaLarga(informe.fecha || (informe.mes ? informe.mes + "-01" : null))}`,
      color: colorPiePortada, size: 18
    })]
  }));

  const celdaPortada = new TableCell({
    width: { size: ANCHO_PAGINA_DXA, type: WidthType.DXA },
    shading: portadaClara ? undefined : { type: ShadingType.CLEAR, fill: NAVY_HEX, color: "auto" },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    borders: sinBordes(),
    children: contenidoPortada
  });
  const tablaPortada = new Table({
    width: { size: ANCHO_PAGINA_DXA, type: WidthType.DXA },
    indent: { size: 0, type: WidthType.DXA },
    borders: sinBordes(),
    rows: [new TableRow({ height: { value: ALTO_PAGINA_DXA, rule: HeightRule.ATLEAST }, children: [celdaPortada] })]
  });

  // ---- cuerpo por bloques, en el mismo orden que en el editor — se arma
  // primero (antes del índice/listas) para poder anotar en qué bloques van
  // los marcadores que el índice va a referenciar. ----
  const HEADING_POR_NIVEL = { titulo1: HeadingLevel.HEADING_1, titulo2: HeadingLevel.HEADING_2, titulo3: HeadingLevel.HEADING_3, titulo4: HeadingLevel.HEADING_4 };
  const NIVEL_NUMERACION = { titulo1: 0, titulo2: 1, titulo3: 2, titulo4: 3 };
  let numeroTabla = 0;
  let numeroFigura = 0;
  const graficosEntradas = [];
  const tablasEntradas = [];
  const cuerpo = [];
  let esPrimerBloqueDeCuerpo = true;

  for (const bloque of informe.bloques || []) {
    const primerBloque = esPrimerBloqueDeCuerpo;
    esPrimerBloqueDeCuerpo = false;

    if (bloque.tipo in HEADING_POR_NIVEL) {
      cuerpo.push(new Paragraph({
        heading: HEADING_POR_NIVEL[bloque.tipo],
        pageBreakBefore: primerBloque || undefined,
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
      tablasEntradas.push(tituloTexto);
      cuerpo.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: primerBloque || undefined,
        children: [new TextRun({ text: tituloTexto, bold: true, color: NAVY_HEX, size: 19 })]
      }));

      const numFilasTabla = filas.length;
      const numColsTabla = Math.max(...filas.map((f) => f.length));
      // Combinar celdas, ver web/js/control/tabla-celdas.js — el texto de
      // una celda combinada se excluye del cálculo de ancho de columna.
      const merges = normalizarMerges(bloque.merges || [], numFilasTabla, numColsTabla);
      const centrados = normalizarCentrados(bloque.centrados || [], numFilasTabla, numColsTabla);
      const anchos = anchosColumnaDocx(filas, merges);
      const margenesCelda = { top: 60, bottom: 60, left: 100, right: 100 };

      const filasDocx = filas.map((fila, fi) => {
        const celdas = [];
        for (let ci = 0; ci < numColsTabla; ci++) {
          const info = celdaCombinada(merges, fi, ci);
          if (info && !info.esAncla) {
            // Celda cubierta por un merge: si es puramente horizontal
            // (mismo renglón que su ancla), columnSpan ya la cubre y no se
            // agrega ninguna celda. Si es una fila de continuación de un
            // merge vertical, docx.js sí exige una celda "placeholder" en
            // la columna donde arranca ese merge, marcada CONTINUE.
            if (ci === info.merge.col && fi > info.merge.fila) {
              celdas.push(new TableCell({
                width: { size: sumaRango(anchos, ci, info.merge.cols), type: WidthType.DXA },
                columnSpan: info.merge.cols > 1 ? info.merge.cols : undefined,
                verticalMerge: VerticalMergeType.CONTINUE,
                margins: margenesCelda,
                children: [new Paragraph({ children: [] })]
              }));
            }
            continue;
          }
          const ancho = info ? sumaRango(anchos, ci, info.merge.cols) : anchos[ci];
          celdas.push(new TableCell({
            width: { size: ancho, type: WidthType.DXA },
            shading: fi === 0 ? { type: ShadingType.CLEAR, fill: GRIS_CLARO_HEX, color: "auto" } : undefined,
            columnSpan: info && info.merge.cols > 1 ? info.merge.cols : undefined,
            verticalMerge: info && info.merge.filas > 1 ? VerticalMergeType.RESTART : undefined,
            margins: margenesCelda,
            children: [new Paragraph({
              alignment: celdaCentrada(centrados, fi, ci) ? AlignmentType.CENTER : undefined,
              children: [new TextRun({ text: String(fila[ci] || ""), bold: fi === 0, size: 17 })]
            })]
          }));
        }
        return new TableRow({ children: celdas });
      });
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
      graficosEntradas.push(nombreTexto);
      cuerpo.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: primerBloque || undefined,
        children: [new TextRun({ text: nombreTexto, bold: true, color: NAVY_HEX, size: 19 })]
      }));
      try {
        const img = await cargarImagenParaDocx(bloque.url, "#ffffff", "image/jpeg", "jpg");
        // Mismo "Tamaño en el informe" elegido en el editor que usa el PDF
        // (ver dibujarImagen en informes-pdf.js) — 85% si el bloque es de
        // antes de que existiera el control.
        const escalaImagen = Math.min(100, Math.max(30, bloque.tamano || 85)) / 100;
        let anchoPx = Math.round(ANCHO_UTIL_MM * PX_POR_MM * escalaImagen);
        let altoPx = Math.round(anchoPx * (img.alto / img.ancho));
        const altoMaximoPx = Math.round(200 * PX_POR_MM);
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

    if (bloque.tipo === "firma") {
      const firmantes = bloque.firmantes && bloque.firmantes.length ? bloque.firmantes : [{ nombre: "", cargo: "" }];
      if (bloque.etiqueta) {
        cuerpo.push(new Paragraph({
          pageBreakBefore: primerBloque || undefined,
          children: [new TextRun({ text: bloque.etiqueta.toUpperCase(), bold: true, color: NAVY_HEX, size: 19 })]
        }));
      }
      const anchoColumnaDxa = Math.round(ANCHO_UTIL_DXA / firmantes.length);
      // Fila 1: firma digital (imagen subida en el editor) si el firmante
      // tiene una, o el espacio en blanco de siempre para firmar a mano si
      // no; fila 2: línea de firma (borde superior de la celda) con el
      // nombre y cargo debajo.
      // Word no dibuja libre como el PDF (es una tabla), así que agrandar la
      // firma no la monta sobre el contenido de arriba — solo hace la
      // imagen más grande dentro de su celda, con la fila creciendo si hace
      // falta.
      const anchoColumnaMmMenosPadding = ANCHO_UTIL_MM / firmantes.length - 6;
      const celdasEspacio = await Promise.all(firmantes.map(async (f) => {
        if (f.firmaUrl) {
          try {
            const altoFirmaImgPx = Math.round(Math.min(60, Math.max(6, Number(f.altoFirma) || 14)) * PX_POR_MM);
            const img = await cargarImagenParaDocx(f.firmaUrl, "#ffffff", "image/png", "png");
            let anchoImgPx = Math.round(altoFirmaImgPx * (img.ancho / img.alto));
            const anchoMaxPx = Math.round(anchoColumnaMmMenosPadding * PX_POR_MM);
            if (anchoImgPx > anchoMaxPx) anchoImgPx = anchoMaxPx;
            const altoImgPx = Math.round(anchoImgPx * (img.alto / img.ancho));
            return new TableCell({
              width: { size: anchoColumnaDxa, type: WidthType.DXA },
              borders: sinBordes(),
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ data: img.buffer, transformation: { width: anchoImgPx, height: altoImgPx }, type: "png" })]
              })]
            });
          } catch (e) { /* si no carga, cae al espacio en blanco de abajo */ }
        }
        return new TableCell({
          width: { size: anchoColumnaDxa, type: WidthType.DXA },
          borders: sinBordes(),
          children: [new Paragraph({ text: "" }), new Paragraph({ text: "" })]
        });
      }));
      const celdaFirma = (f) => new TableCell({
        width: { size: anchoColumnaDxa, type: WidthType.DXA },
        borders: { ...sinBordes(), top: { style: BorderStyle.SINGLE, size: 4, color: "787E86" } },
        margins: { top: 60 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.nombre || "", bold: true, size: 19 })] }),
          ...(f.cargo ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.cargo, color: MUTED_HEX, size: 17 })] })] : [])
        ]
      });
      cuerpo.push(new Table({
        width: { size: ANCHO_UTIL_DXA, type: WidthType.DXA },
        borders: sinBordes(),
        rows: [
          new TableRow({ children: celdasEspacio }),
          new TableRow({ children: firmantes.map((f) => celdaFirma(f)) })
        ]
      }));
      cuerpo.push(new Paragraph({ text: "" }));
      continue;
    }

    // párrafo
    cuerpo.push(new Paragraph({
      pageBreakBefore: primerBloque || undefined,
      children: runsParaDocx(TextRun, bloque.texto, 21)
    }));
    cuerpo.push(new Paragraph({ text: "" }));
  }

  // ---- índice (con número de página real de Word, campo TOC nativo —
  // Word lo calcula solo al abrir el archivo gracias a features.updateFields,
  // más abajo) + listas de gráficos/tablas. Las listas de gráficos/tablas
  // van SIN número de página: se armaron a mano con marcadores + PAGEREF
  // igual que el índice, pero ese campo no se actualiza de forma confiable
  // en Word (a diferencia del TOC nativo) — mejor una lista simple que
  // siempre se ve bien que un número que se queda pegado o en blanco.
  const listaSimple = (entradas) => entradas.map((texto) => new Paragraph({ children: [new TextRun({ text: texto, size: 21 })] }));

  const indiceYListas = [
    new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Contenido", bold: true, color: NAVY_HEX })]
    }),
    new TableOfContents("Contenido", { hyperlink: true, headingStyleRange: "1-4" })
  ];
  if (graficosEntradas.length) {
    indiceYListas.push(new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Lista de gráficos", bold: true, color: NAVY_HEX })]
    }));
    indiceYListas.push(...listaSimple(graficosEntradas));
  }
  if (tablasEntradas.length) {
    indiceYListas.push(new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Lista de tablas", bold: true, color: NAVY_HEX })]
    }));
    indiceYListas.push(...listaSimple(tablasEntradas));
  }
  const documento = new Document({
    features: { updateFields: true },
    numbering: { config: [numeracionTitulos] },
    sections: [
      {
        // Portada: sección propia sin márgenes (bleed real) y sin
        // encabezado/pie — igual que la del PDF.
        properties: {
          page: {
            size: { width: ANCHO_PAGINA_DXA, height: ALTO_PAGINA_DXA },
            margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 }
          }
        },
        children: [tablaPortada]
      },
      {
        // Índice + listas + cuerpo: márgenes normales, con encabezado/pie.
        properties: {
          page: {
            size: { width: ANCHO_PAGINA_DXA, height: ALTO_PAGINA_DXA },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 340, footer: 340 }
          }
        },
        headers: { default: new Header({ children: [headerTable] }) },
        footers: { default: new Footer({ children: [footerTable] }) },
        children: [...indiceYListas, ...cuerpo]
      }
    ]
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
