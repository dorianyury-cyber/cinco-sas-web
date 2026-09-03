// Recibe (vía HTTP, con un secreto compartido) los empleados de Cinco
// Conecta ("staff" en ese proyecto — otro Firebase distinto, ver la nota
// en web/js/control/ordenes-trabajo.js) para que aparezcan como opción al
// asignar una Orden de Trabajo. Cinco Conecta empuja cada cambio desde su
// propia Cloud Function (functions/src/sincronizarStaffOrdenesTrabajo.js
// en ese repo) — acá solo se recibe y se guarda en "empleadosConecta".
//
// Por qué HTTP + secreto y no una regla de Firestore abierta: el
// directorio de Cinco Conecta solo lo pueden listar SUS PROPIOS empleados
// ya autenticados ahí (ver firestore.rules de ese proyecto) — no hay forma
// de que un usuario de Cinco SAS control lo lea directo desde el
// navegador sin debilitar esa regla. Este puente servidor-a-servidor deja
// la regla de Conecta intacta.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const CONECTA_SYNC_SECRET = defineSecret("CONECTA_SYNC_SECRET");

exports.recibirStaffConecta = onRequest({ secrets: [CONECTA_SYNC_SECRET], cors: false }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }
  if (req.get("x-sync-secret") !== CONECTA_SYNC_SECRET.value()) { res.status(401).send("Unauthorized"); return; }

  const registros = Array.isArray(req.body?.registros) ? req.body.registros : [];
  if (!registros.length) { res.status(400).json({ error: "Falta \"registros\"." }); return; }

  const db = admin.firestore();
  // 400 escrituras por batch es el límite de Firestore — el backfill inicial
  // trae a todo el staff de una vez, así que se reparte en varios batches
  // por si algún día pasan de 400 empleados.
  const lotes = [];
  for (let i = 0; i < registros.length; i += 400) lotes.push(registros.slice(i, i + 400));

  for (const lote of lotes) {
    const batch = db.batch();
    lote.forEach((r) => {
      if (!r?.uid) return;
      const ref = db.collection("empleadosConecta").doc(r.uid);
      if (r.borrado) {
        batch.delete(ref);
      } else {
        batch.set(ref, {
          nombre: String(r.nombre || "").slice(0, 120),
          correo: String(r.correo || "").slice(0, 160),
          cargo: String(r.cargo || "").slice(0, 120),
          cedula: String(r.cedula || "").slice(0, 20),
          telefono: String(r.telefono || "").slice(0, 20),
          estado: r.estado === "activo" ? "activo" : "inactivo",
          origen: "conecta",
          actualizadoEn: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    });
    await batch.commit();
  }

  res.status(200).json({ ok: true, procesados: registros.length });
});
