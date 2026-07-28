import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, getDoc, updateDoc, addDoc, collection, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth } from "./firebase-control.js";
import { nombreArea, nombreTipo } from "./documentos-plantillas.js";

const id = new URLSearchParams(window.location.search).get("id");
if (!id) window.location.href = "documentos.html";

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});

function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  const documentoRef = doc(db, "documentos", id);
  const documentoSnap = await getDoc(documentoRef);
  if (!documentoSnap.exists()) {
    window.location.href = "documentos.html";
    return;
  }
  const documento = documentoSnap.data();

  document.getElementById("documentoCodigo").textContent = documento.codigo;
  document.getElementById("documentoNombre").textContent = documento.nombre;
  document.getElementById("documentoArea").textContent = `${documento.area} — ${nombreArea(documento.area)}`;
  document.getElementById("documentoTipo").textContent = `${documento.tipo} — ${nombreTipo(documento.tipo)}`;
  document.getElementById("documentoCodigoAnterior").textContent =
    documento.codigoAnterior ? `Código anterior: ${documento.codigoAnterior}` : "";
  document.getElementById("documentoVersion").textContent = "Versión actual: v" + documento.versionActual;

  const nombreInput = document.getElementById("nombre");
  const enlaceInput = document.getElementById("enlace");
  nombreInput.value = documento.nombre || "";
  enlaceInput.value = documento.enlace || "";

  const guardar = (campoDoc, valor) =>
    updateDoc(documentoRef, { [campoDoc]: valor, actualizadoEn: serverTimestamp(), actualizadoPor: user.email });

  nombreInput.addEventListener("change", () => {
    guardar("nombre", nombreInput.value);
    document.getElementById("documentoNombre").textContent = nombreInput.value;
  });
  enlaceInput.addEventListener("change", () => guardar("enlace", enlaceInput.value));

  const estadoSelect = document.getElementById("documentoEstado");
  estadoSelect.value = documento.estado || "vigente";
  estadoSelect.addEventListener("change", () => {
    const nuevo = estadoSelect.value;
    const mensaje = nuevo === "obsoleto"
      ? "¿Marcar este documento como obsoleto? Deja de ser una referencia vigente."
      : "¿Reactivar este documento como vigente?";
    if (!window.confirm(mensaje)) {
      estadoSelect.value = documento.estado;
      return;
    }
    documento.estado = nuevo;
    guardar("estado", nuevo);
  });

  // ---- control de cambios ----
  const listaCambios = document.getElementById("listaCambios");

  function agregarFilaCambio(c) {
    const fila = document.createElement("tr");
    fila.appendChild(celda("v" + c.version));
    fila.appendChild(celda(c.fecha || ""));
    fila.appendChild(celda(c.motivo || ""));
    fila.appendChild(celda(c.hechoPor || ""));
    listaCambios.prepend(fila);
  }

  const cambiosSnap = await getDocs(query(collection(db, "documentos", id, "cambios"), orderBy("version")));
  cambiosSnap.docs.forEach((d) => agregarFilaCambio(d.data()));

  const nuevaVersionForm = document.getElementById("nuevaVersionForm");
  const nuevaVersionAlert = document.getElementById("nuevaVersionAlert");
  const nuevaVersionBtn = document.getElementById("nuevaVersionBtn");

  nuevaVersionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    nuevaVersionBtn.disabled = true;
    nuevaVersionBtn.textContent = "Guardando...";
    nuevaVersionAlert.className = "form-alert";

    const motivo = document.getElementById("motivo").value;
    const enlaceNuevo = document.getElementById("enlaceNuevaVersion").value;
    const version = (documento.versionActual || 1) + 1;

    try {
      await updateDoc(documentoRef, {
        versionActual: version,
        ...(enlaceNuevo ? { enlace: enlaceNuevo } : {}),
        actualizadoEn: serverTimestamp(),
        actualizadoPor: user.email
      });
      await addDoc(collection(db, "documentos", id, "cambios"), {
        version, fecha: hoyISO(), motivo, hechoPor: user.email, en: serverTimestamp()
      });

      documento.versionActual = version;
      document.getElementById("documentoVersion").textContent = "Versión actual: v" + version;
      if (enlaceNuevo) { enlaceInput.value = enlaceNuevo; documento.enlace = enlaceNuevo; }
      agregarFilaCambio({ version, fecha: hoyISO(), motivo, hechoPor: user.email });

      nuevaVersionForm.reset();
      nuevaVersionForm.closest("details").open = false;
      nuevaVersionAlert.textContent = "Nueva versión registrada.";
      nuevaVersionAlert.className = "form-alert show ok";
    } catch (err) {
      nuevaVersionAlert.textContent = err.message || "No se pudo registrar la versión.";
      nuevaVersionAlert.className = "form-alert show error";
    } finally {
      nuevaVersionBtn.disabled = false;
      nuevaVersionBtn.textContent = "Registrar versión";
    }
  });
});
