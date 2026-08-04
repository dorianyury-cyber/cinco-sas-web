// Genera el PDF de una carta con el membrete nuevo de Cinco S.A.S., a
// partir de los datos guardados en Firestore (nunca se guarda el PDF en
// sí, se reconstruye aquí cada vez que hace falta).
//
// Depende de jsPDF autoalojado en web/js/vendor/jspdf.umd.min.js (script
// clásico, no módulo, por eso queda en window.jspdf) — así no hace falta
// abrir el CSP del sitio a un CDN externo.

import { parsearHtmlARuns } from "./texto-rico.js";

const NAVY = [31, 39, 50];
const NAVY_HEX = "#1f2732";
const AMBER = [254, 178, 9];
const TEXT_MUTED = [92, 101, 112];
const GRIS_CLARO = [245, 246, 248];
const LOGO_URL = "../assets/img/logo.png";

// Código y versión del formato en blanco (la plantilla), tal como quedó
// registrado en el Listado Maestro de Documentos (documentos.html, área
// AC — Actividades, ver la nota en correspondencia.js) — si ahí se
// registra una nueva versión del diseño, actualizar también acá.
const CODIGO_FORMATO = "AC-FOR-001";
const VERSION_FORMATO = "1";

// Se dibuja en un <canvas> antes de pasarlo a jsPDF, aplanando la
// transparencia contra "colorFondo" — pasarle el <img> directo a
// addImage() se veía mal con PNGs semitransparentes. El logo de Cinco
// S.A.S. en particular tiene el texto en blanco (pensado para fondos
// oscuros, como el encabezado navy del sitio web), por eso el logo se
// aplana contra NAVY, no contra blanco — si no, el texto blanco
// desaparece contra la página.
// formato "PNG" (por defecto, para el logo — necesita transparencia) o
// "JPEG" (para las fotos que se insertan en la carta): re-exportar como
// PNG sin pérdida infla muchísimo capturas de pantalla o fotos, aunque ya
// se hayan comprimido a JPEG al subirlas.
function cargarImagenComoDataURL(url, colorFondo = "#ffffff", formato = "PNG") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Solo hace falta pedir CORS para URLs remotas (Storage) — pedirlo para
    // blob:/data: (imágenes locales, como en la vista previa) a veces hace
    // que la carga falle sin necesidad, porque esas ya son del mismo origen.
    if (/^https?:/.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = colorFondo;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const dataUrl = formato === "JPEG" ? canvas.toDataURL("image/jpeg", 0.82) : canvas.toDataURL("image/png");
      resolve({ dataUrl, ancho: img.naturalWidth, alto: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function formatearFechaLarga(fechaISO) {
  const fecha = fechaISO ? new Date(fechaISO + "T12:00:00") : new Date();
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

export async function generarCartaPDF(datos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margenX = 20;
  const anchoUtil = anchoPagina - margenX * 2;

  // ---- encabezado: banda navy con el logo (igual que el sitio web) ----
  const altoBanda = 28;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, anchoPagina, altoBanda, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, altoBanda, anchoPagina, 1.2, "F");

  try {
    const logo = await cargarImagenComoDataURL(LOGO_URL, NAVY_HEX);
    const altoLogo = 16;
    const anchoLogo = altoLogo * (logo.ancho / logo.alto);
    doc.addImage(logo.dataUrl, "PNG", margenX, (altoBanda - altoLogo) / 2, anchoLogo, altoLogo);
  } catch (e) {
    // Si el logo no carga (ej. viendo el archivo fuera del sitio), la carta
    // se genera igual, solo sin el logo.
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("CINCO S.A.S.", anchoPagina - margenX, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(199, 204, 211);
  doc.text("Construcción, Ingeniería y Consultoría S.A.S.", anchoPagina - margenX, 17, { align: "right" });
  doc.text("NIT. 900.338.346-1", anchoPagina - margenX, 21.5, { align: "right" });

  // ---- radicado + fecha ----
  let y = altoBanda + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Radicado: ${datos.radicado}`, margenX, y);
  const fechaTexto = `${datos.ciudad || "Neiva"}, ${formatearFechaLarga(datos.fecha)}`;
  doc.text(fechaTexto, anchoPagina - margenX, y, { align: "right" });

  // ---- destinatario ----
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Señores", margenX, y);
  y += 6;
  const destinatarioLineas = doc.splitTextToSize(datos.destinatario || "", anchoUtil);
  doc.text(destinatarioLineas, margenX, y);
  y += destinatarioLineas.length * 5 + 8;

  // ---- asunto ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  const asuntoLineas = doc.splitTextToSize(`Asunto: ${datos.asunto || ""}`, anchoUtil);
  doc.text(asuntoLineas, margenX, y);
  y += asuntoLineas.length * 5.5 + 8;

  // ---- cuerpo: lista de bloques (texto/imagen) en el orden elegido en el
  // editor. Cartas creadas antes de esto no tienen "bloques" — se arma uno
  // solo de texto a partir del "cuerpo" plano que sí tenían.
  const bloques = datos.bloques && datos.bloques.length
    ? datos.bloques
    : [{ tipo: "texto", texto: datos.cuerpo || "" }];

  for (const bloque of bloques) {
    if (bloque.tipo === "imagen") {
      try {
        const img = await cargarImagenComoDataURL(bloque.url, "#ffffff", "JPEG");
        let anchoImg = anchoUtil;
        let altoImg = anchoImg * (img.alto / img.ancho);
        const altoMaximo = 90;
        if (altoImg > altoMaximo) { altoImg = altoMaximo; anchoImg = altoImg * (img.ancho / img.alto); }
        if (y + altoImg > altoPagina - 45) { doc.addPage(); y = 20; }
        doc.addImage(img.dataUrl, "JPEG", margenX, y, anchoImg, altoImg);
        y += altoImg + 6;
      } catch (e) {
        // Antes esto fallaba en silencio y la carta se veía "completa"
        // aunque faltara una foto — ahora se deja visible que algo no
        // cargó, en vez de desaparecer sin aviso.
        const altoAviso = 14;
        if (y + altoAviso > altoPagina - 45) { doc.addPage(); y = 20; }
        doc.setDrawColor(214, 69, 69);
        doc.setLineWidth(0.4);
        doc.rect(margenX, y, anchoUtil, altoAviso);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(178, 52, 52);
        doc.setFont("helvetica", "bolditalic");
        doc.text("Aviso:", margenX + 4, y + altoAviso / 2 + 1.5);
        doc.setFont("helvetica", "italic");
        doc.text(" no se pudo cargar esta imagen al generar el documento.", margenX + 16, y + altoAviso / 2 + 1.5);
        y += altoAviso + 6;
      }
      continue;
    }

    // Dibuja el párrafo con negrilla/cursiva/color por tramo, tal como se
    // escribió en el campo de texto rico (ver web/js/control/texto-rico.js)
    // — mismo criterio que informes-pdf.js/ofertas-pdf.js.
    doc.setFontSize(10.5);
    const runsParrafo = parsearHtmlARuns(bloque.texto);
    if (runsParrafo.length) {
      const COLOR_PARRAFO = [20, 22, 26];
      const estiloFuente = (negrita, cursiva) => {
        if (negrita && cursiva) return "bolditalic";
        if (negrita) return "bold";
        if (cursiva) return "italic";
        return "normal";
      };
      const medirToken = (token) => {
        doc.setFont("helvetica", estiloFuente(token.negrita, token.cursiva));
        return doc.getTextWidth(token.texto);
      };
      const tokens = [];
      runsParrafo.forEach((run) => {
        if (run.salto) { tokens.push({ salto: true }); return; }
        run.texto.split(/(\s+)/).filter((p) => p !== "").forEach((palabra) => {
          tokens.push({ texto: palabra, negrita: run.negrita, cursiva: run.cursiva, color: run.color });
        });
      });

      let linea = [];
      let anchoLinea = 0;
      const trazarLinea = () => {
        if (!linea.length) { y += 5.5; return; }
        if (y + 5.5 > altoPagina - 45) { doc.addPage(); y = 20; }
        let x = margenX;
        linea.forEach((token) => {
          doc.setFont("helvetica", estiloFuente(token.negrita, token.cursiva));
          doc.setTextColor(...(token.color || COLOR_PARRAFO));
          doc.text(token.texto, x, y);
          x += medirToken(token);
        });
        y += 5.5;
        linea = [];
        anchoLinea = 0;
      };
      // lineaNueva: true justo tras un salto explícito (fin de línea/viñeta
      // en el HTML), no tras un salto de línea automático por ajuste de
      // ancho — así el espacio de sangría de una viñeta ("    o texto")
      // sobrevive, pero se sigue evitando arrancar una línea de ajuste con
      // un espacio suelto.
      let lineaNueva = true;
      tokens.forEach((token) => {
        if (token.salto) { trazarLinea(); y += 5.5 * 0.3; lineaNueva = true; return; }
        const ancho = medirToken(token);
        const esEspacio = /^\s+$/.test(token.texto);
        if (esEspacio && !linea.length && !lineaNueva) return;
        if (!esEspacio && anchoLinea + ancho > anchoUtil && linea.length) trazarLinea();
        linea.push(token);
        anchoLinea += ancho;
        lineaNueva = false;
      });
      trazarLinea();
      y += 5;
    }
  }

  // ---- cierre y firma ----
  y += 8;
  if (y > altoPagina - 55) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 22, 26);
  doc.text("Cordialmente,", margenX, y);
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.text(datos.firmaNombre || "", margenX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  if (datos.firmaCargo) { doc.text(datos.firmaCargo, margenX, y); y += 5; }
  doc.text("Cinco S.A.S.", margenX, y);

  // ---- pie de página (todas las páginas): franja gris clara con
  // dirección a la izquierda y radicado/página a la derecha, en vez de
  // una sola línea de texto apretada al centro. ----
  const totalPaginas = doc.internal.getNumberOfPages();
  const altoPie = 16;
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    const yPie = altoPagina - altoPie;
    doc.setFillColor(...AMBER);
    doc.rect(0, yPie, anchoPagina, 0.8, "F");
    doc.setFillColor(...GRIS_CLARO);
    doc.rect(0, yPie + 0.8, anchoPagina, altoPie, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text("Cinco S.A.S.", margenX, yPie + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Calle 17 #47-21 B/Villa Café, Neiva (Huila) · gerencia.cincoltda@hotmail.com · Tel: 8768430", margenX, yPie + 11);

    doc.setFontSize(7.5);
    doc.text("cinco-sas.web.app", anchoPagina - margenX, yPie + 6.5, { align: "right" });
    const piePagina2 = CODIGO_FORMATO
      ? `Formato ${CODIGO_FORMATO} · Versión ${VERSION_FORMATO} · Página ${p} de ${totalPaginas}`
      : `Página ${p} de ${totalPaginas}`;
    doc.text(piePagina2, anchoPagina - margenX, yPie + 11, { align: "right" });
  }

  return doc;
}
