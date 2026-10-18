// Comparación entre dos versiones de un proyecto (o una versión y el estado actual):
// datos del proyecto, literales, cálculos agregados o quitados, campos y filas de tablas
// que cambiaron y, con la función de hallazgos que se le pase, los hallazgos cerrados,
// nuevos y que siguen. Sin Firebase: se prueba con Node.
import { MODULOS } from "./rt-modulos.js";

const vacio = (v) => v === "" || v == null || (Array.isArray(v) && !v.length);
const texto = (v) => (vacio(v) ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const igual = (a, b) => (vacio(a) && vacio(b)) || String(a) === String(b) || (a !== "" && b !== "" && Number.isFinite(Number(a)) && Number(a) === Number(b));
const modulo = (clave) => clave.replace(/-\d+$/, "");
const tituloDe = (clave, g) => `${MODULOS[modulo(clave)]?.titulo || clave}${g?.etiqueta ? ` — ${g.etiqueta}` : ""}`;
const conDatos = (f) => f && Object.values(f).some((v) => !vacio(v));
// Valor legible de un campo con opciones.
const ver = (c, v) => (c?.opciones ? c.opciones.find((o) => String(o.valor) === String(v ?? ""))?.texto ?? texto(v) : texto(v));

const CAMPOS_P = { nombre: "Nombre", modo: "Tipo de proyecto", cliente: "Cliente", ubicacion: "Ubicación", altitud: "Altitud", tempAmbiente: "Temperatura ambiente", tipoDiseno: "Tipo de diseño", descripcion: "Descripción", autorDiseno: "Diseño revisado", documentosRevisados: "Documentos revisados", disenador: "Diseñador", matricula: "Matrícula", radicado: "Radicado" };

// a y b: { proyecto, calculos: { clave: { entradas, etiqueta } } }. hallazgosDe(proyecto, calculos) → [{ calculo, criterio, valor, ... }]
export function compararVersiones(a, b, { hallazgosDe } = {}) {
  const res = { proyecto: [], literales: [], agregados: [], quitados: [], cambiados: [], hallazgos: null };
  for (const [k, n] of Object.entries(CAMPOS_P)) if (!igual(a.proyecto?.[k], b.proyecto?.[k])) res.proyecto.push({ campo: n, antes: texto(a.proyecto?.[k]), despues: texto(b.proyecto?.[k]) });
  const la = a.proyecto?.literales || {}, lb = b.proyecto?.literales || {};
  for (const l of [...new Set([...Object.keys(la), ...Object.keys(lb)])].sort()) {
    const x = la[l] || {}, y = lb[l] || {};
    if (!igual(x.aplica || "Sí", y.aplica || "Sí")) res.literales.push({ literal: l, cambio: `Aplica: ${x.aplica || "Sí"} → ${y.aplica || "Sí"}` });
    if (!igual((x.texto || "").trim(), (y.texto || "").trim())) res.literales.push({ literal: l, cambio: "Texto del desarrollo modificado" });
  }
  const ca = a.calculos || {}, cb = b.calculos || {};
  for (const k of Object.keys(cb)) if (!ca[k]) res.agregados.push(tituloDe(k, cb[k]));
  for (const k of Object.keys(ca)) if (!cb[k]) res.quitados.push(tituloDe(k, ca[k]));
  for (const k of Object.keys(cb).filter((x) => ca[x])) {
    const mod = MODULOS[modulo(k)];
    if (!mod) continue;
    const ea = ca[k].entradas || {}, eb = cb[k].entradas || {};
    const campos = [], tablas = [];
    if (!igual(ca[k].etiqueta, cb[k].etiqueta)) campos.push({ campo: "Identificación", antes: texto(ca[k].etiqueta), despues: texto(cb[k].etiqueta) });
    for (const c of mod.campos) {
      if (c.tipo !== "tabla") { if (!igual(ea[c.key], eb[c.key])) campos.push({ campo: c.label.replace(/\s*\(.*\)\s*$/, ""), antes: ver(c, ea[c.key]), despues: ver(c, eb[c.key]) }); continue; }
      const fa = (ea[c.key] || []).filter(conDatos), fb = (eb[c.key] || []).filter(conDatos);
      const celdas = [];
      for (let i = 0; i < Math.min(fa.length, fb.length); i++) for (const col of c.columnas) if (!igual(fa[i][col.key], fb[i][col.key])) celdas.push({ fila: i + 1, columna: col.label, antes: ver(col, fa[i][col.key]), despues: ver(col, fb[i][col.key]) });
      if (celdas.length || fa.length !== fb.length) tablas.push({ tabla: c.label.replace(/\s*\(.*\)\s*$/, ""), antes: fa.length, despues: fb.length, celdas });
    }
    if (campos.length || tablas.length) res.cambiados.push({ titulo: tituloDe(k, cb[k]), campos, tablas });
  }
  if (hallazgosDe) {
    const id = (h) => `${h.calculo}|${h.criterio}`;
    const ha = hallazgosDe(a.proyecto || {}, ca), hb = hallazgosDe(b.proyecto || {}, cb);
    const sa = new Set(ha.map(id)), sb = new Set(hb.map(id));
    res.hallazgos = { cerrados: ha.filter((h) => !sb.has(id(h))), nuevos: hb.filter((h) => !sa.has(id(h))), siguen: hb.filter((h) => sa.has(id(h))), antes: ha.length, despues: hb.length };
  }
  res.sinCambios = !res.proyecto.length && !res.literales.length && !res.agregados.length && !res.quitados.length && !res.cambiados.length;
  return res;
}
