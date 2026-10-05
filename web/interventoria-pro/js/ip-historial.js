// Historial de cambios de Interventoría PRO: quién creó, editó o eliminó
// cada registro, cuándo y qué cambió (valor anterior → nuevo).
//
// Cada entrada vive en ipContratos/{id}/historial y se escribe en el MISMO
// lote (writeBatch) que el cambio que documenta, así no puede quedar un
// cambio guardado sin su anotación por una falla a mitad de camino. Las
// reglas de Firestore solo permiten AGREGAR entradas: nadie puede editarlas
// ni borrarlas.

import { collection, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, moneda, fecha, mesLargo } from "./ip-core.js";

export const ACCIONES = { crear: "Creó", editar: "Editó", eliminar: "Eliminó", lista: "Cargó lista base", contrato: "Editó el contrato", correo: "Envió avisos por correo" };

export function refHistorial(contratoId) {
  return collection(db, "ipContratos", contratoId, "historial");
}

// Valor legible de un campo para el historial.
export function textoValor(campo, v, personal = []) {
  if (v === undefined || v === null || v === "") return "—";
  switch (campo?.type) {
    case "money": return moneda(v);
    case "date": return fecha(v);
    case "month": return mesLargo(v);
    case "pct": return `${v} %`;
    case "persona": return personal.find((p) => p.id === v)?.nombre || String(v);
    case "imagen": return "(foto)";
    case "avance": return Object.entries(v || {}).sort().map(([m, x]) => `${m}: ${x} %`).join(" · ") || "—";
    default: return String(v);
  }
}

// Campos que cambiaron entre el registro anterior y los datos nuevos.
export function diferencias(campos, antes = {}, despues = {}, personal = []) {
  const out = [];
  for (const c of campos) {
    if (!(c.key in despues)) continue;
    const a = JSON.stringify(antes[c.key] ?? null);
    const d = JSON.stringify(despues[c.key] ?? null);
    if (a === d || (antes[c.key] == null && (despues[c.key] === "" || despues[c.key] == null))) continue;
    out.push({ campo: c.key, etiqueta: c.label, antes: textoValor(c, antes[c.key], personal), despues: textoValor(c, despues[c.key], personal) });
  }
  return out;
}

// Agrega al lote la entrada de historial.
export function anotarEnLote(lote, contratoId, { user, perfil, modulo, moduloLabel, registroId = null, accion, resumen = "", cambios = [] }) {
  const entrada = doc(refHistorial(contratoId));
  lote.set(entrada, {
    modulo, moduloLabel, registroId, accion, resumen: String(resumen).slice(0, 300), cambios,
    usuario: user.email, usuarioNombre: perfil.nombre || user.email,
    fecha: serverTimestamp()
  });
  return entrada.id;
}

// Texto corto que identifica un registro (para el resumen del historial).
export function identificar(mod, r = {}) {
  const preferidos = ["requisito", "documento", "equipo", "descripcion", "nombre", "actividad", "obligacion", "amparo", "indicador", "riesgo", "tema", "concepto", "observacion", "texto", "componente", "trabajo", "norma"];
  const k = preferidos.find((p) => r[p]);
  const base = k ? String(r[k]) : "";
  const f = r.fecha || r.mes || "";
  return `${base}${f ? ` (${f})` : ""}`.trim().slice(0, 140);
}

export function fechaHora(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d || isNaN(d)) return "—";
  return d.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
