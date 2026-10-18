// Memoria de cálculo de AHÍNCO en PDF y Word, organizada por los literales
// a) a x) del diseño detallado del RETIE. Usa los mismos generadores de
// informes de Cinco S.A.S. (web/js/control/informes-pdf.js e
// informes-docx.js): portada, índice con páginas, títulos numerados,
// tablas con anchos proporcionales al contenido, encabezado y pie.
import { generarInformePDF } from "../../js/control/informes-pdf.js";
import { generarInformeDocxBlob } from "../../js/control/informes-docx.js";
import { MODULOS, NORMAS_GENERALES } from "./rt-modulos.js";
import { LITERALES, FUENTE_LITERALES, exigido, tipoDisenoDe, normalizarTipoDiseno } from "./rt-literales.js";
import { svgTCC, svgAPng, svgUnifilar } from "./rt-grafico.js";
import { esc, hoyISO, tituloCalculo, ORDEN_MODULOS } from "./rt-core.js";
import { hallazgos, supuestos, esVerificacion } from "./rt-hallazgos.js";
import { ALCANCE } from "./rt-alcance.js";

const P = (html) => ({ tipo: "parrafo", texto: html });
const T = (nivel, texto) => ({ tipo: `titulo${nivel}`, texto });
const tabla = (titulo, encabezados, filas) => ({ tipo: "tabla", titulo, filas: [encabezados, ...filas.map((f) => f.map((v) => String(v ?? "")))], merges: [], centrados: [], filasEncabezado: 1 });

// Texto visible de un valor de entrada (las listas muestran su texto).
function valorVisible(campo, v) {
  if (campo.opciones) { const o = campo.opciones.find((x) => String(x.valor) === String(v ?? "")); if (o) return o.texto; }
  return v === "" || v == null ? "—" : String(v);
}

async function seccionModulo(r, entradas, nivel) {
  const mod = MODULOS[r.modulo];
  const titulo = tituloCalculo(r);
  const b = [T(nivel, titulo)];
  b.push(P(`<b>Objeto.</b> ${esc(mod.objeto)}`));
  b.push(P(`<b>Normas aplicadas.</b> ${esc(mod.normas.join("; "))}.`));
  const alc = ALCANCE[r.modulo];
  if (alc) b.push(P(`<b>Alcance del método.</b> ${esc(alc.metodo)}<br><b>Limitaciones.</b> ${alc.limitaciones.map(esc).join(" ")}`));
  // Datos de entrada (un campo condicional se muestra según el valor guardado o, si falta, el de ejemplo).
  const visible = (c) => { if (!c.soloSi) return true; const [k, v] = Object.entries(c.soloSi)[0]; return String(entradas[k] ?? mod.campos.find((x) => x.key === k)?.def) === String(v); };
  const simples = mod.campos.filter((c) => c.tipo !== "tabla" && visible(c));
  if (simples.length) b.push(tabla(`Datos de entrada — ${titulo}`, ["Parámetro", "Valor", "Unidad"], simples.map((c) => [c.label, valorVisible(c, entradas[c.key]), c.unidad || ""])));
  mod.campos.filter((c) => c.tipo === "tabla" && visible(c)).forEach((c) => {
    const filas = (entradas[c.key] || []).filter((f) => Object.values(f).some((v) => v !== "" && v != null));
    if (filas.length) b.push(tabla(`${c.label.replace(/\s*\(.*\)\s*$/, "")} — datos de entrada`, c.columnas.map((col) => col.label), filas.map((f) => c.columnas.map((col) => valorVisible(col, f[col.key])))));
  });
  // Metodología.
  b.push(P("<b>Metodología y cálculos.</b>"));
  (r.pasos || []).forEach((p, i) => b.push(P(`<b>${i + 1}. ${esc(p.titulo)}.</b> <i>${esc(p.formula)}</i>. ${esc(p.sustitucion)}. Resultado: <b>${esc(p.resultado)}</b>.`)));
  (r.tablas || []).forEach((t) => b.push(tabla(t.titulo, t.encabezados, t.filas)));
  if (r.grafico?.tipo === "tcc") {
    try { b.push({ tipo: "imagen", url: await svgAPng(svgTCC(r.grafico)), nombre: "Curvas tiempo-corriente de las protecciones", pieDeFoto: "", tamano: 95 }); } catch (e) { /* sin gráfico */ }
  }
  if (r.grafico?.tipo === "unifilar") {
    try { b.push({ tipo: "imagen", url: await svgAPng(svgUnifilar(r.grafico)), nombre: "Diagrama unifilar", pieDeFoto: "Diagrama unifilar generado con los datos de los cálculos del proyecto", tamano: 100 }); } catch (e) { /* sin gráfico */ }
  }
  // Verificación y conclusión.
  if ((r.verificaciones || []).length) b.push(tabla(`Verificación normativa — ${titulo}`, ["Criterio", "Norma o referencia", "Valor", "Límite", "Resultado"], r.verificaciones.map((v) => [v.criterio, v.norma, v.valor, v.limite, v.cumple ? "Cumple" : "No cumple"])));
  (r.notas || []).forEach((n) => b.push(P(`<i>Nota: ${esc(n)}</i>`)));
  b.push(P(`<b>Conclusión.</b> ${esc(r.conclusion || "")}`));
  return b;
}

// Cálculos que desarrollan un literal: en el orden de sus módulos y, dentro
// de cada módulo, en el orden de las instancias.
export function calculosDe(lit, resultados) {
  return Object.values(resultados).filter((r) => lit.modulos.includes(r.modulo))
    .sort((a, b) => lit.modulos.indexOf(a.modulo) - lit.modulos.indexOf(b.modulo) || ORDEN_MODULOS.indexOf(a.modulo) - ORDEN_MODULOS.indexOf(b.modulo));
}

export async function construirMemoria({ proyecto, resultados, guardados }) {
  const lits = proyecto.literales || {};
  const verif = esVerificacion(proyecto);
  const b = [];
  // ---- Generalidades
  b.push(T(1, "Generalidades"));
  if (verif) b.push(P(`El presente informe contiene la <b>verificación de la interventoría</b> sobre la memoria de cálculo y los planos del proyecto <b>${esc(proyecto.nombre)}</b>${proyecto.descripcion ? `: ${esc(proyecto.descripcion)}` : ""}. Los cálculos se rehicieron con los datos del diseño revisado y se compararon con los criterios del RETIE y de las normas técnicas citadas; cada criterio que no cumple se reporta como un hallazgo numerado. Se organiza según los literales del ${esc(FUENTE_LITERALES)}.`));
  else b.push(P(`La presente memoria de cálculo corresponde al ${esc(normalizarTipoDiseno(proyecto.tipoDiseno).toLowerCase())} de la instalación eléctrica del proyecto <b>${esc(proyecto.nombre)}</b>${proyecto.descripcion ? `: ${esc(proyecto.descripcion)}` : ""}. Se organiza según los literales del ${esc(FUENTE_LITERALES)}; los literales que no aplican a la instalación se mencionan expresamente con su justificación, como lo exige el parágrafo 1 del mismo artículo.`));
  b.push(tabla("Datos generales del proyecto", ["Dato", "Valor"], [
    ["Proyecto", proyecto.nombre], ["Cliente", proyecto.cliente || "—"], ["Ubicación", proyecto.ubicacion || "—"],
    ["Altitud", `${proyecto.altitud ?? "—"} m s. n. m.`], ["Temperatura ambiente de diseño", `${proyecto.tempAmbiente ?? "—"} °C`],
    ["Tipo de diseño", `${normalizarTipoDiseno(proyecto.tipoDiseno)}${tipoDisenoDe(proyecto.tipoDiseno)?.ref ? ` (RETIE 2024 ${tipoDisenoDe(proyecto.tipoDiseno).ref})` : ""}`],
    ...(verif ? [["Diseño revisado", proyecto.autorDiseno || "—"], ["Documentos revisados", proyecto.documentosRevisados || "—"]] : []),
    [verif ? "Interventor que verifica" : "Diseñador", `${proyecto.disenador || "—"}${proyecto.matricula ? ` — M.P. ${proyecto.matricula}` : ""}`]
  ]));
  b.push(tabla("Normas y reglamentos aplicados", ["Documento", "Título"], NORMAS_GENERALES));
  b.push(tabla("Alcance de la memoria por literal del RETIE", ["Lit.", "Contenido exigido", "Aplica", "Desarrollo"], LITERALES.map((l) => {
    const d = lits[l.l] || {};
    const calc = calculosDe(l, resultados).map(tituloCalculo);
    if (!exigido(proyecto.tipoDiseno, l.l) && !calc.length && !d.texto) return [`${l.l})`, l.texto, "—", "No exigido en el diseño básico (RETIE 2024 3.3.1.2)"];
    return [`${l.l})`, l.texto, d.aplica === "No" ? "No" : "Sí", d.aplica === "No" ? `No aplica: ${d.texto || "sin justificación"}` : calc.length ? `Cálculo: ${calc.join("; ")}` : d.texto ? "Desarrollo escrito" : "Pendiente"];
  })));
  // ---- verificación: hallazgos y supuestos al inicio, listos para el oficio
  if (verif) {
    const hall = hallazgos(proyecto, resultados), sup = supuestos(proyecto, guardados);
    b.push(T(1, "Resumen de hallazgos de la interventoría"));
    b.push(P(hall.length ? `La verificación encontró <b>${hall.length} hallazgo${hall.length === 1 ? "" : "s"}</b> que el contratista debe aclarar o corregir antes de construir. El detalle de cada cálculo está en el literal indicado.` : "La verificación no encontró incumplimientos en los criterios evaluados."));
    if (hall.length) b.push(tabla("Hallazgos de la interventoría", ["N.º", "Cálculo", "Criterio", "Valor", "Límite", "Norma o referencia", "Lit."], hall.map((h) => [h.codigo, h.calculo, h.criterio, h.valor, h.limite, h.norma, h.literales])));
    if (sup.length) {
      b.push(P("Los siguientes valores son supuestos de la interventoría (marcados «(S)» en este informe), adoptados porque el dato no está en los documentos revisados. El contratista o el operador de red deben confirmarlos; si cambian, los resultados deben recalcularse."));
      b.push(tabla("Supuestos y datos pendientes", ["Origen", "Supuesto"], sup.map((s) => [s.origen, s.texto])));
    }
  }
  // ---- un capítulo con una sección por literal (sin salto de página entre literales)
  b.push(T(1, "Desarrollo según los literales a) a x) del RETIE 2024 (numeral 3.3.1.1)"));
  const yaIncluido = {};
  for (const l of LITERALES) {
    const d = lits[l.l] || {};
    b.push(T(2, `Literal ${l.l}) ${l.texto.replace(/\.$/, "")}`));
    if (!exigido(proyecto.tipoDiseno, l.l) && !d.texto && !calculosDe(l, resultados).length) { b.push(P("No exigido en el diseño básico (RETIE 2024, numeral 3.3.1.2).")); continue; }
    if (d.aplica === "No") { b.push(P(`<b>No aplica.</b> ${esc(d.texto || "El diseñador no registró la justificación.")}`)); continue; }
    if (d.texto) b.push(P(esc(d.texto).replace(/\n/g, "<br>")));
    const mods = calculosDe(l, resultados);
    for (const r of mods) {
      // Un cálculo con literal principal se desarrolla allí; los demás literales remiten a él.
      const principal = MODULOS[r.modulo].literalPrincipal;
      const donde = yaIncluido[r.clave] || (principal && principal !== l.l ? principal : null);
      if (donde) { b.push(P(`El cálculo de <b>${esc(tituloCalculo(r))}</b> se presenta en el literal ${donde}) de esta memoria.`)); continue; }
      yaIncluido[r.clave] = l.l;
      b.push(...(await seccionModulo(r, guardados[r.clave]?.entradas || {}, 3)));
    }
    if (!mods.length && !d.texto) b.push(P("<i>Pendiente por desarrollar.</i>"));
  }
  // ---- conclusiones
  b.push(T(1, "Conclusiones"));
  const filasConc = Object.values(resultados).map((r) => {
    const fallan = (r.verificaciones || []).filter((v) => v.cumple === false).length;
    return [tituloCalculo(r), r.sinDatos ? "Sin datos" : fallan ? (verif ? `Con hallazgos (${fallan})` : `No cumple (${fallan})`) : "Cumple", r.conclusion || ""];
  });
  b.push(tabla("Resumen de resultados", ["Cálculo", "Estado", "Conclusión"], filasConc));
  b.push(P(verif
    ? "La interventoría verificó los cálculos con base en el RETIE y las normas técnicas citadas, a partir de los documentos revisados. Este informe no reemplaza la memoria de cálculo del diseñador: los hallazgos deben resolverse en el diseño y los supuestos confirmarse con el contratista."
    : "El diseñador declara que los cálculos se realizaron con base en el RETIE y las normas técnicas citadas, y que los supuestos adoptados se indican en cada literal."));
  b.push({ tipo: "firma", etiqueta: verif ? "Verificó" : "Elaboró", firmantes: [{ nombre: proyecto.disenador || "", cargo: `${verif ? "Interventoría" : "Ingeniero electricista"}${proyecto.matricula ? `\nMatrícula profesional ${proyecto.matricula}` : ""}\nCinco S.A.S.`, firmaUrl: null }] });
  return b;
}

function datosInforme(proyecto, bloques) {
  return {
    titulo: `${esVerificacion(proyecto) ? "Verificación de la memoria de cálculo" : "Memoria de cálculo"} — ${proyecto.nombre}`,
    tipoInforme: esVerificacion(proyecto) ? "verificacionMemoria" : "memoriaCalculo",
    portada: "oscura",
    mes: hoyISO().slice(0, 7),
    fecha: hoyISO(),
    radicado: proyecto.radicado || "Sin radicado",
    contratoNombre: proyecto.descripcion || proyecto.nombre,
    contratoCliente: proyecto.cliente || "",
    firmaNombre: proyecto.disenador || "",
    firmaCargo: `${esVerificacion(proyecto) ? "Interventoría" : "Ingeniero electricista"}${proyecto.matricula ? ` — M.P. ${proyecto.matricula}` : ""}`,
    margenEncuadernacion: 10,
    bloques
  };
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const nombreArchivo = (p, ext) => `${esVerificacion(p) ? "Verificacion memoria de calculo" : "Memoria de calculo"} - ${String(p.nombre || "proyecto").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.${ext}`;

// Las fuentes estándar del PDF (Helvetica, WinAnsi) no tienen letras
// griegas ni símbolos matemáticos: se escriben con equivalentes legibles
// (el Word sí los conserva).
const EQUIV_PDF = { "√": "raíz ", "Ω": "ohm", "Σ": "Suma ", "π": "pi", "ρ": "rho", "α": "alfa", "φ": "phi", "κ": "kappa", "θ": "theta", "Δ": "Delta ", "→": "->", "−": "-", "⁻": "-", "⁰": "^0", "¹": "^1", "⁴": "^4", "⁵": "^5", "⁶": "^6", "⁷": "^7", "ⁿ": "^n", "₁": "1", "≤": "<=", "≥": ">=", "≈": "~" };
// Caracteres fuera de Latin-1 que WinAnsi sí tiene; el resto (emoji, etc.) se omite.
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const pdfSeguro = (t) => (typeof t === "string" ? t.replace(/[^\u0000-ÿ]/gu, (c) => EQUIV_PDF[c] ?? (WINANSI_EXTRA.includes(c) ? c : "")) : t);
function sanearPDF(v) {
  if (Array.isArray(v)) return v.map(sanearPDF);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "url" ? x : sanearPDF(x)]));
  return pdfSeguro(v);
}

// Nombre del PDF de la memoria (lo usa también el visor).
export const nombreMemoria = (datos, ext = "pdf") => (datos.rapido ? `${nombreCalculo(datos)}.${ext}` : nombreArchivo(datos.proyecto, ext));
// Documento de jsPDF de la memoria completa o de un cálculo rápido, sin descargarlo.
export async function pdfMemoria(datos) {
  return generarInformePDF(sanearPDF(datos.rapido ? await informeCalculo(datos) : datosInforme(datos.proyecto, await construirMemoria(datos))));
}
export async function descargarMemoria(datos, tipo) {
  if (datos.rapido) return descargarCalculo(datos, tipo);
  const bloques = await construirMemoria(datos);
  const informe = datosInforme(datos.proyecto, bloques);
  if (tipo === "word") {
    descargarBlob(await generarInformeDocxBlob(informe), nombreArchivo(datos.proyecto, "docx"));
  } else {
    const doc = await generarInformePDF(sanearPDF(informe));
    descargarBlob(doc.output("blob"), nombreArchivo(datos.proyecto, "pdf"));
  }
}

// Documento de un solo cálculo (cálculo rápido, sin proyecto): el desarrollo del
// cálculo con sus datos, método, verificaciones y conclusión.
const nombreCalculo = (datos) => `Calculo - ${tituloCalculo(Object.values(datos.resultados)[0]).replace(/[\\/:*?"<>|]/g, "-").slice(0, 90)}`;
async function informeCalculo(datos) {
  const { proyecto, resultados, guardados } = datos;
  const r = Object.values(resultados)[0];
  const b = await seccionModulo(r, guardados[r.clave]?.entradas || {}, 1);
  b.splice(1, 0, P(`<i>Cálculo realizado con AHÍNCO sin proyecto asociado (cálculo rápido). Condiciones del sitio: altitud ${esc(String(proyecto.altitud ?? "—"))} m s. n. m. y temperatura ambiente ${esc(String(proyecto.tempAmbiente ?? "—"))} °C.</i>`));
  b.push({ tipo: "firma", etiqueta: "Elaboró", firmantes: [{ nombre: proyecto.disenador || "", cargo: "Cinco S.A.S.", firmaUrl: null }] });
  return { ...datosInforme(proyecto, b), titulo: `Cálculo — ${tituloCalculo(r)}`, radicado: "Cálculo rápido", contratoNombre: tituloCalculo(r) };
}
export async function descargarCalculo(datos, tipo) {
  const informe = await informeCalculo(datos);
  const nombre = nombreCalculo(datos);
  if (tipo === "word") descargarBlob(await generarInformeDocxBlob(informe), `${nombre}.docx`);
  else descargarBlob((await generarInformePDF(sanearPDF(informe))).output("blob"), `${nombre}.pdf`);
}
