// Bitácora de actuaciones de un contrato (contratos/{id}/actividad): quién hizo qué y cuándo.
// Solo se agregan registros; las reglas de Firestore impiden editarlos o borrarlos.
import {
  collection, doc, setDoc, onSnapshot, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { armarRegistro } from "./actividad-motor.js";

let contexto = null;
let registros = [];
const oyentes = new Set();

export function iniciarBitacora({ db, contratoId, user, nombre }) {
  contexto = { db, contratoId, user, nombre };
  onSnapshot(
    query(collection(db, "contratos", contratoId, "actividad"), orderBy("en", "desc"), limit(500)),
    (snap) => {
      registros = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))
        .map((r) => ({ ...r, en: r.en && typeof r.en.toDate === "function" ? r.en.toDate() : r.en }));
      oyentes.forEach((fn) => fn(registros));
    },
    () => { /* sin permiso de lectura: la bitácora queda vacía */ }
  );
}

export function actividadActual() { return registros; }

export function alCambiarActividad(fn) {
  oyentes.add(fn);
  fn(registros);
}

// Nunca interrumpe la acción del usuario: si no se puede registrar, solo avisa en consola.
export async function registrarActividad(datos) {
  if (!contexto) return;
  try {
    const r = armarRegistro({ por: contexto.user.email, nombre: contexto.nombre, ...datos });
    await setDoc(doc(collection(contexto.db, "contratos", contexto.contratoId, "actividad")), { ...r, en: serverTimestamp() });
  } catch (err) {
    console.warn("No se pudo registrar en la bitácora:", err);
  }
}
