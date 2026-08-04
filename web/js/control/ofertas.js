import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, deleteDoc, updateDoc, setDoc, runTransaction,
  serverTimestamp, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { generarOfertaPDF } from "./ofertas-pdf.js";
import { registrarDocumentoSGC } from "./documentos-sgc.js";
import { truncar } from "./texto.js";
import { LINEAS_SERVICIO } from "./lineas-servicio.js";
import { crearCampoTextoRico } from "./texto-rico.js";
import {
  normalizarMerges, celdaCombinada, expandirRangoConMerges, quitarMergesQueIntersectan,
  celdaCentrada, normalizarCentrados, centrarRango, alinearIzquierdaRango, anchosColumnaEditor,
  redimensionarFilas
} from "./tabla-celdas.js";

// Área/tipo fijos para que una oferta quede en el Listado Maestro de
// Documentos (SGC) sin pedir un campo más en el formulario — mismo
// criterio que informes.js.
const AREA_SGC_OFERTAS = "SC";
const TIPO_SGC_OFERTAS = "OFE";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const tbody = document.getElementById("listaOfertas");
const sinOfertas = document.getElementById("sinOfertas");
const form = document.getElementById("nuevaOfertaForm");
const alertBox = document.getElementById("crearOfertaAlert");
const guardarBtn = document.getElementById("guardarOfertaBtn");
const visualizarBtn = document.getElementById("visualizarOfertaBtn");
const descargarBtn = document.getElementById("descargarOfertaBtn");
const cancelarEdicionBtn = document.getElementById("cancelarEdicionOfertaBtn");
const ofertaIdEnEdicion = document.getElementById("ofertaIdEnEdicion");

// Igual criterio que informes.js: última oferta guardada con el contenido
// actual — "Descargar" la usa sin volver a guardar.
let ofertaGuardadaActual = null;
function actualizarDescargarBtn() {
  descargarBtn.disabled = !ofertaGuardadaActual;
}
const selectContrato = document.getElementById("contratoRelacionado");
const selectLinea = document.getElementById("lineaServicio");
const selectTipo = document.getElementById("tipo");
const selectFirma = document.getElementById("firmaEmail");
const bloquesEditor = document.getElementById("bloquesEditor");
const inputImagen = document.getElementById("inputImagen");
const itemsEditor = document.getElementById("itemsEditor");
const aiuBox = document.getElementById("aiuBox");
const administracionInput = document.getElementById("administracion");
const imprevistosInput = document.getElementById("imprevistos");
const utilidadInput = document.getElementById("utilidad");
const ivaInput = document.getElementById("iva");
const ivaAyuda = document.getElementById("ivaAyuda");
const totalesResumen = document.getElementById("totalesResumen");
const aplicaPolizaCheck = document.getElementById("aplicaPoliza");
const detallePolizaTextarea = document.getElementById("detallePoliza");

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

LINEAS_SERVICIO.forEach((l) => {
  const opt = document.createElement("option");
  opt.value = l.clave;
  opt.textContent = l.nombre;
  selectLinea.appendChild(opt);
});

// Firestore no permite arrays anidados — mismo problema y misma solución
// que en Informes (ver informes.js): cada fila de una tabla se envuelve
// en {celdas:[...]} al guardar y se desenvuelve al volver a cargar.
function filasParaGuardar(filas) {
  return filas.map((fila) => ({ celdas: fila }));
}
function filasParaEditar(filas) {
  return filas.map((fila) => (Array.isArray(fila) ? fila : fila.celdas || []));
}

// ---- editor de bloques: título1/título2/título3/párrafo/tabla/imagen —
// copia exacta del patrón de informes.js (mismo criterio de "cada módulo
// con su propia copia", ya establecido entre informes.js/correspondencia.js). ----
let bloques = [];

// Años de trayectoria desde la fundación (29 de diciembre de 2009) — mismo
// cálculo que aniosDeTrayectoria() en site.js, copiado aquí (no exportado
// como módulo compartido) para que el texto de partida no quede con un
// número fijo desactualizado, como ya pasó antes en la franja de cifras.
function aniosDeTrayectoria() {
  const FUNDACION = new Date(2009, 11, 29);
  const hoy = new Date();
  let anios = hoy.getFullYear() - FUNDACION.getFullYear();
  const aunNoCumpleAnios = hoy.getMonth() < FUNDACION.getMonth() ||
    (hoy.getMonth() === FUNDACION.getMonth() && hoy.getDate() < FUNDACION.getDate());
  if (aunNoCumpleAnios) anios -= 1;
  return anios;
}

// "y" antes del último elemento en vez de una coma más, para que la lista
// de líneas de servicio se lea como prosa y no como un catálogo pegado.
function listarConY(items) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " y " + items[items.length - 1];
}

// Texto de partida para que la oferta no arranque en blanco ni se quede
// corta — cubre "mostrar las bondades de Cinco sin descalificar a nadie":
// experiencia, alcance de líneas de servicio, invitación a conocer más en
// el sitio web, y enfoque en calidad, sin nombrar competencia. Totalmente
// editable por oferta; el usuario ajusta el alcance específico de lo que
// está cotizando.
function bloquesPorDefecto() {
  return [
    { tipo: "titulo1", texto: "1. Quiénes somos" },
    { tipo: "parrafo", texto: `Cinco S.A.S. es una empresa con más de ${aniosDeTrayectoria()} años de experiencia en construcción, ingeniería y consultoría para el sector eléctrico, con más de 30 proyectos de construcción, más de 20 interventorías y más de 30 proyectos de diseño ejecutados para entidades públicas y privadas. Contamos con un equipo multidisciplinario de profesionales dedicados a entregar soluciones técnicas confiables, puntuales y respaldadas por un enfoque riguroso de calidad en cada etapa del servicio.` },
    { tipo: "titulo1", texto: "2. Nuestras líneas de servicio" },
    { tipo: "parrafo", texto: `Atendemos el ciclo completo de un proyecto eléctrico desde un solo aliado, con ${LINEAS_SERVICIO.length} líneas de servicio especializadas: ${listarConY(LINEAS_SERVICIO.map((l) => l.nombre.toLowerCase()))}.` },
    { tipo: "titulo1", texto: "3. Por qué elegir a Cinco S.A.S." },
    { tipo: "parrafo", texto: "Nuestra trayectoria nos permite acompañar a nuestros clientes con seriedad y respaldo técnico real, no solo con una propuesta económica. Contamos con procesos documentados, personal calificado en cada línea de servicio, y un compromiso directo de la gerencia con la calidad y los tiempos de entrega de cada proyecto." },
    { tipo: "parrafo", texto: "Conoce más sobre nuestra trayectoria, los proyectos que hemos ejecutado y los clientes que ya confían en nosotros en cinco-sas.web.app." },
    { tipo: "titulo1", texto: "4. Alcance del servicio ofertado" },
    { tipo: "parrafo", texto: "Describe aquí el alcance específico de esta oferta: actividades incluidas, entregables, cronograma estimado y cualquier condición técnica particular." },
    { tipo: "titulo1", texto: "5. Valor de la oferta" },
    { tipo: "parrafo", texto: "El detalle de cantidades, precios unitarios y el valor total de esta oferta se presenta en el Anexo 1 — Cotización detallada, al final de este documento." }
  ];
}

function nuevaTabla() {
  return { tipo: "tabla", titulo: "", filas: [["", ""], ["", ""]], merges: [], centrados: [] };
}

function redimensionarImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, 1600 / img.naturalWidth);
        const ancho = Math.round(img.naturalWidth * escala);
        const alto = Math.round(img.naturalHeight * escala);
        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, ancho, alto);
        ctx.drawImage(img, 0, 0, ancho, alto);
        canvas.toBlob(
          (blob) => resolve({ blob, previewUrl: canvas.toDataURL("image/jpeg", 0.86), ancho, alto }),
          "image/jpeg", 0.86
        );
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function moverBloque(indice, direccion) {
  const destino = indice + direccion;
  if (destino < 0 || destino >= bloques.length) return;
  [bloques[indice], bloques[destino]] = [bloques[destino], bloques[indice]];
  renderBloques();
}

function quitarBloque(indice) {
  bloques.splice(indice, 1);
  renderBloques();
}

const TITULO_LABEL = { titulo1: "Título 1", titulo2: "Título 2", titulo3: "Título 3", titulo4: "Título 4" };

// Tipos de bloque que se pueden insertar desde un "hueco" entre bloques
// (o antes del primero) — mismas 7 opciones que la barra de abajo, para
// no obligar a agregar siempre al final y reordenar a mano.
const TIPOS_INSERTABLES = [
  { tipo: "titulo1", etiqueta: "Título 1" },
  { tipo: "titulo2", etiqueta: "Título 2" },
  { tipo: "titulo3", etiqueta: "Título 3" },
  { tipo: "titulo4", etiqueta: "Título 4" },
  { tipo: "parrafo", etiqueta: "Párrafo" },
  { tipo: "tabla", etiqueta: "Tabla" },
  { tipo: "imagen", etiqueta: "Gráfico / imagen" }
];

// Mientras se espera el selector de archivo, en qué hueco insertar la(s)
// imagen(es) elegidas — el input de archivo es uno solo, compartido con
// el botón "+ Gráfico / imagen" de la barra de abajo.
let indiceInsertarImagen = null;

function crearBloquePorTipo(tipo) {
  if (tipo === "tabla") return nuevaTabla();
  return { tipo, texto: "" };
}

function insertarBloqueEn(indice, tipo) {
  if (tipo === "imagen") {
    indiceInsertarImagen = indice;
    inputImagen.click();
    return;
  }
  bloques.splice(indice, 0, crearBloquePorTipo(tipo));
  renderBloques();
}

// Botones de insertar SIEMPRE visibles (no un "+" que hay que abrir) — se
// pidió explícitamente poder agregar un título/párrafo/tabla/gráfico junto
// a cualquier campo, sin tener que bajar hasta el final de la lista.
function renderHueco(indice) {
  const hueco = document.createElement("div");
  hueco.className = "control-bloque-gap";
  TIPOS_INSERTABLES.forEach(({ tipo, etiqueta }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-btn-mini";
    btn.textContent = etiqueta;
    btn.addEventListener("click", () => insertarBloqueEn(indice, tipo));
    hueco.appendChild(btn);
  });
  return hueco;
}

function renderBloques() {
  bloquesEditor.innerHTML = "";
  bloquesEditor.appendChild(renderHueco(0));
  bloques.forEach((bloque, i) => {
    const fila = document.createElement("div");
    fila.className = "control-bloque";

    const contenido = document.createElement("div");
    contenido.className = "control-bloque-contenido";

    if (bloque.tipo in TITULO_LABEL) {
      const etiqueta = document.createElement("span");
      etiqueta.className = "control-bloque-etiqueta";
      etiqueta.textContent = TITULO_LABEL[bloque.tipo];
      contenido.appendChild(etiqueta);
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 200;
      input.placeholder = "Texto del título...";
      input.value = bloque.texto;
      input.addEventListener("input", () => { bloque.texto = input.value; });
      contenido.appendChild(input);
    } else if (bloque.tipo === "parrafo") {
      contenido.appendChild(crearCampoTextoRico({
        valor: bloque.texto,
        placeholder: "Escribe un párrafo...",
        onInput: (html) => { bloque.texto = html; }
      }));
    } else if (bloque.tipo === "tabla") {
      contenido.appendChild(renderTablaEditor(bloque));
    } else {
      const img = document.createElement("img");
      img.src = bloque.previewUrl;
      img.className = "control-bloque-imagen";
      contenido.appendChild(img);
      const pie = document.createElement("input");
      pie.type = "text";
      pie.maxLength = 200;
      pie.placeholder = "Pie de foto (aparece en la Lista de gráficos)";
      pie.value = bloque.pieDeFoto || "";
      pie.addEventListener("input", () => { bloque.pieDeFoto = pie.value; });
      contenido.appendChild(pie);
    }
    fila.appendChild(contenido);

    const controles = document.createElement("div");
    controles.className = "control-bloque-controles";
    const subir = document.createElement("button");
    subir.type = "button";
    subir.className = "control-btn-mini";
    subir.textContent = "↑";
    subir.disabled = i === 0;
    subir.addEventListener("click", () => moverBloque(i, -1));
    const bajar = document.createElement("button");
    bajar.type = "button";
    bajar.className = "control-btn-mini";
    bajar.textContent = "↓";
    bajar.disabled = i === bloques.length - 1;
    bajar.addEventListener("click", () => moverBloque(i, 1));
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "control-btn-danger";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", () => quitarBloque(i));
    controles.append(subir, bajar, quitar);
    fila.appendChild(controles);

    bloquesEditor.appendChild(fila);
    bloquesEditor.appendChild(renderHueco(i + 1));
  });
}

// Rellena una tabla desde texto copiado de Excel (celdas separadas por
// tabulador, filas por salto de línea) o de una tabla de Word — mismo
// criterio que informes.js. Crece filas/columnas si el pegado no cabe en
// el tamaño actual.
function pegarEnTabla(bloque, filaInicio, colInicio, texto) {
  const filas = texto.replace(/\r/g, "").split("\n");
  while (filas.length > 1 && filas[filas.length - 1] === "") filas.pop();
  const datos = filas.map((fila) => fila.split("\t"));

  const colsNecesarias = colInicio + Math.max(...datos.map((f) => f.length));
  const filasNecesarias = filaInicio + datos.length;
  while (bloque.filas[0].length < colsNecesarias) bloque.filas.forEach((fila) => fila.push(""));
  while (bloque.filas.length < filasNecesarias) bloque.filas.push(bloque.filas[0].map(() => ""));

  // Los datos pegados ya no respetan ninguna combinación previa que caiga
  // dentro del rango que se va a sobrescribir.
  bloque.merges = quitarMergesQueIntersectan(
    bloque.merges || [], filaInicio, filaInicio + datos.length - 1, colInicio, colsNecesarias - 1
  );

  datos.forEach((fila, fi) => {
    fila.forEach((valor, ci) => { bloque.filas[filaInicio + fi][colInicio + ci] = valor; });
  });
  renderBloques();
}

function rangoOrdenado(a, b) {
  return { fMin: Math.min(a.fi, b.fi), fMax: Math.max(a.fi, b.fi), cMin: Math.min(a.ci, b.ci), cMax: Math.max(a.ci, b.ci) };
}

function renderTablaEditor(bloque) {
  const cont = document.createElement("div");
  cont.className = "control-tabla-editor";

  const tituloInput = document.createElement("input");
  tituloInput.type = "text";
  tituloInput.maxLength = 200;
  tituloInput.placeholder = "Título de la tabla (aparece en la Lista de tablas)";
  tituloInput.value = bloque.titulo || "";
  tituloInput.addEventListener("input", () => { bloque.titulo = tituloInput.value; });
  cont.appendChild(tituloInput);

  // Una tabla pegada desde Excel/Word puede llegar "dispareja" (una fila
  // con menos celdas que las demás, típicamente porque el origen tenía una
  // celda ya combinada) — se completa a un rectángulo parejo con celdas
  // vacías antes de seguir. Si no, "+ Fila"/"+ Columna" (que se basan en el
  // ancho de la fila 0) heredaban ese ancho corto y agregaban filas/columnas
  // incompletas.
  const numFilas = bloque.filas.length;
  const numCols = Math.max(...bloque.filas.map((f) => f.length));
  bloque.filas.forEach((fila) => { while (fila.length < numCols) fila.push(""); });
  bloque.merges = normalizarMerges(bloque.merges || [], numFilas, numCols);
  bloque.centrados = normalizarCentrados(bloque.centrados || [], numFilas, numCols);

  // Tamaño directo: para tablas grandes es más rápido escribir "12 filas,
  // 9 columnas" de una vez que hacer clic en +Fila/+Columna una por una.
  const tamanoDiv = document.createElement("div");
  tamanoDiv.className = "control-tabla-tamano";
  const filasSizeInput = document.createElement("input");
  filasSizeInput.type = "number";
  filasSizeInput.min = "1";
  filasSizeInput.value = numFilas;
  const colsSizeInput = document.createElement("input");
  colsSizeInput.type = "number";
  colsSizeInput.min = "1";
  colsSizeInput.value = numCols;
  const labelFilas = document.createElement("label");
  labelFilas.textContent = "Filas";
  labelFilas.appendChild(filasSizeInput);
  const labelCols = document.createElement("label");
  labelCols.textContent = "Columnas";
  labelCols.appendChild(colsSizeInput);
  const tamanoBtn = document.createElement("button");
  tamanoBtn.type = "button";
  tamanoBtn.className = "control-btn-mini";
  tamanoBtn.textContent = "↕ Cambiar tamaño";
  tamanoBtn.title = "Ajusta la tabla al número de filas y columnas escrito (agrega vacías o quita desde el final)";
  tamanoBtn.addEventListener("click", () => {
    const nf = Math.max(1, parseInt(filasSizeInput.value, 10) || numFilas);
    const nc = Math.max(1, parseInt(colsSizeInput.value, 10) || numCols);
    if (nf === numFilas && nc === numCols) return;
    redimensionarFilas(bloque.filas, nf, nc);
    renderBloques();
  });
  tamanoDiv.append(labelFilas, labelCols, tamanoBtn);
  cont.appendChild(tamanoDiv);

  const grid = document.createElement("div");
  grid.className = "control-tabla-grid";
  // Ancho de columna proporcional a su contenido (no partes iguales) —
  // mismo criterio que el PDF, ver anchosColumnaEditor.
  const pesosCol = anchosColumnaEditor(bloque.filas, bloque.merges, numFilas, numCols);
  grid.style.gridTemplateColumns = pesosCol.map((p) => `minmax(90px, ${p}fr)`).join(" ");

  // Pinta el rango [bloque._selA.._selB] (si hay uno activo) como
  // seleccionado — se llama tras cada clic/arrastre sin re-renderizar toda
  // la cuadrícula, para no perder el foco mientras se arrastra.
  function actualizarResaltado() {
    const rango = bloque._selA && bloque._selB ? rangoOrdenado(bloque._selA, bloque._selB) : null;
    grid.querySelectorAll("input").forEach((input) => {
      const fi = Number(input.dataset.fi);
      const ci = Number(input.dataset.ci);
      const sel = !!rango && fi >= rango.fMin && fi <= rango.fMax && ci >= rango.cMin && ci <= rango.cMax;
      input.classList.toggle("control-celda-sel", sel);
    });
  }

  bloque.filas.forEach((fila, fi) => {
    fila.forEach((celda, ci) => {
      const info = celdaCombinada(bloque.merges, fi, ci);
      if (info && !info.esAncla) return; // celda cubierta por un rango combinado: no se dibuja

      const celdaInput = document.createElement("input");
      celdaInput.type = "text";
      celdaInput.maxLength = 300;
      celdaInput.value = celda;
      celdaInput.placeholder = fi === 0 ? `Columna ${ci + 1}` : "";
      celdaInput.dataset.fi = fi;
      celdaInput.dataset.ci = ci;
      celdaInput.style.gridColumn = info ? `${ci + 1} / span ${info.merge.cols}` : `${ci + 1}`;
      celdaInput.style.gridRow = info ? `${fi + 1} / span ${info.merge.filas}` : `${fi + 1}`;
      celdaInput.style.textAlign = celdaCentrada(bloque.centrados, fi, ci) ? "center" : "left";
      celdaInput.addEventListener("input", () => { bloque.filas[fi][ci] = celdaInput.value; });
      // Recuerda dónde estaba el cursor para que el botón "Pegar tabla"
      // sepa dónde empezar si el pegado no se hizo directo sobre una celda.
      celdaInput.addEventListener("focus", () => { bloque._filaFoco = fi; bloque._colFoco = ci; });
      // Pegado directo de Excel/Word: si trae varias celdas (tabulador o
      // salto de línea) se reparte por la cuadrícula; si es una sola celda
      // se deja el pegado normal del navegador.
      celdaInput.addEventListener("paste", (e) => {
        const texto = e.clipboardData?.getData("text/plain") ?? "";
        if (/\t|\n/.test(texto)) { e.preventDefault(); pegarEnTabla(bloque, fi, ci, texto); }
      });
      // Selección de un rango arrastrando sobre la cuadrícula (como en
      // Excel), para los botones "Combinar celdas"/"Separar celdas" — un
      // solo clic selecciona esa celda sola y no estorba para escribir.
      celdaInput.addEventListener("mousedown", () => {
        bloque._selA = { fi, ci };
        bloque._selB = { fi, ci };
        actualizarResaltado();
      });
      celdaInput.addEventListener("mouseenter", (e) => {
        if (e.buttons === 1 && bloque._selA) {
          bloque._selB = { fi, ci };
          actualizarResaltado();
        }
      });
      grid.appendChild(celdaInput);
    });
  });
  cont.appendChild(grid);
  actualizarResaltado();

  const botones = document.createElement("div");
  botones.className = "control-tabla-botones";
  const agregarFila = document.createElement("button");
  agregarFila.type = "button";
  agregarFila.className = "control-btn-mini";
  agregarFila.textContent = "+ Fila";
  agregarFila.addEventListener("click", () => {
    bloque.filas.push(new Array(numCols).fill(""));
    renderBloques();
  });
  const quitarFila = document.createElement("button");
  quitarFila.type = "button";
  quitarFila.className = "control-btn-mini";
  quitarFila.textContent = "- Fila";
  quitarFila.disabled = bloque.filas.length <= 1;
  quitarFila.addEventListener("click", () => {
    if (bloque.filas.length > 1) { bloque.filas.pop(); renderBloques(); }
  });
  const agregarCol = document.createElement("button");
  agregarCol.type = "button";
  agregarCol.className = "control-btn-mini";
  agregarCol.textContent = "+ Columna";
  agregarCol.addEventListener("click", () => {
    bloque.filas.forEach((fila) => fila.push(""));
    renderBloques();
  });
  const quitarCol = document.createElement("button");
  quitarCol.type = "button";
  quitarCol.className = "control-btn-mini";
  quitarCol.textContent = "- Columna";
  quitarCol.disabled = numCols <= 1;
  quitarCol.addEventListener("click", () => {
    if (numCols > 1) { bloque.filas.forEach((fila) => fila.pop()); renderBloques(); }
  });
  const pegarBtn = document.createElement("button");
  pegarBtn.type = "button";
  pegarBtn.className = "control-btn-mini";
  pegarBtn.textContent = "📋 Pegar desde Excel/Word";
  pegarBtn.title = "Copia el rango en Excel (o la tabla en Word) y haz clic aquí — también puedes pegar (Ctrl+V) directo sobre cualquier celda";
  pegarBtn.addEventListener("click", async () => {
    const fi = bloque._filaFoco ?? 0;
    const ci = bloque._colFoco ?? 0;
    try {
      const texto = await navigator.clipboard.readText();
      if (!texto) { mostrarAlerta("El portapapeles está vacío. Copia primero el rango en Excel o la tabla en Word.", "error"); return; }
      pegarEnTabla(bloque, fi, ci, texto);
    } catch (e) {
      mostrarAlerta("El navegador no dejó leer el portapapeles automáticamente. Haz clic en la celda donde quieres empezar y pega con Ctrl+V — funciona igual.", "error");
    }
  });
  const combinarBtn = document.createElement("button");
  combinarBtn.type = "button";
  combinarBtn.className = "control-btn-mini";
  combinarBtn.textContent = "🔗 Combinar celdas";
  combinarBtn.title = "Arrastra sobre las celdas que quieras combinar y haz clic aquí";
  combinarBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas que quieras combinar antes de hacer clic aquí.", "error");
      return;
    }
    let { fMin, fMax, cMin, cMax } = expandirRangoConMerges(bloque.merges, rangoOrdenado(bloque._selA, bloque._selB));
    if (fMin === fMax && cMin === cMax) {
      mostrarAlerta("Selecciona al menos 2 celdas para combinar.", "error");
      return;
    }
    // El texto de las celdas que se van a "esconder" no se pierde: se une
    // al de la celda ancla (arriba-izquierda), separado por espacios.
    const textos = [];
    for (let fi = fMin; fi <= fMax; fi++) {
      for (let ci = cMin; ci <= cMax; ci++) {
        if (bloque.filas[fi][ci]) textos.push(bloque.filas[fi][ci]);
      }
    }
    bloque.filas[fMin][cMin] = textos.join(" ").trim();
    for (let fi = fMin; fi <= fMax; fi++) {
      for (let ci = cMin; ci <= cMax; ci++) {
        if (fi !== fMin || ci !== cMin) bloque.filas[fi][ci] = "";
      }
    }
    bloque.merges = quitarMergesQueIntersectan(bloque.merges, fMin, fMax, cMin, cMax);
    bloque.merges.push({ fila: fMin, col: cMin, filas: fMax - fMin + 1, cols: cMax - cMin + 1 });
    bloque._selA = { fi: fMin, ci: cMin };
    bloque._selB = { fi: fMin, ci: cMin };
    renderBloques();
  });
  const separarBtn = document.createElement("button");
  separarBtn.type = "button";
  separarBtn.className = "control-btn-mini";
  separarBtn.textContent = "✂ Separar celdas";
  separarBtn.title = "Selecciona (o haz clic sobre) una celda combinada y haz clic aquí para deshacer la combinación";
  separarBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Haz clic sobre la celda combinada que quieras separar.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = expandirRangoConMerges(bloque.merges, rangoOrdenado(bloque._selA, bloque._selB));
    const quedan = quitarMergesQueIntersectan(bloque.merges, fMin, fMax, cMin, cMax);
    if (quedan.length === bloque.merges.length) {
      mostrarAlerta("No hay celdas combinadas en la selección.", "error");
      return;
    }
    bloque.merges = quedan;
    renderBloques();
  });
  const centrarBtn = document.createElement("button");
  centrarBtn.type = "button";
  centrarBtn.className = "control-btn-mini";
  centrarBtn.textContent = "↔ Centrar";
  centrarBtn.title = "Arrastra sobre las celdas (una fila, una columna o cualquier bloque) y haz clic aquí para centrar su texto";
  centrarBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas que quieras centrar antes de hacer clic aquí.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = rangoOrdenado(bloque._selA, bloque._selB);
    bloque.centrados = centrarRango(bloque.centrados, fMin, fMax, cMin, cMax);
    renderBloques();
  });
  const izquierdaBtn = document.createElement("button");
  izquierdaBtn.type = "button";
  izquierdaBtn.className = "control-btn-mini";
  izquierdaBtn.textContent = "⇤ Izquierda";
  izquierdaBtn.title = "Arrastra sobre las celdas y haz clic aquí para volver a alinear su texto a la izquierda";
  izquierdaBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas que quieras alinear a la izquierda antes de hacer clic aquí.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = rangoOrdenado(bloque._selA, bloque._selB);
    bloque.centrados = alinearIzquierdaRango(bloque.centrados, fMin, fMax, cMin, cMax);
    renderBloques();
  });
  botones.append(agregarFila, quitarFila, agregarCol, quitarCol, pegarBtn, combinarBtn, separarBtn, centrarBtn, izquierdaBtn);
  cont.appendChild(botones);

  return cont;
}

document.getElementById("agregarTitulo1Btn").addEventListener("click", () => { bloques.push({ tipo: "titulo1", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo2Btn").addEventListener("click", () => { bloques.push({ tipo: "titulo2", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo3Btn").addEventListener("click", () => { bloques.push({ tipo: "titulo3", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo4Btn").addEventListener("click", () => { bloques.push({ tipo: "titulo4", texto: "" }); renderBloques(); });
document.getElementById("agregarParrafoBtn").addEventListener("click", () => { bloques.push({ tipo: "parrafo", texto: "" }); renderBloques(); });
document.getElementById("agregarTablaBtn").addEventListener("click", () => { bloques.push(nuevaTabla()); renderBloques(); });
document.getElementById("agregarImagenBtn").addEventListener("click", () => inputImagen.click());

inputImagen.addEventListener("change", async () => {
  const archivos = [...inputImagen.files];
  const fallidos = [];
  // Si se abrió el selector desde un hueco ("+ Insertar aquí"), las
  // imágenes quedan ahí en vez de siempre al final de la lista.
  let destino = indiceInsertarImagen ?? bloques.length;
  indiceInsertarImagen = null;
  for (const archivo of archivos) {
    try {
      const { blob, previewUrl } = await redimensionarImagen(archivo);
      bloques.splice(destino, 0, { tipo: "imagen", blob, previewUrl, pieDeFoto: "" });
      destino++;
    } catch (err) {
      fallidos.push(archivo.name);
    }
  }
  inputImagen.value = "";
  renderBloques();
  if (fallidos.length) {
    mostrarAlerta(
      `No se pudo leer: ${fallidos.join(", ")}. Si son fotos de iPhone en formato HEIC, conviértelas a JPG o PNG antes de subirlas.`,
      "error"
    );
  }
});

// ---- editor de ítems de cotización ----
let items = [];

function nuevoItem() {
  return { descripcion: "", unidad: "", cantidad: 1, valorUnitario: 0 };
}

// AIU/IVA: si es "obra", Administración/Imprevistos/Utilidad se calculan
// sobre el costo directo y el IVA aplica SOLO sobre la Utilidad; si es
// "servicio", no hay AIU y el IVA aplica sobre el costo directo completo
// (regla de negocio indicada por el usuario, no una constante legal fija
// — los % son ajustables y deben validarse con el contador de la empresa).
function calcularTotales(itemsActuales, tipo, aiu, ivaPct) {
  const costoDirecto = itemsActuales.reduce((acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.valorUnitario) || 0), 0);
  if (tipo === "obra") {
    const administracion = costoDirecto * ((Number(aiu.administracion) || 0) / 100);
    const imprevistos = costoDirecto * ((Number(aiu.imprevistos) || 0) / 100);
    const utilidad = costoDirecto * ((Number(aiu.utilidad) || 0) / 100);
    const ivaValor = utilidad * ((Number(ivaPct) || 0) / 100);
    const total = costoDirecto + administracion + imprevistos + utilidad + ivaValor;
    return { costoDirecto, administracion, imprevistos, utilidad, ivaValor, total };
  }
  const ivaValor = costoDirecto * ((Number(ivaPct) || 0) / 100);
  const total = costoDirecto + ivaValor;
  return { costoDirecto, administracion: 0, imprevistos: 0, utilidad: 0, ivaValor, total };
}

function leerAiu() {
  return {
    administracion: parseFloat(administracionInput.value) || 0,
    imprevistos: parseFloat(imprevistosInput.value) || 0,
    utilidad: parseFloat(utilidadInput.value) || 0
  };
}

function actualizarResumen() {
  const tipo = selectTipo.value;
  aiuBox.classList.toggle("oculto", tipo !== "obra");
  ivaAyuda.textContent = tipo === "obra" ? "aplica solo sobre la Utilidad" : "aplica sobre el costo directo";
  const t = calcularTotales(items, tipo, leerAiu(), parseFloat(ivaInput.value) || 0);
  totalesResumen.textContent = tipo === "obra"
    ? `Costo directo: ${formatoMoneda.format(t.costoDirecto)} · Administración: ${formatoMoneda.format(t.administracion)} · Imprevistos: ${formatoMoneda.format(t.imprevistos)} · Utilidad: ${formatoMoneda.format(t.utilidad)} · IVA: ${formatoMoneda.format(t.ivaValor)} · Total oferta: ${formatoMoneda.format(t.total)}`
    : `Costo directo: ${formatoMoneda.format(t.costoDirecto)} · IVA: ${formatoMoneda.format(t.ivaValor)} · Total oferta: ${formatoMoneda.format(t.total)}`;
}

function renderItemsEditor() {
  itemsEditor.innerHTML = "";
  items.forEach((item, i) => {
    const fila = document.createElement("div");
    fila.className = "control-items-fila";

    // Número de ítem: automático según la posición en la lista, no un
    // campo editable — si se quita o reordena un ítem, se recalcula solo
    // al volver a pintar la lista (no queda un consecutivo "congelado").
    const numSpan = document.createElement("span");
    numSpan.className = "control-items-num";
    numSpan.textContent = String(i + 1);
    fila.appendChild(numSpan);

    const descInput = document.createElement("input");
    descInput.type = "text";
    descInput.maxLength = 300;
    descInput.placeholder = "Descripción del ítem";
    descInput.value = item.descripcion;
    descInput.addEventListener("input", () => { item.descripcion = descInput.value; });
    fila.appendChild(descInput);

    const unidadInput = document.createElement("input");
    unidadInput.type = "text";
    unidadInput.maxLength = 20;
    unidadInput.placeholder = "Unidad (m, kg, global...)";
    unidadInput.className = "control-items-unidad";
    unidadInput.value = item.unidad || "";
    unidadInput.addEventListener("input", () => { item.unidad = unidadInput.value; });
    fila.appendChild(unidadInput);

    const cantInput = document.createElement("input");
    cantInput.type = "number";
    cantInput.min = "0";
    cantInput.step = "any";
    cantInput.placeholder = "Cantidad";
    cantInput.value = item.cantidad;

    const valorInput = document.createElement("input");
    valorInput.type = "number";
    valorInput.min = "0";
    valorInput.step = "any";
    valorInput.placeholder = "Valor unitario";
    valorInput.value = item.valorUnitario;

    const totalSpan = document.createElement("span");
    totalSpan.className = "control-items-total";
    const actualizarTotalFila = () => { totalSpan.textContent = formatoMoneda.format((Number(item.cantidad) || 0) * (Number(item.valorUnitario) || 0)); };
    actualizarTotalFila();

    cantInput.addEventListener("input", () => { item.cantidad = parseFloat(cantInput.value) || 0; actualizarTotalFila(); actualizarResumen(); });
    valorInput.addEventListener("input", () => { item.valorUnitario = parseFloat(valorInput.value) || 0; actualizarTotalFila(); actualizarResumen(); });
    fila.append(cantInput, valorInput, totalSpan);

    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "control-btn-danger";
    quitar.textContent = "Quitar";
    quitar.disabled = items.length <= 1;
    quitar.addEventListener("click", () => { items.splice(i, 1); renderItemsEditor(); actualizarResumen(); });
    fila.appendChild(quitar);

    itemsEditor.appendChild(fila);
  });
}

document.getElementById("agregarItemBtn").addEventListener("click", () => { items.push(nuevoItem()); renderItemsEditor(); actualizarResumen(); });
selectTipo.addEventListener("change", actualizarResumen);
[administracionInput, imprevistosInput, utilidadInput, ivaInput].forEach((el) => el.addEventListener("input", actualizarResumen));
aplicaPolizaCheck.addEventListener("change", () => {
  detallePolizaTextarea.classList.toggle("oculto", !aplicaPolizaCheck.checked);
});

function limpiarFormulario() {
  form.reset();
  bloques = bloquesPorDefecto();
  renderBloques();
  items = [nuevoItem()];
  renderItemsEditor();
  ofertaIdEnEdicion.value = "";
  guardarBtn.textContent = "Guardar";
  cancelarEdicionBtn.classList.add("oculto");
  detallePolizaTextarea.classList.add("oculto");
  document.getElementById("parteSGI").disabled = false;
  ofertaGuardadaActual = null;
  actualizarDescargarBtn();
  actualizarResumen();
}

cancelarEdicionBtn.addEventListener("click", limpiarFormulario);

// ---- listado ----
function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

// paraEditar=true: guarda sobre la misma oferta (mismo radicado).
// paraEditar=false ("Duplicar"): parte de sus datos/bloques/ítems ya
// digitados pero al guardar genera un radicado nuevo.
function cargarEnFormulario(oferta, paraEditar) {
  document.getElementById("titulo").value = oferta.titulo || "";
  selectLinea.value = oferta.lineaServicio || "";
  selectTipo.value = oferta.tipo || "obra";
  document.getElementById("cliente").value = oferta.cliente || "";
  selectContrato.value = oferta.contratoId || "";
  document.getElementById("portada").value = oferta.portada || "oscura";

  bloques = (oferta.bloques || []).map((b) => (
    b.tipo === "tabla" ? { ...b, filas: filasParaEditar(b.filas || []) } : { ...b }
  ));
  renderBloques();

  items = (oferta.items && oferta.items.length ? oferta.items : [nuevoItem()]).map((it) => ({ ...it }));
  renderItemsEditor();

  administracionInput.value = oferta.aiu?.administracion ?? 10;
  imprevistosInput.value = oferta.aiu?.imprevistos ?? 5;
  utilidadInput.value = oferta.aiu?.utilidad ?? 5;
  ivaInput.value = oferta.iva ?? 19;

  aplicaPolizaCheck.checked = !!oferta.condiciones?.aplicaPoliza;
  detallePolizaTextarea.value = oferta.condiciones?.detallePoliza || "";
  detallePolizaTextarea.classList.toggle("oculto", !aplicaPolizaCheck.checked);
  document.getElementById("porcentajeAnticipo").value = oferta.condiciones?.porcentajeAnticipo ?? "";
  document.getElementById("validezDias").value = oferta.condiciones?.validezDias ?? "";
  document.getElementById("formaPago").value = oferta.condiciones?.formaPago || "";
  document.getElementById("otrasCondiciones").value = oferta.condiciones?.otras || "";
  selectFirma.value = oferta.firmaEmail || "";

  actualizarResumen();

  const parteSGI = document.getElementById("parteSGI");
  if (paraEditar) {
    ofertaIdEnEdicion.value = oferta.id;
    guardarBtn.textContent = "Guardar cambios";
    cancelarEdicionBtn.classList.remove("oculto");
    // Solo se bloquea si esta oferta puntual ya tiene un código del SGC
    // guardado (se registró antes) — no por el simple hecho de estar
    // editando. Las ofertas de antes de que existiera esta casilla (o que
    // no se marcaron al crearse) nunca quedaron registradas, así que aquí
    // se debe poder marcar y registrar por primera vez.
    parteSGI.checked = false;
    parteSGI.disabled = !!oferta.codigoSgc;
    ofertaGuardadaActual = oferta;
  } else {
    ofertaIdEnEdicion.value = "";
    guardarBtn.textContent = "Guardar";
    cancelarEdicionBtn.classList.add("oculto");
    parteSGI.disabled = false;
    ofertaGuardadaActual = null;
    mostrarAlerta("Datos cargados desde " + oferta.radicado + " — revisa qué cambiar antes de generar.", "ok");
  }
  actualizarDescargarBtn();
  document.getElementById("nuevaOfertaDetails").open = true;
  document.getElementById("nuevaOfertaDetails").scrollIntoView({ behavior: "smooth" });
}

function renderTabla(ofertas, esGestor) {
  tbody.innerHTML = "";
  sinOfertas.classList.toggle("oculto", ofertas.length > 0);

  ofertas.forEach((of) => {
    const fila = document.createElement("tr");
    fila.appendChild(celda(of.radicado));
    fila.appendChild(celda(of.titulo));
    fila.appendChild(celda(of.cliente || "—"));
    fila.appendChild(celda(of.lineaServicio || "—"));
    fila.appendChild(celda(of.creadoEn ? of.creadoEn.toDate().toLocaleDateString("es-CO") : ""));

    const tdAccion = document.createElement("td");
    tdAccion.className = "control-tabla-acciones";

    const btnPdf = document.createElement("button");
    btnPdf.type = "button";
    btnPdf.className = "control-btn-mini";
    btnPdf.textContent = "PDF";
    btnPdf.addEventListener("click", async () => {
      btnPdf.disabled = true;
      try {
        const pdf = await generarOfertaPDF(of);
        pdf.save(`${of.radicado}.pdf`);
      } finally {
        btnPdf.disabled = false;
      }
    });

    tdAccion.append(btnPdf);

    if (esGestor) {
      const btnEditar = document.createElement("button");
      btnEditar.type = "button";
      btnEditar.className = "control-btn-mini";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", () => cargarEnFormulario(of, true));

      const btnDuplicar = document.createElement("button");
      btnDuplicar.type = "button";
      btnDuplicar.className = "control-btn-mini";
      btnDuplicar.textContent = "Duplicar";
      btnDuplicar.title = "Partir de esta oferta para una nueva (otro cliente u otra cotización), con radicado propio";
      btnDuplicar.addEventListener("click", () => cargarEnFormulario(of, false));

      const btnBorrar = document.createElement("button");
      btnBorrar.type = "button";
      btnBorrar.className = "control-btn-danger";
      btnBorrar.textContent = "Borrar";
      btnBorrar.addEventListener("click", async () => {
        const confirmado = window.confirm(
          `¿Seguro que quieres borrar la oferta ${of.radicado} (${of.titulo})?\n\nEsta acción no se puede deshacer. El radicado no se vuelve a usar para otra oferta.`
        );
        if (!confirmado) return;
        btnBorrar.disabled = true;
        try {
          await deleteDoc(doc(db, "ofertas", of.id));
        } catch (err) {
          mostrarAlerta(err.message || "No se pudo borrar la oferta.", "error");
          btnBorrar.disabled = false;
        }
      });

      tdAccion.append(btnEditar, btnDuplicar, btnBorrar);
    }

    fila.appendChild(tdAccion);
    tbody.appendChild(fila);
  });
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  // Solo admin/coadmin generan/editan ofertas (las reglas de Firestore
  // también lo exigen) — antes cualquier autenticado podía.
  const perfil = await obtenerPerfil(user.email);
  const esGestor = perfil?.estado === "activo" && (perfil?.rol === "admin" || perfil?.rol === "coadmin");
  if (!esGestor) {
    document.getElementById("nuevaOfertaDetails").classList.add("oculto");
    document.getElementById("soloGestorAviso")?.classList.remove("oculto");
  }

  const q = query(collection(db, "ofertas"), orderBy("creadoEn", "desc"));
  onSnapshot(q, (snapshot) => {
    renderTabla(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), esGestor);
  });

  // Contratos: para el select "Contrato relacionado", igual patrón que
  // Informes/Documentos/Correspondencia. Al elegir uno, se traen cliente/
  // tipo/línea de servicio para no volver a digitarlos (sigue siendo
  // editable después).
  const contratosSnap = await getDocs(query(collection(db, "contratos"), orderBy("creadoEn", "desc")));
  const contratosPorId = {};
  contratosSnap.forEach((docSnap) => {
    const c = docSnap.data();
    contratosPorId[docSnap.id] = c;
    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = `${c.codigo || "(sin código)"} — ${truncar(c.nombre)}`;
    selectContrato.appendChild(opt);
  });
  selectContrato.addEventListener("change", () => {
    const c = contratosPorId[selectContrato.value];
    if (!c) return;
    if (c.cliente) document.getElementById("cliente").value = c.cliente;
    if (c.tipo) selectTipo.value = c.tipo;
    if (c.lineaServicio) selectLinea.value = c.lineaServicio;
    actualizarResumen();
  });

  // Empleados autorizados a firmar ofertas (activos) — igual criterio que
  // el resto del módulo, cualquier autenticado puede leer "empleados".
  const empleadosSnap = await getDocs(query(collection(db, "empleados"), orderBy("nombre")));
  const empleadosPorEmail = {};
  empleadosSnap.forEach((docSnap) => {
    const e = docSnap.data();
    if (e.autorizadoOfertas && e.estado === "activo") {
      empleadosPorEmail[docSnap.id] = e;
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = e.cargo ? `${e.nombre} — ${e.cargo}` : e.nombre;
      selectFirma.appendChild(opt);
    }
  });

  limpiarFormulario();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    guardarBtn.disabled = true;
    const enEdicion = !!ofertaIdEnEdicion.value;
    guardarBtn.textContent = "Guardando...";
    alertBox.className = "form-alert";

    try {
      const empleadoFirma = empleadosPorEmail[selectFirma.value];
      if (!empleadoFirma) {
        throw new Error("Elige quién firma la oferta (solo aparecen empleados activos autorizados).");
      }

      // Sube las imágenes del editor antes de guardar el registro.
      const idOferta = ofertaIdEnEdicion.value || doc(collection(db, "ofertas")).id;
      const bloquesFinal = [];
      for (const bloque of bloques) {
        if (bloque.tipo === "imagen" && bloque.blob) {
          // Nombre único de verdad (no un contador 1.jpg/2.jpg que arranca
          // de nuevo en cada guardado): si la oferta ya tenía imágenes de
          // una edición anterior, un contador reiniciado pisa esos archivos
          // en Storage y los deja con un enlace roto — mismo bug que en
          // informes.js.
          const archivoRef = ref(storage, `ofertas/${idOferta}/${crypto.randomUUID()}.jpg`);
          await uploadBytes(archivoRef, bloque.blob);
          const url = await getDownloadURL(archivoRef);
          bloquesFinal.push({ tipo: "imagen", url, pieDeFoto: bloque.pieDeFoto || "" });
        } else if (bloque.tipo === "imagen") {
          bloquesFinal.push({ tipo: "imagen", url: bloque.url, pieDeFoto: bloque.pieDeFoto || "" });
        } else if (bloque.tipo === "tabla") {
          bloquesFinal.push({ ...bloque, filas: filasParaGuardar(bloque.filas) });
        } else {
          bloquesFinal.push(bloque);
        }
      }

      const contratoId = selectContrato.value;
      const contrato = contratoId ? contratosPorId[contratoId] : null;
      const datosBase = {
        titulo: document.getElementById("titulo").value,
        lineaServicio: selectLinea.value,
        tipo: selectTipo.value,
        cliente: document.getElementById("cliente").value,
        contratoId: contratoId || null,
        contratoCodigo: contrato?.codigo || null,
        contratoNombre: contrato?.nombre || null,
        contratoCliente: contrato?.cliente || null,
        contratoNumero: contrato?.numero || null,
        portada: document.getElementById("portada").value || "oscura",
        bloques: bloquesFinal,
        items: items.map((it) => ({ descripcion: it.descripcion, unidad: it.unidad || "", cantidad: Number(it.cantidad) || 0, valorUnitario: Number(it.valorUnitario) || 0 })),
        aiu: leerAiu(),
        iva: parseFloat(ivaInput.value) || 0,
        condiciones: {
          aplicaPoliza: aplicaPolizaCheck.checked,
          detallePoliza: detallePolizaTextarea.value,
          porcentajeAnticipo: parseFloat(document.getElementById("porcentajeAnticipo").value) || 0,
          validezDias: parseInt(document.getElementById("validezDias").value, 10) || 0,
          formaPago: document.getElementById("formaPago").value,
          otras: document.getElementById("otrasCondiciones").value
        },
        firmaEmail: selectFirma.value,
        firmaNombre: empleadoFirma.nombre || "",
        firmaCargo: empleadoFirma.cargo || "",
        firmaUrl: empleadoFirma.firmaUrl || null,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: user.email
      };

      let ofertaFinal;
      if (enEdicion) {
        const ofertaRef = doc(db, "ofertas", idOferta);
        await updateDoc(ofertaRef, datosBase);
        const snap = await getDoc(ofertaRef);
        ofertaFinal = { id: idOferta, ...snap.data() };
      } else {
        const ofertaRef = doc(db, "ofertas", idOferta);
        const contadorRef = doc(db, "contadores", `oferta_${new Date().getFullYear()}`);
        let radicado;
        await runTransaction(db, async (tx) => {
          const contadorSnap = await tx.get(contadorRef);
          const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
          const anio = new Date().getFullYear();
          radicado = `OF-${anio}-${String(siguiente).padStart(3, "0")}`;
          tx.set(contadorRef, { siguiente: siguiente + 1 });
          tx.set(ofertaRef, {
            ...datosBase, radicado, anio, consecutivo: siguiente,
            creadoPor: user.email, creadoEn: serverTimestamp()
          });

          if (contratoId) {
            const refEnContrato = doc(collection(db, "contratos", contratoId, "documentos"));
            tx.set(refEnContrato, {
              codigo: radicado, nombre: datosBase.titulo, tipo: "interno",
              origen: "ofertas", refId: idOferta,
              creadoPor: user.email, creadoEn: serverTimestamp()
            });
          }
        });
        ofertaFinal = { id: idOferta, ...datosBase, radicado, creadoEn: new Date() };
      }

      // Registro en el SGC: transacción aparte (contador propio por
      // área+tipo) — si falla, la oferta ya quedó generada y no se pierde,
      // solo se avisa para registrarla manualmente en Documentos.
      let codigoSgc = "";
      let errorSgc = "";
      if (document.getElementById("parteSGI").checked) {
        try {
          codigoSgc = await registrarDocumentoSGC(db, {
            area: AREA_SGC_OFERTAS, tipo: TIPO_SGC_OFERTAS,
            nombre: datosBase.titulo, origen: "ofertas", refId: idOferta, user
          });
          // Se guarda en la propia oferta para que, si se vuelve a editar
          // más adelante, ya no se ofrezca marcarla de nuevo (evita generar
          // un segundo código para el mismo documento).
          await updateDoc(doc(db, "ofertas", idOferta), { codigoSgc });
          ofertaFinal.codigoSgc = codigoSgc;
        } catch (err) {
          errorSgc = err.message || "error desconocido";
        }
      }

      // Se queda en modo edición sobre esta misma oferta (no limpia el
      // formulario ni lo cierra) — así "Descargar" y "Visualizar" quedan
      // disponibles de una vez. "Cancelar edición" sigue disponible.
      ofertaIdEnEdicion.value = idOferta;
      guardarBtn.textContent = "Guardar cambios";
      cancelarEdicionBtn.classList.remove("oculto");
      document.getElementById("parteSGI").disabled = !!codigoSgc;
      ofertaGuardadaActual = ofertaFinal;
      actualizarDescargarBtn();

      let mensaje = `Oferta ${ofertaFinal.radicado} guardada.`;
      if (codigoSgc) mensaje += ` Registrada en el SGC como ${codigoSgc}.`;
      if (errorSgc) mensaje += ` (No se pudo registrar en el SGC: ${errorSgc} — hazlo manualmente en Documentos.)`;
      mostrarAlerta(mensaje, errorSgc ? "error" : "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo guardar la oferta.", "error");
    } finally {
      guardarBtn.disabled = false;
      guardarBtn.textContent = ofertaIdEnEdicion.value ? "Guardar cambios" : "Guardar";
    }
  });

  // ---- Visualizar: genera el PDF con lo que hay ahora mismo en el
  // formulario, en una pestaña nueva — no sube imágenes ni guarda nada ni
  // gasta un radicado.
  visualizarBtn.addEventListener("click", async () => {
    visualizarBtn.disabled = true;
    visualizarBtn.textContent = "Generando vista previa...";
    try {
      const empleadoFirma = empleadosPorEmail[selectFirma.value];
      const contratoId = selectContrato.value;
      const contrato = contratoId ? contratosPorId[contratoId] : null;
      const bloquesPreview = bloques.map((b) => {
        if (b.tipo === "imagen") return { tipo: "imagen", url: b.url || URL.createObjectURL(b.blob), pieDeFoto: b.pieDeFoto || "" };
        if (b.tipo === "tabla") return { ...b, filas: filasParaGuardar(b.filas) };
        return b;
      });
      const datosPreview = {
        titulo: document.getElementById("titulo").value,
        lineaServicio: selectLinea.value,
        tipo: selectTipo.value,
        cliente: document.getElementById("cliente").value,
        contratoCodigo: contrato?.codigo || null,
        contratoNumero: contrato?.numero || null,
        portada: document.getElementById("portada").value || "oscura",
        bloques: bloquesPreview,
        items: items.map((it) => ({ descripcion: it.descripcion, unidad: it.unidad || "", cantidad: Number(it.cantidad) || 0, valorUnitario: Number(it.valorUnitario) || 0 })),
        aiu: leerAiu(),
        iva: parseFloat(ivaInput.value) || 0,
        condiciones: {
          aplicaPoliza: aplicaPolizaCheck.checked,
          detallePoliza: detallePolizaTextarea.value,
          porcentajeAnticipo: parseFloat(document.getElementById("porcentajeAnticipo").value) || 0,
          validezDias: parseInt(document.getElementById("validezDias").value, 10) || 0,
          formaPago: document.getElementById("formaPago").value,
          otras: document.getElementById("otrasCondiciones").value
        },
        firmaNombre: empleadoFirma?.nombre || "",
        firmaCargo: empleadoFirma?.cargo || "",
        firmaUrl: empleadoFirma?.firmaUrl || null,
        radicado: "VISTA PREVIA — sin guardar"
      };
      const pdf = await generarOfertaPDF(datosPreview);
      window.open(pdf.output("bloburl"), "_blank");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo generar la vista previa.", "error");
    } finally {
      visualizarBtn.disabled = false;
      visualizarBtn.textContent = "Visualizar";
    }
  });

  // ---- Descargar: genera el PDF de la última oferta GUARDADA y la
  // descarga — no vuelve a guardar nada.
  descargarBtn.addEventListener("click", async () => {
    if (!ofertaGuardadaActual) return;
    descargarBtn.disabled = true;
    descargarBtn.textContent = "Generando...";
    try {
      const pdf = await generarOfertaPDF(ofertaGuardadaActual);
      pdf.save(`${ofertaGuardadaActual.radicado}.pdf`);
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo descargar la oferta.", "error");
    } finally {
      descargarBtn.disabled = false;
      descargarBtn.textContent = "Descargar";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
