// Genera el PDF de una Orden de Trabajo, con la misma información que traía
// el formato viejo en papel de la empresa pero con código nuevo propio del
// SGC de Cinco SAS control (CAL-FOR-001, no el del sistema de calidad
// anterior — ver CODIGO_FORMATO abajo) — igual criterio que
// correspondencia-pdf.js: se reconstruye cada vez a partir de lo guardado
// en Firestore, nunca se guarda el PDF en sí.
//
// A diferencia de informes-pdf.js (bloques de contenido libre que arma el
// usuario), esta plantilla es de estructura FIJA — siempre las mismas
// filas/columnas — así que los anchos se definen directamente como
// fracciones del ancho útil en vez de calcularse del contenido.
//
// Pedido explícito del usuario: debe caber en UNA sola página tamaño
// carta. Por eso todo acá es más compacto que informes-pdf.js/
// ofertas-pdf.js (márgenes de 10mm, fuentes de 6.5-8pt, filas de 9mm en
// vez de 13) — layout medido con un script en Node contra jsPDF real y
// las 12 recomendaciones SSTA reales (ver verificación en el PR/plan), no
// a ojo, porque a este tamaño un renglón de más ya no cabe.

import { RIESGOS, PREOPERACIONALES, RECOMENDACIONES_SSTA } from "./ordenes-trabajo-datos.js";

const NAVY = [31, 39, 50];
const AMBER = [254, 178, 9];
const GRIS_CLARO = [245, 246, 248];
const TEXT_MUTED = [92, 101, 112];
// El logo.png normal trae el texto "CINCO S.A.S." en blanco (pensado para
// el fondo navy del sitio) — invisible sobre esta plantilla, que es de
// fondo blanco. Se usa la variante de texto oscuro (misma que la portada
// clara de informes-pdf.js) para que el nombre se vea.
const LOGO_URL = "../assets/img/logo-texto-oscuro.png";
// Mapa fijo de rutas (PESV) — la misma imagen en toda orden. Mapa político
// del Huila (Wikimedia Commons, autor Milenioscuro, CC BY-SA 4.0 —
// https://commons.wikimedia.org/wiki/File:Mapa_de_Huila_(pol%C3%ADtico).svg),
// atribución obligatoria por la licencia (ver el pie bajo el mapa más
// abajo). Se referencia por ruta estática (no Storage: no cambia por
// registro, igual criterio que LOGO_URL) — si el archivo llegara a faltar,
// el PDF deja el espacio reservado con una nota en vez de fallar.
const MAPA_RUTAS_URL = "../assets/img/mapa-rutas-pesv.svg";

// Código nuevo del SGC propio de Cinco SAS control (no el del formato viejo
// en papel) — área CAL (Calidad/HSEQ, ver documentos-plantillas.js),
// primer formato de esa área, misma lógica que AC-FOR-001/002 en
// correspondencia-pdf.js/informes-pdf.js. Todavía no está dado de alta en
// el Listado Maestro de Documentos (documentos.html) — igual que esos dos,
// queda "suelto" hasta que alguien lo registre ahí manualmente.
const CODIGO_FORMATO = "CAL-FOR-001";
const VERSION_FORMATO = "1";

function cargarImagenComoDataURL(url, colorFondo = "#ffffff") {
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
      resolve({ dataUrl: canvas.toDataURL("image/png"), ancho: img.naturalWidth, alto: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function formatearFechaHora(iso) {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function generarOrdenTrabajoPDF(orden) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margenX = 10;
  const margenInferior = altoPagina - 10;
  const anchoUtil = anchoPagina - margenX * 2;
  let y = 7;

  // A propósito NO hay salto de página en ninguna parte de este archivo —
  // si algo se desborda, es una señal de que hay que achicar ese bloque,
  // no de dejarlo pasar a una página 2 (pedido explícito: una sola hoja).

  // ---- una "caja con etiqueta": borde + etiqueta chica en negrilla arriba
  // + valor debajo, envolviendo con splitTextToSize — no existe un helper
  // así en el resto del repo (informes-pdf.js/ofertas-pdf.js dibujan tablas
  // de contenido libre, no un formulario de campos fijos), así que se
  // define acá, local a este archivo.
  function caja(x, yPos, w, h, etiqueta, valor, opts = {}) {
    doc.setDrawColor(150, 155, 162);
    doc.rect(x, yPos, w, h);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(etiqueta.toUpperCase(), x + 1.5, yPos + 2.3);
    doc.setFont("helvetica", opts.negrita ? "bold" : "normal");
    doc.setFontSize(opts.fontSize || 7);
    doc.setTextColor(20, 22, 26);
    const lineas = doc.splitTextToSize(String(valor ?? "—") || "—", w - 3);
    // La línea base del valor va 2.5mm debajo de la de la etiqueta (a
    // 5.2pt, la etiqueta mide ~2.1mm de alto — con 2.5 de por medio no se
    // tocan). Antes iba a una altura fija (6.6mm) pensada para cajas
    // altas; en las cajas chicas de esta plantilla (6-8mm) esa posición
    // quedaba encima de la propia etiqueta, y el valor se veía cruzado con
    // ella. Se limita a h-1.3 (deja 1.3mm de margen inferior) si la caja es
    // más baja que eso.
    doc.text(lineas.slice(0, opts.maxLineas || 2), x + 1.5, yPos + Math.min(4.8, h - 1.3));
  }

  // Dibuja una fila de cajas de igual alto repartidas según "fracciones"
  // (que deben sumar 1) y avanza "y" esa altura + separación.
  function filaCajas(campos, alto = 8) {
    let x = margenX;
    campos.forEach(({ etiqueta, valor, frac, opts }) => {
      const w = anchoUtil * frac;
      caja(x, y, w, alto, etiqueta, valor, opts);
      x += w;
    });
    y += alto + 1.3;
  }

  function tituloSeccion(texto) {
    doc.setFillColor(...NAVY);
    doc.rect(margenX, y, anchoUtil, 4.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.text(texto.toUpperCase(), margenX + 1.6, y + 3.35);
    doc.setTextColor(0, 0, 0);
    y += 4.6 + 1.3;
  }

  // ---- encabezado: logo + título + línea ámbar — mismo esquema que el
  // encabezado de página de Informes (informes-pdf.js: logo a la
  // izquierda, línea ámbar debajo a lo ancho de la página); acá no hacía
  // falta esa línea y por eso el encabezado no se veía igual al estándar
  // de los demás formatos. Código/versión quedan solo en el pie de
  // página, igual que allá. ----
  try {
    const logo = await cargarImagenComoDataURL(LOGO_URL, "#ffffff");
    const altoLogo = 10;
    const anchoLogo = altoLogo * (logo.ancho / logo.alto);
    doc.addImage(logo.dataUrl, "PNG", margenX, y, anchoLogo, altoLogo);
  } catch (e) { /* se genera igual sin logo */ }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...NAVY);
  doc.text("ORDEN DE TRABAJO", anchoPagina / 2, y + 6.5, { align: "center" });
  y += 11;
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.6);
  doc.line(margenX, y, anchoPagina - margenX, y);
  doc.setTextColor(0, 0, 0);
  y += 2;

  // ---- datos generales ----
  filaCajas([
    { etiqueta: "Orden de trabajo", valor: orden.numero, frac: 0.18 },
    { etiqueta: "Estado", valor: orden.estado || "ACTIVA", frac: 0.16 },
    { etiqueta: "Contrato número", valor: orden.contratoNumero, frac: 0.22 },
    { etiqueta: "Municipio", valor: orden.municipio, frac: 0.24 },
    { etiqueta: "Sector", valor: orden.sector === "R" ? "Rural" : "Urbano", frac: 0.20 }
  ]);
  filaCajas([
    { etiqueta: "Fecha y hora de elaboración", valor: formatearFechaHora(orden.creadoEn?.toDate ? orden.creadoEn.toDate().toISOString() : orden.fechaHoraInicio), frac: 1 / 3 },
    { etiqueta: "Fecha y hora de inicio", valor: formatearFechaHora(orden.fechaHoraInicio), frac: 1 / 3 },
    { etiqueta: "Fecha y hora de terminación", valor: formatearFechaHora(orden.fechaHoraTerminacion), frac: 1 / 3 }
  ]);

  // Responsable de orden de trabajo (quien la elaboró) + Responsable de
  // los trabajos (quien los ejecuta), en la misma fila — mismo alto y
  // formato de caja que el resto del formulario, solo repartido a la
  // mitad entre los dos (0.325/0.175 en vez de 0.65/0.35) para no sumar
  // una fila más al presupuesto de una sola página.
  tituloSeccion("Responsables");
  filaCajas([
    { etiqueta: "Responsable de orden de trabajo", valor: orden.elaboradoPor?.nombre, frac: 0.325 },
    { etiqueta: "Cédula", valor: orden.elaboradoPor?.cedula, frac: 0.175 },
    { etiqueta: "Responsable de los trabajos", valor: orden.responsable?.nombre, frac: 0.325 },
    { etiqueta: "Cédula", valor: orden.responsable?.cedula, frac: 0.175 }
  ]);

  tituloSeccion("Descripción");
  filaCajas([{ etiqueta: "Detalle de los trabajos a realizar", valor: orden.descripcion, frac: 1, opts: { fontSize: 6.8, maxLineas: 3 } }], 14.5);

  tituloSeccion("Recursos");
  filaCajas([
    { etiqueta: "Tipo de vehículo", valor: orden.vehiculo?.tipo, frac: 0.5 },
    { etiqueta: "Placa de vehículo", valor: orden.vehiculo?.placa, frac: 0.5 }
  ], 7.5);
  (orden.personalAdicional || []).forEach((p) => {
    filaCajas([
      { etiqueta: "Nombre", valor: p.nombre, frac: 0.65 },
      { etiqueta: "Cédula", valor: p.cedula, frac: 0.35 }
    ], 6.5);
  });

  // ---- trabajo de alto riesgo: 4 por fila (antes 2) para que las 8
  // entren en dos filas de 7mm en vez de cuatro de 10 — la mitad de alto.
  tituloSeccion("Trabajo de alto riesgo");
  for (let i = 0; i < RIESGOS.length; i += 4) {
    const grupo = RIESGOS.slice(i, i + 4);
    filaCajas(grupo.map((r) => ({ etiqueta: r.nombre, valor: (orden.altoRiesgo?.[r.clave] || "NO") === "SI" ? "SÍ" : "NO", frac: 1 / grupo.length, opts: { fontSize: 7, maxLineas: 1 } })), 6.3);
  }

  // ---- PESV (izquierda) + Requerimientos preoperacionales (derecha), en
  // dos columnas — igual disposición que la plantilla en papel.
  const anchoCol = (anchoUtil - 5) / 2;
  const xIzq = margenX;
  const xDer = margenX + anchoCol + 5;
  const yInicioColumnas = y;

  doc.setFillColor(...NAVY);
  doc.rect(xIzq, y, anchoCol, 4.6, "F");
  doc.rect(xDer, y, anchoCol, 4.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(255, 255, 255);
  doc.text("INFORMACIÓN PESV", xIzq + 1.6, y + 3.35);
  doc.text("REQ. PREOPERACIONALES", xDer + 1.6, y + 3.35);
  doc.setTextColor(0, 0, 0);
  let yIzq = y + 4.6 + 1.5;
  let yDer = y + 4.6 + 1.5;

  // -- columna izquierda: tarjeta de texto (párrafo + origen/destino/rutas)
  // angosta a la izquierda, mapa grande a la derecha — a pedido del
  // usuario ("el mapa quedó supremamente pequeño"): antes el párrafo y los
  // 4 campos iban ARRIBA del mapa, dejándolo como una franja delgada de
  // solo 22mm de alto pese a tener todo el ancho de la columna disponible.
  // El alto del mapa se fija a lo que mide la columna derecha (15
  // elementos preoperacionales) para no desbalancear el alto de las dos
  // columnas ni pasarse del presupuesto de una sola página.
  const altoMapa = 42;
  const anchoMapa = altoMapa * (1415 / 1458); // proporción real del SVG (ver MAPA_RUTAS_URL)
  const xMapa = xIzq + (anchoCol - anchoMapa);
  const anchoTexto = anchoCol - anchoMapa - 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(20, 22, 26);
  const parrafoPesv = "El responsable de los trabajos, con el fin de dar cumplimiento a las acciones y estrategias en seguridad vial estipuladas en la Resolución 40595 de 2022, relaciona lo siguiente:";
  const lineasPesv = doc.splitTextToSize(parrafoPesv, anchoTexto);
  doc.text(lineasPesv, xIzq, yIzq + 2.1);
  yIzq += lineasPesv.length * 2.35 + 1.2;

  [
    ["Origen", orden.pesv?.origen], ["Destino", orden.pesv?.destino],
    ["Desc. ruta", orden.pesv?.descripcionRuta], ["Pausas activas", orden.pesv?.descripcionPausasActivas]
  ].forEach(([etq, val]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.4);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${etq}:`, xIzq, yIzq + 1.9);
    yIzq += 2.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(20, 22, 26);
    const lineas = doc.splitTextToSize(String(val || "—"), anchoTexto).slice(0, 2);
    doc.text(lineas, xIzq, yIzq + 1.9);
    yIzq += lineas.length * 2.2 + 0.8;
  });

  // Mapa, a la derecha de la tarjeta de texto, mucho más grande que antes.
  doc.setDrawColor(150, 155, 162);
  doc.rect(xMapa, yInicioColumnas + 4.6 + 1.5, anchoMapa, altoMapa);
  try {
    const mapa = await cargarImagenComoDataURL(MAPA_RUTAS_URL, "#ffffff");
    const escala = Math.min(anchoMapa / mapa.ancho, altoMapa / mapa.alto);
    const wImg = mapa.ancho * escala;
    const hImg = mapa.alto * escala;
    doc.addImage(mapa.dataUrl, "PNG", xMapa + (anchoMapa - wImg) / 2, yInicioColumnas + 4.6 + 1.5 + (altoMapa - hImg) / 2, wImg, hImg);
  } catch (e) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Mapa de rutas —\npendiente de cargar", xMapa + anchoMapa / 2, yInicioColumnas + 4.6 + 1.5 + altoMapa / 2, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }
  // Atribución obligatoria de la licencia CC BY-SA 4.0 del mapa (Wikimedia
  // Commons) — no se puede quitar sin dejar de cumplir la licencia.
  doc.setFont("helvetica", "italic");
  doc.setFontSize(4.4);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Milenioscuro / Wikimedia Commons, CC BY-SA 4.0", xMapa, yInicioColumnas + 4.6 + 1.5 + altoMapa + 2.4);
  doc.setTextColor(0, 0, 0);
  yIzq = Math.max(yIzq, yInicioColumnas + 4.6 + 1.5 + altoMapa + 3.6);

  // -- columna derecha: párrafo + checklist 15 filas (elemento / SI-NO-N-A) --
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(20, 22, 26);
  const parrafoPreop = "El responsable de los trabajos manifiesta que ha inspeccionado y garantiza la utilización de los siguientes elementos de trabajo:";
  const lineasPreop = doc.splitTextToSize(parrafoPreop, anchoCol);
  doc.text(lineasPreop, xDer, yDer + 2.4);
  yDer += lineasPreop.length * 2.7 + 1.5;

  PREOPERACIONALES.forEach((item) => {
    const valor = orden.preoperacionales?.[item.clave] || "NO";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(20, 22, 26);
    doc.text(item.nombre, xDer, yDer + 2.1);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(valor === "SI" ? [30, 130, 76] : valor === "NO" ? [178, 52, 52] : TEXT_MUTED));
    doc.text(valor === "SI" ? "SÍ" : valor, xDer + anchoCol - 8, yDer + 2.1, { align: "right" });
    doc.setTextColor(0, 0, 0);
    yDer += 2.15;
  });

  y = Math.max(yIzq, yDer, yInicioColumnas) + 2;

  // ---- recomendaciones SSTA: bloque fijo de la compañía, no depende de
  // datos de la orden — mismo texto en todas. En dos columnas (6 ítems
  // cada una) para no gastar media página en algo que nunca cambia.
  tituloSeccion("Recomendaciones SSTA");
  const anchoRecCol = (anchoUtil - 5) / 2;
  const mitad = Math.ceil(RECOMENDACIONES_SSTA.length / 2);
  const columnasRec = [
    { x: margenX, items: RECOMENDACIONES_SSTA.slice(0, mitad), inicio: 0 },
    { x: margenX + anchoRecCol + 5, items: RECOMENDACIONES_SSTA.slice(mitad), inicio: mitad }
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(20, 22, 26);
  let yMaxRec = y;
  columnasRec.forEach(({ x, items, inicio }) => {
    let yCol = y;
    items.forEach((texto, i) => {
      const lineas = doc.splitTextToSize(`${inicio + i + 1}. ${texto}`, anchoRecCol);
      doc.text(lineas, x, yCol + 2.1);
      yCol += lineas.length * 2.3 + 0.4;
    });
    if (yCol > yMaxRec) yMaxRec = yCol;
  });
  y = yMaxRec + 1.5;

  // ---- cierre ----
  tituloSeccion("Cierre");
  filaCajas([{ etiqueta: "Observaciones", valor: orden.cierre?.observaciones, frac: 1, opts: { fontSize: 6.6, maxLineas: 2 } }], 11);
  filaCajas([
    { etiqueta: "Fecha y hora de cierre", valor: formatearFechaHora(orden.cierre?.fechaHoraCierre), frac: 0.30 },
    { etiqueta: "Horas adicionales", valor: orden.cierre?.horasAdicionales, frac: 0.23 },
    { etiqueta: "Vales de alimentación", valor: orden.cierre?.valesAlimentacion, frac: 0.23 },
    { etiqueta: "Pernoctada", valor: orden.cierre?.pernoctada === "SI" ? "Sí" : "No", frac: 0.24 }
  ]);

  // ---- firmas: Elaboró (quien genera la orden) + Responsable (quien
  // ejecuta) — ambas dibujadas a mano con el mismo lienzo (ver
  // crearFirma() en ordenes-trabajo.js, 600x180 — misma proporción 10:3
  // usada abajo para no deformarlas): la de quien elabora se pide ya en el
  // Paso 1, al crear la orden; la del responsable, al cerrarla (Paso 4).
  // Una orden vieja (de antes de que existiera alguna de las dos firmas)
  // deja solo el nombre impreso sobre la línea, como ya era.
  const anchoFirma = (anchoUtil - 6) / 2;
  const altoImgFirma = 8;
  [
    { x: margenX, nombre: orden.elaboradoPor?.nombre, cc: orden.elaboradoPor?.cedula, firma: orden.elaboradoPor?.firmaDataUrl },
    { x: margenX + anchoFirma + 6, nombre: orden.responsable?.nombre, cc: orden.responsable?.cedula, firma: orden.cierre?.firmaDataUrl }
  ].forEach(({ x, nombre, cc, firma }) => {
    if (firma) {
      try {
        const anchoImg = Math.min(altoImgFirma * (600 / 180), anchoFirma);
        doc.addImage(firma, "PNG", x, y, anchoImg, altoImgFirma);
      } catch (e) { /* si la firma no carga, queda el nombre impreso igual */ }
    }
    doc.setDrawColor(120, 126, 134);
    doc.line(x, y + altoImgFirma, x + anchoFirma, y + altoImgFirma);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(20, 22, 26);
    doc.text(nombre || "—", x, y + altoImgFirma + 2.3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(...TEXT_MUTED);
    // 3.1mm de por medio entre la línea base del nombre y la de la
    // cédula (a 7.2pt, el nombre mide ~2mm de alto) — antes iban a solo
    // 2.3mm y la cédula terminaba tocando el propio nombre por encima.
    doc.text(`C.C. ${cc || "—"}`, x, y + altoImgFirma + 5.4);
    doc.setTextColor(0, 0, 0);
  });
  y += altoImgFirma + 6.9;

  // ---- pie de página: franja ámbar + gris clara con código/versión —
  // mismo esquema que el pie de Informes/Correspondencia (acá en una sola
  // línea de alto, sin la segunda línea de dirección/paginación que sí
  // llevan esos formatos multipágina). ----
  const altoPie = 6;
  const yPie = altoPagina - altoPie;
  doc.setFillColor(...AMBER);
  doc.rect(0, yPie - 0.8, anchoPagina, 0.8, "F");
  doc.setFillColor(...GRIS_CLARO);
  doc.rect(0, yPie, anchoPagina, altoPie, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Código: ${CODIGO_FORMATO} · Versión: ${VERSION_FORMATO}`, margenX, yPie + altoPie / 2 + 1);
  doc.text(`Orden ${orden.numero}`, anchoPagina - margenX, yPie + altoPie / 2 + 1, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // Si a pesar de todo esto algún contenido genuinamente largo (ej. una
  // descripción o unas observaciones de cierre enormes) empujó "y" más
  // allá del margen inferior, jsPDF ya lo dibujó fuera de la hoja — se
  // avisa en consola para poder ajustar, en vez de fallar en silencio
  // (no se agrega página 2: el pedido fue que quepa en una sola).
  if (y > margenInferior) {
    console.warn(`Orden de Trabajo ${orden.numero}: el contenido superó el alto de una página por ${(y - margenInferior).toFixed(1)}mm.`);
  }

  return doc;
}
