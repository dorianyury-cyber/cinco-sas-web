import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";
import { firebaseConfig, RECAPTCHA_SITE_KEY } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// App Check se activa solo cuando ya se configuró una site key real de
// reCAPTCHA v3 en el proyecto (paso manual en Firebase Console) — mientras
// tanto el formulario sigue funcionando sin bloquear a nadie.
if (RECAPTCHA_SITE_KEY && RECAPTCHA_SITE_KEY !== "PENDIENTE") {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
}

const form = document.getElementById("pqrForm");
const alertBox = document.getElementById("pqrAlert");
const submitBtn = document.getElementById("pqrSubmitBtn");

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";
  alertBox.className = "form-alert";

  const datos = {
    nombres: document.getElementById("nombres").value,
    apellidos: document.getElementById("apellidos").value,
    email: document.getElementById("email").value,
    telefono: document.getElementById("telefono").value,
    empresa: document.getElementById("empresa").value,
    asunto: document.getElementById("asunto").value,
    descripcion: document.getElementById("descripcion").value,
    sitioWeb: document.getElementById("sitioWeb").value
  };

  try {
    const llamada = httpsCallable(functions, "enviarPQR");
    await llamada(datos);
    mostrarAlerta("¡Gracias! Tu PQR fue enviado correctamente, te contactaremos pronto.", "ok");
    form.reset();
  } catch (err) {
    mostrarAlerta(err.message || "No se pudo enviar el formulario. Intenta de nuevo.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Enviar";
  }
});
