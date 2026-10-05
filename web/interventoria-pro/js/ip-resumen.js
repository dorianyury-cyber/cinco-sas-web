// Estado de un contrato (indicadores + alertas de todos los módulos),
// calculado igual en Inicio (un contrato) y en el Tablero de contratos
// (todos los visibles), para que ambos digan siempre lo mismo.
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, diasEntre, hoyISO } from "./ip-core.js";
import { MODULOS, avancePonderado, estadoFinanciero } from "./ip-modulos.js";

const CON_ALERTAS = Object.values(MODULOS).filter((m) => m.alertas && !m.porCapitulo);
const COLECCIONES = new Set(["personal", "actividades", "financiero", "garantias"]);
CON_ALERTAS.forEach((m) => { COLECCIONES.add(m.coleccion); (m.necesita || []).forEach((c) => COLECCIONES.add(c)); });

// Lee una vez cada colección que necesitan los indicadores y las alertas.
export async function cargarDatosContrato(contratoId) {
  const datos = {};
  await Promise.all([...COLECCIONES].map(async (c) => {
    const snap = await getDocs(collection(db, "ipContratos", contratoId, c));
    datos[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }));
  return datos;
}

export function resumirContrato(contrato, datos) {
  const hoy = hoyISO();
  const tecnico = avancePonderado(datos.actividades);
  const ef = estadoFinanciero(contrato, datos.financiero);
  const tiempo = contrato.fechaInicio && contrato.fechaFin
    ? Math.max(0, Math.min(100, Math.round((diasEntre(contrato.fechaInicio, hoy) / (diasEntre(contrato.fechaInicio, contrato.fechaFin) || 1)) * 100)))
    : 0;
  const diasRestantes = contrato.fechaFin ? diasEntre(hoy, contrato.fechaFin) : null;
  const activos = datos.personal.filter((p) => p.estado !== "Retirado" && (!p.fechaRetiro || p.fechaRetiro >= hoy)).length;
  const garantiasMal = datos.garantias.filter((g) => MODULOS.garantias.validar(g).nivel !== "ok").length;

  const alertas = [];
  CON_ALERTAS.forEach((m) => {
    (m.alertas({ contrato, registros: datos[m.coleccion] || [], datos }) || []).forEach((a) => alertas.push({ ...a, modulo: m }));
  });
  alertas.sort((a, b) => (a.nivel === "danger" ? 0 : 1) - (b.nivel === "danger" ? 0 : 1));
  const rojas = alertas.filter((a) => a.nivel === "danger").length;

  // Semáforo general del contrato: en riesgo si hay alertas rojas, el plazo
  // venció o el avance técnico va más de 5 puntos atrás de lo programado.
  const atrasado = tecnico.real < tecnico.programado - 5;
  const plazoVencido = diasRestantes != null && diasRestantes < 0 && contrato.estado !== "Liquidado" && contrato.estado !== "Terminado";
  const semaforo = rojas || atrasado || plazoVencido ? "riesgo" : alertas.length ? "atencion" : "ok";
  return { tecnico, ef, tiempo, diasRestantes, activos, garantiasMal, alertas, rojas, atrasado, plazoVencido, semaforo };
}
