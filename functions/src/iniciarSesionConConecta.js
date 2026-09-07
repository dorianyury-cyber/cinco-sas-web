// Punto pedido por el usuario: que un empleado pueda entrar a Cinco SAS
// control con LAS MISMAS credenciales que ya tiene en Cinco Conecta, sin
// crear una cuenta ni contraseña aparte acá. web/js/control/auth.js intenta
// primero el login normal contra el Auth propio de Cinco SAS control (por
// si la cuenta ya existe ahí); si falla, llama a esta función con el mismo
// correo/clave que el usuario tecleó.
//
// Cómo funciona sin fusionar los dos proyectos de Firebase (son proyectos
// distintos — cinco-sas y cinco-conecta — con su propio Auth cada uno): se
// valida el correo/clave llamando al REST de Identity Toolkit DEL PROYECTO
// CONECTA, servidor a servidor (no pasa por el navegador). Así no choca con
// el App Check de Conecta (web/js/utils.js de ese proyecto), que sí
// bloquearía un intento de inicio de sesión hecho desde el dominio de
// Cinco SAS con el SDK de cliente. Si Conecta confirma que la clave es
// correcta, se busca (o se crea, la primera vez que esa persona entra así)
// el usuario correspondiente en el Auth PROPIO de Cinco SAS control por
// correo, y se le entrega un customToken para que el navegador inicie
// sesión ahí con signInWithCustomToken — queda una sesión de verdad en
// Cinco SAS control, sin haber tenido que registrar una clave aparte.
//
// Importante: esto solo resuelve AUTENTICACIÓN (probar quién es). Los
// PERMISOS dentro de Cinco SAS control siguen dependiendo, como siempre, de
// que exista su perfil en la colección "empleados" (ver
// firebase-control.js: obtenerPerfil) — entrar así no le da de regalo
// ningún permiso que un administrador no le haya asignado ahí a mano.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// API key WEB (de cliente) del proyecto Cinco Conecta — la misma que ya
// está pública en el propio web/js/firebase-config.js de ese proyecto. Una
// API key de Firebase solo identifica el proyecto ante Google; no autoriza
// nada por sí sola (lo que de verdad protege son las reglas de Firestore/
// Storage y las de Identity Toolkit), así que no hace falta guardarla como
// secreto.
const CONECTA_API_KEY = "AIzaSyBbTEw5jG72FZcBV1YWe0uDGlUvhG3jbNM";

exports.iniciarSesionConConecta = onCall(async (request) => {
  const { email, password } = request.data || {};
  if (!email || !password) {
    throw new HttpsError("invalid-argument", "Correo y clave son obligatorios.");
  }

  let resultado;
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONECTA_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    );
    resultado = await resp.json();
    if (!resp.ok) throw new Error(resultado?.error?.message || "AUTH_FAILED");
  } catch (err) {
    throw new HttpsError("permission-denied", "Correo o clave incorrectos.");
  }

  const correoVerificado = resultado.email;
  let usuarioCincoSas;
  try {
    usuarioCincoSas = await admin.auth().getUserByEmail(correoVerificado);
  } catch (err) {
    if (err.code !== "auth/user-not-found") {
      throw new HttpsError("internal", "No se pudo iniciar sesión.");
    }
    usuarioCincoSas = await admin.auth().createUser({ email: correoVerificado, emailVerified: true });
  }

  const customToken = await admin.auth().createCustomToken(usuarioCincoSas.uid);
  return { customToken };
});
