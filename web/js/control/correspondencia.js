import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, deleteDoc, getDocs, runTransaction, serverTimestamp, onSnapshot, query, orderBy, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { generarCartaPDF } from "./correspondencia-pdf.js";
import { descargarCartaDocx } from "./correspondencia-docx.js";
import { truncar } from "./texto.js";
import { registrarDocumentoSGC } from "./documentos-sgc.js";
import { crearCampoTextoRico } from "./texto-rico.js";

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
const crearBtn = document.getElementById("crearCartaBtn");
const descargarBtn = document.getElementById("descargarCartaBtn");
const nuevaCartaBtn = document.getElementById("nuevaCartaBtn");
const bloquesEditor = document.getElementById("bloquesEditor");
const inputImagen = document.getElementById("inputImagen");
const inputWordFinal = document.getElementById("inputWordFinal");
let usuarioActual = null;
let cartaIdParaSubirWord = null;

// Igual criterio que informes.js/ofertas.js — última carta guardada con
// el contenido actual; "Descargar" la usa sin volver a guardar. Como acá
// no hay modo "editar" (una carta ya generada no se vuelve a tocar), tras
// guardar se bloquea "Guardar" hasta que se pida explícitamente "+ Nueva
// carta" — evita generar un radicado nuevo sin querer con un segundo clic.
let cartaGuardadaActual = null;
function actualizarDescargarBtn() {
  descargarBtn.disabled = !cartaGuardadaActual;
}

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
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

function insertarBloqueEn(indice, tipo) {
  if (tipo === "imagen") {
    indiceInsertarImagen = indice;
    inputImagen.click();
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
  [{ tipo: "texto", etiqueta: "Párrafo" }, { tipo: "imagen", etiqueta: "Gráfico / imagen" }].forEach(({ tipo, etiqueta }) => {
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
    if (bloque.tipo === "texto") {
      contenido.appendChild(crearCampoTextoRico({
        valor: bloque.texto,
        placeholder: "Escribe un párrafo...",
        onInput: (html) => { bloque.texto = html; }
      }));
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
      ? { tipo: "imagen", url: URL.createObjectURL(b.blob) }
      : { tipo: "texto", texto: b.texto });
    const datosPreview = {
      destinatario: document.getElementById("destinatario").value,
      ciudad: document.getElementById("ciudad").value || "Neiva",
      asunto: document.getElementById("asunto").value,
      firmaNombre: document.getElementById("firmaNombre").value,
      firmaCargo: document.getElementById("firmaCargo").value,
      fecha: hoyISO(),
      radicado: "VISTA PREVIA — sin guardar",
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
    return (c.radicado || "").toLowerCase().includes(texto) ||
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
    fila.appendChild(celda(c.radicado));
    fila.appendChild(celda(c.fecha || ""));
    fila.appendChild(celda(c.destinatario || ""));
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

  vistaPreviaCartaEl.innerHTML = `
    <div class="control-vp-encabezado">
      <span class="control-vp-titulo">${escapeHtml(c.radicado)} — ${escapeHtml(c.fecha || "")}</span>
      <div class="control-vp-acciones" id="cartaVpAcciones"></div>
    </div>
    <div class="control-vp-grupos">
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

  const btnPdf = document.createElement("button");
  btnPdf.type = "button";
  btnPdf.className = "control-btn-mini";
  btnPdf.textContent = "PDF";
  btnPdf.addEventListener("click", async () => {
    btnPdf.disabled = true;
    try {
      const pdf = await generarCartaPDF(c);
      pdf.save(`${c.radicado}.pdf`);
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
        await descargarCartaDocx(c);
      }
    } finally {
      btnWord.disabled = false;
    }
  });
  accionesEl.appendChild(btnWord);

  if (!esGestorActual) return;

  const btnSubirWord = document.createElement("button");
  btnSubirWord.type = "button";
  btnSubirWord.className = "control-btn-mini";
  btnSubirWord.textContent = "Cargar Word editado";
  btnSubirWord.title = "Sube el .docx ya ajustado a mano (ej. imagen centrada) para que quede como la versión oficial de esta carta";
  btnSubirWord.addEventListener("click", () => {
    cartaIdParaSubirWord = c.id;
    inputWordFinal.click();
  });
  accionesEl.appendChild(btnSubirWord);

  const btnBorrar = document.createElement("button");
  btnBorrar.type = "button";
  btnBorrar.className = "control-btn-danger";
  btnBorrar.textContent = "Borrar";
  btnBorrar.addEventListener("click", async () => {
    const confirmado = window.confirm(
      `¿Seguro que quieres borrar la carta ${c.radicado} (${c.asunto || "sin asunto"})?\n\nEsta acción no se puede deshacer. El radicado no se vuelve a usar para otra carta.`
    );
    if (!confirmado) return;
    btnBorrar.disabled = true;
    try {
      await deleteDoc(doc(db, "correspondencia", c.id));
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo borrar la carta.", "error");
      btnBorrar.disabled = false;
    }
  });
  accionesEl.appendChild(btnBorrar);
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
    mostrarAlerta("Versión editada guardada — el botón \"Word\" de esa carta ahora descarga este archivo.", "ok");
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
    renderTabla(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), esGestor);
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    crearBtn.disabled = true;
    crearBtn.textContent = "Guardando...";
    alertBox.className = "form-alert";

    const anio = new Date().getFullYear();
    const datosBase = {
      destinatario: document.getElementById("destinatario").value,
      ciudad: document.getElementById("ciudad").value || "Neiva",
      asunto: document.getElementById("asunto").value,
      firmaNombre: document.getElementById("firmaNombre").value,
      firmaCargo: document.getElementById("firmaCargo").value,
      fecha: hoyISO()
    };

    try {
      const cartaRef = doc(collection(db, "correspondencia"));

      // Sube las imágenes del editor antes de guardar el registro.
      const bloquesFinal = [];
      let n = 0;
      for (const bloque of bloques) {
        if (bloque.tipo === "texto") {
          bloquesFinal.push({ tipo: "texto", texto: bloque.texto });
        } else {
          n += 1;
          const archivoRef = ref(storage, `correspondencia/${cartaRef.id}/${n}.jpg`);
          await uploadBytes(archivoRef, bloque.blob);
          const url = await getDownloadURL(archivoRef);
          bloquesFinal.push({ tipo: "imagen", url });
        }
      }

      const contadorRef = doc(db, "contadores", `correspondencia_${anio}`);
      const contratoId = selectContrato.value;
      let radicado;

      await runTransaction(db, async (tx) => {
        const contadorSnap = await tx.get(contadorRef);
        const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
        radicado = `COM-${anio}-${String(siguiente).padStart(3, "0")}`;

        tx.set(contadorRef, { siguiente: siguiente + 1 });
        tx.set(cartaRef, {
          // contratoId también queda en la carta misma (antes solo se
          // usaba para la referencia cruzada en contratos/{id}/documentos,
          // más abajo) — así se puede filtrar el listado por contrato sin
          // tener que ir a buscarlo ahí.
          ...datosBase, bloques: bloquesFinal, radicado, anio, consecutivo: siguiente, contratoId: contratoId || null,
          creadoPor: user.email, creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(), actualizadoPor: user.email
        });

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

      // No se limpia el formulario ni se cierra — se queda tal cual para
      // que "Descargar" (y "Visualizar") reflejen justo lo que se guardó.
      // "Guardar" queda bloqueado (evita generar un radicado nuevo con un
      // segundo clic) hasta que se pida "+ Nueva carta".
      cartaGuardadaActual = { ...datosBase, bloques: bloquesFinal, radicado };
      actualizarDescargarBtn();
      nuevaCartaBtn.classList.remove("oculto");
      crearBtn.textContent = "Guardada";

      let mensaje = `Carta ${radicado} guardada.`;
      if (codigoSgc) mensaje += ` Registrada en el SGC como ${codigoSgc}.`;
      if (errorSgc) mensaje += ` (No se pudo registrar en el SGC: ${errorSgc} — hazlo manualmente en Documentos.)`;
      mostrarAlerta(mensaje, errorSgc ? "error" : "ok");
      return;
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo guardar la carta.", "error");
      crearBtn.disabled = false;
      crearBtn.textContent = "Guardar";
    }
  });

  // ---- Descargar: genera el PDF de la última carta GUARDADA — no vuelve
  // a guardar nada.
  descargarBtn.addEventListener("click", async () => {
    if (!cartaGuardadaActual) return;
    descargarBtn.disabled = true;
    descargarBtn.textContent = "Generando...";
    try {
      const pdf = await generarCartaPDF(cartaGuardadaActual);
      pdf.save(`${cartaGuardadaActual.radicado}.pdf`);
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo descargar la carta.", "error");
    } finally {
      descargarBtn.disabled = false;
      descargarBtn.textContent = "Descargar";
    }
  });

  // ---- Nueva carta: limpia el formulario para empezar otra desde cero.
  nuevaCartaBtn.addEventListener("click", () => {
    form.reset();
    document.getElementById("ciudad").value = "Neiva";
    bloques = [{ tipo: "texto", texto: "" }];
    renderBloques();
    cartaGuardadaActual = null;
    actualizarDescargarBtn();
    nuevaCartaBtn.classList.add("oculto");
    crearBtn.disabled = false;
    crearBtn.textContent = "Guardar";
    alertBox.className = "form-alert";
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
