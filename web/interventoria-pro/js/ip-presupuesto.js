// Importación del presupuesto contratado desde la propuesta económica del
// contratista, en el formato habitual de los presupuestos oficiales: una
// hoja por proyecto con columnas "No.", "Descripción", "Unidad", "Cantidad",
// precio unitario y total, filas de capítulo (ej. "1.2 CABLE DE POTENCIA") y
// bloques ("EQUIPOS…", "MONTAJE…", "OBRA CIVIL…"). Cada hoja se asocia al
// frente del contrato cuyo nombre aparece en la hoja (ej. "SEBORUCO_CONTR" →
// frente «SE Seboruco»); las demás no se importan.

import { doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, moneda, errorAmigable } from "./ip-core.js";
import { anotarEnLote, diferencias, identificar } from "./ip-historial.js";
import { mostrarTabla } from "./ip-visor.js";

const norm = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function valor(celda) {
  const v = celda.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.result !== undefined) return v.result;
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.text) return v.text;
  }
  return v;
}
const texto = (c) => String(valor(c)).replace(/\s+/g, " ").trim();
const num = (c) => { const v = valor(c); const n = typeof v === "number" ? v : Number(String(v).replace(/[$\s.]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };

// Encabezado: la primera fila con "descripcion", "unidad" y "cantidad".
function columnas(ws) {
  for (let r = 1; r <= Math.min(ws.rowCount, 40); r++) {
    const fila = ws.getRow(r);
    const col = {};
    for (let c = 1; c <= Math.min(ws.columnCount || 30, 30); c++) {
      const t = norm(valor(fila.getCell(c)));
      if (!t) continue;
      if (col.desc == null && t.startsWith("descripcion")) col.desc = c;
      else if (col.und == null && t.startsWith("unidad")) col.und = c;
      else if (col.cant == null && t.startsWith("cantidad")) col.cant = c;
      else if (col.cod == null && /^(no|n°|no\.|item|ítem|n\.o)$/.test(t)) col.cod = c;
      else if (col.vu == null && /(precio|unitario|untario)/.test(t)) col.vu = c;
      // El ÚLTIMO "Total" de la fila es el total del ítem (suma de materiales,
      // mano de obra, equipos y transporte), el que cuadra con el contrato.
      else if (col.cant != null && t === "total") col.tot = c;
    }
    if (col.desc && col.und && col.cant) {
      if (col.cod == null) col.cod = col.desc - 1;
      return { ...col, fila: r };
    }
  }
  return null;
}

export async function leerPropuesta(archivo, frentes) {
  const ExcelJS = window.ExcelJS;
  if (/\.xlsb$/i.test(archivo.name)) throw new Error("El archivo está en formato .xlsb (binario). Ábrelo en Excel y guárdalo como «Libro de Excel (.xlsx)»; luego impórtalo.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await archivo.arrayBuffer());
  const hojas = [];
  wb.worksheets.forEach((ws) => {
    if (ws.state && ws.state !== "visible") return;
    const col = columnas(ws);
    if (!col) return;
    // Frente: el que aparezca en el nombre de la hoja o en sus primeras filas.
    const cabecera = norm(`${ws.name} ${[1, 2, 3].map((r) => texto(ws.getRow(r).getCell(1)) + " " + texto(ws.getRow(r).getCell(2))).join(" ")}`);
    const clave = (f) => norm(f).replace(/^(se|s\/e|subestacion|subestación)\s+/, "");
    // Palabra completa: «Sur» no debe coincidir dentro de otra palabra.
    const conBordes = (f) => {
      const palabra = clave(f).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${palabra}([^a-z0-9]|$)`);
    };
    const frente = frentes.find((f) => conBordes(f).test(cabecera)) || null;
    const items = [];
    const inconsistencias = [];
    let bloque = "Suministro de equipos", capitulo = "";
    ws.eachRow((fila, r) => {
      if (r <= col.fila) return;
      const cod = texto(fila.getCell(col.cod));
      const desc = texto(fila.getCell(col.desc));
      if (!cod && desc) {
        const d = norm(desc);
        if (/^equipos|^suministro de equipos/.test(d)) bloque = "Suministro de equipos";
        else if (/^montaje/.test(d)) bloque = "Montaje y obra eléctrica";
        else if (/^obra civil|montaje obra civil/.test(d)) bloque = "Obra civil";
        return;
      }
      if (/^\d+\.\d+\.?$/.test(cod)) { capitulo = `${cod.replace(/\.$/, "")} ${desc}`.slice(0, 160); return; }
      if (!/^\d+(\.\d+){2,}$/.test(cod)) return;
      const cant = num(fila.getCell(col.cant));
      if (!Number.isFinite(cant) || cant <= 0) return;
      const total = col.tot ? num(fila.getCell(col.tot)) : NaN;
      const vuDeclarado = col.vu ? num(fila.getCell(col.vu)) : NaN;
      const vu = Number.isFinite(total) && total > 0 ? total / cant : vuDeclarado;
      if (!Number.isFinite(vu)) return;
      // Inconsistencia aritmética de la propuesta: cantidad × precio unitario ≠ total.
      let observacion;
      if (Number.isFinite(total) && Number.isFinite(vuDeclarado) && Math.abs(cant * vuDeclarado - total) > Math.max(10, total * 0.001)) {
        observacion = `Propuesta: cantidad × precio unitario (${moneda(cant * vuDeclarado)}) no coincide con el total del ítem (${moneda(total)}); se toma el total, que es el que suma al valor del contrato.`;
        inconsistencias.push({ codigo: cod, hoja: ws.name, diferencia: cant * vuDeclarado - total });
      }
      items.push({
        proyecto: frente, codigo: cod, bloque: cod.startsWith("2.") && bloque !== "Suministro de equipos" ? "Obra civil" : bloque,
        capitulo, descripcion: desc.slice(0, 1500), unidad: texto(fila.getCell(col.und)), cantidad: Math.round(cant * 10000) / 10000,
        valorUnitario: Math.round(vu * 100) / 100,
        ...(observacion ? { observacion } : {})
      });
    });
    if (items.length) hojas.push({ nombre: ws.name, frente, items, inconsistencias, valor: items.reduce((s, it) => s + it.cantidad * it.valorUnitario, 0) });
  });
  if (!hojas.length) throw new Error("No se encontró ninguna hoja con columnas de descripción, unidad y cantidad.");
  return hojas;
}

export function configurarPropuesta({ mod, contrato, ctx, user, perfil, coleccionRef, frentes, titulo }) {
  const ref = document.getElementById("ipImportarBtn");
  if (!ref) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn secondary ip-btn-excel";
  btn.textContent = "📑 Importar propuesta del contratista";
  btn.title = "Lee la propuesta económica (formato del presupuesto oficial: una hoja por proyecto) y carga o actualiza todos sus ítems";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xlsb";
  input.className = "hidden";
  ref.after(btn, input);
  btn.addEventListener("click", () => { input.value = ""; input.click(); });
  input.addEventListener("change", async () => {
    const archivo = input.files[0];
    if (!archivo) return;
    try {
      const hojas = await leerPropuesta(archivo, frentes());
      const existentes = new Map(ctx.registros.map((r) => [`${norm(r.proyecto)}|${r.codigo}`, r]));
      const validos = hojas.filter((h) => h.frente).flatMap((h) => h.items);
      const nuevos = validos.filter((it) => !existentes.has(`${norm(it.proyecto)}|${it.codigo}`)).length;
      mostrarTabla({
        titulo: `Propuesta del contratista — ${archivo.name}`,
        nota: `Se leyeron ${hojas.length} hoja(s). Se importan las que corresponden a un frente del contrato: ${validos.length} ítem(s) (${nuevos} nuevos, ${validos.length - nuevos} actualizan cantidad, valor y descripción, sin tocar lo ejecutado ni la actividad asignada). Valores = costo directo (sin administración, imprevistos, utilidad ni IVA).${hojas.some((h) => h.inconsistencias.length) ? " ⚠ Hay ítems donde cantidad × precio unitario no da el total del ítem: se toma el total (el que suma al contrato) y queda la nota en la observación del ítem; conviene aclararlo con el contratista." : ""}`,
        columnas: ["Hoja", "Frente del contrato", "Ítems", "Valor (costo directo)", "Ítems donde cantidad × precio ≠ total"],
        filas: hojas.map((h) => [h.nombre, h.frente || "No se importa (no coincide con un frente)", String(h.items.length), moneda(h.valor), h.inconsistencias.length ? h.inconsistencias.map((x) => `${x.codigo} (${moneda(x.diferencia)})`).join(", ") : "—"]),
        marcar: (f) => (f[1].startsWith("No se importa") ? "ip-visor-existente" : ""),
        accion: validos.length ? { texto: `Importar ${validos.length} ítem(s)`, fn: () => guardar(validos, existentes) } : null
      });
    } catch (err) {
      alert(errorAmigable(err));
    }
  });

  async function guardar(items, existentes) {
    btn.disabled = true;
    const textoBtn = btn.textContent;
    try {
      for (let i = 0; i < items.length; i += 200) {
        btn.textContent = `Importando ${Math.min(i + 200, items.length)} de ${items.length}…`;
        const lote = writeBatch(db);
        const base = { user, perfil, modulo: mod.id, moduloLabel: titulo };
        items.slice(i, i + 200).forEach((it) => {
          const previo = existentes.get(`${norm(it.proyecto)}|${it.codigo}`);
          const datos = { ...it, actualizadoPor: perfil.nombre || user.email, actualizadoEn: serverTimestamp() };
          if (previo) {
            const cambios = diferencias(mod.campos, previo, datos);
            if (!cambios.length) return;
            lote.update(doc(coleccionRef, previo.id), datos);
            anotarEnLote(lote, contrato.id, { ...base, registroId: previo.id, accion: "editar", resumen: `(Propuesta del contratista) ${identificar(mod, { ...previo, ...datos })}`, cambios });
          } else {
            const nuevo = doc(coleccionRef);
            lote.set(nuevo, { ...datos, creadoPor: perfil.nombre || user.email, creadoEn: serverTimestamp() });
            anotarEnLote(lote, contrato.id, { ...base, registroId: nuevo.id, accion: "crear", resumen: `(Propuesta del contratista) ${identificar(mod, datos)}`, cambios: [] });
          }
        });
        await lote.commit();
      }
      alert(`Listo: ${items.length} ítem(s) importados o actualizados. Ahora agrúpalos en actividades de la curva S con «🔗 Agrupar ítems en actividades» (arriba de la tabla).`);
    } catch (err) {
      alert(errorAmigable(err));
    } finally {
      btn.disabled = false;
      btn.textContent = textoBtn;
    }
  }
}

