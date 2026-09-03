// Emite (vía HTTP, con el mismo secreto compartido que ya usa
// recibirStaffConecta.js) el radicado oficial "IG-{año}-###" para un
// informe de gestión generado en Cinco Conecta (otro proyecto Firebase —
// ver web/js/informes-gestion.js allá), y lo deja registrado como
// documento del contrato correspondiente, igual que hace
// web/js/control/informes.js con los informes de tipo "gestion" creados
// aquí mismo. Así ambos sistemas comparten UNA sola numeración de
// radicados IG por año, sin importar en cuál de los dos se generó el
// informe.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const CONECTA_SYNC_SECRET = defineSecret("CONECTA_SYNC_SECRET");

exports.emitirRadicadoInformeGestion = onRequest({ secrets: [CONECTA_SYNC_SECRET], cors: false }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }
  if (req.get("x-sync-secret") !== CONECTA_SYNC_SECRET.value()) { res.status(401).send("Unauthorized"); return; }

  const contratoCodigo = String(req.body?.contratoCodigo || "").trim();
  const titulo = String(req.body?.titulo || "").trim();
  const mes = req.body?.mes ? String(req.body.mes).trim() : null; // "YYYY-MM"
  const informeId = String(req.body?.informeId || "").trim();
  const url = req.body?.url ? String(req.body.url).trim() : null;
  if (!contratoCodigo || !titulo || !informeId) {
    res.status(400).json({ error: "Faltan datos (contratoCodigo, titulo, informeId)." });
    return;
  }

  const db = admin.firestore();
  const contratoSnap = await db.collection("contratos").where("codigo", "==", contratoCodigo).limit(1).get();
  if (contratoSnap.empty) {
    res.status(404).json({ error: `No se encontró en Control de Contratos ningún contrato con código "${contratoCodigo}". Revisa que el campo "Contrato" del informe coincida exactamente con el código del contrato allá.` });
    return;
  }
  const contratoDoc = contratoSnap.docs[0];
  const contrato = contratoDoc.data();

  const anio = new Date().getFullYear();
  const contadorRef = db.collection("contadores").doc(`informe_IG_${anio}`);
  let radicado;
  try {
    await db.runTransaction(async (tx) => {
      const contadorSnap = await tx.get(contadorRef);
      let siguiente;
      if (contadorSnap.exists) {
        siguiente = contadorSnap.data().siguiente;
      } else {
        // Misma migración que web/js/control/informes.js: si el contador
        // "informe_IG_{año}" nunca se ha creado, se sigue desde el contador
        // legado único ("informe_{año}") para no repetir radicados IG ya
        // usados por ese módulo.
        const legacyRef = db.collection("contadores").doc(`informe_${anio}`);
        const legacySnap = await tx.get(legacyRef);
        siguiente = legacySnap.exists ? legacySnap.data().siguiente : 1;
      }
      radicado = `IG-${anio}-${String(siguiente).padStart(3, "0")}`;
      tx.set(contadorRef, { siguiente: siguiente + 1 });
      const docRef = contratoDoc.ref.collection("documentos").doc();
      tx.set(docRef, {
        codigo: radicado,
        nombre: titulo,
        tipo: "interno",
        mes: mes || null,
        origen: "informesGestion-conecta",
        refId: informeId,
        enlace: url || null,
        creadoPor: "Cinco Conecta",
        creadoEn: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "No se pudo generar el radicado." });
    return;
  }

  res.status(200).json({ radicado, contratoId: contratoDoc.id, contratoNombre: contrato.nombre || "" });
});
