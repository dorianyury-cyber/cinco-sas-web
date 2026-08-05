import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, deleteDoc, updateDoc, setDoc, runTransaction,
  serverTimestamp, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { generarInformePDF } from "./informes-pdf.js";
import { descargarInformeDocx } from "./informes-docx.js";
import { registrarDocumentoSGC } from "./documentos-sgc.js";
import { truncar } from "./texto.js";
import { crearCampoTextoRico } from "./texto-rico.js";
import {
  normalizarMerges, celdaCombinada, expandirRangoConMerges, quitarMergesQueIntersectan,
  celdaCentrada, normalizarCentrados, centrarRango, alinearIzquierdaRango, anchosColumnaEditor,
  redimensionarFilas
} from "./tabla-celdas.js";

// Área/tipo fijos para que un informe quede en el Listado Maestro de
// Documentos (SGC) sin pedir un campo más en el formulario — el checkbox
// "parteSGI" es la única decisión que toma quien elabora el informe. Área
// AC (Actividades), no SC: el checklist real de contratos (plantillas.js,
// ACTIVIDADES_OBRA/SERVICIO) incluye textualmente "Realización de
// Informes"/"Informe Final" como parte de Actividades.
const AREA_SGC_INFORMES = "AC";
const TIPO_SGC_INFORMES = "INF";

const TIPO_LABEL = {
  gestion: "Informe de gestión", mediciones: "Informe de mediciones",
  consultoria: "Informe de consultoría", interventoria: "Informe de interventoría",
  obra: "Informe de obra", capacitacion: "Informe de capacitación", otro: "Otro"
};

// Cada tipo de informe tiene su propio prefijo de radicado y su propio
// contador (contadores/informe_{PREFIJO}_{año}) — antes todos compartían
// "IG" y un único contador, mezclando mediciones/consultoría/etc. bajo el
// mismo código. "otro" se deja bajo IG por ser el catch-all histórico.
const PREFIJO_TIPO = {
  gestion: "IG", mediciones: "IM", consultoria: "IC",
  interventoria: "II", obra: "IO", capacitacion: "ICAP", otro: "IG"
};

const tbody = document.getElementById("listaInformes");
const sinInformes = document.getElementById("sinInformes");
const form = document.getElementById("nuevoInformeForm");
const alertBox = document.getElementById("crearInformeAlert");
const guardarBtn = document.getElementById("guardarInformeBtn");
const visualizarBtn = document.getElementById("visualizarInformeBtn");
const descargarBtn = document.getElementById("descargarInformeBtn");
const cancelarEdicionBtn = document.getElementById("cancelarEdicionInformeBtn");
const informeIdEnEdicion = document.getElementById("informeIdEnEdicion");

// Último informe guardado con el contenido actual del formulario —
// "Descargar" lo usa para generar el PDF sin volver a guardar. Se limpia
// al empezar uno nuevo/duplicar, y se fija al guardar o al entrar a
// "Editar" (ese informe ya está guardado, se puede descargar de una vez).
let informeGuardadoActual = null;
function actualizarDescargarBtn() {
  descargarBtn.disabled = !informeGuardadoActual;
}
const selectContrato = document.getElementById("contratoRelacionado");
const bloquesEditor = document.getElementById("bloquesEditor");
const inputImagen = document.getElementById("inputImagen");

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Firestore no permite arrays anidados (un array dentro de otro array) —
// bloque.filas en el editor es una cuadrícula string[][] (lo más simple
// para la UI de la tabla), así que antes de guardar cada fila se envuelve
// en un objeto {celdas: [...]}, y al volver a cargar un informe guardado
// (Editar/Duplicar) se desenvuelve otra vez a string[][].
function filasParaGuardar(filas) {
  return filas.map((fila) => ({ celdas: fila }));
}
function filasParaEditar(filas) {
  return filas.map((fila) => (Array.isArray(fila) ? fila : fila.celdas || []));
}

// ---- editor de bloques: título1/título2/título3/párrafo/tabla/imagen,
// reordenables — mismo patrón que Correspondencia, con más tipos de
// bloque porque un informe necesita índice (los títulos) y tablas. ----
let bloques = [];

// ---- deshacer: pila de snapshots de "bloques" tomados justo antes de
// cada acción que agrega/quita/mueve un bloque (o fila/columna de tabla).
// No cubre cada tecla escrita en un texto (sería spam de snapshots que no
// aporta — un texto mal escrito se corrige retipeando), solo los cambios
// estructurales que son fáciles de disparar por error y difíciles de
// notar/revertir a mano (p. ej. "Quitar" el bloque equivocado). ----
let historialBloques = [];
const MAX_HISTORIAL_BLOQUES = 20;
const deshacerBtn = document.getElementById("deshacerBloqueBtn");

function clonarBloques(lista) {
  return lista.map((b) => (
    b.tipo === "tabla"
      ? {
          ...b, filas: b.filas.map((fila) => [...fila]),
          merges: (b.merges || []).map((m) => ({ ...m })),
          centrados: (b.centrados || []).map((c) => ({ ...c }))
        }
      : { ...b }
  ));
}

function guardarHistorialBloques() {
  historialBloques.push(clonarBloques(bloques));
  if (historialBloques.length > MAX_HISTORIAL_BLOQUES) historialBloques.shift();
  deshacerBtn.disabled = false;
}

function reiniciarHistorialBloques() {
  historialBloques = [];
  deshacerBtn.disabled = true;
}

deshacerBtn.addEventListener("click", () => {
  if (!historialBloques.length) return;
  bloques = historialBloques.pop();
  renderBloques();
  deshacerBtn.disabled = historialBloques.length === 0;
});

function nuevaTabla() {
  return { tipo: "tabla", titulo: "", nota: "", filas: [["", ""], ["", ""]], merges: [], centrados: [] };
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
  guardarHistorialBloques();
  [bloques[indice], bloques[destino]] = [bloques[destino], bloques[indice]];
  renderBloques();
}

function quitarBloque(indice) {
  guardarHistorialBloques();
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
  guardarHistorialBloques();
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
    btn.textContent = "+ " + etiqueta;
    btn.title = "Insertar aquí";
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
      const nombre = document.createElement("input");
      nombre.type = "text";
      nombre.maxLength = 200;
      nombre.placeholder = "Nombre de la gráfica (aparece arriba, centrado, y en la Lista de gráficos)";
      nombre.value = bloque.nombre || "";
      nombre.addEventListener("input", () => { bloque.nombre = nombre.value; });
      contenido.appendChild(nombre);
      const img = document.createElement("img");
      img.src = bloque.previewUrl || bloque.url;
      img.className = "control-bloque-imagen";
      img.style.width = `${bloque.tamano || 85}%`;
      contenido.appendChild(img);

      const tamanoFila = document.createElement("div");
      tamanoFila.className = "control-imagen-tamano";
      const tamanoTexto = document.createElement("span");
      tamanoTexto.textContent = `Tamaño en el informe: ${bloque.tamano || 85}%`;
      const tamano = document.createElement("input");
      tamano.type = "range";
      tamano.min = "30";
      tamano.max = "100";
      tamano.step = "5";
      tamano.value = String(bloque.tamano || 85);
      tamano.addEventListener("input", () => {
        bloque.tamano = Number(tamano.value);
        tamanoTexto.textContent = `Tamaño en el informe: ${tamano.value}%`;
        img.style.width = `${tamano.value}%`;
      });
      tamanoFila.append(tamanoTexto, tamano);
      contenido.appendChild(tamanoFila);

      const pie = document.createElement("input");
      pie.type = "text";
      pie.maxLength = 200;
      pie.placeholder = "Pie de página (aparece abajo, alineado a la derecha)";
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
// tabulador, filas por salto de línea) o de una tabla de Word (el navegador
// entrega el mismo formato al copiar). Crece filas/columnas si el pegado no
// cabe en el tamaño actual — igual que pegar un rango en una hoja de
// cálculo, no hay que crear las celdas de antemano.
function pegarEnTabla(bloque, filaInicio, colInicio, texto) {
  const filas = texto.replace(/\r/g, "").split("\n");
  while (filas.length > 1 && filas[filas.length - 1] === "") filas.pop();
  const datos = filas.map((fila) => fila.split("\t"));

  guardarHistorialBloques();
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

// Editor de una tabla: cuadrícula de <input>, con botones para agregar o
// quitar filas/columnas. Se construye de cero en cada render (más simple
// que sincronizar un DOM parcial) — no pesa porque las tablas de un
// informe son de tamaño moderado, no miles de filas.
function renderTablaEditor(bloque) {
  const cont = document.createElement("div");
  cont.className = "control-tabla-editor";

  const tituloInput = document.createElement("input");
  tituloInput.type = "text";
  tituloInput.maxLength = 200;
  tituloInput.placeholder = "Título de la tabla (aparece arriba, centrado, y en la Lista de tablas)";
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
    guardarHistorialBloques();
    redimensionarFilas(bloque.filas, nf, nc);
    renderBloques();
  });
  tamanoDiv.append(labelFilas, labelCols, tamanoBtn);
  cont.appendChild(tamanoDiv);

  const grid = document.createElement("div");
  grid.className = "control-tabla-grid";
  // Ancho de columna proporcional a su contenido (no partes iguales) —
  // mismo criterio que el PDF/Word, ver anchosColumnaEditor.
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
    guardarHistorialBloques();
    bloque.filas.push(new Array(numCols).fill(""));
    renderBloques();
  });
  const quitarFila = document.createElement("button");
  quitarFila.type = "button";
  quitarFila.className = "control-btn-mini";
  quitarFila.textContent = "- Fila";
  quitarFila.disabled = bloque.filas.length <= 1;
  quitarFila.addEventListener("click", () => {
    if (bloque.filas.length > 1) { guardarHistorialBloques(); bloque.filas.pop(); renderBloques(); }
  });
  const agregarCol = document.createElement("button");
  agregarCol.type = "button";
  agregarCol.className = "control-btn-mini";
  agregarCol.textContent = "+ Columna";
  agregarCol.addEventListener("click", () => {
    guardarHistorialBloques();
    bloque.filas.forEach((fila) => fila.push(""));
    renderBloques();
  });
  const quitarCol = document.createElement("button");
  quitarCol.type = "button";
  quitarCol.className = "control-btn-mini";
  quitarCol.textContent = "- Columna";
  quitarCol.disabled = numCols <= 1;
  quitarCol.addEventListener("click", () => {
    if (numCols > 1) { guardarHistorialBloques(); bloque.filas.forEach((fila) => fila.pop()); renderBloques(); }
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
    guardarHistorialBloques();
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
    guardarHistorialBloques();
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
    guardarHistorialBloques();
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
    guardarHistorialBloques();
    bloque.centrados = alinearIzquierdaRango(bloque.centrados, fMin, fMax, cMin, cMax);
    renderBloques();
  });
  botones.append(agregarFila, quitarFila, agregarCol, quitarCol, pegarBtn, combinarBtn, separarBtn, centrarBtn, izquierdaBtn);
  cont.appendChild(botones);

  const notaInput = document.createElement("input");
  notaInput.type = "text";
  notaInput.maxLength = 200;
  notaInput.placeholder = "Nota / pie de tabla (aparece abajo, alineada a la derecha)";
  notaInput.value = bloque.nota || "";
  notaInput.addEventListener("input", () => { bloque.nota = notaInput.value; });
  cont.appendChild(notaInput);

  return cont;
}

document.getElementById("agregarTitulo1Btn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "titulo1", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo2Btn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "titulo2", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo3Btn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "titulo3", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo4Btn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "titulo4", texto: "" }); renderBloques(); });
document.getElementById("agregarParrafoBtn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "parrafo", texto: "" }); renderBloques(); });
document.getElementById("agregarTablaBtn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push(nuevaTabla()); renderBloques(); });
document.getElementById("agregarImagenBtn").addEventListener("click", () => inputImagen.click());

inputImagen.addEventListener("change", async () => {
  const archivos = [...inputImagen.files];
  const fallidos = [];
  // Si se abrió el selector desde un hueco ("+ Insertar aquí"), las
  // imágenes quedan ahí en vez de siempre al final de la lista.
  let destino = indiceInsertarImagen ?? bloques.length;
  indiceInsertarImagen = null;
  if (archivos.length) guardarHistorialBloques();
  for (const archivo of archivos) {
    try {
      const { blob, previewUrl } = await redimensionarImagen(archivo);
      bloques.splice(destino, 0, { tipo: "imagen", blob, previewUrl, nombre: "", pieDeFoto: "" });
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

function limpiarFormulario() {
  form.reset();
  bloques = [];
  reiniciarHistorialBloques();
  renderBloques();
  informeIdEnEdicion.value = "";
  guardarBtn.textContent = "Guardar";
  cancelarEdicionBtn.classList.add("oculto");
  document.getElementById("parteSGI").disabled = false;
  informeGuardadoActual = null;
  actualizarDescargarBtn();
}

cancelarEdicionBtn.addEventListener("click", limpiarFormulario);

// ---- Importar bloques desde JSON ----
// Para reaprovechar un informe ya elaborado en Word (o cualquier otro
// origen): un JSON con { titulo, tipoInforme, mes, firmaNombre,
// firmaCargo, bloques } precarga el formulario en blanco, igual que
// "Duplicar" pero sin partir de un informe que ya esté guardado en el
// sistema. El contrato relacionado se deja para que el usuario lo elija
// él mismo (así trae los datos reales del contrato de Firestore).
document.getElementById("importarJsonBtn").addEventListener("click", () => {
  const textoJson = document.getElementById("importarJsonTexto").value.trim();
  if (!textoJson) return;
  let datos;
  try {
    datos = JSON.parse(textoJson);
  } catch (err) {
    mostrarAlerta("Ese texto no es un JSON válido.", "error");
    return;
  }
  if (!Array.isArray(datos.bloques)) {
    mostrarAlerta('El JSON debe tener un arreglo "bloques".', "error");
    return;
  }

  // Este JSON puede venir escrito a mano o armado por otra herramienta,
  // así que puede llegar incompleto — se valida ANTES de tocar el
  // formulario (para no dejarlo a medio cargar) y con un mensaje que diga
  // cuál bloque falló, en vez de dejar que renderBloques() reviente más
  // adelante al toparse con una tabla sin filas.
  const TIPOS_VALIDOS = ["titulo1", "titulo2", "titulo3", "titulo4", "parrafo", "tabla", "imagen"];
  for (let i = 0; i < datos.bloques.length; i++) {
    const b = datos.bloques[i];
    if (!TIPOS_VALIDOS.includes(b.tipo)) {
      mostrarAlerta(`El bloque #${i + 1} tiene un "tipo" no reconocido ("${b.tipo}"). Corrígelo antes de importar.`, "error");
      return;
    }
    if (b.tipo === "imagen") {
      mostrarAlerta(`El bloque #${i + 1} es de tipo "imagen" — este importador no trae fotos, solo agrégalas manualmente después de importar el resto.`, "error");
      return;
    }
    if (b.tipo === "tabla") {
      const filasValidas = Array.isArray(b.filas) && b.filas.length > 0 &&
        b.filas.every((fila) => Array.isArray(fila) && fila.length > 0);
      if (!filasValidas) {
        mostrarAlerta(`El bloque #${i + 1} es una tabla pero no trae "filas" completas (debe tener al menos una fila y una columna). Corrígelo antes de importar.`, "error");
        return;
      }
    }
  }

  if (datos.titulo) document.getElementById("titulo").value = datos.titulo;
  if (datos.tipoInforme) document.getElementById("tipoInforme").value = datos.tipoInforme;
  if (datos.portada) document.getElementById("portada").value = datos.portada;
  if (datos.mes) document.getElementById("mes").value = datos.mes;
  if (datos.firmaNombre) document.getElementById("firmaNombre").value = datos.firmaNombre;
  if (datos.firmaCargo) document.getElementById("firmaCargo").value = datos.firmaCargo;
  bloques = datos.bloques.map((b) => (b.tipo === "tabla" ? { ...b } : { ...b, texto: b.texto || "" }));
  reiniciarHistorialBloques();
  renderBloques();
  document.getElementById("importarJsonTexto").value = "";
  document.getElementById("importarJsonTexto").closest("details").open = false;
  mostrarAlerta(`Se cargaron ${bloques.length} bloques — falta elegir el "Contrato relacionado" y revisar antes de generar.`, "ok");
});

// ---- listado ----
function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

// paraEditar=true: guarda sobre el mismo informe (mismo radicado).
// paraEditar=false ("Duplicar"): parte de sus datos/bloques ya digitados
// pero al guardar genera un radicado nuevo — para el informe del próximo
// mes del mismo contrato, o uno similar para otro cliente/contrato.
function cargarEnFormulario(informe, paraEditar) {
  document.getElementById("titulo").value = informe.titulo || "";
  document.getElementById("tipoInforme").value = informe.tipoInforme || "gestion";
  document.getElementById("portada").value = informe.portada || "oscura";
  document.getElementById("mes").value = informe.mes || "";
  selectContrato.value = informe.contratoId || "";
  document.getElementById("firmaNombre").value = informe.firmaNombre || "";
  document.getElementById("firmaCargo").value = informe.firmaCargo || "";
  bloques = (informe.bloques || []).map((b) => (
    b.tipo === "tabla" ? { ...b, filas: filasParaEditar(b.filas || []) } : { ...b }
  ));
  reiniciarHistorialBloques();
  renderBloques();
  const parteSGI = document.getElementById("parteSGI");
  if (paraEditar) {
    informeIdEnEdicion.value = informe.id;
    guardarBtn.textContent = "Guardar cambios";
    cancelarEdicionBtn.classList.remove("oculto");
    // Solo se bloquea si este informe puntual ya tiene un código del SGC
    // guardado (se registró antes) — no por el simple hecho de estar
    // editando. Los informes de antes de que existiera esta casilla (o que
    // no se marcaron al crearlos) nunca quedaron registrados, así que aquí
    // se debe poder marcar y registrar por primera vez.
    parteSGI.checked = false;
    parteSGI.disabled = !!informe.codigoSgc;
    // Ya está guardado tal como está — se puede descargar de una vez, sin
    // esperar a que se guarde de nuevo.
    informeGuardadoActual = informe;
  } else {
    informeIdEnEdicion.value = "";
    guardarBtn.textContent = "Guardar";
    cancelarEdicionBtn.classList.add("oculto");
    parteSGI.disabled = false;
    informeGuardadoActual = null;
    mostrarAlerta("Datos cargados desde " + informe.radicado + " — revisa qué cambiar antes de generar.", "ok");
  }
  actualizarDescargarBtn();
  document.getElementById("nuevoInformeDetails").open = true;
  document.getElementById("nuevoInformeDetails").scrollIntoView({ behavior: "smooth" });
}

function renderTabla(informes, esGestor) {
  tbody.innerHTML = "";
  sinInformes.classList.toggle("oculto", informes.length > 0);

  informes.forEach((inf) => {
    const fila = document.createElement("tr");
    fila.appendChild(celda(inf.radicado));
    fila.appendChild(celda(inf.titulo));
    fila.appendChild(celda(inf.contratoCodigo ? `${inf.contratoCodigo} — ${inf.contratoNombre || ""}` : "—"));
    fila.appendChild(celda(inf.creadoEn ? inf.creadoEn.toDate().toLocaleDateString("es-CO") : ""));

    const tdAccion = document.createElement("td");
    tdAccion.className = "control-tabla-acciones";

    const btnPdf = document.createElement("button");
    btnPdf.type = "button";
    btnPdf.className = "control-btn-mini";
    btnPdf.textContent = "PDF";
    btnPdf.addEventListener("click", async () => {
      btnPdf.disabled = true;
      try {
        const pdf = await generarInformePDF(inf);
        pdf.save(`${inf.radicado}.pdf`);
      } finally {
        btnPdf.disabled = false;
      }
    });

    const btnWord = document.createElement("button");
    btnWord.type = "button";
    btnWord.className = "control-btn-mini";
    btnWord.textContent = "Word";
    btnWord.addEventListener("click", async () => {
      btnWord.disabled = true;
      try {
        await descargarInformeDocx(inf);
      } finally {
        btnWord.disabled = false;
      }
    });

    tdAccion.append(btnPdf, btnWord);

    if (esGestor) {
      const btnEditar = document.createElement("button");
      btnEditar.type = "button";
      btnEditar.className = "control-btn-mini";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", () => cargarEnFormulario(inf, true));

      const btnDuplicar = document.createElement("button");
      btnDuplicar.type = "button";
      btnDuplicar.className = "control-btn-mini";
      btnDuplicar.textContent = "Duplicar";
      btnDuplicar.title = "Partir de este informe para uno nuevo (otro mes u otro contrato), con radicado propio";
      btnDuplicar.addEventListener("click", () => cargarEnFormulario(inf, false));

      const btnPortada = document.createElement("button");
      btnPortada.type = "button";
      btnPortada.className = "control-btn-mini";
      const esClara = inf.portada === "clara";
      btnPortada.textContent = esClara ? "Portada oscura" : "Portada clara";
      btnPortada.title = "Cambia el estilo de portada de este informe y descarga el PDF con el nuevo estilo";
      btnPortada.addEventListener("click", async () => {
        btnPortada.disabled = true;
        try {
          const nuevaPortada = esClara ? "oscura" : "clara";
          await updateDoc(doc(db, "informes", inf.id), { portada: nuevaPortada });
          const pdf = await generarInformePDF({ ...inf, portada: nuevaPortada });
          pdf.save(`${inf.radicado}.pdf`);
        } catch (err) {
          mostrarAlerta(err.message || "No se pudo cambiar la portada.", "error");
        } finally {
          btnPortada.disabled = false;
        }
      });

      const btnBorrar = document.createElement("button");
      btnBorrar.type = "button";
      btnBorrar.className = "control-btn-danger";
      btnBorrar.textContent = "Borrar";
      btnBorrar.addEventListener("click", async () => {
        const confirmado = window.confirm(
          `¿Seguro que quieres borrar el informe ${inf.radicado} (${inf.titulo})?\n\nEsta acción no se puede deshacer. El radicado no se vuelve a usar para otro informe.`
        );
        if (!confirmado) return;
        btnBorrar.disabled = true;
        try {
          await deleteDoc(doc(db, "informes", inf.id));
        } catch (err) {
          mostrarAlerta(err.message || "No se pudo borrar el informe.", "error");
          btnBorrar.disabled = false;
        }
      });

      tdAccion.append(btnEditar, btnDuplicar, btnPortada, btnBorrar);
    }

    fila.appendChild(tdAccion);
    tbody.appendChild(fila);
  });
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  // Solo admin/coadmin generan/editan informes (las reglas de Firestore
  // también lo exigen) — antes cualquier autenticado podía, y se estaba
  // volviendo un catálogo sin control real de quién publica qué.
  const perfil = await obtenerPerfil(user.email);
  const esGestor = perfil?.estado === "activo" && (perfil?.rol === "admin" || perfil?.rol === "coadmin");
  if (!esGestor) {
    document.getElementById("nuevoInformeDetails").classList.add("oculto");
    document.getElementById("soloGestorAviso")?.classList.remove("oculto");
  }

  const q = query(collection(db, "informes"), orderBy("creadoEn", "desc"));
  onSnapshot(q, (snapshot) => {
    renderTabla(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), esGestor);
  });

  // orderBy("creadoEn") y no "codigo": los contratos de antes de esa
  // función no tienen "codigo" y quedarían fuera si se ordenara por ese
  // campo. Las reglas de Firestore ya filtran qué contratos ve cada quien.
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

  renderBloques();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    guardarBtn.disabled = true;
    const enEdicion = !!informeIdEnEdicion.value;
    guardarBtn.textContent = "Guardando...";
    alertBox.className = "form-alert";

    try {
      // Sube las imágenes del editor antes de guardar el registro.
      const idInforme = informeIdEnEdicion.value || doc(collection(db, "informes")).id;
      const bloquesFinal = [];
      for (const bloque of bloques) {
        if (bloque.tipo === "imagen" && bloque.blob) {
          // Nombre único de verdad (no un contador 1.jpg/2.jpg que arranca
          // de nuevo en cada guardado): si el informe ya tenía imágenes de
          // una edición anterior, un contador reiniciado pisa esos archivos
          // en Storage y los deja con un enlace roto — pasó en producción.
          const archivoRef = ref(storage, `informes/${idInforme}/${crypto.randomUUID()}.jpg`);
          await uploadBytes(archivoRef, bloque.blob);
          const url = await getDownloadURL(archivoRef);
          bloquesFinal.push({ tipo: "imagen", url, nombre: bloque.nombre || "", pieDeFoto: bloque.pieDeFoto || "", tamano: bloque.tamano || 85 });
        } else if (bloque.tipo === "imagen") {
          bloquesFinal.push({ tipo: "imagen", url: bloque.url, nombre: bloque.nombre || "", pieDeFoto: bloque.pieDeFoto || "", tamano: bloque.tamano || 85 });
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
        tipoInforme: document.getElementById("tipoInforme").value,
        portada: document.getElementById("portada").value || "oscura",
        mes: document.getElementById("mes").value || null,
        firmaNombre: document.getElementById("firmaNombre").value,
        firmaCargo: document.getElementById("firmaCargo").value,
        bloques: bloquesFinal,
        contratoId: contratoId || null,
        contratoCodigo: contrato?.codigo || null,
        contratoNombre: contrato?.nombre || null,
        contratoCliente: contrato?.cliente || null,
        contratoNumero: contrato?.numero || null,
        contratoSupervisor: contrato?.supervisor || null,
        contratoFechaInicio: contrato?.fechaInicio || null,
        contratoFechaFin: contrato?.fechaFin || null,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: user.email
      };

      let informeFinal;
      if (enEdicion) {
        const informeRef = doc(db, "informes", idInforme);
        await updateDoc(informeRef, datosBase);
        const snap = await getDoc(informeRef);
        informeFinal = { id: idInforme, ...snap.data() };
      } else {
        const informeRef = doc(db, "informes", idInforme);
        const anio = new Date().getFullYear();
        const prefijo = PREFIJO_TIPO[datosBase.tipoInforme] || "IG";
        const contadorRef = doc(db, "contadores", `informe_${prefijo}_${anio}`);
        let radicado;
        await runTransaction(db, async (tx) => {
          const contadorSnap = await tx.get(contadorRef);
          let siguiente;
          if (contadorSnap.exists()) {
            siguiente = contadorSnap.data().siguiente;
          } else if (prefijo === "IG") {
            // Migración: hasta ahora todos los informes (incluyendo los
            // mal codificados como IG por ser mediciones/etc.) compartían
            // este contador único. Se continúa desde ahí para no repetir
            // radicados IG ya usados.
            const legacyRef = doc(db, "contadores", `informe_${anio}`);
            const legacySnap = await tx.get(legacyRef);
            siguiente = legacySnap.exists() ? legacySnap.data().siguiente : 1;
          } else {
            siguiente = 1;
          }
          radicado = `${prefijo}-${anio}-${String(siguiente).padStart(3, "0")}`;
          tx.set(contadorRef, { siguiente: siguiente + 1 });
          tx.set(informeRef, {
            ...datosBase, radicado, anio, consecutivo: siguiente,
            creadoPor: user.email, creadoEn: serverTimestamp()
          });

          if (contratoId) {
            const refEnContrato = doc(collection(db, "contratos", contratoId, "documentos"));
            tx.set(refEnContrato, {
              codigo: radicado, nombre: datosBase.titulo, tipo: "interno",
              origen: "informes", refId: idInforme,
              creadoPor: user.email, creadoEn: serverTimestamp()
            });
          }
        });
        informeFinal = { id: idInforme, ...datosBase, radicado, creadoEn: new Date() };
      }

      // Registro en el SGC: se hace en una segunda transacción aparte (no
      // dentro de la de arriba) porque usa su propio contador por
      // área+tipo — si falla, el informe ya quedó generado y no se pierde,
      // solo se avisa para registrarlo manualmente en Documentos.
      let codigoSgc = "";
      let errorSgc = "";
      if (document.getElementById("parteSGI").checked) {
        try {
          codigoSgc = await registrarDocumentoSGC(db, {
            area: AREA_SGC_INFORMES, tipo: TIPO_SGC_INFORMES,
            nombre: datosBase.titulo, origen: "informes", refId: idInforme, user
          });
          // Se guarda en el propio informe para que, si se vuelve a editar
          // más adelante, ya no se ofrezca marcarlo de nuevo (evita generar
          // un segundo código para el mismo documento).
          await updateDoc(doc(db, "informes", idInforme), { codigoSgc });
          informeFinal.codigoSgc = codigoSgc;
        } catch (err) {
          errorSgc = err.message || "error desconocido";
        }
      }

      // Se queda en modo edición sobre este mismo informe (no limpia el
      // formulario ni lo cierra) — así "Descargar" y "Visualizar" quedan
      // disponibles de una vez, sin tener que volver a buscarlo en la
      // tabla. "Cancelar edición" sigue disponible para empezar de cero.
      informeIdEnEdicion.value = idInforme;
      guardarBtn.textContent = "Guardar cambios";
      cancelarEdicionBtn.classList.remove("oculto");
      document.getElementById("parteSGI").disabled = !!codigoSgc;
      informeGuardadoActual = informeFinal;
      actualizarDescargarBtn();

      let mensaje = `Informe ${informeFinal.radicado} guardado.`;
      if (codigoSgc) mensaje += ` Registrado en el SGC como ${codigoSgc}.`;
      if (errorSgc) mensaje += ` (No se pudo registrar en el SGC: ${errorSgc} — hazlo manualmente en Documentos.)`;
      mostrarAlerta(mensaje, errorSgc ? "error" : "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo guardar el informe.", "error");
    } finally {
      guardarBtn.disabled = false;
      guardarBtn.textContent = informeIdEnEdicion.value ? "Guardar cambios" : "Guardar";
    }
  });

  // ---- Visualizar: genera el PDF con lo que hay ahora mismo en el
  // formulario, en una pestaña nueva — no sube imágenes a Storage ni
  // guarda nada ni gasta un radicado, solo para revisar antes de guardar.
  visualizarBtn.addEventListener("click", async () => {
    visualizarBtn.disabled = true;
    visualizarBtn.textContent = "Generando vista previa...";
    try {
      const contratoId = selectContrato.value;
      const contrato = contratoId ? contratosPorId[contratoId] : null;
      const bloquesPreview = bloques.map((b) => {
        if (b.tipo === "imagen") return { tipo: "imagen", url: b.url || URL.createObjectURL(b.blob), nombre: b.nombre || "", pieDeFoto: b.pieDeFoto || "", tamano: b.tamano || 85 };
        if (b.tipo === "tabla") return { ...b, filas: filasParaGuardar(b.filas) };
        return b;
      });
      const datosPreview = {
        titulo: document.getElementById("titulo").value,
        tipoInforme: document.getElementById("tipoInforme").value,
        portada: document.getElementById("portada").value || "oscura",
        mes: document.getElementById("mes").value || null,
        firmaNombre: document.getElementById("firmaNombre").value,
        firmaCargo: document.getElementById("firmaCargo").value,
        bloques: bloquesPreview,
        contratoCodigo: contrato?.codigo || null,
        contratoNombre: contrato?.nombre || null,
        contratoCliente: contrato?.cliente || null,
        contratoNumero: contrato?.numero || null,
        radicado: "VISTA PREVIA — sin guardar"
      };
      const pdf = await generarInformePDF(datosPreview);
      window.open(pdf.output("bloburl"), "_blank");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo generar la vista previa.", "error");
    } finally {
      visualizarBtn.disabled = false;
      visualizarBtn.textContent = "Visualizar";
    }
  });

  // ---- Descargar: genera el PDF del último informe GUARDADO y lo
  // descarga — no vuelve a guardar nada (para eso está "Guardar").
  descargarBtn.addEventListener("click", async () => {
    if (!informeGuardadoActual) return;
    descargarBtn.disabled = true;
    descargarBtn.textContent = "Generando...";
    try {
      const pdf = await generarInformePDF(informeGuardadoActual);
      pdf.save(`${informeGuardadoActual.radicado}.pdf`);
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo descargar el informe.", "error");
    } finally {
      descargarBtn.disabled = false;
      descargarBtn.textContent = "Descargar";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
