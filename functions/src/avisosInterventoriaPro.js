// Avisos por correo de Interventoría PRO (web/interventoria-pro/avisos.html).
//
// El envío NO es automático (decisión del usuario): la interventoría abre
// "Avisos por correo", revisa lo que el aplicativo detecta como vencido o
// por vencer, marca qué avisos incluir, elige los destinatarios, agrega una
// nota si quiere y envía. Los avisos son internos: van al gestor (o
// gestores) de Interventoría PRO y, opcionalmente, a miembros del equipo
// del contrato; no se permiten correos externos. Una sola función callable
// con dos acciones:
//   - "calcular": devuelve los avisos del contrato, los gestores y el equipo.
//   - "enviar": envía el correo con los avisos y destinatarios elegidos y
//     deja constancia en ipContratos/{id}/avisos (envíos) y en el historial
//     de cambios.
// Pueden usarla el gestor de Interventoría PRO o los miembros del equipo
// del contrato.
//
// Reutiliza la cuenta de Gmail de pqr.js (SMTP_USER / SMTP_PASS en
// functions/.env, generado en el CI desde los secretos de GitHub). Las
// reglas replican, en el servidor, las alertas principales del aplicativo
// (web/interventoria-pro/js/ip-modulos.js); las fechas se guardan como
// "AAAA-MM-DD".

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const CORREO_GERENCIA = "gerencia.cincoltda@hotmail.com";
const nodemailer = require("nodemailer");

const URL_APP = "https://cincosas.com.co/interventoria-pro";
const MAX_DESTINATARIOS = 20;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------ fechas
function hoyBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function sumarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diasHasta(hoy, iso) {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86400000);
}
function fechaCorta(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "-";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function mesLargo(ym) {
  const [a, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}
function cuando(dias) {
  if (dias < 0) return `vencido hace ${-dias} día(s)`;
  if (dias === 0) return "vence hoy";
  return `vence en ${dias} día(s)`;
}
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ------------------------------------------------------------ reglas
// Cada aviso: { clave (única y estable), grupo, nivel: "rojo"|"amarillo",
// texto, modulo (para el enlace) }.
function calcularAvisos(contrato, d, hoy) {
  const avisos = [];
  const add = (clave, grupo, nivel, texto, modulo) => avisos.push({ clave, grupo, nivel, texto, modulo });

  if (contrato.fechaFin) {
    const n = diasHasta(hoy, contrato.fechaFin);
    if (n <= 30) add(`plazo:${contrato.fechaFin}`, "Contrato", n < 0 ? "rojo" : "amarillo", `El plazo del contrato ${cuando(n)} (${fechaCorta(contrato.fechaFin)}).`, null);
  }

  for (const g of d.garantias || []) {
    if (!g.vigenciaHasta) continue;
    const n = diasHasta(hoy, g.vigenciaHasta);
    if (n <= 30) add(`garantia:${g.id}:${g.vigenciaHasta}`, "Garantías", n < 0 ? "rojo" : "amarillo", `Póliza ${g.poliza || ""} (${g.amparo || "amparo"}): ${cuando(n)} — ${fechaCorta(g.vigenciaHasta)}.`, "garantias");
  }

  for (const r of d.requerimientos || []) {
    if (["Subsanado", "Cerrado", "Multa impuesta"].includes(r.estado) || !r.plazoRespuesta) continue;
    const n = diasHasta(hoy, r.plazoRespuesta);
    if (n <= 3) add(`req:${r.id}:${r.plazoRespuesta}`, "Requerimientos", n < 0 ? "rojo" : "amarillo", `Requerimiento ${r.radicado || ""} (${String(r.obligacion || "").slice(0, 90)}): respuesta ${cuando(n)}.`, "requerimientos");
  }

  // Seguridad social: planilla del mes anterior (desde el día 10)
  const personal = d.personal || [];
  if (Number(hoy.slice(8, 10)) >= 10) {
    const finAnt = sumarDias(`${hoy.slice(0, 7)}-01`, -1);
    const anterior = finAnt.slice(0, 7);
    const vinculados = personal.filter((p) => (p.fechaIngreso || "0000") <= finAnt && (!p.fechaRetiro || p.fechaRetiro >= `${anterior}-01`)).length;
    const dentro = (!contrato.fechaInicio || contrato.fechaInicio.slice(0, 7) <= anterior) && (!contrato.fechaFin || contrato.fechaFin.slice(0, 7) >= anterior);
    if (vinculados && dentro) {
      const planillas = (d.segsocial || []).filter((s) => s.mes === anterior);
      const cot = planillas.reduce((s, x) => s + (Number(x.cotizantes) || 0), 0);
      if (!planillas.length) add(`ss:${anterior}`, "Seguridad social", "rojo", `No se ha registrado la planilla de seguridad social de ${mesLargo(anterior)} (${vinculados} persona(s) vinculada(s)).`, "segsocial");
      else if (cot < vinculados) add(`ss:${anterior}:${cot}`, "Seguridad social", "rojo", `Planilla de ${mesLargo(anterior)}: ${cot} cotizante(s) pagado(s) para ${vinculados} persona(s) vinculada(s).`, "segsocial");
    }
  }

  const activos = personal.filter((p) => p.estado !== "Retirado" && (!p.fechaRetiro || p.fechaRetiro >= hoy));
  for (const p of activos) {
    const ult = (d.examenes || []).filter((e) => e.persona === p.id && e.tipo !== "Egreso").sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
    if (!ult || !ult.vence) continue;
    const n = diasHasta(hoy, ult.vence);
    if (n <= 15) add(`examen:${p.id}:${ult.vence}`, "Exámenes ocupacionales", n < 0 ? "rojo" : "amarillo", `${p.nombre}: examen periódico ${cuando(n)} (${fechaCorta(ult.vence)}).`, "examenes");
  }

  for (const e of d.entregables || []) {
    if (!["Radicado", "En revisión"].includes(e.estado) || !e.plazoRevision) continue;
    const n = diasHasta(hoy, e.plazoRevision);
    if (n <= 2) add(`entregable:${e.id}:${e.plazoRevision}`, "Plan de calidad y entregables", n < 0 ? "rojo" : "amarillo", `Revisión de «${String(e.documento || "").slice(0, 80)}»: ${cuando(n)}.`, "entregables");
  }

  for (const c of d.cambios || []) {
    if (!["Radicado", "En revisión"].includes(c.estado) || !c.plazoRespuesta) continue;
    const n = diasHasta(hoy, c.plazoRespuesta);
    if (n <= 2) add(`cambio:${c.id}:${c.plazoRespuesta}`, "Control de cambios", n < 0 ? "rojo" : "amarillo", `Solicitud de cambio (${String(c.descripcion || "").slice(0, 80)}): respuesta ${cuando(n)}.`, "cambios");
  }

  for (const nc of d.noconformidades || []) {
    if (String(nc.estado || "").startsWith("Cerrada") || !nc.fechaCompromiso) continue;
    const n = diasHasta(hoy, nc.fechaCompromiso);
    if (n < 0) add(`nc:${nc.id}:${nc.fechaCompromiso}`, "No conformidades", "rojo", `No conformidad (${String(nc.descripcion || "").slice(0, 80)}): cierre ${cuando(n)}.`, "noconformidades");
  }

  for (const s of d.suministros || []) {
    if (!s.fatProgramada || (s.fatResultado && s.fatResultado !== "Sin realizar")) continue;
    const n = diasHasta(hoy, s.fatProgramada);
    if (n <= 7) add(`fat:${s.id}:${s.fatProgramada}`, "Equipos y suministros", n < 0 ? "rojo" : "amarillo", `FAT de ${s.equipo}${s.proyecto ? ` (${s.proyecto})` : ""}: ${n < 0 ? `programada hace ${-n} día(s) y sin resultado` : n === 0 ? "programada para hoy" : `programada en ${n} día(s)`} — ${fechaCorta(s.fatProgramada)}.`, "suministros");
  }

  const actaFirmada = (d.cronologia || []).some((c) => c.tipo === "Acta de inicio");
  const pendientesActa = (d.actainicio || []).filter((r) => !["Aprobado", "No aplica"].includes(r.estado)).length;
  if (pendientesActa && actaFirmada) add(`acta:${pendientesActa}`, "Acta de inicio", "amarillo", `El acta de inicio ya se registró pero quedan ${pendientesActa} requisito(s) sin aprobar.`, "actainicio");

  return avisos;
}

const COLECCIONES = ["garantias", "requerimientos", "personal", "segsocial", "examenes", "entregables", "cambios", "noconformidades", "suministros", "cronologia", "actainicio"];

async function leerContrato(ref) {
  const d = {};
  await Promise.all(COLECCIONES.map(async (c) => {
    const snap = await ref.collection(c).get();
    d[c] = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
  }));
  return d;
}

// ------------------------------------------------------------ correo
function armarCorreo(contrato, avisos, hoy, { nota = "", remitente = "" } = {}) {
  const grupos = {};
  avisos.forEach((a) => { (grupos[a.grupo] = grupos[a.grupo] || []).push(a); });
  const rojos = avisos.filter((a) => a.nivel === "rojo").length;
  const titulo = `Contrato ${contrato.numero || ""}${contrato.contratante ? ` · ${contrato.contratante}` : ""}`;
  const bloques = Object.entries(grupos).map(([g, lista]) => {
    const mod = lista[0].modulo;
    const enlace = mod ? `${URL_APP}/modulo.html?m=${mod}&contrato=${contrato.id}` : `${URL_APP}/contratos.html?contrato=${contrato.id}`;
    return `<h3 style="margin:18px 0 6px;font:700 14px Arial;color:#1f2732">${esc(g)} <a href="${enlace}" style="font:400 12px Arial;color:#d99400">Ver en Interventoría PRO →</a></h3>
      <ul style="margin:0;padding-left:18px">${lista.map((a) => `<li style="margin:4px 0;font:13px Arial;color:${a.nivel === "rojo" ? "#b42828" : "#8a5a00"}">${esc(a.texto)}</li>`).join("")}</ul>`;
  }).join("");
  const notaHtml = nota ? `<div style="margin:12px 0;padding:10px 12px;border-left:4px solid #feb209;background:#fff8e6;font:13px Arial;color:#1f2732;white-space:pre-wrap">${esc(nota)}</div>` : "";
  const html = `<div style="max-width:640px;margin:0 auto;font-family:Arial,sans-serif">
    <div style="background:#1f2732;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
      <div style="font:700 16px Arial">Interventoría PRO — avisos de la interventoría</div>
      <div style="font:13px Arial;color:#feb209;margin-top:4px">${esc(titulo)}</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;padding:14px 20px 18px;border-radius:0 0 10px 10px">
      <p style="font:13px Arial;color:#374151">Revisión del ${fechaCorta(hoy)}: <strong>${avisos.length}</strong> aviso(s), <strong style="color:#b42828">${rojos}</strong> vencido(s).</p>
      ${notaHtml}
      ${bloques}
      <p style="margin-top:20px;font:12px Arial;color:#5c6570">Enviado por ${esc(remitente)} desde Interventoría PRO — CINCO S.A.S. Las respuestas a este correo llegan a ${CORREO_GERENCIA}.</p>
    </div></div>`;
  const texto = [`Interventoría PRO — ${titulo}`, `Revisión del ${fechaCorta(hoy)}: ${avisos.length} aviso(s).`, ""]
    .concat(nota ? [nota, ""] : [])
    .concat(Object.entries(grupos).flatMap(([g, l]) => [`${g}:`, ...l.map((a) => ` - ${a.texto}`), ""]))
    .concat([`Enviado por ${remitente} desde Interventoría PRO — CINCO S.A.S. Las respuestas a este correo llegan a ${CORREO_GERENCIA}.`]).join("\n");
  return { asunto: `${rojos ? "⚠ " : ""}Interventoría PRO · ${titulo}: ${avisos.length} aviso(s)`, html, texto };
}

// ------------------------------------------------------------ función
exports.enviarAvisosInterventoriaPro = onCall(async (request) => {
  const email = request.auth?.token?.email;
  if (!email) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  const db = admin.firestore();
  const emp = (await db.collection("empleados").doc(email).get()).data();
  if (!emp || emp.estado !== "activo") throw new HttpsError("permission-denied", "Tu cuenta no tiene un perfil activo.");
  const contratoId = String(request.data?.contratoId || "");
  if (!contratoId) throw new HttpsError("invalid-argument", "Falta el contrato.");
  const ref = db.collection("ipContratos").doc(contratoId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "No se encontró el contrato.");
  const contrato = { id: snap.id, ...snap.data() };
  const esGestor = emp.rol === "admin" || emp.gestionaInterventoriaPro === true;
  if (!esGestor && !(contrato.miembros || []).includes(email)) throw new HttpsError("permission-denied", "No perteneces al equipo de este contrato.");

  const hoy = hoyBogota();
  const avisos = calcularAvisos(contrato, await leerContrato(ref), hoy);

  // Los avisos son internos: van dirigidos a los gestores de Interventoría
  // PRO (y, si se quiere, a miembros del equipo del contrato). No se
  // permiten correos externos.
  const [porPermiso, porRol] = await Promise.all([
    db.collection("empleados").where("gestionaInterventoriaPro", "==", true).get(),
    db.collection("empleados").where("rol", "==", "admin").get()
  ]);
  const gestoresMap = new Map();
  [...porPermiso.docs, ...porRol.docs].forEach((d) => {
    const e = d.data();
    if (e.estado === "activo") gestoresMap.set(d.id.toLowerCase(), { email: d.id.toLowerCase(), nombre: e.nombre || d.id });
  });
  const gestores = [...gestoresMap.values()];
  const equipo = (await Promise.all((contrato.miembros || []).map(async (m) => {
    const e = (await db.collection("empleados").doc(m).get()).data();
    return { email: m.toLowerCase(), nombre: e?.nombre || m };
  }))).filter((m) => !gestoresMap.has(m.email));

  if (request.data?.accion !== "enviar") {
    // Solo calcular: la interventoría revisa antes de decidir.
    return { hoy, avisos, gestores, equipo };
  }

  // Enviar: solo los avisos elegidos (que sigan vigentes) y a los
  // destinatarios elegidos, que deben ser gestores o miembros del equipo.
  const elegidas = new Set(Array.isArray(request.data.claves) ? request.data.claves : []);
  const seleccion = avisos.filter((a) => elegidas.has(a.clave));
  if (!seleccion.length) throw new HttpsError("invalid-argument", "Elige al menos un aviso para enviar.");
  const permitidos = new Set([...gestores, ...equipo].map((x) => x.email));
  const para = [...new Set((Array.isArray(request.data.destinatarios) ? request.data.destinatarios : []).map((x) => String(x).trim().toLowerCase()).filter((x) => EMAIL_REGEX.test(x)))];
  if (!para.length) throw new HttpsError("invalid-argument", "Elige al menos un destinatario.");
  const externos = para.filter((x) => !permitidos.has(x));
  if (externos.length) throw new HttpsError("invalid-argument", `Solo se puede enviar a gestores de Interventoría PRO o al equipo del contrato (no válidos: ${externos.join(", ")}).`);
  if (para.length > MAX_DESTINATARIOS) throw new HttpsError("invalid-argument", `Máximo ${MAX_DESTINATARIOS} destinatarios por envío.`);
  const nota = String(request.data.nota || "").trim().slice(0, 2000);
  const remitente = emp.nombre || email;

  const correo = armarCorreo(contrato, seleccion, hoy, { nota, remitente });
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000
  });
  await transporter.sendMail({
    from: `"Gerencia Cinco S.A.S. - Interventoría PRO" <${process.env.SMTP_USER}>`,
    to: para.join(", "),
    // Las respuestas llegan a la gerencia aunque el envío técnico sea por la
    // cuenta Gmail de las PQR (Gmail no permite enviar como una cuenta Hotmail).
    replyTo: CORREO_GERENCIA,
    subject: correo.asunto,
    text: correo.texto,
    html: correo.html
  });

  // Constancia del envío y entrada en el historial de cambios.
  const lote = db.batch();
  const ahora = admin.firestore.FieldValue.serverTimestamp();
  lote.set(ref.collection("avisos").doc(), {
    fecha: ahora, usuario: email, usuarioNombre: remitente, destinatarios: para, nota,
    avisos: seleccion.map((a) => ({ grupo: a.grupo, nivel: a.nivel, texto: a.texto }))
  });
  lote.set(ref.collection("historial").doc(), {
    modulo: "avisos", moduloLabel: "Avisos por correo", registroId: null, accion: "correo",
    resumen: `${seleccion.length} aviso(s) enviados a ${para.length} destinatario(s)`,
    cambios: [{ campo: "destinatarios", etiqueta: "Destinatarios", antes: "—", despues: para.join(", ") }, ...seleccion.map((a) => ({ campo: a.clave, etiqueta: a.grupo, antes: "—", despues: a.texto }))].slice(0, 60),
    usuario: email, usuarioNombre: remitente, fecha: ahora
  });
  await lote.commit();
  return { enviados: seleccion.length, destinatarios: para };
});

// Para pruebas locales.
exports._calcularAvisos = calcularAvisos;
exports._armarCorreo = armarCorreo;
