import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, deleteDoc, updateDoc, setDoc, runTransaction,
  serverTimestamp, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { generarInformePDF } from "./informes-pdf.js";
import { descargarInformeDocx } from "./informes-docx.js";
import { registrarDocumentoSGC } from "./documentos-sgc.js";
import { truncar, fechaLocalISO } from "./texto.js";
import { mejorarSelectorContrato } from "./selector-contrato.js";
import { botonVerPdf } from "./adjuntos.js";
import { crearCampoTextoRico } from "./texto-rico.js";
import { crearEditorTabla, nuevaTabla } from "./editor-tabla.js";

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
  obra: "Informe de obra", capacitacion: "Informe de capacitación",
  revisionDisenos: "Revisión de diseños eléctricos", otro: "Otro"
};

// Cada tipo de informe tiene su propio prefijo de radicado y su propio
// contador (contadores/informe_{PREFIJO}_{año}) — antes todos compartían
// "IG" y un único contador, mezclando mediciones/consultoría/etc. bajo el
// mismo código. "otro" se deja bajo IG por ser el catch-all histórico.
const PREFIJO_TIPO = {
  gestion: "IG", mediciones: "IM", consultoria: "IC",
  interventoria: "II", obra: "IO", capacitacion: "ICAP",
  revisionDisenos: "RD", otro: "IG"
};

const tbody = document.getElementById("listaInformes");
const sinInformes = document.getElementById("sinInformes");
const form = document.getElementById("nuevoInformeForm");
const alertBox = document.getElementById("crearInformeAlert");
// Cada informe tiene dos juegos de estos tres botones (arriba y abajo del
// formulario, ver informes.html) para no obligar a bajar hasta el final en
// informes largos — se guardan como arreglo y cada cambio de texto/disabled
// se aplica a los dos con forEach, así quedan siempre sincronizados.
const guardarBtn = [...document.querySelectorAll(".js-guardar-informe")];
const visualizarBtn = [...document.querySelectorAll(".js-visualizar-informe")];
const descargarBtn = [...document.querySelectorAll(".js-descargar-informe")];
function setTexto(btns, texto) { btns.forEach((b) => { b.textContent = texto; }); }
function setDisabled(btns, valor) { btns.forEach((b) => { b.disabled = valor; }); }
const cancelarEdicionBtn = document.getElementById("cancelarEdicionInformeBtn");
const informeIdEnEdicion = document.getElementById("informeIdEnEdicion");

// Último informe guardado con el contenido actual del formulario —
// "Descargar" lo usa para generar el PDF sin volver a guardar. Se limpia
// al empezar uno nuevo/duplicar, y se fija al guardar o al entrar a
// "Editar" (ese informe ya está guardado, se puede descargar de una vez).
let informeGuardadoActual = null;
function actualizarDescargarBtn() {
  setDisabled(descargarBtn, !informeGuardadoActual);
}
const selectContrato = document.getElementById("contratoRelacionado");
const bloquesEditor = document.getElementById("bloquesEditor");
const inputImagen = document.getElementById("inputImagen");

// "💾 Guardar avance" de cada bloque: dispara el mismo guardado del botón
// Guardar (form submit) y refleja el resultado en ese botón.
function guardarDesdeBloque(boton) {
  if (boton.disabled) return;
  // Si falta un campo obligatorio (ej. el título) el navegador no dispara el
  // guardado: se muestra qué falta en vez de dejar el botón en "Guardando...".
  if (!form.checkValidity()) { form.reportValidity(); return; }
  boton.disabled = true;
  boton.textContent = "Guardando...";
  form.addEventListener("informe-guardado", (e) => {
    boton.textContent = e.detail.ok ? "✅ Guardado" : "⚠️ No se guardó";
    setTimeout(() => { boton.disabled = false; boton.textContent = "💾 Guardar avance"; }, 2500);
  }, { once: true });
  form.requestSubmit();
}

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

function hoyISO() {
  return fechaLocalISO();
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
  return lista.map((b) => {
    if (b.tipo === "tabla") {
      return {
        ...b, filas: b.filas.map((fila) => [...fila]),
        merges: (b.merges || []).map((m) => ({ ...m })),
        centrados: (b.centrados || []).map((c) => ({ ...c }))
      };
    }
    if (b.tipo === "firma") {
      return { ...b, firmantes: (b.firmantes || []).map((f) => ({ ...f })) };
    }
    return { ...b };
  });
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

// Bloque de firma: reemplaza la tabla-con-celda-vacía que se venía usando
// a mano para "Elaboró"/"Aprobó" (quedaba como una tabla más, sin espacio
// real para firmar) por una línea de firma dibujada arriba del nombre —
// admite varios firmantes en fila (ej. todo el equipo que "Elaboró") o uno
// solo (ej. "Aprobó").
function nuevaFirma() {
  return { tipo: "firma", etiqueta: "Aprobó", firmantes: [{ nombre: "", cargo: "" }] };
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
  { tipo: "imagen", etiqueta: "Gráfico / imagen" },
  { tipo: "firma", etiqueta: "Bloque de firma" }
];

// Mientras se espera el selector de archivo, en qué hueco insertar la(s)
// imagen(es) elegidas — el input de archivo es uno solo, compartido con
// el botón "+ Gráfico / imagen" de la barra de abajo.
let indiceInsertarImagen = null;

function crearBloquePorTipo(tipo) {
  if (tipo === "tabla") return nuevaTabla();
  if (tipo === "firma") return nuevaFirma();
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
  // Numeración en vivo: mismo criterio que numeroTitulo()/numeroTabla/
  // numeroFigura en informes-pdf.js — para que se pueda ver, mientras se
  // arma el informe, qué número le va a tocar a cada título/tabla/gráfico
  // en el documento final (útil para detectar un bloque fuera de orden o
  // ubicarse rápido en un informe largo), sin tener que generar el PDF.
  const contadoresTitulo = [0, 0, 0, 0];
  let numeroTablaVista = 0;
  let numeroFiguraVista = 0;

  bloques.forEach((bloque, i) => {
    const fila = document.createElement("div");
    fila.className = "control-bloque";

    const contenido = document.createElement("div");
    contenido.className = "control-bloque-contenido";

    let numeroVista = "";
    if (bloque.tipo in TITULO_LABEL) {
      const nivel = Number(bloque.tipo.slice(-1));
      contadoresTitulo[nivel - 1] += 1;
      for (let k = nivel; k < contadoresTitulo.length; k++) contadoresTitulo[k] = 0;
      numeroVista = contadoresTitulo.slice(0, nivel).join(".") + ".";
    } else if (bloque.tipo === "tabla") {
      numeroTablaVista += 1;
      numeroVista = `Tabla ${numeroTablaVista}`;
    } else if (bloque.tipo === "imagen") {
      numeroFiguraVista += 1;
      numeroVista = `Figura ${numeroFiguraVista}`;
    }

    if (bloque.tipo in TITULO_LABEL) {
      const etiqueta = document.createElement("span");
      etiqueta.className = "control-bloque-etiqueta";
      etiqueta.textContent = `${TITULO_LABEL[bloque.tipo]} · ${numeroVista}`;
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
      const etiquetaTabla = document.createElement("span");
      etiquetaTabla.className = "control-bloque-etiqueta";
      etiquetaTabla.textContent = numeroVista;
      contenido.appendChild(etiquetaTabla);
      contenido.appendChild(crearEditorTabla(bloque, { antesDeCambiar: guardarHistorialBloques, alCambiar: renderBloques, avisar: mostrarAlerta }));
    } else if (bloque.tipo === "firma") {
      contenido.appendChild(renderFirmaEditor(bloque));
    } else {
      const etiquetaImagen = document.createElement("span");
      etiquetaImagen.className = "control-bloque-etiqueta";
      etiquetaImagen.textContent = numeroVista;
      contenido.appendChild(etiquetaImagen);
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
    // "Guardar avance" junto a cada bloque (mismo patrón que Informes de
    // Gestión en Cinco Conecta): guarda todo el informe sin salir del
    // bloque que se está editando, y muestra el resultado en el propio
    // botón porque el aviso general queda lejos, arriba del formulario.
    const guardarAqui = document.createElement("button");
    guardarAqui.type = "button";
    guardarAqui.className = "control-btn-mini";
    guardarAqui.textContent = "💾 Guardar avance";
    guardarAqui.title = "Guarda todo el informe y sigue editando aquí";
    guardarAqui.addEventListener("click", () => guardarDesdeBloque(guardarAqui));
    controles.append(subir, bajar, quitar, guardarAqui);
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
// Editor de un bloque de firma: etiqueta (Elaboró/Aprobó/Revisó...) + uno o
// varios firmantes en fila, cada uno con nombre y cargo — el PDF/Word
// dibujan una línea de firma arriba del nombre de cada uno (ver
// dibujarFirma en informes-pdf.js).
function renderFirmaEditor(bloque) {
  const cont = document.createElement("div");
  cont.className = "control-firma-editor";

  const etiquetaInput = document.createElement("input");
  etiquetaInput.type = "text";
  etiquetaInput.maxLength = 40;
  etiquetaInput.placeholder = "Etiqueta (ej. Elaboró, Aprobó, Revisó)";
  etiquetaInput.value = bloque.etiqueta || "";
  etiquetaInput.addEventListener("input", () => { bloque.etiqueta = etiquetaInput.value; });
  cont.appendChild(etiquetaInput);

  if (!bloque.firmantes || !bloque.firmantes.length) bloque.firmantes = [{ nombre: "", cargo: "" }];

  const lista = document.createElement("div");
  lista.className = "control-firma-firmantes";
  bloque.firmantes.forEach((firmante, fi) => {
    const filaFirmante = document.createElement("div");
    filaFirmante.className = "control-firma-firmante";

    const nombreInput = document.createElement("input");
    nombreInput.type = "text";
    nombreInput.maxLength = 120;
    nombreInput.placeholder = "Nombre";
    nombreInput.value = firmante.nombre || "";
    nombreInput.addEventListener("input", () => { firmante.nombre = nombreInput.value; });

    const cargoInput = document.createElement("input");
    cargoInput.type = "text";
    cargoInput.maxLength = 120;
    cargoInput.placeholder = "Cargo";
    cargoInput.value = firmante.cargo || "";
    cargoInput.addEventListener("input", () => { firmante.cargo = cargoInput.value; });

    filaFirmante.append(nombreInput, cargoInput);

    const firmaWrap = document.createElement("div");
    firmaWrap.className = "control-firma-imagen-wrap";
    const previewFirma = firmante.firmaPreviewUrl || firmante.firmaUrl;
    if (previewFirma) {
      const imgFirma = document.createElement("img");
      imgFirma.src = previewFirma;
      imgFirma.className = "control-firma-imagen-preview";
      firmaWrap.appendChild(imgFirma);

      const tamanoLabel = document.createElement("label");
      tamanoLabel.className = "control-firma-tamano";
      tamanoLabel.textContent = "Tamaño (mm): ";
      const tamanoInput = document.createElement("input");
      tamanoInput.type = "number";
      tamanoInput.min = "6";
      tamanoInput.max = "60";
      tamanoInput.step = "1";
      tamanoInput.value = firmante.altoFirma || 14;
      tamanoInput.title = "Alto de la firma en mm. Pasado el tamaño normal, la firma empieza a montarse sobre el contenido de arriba (como un sello real) en vez de solo ocupar más espacio en blanco.";
      tamanoInput.addEventListener("input", () => { firmante.altoFirma = Number(tamanoInput.value) || 14; });
      tamanoLabel.appendChild(tamanoInput);
      firmaWrap.appendChild(tamanoLabel);
    }
    const inputFirmaImg = document.createElement("input");
    inputFirmaImg.type = "file";
    inputFirmaImg.accept = "image/*";
    inputFirmaImg.hidden = true;
    inputFirmaImg.addEventListener("change", () => {
      const archivo = inputFirmaImg.files[0];
      if (!archivo) return;
      guardarHistorialBloques();
      firmante.firmaBlob = archivo;
      firmante.firmaPreviewUrl = URL.createObjectURL(archivo);
      firmante.firmaUrl = null;
      renderBloques();
    });
    const btnFirmaImg = document.createElement("button");
    btnFirmaImg.type = "button";
    btnFirmaImg.className = "control-btn-mini";
    btnFirmaImg.textContent = previewFirma ? "Cambiar firma digital" : "+ Firma digital";
    btnFirmaImg.title = "Sube una imagen de la firma (ej. escaneada o recortada de un PDF firmado) para que salga arriba del nombre, en vez de dejar el espacio en blanco para firmar a mano";
    btnFirmaImg.addEventListener("click", () => inputFirmaImg.click());
    firmaWrap.append(btnFirmaImg, inputFirmaImg);
    if (previewFirma) {
      const quitarFirmaImgBtn = document.createElement("button");
      quitarFirmaImgBtn.type = "button";
      quitarFirmaImgBtn.className = "control-btn-mini";
      quitarFirmaImgBtn.textContent = "Quitar firma digital";
      quitarFirmaImgBtn.addEventListener("click", () => {
        guardarHistorialBloques();
        firmante.firmaBlob = null;
        firmante.firmaPreviewUrl = null;
        firmante.firmaUrl = null;
        renderBloques();
      });
      firmaWrap.appendChild(quitarFirmaImgBtn);
    }
    filaFirmante.appendChild(firmaWrap);

    if (bloque.firmantes.length > 1) {
      const quitarBtn = document.createElement("button");
      quitarBtn.type = "button";
      quitarBtn.className = "control-btn-danger";
      quitarBtn.textContent = "Quitar";
      quitarBtn.addEventListener("click", () => {
        guardarHistorialBloques();
        bloque.firmantes.splice(fi, 1);
        renderBloques();
      });
      filaFirmante.appendChild(quitarBtn);
    }

    lista.appendChild(filaFirmante);
  });
  cont.appendChild(lista);

  const agregarBtn = document.createElement("button");
  agregarBtn.type = "button";
  agregarBtn.className = "control-btn-mini";
  agregarBtn.textContent = "+ Firmante";
  agregarBtn.title = "Para varios firmantes en la misma fila (ej. todo el equipo que elaboró)";
  agregarBtn.addEventListener("click", () => {
    guardarHistorialBloques();
    bloque.firmantes.push({ nombre: "", cargo: "" });
    renderBloques();
  });
  cont.appendChild(agregarBtn);

  return cont;
}

document.getElementById("agregarTitulo1Btn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "titulo1", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo2Btn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "titulo2", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo3Btn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "titulo3", texto: "" }); renderBloques(); });
document.getElementById("agregarTitulo4Btn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "titulo4", texto: "" }); renderBloques(); });
document.getElementById("agregarParrafoBtn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push({ tipo: "parrafo", texto: "" }); renderBloques(); });
document.getElementById("agregarTablaBtn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push(nuevaTabla()); renderBloques(); });
document.getElementById("agregarFirmaBtn").addEventListener("click", () => { guardarHistorialBloques(); bloques.push(nuevaFirma()); renderBloques(); });
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
  setTexto(guardarBtn, "Guardar");
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
  const TIPOS_VALIDOS = ["titulo1", "titulo2", "titulo3", "titulo4", "parrafo", "tabla", "imagen", "firma"];
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

  // Importar siempre arranca un informe nuevo: después de guardar, el
  // formulario se queda en edición sobre el informe recién guardado, y si
  // no se sale de ahí el "Guardar" pisaba ese informe (mismo radicado) con
  // el contenido importado — pasó en producción con dos RD seguidos.
  limpiarFormulario();
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

// ---- versión final (Word corregido a mano y vuelto a subir) ----
// El PDF/Word automáticos ajustan la maqueta bien la mayoría de las veces,
// pero algunas combinaciones de imágenes/tablas dejan espacios en blanco
// que solo se corrigen a mano en Word (reacomodar una figura, forzar un
// salto de página, etc.) — en vez de perder esa corrección cada vez que se
// vuelve a generar, el informe puede tener un archivo "final" ya corregido
// que reemplaza al automático como lo que de verdad se entrega.
async function subirArchivoFinal(inf, file) {
  // Un solo nivel bajo informes/{id}/ (prefijo "final__", no subcarpeta):
  // las reglas de Storage solo dejan pasar informes/{informeId}/{archivo},
  // un único segmento — igual que las imágenes del cuerpo del informe.
  const archivoRef = ref(storage, `informes/${inf.id}/final__${crypto.randomUUID()}-${file.name}`);
  await uploadBytes(archivoRef, file);
  const url = await getDownloadURL(archivoRef);
  await updateDoc(doc(db, "informes", inf.id), {
    archivoFinalUrl: url,
    archivoFinalRuta: archivoRef.fullPath,
    archivoFinalNombre: file.name,
    archivoFinalSubidoEn: serverTimestamp(),
    archivoFinalSubidoPor: auth.currentUser.email
  });
}

async function quitarArchivoFinal(inf) {
  if (inf.archivoFinalRuta) {
    try { await deleteObject(ref(storage, inf.archivoFinalRuta)); } catch (e) { /* si ya no existe, no pasa nada */ }
  }
  await updateDoc(doc(db, "informes", inf.id), {
    archivoFinalUrl: null, archivoFinalRuta: null, archivoFinalNombre: null,
    archivoFinalSubidoEn: null, archivoFinalSubidoPor: null
  });
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
  document.getElementById("fecha").value = informe.fecha || "";
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
    setTexto(guardarBtn, "Guardar cambios");
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
    setTexto(guardarBtn, "Guardar");
    cancelarEdicionBtn.classList.add("oculto");
    parteSGI.disabled = false;
    informeGuardadoActual = null;
    mostrarAlerta("Datos cargados desde " + informe.radicado + " — revisa qué cambiar antes de generar.", "ok");
  }
  actualizarDescargarBtn();
  document.getElementById("nuevoInformeDetails").open = true;
  document.getElementById("nuevoInformeDetails").scrollIntoView({ behavior: "smooth" });
}

// Listado con panel de vista previa arriba (mismo patrón de Ofertas): la fila solo sirve
// para escanear y seleccionar; los datos completos y las acciones van en el panel. Se
// selecciona sola la fila 1 al cargar y cuando la seleccionada deja de existir.
const vistaPreviaInformeEl = document.getElementById("informeVistaPrevia");
let informesListaActual = [];
let informeSeleccionadoId = null;
let esGestorInformesActual = false;

function escapeHtmlInf(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderTabla(informes, esGestor) {
  informesListaActual = informes;
  esGestorInformesActual = esGestor;
  tbody.innerHTML = "";
  sinInformes.classList.toggle("oculto", informes.length > 0);
  if (!informeSeleccionadoId || !informes.some((x) => x.id === informeSeleccionadoId)) {
    informeSeleccionadoId = informes[0]?.id || null;
  }
  informes.forEach((inf) => {
    const fila = document.createElement("tr");
    fila.dataset.id = inf.id;
    fila.appendChild(celda(inf.radicado));
    const tdTitulo = celda(`${inf.archivoFinalUrl ? "⭐ " : ""}${inf.titulo || ""}`);
    tdTitulo.title = inf.titulo || "";
    fila.appendChild(tdTitulo);
    const contrato = inf.contratoCodigo ? `${inf.contratoCodigo} — ${inf.contratoNombre || ""}` : "—";
    const tdContrato = celda(contrato);
    tdContrato.title = contrato;
    fila.appendChild(tdContrato);
    fila.appendChild(celda(inf.creadoEn ? inf.creadoEn.toDate().toLocaleDateString("es-CO") : ""));
    fila.addEventListener("click", () => {
      informeSeleccionadoId = inf.id;
      actualizarResaltadoInforme();
      pintarVistaPreviaInforme();
    });
    tbody.appendChild(fila);
  });
  actualizarResaltadoInforme();
  pintarVistaPreviaInforme();
}

function actualizarResaltadoInforme() {
  tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.classList.toggle("control-fila-fijada", tr.dataset.id === informeSeleccionadoId);
  });
}

function pintarVistaPreviaInforme() {
  const inf = informesListaActual.find((x) => x.id === informeSeleccionadoId);
  if (!inf) {
    vistaPreviaInformeEl.innerHTML = '<p class="text-muted" style="margin:0;">Todavía no hay informes registrados.</p>';
    return;
  }
  const esGestor = esGestorInformesActual;
  const campo = (etiqueta, valor) => `
    <div class="control-vp-campo">
      <span class="control-vp-etiqueta">${etiqueta}</span>
      <span class="control-vp-valor">${escapeHtmlInf(valor || "-")}</span>
    </div>`;
  const grupo = (titulo, camposHtml) => `
    <div class="control-vp-grupo">
      <div class="control-vp-grupo-titulo">${titulo}</div>
      <div class="control-vp-grupo-campos">${camposHtml}</div>
    </div>`;
  const bloques = inf.bloques || [];
  const titulos = bloques.filter((x) => x.tipo === "titulo1").length;
  const tablas = bloques.filter((x) => x.tipo === "tabla").length;
  vistaPreviaInformeEl.innerHTML = `
    <div class="control-vp-encabezado">
      <span class="control-vp-titulo">${escapeHtmlInf(inf.radicado)} — ${escapeHtmlInf(inf.titulo)}</span>
      <div class="control-vp-acciones" id="informeVpAcciones"></div>
    </div>
    <div class="control-vp-grupos">
      ${grupo("Informe", `
        ${campo("Tipo", TIPO_LABEL[inf.tipoInforme] || inf.tipoInforme)}
        ${campo("Fecha", inf.creadoEn ? inf.creadoEn.toDate().toLocaleDateString("es-CO") : "")}
        ${campo("Mes", inf.mes)}
        ${campo("Portada", inf.portada === "clara" ? "Clara" : "Oscura")}
      `)}
      ${grupo("Contrato", `
        ${campo("Contrato", inf.contratoCodigo)}
        ${campo("Objeto", inf.contratoNombre)}
        ${campo("Cliente", inf.contratoCliente || inf.cliente)}
      `)}
      ${grupo("Contenido", `
        ${campo("Capítulos", String(titulos))}
        ${campo("Tablas", String(tablas))}
        ${campo("Bloques", String(bloques.length))}
        ${campo("Versión final", inf.archivoFinalUrl ? "Subida (reemplaza al PDF/Word automáticos)" : "No")}
      `)}
      ${grupo("Firma", `
        ${campo("Elabora", inf.firmaNombre)}
        ${campo("Cargo", inf.firmaCargo)}
      `)}
    </div>`;
  const tdAccion = document.getElementById("informeVpAcciones");

  const tieneFinal = !!inf.archivoFinalUrl;

  // Visualizador: el informe en PDF dentro de una ventana grande, sin tener
  // que descargarlo (mismo visor de los documentos adjuntos del contrato).
  // Si hay versión final en PDF se muestra esa, que es la que se entregó.
  const finalEsPdf = tieneFinal && inf.archivoFinalRuta && /\.pdf$/i.test(inf.archivoFinalNombre || inf.archivoFinalRuta);
  tdAccion.appendChild(botonVerPdf({
    texto: finalEsPdf ? "👁 Ver versión final" : "👁 Ver",
    titulo: `${inf.radicado} — ${inf.titulo || ""}`,
    nombreArchivo: finalEsPdf ? inf.archivoFinalNombre : `${inf.radicado}.pdf`,
    obtenerBlob: finalEsPdf
      ? () => getBlob(ref(storage, inf.archivoFinalRuta))
      : async () => (await generarInformePDF(inf)).output("blob")
  }));

  if (tieneFinal) {
    const btnFinal = document.createElement("a");
    btnFinal.href = inf.archivoFinalUrl;
    btnFinal.target = "_blank";
    btnFinal.rel = "noopener";
    btnFinal.className = "btn-outline";
    btnFinal.textContent = "⭐ Descargar versión final";
    tdAccion.appendChild(btnFinal);
  }

  const btnPdf = document.createElement("button");
  btnPdf.type = "button";
  btnPdf.className = "control-btn-mini";
  btnPdf.textContent = tieneFinal ? "PDF (automático)" : "PDF";
  btnPdf.title = tieneFinal ? "Genera el PDF a partir del contenido por bloques, sin las correcciones manuales de la versión final" : "";
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
  btnWord.textContent = tieneFinal ? "Word (automático)" : "Word";
  btnWord.title = tieneFinal ? "Genera el Word a partir del contenido por bloques, sin las correcciones manuales de la versión final" : "";
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
    const inputFinal = document.createElement("input");
    inputFinal.type = "file";
    inputFinal.accept = ".doc,.docx,.pdf";
    inputFinal.hidden = true;
    inputFinal.addEventListener("change", async () => {
      const archivo = inputFinal.files[0];
      inputFinal.value = "";
      if (!archivo) return;
      btnSubirFinal.disabled = true;
      btnSubirFinal.textContent = "Subiendo...";
      try {
        await subirArchivoFinal(inf, archivo);
      } catch (err) {
        mostrarAlerta(err.message || "No se pudo subir el archivo.", "error");
      } finally {
        btnSubirFinal.disabled = false;
        btnSubirFinal.textContent = tieneFinal ? "Reemplazar versión final" : "Subir versión final (Word/PDF)";
      }
    });

    const btnSubirFinal = document.createElement("button");
    btnSubirFinal.type = "button";
    btnSubirFinal.className = "control-btn-mini";
    btnSubirFinal.textContent = tieneFinal ? "Reemplazar versión final" : "Subir versión final (Word/PDF)";
    btnSubirFinal.title = "Sube el Word (o PDF) ya corregido a mano — mientras esté subido, reemplaza al PDF/Word automáticos como lo que se entrega.";
    btnSubirFinal.addEventListener("click", () => inputFinal.click());

    tdAccion.append(btnSubirFinal, inputFinal);

    if (tieneFinal) {
      const btnQuitarFinal = document.createElement("button");
      btnQuitarFinal.type = "button";
      btnQuitarFinal.className = "control-btn-mini";
      btnQuitarFinal.textContent = "Quitar versión final";
      btnQuitarFinal.addEventListener("click", async () => {
        const confirmado = window.confirm(`¿Quitar la versión final de "${inf.titulo}"? Vuelve a quedar el PDF/Word generado automáticamente.`);
        if (!confirmado) return;
        btnQuitarFinal.disabled = true;
        try {
          await quitarArchivoFinal(inf);
        } catch (err) {
          mostrarAlerta(err.message || "No se pudo quitar el archivo.", "error");
          btnQuitarFinal.disabled = false;
        }
      });
      tdAccion.appendChild(btnQuitarFinal);
    }

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
  // Visible a cualquier empleado activo (no solo a quien tenga el permiso
  // general) — puede ser responsable/personal asignado de una orden
  // puntual sin ser "autorizado" al módulo completo, ver contratos.js.
  document.getElementById("navOrdenesTrabajo")?.classList.toggle("oculto", perfil?.estado !== "activo");


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
  mejorarSelectorContrato(selectContrato, contratosPorId);

  renderBloques();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let guardadoOk = false;
    setDisabled(guardarBtn, true);
    const enEdicion = !!informeIdEnEdicion.value;
    setTexto(guardarBtn, "Guardando...");
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
        } else if (bloque.tipo === "firma") {
          const firmantes = [];
          for (const firmante of bloque.firmantes || []) {
            let firmaUrl = firmante.firmaUrl || null;
            if (firmante.firmaBlob) {
              const archivoRef = ref(storage, `informes/${idInforme}/${crypto.randomUUID()}.png`);
              await uploadBytes(archivoRef, firmante.firmaBlob);
              firmaUrl = await getDownloadURL(archivoRef);
            }
            firmantes.push({ nombre: firmante.nombre || "", cargo: firmante.cargo || "", firmaUrl, altoFirma: firmante.altoFirma || 14 });
          }
          bloquesFinal.push({ tipo: "firma", etiqueta: bloque.etiqueta || "", firmantes });
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
        fecha: document.getElementById("fecha").value || null,
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
      setTexto(guardarBtn, "Guardar cambios");
      cancelarEdicionBtn.classList.remove("oculto");
      document.getElementById("parteSGI").disabled = !!codigoSgc;
      informeGuardadoActual = informeFinal;
      actualizarDescargarBtn();

      let mensaje = `Informe ${informeFinal.radicado} guardado.`;
      if (codigoSgc) mensaje += ` Registrado en el SGC como ${codigoSgc}.`;
      if (errorSgc) mensaje += ` (No se pudo registrar en el SGC: ${errorSgc} — hazlo manualmente en Documentos.)`;
      mostrarAlerta(mensaje, errorSgc ? "error" : "ok");
      guardadoOk = true;
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo guardar el informe.", "error");
    } finally {
      setDisabled(guardarBtn, false);
      setTexto(guardarBtn, informeIdEnEdicion.value ? "Guardar cambios" : "Guardar");
      form.dispatchEvent(new CustomEvent("informe-guardado", { detail: { ok: guardadoOk } }));
    }
  });

  // ---- Visualizar: genera el PDF con lo que hay ahora mismo en el
  // formulario, en una pestaña nueva — no sube imágenes a Storage ni
  // guarda nada ni gasta un radicado, solo para revisar antes de guardar.
  visualizarBtn.forEach((btn) => btn.addEventListener("click", async () => {
    setDisabled(visualizarBtn, true);
    setTexto(visualizarBtn, "Generando vista previa...");
    try {
      const contratoId = selectContrato.value;
      const contrato = contratoId ? contratosPorId[contratoId] : null;
      const bloquesPreview = bloques.map((b) => {
        if (b.tipo === "imagen") return { tipo: "imagen", url: b.url || URL.createObjectURL(b.blob), nombre: b.nombre || "", pieDeFoto: b.pieDeFoto || "", tamano: b.tamano || 85 };
        if (b.tipo === "tabla") return { ...b, filas: filasParaGuardar(b.filas) };
        if (b.tipo === "firma") {
          return {
            tipo: "firma", etiqueta: b.etiqueta || "",
            firmantes: (b.firmantes || []).map((f) => ({
              nombre: f.nombre || "", cargo: f.cargo || "",
              firmaUrl: f.firmaUrl || (f.firmaBlob ? URL.createObjectURL(f.firmaBlob) : null),
              altoFirma: f.altoFirma || 14
            }))
          };
        }
        return b;
      });
      const datosPreview = {
        titulo: document.getElementById("titulo").value,
        tipoInforme: document.getElementById("tipoInforme").value,
        portada: document.getElementById("portada").value || "oscura",
        mes: document.getElementById("mes").value || null,
        fecha: document.getElementById("fecha").value || null,
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
      setDisabled(visualizarBtn, false);
      setTexto(visualizarBtn, "Visualizar");
    }
  }));

  // ---- Descargar: genera el PDF del último informe GUARDADO y lo
  // descarga — no vuelve a guardar nada (para eso está "Guardar").
  descargarBtn.forEach((btn) => btn.addEventListener("click", async () => {
    if (!informeGuardadoActual) return;
    setDisabled(descargarBtn, true);
    setTexto(descargarBtn, "Generando...");
    try {
      const pdf = await generarInformePDF(informeGuardadoActual);
      pdf.save(`${informeGuardadoActual.radicado}.pdf`);
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo descargar el informe.", "error");
    } finally {
      setDisabled(descargarBtn, false);
      setTexto(descargarBtn, "Descargar");
    }
  }));
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
