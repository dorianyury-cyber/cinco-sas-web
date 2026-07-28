import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-control.js";

// Si ya hay sesión activa, saltar directo a la lista de contratos.
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "contratos.html";
});

const form = document.getElementById("loginForm");
const alertBox = document.getElementById("loginAlert");
const submitBtn = document.getElementById("loginBtn");

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Ingresando...";
  alertBox.className = "form-alert";

  const email = document.getElementById("email").value;
  const clave = document.getElementById("clave").value;

  try {
    await signInWithEmailAndPassword(auth, email, clave);
    window.location.href = "contratos.html";
  } catch (err) {
    mostrarAlerta("Correo o clave incorrectos.", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Ingresar";
  }
});
