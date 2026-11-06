// Hallazgos y supuestos de un proyecto (sin Firebase: lo usan la pantalla,
// la memoria PDF/Word y el Excel). En un proyecto de verificación de
// interventoría cada criterio que no cumple es un hallazgo numerado; en uno
// de diseño, un pendiente por corregir. Los supuestos son los textos que el
// diseñador o el interventor marcó con "(S)".
import { MODULOS } from "./rt-modulos.js";
import { esquemaDe } from "./rt-literales.js";

export const esVerificacion = (p) => p?.modo === "verificacion";
export const MODOS = {
  diseno: { nombre: "Diseño", hallazgos: "Pendientes por corregir", prefijo: "P" },
  verificacion: { nombre: "Verificación", hallazgos: "Hallazgos", prefijo: "H" }
};
export const modoDe = (p) => MODOS[esVerificacion(p) ? "verificacion" : "diseno"];
export const SEVERIDADES = ["Alta", "Media", "Baja"];
// «2 de severidad alta, 1 media y 3 bajas» (vacío si ninguno la tiene).
export function resumenSeveridad(hall) {
  const n = SEVERIDADES.map((s) => [s, hall.filter((h) => h.severidad === s).length]).filter(([, c]) => c);
  if (!n.length) return "";
  const txt = n.map(([s, c]) => `${c} ${s.toLowerCase()}${c === 1 ? "" : "s"}`);
  return txt.length > 1 ? `${txt.slice(0, -1).join(", ")} y ${txt.at(-1)}` : txt[0];
}

const titulo = (r) => `${MODULOS[r.modulo].titulo}${r.etiqueta ? ` — ${r.etiqueta}` : ""}`;
// Literales (o capítulos RETILAP) que desarrolla un módulo de cálculo.
const literalesDe = (proyecto, modulo) => { const e = esquemaDe(proyecto); return e.items.filter((l) => l.modulos.includes(modulo)).map(e.cod); };

// resultados: { clave: r } con r.modulo, r.clave, r.etiqueta (calcularProyecto).
export function hallazgos(proyecto, resultados) {
  const pre = modoDe(proyecto).prefijo;
  const lista = [];
  Object.values(resultados).forEach((r) => {
    (r.verificaciones || []).filter((v) => v.cumple === false).forEach((v) => {
      const llave = `${r.clave}|${v.criterio}`;
      lista.push({ codigo: `${pre}-${lista.length + 1}`, calculo: titulo(r), clave: r.clave, modulo: r.modulo, criterio: v.criterio, valor: v.valor, limite: v.limite, norma: v.norma, literales: literalesDe(proyecto, r.modulo).join(", "), llave, nota: proyecto.notasHallazgos?.[llave] || "" });
    });
  });
  // Hallazgos manuales: los que ningún cálculo detecta (documentos, planos, mediciones, coherencia entre ellos).
  (proyecto.hallazgosManuales || []).forEach((m) => {
    lista.push({ codigo: `${pre}-${lista.length + 1}`, calculo: m.calculo || "Documentos del diseño", clave: null, modulo: null, criterio: m.titulo || "", valor: m.valor || "—", limite: m.limite || "—", norma: m.norma || "", literales: m.literales || "", llave: `manual|${m.id}`, nota: m.detalle || "", manual: true, severidad: m.severidad || "" });
  });
  return lista;
}

// Frases marcadas con "(S)" en los literales y textos de las tablas de
// entrada marcados igual (p. ej. "Mástil de 20 m (S)").
export function supuestos(proyecto, guardados) {
  const lista = [];
  const esquema = esquemaDe(proyecto);
  esquema.items.forEach((l) => {
    const t = proyecto.literales?.[l.l];
    if (!t || t.aplica === "No" || !t.texto) return;
    const origen = `${esquema.singular[0].toUpperCase()}${esquema.singular.slice(1)} ${esquema.cod(l)}`;
    t.texto.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ(])/).filter((f) => /\(S[):,]/.test(f)).forEach((f) => lista.push({ origen, texto: f.trim() }));
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
