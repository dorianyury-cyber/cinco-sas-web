// APU PRO — cálculo de un análisis de precios unitarios (puro: sin Firebase ni DOM).
// Mismo método de los presupuestos de Cinco S.A.S. (página anterior, PR-36, PR-38, CSS 226),
// con redondeo hacia arriba al peso en cada línea, como sus Excel:
//   A. Material         = precio × factor de materiales × (1 + desperdicio) × cantidad
//   B. Mano de obra     = (jornal + prestaciones) × cantidad ÷ rendimiento
//   C. Equipos y herr.  = valor mensual × (cantidad ÷ días hábiles) ÷ rendimiento
//   D. EPP y dotación   = valor mensual × (personas ÷ días hábiles) ÷ rendimiento
//                         (personas = suma de la cuadrilla, o una cantidad fija)
//   E. Transporte       = valor mensual × (cantidad ÷ días hábiles) ÷ rendimiento,
//                         o valor por unidad × cantidad si el insumo es por unidad (ton·km, m³)
// El rendimiento es la cantidad de unidades del APU que la cuadrilla ejecuta en un día.
import { jornalMO, valorMensual } from "./ap-calculos.js";

export const CAPITULOS = [
  { tipo: "MA", letra: "A", nombre: "Materiales" },
  { tipo: "MO", letra: "B", nombre: "Mano de obra" },
  { tipo: "EH", letra: "C", nombre: "Equipos y herramientas" },
  { tipo: "ED", letra: "D", nombre: "EPP y dotación" },
  { tipo: "TV", letra: "E", nombre: "Transporte y viaticación" }
];

// Redondeo hacia arriba al peso, tolerante al error de coma flotante (73125,0000001 → 73125).
export const redondearArriba = (x) => (Number.isFinite(x) && x > 0 ? Math.ceil(x - 1e-7) : 0);
// Redondeo de cada línea: "arriba" (CSS 226, ROUNDUP), "normal" (página anterior de Cinco).
export const REDONDEOS = { arriba: "Hacia arriba al peso (como CSS 226)", normal: "Al peso más cercano (como la página anterior)" };
const redondear = (x, modo) => (!Number.isFinite(x) || x <= 0 ? 0 : modo === "normal" ? Math.round(x) : redondearArriba(x));

// apu: { rendimiento, lineas: { MA: [{ codigo, cantidad, desperdicio }], MO: [...], EH: [...],
//        ED: [{ codigo, cantidad, modo: "cuadrilla" | "fija" }], TV: [...] } }
// opciones:
//   insumo(codigo) → insumo de la base (o null)
//   parametros     → { smmlv, auxTransporte, prestacional, diasHabiles }
//   factorMateriales (1 por defecto): factor de proyección del proyecto
//   precio(linea, tipo, insumo) → { unitario } para sustituir el valor de la base (validación)
//   redondeo: "arriba" (por defecto) o "normal"
export function calcularApu(apu, { insumo, parametros, factorMateriales = 1, precio = null, redondeo = "arriba" } = {}) {
  const rend = Number(apu?.rendimiento) || 0;
  const dias = Number(parametros?.diasHabiles) || 21;
  const lineas = apu?.lineas || {};
  const personas = (lineas.MO || []).reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const avisos = [];
  if (!(rend > 0)) avisos.push("El rendimiento debe ser mayor que cero.");
  const res = { capitulos: {}, subtotales: {}, personas, dias, rendimiento: rend, avisos };
  for (const { tipo } of CAPITULOS) {
    const filas = (lineas[tipo] || []).map((l) => {
      const ins = insumo ? insumo(l.codigo) : null;
      const sub = precio ? precio(l, tipo, ins) : null;
      const cantidad = tipo === "ED" && l.modo !== "fija" ? personas : Number(l.cantidad) || 0;
      const f = { codigo: l.codigo, descripcion: ins?.descripcion || l.descripcion || "", unidad: ins?.unidad || l.unidad || "", cantidad, desperdicio: Number(l.desperdicio) || 0, modo: l.modo || "", falta: !ins && !sub };
      if (tipo === "MA") {
        const base = sub?.unitario ?? (ins?.precio != null ? Number(ins.precio) * factorMateriales : null);
        f.unitario = base;
        f.total = base == null ? 0 : redondear(base * (1 + f.desperdicio) * cantidad, redondeo);
      } else if (tipo === "MO") {
        const j = sub?.unitario != null ? { jornal: sub.unitario, prestaciones: sub.prestaciones || 0 } : jornalMO(ins?.factorSalarial, parametros);
        f.factor = ins?.factorSalarial ?? sub?.factor ?? null;
        f.jornal = j?.jornal ?? null;
        f.prestaciones = j?.prestaciones ?? null;
        f.unitario = j ? j.jornal + j.prestaciones : null;
        f.total = !j || !(rend > 0) ? 0 : redondear(f.unitario * cantidad / rend, redondeo);
      } else {
        const porUnidad = tipo === "TV" && ins?.base === "unidad";
        const mensual = sub?.unitario ?? (porUnidad ? Number(ins?.precio) : valorMensual(ins));
        f.unitario = mensual ?? null;
        f.porUnidad = porUnidad;
        if (mensual == null) f.total = 0;
        else if (porUnidad) f.total = redondear(mensual * cantidad, redondeo);
        else f.total = rend > 0 ? redondear(mensual * (cantidad / dias) / rend, redondeo) : 0;
      }
      if (f.falta) avisos.push(`${l.codigo}: no está en la base de insumos.`);
      else if (f.unitario == null) avisos.push(`${l.codigo}: sin precio${tipo === "MO" ? " (faltan parámetros del año)" : ""}.`);
      return f;
    });
    res.capitulos[tipo] = filas;
    res.subtotales[tipo] = filas.reduce((s, f) => s + f.total, 0);
  }
  res.costoDirecto = CAPITULOS.reduce((s, c) => s + res.subtotales[c.tipo], 0);
  return res;
}

// AIU e IVA sobre un costo directo. regimenIva: "utilidad" (IVA sobre la utilidad, contratos
// con AIU) o "total" (IVA sobre el subtotal). aiu en fracciones: { a: 0.15, i: 0.05, u: 0.05 }.
export function precioConAiu(cd, { aiu = { a: 0.15, i: 0.05, u: 0.05 }, iva = 0.19, regimenIva = "utilidad" } = {}) {
  const a = cd * aiu.a, i = cd * aiu.i, u = cd * aiu.u;
  const subtotal = cd + a + i + u;
  const valorIva = regimenIva === "total" ? subtotal * iva : u * iva;
  return { a, i, u, subtotal, iva: valorIva, total: subtotal + valorIva };
}

// Validación básica de un APU antes de guardarlo.
export function validarApu(apu) {
  const errores = [];
  if (!/^APU-[\w.-]+$/.test(apu.codigo || "")) errores.push("El código debe empezar por «APU-» (por ejemplo APU-720).");
  if (!String(apu.nombre || "").trim()) errores.push("Escribe el nombre del APU.");
  if (!String(apu.unidad || "").trim()) errores.push("Escribe la unidad del APU.");
  if (!(Number(apu.rendimiento) > 0)) errores.push("El rendimiento debe ser mayor que cero (unidades por día de la cuadrilla).");
  const n = CAPITULOS.reduce((s, c) => s + (apu.lineas?.[c.tipo]?.length || 0), 0);
  if (!n) errores.push("Agrega al menos un insumo.");
  for (const c of CAPITULOS) for (const l of apu.lineas?.[c.tipo] || []) {
    if (!l.codigo) errores.push(`Hay una línea sin insumo en ${c.nombre}.`);
    else if (!(c.tipo === "ED" && l.modo !== "fija") && !(Number(l.cantidad) > 0)) errores.push(`${l.codigo}: la cantidad debe ser mayor que cero.`);
  }
  return errores;
}
