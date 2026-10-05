// Ingreso a Interventoría PRO: mismo flujo que el Control de Contratos
// (web/js/control/auth.js) — primero la cuenta propia de Cinco SAS y, si
// no existe o la clave no coincide, la de Cinco Conecta vía la Cloud
// Function iniciarSesionConConecta. El permiso real lo decide el perfil
// en "empleados" y la pertenencia al equipo de cada contrato.
import { signInWithEmailAndPassword, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { auth, app } from "../../js/control/firebase-control.js";
import { agregarToggleClave } from "../../js/control/clave-visible.js";

agregarToggleClave(document.getElementById("clave"));
try { sessionStorage.removeItem("ip-nav-abiertos"); } catch (e) { /* sin almacenamiento */ }
const functions = getFunctions(app);

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "bienvenida.html";
});

const form = document.getElementById("loginForm");
const alerta = document.getElementById("loginAlert");
const btn = document.getElementById("loginBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = "Ingresando...";
  alerta.className = "alert";
  const email = document.getElementById("email").value.trim();
  const clave = document.getElementById("clave").value;
  try {
    await signInWithEmailAndPassword(auth, email, clave);
    window.location.href = "bienvenida.html";
  } catch (err) {
    try {
      const { data } = await httpsCallable(functions, "iniciarSesionConConecta")({ email, password: clave });
      await signInWithCustomToken(auth, data.customToken);
      window.location.href = "bienvenida.html";
    } catch (err2) {
      alerta.textContent = "Correo o contraseña incorrectos.";
      alerta.className = "alert error";
      btn.disabled = false;
      btn.textContent = "Ingresar";
    }
  }
});
