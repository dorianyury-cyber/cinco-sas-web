// Importar filas a las tablas de los formularios desde Excel: texto pegado
// (celdas copiadas, separadas por tabulador), archivos .xlsx o .csv. Asigna
// las columnas por el encabezado si coincide con el de la tabla y, si no, por
// posición; convierte números con coma decimal y busca las opciones de las
// listas por su valor o su texto. Sin dependencias del navegador: se prueba con Node.

const normal = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
// Sinónimos frecuentes en hojas de Excel.
const SINONIMOS = { cobre: "cu", aluminio: "al", si: "si", x: "si", yes: "si", 1: "si", verdadero: "si", 0: "no", falso: "no" };
const conSinonimo = (t) => SINONIMOS[normal(t)] ?? normal(t);
const sinParentesis = (t) => normal(t).replace(/\s*\(.*\)\s*$/, "");

// Texto copiado de Excel (o CSV con «;» o «,») → matriz de celdas.
export function leerTexto(texto) {
  const lineas = String(texto || "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (!lineas.length) return [];
  const sep = lineas[0].includes("\t") ? "\t" : lineas[0].includes(";") ? ";" : ",";
  return lineas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
}

// Número escrito en formato colombiano o internacional: «1.234,5», «1234.5», «0,8».
export function aNumero(v) {
  if (typeof v === "number") return v;
  let t = String(v ?? "").trim().replace(/\s/g, "").replace(/[%$]/g, "");
  if (t === "") return "";
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// ¿La primera fila es de encabezados? (al menos la mitad coincide con los de la tabla)
function mapaEncabezados(fila, columnas) {
  const idx = fila.map((h) => columnas.findIndex((c) => [normal(c.label), sinParentesis(c.label), normal(c.key)].includes(normal(h)) || sinParentesis(c.label) === sinParentesis(h)));
  return idx.filter((i) => i >= 0).length >= Math.max(1, Math.ceil(Math.min(fila.length, columnas.length) / 2)) ? idx : null;
}

// matriz → { filas, avisos, porEncabezado }. Las filas quedan con las claves de la tabla.
export function convertirFilas(matriz, columnas) {
  const avisos = [];
  if (!matriz.length) return { filas: [], avisos: ["No hay datos para importar."], porEncabezado: false };
  const enc = mapaEncabezados(matriz[0], columnas);
  const datos = enc ? matriz.slice(1) : matriz;
  const destino = enc || columnas.map((_, i) => i);
  const filas = datos.filter((f) => f.some((c) => String(c).trim() !== "")).map((f, n) => {
    const o = {};
    f.forEach((valor, j) => {
      const ci = destino[j];
      if (ci == null || ci < 0 || ci >= columnas.length) return;
      const col = columnas[ci];
      const v = String(valor ?? "").trim();
      if (v === "") { o[col.key] = ""; return; }
      if (col.tipo === "numero") {
        const x = aNumero(v);
        if (Number.isNaN(x)) { avisos.push(`Fila ${n + 1}, «${col.label}»: «${v}» no es un número (se dejó vacío).`); o[col.key] = ""; } else o[col.key] = x;
      } else if (col.tipo === "select") {
        const op = col.opciones.find((x) => normal(x.valor) === normal(v)) || col.opciones.find((x) => normal(x.valor) === conSinonimo(v) || normal(x.texto) === conSinonimo(v)) || col.opciones.find((x) => normal(x.texto) === normal(v)) || col.opciones.find((x) => normal(x.texto).startsWith(normal(v)));
        if (op) o[col.key] = op.valor;
        else { avisos.push(`Fila ${n + 1}, «${col.label}»: «${v}» no está en la lista (opciones: ${col.opciones.slice(0, 8).map((x) => x.texto).join(", ")}${col.opciones.length > 8 ? "…" : ""}).`); o[col.key] = col.opciones[0]?.valor ?? ""; }
      } else o[col.key] = v;
    });
    return o;
  });
  if (!enc && matriz[0].length > columnas.length) avisos.push(`Las filas traen ${matriz[0].length} columnas y la tabla tiene ${columnas.length}: se tomaron las primeras.`);
  return { filas, avisos, porEncabezado: !!enc };
}

// ---------------------------------------------------------------- un cálculo completo desde Excel
// Plantilla: hoja «Datos» (Clave, Parámetro, Valor, Unidad) con los campos sueltos y una hoja
// por tabla cuya celda A1 dice «… [clave: <clave>]», con los encabezados en la fila 2.
export const HOJA_DATOS = "Datos";
export const marcaTabla = (clave) => `[clave: ${clave}]`;
export const nombreHojaTabla = (label) => String(label).replace(/\s*\(.*\)\s*$/, "").replace(/[\/?*[\]:]/g, "-").slice(0, 31) || "Tabla";

// Valor de una celda para un campo (número, lista o texto) → { valor } o { aviso }.
export function convertirValor(campo, v) {
  const t = String(v ?? "").trim();
  if (t === "") return { valor: "" };
  if (campo.tipo === "numero") { const x = aNumero(t); return Number.isNaN(x) ? { aviso: `«${t}» no es un número` } : { valor: x }; }
  if (campo.tipo === "select") {
    const op = campo.opciones.find((x) => normal(x.valor) === normal(t)) || campo.opciones.find((x) => normal(x.valor) === conSinonimo(t) || normal(x.texto) === conSinonimo(t)) || campo.opciones.find((x) => normal(x.texto) === normal(t)) || campo.opciones.find((x) => normal(x.texto).startsWith(normal(t)));
    return op ? { valor: op.valor } : { aviso: `«${t}» no está en la lista (${campo.opciones.slice(0, 6).map((x) => x.texto).join(", ")}${campo.opciones.length > 6 ? "…" : ""})` };
  }
  return { valor: t };
}

// hojas: { nombreDeHoja: matriz de celdas } → { campos: {clave: valor}, tablas: {clave: filas}, avisos, cambios }
export function leerCalculoExcel(mod, hojas, entradasActuales = {}) {
  const avisos = [], campos = {}, tablas = {}, cambios = [];
  const simples = mod.campos.filter((c) => c.tipo !== "tabla");
  const datos = hojas[HOJA_DATOS] || Object.entries(hojas).find(([n]) => normal(n) === "datos")?.[1];
  if (datos) {
    for (const fila of datos) {
      const [clave, etiqueta, valor] = fila;
      const c = simples.find((x) => x.key === String(clave ?? "").trim()) || simples.find((x) => sinParentesis(x.label) === sinParentesis(etiqueta));
      if (!c) continue;
      const r = convertirValor(c, valor);
      if (r.aviso) { avisos.push(`«${c.label}»: ${r.aviso}; se conserva el valor actual.`); continue; }
      if (r.valor === "" && entradasActuales[c.key] !== "" && entradasActuales[c.key] != null && c.def !== "") continue; // vacío: no borra un dato obligatorio
      if (String(r.valor) !== String(entradasActuales[c.key] ?? "")) cambios.push(c.label.replace(/\s*\(.*\)\s*$/, ""));
      campos[c.key] = r.valor;
    }
  } else avisos.push("El archivo no tiene la hoja «Datos»: solo se leen las tablas.");
  for (const c of mod.campos.filter((x) => x.tipo === "tabla")) {
    const hoja = Object.values(hojas).find((m) => String(m?.[0]?.[0] ?? "").includes(marcaTabla(c.key))) || hojas[nombreHojaTabla(c.label)];
    if (!hoja) continue;
    const cuerpo = String(hoja[0]?.[0] ?? "").includes("[clave:") ? hoja.slice(1) : hoja;
    const r = convertirFilas(cuerpo, c.columnas);
    const titulo = c.label.replace(/\s*\(.*\)\s*$/, "");
    r.avisos.forEach((a) => avisos.push(`${titulo} — ${a}`));
    if (!r.filas.length) continue; // hoja sin filas: la tabla actual se conserva
    tablas[c.key] = r.filas;
  }
  return { campos, tablas, avisos, cambios };
}
