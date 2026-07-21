const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Formulario público, sin inicio de sesión — por diseño no hay ninguna
// regla de Firestore que permita escribir "pqr" directamente desde el
// cliente (ver firestore.rules: allow read, write: if false en todo el
// proyecto). Todo pasa por esta Cloud Function, que valida, limita abuso y
// solo ella (con el Admin SDK) puede escribir el documento.
const DESTINATARIO = "gerencia.cincoltda@hotmail.com";
const LIMITE_POR_HORA = 5; // envíos máximos por email en una hora

const CAMPOS = {
  nombres: 80,
  apellidos: 80,
  email: 120,
  telefono: 20,
  empresa: 120,
  asunto: 150,
  descripcion: 2000
};
const REQUERIDOS = ["nombres", "apellidos", "email", "telefono", "empresa", "descripcion"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function limpiarTexto(valor, maxLargo) {
  return String(valor ?? "").trim().slice(0, maxLargo);
}

function buildTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
}

async function dentroDelLimite(email) {
  const haceUnaHora = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
  const snap = await admin.firestore()
    .collection("pqr")
    .where("email", "==", email)
    .where("creadoEn", ">=", haceUnaHora)
    .count()
    .get();
  return snap.data().count < LIMITE_POR_HORA;
}

async function enviarCorreoPQR(datos) {
  const transporter = buildTransporter();
  const lineas = [
    `Nombres: ${datos.nombres}`,
    `Apellidos: ${datos.apellidos}`,
    `Email: ${datos.email}`,
    `Teléfono: ${datos.telefono}`,
    `Empresa: ${datos.empresa}`,
    `Asunto: ${datos.asunto || "(sin asunto)"}`,
    "",
    "Descripción:",
    datos.descripcion
  ].join("\n");

  await transporter.sendMail({
    from: `"Cinco S.A.S. - PQR" <${process.env.SMTP_USER}>`,
    to: DESTINATARIO,
    replyTo: datos.email,
    subject: `Nueva PQR de ${datos.nombres} ${datos.apellidos}${datos.asunto ? " — " + datos.asunto : ""}`,
    text: lineas
  });
}

const enviarPQR = onCall(async (request) => {
  const data = request.data || {};

  // Campo trampa: si viene lleno, es casi seguro un bot — se responde éxito
  // sin guardar nada ni avisar que fue detectado.
  if (data.sitioWeb) {
    return { ok: true };
  }

  for (const campo of REQUERIDOS) {
    if (!String(data[campo] ?? "").trim()) {
      throw new HttpsError("invalid-argument", `Falta el campo obligatorio: ${campo}.`);
    }
  }

  const datos = {};
  for (const [campo, maxLargo] of Object.entries(CAMPOS)) {
    datos[campo] = limpiarTexto(data[campo], maxLargo);
  }

  if (!EMAIL_REGEX.test(datos.email)) {
    throw new HttpsError("invalid-argument", "El email no es válido.");
  }

  if (!(await dentroDelLimite(datos.email))) {
    throw new HttpsError("resource-exhausted", "Se alcanzó el límite de envíos por hora. Intenta más tarde.");
  }

  await admin.firestore().collection("pqr").add({
    ...datos,
    creadoEn: admin.firestore.FieldValue.serverTimestamp()
  });

  try {
    await enviarCorreoPQR(datos);
  } catch (err) {
    console.error("No se pudo enviar el correo de notificación de PQR:", err);
    // El PQR ya quedó guardado en Firestore aunque falle el correo — no se
    // le muestra un error al usuario por un problema que no depende de él.
  }

  return { ok: true };
});

module.exports = { enviarPQR };
