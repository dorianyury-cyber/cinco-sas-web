import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, deleteDoc, updateDoc, setDoc, runTransaction,
  serverTimestamp, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth } from "./firebase-control.js";
import { generarOfertaPDF } from "./ofertas-pdf.js";
import { registrarDocumentoSGC } from "./documentos-sgc.js";
import { truncar } from "./texto.js";
import { LINEAS_SERVICIO } from "./lineas-servicio.js";

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
const cancelarEdicionBtn = document.getElementById("cancelarEdicionOfertaBtn");
const ofertaIdEnEdicion = document.getElementById("ofertaIdEnEdicion");
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

// Texto de partida para que la oferta no arranque en blanco — cubre "mostrar
// las bondades de Cinco sin descalificar a nadie": experiencia, equipo,
// enfoque en calidad, sin nombrar competencia. Totalmente editable por
// oferta; el usuario ajusta el alcance específico de lo que está cotizando.
function bloquesPorDefecto() {
  return [
    { tipo: "titulo1", texto: "1. Quiénes somos" },
    { tipo: "parrafo", texto: `Cinco S.A.S. es una empresa con más de ${aniosDeTrayectoria()} años de experiencia en construcción, ingeniería y consultoría, con un equipo multidisciplinario de profesionales dedicados a entregar soluciones técnicas confiables, puntuales y respaldadas por un enfoque riguroso de calidad en cada etapa del servicio.` },
    { tipo: "titulo1", texto: "2. Por qué elegir a Cinco S.A.S." },
    { tipo: "parrafo", texto: "Nuestra trayectoria nos permite acompañar a nuestros clientes con seriedad y respaldo técnico real, no solo con una propuesta económica. Contamos con procesos documentados, personal calificado en cada línea de servicio, y un compromiso directo de la gerencia con la calidad y los tiempos de entrega de cada proyecto." },
    { tipo: "titulo1", texto: "3. Alcance del servicio ofertado" },
    { tipo: "parrafo", texto: "Describe aquí el alcance específico de esta oferta: actividades incluidas, entregables, cronograma estimado y cualquier condición técnica particular." },
    { tipo: "titulo1", texto: "4. Valor de la oferta" },
    { tipo: "parrafo", texto: "El detalle de cantidades, precios unitarios y el valor total de esta oferta se presenta en el Anexo 1 — Cotización detallada, al final de este documento." }
  ];
}

function nuevaTabla() {
  return { tipo: "tabla", titulo: "", filas: [["", ""], ["", ""]] };
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

const TITULO_LABEL = { titulo1: "Título 1", titulo2: "Título 2", titulo3: "Título 3" };

function renderBloques() {
  bloquesEditor.innerHTML = "";
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
      const textarea = document.createElement("textarea");
      textarea.rows = 4;
      textarea.placeholder = "Escribe un párrafo...";
      textarea.value = bloque.texto;
      textarea.addEventListener("input", () => { bloque.texto = textarea.value; });
      contenido.appendChild(textarea);
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
  });
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

  const grid = document.createElement("div");
  grid.className = "control-tabla-grid";
  bloque.filas.forEach((fila, fi) => {
    const filaEl = document.createElement("div");
    filaEl.className = "control-tabla-fila";
    fila.forEach((celda, ci) => {
      const celdaInput = document.createElement("input");
      celdaInput.type = "text";
      celdaInput.maxLength = 300;
      celdaInput.value = celda;
      celdaInput.placeholder = fi === 0 ? `Columna ${ci + 1}` : "";
      celdaInput.addEventListener("input", () => { bloque.filas[fi][ci] = celdaInput.value; });
      filaEl.appendChild(celdaInput);
    });
    grid.appendChild(filaEl);
  });
  cont.appendChild(grid);

  const botones = document.createElement("div");
  botones.className = "control-tabla-botones";
  const agregarFila = document.createElement("button");
  agregarFila.type = "button";
  agregarFila.className = "control-btn-mini";
  agregarFila.textContent = "+ Fila";
  agregarFila.addEventListener("click", () => {
    bloque.filas.push(bloque.filas[0].map(() => ""));
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
  quitarCol.disabled = bloque.filas[0].length <= 1;
  quitarCol.addEventListener("click", () => {
    if (bloque.filas[0].length > 1) { bloque.filas.forEach((fila) => fila.pop()); renderBloques(); }
  });
  botones.append(agregarFila, quitarFila, agregarCol, quitarCol);
  cont.appendChild(botones);

  return cont;
}

document.getElementById("agregarTitulo1Btn").addEventListener("click", () => { bloques.push({ tipo: "titulo1", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo2Btn").addEventListener("click", () => { bloques.push({ tipo: "titulo2", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo3Btn").addEventListener("click", () => { bloques.push({ tipo: "titulo3", texto: "" }); renderBloques(); });
document.getElementById("agregarParrafoBtn").addEventListener("click", () => { bloques.push({ tipo: "parrafo", texto: "" }); renderBloques(); });
document.getElementById("agregarTablaBtn").addEventListener("click", () => { bloques.push(nuevaTabla()); renderBloques(); });
document.getElementById("agregarImagenBtn").addEventListener("click", () => inputImagen.click());

inputImagen.addEventListener("change", async () => {
  const archivos = [...inputImagen.files];
  const fallidos = [];
  for (const archivo of archivos) {
    try {
      const { blob, previewUrl } = await redimensionarImagen(archivo);
      bloques.push({ tipo: "imagen", blob, previewUrl, pieDeFoto: "" });
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
  guardarBtn.textContent = "Generar y descargar oferta";
  cancelarEdicionBtn.classList.add("oculto");
  detallePolizaTextarea.classList.add("oculto");
  document.getElementById("parteSGI").disabled = false;
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
    guardarBtn.textContent = "Guardar cambios y descargar";
    cancelarEdicionBtn.classList.remove("oculto");
    // Solo se bloquea si esta oferta puntual ya tiene un código del SGC
    // guardado (se registró antes) — no por el simple hecho de estar
    // editando. Las ofertas de antes de que existiera esta casilla (o que
    // no se marcaron al crearse) nunca quedaron registradas, así que aquí
    // se debe poder marcar y registrar por primera vez.
    parteSGI.checked = false;
    parteSGI.disabled = !!oferta.codigoSgc;
  } else {
    ofertaIdEnEdicion.value = "";
    guardarBtn.textContent = "Generar y descargar oferta";
    cancelarEdicionBtn.classList.add("oculto");
    parteSGI.disabled = false;
    mostrarAlerta("Datos cargados desde " + oferta.radicado + " — revisa qué cambiar antes de generar.", "ok");
  }
  document.getElementById("nuevaOfertaDetails").open = true;
  document.getElementById("nuevaOfertaDetails").scrollIntoView({ behavior: "smooth" });
}

function renderTabla(ofertas) {
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

    tdAccion.append(btnPdf, btnEditar, btnDuplicar, btnBorrar);
    fila.appendChild(tdAccion);
    tbody.appendChild(fila);
  });
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  const q = query(collection(db, "ofertas"), orderBy("creadoEn", "desc"));
  onSnapshot(q, (snapshot) => {
    renderTabla(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    guardarBtn.textContent = enEdicion ? "Guardando..." : "Generando...";
    alertBox.className = "form-alert";

    try {
      const empleadoFirma = empleadosPorEmail[selectFirma.value];
      if (!empleadoFirma) {
        throw new Error("Elige quién firma la oferta (solo aparecen empleados activos autorizados).");
      }

      // Sube las imágenes del editor antes de guardar el registro.
      const idOferta = ofertaIdEnEdicion.value || doc(collection(db, "ofertas")).id;
      const bloquesFinal = [];
      let n = 0;
      for (const bloque of bloques) {
        if (bloque.tipo === "imagen" && bloque.blob) {
          n += 1;
          const archivoRef = ref(storage, `ofertas/${idOferta}/${n}.jpg`);
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

      const pdf = await generarOfertaPDF(ofertaFinal);
      pdf.save(`${ofertaFinal.radicado}.pdf`);

      limpiarFormulario();
      form.closest("details").open = false;
      let mensaje = `Oferta ${ofertaFinal.radicado} generada y descargada.`;
      if (codigoSgc) mensaje += ` Registrada en el SGC como ${codigoSgc}.`;
      if (errorSgc) mensaje += ` (No se pudo registrar en el SGC: ${errorSgc} — hazlo manualmente en Documentos.)`;
      mostrarAlerta(mensaje, errorSgc ? "error" : "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo generar la oferta.", "error");
    } finally {
      guardarBtn.disabled = false;
      guardarBtn.textContent = ofertaIdEnEdicion.value ? "Guardar cambios y descargar" : "Generar y descargar oferta";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
