import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, deleteDoc, getDocs, runTransaction, serverTimestamp, onSnapshot, query, orderBy, updateDoc, setDoc, deleteField
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, getBlob } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { generarCartaPDF } from "./correspondencia-pdf.js";
import { firmaGuardada, guardarFirma, procesarArchivoFirma, ajustesFirma, guardarAjustesFirma } from "./firma-local.js";
import { docxABloques, bloquesDeCartaEditada } from "./docx-a-bloques.js";
import { descargarCartaDocx } from "./correspondencia-docx.js";
import { truncar, fechaLocalISO } from "./texto.js";
import { mejorarSelectorContrato } from "./selector-contrato.js";
import { registrarDocumentoSGC } from "./documentos-sgc.js";
import { crearCampoTextoRico } from "./texto-rico.js";
import { crearEditorTabla, nuevaTabla as nuevaTablaEditor, tablaNuevaDesdeHtml } from "./editor-tabla.js";
import { botonVerPdf } from "./adjuntos.js";

// Área/tipo fijos para que una carta quede en el Listado Maestro de
// Documentos (SGC) sin pedir un campo más en el formulario — mismo
// criterio que informes.js/ofertas.js. Área AC (Actividades), no SC: el
// checklist real de contratos (plantillas.js, ACTIVIDADES_OBRA/SERVICIO)
// incluye textualmente "Correspondencia Cruzada" como parte de
// Actividades, no de Servicio al Cliente.
const AREA_SGC_CORRESPONDENCIA = "AC";
const TIPO_SGC_CORRESPONDENCIA = "COM";

const selectContrato = document.getElementById("contratoRelacionado");

const tbody = document.getElementById("listaCorrespondencia");
const sinCartas = document.getElementById("sinCartas");
const form = document.getElementById("nuevaCartaForm");
const alertBox = document.getElementById("crearCartaAlert");
// Si al Radicar falta un campo obligatorio, el navegador frenaba el envío con
// un globo junto al campo, que a veces quedaba fuera de la vista: parecía que
// Radicar no hacía nada. Ahora se dice cuál falta y se lleva la vista a él.
let avisoCampoMostrado = false;
form.addEventListener("invalid", (e) => {
  if (avisoCampoMostrado) return;
  avisoCampoMostrado = true;
  setTimeout(() => { avisoCampoMostrado = false; }, 0);
  const campo = e.target;
  const etiqueta = (campo.id && form.querySelector(`label[for="${campo.id}"]`)?.textContent.trim()) || campo.placeholder || "un campo obligatorio";
  campo.scrollIntoView({ behavior: "smooth", block: "center" });
  mostrarAlerta(`No se radicó: falta completar «${etiqueta}».`, "error");
}, true);
const crearBtn = document.getElementById("crearCartaBtn");
const descargarBtn = document.getElementById("descargarCartaBtn");
const nuevaCartaBtn = document.getElementById("nuevaCartaBtn");
const bloquesEditor = document.getElementById("bloquesEditor");
const inputImagen = document.getElementById("inputImagen");
const inputWordFinal = document.getElementById("inputWordFinal");
let usuarioActual = null;
let cartaIdParaSubirWord = null;

// Última carta guardada con el contenido actual; "Descargar" la usa sin volver a guardar.
let cartaGuardadaActual = null;
// «Descargar borrador» mientras la carta no esté radicada: el PDF sale sin
// número de radicado y antes era fácil confundirlo con el radicado.
function actualizarDescargarBtn() {
  descargarBtn.disabled = !cartaGuardadaActual;
  descargarBtn.textContent = cartaGuardadaActual && !cartaGuardadaActual.radicado ? "Descargar borrador" : "Descargar";
}

// ---- Estados de una carta ----
// borrador: se edita cuantas veces haga falta y no tiene radicado (lo asigna «Radicar»).
// radicada: tiene radicado pero aún no se envía; el texto se puede corregir sin cambiar el radicado.
// enviada: ya la recibió el destinatario (fecha y medio registrados); queda bloqueada.
// anulada: radicada que no se envió; se conserva en la lista (con su motivo) para no dejar huecos en el consecutivo.
// Las cartas de antes de los estados no tienen el campo: se toman como «radicada».
const ESTADOS_CARTA = {
  borrador: { etiqueta: "Borrador", clase: "control-estado-borrador" },
  radicada: { etiqueta: "Radicada · sin enviar", clase: "control-estado-radicada" },
  enviada: { etiqueta: "Enviada", clase: "control-estado-vigente" },
  anulada: { etiqueta: "Anulada", clase: "control-estado-obsoleto" }
};
const estadoDe = (c) => (c && ESTADOS_CARTA[c.estado] ? c.estado : "radicada");
const etiquetaRadicado = (c) => c.radicado || "Borrador";
const pillEstado = (c) => `<span class="control-estado-pill ${ESTADOS_CARTA[estadoDe(c)].clase}">${ESTADOS_CARTA[estadoDe(c)].etiqueta}</span>`;

// Carta que está cargada en el formulario para seguir editándola (borrador o radicada sin enviar).
// null = carta nueva.
let cartaEditando = null;
const borradorBtn = document.getElementById("borradorCartaBtn");
const editandoAviso = document.getElementById("editandoCartaAviso");
function actualizarBotonesFormulario() {
  const radicada = cartaEditando?.estado === "radicada";
  borradorBtn.classList.toggle("oculto", radicada);
  crearBtn.textContent = radicada ? "Guardar cambios" : "Radicar";
  crearBtn.disabled = false;
  borradorBtn.disabled = false;
  // En una carta radicada el contrato ya quedó archivado con ella: no se cambia al corregir el texto.
  selectContrato.disabled = radicada;
  const botonContrato = document.getElementById(`${selectContrato.id}Boton`);
  if (botonContrato) {
    botonContrato.disabled = radicada;
    botonContrato.title = radicada ? "El contrato no se cambia al corregir una carta radicada" : "";
  }
  if (cartaEditando) {
    editandoAviso.textContent = radicada
      ? `Editando ${cartaEditando.radicado} (radicada, sin enviar). «Guardar cambios» corrige el texto y conserva el radicado.`
      : "Editando un borrador. «Guardar borrador» lo actualiza sin radicar; «Radicar» le asigna el número cuando esté listo.";
    editandoAviso.classList.remove("oculto");
  } else {
    editandoAviso.classList.add("oculto");
  }
}

// Radicados citados en el texto (COM-AAAA-NNN) que todavía no constan como enviados: una carta que cita
// otra que el destinatario no ha recibido no se va a entender.
function referenciasNoEnviadas(datos, bloquesCarta, propioRadicado) {
  const textos = [datos.asunto || "", ...bloquesCarta.map((b) => b.tipo === "texto" ? b.texto : b.tipo === "tabla" ? b.filas.map((f) => celdasDeFila(f).join(" ")).join(" ") : "")];
  const citados = new Set(textos.join(" ").replace(/<[^>]+>/g, " ").match(/COM-\d{4}-\d{3}/g) || []);
  citados.delete(propioRadicado);
  return [...citados].filter((r) => {
    const c = cartasListaCompleta.find((x) => x.radicado === r);
    return !c || estadoDe(c) !== "enviada";
  }).map((r) => {
    const c = cartasListaCompleta.find((x) => x.radicado === r);
    return `${r} (${c ? ESTADOS_CARTA[estadoDe(c)].etiqueta.toLowerCase() : "no existe"})`;
  });
}

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

function hoyISO() {
  return fechaLocalISO();
}

// ---- editor de bloques (texto / imagen, reordenables) ----
let bloques = [{ tipo: "texto", texto: "" }];

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
          (blob) => resolve({ blob, previewUrl: canvas.toDataURL("image/jpeg", 0.82), ancho, alto }),
          "image/jpeg", 0.82
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

// Hueco entre bloques (o antes del primero) para insertar un párrafo o una
// imagen justo ahí, en vez de siempre al final y reordenar con flechas —
// mismo patrón que informes.js/ofertas.js, adaptado a los 2 tipos de
// bloque que maneja una carta (texto/imagen, sin títulos ni tablas).
let indiceInsertarImagen = null;

// Tabla de la carta: el MISMO editor de Informes (web/js/control/editor-tabla.js,
// 2026-11-25): seleccionar varias celdas arrastrando o con Shift + clic,
// centrar, negrilla, color, combinar, ancho de columnas y pegar desde
// Word/Excel. La primera fila (o las «Filas de encabezado») es el encabezado.
function nuevaTabla() {
  return { ...nuevaTablaEditor(), tipo: "tabla" };
}
const celdasDeFila = (fila) => (Array.isArray(fila) ? fila : (fila && fila.celdas) || []);
// Tabla guardada → la que edita el editor. Las de antes (sin "centrados")
// centraban solas el encabezado y las columnas de texto corto: se marcan
// esas celdas como centradas para que se vean igual al volver a guardarlas.
function tablaParaEditar(b) {
  const t = { ...JSON.parse(JSON.stringify(b)), tipo: "tabla", filas: (b.filas || []).map((f) => [...celdasDeFila(f)].map((v) => String(v ?? ""))) };
  if (!Array.isArray(b.centrados)) {
    const nCols = Math.max(1, ...t.filas.map((f) => f.length));
    const corta = Array.from({ length: nCols }, (_, c) => t.filas.slice(1).every((f) => String(f[c] ?? "").length <= 18));
    t.centrados = [];
    t.filas.forEach((f, r) => { for (let c = 0; c < nCols; c++) if (r === 0 || corta[c]) t.centrados.push({ fila: r, col: c }); });
  }
  return t;
}
// Tabla del editor → la que se guarda (Firestore no admite listas dentro de
// listas ni valores indefinidos; sin el estado interno del editor: _selA…).
function tablaParaGuardar(b) {
  const limpio = JSON.parse(JSON.stringify(b, (k, v) => (k.startsWith("_") ? undefined : v)));
  return { ...limpio, tipo: "tabla", filas: (b.filas || []).map((celdas) => ({ celdas: [...celdasDeFila(celdas)] })) };
}

function insertarBloqueEn(indice, tipo) {
  if (tipo === "imagen") {
    indiceInsertarImagen = indice;
    inputImagen.click();
    return;
  }
  if (tipo === "tabla") {
    bloques.splice(indice, 0, nuevaTabla());
    renderBloques();
    return;
  }
  if (tipo === "firma") {
    bloques.splice(indice, 0, { tipo: "firma" });
    renderBloques();
    return;
  }
  bloques.splice(indice, 0, { tipo: "texto", texto: "" });
  renderBloques();
}

// Botones de insertar SIEMPRE visibles (no un "+" que hay que abrir) — se
// pidió explícitamente poder agregar un párrafo/gráfico junto a cualquier
// campo, sin tener que bajar hasta el final de la lista.
function renderHueco(indice) {
  const hueco = document.createElement("div");
  hueco.className = "control-bloque-gap";
  // «Firma» solo en un documento propio: en una carta normal la firma ya va en el cierre.
  const tipos = [{ tipo: "texto", etiqueta: "Párrafo" }, { tipo: "imagen", etiqueta: "Gráfico / imagen" }, { tipo: "tabla", etiqueta: "Tabla" }];
  if (modoActual() === "documento" && !bloques.some((b) => b.tipo === "firma")) tipos.push({ tipo: "firma", etiqueta: "Firma" });
  tipos.forEach(({ tipo, etiqueta }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-btn-mini";
    btn.textContent = etiqueta;
    btn.addEventListener("click", () => insertarBloqueEn(indice, tipo));
    hueco.appendChild(btn);
  });
  return hueco;
}


// ---- Tipo de carta: con el formato de Cinco, o un documento propio en Word tal cual ----
const modoActual = () => form.querySelector('input[name="modoCarta"]:checked')?.value || "carta";
function aplicarModo() {
  const esDocumento = modoActual() === "documento";
  document.querySelectorAll(".solo-carta").forEach((el) => el.classList.toggle("oculto", esDocumento));
  document.getElementById("documentoPropioBox").classList.toggle("oculto", !esDocumento);
  document.getElementById("destinatario").required = !esDocumento;
  document.getElementById("firmaNombre").required = !esDocumento;
  document.getElementById("asuntoLabel").textContent = esDocumento ? "Nombre en el listado (se toma del título del documento)" : "Asunto";
  document.getElementById("cuerpoLabel").textContent = esDocumento ? "Contenido del documento" : "Cuerpo de la carta";
  document.getElementById("modoAyuda").textContent = esDocumento
    ? "Tu Word tal cual, con el membrete, el radicado y la firma digital."
    : "Destinatario, asunto, cuerpo y firma de cierre.";
  renderBloques();
}
form.querySelectorAll('input[name="modoCarta"]').forEach((r) => r.addEventListener("change", aplicarModo));

document.getElementById("documentoArchivo").addEventListener("change", async (e) => {
  const archivo = e.target.files[0];
  e.target.value = "";
  if (!archivo) return;
  try {
    const { bloques: leidos, titulo } = await docxABloques(archivo);
    const nuevos = [];
    for (const b of leidos) {
      if (b.tipo === "imagen") {
        try {
          const { blob, previewUrl } = await redimensionarImagen(b.blob);
          nuevos.push({ tipo: "imagen", blob, previewUrl });
        } catch (err) { /* formato de imagen que el navegador no lee (ej. EMF): se omite */ }
      } else {
        nuevos.push(b);
      }
    }
    bloques = nuevos;
    const nombre = titulo || archivo.name.replace(/\.docx$/i, "");
    document.getElementById("asunto").value = nombre.length > 200 ? nombre.slice(0, 197) + "..." : nombre;
    renderBloques();
    mostrarAlerta(`Documento «${archivo.name}» cargado (${nuevos.length} bloques). Revísalo con «Visualizar»; guárdalo como borrador o radícalo cuando esté listo.`, "ok");
  } catch (err) {
    mostrarAlerta(err.message || "No se pudo leer el documento.", "error");
  }
});

function renderBloques() {
  bloquesEditor.innerHTML = "";
  bloquesEditor.appendChild(renderHueco(0));
  bloques.forEach((bloque, i) => {
    const fila = document.createElement("div");
    fila.className = "control-bloque";

    const contenido = document.createElement("div");
    contenido.className = "control-bloque-contenido";
    if (bloque.tipo === "texto") {
      contenido.appendChild(crearCampoTextoRico({
        valor: bloque.texto,
        placeholder: "Escribe un párrafo...",
        onInput: (html) => { bloque.texto = html; },
        // Tabla de Word/Excel pegada en el párrafo → bloque Tabla con su estructura.
        alPegarTabla: (html) => {
          const nueva = tablaNuevaDesdeHtml(html);
          if (!nueva) return;
          const i = bloques.indexOf(bloque);
          const vacio = !String(bloque.texto || "").replace(/<[^>]*>|&nbsp;/g, "").trim();
          bloques.splice(vacio ? i : i + 1, vacio ? 1 : 0, { ...nueva, tipo: "tabla" });
          renderBloques();
        }
      }));
    } else if (bloque.tipo === "tabla") {
      const editorTabla = crearEditorTabla(bloque, { alCambiar: renderBloques, avisar: mostrarAlerta });
      editorTabla.classList.add("control-tabla-sin-titulo"); // la carta no lleva título de tabla
      contenido.appendChild(editorTabla);
    } else if (bloque.tipo === "firma") {
      const marca = document.createElement("div");
      marca.className = "control-bloque-firma";
      const f = firmaGuardada();
      if (f) {
        const img = document.createElement("img");
        img.src = f;
        img.alt = "Firma digital";
        marca.appendChild(img);
      }
      marca.appendChild(document.createTextNode(f
        ? "Aquí va tu firma digital (muévela con las flechas si hace falta)."
        : "Aquí va la firma digital: cárgala más abajo en «Firma digitalizada»; si no, queda el espacio para firmar a mano."));
      contenido.appendChild(marca);
    } else {
      const img = document.createElement("img");
      img.src = bloque.previewUrl;
      img.className = "control-bloque-imagen";
      contenido.appendChild(img);
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
renderBloques();

document.getElementById("agregarTextoBtn").addEventListener("click", () => {
  bloques.push({ tipo: "texto", texto: "" });
  renderBloques();
});

document.getElementById("agregarImagenBtn").addEventListener("click", () => inputImagen.click());
// ---- Firma digitalizada (la busca el usuario o la pega; queda solo en este navegador) ----
const firmaVista = document.getElementById("firmaVista");
const firmaQuitarBtn = document.getElementById("firmaQuitarBtn");
function pintarFirma() {
  const f = firmaGuardada();
  firmaVista.hidden = !f;
  firmaQuitarBtn.hidden = !f;
  if (f) firmaVista.src = f;
  document.getElementById("firmaAjustes").classList.toggle("oculto", !f);
  const { alto, sobreLinea } = ajustesFirma();
  document.getElementById("firmaAlto").value = alto;
  document.getElementById("firmaAltoTexto").textContent = `${alto} mm`;
  document.getElementById("firmaSobreLinea").checked = sobreLinea;
  if (bloques.some((b) => b.tipo === "firma")) renderBloques();
}
// Tamaño y montaje de la firma: se guardan con ella (en este navegador) y se ven al «Visualizar».
function guardarAjustesDeFormulario() {
  const alto = Number(document.getElementById("firmaAlto").value);
  guardarAjustesFirma({ alto, sobreLinea: document.getElementById("firmaSobreLinea").checked });
  document.getElementById("firmaAltoTexto").textContent = `${alto} mm`;
}
document.getElementById("firmaAlto").addEventListener("input", guardarAjustesDeFormulario);
document.getElementById("firmaSobreLinea").addEventListener("change", guardarAjustesDeFormulario);
async function tomarFirma(archivo) {
  if (!archivo || !archivo.type.startsWith("image/")) return;
  try {
    const url = await procesarArchivoFirma(archivo);
    if (!guardarFirma(url)) mostrarAlerta("Este navegador no permite guardar la firma (modo privado o sin espacio).", "error");
    else mostrarAlerta("Firma cargada: saldrá en el PDF y el Word de las cartas. Pulsa «Visualizar» para verla.", "ok");
  } catch (e) {
    mostrarAlerta("No se pudo leer esa imagen.", "error");
  }
  pintarFirma();
}
document.getElementById("firmaArchivo").addEventListener("change", (e) => { const a = e.target.files[0]; e.target.value = ""; tomarFirma(a); });
firmaQuitarBtn.addEventListener("click", () => { guardarFirma(null); pintarFirma(); });
document.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
  if (item && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || "") && !document.activeElement?.isContentEditable) tomarFirma(item.getAsFile());
});
pintarFirma();

document.getElementById("agregarTablaBtn").addEventListener("click", () => { bloques.push(nuevaTabla()); renderBloques(); });

// ---- Importar una carta ya elaborada (JSON) ----
// Igual que «Importar oferta» y «Importar bloques» de Informes: precarga el formulario sin guardar;
// el radicado lo asigna «Guardar». Las imágenes viajan como data URL (PNG o JPG) y se convierten en
// blobs aquí mismo, sin pasar por fetch (la CSP no permite data: en connect-src).
function blobDeDataUrl(dataUrl) {
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}
function importarCartaJson(texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (err) {
    mostrarAlerta("Ese contenido no es un JSON válido.", "error");
    return;
  }
  if (!datos || typeof datos !== "object" || !datos.destinatario || !datos.asunto || !Array.isArray(datos.bloques) || !datos.bloques.length) {
    mostrarAlerta('El JSON debe traer "destinatario", "asunto" y un arreglo "bloques" con al menos un bloque.', "error");
    return;
  }
  const nuevos = [];
  for (let i = 0; i < datos.bloques.length; i++) {
    const b = datos.bloques[i];
    if (b.tipo === "texto") {
      nuevos.push({ tipo: "texto", texto: String(b.texto || "") });
    } else if (b.tipo === "imagen") {
      const blob = blobDeDataUrl(b.dataUrl);
      if (!blob || blob.size > 8 * 1024 * 1024) {
        mostrarAlerta(`El bloque #${i + 1} es una imagen sin un "dataUrl" PNG o JPG válido (máximo 8 MB).`, "error");
        return;
      }
      nuevos.push({ tipo: "imagen", blob, previewUrl: URL.createObjectURL(blob) });
    } else if (b.tipo === "tabla") {
      if (!Array.isArray(b.filas) || !b.filas.length || !b.filas.every((f) => Array.isArray(f) && f.length)) {
        mostrarAlerta(`El bloque #${i + 1} es una tabla sin "filas" completas (arreglo de arreglos de texto).`, "error");
        return;
      }
      nuevos.push({ tipo: "tabla", filas: b.filas.map((f) => f.map((c) => String(c ?? ""))) });
    } else {
      mostrarAlerta(`El bloque #${i + 1} tiene un "tipo" no admitido ("${b.tipo}"): use "texto", "imagen" o "tabla".`, "error");
      return;
    }
  }
  document.getElementById("destinatario").value = datos.destinatario;
  document.getElementById("ciudad").value = datos.ciudad || "Neiva";
  document.getElementById("asunto").value = datos.asunto;
  document.getElementById("firmaNombre").value = datos.firmaNombre || "";
  document.getElementById("firmaCargo").value = datos.firmaCargo || "";
  const cod = String(datos.contratoCodigo || "").trim();
  const opcion = cod ? [...selectContrato.options].find((o) => o.textContent.includes(cod)) : null;
  selectContrato.value = opcion ? opcion.value : "";
  bloques = nuevos;
  renderBloques();
  document.getElementById("importarCartaTexto").value = "";
  document.getElementById("importarCartaTexto").closest("details").open = false;
  document.getElementById("nuevaCartaDetails").open = true;
  mostrarAlerta(`Carta importada con ${nuevos.length} bloques${cod && !opcion ? ` — no encontré el contrato «${cod}»: elígelo en «Contrato relacionado»` : ""}. Revísala con «Visualizar»; luego «Guardar borrador», «Radicar» o, si estás corrigiendo una carta radicada, «Guardar cambios».`, "ok");
}
document.getElementById("importarCartaBtn").addEventListener("click", () => {
  const texto = document.getElementById("importarCartaTexto").value.trim();
  if (texto) importarCartaJson(texto);
});
document.getElementById("importarCartaArchivo").addEventListener("change", async (e) => {
  const archivo = e.target.files[0];
  e.target.value = "";
  if (archivo) importarCartaJson(await archivo.text());
});

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
      bloques.splice(destino, 0, { tipo: "imagen", blob, previewUrl });
      destino++;
    } catch (err) {
      // Una imagen que el navegador no puede leer (ej. .HEIC de iPhone) no
      // debe bloquear las demás — se avisa cuál falló y se sigue con el resto.
      fallidos.push(archivo.name);
    }
  }
  inputImagen.value = "";
  renderBloques();
  if (fallidos.length) {
    mostrarAlerta(
      `No se pudo leer: ${fallidos.join(", ")}. Si son fotos de iPhone en formato HEIC, conviértelas a JPG o PNG antes de subirlas (en el iPhone: Ajustes > Cámara > Formatos > "Más compatible").`,
      "error"
    );
  }
});

// Genera el PDF con lo que hay ahora mismo en el formulario/editor, en una
// pestaña nueva — no sube nada a Storage ni gasta un radicado, sirve solo
// para revisar/corregir antes de generar la carta de verdad.
document.getElementById("vistaPreviaBtn").addEventListener("click", async () => {
  const btn = document.getElementById("vistaPreviaBtn");
  btn.disabled = true;
  btn.textContent = "Generando vista previa...";
  try {
    const bloquesPreview = bloques.map((b) => b.tipo === "imagen"
      ? { tipo: "imagen", url: b.blob ? URL.createObjectURL(b.blob) : b.url }
      : b.tipo === "tabla" ? tablaParaGuardar(b) : b.tipo === "firma" ? { tipo: "firma" } : { tipo: "texto", texto: b.texto });
    const datosPreview = {
      modo: modoActual(),
      destinatario: document.getElementById("destinatario").value,
      ciudad: document.getElementById("ciudad").value || "Neiva",
      asunto: document.getElementById("asunto").value,
      firmaNombre: document.getElementById("firmaNombre").value,
      firmaCargo: document.getElementById("firmaCargo").value,
      fecha: cartaEditando?.fecha || hoyISO(),
      radicado: cartaEditando?.radicado ? `${cartaEditando.radicado} (vista previa sin guardar)` : "BORRADOR — sin radicar",
      bloques: bloquesPreview
    };
    const pdf = await generarCartaPDF(datosPreview);
    window.open(pdf.output("bloburl"), "_blank");
  } finally {
    btn.disabled = false;
    btn.textContent = "Visualizar";
  }
});

// ---- listado ----
function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

function escapeHtml(texto) {
  return String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const vistaPreviaCartaEl = document.getElementById("cartaVistaPrevia");
const filtroInput = document.getElementById("filtroCorrespondencia");
const filtroContratoSelect = document.getElementById("filtroCorrespondenciaContrato");
const filtroDesdeInput = document.getElementById("filtroCorrespondenciaDesde");
const filtroHastaInput = document.getElementById("filtroCorrespondenciaHasta");

// Deep-link desde "Documentos del contrato" (contrato.html) — esa vista
// solo puede enlazar a esta página en general (no hay contrato.html?id=
// por carta), así que aquí se selecciona y se deja fijada en el panel la
// carta pedida.
const idDestacar = new URLSearchParams(window.location.search).get("id");
let yaScrolleadoAIdDestacado = false;

let contratosPorId = {};
let cartasListaCompleta = [];
let cartasListaFiltrada = [];
let esGestorActual = false;
let cartaSeleccionadaId = idDestacar || null;

// Fila = solo lo justo para escanear y elegir (una sola línea, sin
// acciones) — mismo patrón que Órdenes de Trabajo/Contratos: el detalle
// completo, incluidas las acciones (PDF/Word/Cargar Word editado/Borrar),
// vive en el panel de vista previa de arriba.
function renderTabla(cartas, esGestor) {
  cartasListaCompleta = cartas;
  esGestorActual = esGestor;
  aplicarFiltroCorrespondencia();
}

function aplicarFiltroCorrespondencia() {
  const texto = filtroInput.value.trim().toLowerCase();
  const contratoId = filtroContratoSelect.value;
  const desde = filtroDesdeInput.value;
  const hasta = filtroHastaInput.value;
  cartasListaFiltrada = cartasListaCompleta.filter((c) => {
    if (contratoId && c.contratoId !== contratoId) return false;
    if (desde && (!c.fecha || c.fecha < desde)) return false;
    if (hasta && (!c.fecha || c.fecha > hasta)) return false;
    if (!texto) return true;
    return etiquetaRadicado(c).toLowerCase().includes(texto) ||
      ESTADOS_CARTA[estadoDe(c)].etiqueta.toLowerCase().includes(texto) ||
      (c.destinatario || "").toLowerCase().includes(texto) ||
      (c.asunto || "").toLowerCase().includes(texto);
  });

  tbody.innerHTML = "";
  sinCartas.textContent = cartasListaCompleta.length === 0
    ? "Todavía no hay cartas registradas."
    : "Ninguna carta coincide con el filtro.";
  sinCartas.classList.toggle("oculto", cartasListaFiltrada.length > 0);

  if (cartasListaFiltrada.length === 0) {
    cartaSeleccionadaId = null;
    pintarVistaPreviaCarta();
    return;
  }
  if (!cartaSeleccionadaId || !cartasListaFiltrada.some((c) => c.id === cartaSeleccionadaId)) {
    cartaSeleccionadaId = cartasListaFiltrada[0].id;
  }

  cartasListaFiltrada.forEach((c) => {
    const fila = document.createElement("tr");
    fila.dataset.id = c.id;
    if (estadoDe(c) === "anulada") fila.classList.add("control-fila-anulada");
    fila.appendChild(celda(etiquetaRadicado(c)));
    const tdEstado = document.createElement("td");
    tdEstado.innerHTML = pillEstado(c);
    fila.appendChild(tdEstado);
    fila.appendChild(celda(c.fecha || ""));
    fila.appendChild(celda(c.destinatario || (c.modo === "documento" ? "(documento propio)" : "")));
    fila.appendChild(celda(c.asunto || ""));
    fila.addEventListener("click", () => {
      cartaSeleccionadaId = c.id;
      actualizarResaltadoCarta();
      pintarVistaPreviaCarta();
    });
    tbody.appendChild(fila);
  });
  actualizarResaltadoCarta();
  pintarVistaPreviaCarta();

  if (idDestacar && !yaScrolleadoAIdDestacado) {
    const fila = tbody.querySelector(`tr[data-id="${idDestacar}"]`);
    if (fila) {
      yaScrolleadoAIdDestacado = true;
      fila.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}
filtroInput.addEventListener("input", aplicarFiltroCorrespondencia);
filtroContratoSelect.addEventListener("change", aplicarFiltroCorrespondencia);
filtroDesdeInput.addEventListener("change", aplicarFiltroCorrespondencia);
filtroHastaInput.addEventListener("change", aplicarFiltroCorrespondencia);

function actualizarResaltadoCarta() {
  tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.classList.toggle("control-fila-fijada", tr.dataset.id === cartaSeleccionadaId);
  });
}

function pintarVistaPreviaCarta() {
  const c = cartasListaFiltrada.find((x) => x.id === cartaSeleccionadaId);
  if (!c) {
    vistaPreviaCartaEl.innerHTML = `<p class="text-muted" style="margin:0;">${cartasListaCompleta.length === 0 ? "Todavía no hay cartas registradas." : "Ninguna carta coincide con el filtro."}</p>`;
    return;
  }

  const campo = (etiqueta, valor) => `
    <div class="control-vp-campo">
      <span class="control-vp-etiqueta">${etiqueta}</span>
      <span class="control-vp-valor">${escapeHtml(valor || "-")}</span>
    </div>`;
  const grupo = (titulo, camposHtml) => `
    <div class="control-vp-grupo">
      <div class="control-vp-grupo-titulo">${titulo}</div>
      <div class="control-vp-grupo-campos">${camposHtml}</div>
    </div>`;

  const est = estadoDe(c);
  const grupoEstado = est === "enviada"
    ? grupo("Envío", `${campo("Enviada el", c.envio?.fecha)}${campo("Medio", c.envio?.medio)}${c.envio?.nota ? campo("Nota", c.envio.nota) : ""}`)
    : est === "anulada"
      ? grupo("Anulación", `${campo("Motivo", c.anulacion?.motivo)}${campo("Fecha", c.anulacion?.fecha)}`)
      : grupo("Estado", campo("Situación", est === "borrador"
        ? "Borrador sin radicar: edítalo cuantas veces haga falta y radícalo cuando esté listo."
        : "Radicada y sin enviar: aún puedes corregir el texto («Editar»). Cuando la envíes, márcala como enviada."));

  vistaPreviaCartaEl.innerHTML = `
    <div class="control-vp-encabezado">
      <span class="control-vp-titulo">${escapeHtml(etiquetaRadicado(c))} — ${escapeHtml(c.fecha || "")} ${pillEstado(c)}</span>
      <div class="control-vp-acciones" id="cartaVpAcciones"></div>
    </div>
    <div class="control-vp-grupos">
      ${grupoEstado}
      ${grupo("Destinatario", `
        ${campo("Destinatario", c.destinatario)}
        ${campo("Ciudad", c.ciudad)}
      `)}
      ${grupo("Contenido", campo("Asunto", c.asunto))}
      ${c.contratoId ? grupo("Contrato relacionado", campo("Contrato", contratosPorId[c.contratoId] ? `${contratosPorId[c.contratoId].codigo || "(sin código)"} — ${contratosPorId[c.contratoId].nombre || ""}` : "")) : ""}
      ${grupo("Firma", `
        ${campo("Nombre", c.firmaNombre)}
        ${campo("Cargo", c.firmaCargo)}
      `)}
    </div>
  `;

  const accionesEl = document.getElementById("cartaVpAcciones");
  const nombreArchivo = c.radicado || "Borrador";
  accionesEl.appendChild(botonVerPdf({
    titulo: `${etiquetaRadicado(c)} — ${c.asunto || ""}`,
    nombreArchivo: `${nombreArchivo}.pdf`,
    obtenerBlob: async () => (await generarCartaPDF(await datosParaPdf(c))).output("blob")
  }));

  const btnPdf = document.createElement("button");
  btnPdf.type = "button";
  btnPdf.className = "control-btn-mini";
  btnPdf.textContent = c.wordFinalUrl ? "PDF ✓" : "PDF";
  btnPdf.title = c.wordFinalUrl ? "PDF armado con el Word editado que subieron" : "";
  btnPdf.addEventListener("click", async () => {
    btnPdf.disabled = true;
    try {
      const pdf = await generarCartaPDF(await datosParaPdf(c));
      pdf.save(`${nombreArchivo}.pdf`);
    } catch (err) {
      mostrarAlerta(`No se pudo generar el PDF${c.wordFinalUrl ? " desde el Word editado" : ""}: ${err.message || err}`, "error");
    } finally {
      btnPdf.disabled = false;
    }
  });
  accionesEl.appendChild(btnPdf);

  const btnWord = document.createElement("button");
  btnWord.type = "button";
  btnWord.className = "control-btn-mini";
  btnWord.textContent = c.wordFinalUrl ? "Word ✓" : "Word";
  btnWord.title = c.wordFinalUrl ? "Descarga la versión editada a mano que subieron" : "Genera el Word automático";
  btnWord.addEventListener("click", async () => {
    btnWord.disabled = true;
    try {
      if (c.wordFinalUrl) {
        window.open(c.wordFinalUrl, "_blank");
      } else {
        await descargarCartaDocx({ ...c, radicado: radicadoParaDocumento(c) });
      }
    } finally {
      btnWord.disabled = false;
    }
  });
  accionesEl.appendChild(btnWord);

  if (!esGestorActual) return;

  const boton = (texto, titulo, clase, alHacerClic) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = clase;
    b.textContent = texto;
    b.title = titulo;
    b.addEventListener("click", async () => {
      b.disabled = true;
      try { await alHacerClic(); } catch (err) { mostrarAlerta(err.message || String(err), "error"); } finally { b.disabled = false; }
    });
    accionesEl.appendChild(b);
  };
  const actualizar = (campos) => updateDoc(doc(db, "correspondencia", c.id), { ...campos, actualizadoEn: serverTimestamp(), actualizadoPor: usuarioActual.email });

  if (est === "borrador" || est === "radicada") {
    boton("Editar", est === "borrador" ? "Carga el borrador en el formulario para seguir editándolo" : "Carga la carta en el formulario para corregir el texto sin cambiar el radicado", "control-btn-mini", async () => cargarCartaEnFormulario(c));
  }
  if (est === "radicada") {
    boton("Cargar Word editado", "Sube el .docx ya ajustado a mano (ej. imagen centrada) para que quede como la versión oficial de esta carta", "control-btn-mini", async () => {
      cartaIdParaSubirWord = c.id;
      inputWordFinal.click();
    });
    boton("Marcar enviada", "Registra que la carta ya la recibió el destinatario; desde ahí queda bloqueada", "control-btn-mini", async () => {
      const citadas = referenciasNoEnviadas(c, (c.bloques || []).map((b) => b.tipo === "tabla" ? { tipo: "tabla", filas: (b.filas || []).map(celdasDeFila) } : b), c.radicado);
      if (citadas.length && !window.confirm(`Esta carta cita ${citadas.join(", ")}, que no consta como enviada. El destinatario no la va a tener como referencia.\n\n¿Marcarla como enviada de todos modos?`)) return;
      const fecha = window.prompt("Fecha de envío (AAAA-MM-DD):", hoyISO());
      if (!fecha) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) throw new Error("La fecha debe tener el formato AAAA-MM-DD.");
      const medio = window.prompt("¿Por qué medio se envió? (ej. correo electrónico a fernando.acero@..., entrega física, plataforma)", "Correo electrónico");
      if (!medio) return;
      const nota = window.prompt("Nota opcional (ej. con copia a la supervisión, anexos enviados):", "") || "";
      await actualizar({ estado: "enviada", envio: { fecha: fecha.trim(), medio: medio.trim(), nota: nota.trim(), registradoPor: usuarioActual.email } });
      mostrarAlerta(`${c.radicado} quedó como enviada el ${fecha.trim()}.`, "ok");
    });
    boton("Anular", "La carta no se envió y no se enviará: queda en la lista como anulada, con su motivo, sin dejar hueco en el consecutivo", "control-btn-danger", async () => {
      const motivo = window.prompt(`Motivo de la anulación de ${c.radicado} (ej. «No enviada; reemplazada por COM-2026-0XX»):`, "");
      if (!motivo || !motivo.trim()) return;
      await actualizar({ estado: "anulada", anulacion: { motivo: motivo.trim(), fecha: hoyISO(), registradoPor: usuarioActual.email } });
      mostrarAlerta(`${c.radicado} quedó anulada.`, "ok");
    });
  }
  if (est === "enviada") {
    boton("Quitar marca de enviada", "Solo si se marcó como enviada por error", "control-btn-mini", async () => {
      if (!window.confirm(`¿Quitar la marca de enviada de ${c.radicado}? Úsalo solo si se marcó por error: una carta que ya recibió el destinatario no debe cambiar.`)) return;
      await actualizar({ estado: "radicada", envio: deleteField() });
    });
  }
  if (est === "anulada") {
    boton("Quitar anulación", "Solo si se anuló por error", "control-btn-mini", async () => {
      if (!window.confirm(`¿Quitar la anulación de ${c.radicado}?`)) return;
      await actualizar({ estado: "radicada", anulacion: deleteField() });
    });
  }
  if (est === "borrador") {
    boton("Borrar", "Borra el borrador (no tiene radicado, no deja huecos)", "control-btn-danger", async () => {
      if (!window.confirm(`¿Borrar este borrador (${c.asunto || "sin asunto"})? No se puede deshacer.`)) return;
      await deleteDoc(doc(db, "correspondencia", c.id));
      if (cartaEditando?.id === c.id) limpiarFormulario();
    });
  }
}

// El radicado que se imprime: un borrador no tiene número y una anulada lo dice.
function radicadoParaDocumento(c) {
  if (!c.radicado) return "BORRADOR — sin radicar";
  return estadoDe(c) === "anulada" ? `${c.radicado} (ANULADA)` : c.radicado;
}

// Carga una carta guardada (borrador o radicada sin enviar) en el formulario para seguir editándola.
function cargarCartaEnFormulario(c) {
  const modo = c.modo === "documento" ? "documento" : "carta";
  form.querySelector(`input[name="modoCarta"][value="${modo}"]`).checked = true;
  document.getElementById("destinatario").value = c.destinatario || "";
  document.getElementById("ciudad").value = c.ciudad || "Neiva";
  document.getElementById("asunto").value = c.asunto || "";
  document.getElementById("firmaNombre").value = c.firmaNombre || "";
  document.getElementById("firmaCargo").value = c.firmaCargo || "";
  selectContrato.value = c.contratoId || "";
  bloques = (c.bloques || []).map((b) => {
    if (b.tipo === "tabla") return tablaParaEditar(b);
    if (b.tipo === "imagen") return { tipo: "imagen", url: b.url, previewUrl: b.url };
    if (b.tipo === "firma") return { tipo: "firma" };
    return { tipo: "texto", texto: b.texto || "" };
  });
  if (!bloques.length) bloques = [{ tipo: "texto", texto: "" }];
  cartaEditando = { id: c.id, estado: estadoDe(c), radicado: c.radicado || null, fecha: c.fecha || null, wordFinalUrl: c.wordFinalUrl || null };
  cartaGuardadaActual = { ...c };
  aplicarModo();
  actualizarBotonesFormulario();
  actualizarDescargarBtn();
  nuevaCartaBtn.classList.remove("oculto");
  alertBox.className = "form-alert";
  document.getElementById("nuevaCartaDetails").open = true;
  document.getElementById("nuevaCartaDetails").scrollIntoView({ behavior: "smooth", block: "start" });
}

function limpiarFormulario() {
  form.reset();
  document.getElementById("ciudad").value = "Neiva";
  bloques = [{ tipo: "texto", texto: "" }];
  cartaEditando = null;
  cartaGuardadaActual = null;
  aplicarModo();
  actualizarDescargarBtn();
  actualizarBotonesFormulario();
  nuevaCartaBtn.classList.add("oculto");
  alertBox.className = "form-alert";
}

// ---- PDF a partir del Word editado ----
// Antes "Cargar Word editado" solo cambiaba lo que descargaba el botón
// "Word": el PDF se seguía armando con el contenido original de la carta.
// Ahora, si la carta tiene Word editado, el PDF se arma leyendo ESE Word
// (membrete y radicado de Cinco + su contenido tal cual), como un
// documento propio. Se lee cada vez desde Storage, así sirve también para
// las cartas que ya tenían el Word cargado antes de este cambio.
async function datosParaPdf(cartaOriginal) {
  const carta = cartaOriginal?.id ? { ...cartaOriginal, radicado: radicadoParaDocumento(cartaOriginal) } : cartaOriginal;
  if (!carta?.wordFinalUrl || !carta.id) return carta;
  const blob = await getBlob(ref(storage, `correspondencia/${carta.id}/final.docx`));
  const { bloques } = await docxABloques(blob);
  return { ...carta, modo: "documento", bloques: bloquesDeCartaEditada(bloques, carta) };
}

inputWordFinal.addEventListener("change", async () => {
  const archivo = inputWordFinal.files[0];
  inputWordFinal.value = "";
  if (!archivo || !cartaIdParaSubirWord || !usuarioActual) return;

  try {
    const archivoRef = ref(storage, `correspondencia/${cartaIdParaSubirWord}/final.docx`);
    await uploadBytes(archivoRef, archivo);
    const url = await getDownloadURL(archivoRef);
    await updateDoc(doc(db, "correspondencia", cartaIdParaSubirWord), {
      wordFinalUrl: url,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: usuarioActual.email
    });
    mostrarAlerta("Versión editada guardada — los botones \"Word\" y \"PDF\" de esa carta ahora salen de este archivo.", "ok");
  } catch (err) {
    mostrarAlerta(err.message || "No se pudo subir el archivo.", "error");
  } finally {
    cartaIdParaSubirWord = null;
  }
});

requireAuth(async (user) => {
  usuarioActual = user;
  document.getElementById("userEmail").textContent = user.email;

  // Solo admin/coadmin crean/borran cartas (las reglas de Firestore
  // también lo exigen) — antes cualquier autenticado podía.
  const perfil = await obtenerPerfil(user.email);
  const esGestor = perfil?.estado === "activo" && (perfil?.rol === "admin" || perfil?.rol === "coadmin");
  if (!esGestor) {
    document.getElementById("nuevaCartaDetails").classList.add("oculto");
    document.getElementById("soloGestorAviso")?.classList.remove("oculto");
  }
  // Visible a cualquier empleado activo (no solo a quien tenga el permiso
  // general) — puede ser responsable/personal asignado de una orden
  // puntual sin ser "autorizado" al módulo completo, ver contratos.js.
  document.getElementById("navOrdenesTrabajo")?.classList.toggle("oculto", perfil?.estado !== "activo");

  const q = query(collection(db, "correspondencia"), orderBy("creadoEn", "desc"));
  onSnapshot(q, (snapshot) => {
    // La fecha de la carta es la del momento en que se radicó, en hora de Colombia: las guardadas antes de
    // corregir hoyISO() pudieron quedar con el día siguiente si se crearon después de las 7:00 p. m.
    renderTabla(snapshot.docs.map((d) => {
      const c = d.data();
      return { id: d.id, ...c, fecha: c.creadoEn?.toDate ? fechaLocalISO(c.creadoEn.toDate()) : c.fecha };
    }), esGestor);
  });

  // orderBy("creadoEn") y no "codigo": los contratos de antes de esta
  // función no tienen "codigo" y quedarían fuera si se ordenara por ese
  // campo. Las reglas de Firestore ya filtran qué contratos ve cada quien.
  const contratosSnap = await getDocs(query(collection(db, "contratos"), orderBy("creadoEn", "desc")));
  contratosSnap.forEach((docSnap) => {
    const c = docSnap.data();
    contratosPorId[docSnap.id] = c;
    const etiqueta = `${c.codigo || "(sin código)"} — ${truncar(c.nombre)}`;
    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = etiqueta;
    selectContrato.appendChild(opt);
    filtroContratoSelect.appendChild(new Option(etiqueta, docSnap.id));
  });
  mejorarSelectorContrato(selectContrato, contratosPorId);

  // Un documento propio no lleva destinatario ni firma de cierre (los trae el mismo documento).
  const datosDelFormulario = () => {
    const esDocumento = modoActual() === "documento";
    return {
      modo: esDocumento ? "documento" : "carta",
      destinatario: esDocumento ? "" : document.getElementById("destinatario").value,
      ciudad: document.getElementById("ciudad").value || "Neiva",
      asunto: document.getElementById("asunto").value,
      firmaNombre: esDocumento ? "" : document.getElementById("firmaNombre").value,
      firmaCargo: esDocumento ? "" : document.getElementById("firmaCargo").value
    };
  };

  // Sube las imágenes nuevas del editor (las ya subidas conservan su url) y devuelve los bloques a guardar.
  // Cada imagen subida queda con su url en el editor, para no volver a subirla en el siguiente guardado.
  async function bloquesParaGuardar(cartaId) {
    const final = [];
    let n = 0;
    for (const bloque of bloques) {
      if (bloque.tipo === "texto") {
        final.push({ tipo: "texto", texto: bloque.texto });
      } else if (bloque.tipo === "tabla") {
        final.push(tablaParaGuardar(bloque));
      } else if (bloque.tipo === "firma") {
        final.push({ tipo: "firma" });
      } else if (bloque.blob) {
        n += 1;
        const archivoRef = ref(storage, `correspondencia/${cartaId}/${Date.now()}-${n}.jpg`);
        await uploadBytes(archivoRef, bloque.blob);
        bloque.url = await getDownloadURL(archivoRef);
        delete bloque.blob;
        final.push({ tipo: "imagen", url: bloque.url });
      } else {
        final.push({ tipo: "imagen", url: bloque.url });
      }
    }
    return final;
  }

  // ---- Guardar borrador: sin radicado, se puede repetir cuantas veces haga falta ----
  borradorBtn.addEventListener("click", async () => {
    borradorBtn.disabled = true;
    crearBtn.disabled = true;
    alertBox.className = "form-alert";
    try {
      const datosBase = datosDelFormulario();
      const cartaRef = cartaEditando ? doc(db, "correspondencia", cartaEditando.id) : doc(collection(db, "correspondencia"));
      const bloquesFinal = await bloquesParaGuardar(cartaRef.id);
      const contratoId = selectContrato.value || null;
      if (cartaEditando) {
        await updateDoc(cartaRef, { ...datosBase, bloques: bloquesFinal, contratoId, actualizadoEn: serverTimestamp(), actualizadoPor: user.email });
      } else {
        await setDoc(cartaRef, {
          ...datosBase, bloques: bloquesFinal, contratoId, estado: "borrador", radicado: null, fecha: hoyISO(),
          creadoPor: user.email, creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp(), actualizadoPor: user.email
        });
      }
      cartaEditando = { id: cartaRef.id, estado: "borrador", radicado: null, fecha: null };
      cartaGuardadaActual = { id: cartaRef.id, ...datosBase, bloques: bloquesFinal, radicado: null, estado: "borrador" };
      cartaSeleccionadaId = cartaRef.id;
      actualizarDescargarBtn();
      nuevaCartaBtn.classList.remove("oculto");
      mostrarAlerta("Borrador guardado, sin radicado. Puedes seguir editándolo; «Radicar» le asigna el número cuando esté listo.", "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo guardar el borrador.", "error");
    } finally {
      actualizarBotonesFormulario();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.className = "form-alert";
    const datosBase = datosDelFormulario();
    const corrigiendo = cartaEditando?.estado === "radicada";

    // Antes de radicar (o de corregir una radicada): ¿cita cartas que el destinatario no ha recibido?
    const citadas = referenciasNoEnviadas(datosBase, bloques, cartaEditando?.radicado);
    if (citadas.length && !window.confirm(
      `El texto cita ${citadas.join(", ")}, que no consta como enviada al destinatario.\n\nSi esa carta no se envió, el destinatario no va a entender la referencia: lo mejor es redactar esta carta completa, sin citarla.\n\n¿${corrigiendo ? "Guardar los cambios" : "Radicar"} de todos modos?`
    )) return;

    crearBtn.disabled = true;
    borradorBtn.disabled = true;
    crearBtn.textContent = corrigiendo ? "Guardando..." : "Radicando...";

    if (corrigiendo) {
      // Corregir una carta radicada que aún no se envía: conserva radicado, fecha y contrato.
      try {
        if (cartaEditando.wordFinalUrl && !window.confirm(`${cartaEditando.radicado} tiene un Word editado cargado, que hoy manda sobre el PDF. Al guardar los cambios se descarta ese Word y el PDF sale de este texto.\n\n¿Continuar?`)) {
          actualizarBotonesFormulario();
          return;
        }
        const cartaRef = doc(db, "correspondencia", cartaEditando.id);
        const bloquesFinal = await bloquesParaGuardar(cartaRef.id);
        const cambios = { ...datosBase, bloques: bloquesFinal, actualizadoEn: serverTimestamp(), actualizadoPor: user.email };
        if (cartaEditando.wordFinalUrl) cambios.wordFinalUrl = deleteField();
        await updateDoc(cartaRef, cambios);
        cartaEditando.wordFinalUrl = null;
        cartaGuardadaActual = { id: cartaRef.id, ...datosBase, bloques: bloquesFinal, radicado: cartaEditando.radicado, fecha: cartaEditando.fecha, estado: "radicada" };
        actualizarDescargarBtn();
        mostrarAlerta(`Cambios guardados en ${cartaEditando.radicado}; conserva su radicado y su fecha.`, "ok");
      } catch (err) {
        mostrarAlerta(err.message || "No se pudieron guardar los cambios.", "error");
      } finally {
        actualizarBotonesFormulario();
      }
      return;
    }

    const anio = new Date().getFullYear();
    datosBase.fecha = hoyISO();

    try {
      const desdeBorrador = cartaEditando?.estado === "borrador";
      const cartaRef = desdeBorrador ? doc(db, "correspondencia", cartaEditando.id) : doc(collection(db, "correspondencia"));
      const bloquesFinal = await bloquesParaGuardar(cartaRef.id);

      const contadorRef = doc(db, "contadores", `correspondencia_${anio}`);
      const contratoId = selectContrato.value;
      let radicado;

      await runTransaction(db, async (tx) => {
        const contadorSnap = await tx.get(contadorRef);
        if (desdeBorrador) {
          const actual = await tx.get(cartaRef);
          if (actual.exists() && actual.data().radicado) throw new Error(`Este borrador ya se radicó como ${actual.data().radicado}.`);
        }
        const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
        radicado = `COM-${anio}-${String(siguiente).padStart(3, "0")}`;

        tx.set(contadorRef, { siguiente: siguiente + 1 });
        // creadoEn = momento de radicación (de ahí sale la fecha de la lista), también al radicar un borrador.
        tx.set(cartaRef, {
          ...datosBase, bloques: bloquesFinal, estado: "radicada", radicado, anio, consecutivo: siguiente, contratoId: contratoId || null,
          creadoPor: user.email, creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(), actualizadoPor: user.email
        }, { merge: true });

        if (contratoId) {
          const refEnContrato = doc(collection(db, "contratos", contratoId, "documentos"));
          tx.set(refEnContrato, {
            codigo: radicado, nombre: datosBase.asunto, tipo: "externo",
            origen: "correspondencia", refId: cartaRef.id,
            creadoPor: user.email, creadoEn: serverTimestamp()
          });
        }
      });

      // Registro en el SGC: transacción aparte (contador propio por
      // área+tipo) — si falla, la carta ya quedó generada y no se pierde,
      // solo se avisa para registrarla manualmente en Documentos.
      let codigoSgc = "";
      let errorSgc = "";
      if (document.getElementById("parteSGI").checked) {
        try {
          codigoSgc = await registrarDocumentoSGC(db, {
            area: AREA_SGC_CORRESPONDENCIA, tipo: TIPO_SGC_CORRESPONDENCIA,
            nombre: datosBase.asunto, origen: "correspondencia", refId: cartaRef.id, user
          });
        } catch (err) {
          errorSgc = err.message || "error desconocido";
        }
      }

      // El formulario se queda con la carta: un segundo clic ya no radica otra vez, sino que
      // «Guardar cambios» corrige esta misma mientras no se marque como enviada.
      cartaEditando = { id: cartaRef.id, estado: "radicada", radicado, fecha: datosBase.fecha, wordFinalUrl: null };
      cartaGuardadaActual = { id: cartaRef.id, ...datosBase, bloques: bloquesFinal, radicado, estado: "radicada" };
      cartaSeleccionadaId = cartaRef.id;
      actualizarDescargarBtn();
      nuevaCartaBtn.classList.remove("oculto");

      let mensaje = `Carta radicada como ${radicado}. Mientras no la marques como enviada, puedes corregirla con «Guardar cambios».`;
      if (codigoSgc) mensaje += ` Registrada en el SGC como ${codigoSgc}.`;
      if (errorSgc) mensaje += ` (No se pudo registrar en el SGC: ${errorSgc} — hazlo manualmente en Documentos.)`;
      mostrarAlerta(mensaje, errorSgc ? "error" : "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo radicar la carta.", "error");
    } finally {
      actualizarBotonesFormulario();
    }
  });

  // ---- Descargar: genera el PDF de la última carta GUARDADA — no vuelve
  // a guardar nada.
  descargarBtn.addEventListener("click", async () => {
    if (!cartaGuardadaActual) return;
    descargarBtn.disabled = true;
    descargarBtn.textContent = "Generando...";
    try {
      const pdf = await generarCartaPDF(await datosParaPdf(cartaGuardadaActual));
      pdf.save(`${cartaGuardadaActual.radicado || "Borrador"}.pdf`);
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo descargar la carta.", "error");
    } finally {
      actualizarDescargarBtn();
    }
  });

  // ---- Nueva carta: limpia el formulario para empezar otra desde cero.
  nuevaCartaBtn.addEventListener("click", limpiarFormulario);
  actualizarBotonesFormulario();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
