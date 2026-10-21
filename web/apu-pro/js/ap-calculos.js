// APU PRO — cálculos puros (sin Firebase ni DOM), con el método heredado de los
// presupuestos de Cinco S.A.S. (PR-36, PR-38 y CSS 226):
//   jornal = factor salarial × (SMMLV + aux. transporte si el factor es ≤ 2) / días hábiles
//   prestaciones = % prestacional × jornal
//   equipos, EPP y transporte: valor mensual (o valor / (vida útil × 12)) / días hábiles / rendimiento

export const TIPOS = {
  MA: { nombre: "Materiales", singular: "Material", nuevo: "Nuevo material", icono: "🧱", prefijo: "MA-" },
  MO: { nombre: "Mano de obra", singular: "Cargo", nuevo: "Nuevo cargo", icono: "👷", prefijo: "MO-" },
  EH: { nombre: "Equipos y herramientas", singular: "Equipo o herramienta", nuevo: "Nuevo equipo o herramienta", icono: "🛠", prefijo: "EH-" },
  ED: { nombre: "EPP y dotación", singular: "Elemento de EPP o dotación", nuevo: "Nuevo elemento de EPP o dotación", icono: "🦺", prefijo: "ED-" },
  TV: { nombre: "Transporte y viaticación", singular: "Transporte", nuevo: "Nuevo transporte", icono: "🚚", prefijo: "TV-" }
};
export const ORDEN_TIPOS = ["MA", "MO", "EH", "ED", "TV"];

export const BASES = {
  mensual: "Valor mensual",
  vidaUtil: "Valor de compra con vida útil",
  unidad: "Valor por unidad"
};

// Parámetros de un año: { anio, smmlv, auxTransporte, prestacional (0,6 = 60 %), diasHabiles }.
// auxModo: "fijo" (por defecto, como la ley y la página anterior de Cinco: el auxilio de
// transporte se suma una vez a quien gana hasta 2 salarios mínimos) o "porFactor" (como
// CSS 226: el auxilio se multiplica por el factor salarial).
export const MODOS_AUXILIO = { fijo: "Una vez por trabajador (factor ≤ 2)", porFactor: "Multiplicado por el factor (como CSS 226)" };
export function jornalMO(factor, p) {
  const f = Number(factor) || 0;
  if (!p || !f) return null;
  const aux = f <= 2 ? Number(p.auxTransporte) || 0 : 0;
  const mensualBase = f * (Number(p.smmlv) || 0) + (p.auxModo === "porFactor" ? f * aux : aux);
  const base = mensualBase / (Number(p.diasHabiles) || 21);
  const prestaciones = (Number(p.prestacional) || 0) * base;
  return { jornal: base, prestaciones, total: base + prestaciones, mensual: (base + prestaciones) * (Number(p.diasHabiles) || 21) };
}

// Valor mensual de un equipo, EPP o transporte según su base.
export function valorMensual(ins) {
  const v = Number(ins?.precio);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (ins.base === "vidaUtil") {
    const vu = Number(ins.vidaUtilAnios);
    return vu > 0 ? v / (vu * 12) : null;
  }
  return v;
}

export function mesesDesde(fechaISO, hoy = new Date()) {
  if (!fechaISO) return null;
  const d = new Date(`${fechaISO}T12:00:00`);
  if (isNaN(d)) return null;
  return (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
}
// Estado del precio por antigüedad: vigente (≤ 6 meses), revisar (≤ 12), desactualizado.
export function estadoPrecio(fechaISO, hoy = new Date()) {
  const m = mesesDesde(fechaISO, hoy);
  if (m == null) return { clase: "muted", texto: "Sin fecha", meses: null };
  if (m <= 6) return { clase: "ok", texto: "Vigente", meses: m };
  if (m <= 12) return { clase: "warn", texto: "Revisar", meses: m };
  return { clase: "danger", texto: "Desactualizado", meses: m };
}

// IPP: puntos [{ fecha "AAAA-MM-DD", valor }]. Variación anual del último año y
// promedio anual compuesto de los últimos n años.
export function variacionIPP(puntos, anios = 1) {
  const s = [...(puntos || [])].filter((p) => p.fecha && p.valor > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (s.length < 13) return null;
  const ult = s[s.length - 1];
  const n = Math.min(anios * 12, s.length - 1);
  const ini = s[s.length - 1 - n];
  const tasa = Math.pow(ult.valor / ini.valor, 12 / n) - 1;
  return { tasaAnual: tasa, desde: ini.fecha, hasta: ult.fecha, meses: n };
}
// Factor para proyectar precios `anios` hacia adelante con una tasa anual.
export const factorProyeccion = (tasaAnual, anios) => Math.pow(1 + (Number(tasaAnual) || 0), Number(anios) || 0);

// Normaliza una descripción para buscar sin tildes ni mayúsculas.
export const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Siguiente código libre de un tipo (MA-01 con dos dígitos; los demás sin relleno).
export function siguienteCodigo(tipo, existentes) {
  const max = Math.max(0, ...existentes.filter((c) => c.startsWith(TIPOS[tipo].prefijo)).map((c) => Number(c.replace(/\D+/g, "")) || 0));
  return tipo === "MA" ? `MA-${String(max + 1).padStart(2, "0")}` : `${tipo}-${max + 1}`;
}
