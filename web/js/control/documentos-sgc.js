// Da de alta un documento ya generado en otro módulo (Informes, Ofertas...)
// como documento controlado del SGC, en la misma colección "documentos" que
// alimenta el Listado Maestro (documentos.html) — misma transacción de
// código único (contador por área+tipo) que usa documentos.js al crear un
// documento directo, reutilizada aquí para no duplicarla en cada módulo.
import {
  collection, doc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function registrarDocumentoSGC(db, { area, tipo, nombre, enlace = "", origen, refId, user }) {
  const contadorRef = doc(db, "contadores", `${area}_${tipo}`);
  const documentoRef = doc(collection(db, "documentos"));
  const cambioRef = doc(collection(db, "documentos", documentoRef.id, "cambios"));
  let codigo;

  await runTransaction(db, async (tx) => {
    const contadorSnap = await tx.get(contadorRef);
    const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
    codigo = `${area}-${tipo}-${String(siguiente).padStart(3, "0")}`;

    tx.set(contadorRef, { siguiente: siguiente + 1 });
    tx.set(documentoRef, {
      codigo, area, tipo, consecutivo: siguiente, nombre, enlace,
      versionActual: 1, estado: "vigente", codigoAnterior: "",
      origen, refId,
      creadoPor: user.email, creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(), actualizadoPor: user.email
    });
    tx.set(cambioRef, {
      version: 1,
      fecha: new Date().toISOString().slice(0, 10),
      motivo: "Alta inicial",
      hechoPor: user.email,
      en: serverTimestamp()
    });
  });

  return codigo;
}
