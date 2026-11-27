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
import { firmaGuardada, ajustesFirma, FIRMA_SOLAPE } from "./firma-local.js";
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
      if (colorFondo) { // sin color de fondo (la firma) se conserva la transparencia
        ctx.fillStyle = colorFondo;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
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

// Reparto del ancho entre las columnas de una tabla: cada una recibe lo que necesita su contenido (sin partir las
// palabras más largas) y el sobrante se reparte en proporción a lo que cada una pide — así una columna corta («No.»,
// «A») no queda con un hueco enorme y una larga («Acometida») no queda apretada.
function anchosColumnasTabla(doc, filas, anchoUtil, tam) {
  const n = Math.max(...filas.map((f) => f.length));
  const pad = 2;
  const min = Array(n).fill(0), des = Array(n).fill(0);
  filas.forEach((fila, r) => {
    for (let c = 0; c < n; c++) {
      doc.setFont("helvetica", r === 0 ? "bold" : "normal");
      doc.setFontSize(tam);
      const texto = String(fila[c] ?? "");
      for (const linea of texto.split("\n")) {
        const wl = doc.getTextWidth(linea) * 1.08 + pad * 2 + 0.6;
        des[c] = Math.max(des[c], wl);
        // Una celda corta («1 × No. 8», «THHN/THWN-2») no debe partirse: su mínimo es la línea completa.
        if (linea.length <= 14) min[c] = Math.max(min[c], wl);
        for (const palabra of linea.split(/\s+/)) min[c] = Math.max(min[c], doc.getTextWidth(palabra) * 1.08 + pad * 2 + 0.6);
      }
    }
  });
  const sumaDes = des.reduce((a, b) => a + b, 0);
  if (sumaDes <= anchoUtil) return des.map((d) => d + (anchoUtil - sumaDes) * (d / sumaDes));
  const sumaMin = min.reduce((a, b) => a + b, 0);
  const extra = Math.max(0, anchoUtil - sumaMin), pide = des.map((d, c) => Math.max(0, d - min[c])), sumaPide = pide.reduce((a, b) => a + b, 0) || 1;
  const w = min.map((m, c) => m + extra * (pide[c] / sumaPide));
  const esc = anchoUtil / w.reduce((a, b) => a + b, 0);
  return w.map((x) => x * esc);
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

  // Documento propio (Word subido tal cual): sin «Señores»/asunto/cierre — el documento ya trae su propio
  // encabezado y su línea de firma; la carta solo le pone el membrete, el radicado y el pie de Cinco.
  const esDocumento = datos.modo === "documento";
  if (esDocumento) y += 12;
  // Hasta dónde se escribe en cada página (cartas y documentos): hasta 8 mm por encima del pie (que mide 16 mm). Antes eran 28 mm en
  // documentos y 45 mm en cartas: quedaba una franja en blanco de 12–29 mm
  // en cada hoja y los cuadros saltaban a la hoja siguiente sin necesidad.
  const limiteInferior = altoPagina - 24;
  // ---- destinatario ----
  if (!esDocumento) {
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
  }

  // ---- cuerpo: lista de bloques (texto/imagen) en el orden elegido en el
  // editor. Cartas creadas antes de esto no tienen "bloques" — se arma uno
  // solo de texto a partir del "cuerpo" plano que sí tenían.
  const bloques = datos.bloques && datos.bloques.length
    ? datos.bloques
    : [{ tipo: "texto", texto: datos.cuerpo || "" }];

  // Medidas de una tabla (letra, anchos, alto de cada fila): las usa el
  // dibujo de la tabla y el párrafo que la antecede, para no dejar su título
  // ni su encabezado solos al final de la hoja.
  // Formato (2026-11-25, mismo editor que Informes): celdas combinadas
  // (merges), centrado horizontal (centrados) y vertical (centradosVertical),
  // negrilla (negritas), color de letra (coloresCelda), ancho fijado
  // (anchosColumna) y filas de encabezado (filasEncabezado, se repiten en
  // cada hoja). Las tablas de antes, sin "centrados", centran solas las
  // columnas de texto corto, como siempre.
  const medidasTabla = (bloque) => {
    const filasT = (bloque.filas || []).map((f) => (Array.isArray(f) ? f : (f && f.celdas) || [])).filter((f) => f.length).map((f) => f.map((v) => String(v ?? "")));
    if (!filasT.length) return null;
    const nCols = Math.max(...filasT.map((f) => f.length));
    filasT.forEach((f) => { while (f.length < nCols) f.push(""); });
    const nFilas = filasT.length;
    const merges = (bloque.merges || []).filter((m) => m && m.fila < nFilas && m.col < nCols).map((m) => ({ ...m, filas: Math.min(m.filas, nFilas - m.fila), cols: Math.min(m.cols, nCols - m.col) }));
    const mergeEn = (r, c) => merges.find((m) => r >= m.fila && r < m.fila + m.filas && c >= m.col && c < m.col + m.cols) || null;
    const enLista = (lista, r, c) => (lista || []).some((x) => x.fila === r && x.col === c);
    const nEnc = nFilas > 1 ? Math.max(1, Math.min(Number(bloque.filasEncabezado) || 1, nFilas - 1)) : 1;
    const esEnc = (r) => r < nEnc;
    const negrita = (r, c) => esEnc(r) || enLista(bloque.negritas, r, c);
    const colorDe = (r, c) => {
      const x = (bloque.coloresCelda || []).find((k) => k.fila === r && k.col === c);
      const m = x && /^#?([0-9a-f]{6})$/i.exec(x.color || "");
      return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
    };
    // Para repartir anchos: las celdas combinadas a lo ancho no cuentan (su texto ocupa varias columnas).
    const paraAncho = filasT.map((f, r) => f.map((v, c) => { const m = mergeEn(r, c); return m && (m.cols > 1 || m.fila !== r || m.col !== c) ? "" : v; }));
    const manuales = Array.isArray(bloque.anchosColumna) && bloque.anchosColumna.length >= nCols ? bloque.anchosColumna.slice(0, nCols).map(Number) : null;
    const anchosDe = (t) => {
      if (manuales && manuales.every((x) => x > 0)) { const s = manuales.reduce((a, b) => a + b, 0); return manuales.map((x) => (x / s) * anchoUtil); }
      return anchosColumnasTabla(doc, paraAncho, anchoUtil, t);
    };
    // Se reduce la letra (hasta 6,5 pt) si ni así caben sin partir las palabras más largas en el ancho útil.
    let tam = 8.5;
    let anchos = anchosDe(tam);
    const anchoCelda = (a, r, c) => { const m = mergeEn(r, c); return m ? a.slice(m.col, m.col + m.cols).reduce((s, x) => s + x, 0) : a[c]; };
    const sinPartir = (a, t) => filasT.every((f, r) => f.every((txt, c) => {
      const m = mergeEn(r, c);
      if (m && (m.fila !== r || m.col !== c)) return true;
      return txt.split(/\s+/).every((p) => { doc.setFont("helvetica", negrita(r, c) ? "bold" : "normal"); doc.setFontSize(t); return doc.getTextWidth(p) * 1.08 + 4.6 <= anchoCelda(a, r, c) + 0.01; });
    }));
    while (!sinPartir(anchos, tam) && tam > 6.5) { tam -= 0.5; anchos = anchosDe(tam); }
    const pad = 2.2, interlinea = tam * 0.3528 * 1.18;
    // Tablas de antes (sin "centrados"): las columnas de texto corto se centran solas.
    const conCentrados = Array.isArray(bloque.centrados);
    const columnaCorta = anchos.map((_, c) => filasT.slice(nEnc).every((f) => f[c].length <= 18));
    const centrada = (r, c) => esEnc(r) || (conCentrados ? enLista(bloque.centrados, r, c) : columnaCorta[c]);
    const medioV = (r, c) => esEnc(r) || enLista(bloque.centradosVertical, r, c);
    // Líneas de texto de cada celda que se dibuja (las cubiertas por una combinada, null).
    const lineas = filasT.map((f, r) => f.map((txt, c) => {
      const m = mergeEn(r, c);
      if (m && (m.fila !== r || m.col !== c)) return null;
      doc.setFont("helvetica", negrita(r, c) ? "bold" : "normal");
      doc.setFontSize(tam);
      return doc.splitTextToSize(txt, anchoCelda(anchos, r, c) - 2 * 2);
    }));
    const altoLineas = (n) => Math.max(1, n) * interlinea + pad * 2;
    // Alto de cada fila: el de su celda más alta (sin las combinadas hacia
    // abajo); si una combinada hacia abajo necesita más, se le suma a su última fila.
    const altos = filasT.map((f, r) => Math.max(altoLineas(1), ...f.map((_, c) => {
      const m = mergeEn(r, c);
      if (!lineas[r][c] || (m && m.filas > 1)) return 0;
      return altoLineas(lineas[r][c].length);
    })));
    merges.filter((m) => m.filas > 1).forEach((m) => {
      const falta = altoLineas(lineas[m.fila][m.col].length) - altos.slice(m.fila, m.fila + m.filas).reduce((s, x) => s + x, 0);
      if (falta > 0) altos[m.fila + m.filas - 1] += falta;
    });
    // Grupos de filas que no se separan entre hojas (las unidas por una
    // combinada hacia abajo); el encabezado es el primer grupo.
    const grupos = [];
    let r0 = nEnc;
    while (r0 < nFilas) {
      let fin = r0;
      for (let k = r0; k <= fin; k++) merges.forEach((m) => { if (m.filas > 1 && k >= m.fila && k < m.fila + m.filas) fin = Math.max(fin, m.fila + m.filas - 1); });
      grupos.push([r0, fin]);
      r0 = fin + 1;
    }
    const altoRango = (a, b) => altos.slice(a, b + 1).reduce((s, x) => s + x, 0);
    const altoEncabezado = altoRango(0, nEnc - 1);
    // Lo mínimo que debe acompañar al encabezado: el primer grupo entero o,
    // si es una sola fila alta (que se puede partir), 2 de sus líneas.
    const primero = grupos[0];
    const partible = (g) => g[0] === g[1] && !merges.some((m) => m.filas > 1 && g[0] >= m.fila && g[0] < m.fila + m.filas);
    const lineasFila = (r) => Math.max(1, ...lineas[r].filter(Boolean).map((l) => l.length));
    const minimoPrimero = !primero ? 0 : partible(primero) && lineasFila(primero[0]) >= 4 ? altoLineas(2) : altoRango(primero[0], primero[1]);
    return { filasT, nFilas, nCols, nEnc, tam, anchos, pad, interlinea, merges, mergeEn, lineas, altos, grupos, altoRango, altoEncabezado, minimoPrimero, partible, lineasFila, negrita, colorDe, centrada, medioV, anchoCelda };
  };

  for (const bloque of bloques) {
    if (bloque.tipo === "firma") {
      // Firma digital (si quien genera la carta cargó la suya en este navegador) sobre la línea de firma.
      const { alto: altoF, sobreLinea } = ajustesFirma();
      // Montada sobre la línea: la línea «____» que sigue se escribe encima de la parte baja de la firma.
      const avance = sobreLinea ? altoF * (1 - FIRMA_SOLAPE) : altoF + 1;
      // La firma no se separa de su línea «____» ni del nombre que siguen: si no caben juntos, pasan juntos.
      const siguiente = bloques[bloques.indexOf(bloque) + 1];
      const lineasSiguiente = siguiente?.tipo === "texto" ? Math.min(4, parsearHtmlARuns(siguiente.texto).filter((r) => r.salto).length || 1) : 0;
      if (y + avance + lineasSiguiente * 7.2 > limiteInferior) { doc.addPage(); y = 20; }
      // Firma tomada de un Word editado (bloque.url): se usa esa misma imagen; si no, la guardada en este navegador.
      const urlFirmaBloque = bloque.url || firmaGuardada();
      if (urlFirmaBloque) {
        try {
          const f = await cargarImagenComoDataURL(urlFirmaBloque, null, "PNG");
          const anchoF = Math.min(anchoUtil, altoF * (f.ancho / f.alto));
          // Centrada si el documento centra la línea de firma que sigue; si no, al margen izquierdo.
          const centrada = siguiente?.tipo === "texto" && /rt-al-center|text-align:\s*center/.test(siguiente.texto || "");
          doc.addImage(f.dataUrl, "PNG", centrada ? (anchoPagina - anchoF) / 2 : margenX, y, anchoF, altoF);
        } catch (e) { /* sin imagen: queda el espacio para firmar a mano */ }
      }
      y += avance;
      continue;
    }
    if (bloque.tipo === "imagen") {
      try {
        const img = await cargarImagenComoDataURL(bloque.url, "#ffffff", "JPEG");
        let anchoImg = anchoUtil;
        let altoImg = anchoImg * (img.alto / img.ancho);
        const altoMaximo = 90;
        if (altoImg > altoMaximo) { altoImg = altoMaximo; anchoImg = altoImg * (img.ancho / img.alto); }
        if (y + altoImg > limiteInferior) { doc.addPage(); y = 20; }
        doc.addImage(img.dataUrl, "JPEG", margenX, y, anchoImg, altoImg);
        y += altoImg + 6;
      } catch (e) {
        // Antes esto fallaba en silencio y la carta se veía "completa"
        // aunque faltara una foto — ahora se deja visible que algo no
        // cargó, en vez de desaparecer sin aviso.
        const altoAviso = 14;
        if (y + altoAviso > limiteInferior) { doc.addPage(); y = 20; }
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

    if (bloque.tipo === "tabla") {
      const M = medidasTabla(bloque);
      if (!M) continue;
      const { nCols, nEnc, tam, anchos, pad, interlinea, mergeEn, lineas, altos, grupos, altoRango, altoEncabezado, minimoPrimero, partible, lineasFila } = M;
      // Dibuja la fila r en yFila. desde/hasta: tramo de líneas (para partir
      // una fila alta entre dos hojas, como hace Word); sin ellos, completa.
      // Una celda combinada hacia abajo se dibuja desde su fila con el alto
      // de todas las que abarca (esas filas nunca se separan entre hojas).
      const pintarFila = (r, yFila, desde = 0, hasta = Infinity) => {
        const parcial = desde !== 0 || hasta !== Infinity;
        const tramo = (l) => (parcial ? l.slice(desde, hasta) : l);
        const alto = parcial ? Math.max(1, ...lineas[r].filter(Boolean).map((l) => tramo(l).length)) * interlinea + pad * 2 : altos[r];
        for (let c = 0; c < nCols; c++) {
          const m = mergeEn(r, c);
          const ancla = lineas[r][c];
          if (!ancla) continue; // cubierta por una combinada
          const x = margenX + anchos.slice(0, c).reduce((s2, w) => s2 + w, 0);
          const ancho = M.anchoCelda(anchos, r, c);
          const altoCelda = m && m.filas > 1 ? altoRango(r, r + m.filas - 1) : alto;
          if (r < nEnc) doc.setFillColor(...NAVY); else if (r % 2 === 0) doc.setFillColor(...GRIS_CLARO); else doc.setFillColor(255, 255, 255);
          doc.setDrawColor(185, 191, 201);
          doc.setLineWidth(0.2);
          doc.rect(x, yFila, ancho, altoCelda, "FD");
          doc.setFont("helvetica", M.negrita(r, c) ? "bold" : "normal");
          doc.setFontSize(tam);
          const color = M.colorDe(r, c);
          if (r < nEnc) doc.setTextColor(255, 255, 255); else if (color) doc.setTextColor(...color); else doc.setTextColor(20, 22, 26);
          const texto = tramo(ancla);
          const alinear = M.centrada(r, c) ? "center" : "left";
          const xt = alinear === "center" ? x + ancho / 2 : x + 2;
          const altoTexto = Math.max(1, texto.length) * interlinea;
          const yt = M.medioV(r, c) ? yFila + (altoCelda - altoTexto) / 2 + 2.9 : yFila + pad + 2.9;
          if (texto.length) doc.text(texto, xt, yt, { align: alinear, baseline: "alphabetic", lineHeightFactor: interlinea / (tam * 0.3528) });
        }
        return alto;
      };
      const pintarEncabezado = () => { for (let r = 0; r < nEnc; r++) y += pintarFila(r, y); };
      const lineasQueCaben = (desdeY) => Math.floor((limiteInferior - desdeY - pad * 2) / interlinea + 1e-6);
      const MIN_LINEAS = 2; // de una fila partida, al menos 2 líneas a cada lado
      const nuevaHojaConEncabezado = () => { doc.addPage(); y = 20; pintarEncabezado(); };
      // El encabezado nunca queda solo al final de la hoja: debe caber con el
      // primer grupo de filas o, si es una fila alta, con 2 de sus líneas.
      if (y > 20 && y + altoEncabezado + minimoPrimero > limiteInferior) { doc.addPage(); y = 20; }
      pintarEncabezado();
      for (const [a, b] of grupos) {
        const altoG = altoRango(a, b);
        if (y + altoG <= limiteInferior) { for (let r = a; r <= b; r++) y += pintarFila(r, y); continue; }
        if (partible([a, b])) {
          // No cabe entera: se parte si quedan al menos 2 líneas en esta hoja y
          // 2 en la siguiente (si en la siguiente quedaría 1 sola, se deja una menos aquí).
          const caben = Math.min(lineasQueCaben(y), lineasFila(a) - MIN_LINEAS);
          if (caben >= MIN_LINEAS) {
            y += pintarFila(a, y, 0, caben);
            nuevaHojaConEncabezado();
            y += pintarFila(a, y, caben);
            continue;
          }
        }
        nuevaHojaConEncabezado();
        for (let r = a; r <= b; r++) y += pintarFila(r, y);
      }
      y += 6;
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
      // El tamaño se fija en cada medición/dibujo: medir la tabla que sigue
      // (medidasTabla) cambia el tamaño de letra del documento.
      const medirToken = (token) => {
        doc.setFontSize(10.5);
        doc.setFont("helvetica", estiloFuente(token.negrita, token.cursiva));
        return doc.getTextWidth(token.texto);
      };
      const tokens = [];
      runsParrafo.forEach((run) => {
        if (run.salto) { tokens.push({ salto: true }); return; }
        run.texto.split(/(\s+)/).filter((p) => p !== "").forEach((palabra) => {
          tokens.push({ texto: palabra, negrita: run.negrita, cursiva: run.cursiva, color: run.color, alineacion: run.alineacion });
        });
      });

      // ---- Paso 1: partir el texto en líneas (sin dibujar) ----
      // lineaNueva: true justo tras un salto explícito (fin de línea/viñeta
      // en el HTML), no tras un salto de línea automático por ajuste de
      // ancho — así el espacio de sangría de una viñeta ("    o texto")
      // sobrevive, pero se sigue evitando arrancar una línea de ajuste con
      // un espacio suelto.
      // items: { linea: tokens, ancho, porAjuste } | { espacio: mm }
      // porAjuste: la línea se corta por ancho (no es la última del párrafo) — solo esas se justifican.
      const items = [];
      let linea = [];
      let anchoLinea = 0;
      const cerrarLinea = (porAjuste = false) => {
        while (linea.length > 1 && /^\s+$/.test(linea[linea.length - 1].texto)) anchoLinea -= medirToken(linea.pop());
        items.push(linea.length ? { linea, ancho: anchoLinea, porAjuste } : { vacia: true });
        linea = [];
        anchoLinea = 0;
      };
      let lineaNueva = true;
      tokens.forEach((token) => {
        if (token.salto) { cerrarLinea(); items.push({ espacio: 5.5 * 0.3 }); lineaNueva = true; return; }
        const ancho = medirToken(token);
        const esEspacio = /^\s+$/.test(token.texto);
        if (esEspacio && !linea.length && !lineaNueva) return;
        if (!esEspacio && anchoLinea + ancho > anchoUtil && linea.length) cerrarLinea(true);
        linea.push(token);
        anchoLinea += ancho;
        lineaNueva = false;
      });
      // En un documento propio el bloque ya terminó en su salto: sin esto quedaba una línea en blanco de más.
      if (!(esDocumento && !linea.length)) cerrarLinea();

      // Sin líneas en blanco ni espacios al final del bloque: el espacio entre
      // un bloque y el siguiente ya lo pone el "y += 5" de abajo (antes quedaba
      // una línea en blanco de más, y se veía mucho aire entre título y texto).
      while (items.length && !items[items.length - 1].linea) items.pop();

      // Párrafos: líneas seguidas unidas por ajuste de ancho (la última de
      // cada párrafo es la que no viene "porAjuste").
      const grupos = []; // { tipo: "parrafo", lineas: [...] } | item suelto (espacio / línea vacía)
      let actual = null;
      items.forEach((it) => {
        if (it.linea) {
          if (!actual) { actual = { tipo: "parrafo", lineas: [] }; grupos.push(actual); }
          actual.lineas.push(it);
          if (!it.porAjuste) actual = null;
        } else { actual = null; grupos.push(it); }
      });
      const textoDe = (g) => g.lineas.map((l) => l.linea.map((t) => t.texto).join("")).join(" ").trim();
      // Título: párrafo corto (1–2 líneas) todo en negrilla, o que arranca en
      // negrilla con numeración («1.», «2.3») y es breve.
      const esTitulo = (g) => {
        if (g.lineas.length > 2) return false;
        const palabras = g.lineas.flatMap((l) => l.linea).filter((t) => t.texto.trim());
        if (!palabras.length) return false;
        if (palabras.every((t) => t.negrita)) return true;
        return palabras[0].negrita && /^\d+(\.\d+)*\.?\s/.test(textoDe(g)) && textoDe(g).length <= 160;
      };

      // Alto mínimo que debe acompañar a un título al final de la hoja: las
      // 2 primeras líneas de lo que sigue (en este bloque o en el siguiente).
      const siguienteBloque = bloques[bloques.indexOf(bloque) + 1];
      const altoInicioSiguienteBloque = () => {
        if (!siguienteBloque) return 0;
        if (siguienteBloque.tipo === "tabla") {
          const m = medidasTabla(siguienteBloque);
          // Encabezado + la primera fila (o 2 de sus líneas, si es alta: la tabla puede partirla).
          return m ? 6 + m.altoEncabezado + m.minimoPrimero : 0;
        }
        if (siguienteBloque.tipo === "imagen") return 60;
        if (siguienteBloque.tipo === "texto") return 5 + 2 * 5.5;
        return 0;
      };
      const altoTrasGrupo = (gi) => {
        let alto = 0;
        for (let k = gi + 1; k < grupos.length; k++) {
          const g = grupos[k];
          if (g.tipo === "parrafo") return alto + Math.min(2, g.lineas.length) * 5.5;
          alto += g.espacio || (g.vacia ? 5.5 : 0);
        }
        return alto + 5 + altoInicioSiguienteBloque();
      };

      // ---- Paso 2: dibujar con reglas de paginación (como piden las normas
      // APA y cualquier procesador de texto): ningún título queda al final
      // de la hoja sin al menos dos líneas de lo que sigue; un párrafo no deja
      // una sola línea al pie de la hoja (huérfana) ni una sola línea al
      // comienzo de la siguiente (viuda); y la hoja nueva no arranca con
      // espacios ni líneas en blanco.
      const ALTO_LINEA = 5.5;
      const arriba = () => y <= 20.01;
      const nuevaHoja = () => { doc.addPage(); y = 20; };
      const caben = () => Math.floor((limiteInferior - y) / ALTO_LINEA + 1e-6);
      const dibujarLinea = (l) => {
        const alineacion = l.linea.find((tk) => tk.alineacion)?.alineacion || "";
        const espacios = l.linea.filter((tk) => /^\s+$/.test(tk.texto)).length;
        const sobra = Math.max(0, anchoUtil - l.ancho);
        let x = margenX;
        if (alineacion === "center") x += sobra / 2;
        else if (alineacion === "right") x += sobra;
        const extra = alineacion === "justify" && l.porAjuste && espacios ? sobra / espacios : 0;
        l.linea.forEach((token) => {
          doc.setFontSize(10.5);
          doc.setFont("helvetica", estiloFuente(token.negrita, token.cursiva));
          doc.setTextColor(...(token.color || COLOR_PARRAFO));
          doc.text(token.texto, x, y);
          x += medirToken(token) + (/^\s+$/.test(token.texto) ? extra : 0);
        });
        y += ALTO_LINEA;
      };
      grupos.forEach((g, gi) => {
        if (g.tipo !== "parrafo") {
          if (arriba()) return; // la hoja nueva no empieza con espacio en blanco
          y += g.espacio || ALTO_LINEA;
          return;
        }
        const n = g.lineas.length;
        const ultimoAntesDeTablaOImagen = gi === grupos.map((x) => x.tipo).lastIndexOf("parrafo") && ["tabla", "imagen"].includes(siguienteBloque?.tipo) && n <= 2;
        if (esTitulo(g) || ultimoAntesDeTablaOImagen) {
          // Título (o rótulo de la tabla/imagen que sigue): va con lo que sigue.
          if (!arriba() && y + n * ALTO_LINEA + altoTrasGrupo(gi) > limiteInferior) nuevaHoja();
          g.lineas.forEach((l) => { if (y + ALTO_LINEA > limiteInferior) nuevaHoja(); dibujarLinea(l); });
          return;
        }
        let i = 0;
        while (i < n) {
          const quedan = n - i;
          let aqui = caben();
          if (aqui >= quedan) { g.lineas.slice(i).forEach(dibujarLinea); break; }
          // Huérfana: no se empieza un párrafo con una sola línea al pie de la hoja.
          if (quedan >= 2 && aqui < 2 && !arriba()) { nuevaHoja(); continue; }
          // Viuda: no se deja una sola línea del párrafo al comienzo de la hoja siguiente.
          if (quedan - aqui === 1) { if (aqui >= 3) aqui -= 1; else if (!arriba()) { nuevaHoja(); continue; } }
          if (aqui <= 0) { nuevaHoja(); continue; }
          g.lineas.slice(i, i + aqui).forEach(dibujarLinea);
          i += aqui;
          nuevaHoja();
        }
      });
      y += 5;
    }
  }

  // ---- cierre y firma ---- (un documento propio ya trae la suya: ver el bloque "firma")
  if (!esDocumento) {
  y += 8;
  if (y > altoPagina - 55) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 22, 26);
  doc.text("Cordialmente,", margenX, y);
  const urlF = firmaGuardada();
  const { alto: altoFirma, sobreLinea } = ajustesFirma();
  if (urlF) {
    try {
      const f = await cargarImagenComoDataURL(urlF, null, "PNG");
      const ancho = Math.min(anchoUtil, altoFirma * (f.ancho / f.alto));
      doc.addImage(f.dataUrl, "PNG", margenX, y + 1.5, ancho, altoFirma);
    } catch (e) { /* sin imagen: queda el espacio para firmar a mano */ }
  }
  // Montada: el nombre se escribe sobre la parte baja de la firma, como al firmar encima del nombre.
  y += sobreLinea ? 1.5 + altoFirma * (1 - FIRMA_SOLAPE) + 3 : altoFirma + 3;
  // Firmantes adicionales (ej. el analista que elaboró el oficio): en columnas a la derecha de la firma
  // principal, a la misma altura del nombre, dejando arriba el espacio para firmar a mano.
  const extras = Array.isArray(datos.firmantesAdicionales) ? datos.firmantesAdicionales.filter((f) => f && f.nombre) : [];
  const anchoCol = anchoUtil / (extras.length + 1);
  const yNombre = y;
  const bloqueFirmante = (x, nombre, cargo) => {
    let yy = yNombre;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(doc.splitTextToSize(nombre || "", anchoCol - 4), x, yy);
    yy += 5 * doc.splitTextToSize(nombre || "", anchoCol - 4).length;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    if (cargo) {
      const lineas = extras.length ? doc.splitTextToSize(cargo, anchoCol - 4) : [cargo];
      doc.text(lineas, x, yy);
      yy += 5 * lineas.length;
    }
    doc.text("Cinco S.A.S.", x, yy);
    return yy;
  };
  let yFin = bloqueFirmante(margenX, datos.firmaNombre, datos.firmaCargo);
  extras.forEach((f, i) => {
    const x = margenX + anchoCol * (i + 1);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.line(x, yNombre - 4.5, x + Math.min(60, anchoCol - 8), yNombre - 4.5);
    yFin = Math.max(yFin, bloqueFirmante(x, f.nombre, f.cargo));
  });
  y = yFin;
  }

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
    doc.text("cincosas.com.co", anchoPagina - margenX, yPie + 6.5, { align: "right" });
    const piePagina2 = CODIGO_FORMATO
      ? `Formato ${CODIGO_FORMATO} · Versión ${VERSION_FORMATO} · Página ${p} de ${totalPaginas}`
      : `Página ${p} de ${totalPaginas}`;
    doc.text(piePagina2, anchoPagina - margenX, yPie + 11, { align: "right" });
  }

  return doc;
}
