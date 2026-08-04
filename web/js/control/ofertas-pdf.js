// Genera el PDF de una Oferta comercial (diseño propio de Cinco S.A.S.):
// portada, presentación de la empresa por bloques, condiciones de la
// oferta, firma, y como Anexo 1 (en página aparte, después de un salto de
// página explícito) la cotización detallada con el desglose AIU/IVA.
//
// Depende de jsPDF autoalojado en web/js/vendor/jspdf.umd.min.js — mismo
// criterio que informes-pdf.js/correspondencia-pdf.js. Los helpers de
// abajo son copias locales de los de informes-pdf.js (cada -pdf.js con
// los suyos, sin módulo compartido — mismo criterio ya establecido en
// este proyecto).

import { nombreLinea } from "./lineas-servicio.js";
import { parsearHtmlARuns } from "./texto-rico.js";

const NAVY = [31, 39, 50];
const NAVY_HEX = "#1f2732";
const AMBER = [254, 178, 9];
const AMBER_DARK = [217, 148, 0];
const TEXT_MUTED = [92, 101, 112];
const GRIS_CLARO = [245, 246, 248];
const LOGO_URL = "../assets/img/logo.png";
const LOGO_URL_TEXTO_OSCURO = "../assets/img/logo-texto-oscuro.png";

// Código y versión de ESTE formato, para el Listado Maestro de Documentos
// (documentos.html, área SC — Servicio al Cliente) — igual criterio que
// informes-pdf.js/correspondencia-pdf.js.
const CODIGO_FORMATO = "SC-FOR-002";
const VERSION_FORMATO = "1";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const formatoCantidad = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

// formato "PNG" (por defecto, para el logo/firma — pueden necesitar
// transparencia) o "JPEG" (para las fotos/gráficos del cuerpo de la
// oferta): re-exportar como PNG sin pérdida infla muchísimo capturas de
// pantalla o fotos, aunque ya se hayan comprimido a JPEG al subirlas.
function cargarImagenComoDataURL(url, colorFondo = "#ffffff", formato = "PNG") {
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
      const dataUrl = formato === "JPEG" ? canvas.toDataURL("image/jpeg", 0.82) : canvas.toDataURL("image/png");
      resolve({ dataUrl, ancho: img.naturalWidth, alto: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function calcularAnchosColumna(doc, filas, anchoUtil) {
  const numCols = Math.max(...filas.map((f) => f.length));
  const anchoMin = 18;
  const anchoMax = anchoUtil * 0.55;
  const anchosCrudos = [];
  for (let c = 0; c < numCols; c++) {
    let maximo = 0;
    filas.forEach((fila) => {
      const ancho = doc.getTextWidth(fila[c] || "");
      if (ancho > maximo) maximo = ancho;
    });
    anchosCrudos.push(Math.min(Math.max(maximo + 6, anchoMin), anchoMax));
  }
  const total = anchosCrudos.reduce((a, b) => a + b, 0);
  const factor = anchoUtil / total;
  return anchosCrudos.map((a) => a * factor);
}

// Misma regla de negocio que ofertas.js (copiada, no compartida — ver
// nota arriba): "obra" reparte AIU sobre el costo directo y el IVA cae
// solo sobre la Utilidad; "servicio" no tiene AIU y el IVA cae sobre el
// costo directo completo.
function calcularTotales(items, tipo, aiu, ivaPct) {
  const costoDirecto = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.valorUnitario) || 0), 0);
  if (tipo === "obra") {
    const administracion = costoDirecto * ((Number(aiu?.administracion) || 0) / 100);
    const imprevistos = costoDirecto * ((Number(aiu?.imprevistos) || 0) / 100);
    const utilidad = costoDirecto * ((Number(aiu?.utilidad) || 0) / 100);
    const ivaValor = utilidad * ((Number(ivaPct) || 0) / 100);
    const total = costoDirecto + administracion + imprevistos + utilidad + ivaValor;
    return { costoDirecto, administracion, imprevistos, utilidad, ivaValor, total };
  }
  const ivaValor = costoDirecto * ((Number(ivaPct) || 0) / 100);
  const total = costoDirecto + ivaValor;
  return { costoDirecto, administracion: 0, imprevistos: 0, utilidad: 0, ivaValor, total };
}

export async function generarOfertaPDF(oferta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margenX = 20;
  const margenSuperior = 26;
  const margenInferior = altoPagina - 22;
  const anchoUtil = anchoPagina - margenX * 2;
  const lineHeight = 5.2;

  const portadaClara = oferta.portada === "clara";

  let logo = null;
  try {
    logo = await cargarImagenComoDataURL(portadaClara ? LOGO_URL_TEXTO_OSCURO : LOGO_URL, portadaClara ? "#ffffff" : NAVY_HEX);
  } catch (e) { /* se genera igual sin logo */ }

  // ---- cuerpo: se dibuja primero, arrancando "en blanco" en la página 1
  // (luego se le inserta la portada adelante) ----
  let y = margenSuperior;

  function saltoSiNoCabe(alturaNecesaria) {
    if (y + alturaNecesaria > margenInferior) {
      doc.addPage();
      y = margenSuperior;
    }
  }

  // Dibuja un párrafo con negrilla/cursiva/color por tramo, tal como se
  // escribió en el campo de texto rico (ver web/js/control/texto-rico.js)
  // — mismo criterio que informes-pdf.js.
  const COLOR_PARRAFO = [20, 22, 26];
  function estiloFuente(negrita, cursiva) {
    if (negrita && cursiva) return "bolditalic";
    if (negrita) return "bold";
    if (cursiva) return "italic";
    return "normal";
  }
  function medirToken(token) {
    doc.setFont("helvetica", estiloFuente(token.negrita, token.cursiva));
    return doc.getTextWidth(token.texto);
  }
  function dibujarParrafo(html) {
    doc.setFontSize(10.5);
    const runs = parsearHtmlARuns(html);
    if (!runs.length) return;

    const tokens = [];
    runs.forEach((run) => {
      if (run.salto) { tokens.push({ salto: true }); return; }
      run.texto.split(/(\s+)/).filter((p) => p !== "").forEach((palabra) => {
        tokens.push({ texto: palabra, negrita: run.negrita, cursiva: run.cursiva, color: run.color });
      });
    });

    let linea = [];
    let anchoLinea = 0;
    function trazarLinea() {
      if (!linea.length) { y += lineHeight; return; }
      saltoSiNoCabe(lineHeight);
      let x = margenX;
      linea.forEach((token) => {
        doc.setFont("helvetica", estiloFuente(token.negrita, token.cursiva));
        doc.setTextColor(...(token.color || COLOR_PARRAFO));
        doc.text(token.texto, x, y);
        x += medirToken(token);
      });
      y += lineHeight;
      linea = [];
      anchoLinea = 0;
    }

    // lineaNueva: true justo tras un salto explícito (fin de línea/viñeta en
    // el HTML), no tras un salto de línea automático por ajuste de ancho —
    // así el espacio de sangría de una viñeta ("    o texto") sobrevive,
    // pero se sigue evitando arrancar una línea de ajuste con un espacio
    // suelto.
    let lineaNueva = true;
    tokens.forEach((token) => {
      if (token.salto) { trazarLinea(); y += lineHeight * 0.3; lineaNueva = true; return; }
      const ancho = medirToken(token);
      const esEspacio = /^\s+$/.test(token.texto);
      if (esEspacio && !linea.length && !lineaNueva) return;
      if (!esEspacio && anchoLinea + ancho > anchoUtil && linea.length) trazarLinea();
      linea.push(token);
      anchoLinea += ancho;
      lineaNueva = false;
    });
    trazarLinea();
    y += lineHeight * 0.5;
  }

  // Numeración automática 1 / 1.1 / 1.1.1 / 1.1.1.1 para Título 1..4 —
  // mismo criterio que informes-pdf.js: cada nivel arranca en 1 y se
  // reinicia solo cuando aparece un título de nivel superior.
  const contadoresTitulo = [0, 0, 0, 0];
  function numeroTitulo(nivel) {
    contadoresTitulo[nivel - 1] += 1;
    for (let i = nivel; i < contadoresTitulo.length; i++) contadoresTitulo[i] = 0;
    return contadoresTitulo.slice(0, nivel).join(".") + ".";
  }

  function dibujarTitulo(nivel, textoOriginal) {
    const texto = `${numeroTitulo(nivel)} ${textoOriginal || ""}`.trim();
    if (nivel === 1) {
      // A diferencia de informes-pdf.js (capítulos largos, sí conviene
      // arrancar página nueva), una oferta tiene secciones cortas — forzar
      // salto de página en cada título 1 dejaba páginas casi en blanco.
      // Solo salta si de verdad no cabe, igual que los otros niveles.
      saltoSiNoCabe(lineHeight * 3);
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...NAVY);
    } else if (nivel === 2) {
      saltoSiNoCabe(lineHeight * 2.4);
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.setTextColor(...NAVY);
    } else if (nivel === 3) {
      saltoSiNoCabe(lineHeight * 2.2);
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 34, 40);
    } else {
      saltoSiNoCabe(lineHeight * 2);
      y += 1.5;
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_MUTED);
    }
    const lineas = doc.splitTextToSize(texto || "", anchoUtil);
    doc.text(lineas, margenX, y);
    y += lineas.length * (lineHeight + (nivel === 1 ? 1.5 : 0.5)) + 3;
  }

  async function dibujarImagen(bloque) {
    try {
      const img = await cargarImagenComoDataURL(bloque.url, "#ffffff", "JPEG");
      let ancho = anchoUtil * 0.85;
      let alto = ancho * (img.alto / img.ancho);
      const altoMaximo = 100;
      if (alto > altoMaximo) { alto = altoMaximo; ancho = alto * (img.ancho / img.alto); }
      saltoSiNoCabe(alto + 10);
      const x = margenX + (anchoUtil - ancho) / 2;
      doc.addImage(img.dataUrl, "JPEG", x, y, ancho, alto);
      y += alto + 3;
      if (bloque.pieDeFoto) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_MUTED);
        const lineasPie = doc.splitTextToSize(bloque.pieDeFoto, anchoUtil);
        doc.text(lineasPie, anchoPagina / 2, y, { align: "center" });
        y += lineasPie.length * 4.5 + 5;
      } else {
        y += 4;
      }
    } catch (e) {
      saltoSiNoCabe(14);
      doc.setDrawColor(214, 69, 69);
      doc.setLineWidth(0.4);
      doc.rect(margenX, y, anchoUtil, 14);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(178, 52, 52);
      doc.text("Aviso: no se pudo cargar esta imagen.", margenX + 4, y + 8);
      y += 20;
    }
  }

  function dibujarTabla(bloque) {
    const filasCrudas = bloque.filas && bloque.filas.length ? bloque.filas : [[""]];
    const filas = filasCrudas.map((f) => (Array.isArray(f) ? f : f.celdas || []));

    if (bloque.titulo) {
      saltoSiNoCabe(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...NAVY);
      doc.text(bloque.titulo, margenX, y);
      y += 7;
    }

    const anchos = calcularAnchosColumna(doc, filas, anchoUtil);
    const padding = 2.2;
    doc.setFontSize(9);

    filas.forEach((fila, fi) => {
      doc.setFont("helvetica", fi === 0 ? "bold" : "normal");
      const lineasPorCelda = anchos.map((ancho, ci) => doc.splitTextToSize(String(fila[ci] || ""), ancho - padding * 2));
      const alturaFila = Math.max(...lineasPorCelda.map((l) => l.length)) * 4.2 + padding * 2;

      saltoSiNoCabe(alturaFila);
      let x = margenX;
      if (fi === 0) doc.setFillColor(...GRIS_CLARO);
      anchos.forEach((ancho, ci) => {
        if (fi === 0) doc.rect(x, y, ancho, alturaFila, "F");
        doc.setDrawColor(210, 214, 219);
        doc.rect(x, y, ancho, alturaFila);
        x += ancho;
      });
      x = margenX;
      doc.setTextColor(20, 22, 26);
      anchos.forEach((ancho, ci) => {
        doc.text(lineasPorCelda[ci], x + padding, y + padding + 3.2);
        x += ancho;
      });
      y += alturaFila;
    });
    y += 6;
  }

  // ---- encabezado del cuerpo: título + franja línea de servicio/cliente ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  const tituloLineas = doc.splitTextToSize(oferta.titulo || "", anchoUtil);
  doc.text(tituloLineas, margenX, y);
  y += tituloLineas.length * 7 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`${nombreLinea(oferta.lineaServicio)} · Cliente: ${oferta.cliente || ""}`, margenX, y);
  y += 10;

  for (const bloque of oferta.bloques || []) {
    if (bloque.tipo === "titulo1") dibujarTitulo(1, bloque.texto);
    else if (bloque.tipo === "titulo2") dibujarTitulo(2, bloque.texto);
    else if (bloque.tipo === "titulo3") dibujarTitulo(3, bloque.texto);
    else if (bloque.tipo === "titulo4") dibujarTitulo(4, bloque.texto);
    else if (bloque.tipo === "parrafo") dibujarParrafo(bloque.texto);
    else if (bloque.tipo === "tabla") dibujarTabla(bloque);
    else if (bloque.tipo === "imagen") await dibujarImagen(bloque);
  }

  // ---- condiciones de la oferta ----
  const c = oferta.condiciones || {};
  saltoSiNoCabe(16);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("Condiciones de la oferta", margenX, y);
  y += 9;

  const condicionLinea = (etiqueta, valor) => {
    if (!valor) return;
    const lineas = doc.splitTextToSize(String(valor), anchoUtil - 48);
    saltoSiNoCabe(Math.max(lineas.length * 5.2, 6.5));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(etiqueta, margenX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 22, 26);
    doc.text(lineas, margenX + 48, y);
    y += Math.max(lineas.length * 5.2, 6.5);
  };
  condicionLinea("Póliza:", c.aplicaPoliza ? (c.detallePoliza || "Aplica") : "No aplica");
  condicionLinea("Anticipo:", c.porcentajeAnticipo ? `${c.porcentajeAnticipo}%` : null);
  condicionLinea("Validez de la oferta:", c.validezDias ? `${c.validezDias} días calendario` : null);
  condicionLinea("Forma de pago:", c.formaPago);
  condicionLinea("Otras condiciones:", c.otras);
  y += 8;

  // ---- cierre y firma ----
  saltoSiNoCabe(45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 22, 26);
  doc.text("Cordialmente,", margenX, y);
  y += 6;

  if (oferta.firmaUrl) {
    try {
      const firma = await cargarImagenComoDataURL(oferta.firmaUrl);
      const altoFirma = 26;
      const anchoFirma = altoFirma * (firma.ancho / firma.alto);
      doc.addImage(firma.dataUrl, "PNG", margenX, y, anchoFirma, altoFirma);
      y += altoFirma + 2;
    } catch (e) {
      y += 16;
    }
  } else {
    y += 16;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(oferta.firmaNombre || "", margenX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  if (oferta.firmaCargo) { doc.text(oferta.firmaCargo, margenX, y); y += 5; }
  doc.text("Cinco S.A.S.", margenX, y);

  // ---- salto de página explícito antes del anexo de cotización ----
  doc.addPage();
  y = margenSuperior;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text("Anexo 1 — Cotización detallada", margenX, y);
  y += 10;

  const items = oferta.items || [];
  const filasTabla = [["No.", "Descripción", "Unidad", "Cantidad", "Valor unitario", "Valor total"]];
  items.forEach((it, i) => {
    filasTabla.push([
      String(i + 1),
      it.descripcion || "",
      it.unidad || "—",
      formatoCantidad.format(Number(it.cantidad) || 0),
      formatoMoneda.format(Number(it.valorUnitario) || 0),
      formatoMoneda.format((Number(it.cantidad) || 0) * (Number(it.valorUnitario) || 0))
    ]);
  });
  dibujarTabla({ filas: filasTabla });

  const t = calcularTotales(items, oferta.tipo, oferta.aiu, oferta.iva ?? 19);
  const xEtiqueta = anchoPagina - margenX - 75;
  const filaTotal = (etiqueta, valor, negrita) => {
    saltoSiNoCabe(9);
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.setFontSize(negrita ? 11.5 : 10);
    doc.setTextColor(...(negrita ? NAVY : [20, 22, 26]));
    doc.text(etiqueta, xEtiqueta, y);
    doc.text(valor, anchoPagina - margenX, y, { align: "right" });
    y += negrita ? 8 : 6.5;
  };
  filaTotal("Costo directo", formatoMoneda.format(t.costoDirecto));
  if (oferta.tipo === "obra") {
    filaTotal(`Administración (${oferta.aiu?.administracion ?? 0}%)`, formatoMoneda.format(t.administracion));
    filaTotal(`Imprevistos (${oferta.aiu?.imprevistos ?? 0}%)`, formatoMoneda.format(t.imprevistos));
    filaTotal(`Utilidad (${oferta.aiu?.utilidad ?? 0}%)`, formatoMoneda.format(t.utilidad));
  }
  filaTotal(`IVA (${oferta.iva ?? 0}%)${oferta.tipo === "obra" ? " sobre la Utilidad" : ""}`, formatoMoneda.format(t.ivaValor));
  y += 2;
  filaTotal("Total oferta", formatoMoneda.format(t.total), true);

  // ---- portada ----
  const colorTitulo = portadaClara ? NAVY : [255, 255, 255];
  const colorTipo = portadaClara ? AMBER_DARK : AMBER;
  const colorEtiqueta = portadaClara ? NAVY : [255, 255, 255];
  const colorValor = portadaClara ? TEXT_MUTED : [220, 224, 229];
  const colorRadicado = portadaClara ? NAVY : [255, 255, 255];
  const colorPie = portadaClara ? TEXT_MUTED : [199, 204, 211];

  for (let i = 0; i < 1; i++) doc.insertPage(1);
  doc.setPage(1);
  if (portadaClara) {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, anchoPagina, altoPagina, "F");
    doc.setFillColor(...NAVY);
    doc.rect(0, 15, anchoPagina, 1.2, "F");
    doc.setFillColor(...AMBER);
    doc.rect(0, 16.2, anchoPagina, 1.2, "F");
    doc.setFillColor(...AMBER);
    doc.rect(0, altoPagina - 40, anchoPagina, 1.2, "F");
    doc.setFillColor(...NAVY);
    doc.rect(0, altoPagina - 38.8, anchoPagina, 1.2, "F");
  } else {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, anchoPagina, altoPagina, "F");
  }
  if (logo) {
    const altoLogo = 32;
    const anchoLogo = altoLogo * (logo.ancho / logo.alto);
    doc.addImage(logo.dataUrl, "PNG", (anchoPagina - anchoLogo) / 2, 55, anchoLogo, altoLogo);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...colorTitulo);
  const tituloPortadaLineas = doc.splitTextToSize(oferta.titulo || "", anchoUtil);
  doc.text(tituloPortadaLineas, anchoPagina / 2, 115, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...colorTipo);
  doc.text("Oferta Comercial", anchoPagina / 2, 115 + tituloPortadaLineas.length * 8 + 4, { align: "center" });

  let yPortada = 165;
  doc.setFontSize(10.5);
  doc.setTextColor(...colorValor);
  const xValor = anchoPagina / 2 - 10;
  const anchoValor = anchoPagina - margenX - xValor;
  const filaPortada = (etiqueta, valor) => {
    if (!valor) return;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colorEtiqueta);
    doc.text(etiqueta, anchoPagina / 2 - 45, yPortada);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colorValor);
    const lineas = doc.splitTextToSize(String(valor), anchoValor);
    doc.text(lineas, xValor, yPortada);
    yPortada += lineas.length * 5.2 + 2;
  };
  filaPortada("Cliente:", oferta.cliente);
  filaPortada("Línea de servicio:", nombreLinea(oferta.lineaServicio));
  filaPortada("Tipo:", oferta.tipo === "obra" ? "Obra" : "Servicio");
  filaPortada("Contrato:", oferta.contratoCodigo ? `${oferta.contratoCodigo}${oferta.contratoNumero ? " · N.º " + oferta.contratoNumero : ""}` : null);
  filaPortada("Elaborado por:", oferta.firmaNombre ? `${oferta.firmaNombre}${oferta.firmaCargo ? " — " + oferta.firmaCargo : ""}` : null);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...colorRadicado);
  doc.text(`Radicado: ${oferta.radicado || ""}`, anchoPagina / 2, altoPagina - 30, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colorPie);
  doc.text(`Cinco S.A.S. · ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`, anchoPagina / 2, altoPagina - 24, { align: "center" });

  // ---- encabezado + pie de página en todas las páginas de contenido
  // (no en la portada) ----
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 2; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...AMBER);
    doc.setLineWidth(0.6);
    doc.line(margenX, 16, anchoPagina - margenX, 16);
    if (logo) {
      const altoLogo = 8;
      const anchoLogo = altoLogo * (logo.ancho / logo.alto);
      doc.addImage(logo.dataUrl, "PNG", margenX, 6, anchoLogo, altoLogo);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(oferta.titulo || "", anchoPagina - margenX, 11, { align: "right" });

    doc.setFillColor(...GRIS_CLARO);
    doc.rect(0, altoPagina - 14, anchoPagina, 14, "F");
    doc.setFontSize(7.5);
    doc.text(`Código: ${CODIGO_FORMATO} · Versión: ${VERSION_FORMATO}`, margenX, altoPagina - 6);
    doc.text(`Radicado ${oferta.radicado || ""} · Página ${p} de ${totalPaginas}`, anchoPagina - margenX, altoPagina - 6, { align: "right" });
  }

  return doc;
}
