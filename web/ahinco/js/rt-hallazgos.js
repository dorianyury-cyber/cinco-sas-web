// Hallazgos y supuestos de un proyecto (sin Firebase: lo usan la pantalla,
// la memoria PDF/Word y el Excel). En un proyecto de verificación de
// interventoría cada criterio que no cumple es un hallazgo numerado; en uno
// de diseño, un pendiente por corregir. Los supuestos son los textos que el
// diseñador o el interventor marcó con "(S)".
import { MODULOS } from "./rt-modulos.js";
import { LITERALES } from "./rt-literales.js";

export const esVerificacion = (p) => p?.modo === "verificacion";
export const MODOS = {
  diseno: { nombre: "Diseño", hallazgos: "Pendientes por corregir", prefijo: "P" },
  verificacion: { nombre: "Verificación", hallazgos: "Hallazgos", prefijo: "H" }
};
export const modoDe = (p) => MODOS[esVerificacion(p) ? "verificacion" : "diseno"];

const titulo = (r) => `${MODULOS[r.modulo].titulo}${r.etiqueta ? ` — ${r.etiqueta}` : ""}`;
const literalesDe = (modulo) => LITERALES.filter((l) => l.modulos.includes(modulo)).map((l) => `${l.l})`);

// resultados: { clave: r } con r.modulo, r.clave, r.etiqueta (calcularProyecto).
export function hallazgos(proyecto, resultados) {
  const pre = modoDe(proyecto).prefijo;
  const lista = [];
  Object.values(resultados).forEach((r) => {
    (r.verificaciones || []).filter((v) => v.cumple === false).forEach((v) => {
      lista.push({ codigo: `${pre}-${lista.length + 1}`, calculo: titulo(r), clave: r.clave, modulo: r.modulo, criterio: v.criterio, valor: v.valor, limite: v.limite, norma: v.norma, literales: literalesDe(r.modulo).join(", ") });
    });
  });
  return lista;
}

// Frases marcadas con "(S)" en los literales y textos de las tablas de
// entrada marcados igual (p. ej. "Mástil de 20 m (S)").
export function supuestos(proyecto, guardados) {
  const lista = [];
  LITERALES.forEach((l) => {
    const t = proyecto.literales?.[l.l];
    if (!t || t.aplica === "No" || !t.texto) return;
    t.texto.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ(])/).filter((f) => /\(S[):,]/.test(f)).forEach((f) => lista.push({ origen: `Literal ${l.l})`, texto: f.trim() }));
  });
  Object.entries(guardados).forEach(([clave, g]) => {
    const mod = MODULOS[clave.split("-")[0]];
    if (!mod) return;
    const vistos = new Set();
    Object.values(g.entradas || {}).forEach((v) => {
      (Array.isArray(v) ? v : []).forEach((fila) => Object.values(fila || {}).forEach((x) => {
        if (typeof x === "string" && /\(S[):,]/.test(x) && !vistos.has(x)) { vistos.add(x); lista.push({ origen: `${mod.titulo}${g.etiqueta ? ` — ${g.etiqueta}` : ""}`, texto: x }); }
      }));
    });
  });
  return lista;
}
