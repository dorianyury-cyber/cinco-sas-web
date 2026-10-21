// APU PRO — lectura de un presupuesto para otros aplicativos (Ofertas, Interventoría PRO).
// No usa ap-core.js (que agrega el botón de tema y la sesión de APU PRO a la página):
// recibe el `db` del aplicativo que lo llama y calcula con el mismo motor de APU PRO.
// Leer apProyectos exige el permiso «APU PRO» (puedeApuPro en firestore.rules).
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { calcularPresupuesto, resolverInsumo } from "./ap-presupuesto.js";

export function mensajePermiso(err) {
  return String(err?.code || "").includes("permission-denied")
    ? "Tu cuenta no tiene el permiso «APU PRO» (se marca en Empleados): sin él no se pueden leer los presupuestos."
    : err?.message || "No se pudo leer APU PRO.";
}

export async function listarPresupuestosApu(db) {
  const snap = await getDocs(collection(db, "apProyectos"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, cliente: p.cliente || "", tipo: p.tipo || "obra", sitios: p.sitios || [], resumen: p.resumen || {} }))
    .sort((a, b) => String(b.codigo).localeCompare(String(a.codigo), "es", { numeric: true }));
}

// Presupuesto calculado y aplanado en filas: una por ítem, con su costo directo unitario y
// la cantidad de cada sitio. codigo = «capítulo.ítem» (1.1, 1.2…), como en el formato Cinco.
export async function presupuestoApu(db, id) {
  const snap = await getDoc(doc(db, "apProyectos", id));
  if (!snap.exists()) throw new Error("No se encontró el presupuesto en APU PRO.");
  const proyecto = { id: snap.id, ...snap.data() };
  const [parSnap, parTodos] = await Promise.all([getDoc(doc(db, "apParametros", String(proyecto.anioParametros))), getDocs(collection(db, "apParametros"))]);
  const parametros = parSnap.exists() ? parSnap.data() : parTodos.docs.map((d) => d.data()).sort((a, b) => b.anio - a.anio)[0] || null;
  // Con precios congelados basta la copia del proyecto; si falta alguno se lee la base.
  const usados = new Set();
  for (const cap of proyecto.capitulos || []) for (const it of cap.items || []) for (const ls of Object.values(it.apu?.lineas || {})) for (const l of ls) usados.add(l.codigo);
  const congelados = proyecto.precios || {};
  let base = new Map();
  if ([...usados].some((c) => !congelados[c])) {
    const ins = await getDocs(collection(db, "apInsumos"));
    base = new Map(ins.docs.map((d) => [d.data().codigo || d.id, d.data()]));
  }
  const calc = calcularPresupuesto(proyecto, { insumo: resolverInsumo(proyecto, base), parametros });
  const filas = [];
  calc.capitulos.forEach((cap, ci) => cap.items.forEach((it, ii) => {
    filas.push({
      codigo: `${ci + 1}.${ii + 1}`, capitulo: `${ci + 1} ${cap.nombre}`, codigoApu: it.apu?.codigo || "", descripcion: it.apu?.nombre || "", unidad: it.apu?.unidad || "",
      valorUnitario: it.vu, cantidades: Object.fromEntries(calc.sitios.map((s) => [s.id, it.cantidades[s.id] || 0])), cantidadTotal: it.cantidadTotal, total: it.total
    });
  }));
  return { proyecto, calc, filas, sitios: calc.sitios, avisos: calc.avisos };
}
