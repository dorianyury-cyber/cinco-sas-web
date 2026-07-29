import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, deleteDoc, updateDoc, setDoc, runTransaction,
  serverTimestamp, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth } from "./firebase-control.js";
import { generarInformePDF } from "./informes-pdf.js";

const TIPO_LABEL = {
  gestion: "Informe de gestión", mediciones: "Informe de mediciones",
  consultoria: "Informe de consultoría", interventoria: "Informe de interventoría", otro: "Otro"
};

const tbody = document.getElementById("listaInformes");
const sinInformes = document.getElementById("sinInformes");
const form = document.getElementById("nuevoInformeForm");
const alertBox = document.getElementById("crearInformeAlert");
const guardarBtn = document.getElementById("guardarInformeBtn");
const cancelarEdicionBtn = document.getElementById("cancelarEdicionInformeBtn");
const informeIdEnEdicion = document.getElementById("informeIdEnEdicion");
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

// ---- editor de bloques: título1/título2/título3/párrafo/tabla/imagen,
// reordenables — mismo patrón que Correspondencia, con más tipos de
// bloque porque un informe necesita índice (los títulos) y tablas. ----
let bloques = [];

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

function limpiarFormulario() {
  form.reset();
  bloques = [];
  renderBloques();
  informeIdEnEdicion.value = "";
  guardarBtn.textContent = "Generar y descargar informe";
  cancelarEdicionBtn.classList.add("oculto");
}

cancelarEdicionBtn.addEventListener("click", limpiarFormulario);

// ---- listado ----
function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

function cargarEnFormulario(informe) {
  document.getElementById("titulo").value = informe.titulo || "";
  document.getElementById("tipoInforme").value = informe.tipoInforme || "gestion";
  document.getElementById("mes").value = informe.mes || "";
  selectContrato.value = informe.contratoId || "";
  document.getElementById("firmaNombre").value = informe.firmaNombre || "";
  document.getElementById("firmaCargo").value = informe.firmaCargo || "";
  bloques = (informe.bloques || []).map((b) => ({ ...b }));
  renderBloques();
  informeIdEnEdicion.value = informe.id;
  guardarBtn.textContent = "Guardar cambios y descargar";
  cancelarEdicionBtn.classList.remove("oculto");
  document.getElementById("nuevoInformeDetails").open = true;
  document.getElementById("nuevoInformeDetails").scrollIntoView({ behavior: "smooth" });
}

function renderTabla(informes) {
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

    const btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "control-btn-mini";
    btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => cargarEnFormulario(inf));

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

    tdAccion.append(btnPdf, btnEditar, btnBorrar);
    fila.appendChild(tdAccion);
    tbody.appendChild(fila);
  });
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  const q = query(collection(db, "informes"), orderBy("creadoEn", "desc"));
  onSnapshot(q, (snapshot) => {
    renderTabla(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    opt.textContent = `${c.codigo || "(sin código)"} — ${c.nombre}`;
    selectContrato.appendChild(opt);
  });

  renderBloques();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    guardarBtn.disabled = true;
    const enEdicion = !!informeIdEnEdicion.value;
    guardarBtn.textContent = enEdicion ? "Guardando..." : "Generando...";
    alertBox.className = "form-alert";

    try {
      // Sube las imágenes del editor antes de guardar el registro.
      const idInforme = informeIdEnEdicion.value || doc(collection(db, "informes")).id;
      const bloquesFinal = [];
      let n = 0;
      for (const bloque of bloques) {
        if (bloque.tipo === "imagen" && bloque.blob) {
          n += 1;
          const archivoRef = ref(storage, `informes/${idInforme}/${n}.jpg`);
          await uploadBytes(archivoRef, bloque.blob);
          const url = await getDownloadURL(archivoRef);
          bloquesFinal.push({ tipo: "imagen", url, pieDeFoto: bloque.pieDeFoto || "" });
        } else if (bloque.tipo === "imagen") {
          bloquesFinal.push({ tipo: "imagen", url: bloque.url, pieDeFoto: bloque.pieDeFoto || "" });
        } else {
          bloquesFinal.push(bloque);
        }
      }

      const contratoId = selectContrato.value;
      const contrato = contratoId ? contratosPorId[contratoId] : null;
      const datosBase = {
        titulo: document.getElementById("titulo").value,
        tipoInforme: document.getElementById("tipoInforme").value,
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
        const contadorRef = doc(db, "contadores", `informe_${new Date().getFullYear()}`);
        let radicado;
        await runTransaction(db, async (tx) => {
          const contadorSnap = await tx.get(contadorRef);
          const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
          const anio = new Date().getFullYear();
          radicado = `IG-${anio}-${String(siguiente).padStart(3, "0")}`;
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

      const pdf = await generarInformePDF(informeFinal);
      pdf.save(`${informeFinal.radicado}.pdf`);

      limpiarFormulario();
      form.closest("details").open = false;
      mostrarAlerta(`Informe ${informeFinal.radicado} generado y descargado.`, "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo generar el informe.", "error");
    } finally {
      guardarBtn.disabled = false;
      guardarBtn.textContent = informeIdEnEdicion.value ? "Guardar cambios y descargar" : "Generar y descargar informe";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
