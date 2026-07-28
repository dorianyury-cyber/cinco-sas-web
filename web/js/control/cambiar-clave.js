import {
  signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, requireAuth } from "./firebase-control.js";

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});

const form = document.getElementById("cambiarClaveForm");
const alertBox = document.getElementById("cambiarClaveAlert");
const submitBtn = document.getElementById("cambiarClaveBtn");

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

const MENSAJES_ERROR = {
  "auth/wrong-password": "La clave actual no es correcta.",
  "auth/invalid-credential": "La clave actual no es correcta.",
  "auth/weak-password": "La clave nueva debe tener al menos 6 caracteres.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a intentar."
};

requireAuth((user) => {
  document.getElementById("userEmail").textContent = user.email;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const claveActual = document.getElementById("claveActual").value;
    const claveNueva = document.getElementById("claveNueva").value;
    const claveConfirmar = document.getElementById("claveConfirmar").value;

    if (claveNueva !== claveConfirmar) {
      mostrarAlerta("La clave nueva y la repetición no coinciden.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando...";
    alertBox.className = "form-alert";

    try {
      const credencial = EmailAuthProvider.credential(user.email, claveActual);
      await reauthenticateWithCredential(user, credencial);
      await updatePassword(user, claveNueva);
      mostrarAlerta("Clave actualizada correctamente.", "ok");
      form.reset();
    } catch (err) {
      mostrarAlerta(MENSAJES_ERROR[err.code] || "No se pudo cambiar la clave. Intenta de nuevo.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar nueva clave";
    }
  });
});
