// Genera el PDF de un Informe (diseño propio de Cinco S.A.S.): portada,
// índice y listas de gráficos/tablas con número de página real, cuerpo por
// bloques (títulos/párrafos/tablas/imágenes) y encabezado/pie de página
// con el código de calidad y el radicado.
//
// Depende de jsPDF autoalojado en web/js/vendor/jspdf.umd.min.js (igual
// que correspondencia-pdf.js).
//
// Truco para el índice con páginas reales sin tener que "simular" el
// cuerpo dos veces: se dibuja el cuerpo primero (empieza en la página 1),
// anotando en qué página cae cada título/tabla/imagen. Ya con el cuerpo
// dibujado se sabe cuántas páginas necesita la portada+índice+listas, así
// que se insertan esas páginas en blanco AL PRINCIPIO con doc.insertPage(1)
// (jsPDF corre el resto del documento hacia adelante solo) y se dibujan
// ahí, ya con el número de página real (anotado + el corrimiento).

import { parsearHtmlARuns } from "./texto-rico.js";

const NAVY = [31, 39, 50];
const NAVY_HEX = "#1f2732";
const AMBER = [254, 178, 9];
const AMBER_DARK = [217, 148, 0];
const TEXT_MUTED = [92, 101, 112];
const GRIS_CLARO = [245, 246, 248];
const LOGO_URL = "../assets/img/logo.png";
// El logo.png normal trae el texto "CINCO S.A.S." y el círculo en BLANCO
// (pensado para fondo navy) — sobre la portada clara quedaría invisible,
// así que ahí se usa esta variante con el texto en negro.
const LOGO_URL_TEXTO_OSCURO = "../assets/img/logo-texto-oscuro.png";

// Código y versión de ESTE diseño de informe, tal como debería quedar
// registrado en el Listado Maestro de Documentos (documentos.html, área
// AC — Actividades, ver la nota en informes.js) — si el usuario todavía
// no lo ha dado de alta ahí, este código queda "suelto" hasta que lo
// registre. AC-FOR-002 porque el formato de Correspondencia (también
// recodificado a AC-FOR) se registra primero, como AC-FOR-001.
const CODIGO_FORMATO = "AC-FOR-002";
const VERSION_FORMATO = "1";

const TIPO_LABEL = {
  gestion: "Informe de gestión", mediciones: "Informe de mediciones",
  consultoria: "Informe de consultoría", interventoria: "Informe de interventoría",
  obra: "Informe de obra", capacitacion: "Informe de capacitación", otro: "Informe"
};

// formato "PNG" (por defecto, para el logo — necesita transparencia) o
// "JPEG" (para las fotos/gráficos que sube el usuario en el cuerpo del
// informe): re-exportar como PNG sin pérdida infla muchísimo capturas de
// pantalla o fotos, aunque ya se hayan comprimido a JPEG al subirlas — el
// informe pasaba de unos pocos KB por imagen a varios MB por este motivo.
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

function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";
  return new Date(fechaISO + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

// Anchos de columna proporcionales al contenido real (encabezado + celdas),
// no partes iguales — respetando un mínimo y un máximo por columna, mismo
// criterio que el resto de la suite (ver calcularAnchosColumna en pdf.js
// de LBDC Neiva).
function calcularAnchosColumna(doc, filas, anchoUtil) {
  // No todas las filas tienen necesariamente el mismo número de celdas
  // (ej. tablas importadas de Word con celdas combinadas) — se usa el
  // máximo, no solo filas[0].length, para no perder columnas.
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

export async function generarInformePDF(informe) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margenX = 20;
  const margenSuperior = 26;
  const margenInferior = altoPagina - 22;
  const anchoUtil = anchoPagina - margenX * 2;
  const lineHeight = 5.2;

  const portadaClara = informe.portada === "clara";

  let logo = null;
  try {
    logo = await cargarImagenComoDataURL(portadaClara ? LOGO_URL_TEXTO_OSCURO : LOGO_URL, portadaClara ? "#ffffff" : NAVY_HEX);
  } catch (e) { /* se genera igual sin logo */ }

  // ---- cuerpo: se dibuja primero, arrancando "en blanco" en la página 1
  // (luego se le insertan portada+índice+listas adelante) ----
  let y = margenSuperior;
  const indiceEntradas = [];
  const graficosEntradas = [];
  const tablasEntradas = [];

  function saltoSiNoCabe(alturaNecesaria) {
    if (y + alturaNecesaria > margenInferior) {
      doc.addPage();
      y = margenSuperior;
    }
  }

  // Dibuja un párrafo con negrilla/cursiva/color por tramo, tal como se
  // escribió en el campo de texto rico (ver web/js/control/texto-rico.js)
  // — jsPDF no entiende HTML, así que se hace ajuste de línea a mano:
  // cada palabra se mide con su propio estilo antes de colocarla, y se
  // salta de línea cuando ya no cabe en el ancho útil de la página.
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
      if (esEspacio && !linea.length && !lineaNueva) return; // no arrancar una línea de ajuste con espacio
      if (!esEspacio && anchoLinea + ancho > anchoUtil && linea.length) trazarLinea();
      linea.push(token);
      anchoLinea += ancho;
      lineaNueva = false;
    });
    trazarLinea();
    y += lineHeight * 0.5;
  }

  // Numeración automática 1 / 1.1 / 1.1.1 / 1.1.1.1 para Título 1..4 —
  // mismo criterio que el Word (informes-docx.js): cada nivel arranca en 1
  // y se reinicia solo cuando aparece un título de nivel superior. jsPDF no
  // tiene listas multinivel nativas (a diferencia de Word), así que se
  // lleva el contador a mano.
  const contadoresTitulo = [0, 0, 0, 0];
  function numeroTitulo(nivel) {
    contadoresTitulo[nivel - 1] += 1;
    for (let i = nivel; i < contadoresTitulo.length; i++) contadoresTitulo[i] = 0;
    return contadoresTitulo.slice(0, nivel).join(".") + ".";
  }

  function dibujarTitulo(nivel, textoOriginal) {
    const texto = `${numeroTitulo(nivel)} ${textoOriginal || ""}`.trim();
    if (nivel === 1) {
      // Título 1 siempre arranca página nueva — pero si ya estamos al
      // principio de una página en blanco no hace falta desperdiciar una.
      if (y > margenSuperior + 0.5) { doc.addPage(); y = margenSuperior; }
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
    indiceEntradas.push({ texto: texto || "", nivel, pagina: doc.internal.getNumberOfPages() });
    const lineas = doc.splitTextToSize(texto || "", anchoUtil);
    doc.text(lineas, margenX, y);
    y += lineas.length * (lineHeight + (nivel === 1 ? 1.5 : 0.5)) + 3;
  }

  async function dibujarImagen(bloque) {
    try {
      const img = await cargarImagenComoDataURL(bloque.url, "#ffffff", "JPEG");

      // Nombre arriba, centrado (mismo criterio que el título de una
      // tabla) — la Lista de gráficos del índice usa este mismo texto.
      const numero = graficosEntradas.length + 1;
      const nombre = `Figura ${numero}. ${bloque.nombre || ""}`.trim();
      saltoSiNoCabe(lineHeight * 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...NAVY);
      const lineasNombre = doc.splitTextToSize(nombre, anchoUtil);
      doc.text(lineasNombre, anchoPagina / 2, y, { align: "center" });
      y += lineasNombre.length * lineHeight;
      graficosEntradas.push({ texto: bloque.nombre || `Figura ${numero}`, pagina: doc.internal.getNumberOfPages() });

      let ancho = anchoUtil * 0.85;
      let alto = ancho * (img.alto / img.ancho);
      const altoMaximo = 100;
      if (alto > altoMaximo) { alto = altoMaximo; ancho = alto * (img.ancho / img.alto); }
      saltoSiNoCabe(alto + 10);
      const x = margenX + (anchoUtil - ancho) / 2;
      doc.addImage(img.dataUrl, "JPEG", x, y, ancho, alto);
      y += alto + 3;

      // Pie de página de la gráfica, abajo a la derecha.
      if (bloque.pieDeFoto) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_MUTED);
        const lineasPie = doc.splitTextToSize(bloque.pieDeFoto, anchoUtil);
        doc.text(lineasPie, anchoPagina - margenX, y, { align: "right" });
        y += lineasPie.length * 4.5;
      }
      y += 6;
    } catch (e) {
      saltoSiNoCabe(14);
      doc.setDrawColor(214, 69, 69);
      doc.rect(margenX, y, anchoUtil, 14);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(178, 52, 52);
      doc.text("Aviso: no se pudo cargar esta imagen al generar el documento.", margenX + 4, y + 8);
      y += 20;
    }
  }

  function dibujarTabla(bloque) {
    // Guardado en Firestore, cada fila es {celdas:[...]} (Firestore no
    // admite arrays anidados) — pero por si acaso llega ya como array
    // plano (ej. una vista previa antes de guardar), se acepta cualquiera
    // de las dos formas.
    const filasCrudas = bloque.filas && bloque.filas.length ? bloque.filas : [[""]];
    const filas = filasCrudas.map((f) => (Array.isArray(f) ? f : f.celdas || []));
    const numero = tablasEntradas.length + 1;
    const tituloTexto = `Tabla ${numero}. ${bloque.titulo || ""}`.trim();

    saltoSiNoCabe(lineHeight * 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    const lineasTitulo = doc.splitTextToSize(tituloTexto, anchoUtil);
    doc.text(lineasTitulo, anchoPagina / 2, y, { align: "center" });
    y += lineasTitulo.length * lineHeight;
    tablasEntradas.push({ texto: bloque.titulo || `Tabla ${numero}`, pagina: doc.internal.getNumberOfPages() });

    const padding = 2.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const anchos = calcularAnchosColumna(doc, filas, anchoUtil);

    filas.forEach((fila, fi) => {
      doc.setFont("helvetica", fi === 0 ? "bold" : "normal");
      // Siempre se recorre anchos.length (no fila.length): una fila con
      // menos celdas que el máximo de la tabla (celdas combinadas en el
      // Word de origen) rellena con vacío en vez de desalinear columnas.
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

    // Nota/pie de la tabla, abajo a la derecha.
    if (bloque.nota) {
      y += 2;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_MUTED);
      const lineasNota = doc.splitTextToSize(bloque.nota, anchoUtil);
      saltoSiNoCabe(lineasNota.length * 4.5);
      doc.text(lineasNota, anchoPagina - margenX, y, { align: "right" });
      y += lineasNota.length * 4.5;
    }
    y += 6;
  }

  for (const bloque of informe.bloques || []) {
    if (bloque.tipo === "titulo1") dibujarTitulo(1, bloque.texto);
    else if (bloque.tipo === "titulo2") dibujarTitulo(2, bloque.texto);
    else if (bloque.tipo === "titulo3") dibujarTitulo(3, bloque.texto);
    else if (bloque.tipo === "titulo4") dibujarTitulo(4, bloque.texto);
    else if (bloque.tipo === "tabla") dibujarTabla(bloque);
    else if (bloque.tipo === "imagen") await dibujarImagen(bloque);
    else dibujarParrafo(bloque.texto);
  }

  // ---- calcular cuántas páginas necesitan portada + índice + listas ----
  const ENTRADAS_POR_PAGINA = 34;
  function paginasPara(cantidad) {
    return cantidad === 0 ? 0 : Math.ceil(cantidad / ENTRADAS_POR_PAGINA);
  }
  const paginasIndice = Math.max(1, paginasPara(indiceEntradas.length));
  const paginasGraficos = paginasPara(graficosEntradas.length);
  const paginasTablas = paginasPara(tablasEntradas.length);
  const offset = 1 + paginasIndice + paginasGraficos + paginasTablas;

  for (let i = 0; i < offset; i++) doc.insertPage(1);

  // ---- portada ----
  // Dos variantes con el mismo layout: "oscura" (fondo navy a página
  // completa, pensada para verse en pantalla) y "clara" (fondo blanco,
  // solo dos filetes de acento arriba/abajo — pensada para imprimir sin
  // gastar tanta tinta). El logo ya se cargó compuesto sobre el fondo
  // correcto (portadaClara arriba, antes de dibujar el cuerpo).
  const colorTitulo = portadaClara ? NAVY : [255, 255, 255];
  const colorTipo = portadaClara ? AMBER_DARK : AMBER;
  const colorEtiqueta = portadaClara ? NAVY : [255, 255, 255];
  const colorValor = portadaClara ? TEXT_MUTED : [220, 224, 229];
  const colorRadicado = portadaClara ? NAVY : [255, 255, 255];
  const colorPie = portadaClara ? TEXT_MUTED : [199, 204, 211];

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
  const tituloLineas = doc.splitTextToSize(informe.titulo || "", anchoUtil);
  doc.text(tituloLineas, anchoPagina / 2, 115, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...colorTipo);
  doc.text(TIPO_LABEL[informe.tipoInforme] || "Informe", anchoPagina / 2, 115 + tituloLineas.length * 8 + 4, { align: "center" });

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
  filaPortada("Contrato:", informe.contratoCodigo ? `${informe.contratoCodigo}${informe.contratoNumero ? " · N.º " + informe.contratoNumero : ""}` : null);
  filaPortada("Objeto:", informe.contratoNombre);
  filaPortada("Cliente:", informe.contratoCliente);
  filaPortada("Supervisor:", informe.contratoSupervisor);
  if (informe.contratoFechaInicio) filaPortada("Vigencia:", `${formatearFecha(informe.contratoFechaInicio)} — ${informe.contratoFechaFin ? formatearFecha(informe.contratoFechaFin) : "en curso"}`);
  filaPortada("Elaborado por:", informe.firmaNombre ? `${informe.firmaNombre}${informe.firmaCargo ? " — " + informe.firmaCargo : ""}` : null);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...colorRadicado);
  doc.text(`Radicado: ${informe.radicado || ""}`, anchoPagina / 2, altoPagina - 30, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colorPie);
  doc.text(`Cinco S.A.S. · ${formatearFecha(informe.mes ? informe.mes + "-01" : null) !== "—" ? formatearFecha(informe.mes + "-01") : new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`, anchoPagina / 2, altoPagina - 24, { align: "center" });

  // ---- índice y listas: helper compartido para dibujar una lista de
  // entradas con líder de puntos hasta el número de página ----
  let paginaActual = 2;
  function dibujarListaEnPaginas(tituloSeccion, entradas, { indentarPorNivel = false } = {}) {
    if (!entradas.length) return;
    doc.setPage(paginaActual);
    let yy = margenSuperior;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    doc.text(tituloSeccion, margenX, yy);
    yy += 11;

    entradas.forEach((entrada) => {
      if (yy > margenInferior) {
        paginaActual += 1;
        doc.setPage(paginaActual);
        yy = margenSuperior;
      }
      const indent = indentarPorNivel ? (entrada.nivel - 1) * 6 : 0;
      doc.setFont("helvetica", entrada.nivel === 1 || !indentarPorNivel ? "bold" : "normal");
      doc.setFontSize(entrada.nivel === 1 || !indentarPorNivel ? 10.5 : 9.5);
      doc.setTextColor(20, 22, 26);
      const paginaFinal = entrada.pagina + offset;
      const textoPagina = String(paginaFinal);
      const anchoPagina2 = doc.getTextWidth(textoPagina);
      const anchoTexto = anchoUtil - indent - anchoPagina2 - 4;
      const lineasTexto = doc.splitTextToSize(entrada.texto, anchoTexto);
      doc.text(lineasTexto[0] + (lineasTexto.length > 1 ? "…" : ""), margenX + indent, yy);
      doc.text(textoPagina, anchoPagina - margenX, yy, { align: "right" });
      yy += 6.4;
    });
    paginaActual += 1;
  }

  dibujarListaEnPaginas("Contenido", indiceEntradas, { indentarPorNivel: true });
  dibujarListaEnPaginas("Lista de gráficos", graficosEntradas.map((e, i) => ({ ...e, texto: `Figura ${i + 1}. ${e.texto}` })));
  dibujarListaEnPaginas("Lista de tablas", tablasEntradas.map((e, i) => ({ ...e, texto: `Tabla ${i + 1}. ${e.texto}` })));

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
    doc.text(informe.titulo || "", anchoPagina - margenX, 11, { align: "right" });

    doc.setFillColor(...GRIS_CLARO);
    doc.rect(0, altoPagina - 14, anchoPagina, 14, "F");
    doc.setFontSize(7.5);
    doc.text(`Código: ${CODIGO_FORMATO} · Versión: ${VERSION_FORMATO}`, margenX, altoPagina - 6);
    doc.text(`Radicado ${informe.radicado || ""} · Página ${p} de ${totalPaginas}`, anchoPagina - margenX, altoPagina - 6, { align: "right" });
  }

  return doc;
}
