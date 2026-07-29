import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, deleteDoc, getDocs, runTransaction, serverTimestamp, onSnapshot, query, orderBy, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth } from "./firebase-control.js";
import { generarCartaPDF } from "./correspondencia-pdf.js";
import { descargarCartaDocx } from "./correspondencia-docx.js";

const selectContrato = document.getElementById("contratoRelacionado");

const tbody = document.getElementById("listaCorrespondencia");
const sinCartas = document.getElementById("sinCartas");
const form = document.getElementById("nuevaCartaForm");
const alertBox = document.getElementById("crearCartaAlert");
const crearBtn = document.getElementById("crearCartaBtn");
const bloquesEditor = document.getElementById("bloquesEditor");
const inputImagen = document.getElementById("inputImagen");
const inputWordFinal = document.getElementById("inputWordFinal");
let usuarioActual = null;
let cartaIdParaSubirWord = null;

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

function renderBloques() {
  bloquesEditor.innerHTML = "";
  bloques.forEach((bloque, i) => {
    const fila = document.createElement("div");
    fila.className = "control-bloque";

    const contenido = document.createElement("div");
    contenido.className = "control-bloque-contenido";
    if (bloque.tipo === "texto") {
      const textarea = document.createElement("textarea");
      textarea.rows = 4;
      textarea.placeholder = "Escribe un párrafo...";
      textarea.value = bloque.texto;
      textarea.addEventListener("input", () => { bloque.texto = textarea.value; });
      contenido.appendChild(textarea);
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
  for (const archivo of archivos) {
    try {
      const { blob, previewUrl } = await redimensionarImagen(archivo);
      bloques.push({ tipo: "imagen", blob, previewUrl });
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
    btn.textContent = "Vista previa (sin guardar)";
  }
});

// ---- listado ----
function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

function renderTabla(cartas) {
  tbody.innerHTML = "";
  sinCartas.classList.toggle("oculto", cartas.length > 0);

  cartas.forEach((c) => {
    const fila = document.createElement("tr");
    fila.appendChild(celda(c.radicado));
    fila.appendChild(celda(c.fecha || ""));
    fila.appendChild(celda(c.destinatario || ""));
    fila.appendChild(celda(c.asunto || ""));

    const tdAccion = document.createElement("td");
    tdAccion.className = "control-tabla-acciones";

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

    const btnSubirWord = document.createElement("button");
    btnSubirWord.type = "button";
    btnSubirWord.className = "control-btn-mini";
    btnSubirWord.textContent = "Cargar Word editado";
    btnSubirWord.title = "Sube el .docx ya ajustado a mano (ej. imagen centrada) para que quede como la versión oficial de esta carta";
    btnSubirWord.addEventListener("click", () => {
      cartaIdParaSubirWord = c.id;
      inputWordFinal.click();
    });

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

    tdAccion.append(btnPdf, btnWord, btnSubirWord, btnBorrar);
    fila.appendChild(tdAccion);

    tbody.appendChild(fila);
  });
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

  const q = query(collection(db, "correspondencia"), orderBy("creadoEn", "desc"));
  onSnapshot(q, (snapshot) => {
    renderTabla(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });

  // orderBy("creadoEn") y no "codigo": los contratos de antes de esta
  // función no tienen "codigo" y quedarían fuera si se ordenara por ese
  // campo. Las reglas de Firestore ya filtran qué contratos ve cada quien.
  const contratosSnap = await getDocs(query(collection(db, "contratos"), orderBy("creadoEn", "desc")));
  contratosSnap.forEach((docSnap) => {
    const c = docSnap.data();
    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = `${c.codigo || "(sin código)"} — ${c.nombre}`;
    selectContrato.appendChild(opt);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    crearBtn.disabled = true;
    crearBtn.textContent = "Generando...";
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
          ...datosBase, bloques: bloquesFinal, radicado, anio, consecutivo: siguiente,
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

      const pdf = await generarCartaPDF({ ...datosBase, bloques: bloquesFinal, radicado });
      pdf.save(`${radicado}.pdf`);

      form.reset();
      document.getElementById("ciudad").value = "Neiva";
      bloques = [{ tipo: "texto", texto: "" }];
      renderBloques();
      form.closest("details").open = false;
      mostrarAlerta(`Carta ${radicado} generada y descargada.`, "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo generar la carta.", "error");
    } finally {
      crearBtn.disabled = false;
      crearBtn.textContent = "Generar y descargar carta";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
