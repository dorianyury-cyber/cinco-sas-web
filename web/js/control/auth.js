import { signInWithEmailAndPassword, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { auth, app } from "./firebase-control.js";
import { agregarToggleClave } from "./clave-visible.js";

const functions = getFunctions(app);

agregarToggleClave(document.getElementById("clave"));

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
    return;
  } catch (err) {
    // Sin cuenta propia en Cinco SAS control (o clave distinta a la de acá)
    // — se intenta con las credenciales de Cinco Conecta, que es donde ya
    // las tiene creadas la mayoría del personal. iniciarSesionConConecta
    // valida el correo/clave contra el Auth de ese otro proyecto y, si es
    // correcto, entrega un customToken válido para el Auth de Cinco SAS
    // control (crea la cuenta ahí la primera vez). Que la autenticación
    // funcione así no le da ningún permiso extra dentro de Cinco SAS
    // control: eso lo sigue decidiendo el perfil en "empleados", que un
    // administrador tiene que crear a mano igual que siempre.
    try {
      const { data } = await httpsCallable(functions, "iniciarSesionConConecta")({ email, password: clave });
      await signInWithCustomToken(auth, data.customToken);
      window.location.href = "contratos.html";
    } catch (err2) {
      mostrarAlerta("Correo o clave incorrectos.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Ingresar";
    }
  }
});
