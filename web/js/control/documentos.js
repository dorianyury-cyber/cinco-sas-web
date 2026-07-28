import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, runTransaction, serverTimestamp,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth } from "./firebase-control.js";
import { AREAS, TIPOS, nombreArea, nombreTipo } from "./documentos-plantillas.js";

const ESTADO_LABEL = { vigente: "Vigente", obsoleto: "Obsoleto" };

const tbody = document.getElementById("listaDocumentos");
const sinDocumentos = document.getElementById("sinDocumentos");
const form = document.getElementById("nuevoDocumentoForm");
const alertBox = document.getElementById("crearDocumentoAlert");
const crearBtn = document.getElementById("crearDocumentoBtn");
const filtroArea = document.getElementById("filtroArea");
const filtroEstado = document.getElementById("filtroEstado");

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

function llenarSelect(select, opciones) {
  opciones.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.clave;
    opt.textContent = `${o.clave} — ${o.nombre}`;
    select.appendChild(opt);
  });
}

llenarSelect(document.getElementById("area"), AREAS);
llenarSelect(document.getElementById("tipo"), TIPOS);
llenarSelect(filtroArea, AREAS);

let documentos = [];

function celda(tag, texto) {
  const el = document.createElement(tag);
  el.textContent = texto;
  return el;
}

function renderTabla() {
  const area = filtroArea.value;
  const estado = filtroEstado.value;
  const filtrados = documentos.filter(
    (d) => (!area || d.area === area) && (!estado || d.estado === estado)
  );

  tbody.innerHTML = "";
  sinDocumentos.classList.toggle("oculto", filtrados.length > 0);

  filtrados.forEach((d) => {
    const fila = document.createElement("tr");
    fila.className = "control-fila-doc";
    fila.appendChild(celda("td", d.codigo));
    fila.appendChild(celda("td", d.nombre));
    fila.appendChild(celda("td", nombreArea(d.area)));
    fila.appendChild(celda("td", nombreTipo(d.tipo)));
    fila.appendChild(celda("td", "v" + d.versionActual));
    const tdEstado = celda("td", ESTADO_LABEL[d.estado] || d.estado);
    if (d.estado === "obsoleto") tdEstado.className = "text-muted";
    fila.appendChild(tdEstado);
    fila.addEventListener("click", () => { window.location.href = `documento.html?id=${d.id}`; });
    tbody.appendChild(fila);
  });
}

filtroArea.addEventListener("change", renderTabla);
filtroEstado.addEventListener("change", renderTabla);

requireAuth((user) => {
  document.getElementById("userEmail").textContent = user.email;

  const q = query(collection(db, "documentos"), orderBy("codigo"));
  onSnapshot(q, (snapshot) => {
    documentos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTabla();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    crearBtn.disabled = true;
    crearBtn.textContent = "Creando...";
    alertBox.className = "form-alert";

    const area = document.getElementById("area").value;
    const tipo = document.getElementById("tipo").value;
    const nombre = document.getElementById("nombre").value;
    const enlace = document.getElementById("enlace").value;
    const codigoAnterior = document.getElementById("codigoAnterior").value;

    try {
      const contadorRef = doc(db, "contadores", `${area}_${tipo}`);
      const documentoRef = doc(collection(db, "documentos"));
      const cambioRef = doc(collection(db, "documentos", documentoRef.id, "cambios"));

      await runTransaction(db, async (tx) => {
        const contadorSnap = await tx.get(contadorRef);
        const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
        const codigo = `${area}-${tipo}-${String(siguiente).padStart(3, "0")}`;

        tx.set(contadorRef, { siguiente: siguiente + 1 });
        tx.set(documentoRef, {
          codigo, area, tipo, consecutivo: siguiente, nombre, enlace,
          versionActual: 1, estado: "vigente", codigoAnterior: codigoAnterior || "",
          creadoPor: user.email, creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(), actualizadoPor: user.email
        });
        tx.set(cambioRef, {
          version: 1,
          fecha: new Date().toISOString().slice(0, 10),
          motivo: codigoAnterior ? `Recodificación desde ${codigoAnterior}` : "Alta inicial",
          hechoPor: user.email,
          en: serverTimestamp()
        });
      });

      form.reset();
      form.closest("details").open = false;
      mostrarAlerta("Documento creado.", "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo crear el documento.", "error");
    } finally {
      crearBtn.disabled = false;
      crearBtn.textContent = "Crear documento";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
