// APU PRO — cálculo de un presupuesto (puro: sin Firebase ni DOM).
// proyecto = {
//   anioParametros, aiu: { a, i, u }, iva, regimenIva: "utilidad" | "total",
//   factorMateriales, redondeo: "arriba" | "normal",
//   sitios: [{ id, nombre }],
//   capitulos: [{ id, nombre, items: [{ id, apu: { codigo, nombre, unidad, rendimiento, lineas, version },
//                                       cantidades: { [sitioId]: { valor, expresion } } }] }],
//   precios: { [codigoInsumo]: insumo } (precios congelados, opcional)
// }
import { calcularApu, precioConAiu } from "./ap-apu.js";

// Evalúa una memoria de cantidades: números con coma o punto, + - * / y paréntesis.
// "10*2 + 22*2 + 7" → 71. Devuelve null si la expresión no es válida.
// Expresión en notación de Excel ("1.384" con miles → 1384; "0,317" → 0.317; x → *).
export function normalizarExpresion(texto) {
  let s = String(texto ?? "").trim().replace(/^=/, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "");
  return s.replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, "").replace(/[x×]/gi, "*");
}
export function evaluarCantidad(texto) {
  const s = normalizarExpresion(texto);
  if (!s) return null;
  if (!/^[\d.+\-*/()]+$/.test(s)) return null;
  // Analizador descendente (la política de seguridad del sitio no permite eval/Function).
  let i = 0;
  const ver = () => s[i];
  function numeroLit() {
    const m = s.slice(i).match(/^\d+(\.\d+)?|^\.\d+/);
    if (!m) throw new Error("número");
    i += m[0].length;
    return Number(m[0]);
  }
  function factor() {
    if (ver() === "+") { i++; return factor(); }
    if (ver() === "-") { i++; return -factor(); }
    if (ver() === "(") { i++; const v = suma(); if (ver() !== ")") throw new Error(")"); i++; return v; }
    return numeroLit();
  }
  function producto() {
    let v = factor();
    while (ver() === "*" || ver() === "/") { const op = s[i++]; const d = factor(); v = op === "*" ? v * d : v / d; }
    return v;
  }
  function suma() {
    let v = producto();
    while (ver() === "+" || ver() === "-") { const op = s[i++]; const d = producto(); v = op === "+" ? v + d : v - d; }
    return v;
  }
  try {
    const v = suma();
    if (i !== s.length) return null;
    return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
  } catch (e) { return null; }
}

// Insumo con el precio congelado del proyecto si existe; si no, el de la base.
export function resolverInsumo(proyecto, base) {
  const congelados = proyecto?.precios || null;
  return (codigo) => (congelados && congelados[codigo]) || base.get(codigo) || null;
}

export function calcularPresupuesto(proyecto, { insumo, parametros }) {
  const sitios = proyecto.sitios?.length ? proyecto.sitios : [{ id: "s1", nombre: "Único" }];
  const opciones = { insumo, parametros, factorMateriales: Number(proyecto.factorMateriales) || 1, redondeo: proyecto.redondeo || "arriba" };
  const totalPorSitio = Object.fromEntries(sitios.map((s) => [s.id, 0]));
  const avisos = [];
  let n = 0;
  const capitulos = (proyecto.capitulos || []).map((cap) => {
    const sub = Object.fromEntries(sitios.map((s) => [s.id, 0]));
    const items = (cap.items || []).map((it) => {
      n++;
      const res = calcularApu(it.apu, opciones);
      const vu = res.costoDirecto;
      const cantidades = {}, totales = {};
      let cantTotal = 0, total = 0;
      for (const s of sitios) {
        const c = it.cantidades?.[s.id];
        const valor = c?.expresion ? evaluarCantidad(c.expresion) : c?.valor != null ? Number(c.valor) : 0;
        if (c?.expresion && valor == null) avisos.push(`Ítem ${n} (${it.apu?.codigo}): la cantidad «${c.expresion}» de ${s.nombre} no es válida.`);
        cantidades[s.id] = valor || 0;
        totales[s.id] = Math.round(vu * (valor || 0));
        cantTotal += valor || 0;
        total += totales[s.id];
        sub[s.id] += totales[s.id];
      }
      for (const a of res.avisos) avisos.push(`Ítem ${n} (${it.apu?.codigo}): ${a}`);
      return { ...it, cantidadesOrig: it.cantidades || {}, numero: n, res, vu, cantidades, totales, cantidadTotal: cantTotal, total };
    });
    for (const s of sitios) totalPorSitio[s.id] += sub[s.id];
    return { ...cap, items, subtotales: sub, subtotal: Object.values(sub).reduce((a, b) => a + b, 0) };
  });
  const o = { aiu: proyecto.aiu || { a: 0.15, i: 0.05, u: 0.05 }, iva: proyecto.iva ?? 0.19, regimenIva: proyecto.regimenIva || "utilidad" };
  const porSitio = Object.fromEntries(sitios.map((s) => [s.id, { costoDirecto: totalPorSitio[s.id], ...precioConAiu(totalPorSitio[s.id], o) }]));
  const cd = Object.values(totalPorSitio).reduce((a, b) => a + b, 0);
  return { sitios, capitulos, porSitio, costoDirecto: cd, ...precioConAiu(cd, o), opciones: o, avisos: [...new Set(avisos)], items: n };
}

// Copia de los insumos que usa el proyecto, para congelar sus precios.
export function preciosUsados(proyecto, base) {
  const usados = {};
  for (const cap of proyecto.capitulos || []) for (const it of cap.items || []) for (const ls of Object.values(it.apu?.lineas || {})) for (const l of ls) {
    const x = base.get(l.codigo);
    if (x) usados[l.codigo] = { codigo: x.codigo, tipo: x.tipo, descripcion: x.descripcion, unidad: x.unidad, precio: x.precio ?? null, fechaPrecio: x.fechaPrecio || null, fuente: x.fuente || "", base: x.base || null, vidaUtilAnios: x.vidaUtilAnios ?? null, factorSalarial: x.factorSalarial ?? null };
  }
  return usados;
}

// Copia del APU que entra al proyecto (no cambia si después se edita la biblioteca).
export const copiaApu = (a) => ({ codigo: a.codigo, nombre: a.nombre, unidad: a.unidad, rendimiento: a.rendimiento, categoria: a.categoria || "", lineas: JSON.parse(JSON.stringify(a.lineas || {})), version: a.version || 1 });

export const nuevoId = () => Math.random().toString(36).slice(2, 10);
