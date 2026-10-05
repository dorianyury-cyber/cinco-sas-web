// Importación desde Excel para cualquier módulo de Interventoría PRO.
//
// 1. "Descargar plantilla": un .xlsx con una columna por campo del módulo
//    (obligatorios con *), listas desplegables con las opciones válidas
//    (hoja oculta "Listas") y una hoja de instrucciones.
// 2. "Elegir archivo": lee el Excel, reconoce las columnas por su
//    encabezado, valida cada fila (obligatorios, fechas, números, opciones,
//    personas, frentes) y muestra una vista previa: Nueva / Actualiza /
//    Error con el motivo.
// 3. "Importar": guarda solo las filas válidas en lotes, cada registro con
//    su entrada en el historial de cambios. Si el módulo define
//    `claveImport` (ej. cédula en Personal, ítem en Actividades) y ya existe
//    un registro con ese valor, se actualiza en vez de duplicarse.

import { doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, esc, mesCorto, mesesDelContrato, abrirModal, cerrarModal, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ip-core.js";
import { anotarEnLote, diferencias, identificar } from "./ip-historial.js";
import { nombreCapitulo } from "./ip-modulos.js";
import { mostrarLibro } from "./ip-visor.js";

const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const cedulaNorm = (t) => String(t ?? "").replace(/[^\dA-Za-z]/g, "");

// Campos que se importan (no fotos) y, si el módulo lleva avance mensual,
// una columna por mes del contrato.
function columnasImportables(mod, contrato) {
  const cols = [];
  for (const c of mod.campos) {
    if (c.type === "imagen") continue;
    if (c.type === "avance") {
      mesesDelContrato(contrato).forEach((ym) => cols.push({ ...c, key: `${c.key}.${ym}`, label: `Avance ${mesCorto(ym)} (%)`, type: "pctMes", padre: c.key, ym }));
      continue;
    }
    cols.push(c);
  }
  return cols;
}

function opcionesDe(c, frentes) {
  if (c.type === "frente") return ["General", ...frentes];
  if (c.type === "select") return c.opcionesObj ? c.opcionesObj.map((o) => o.texto) : c.opciones;
  return null;
}

const AYUDA_TIPO = {
  text: "Texto", textarea: "Texto (puede ser largo)", url: "Enlace (https://…)", number: "Número",
  money: "Valor en pesos, sin signos (ej. 1250000)", pct: "Porcentaje de 0 a 100", pctMes: "Avance acumulado de 0 a 100",
  date: "Fecha (dd/mm/aaaa o celda de fecha)", month: "Mes (mm/aaaa)", select: "Una de las opciones de la lista",
  frente: "Proyecto / frente del contrato", persona: "Nombre o cédula de alguien del Listado de personal"
};

// ------------------------------------------------------------ plantilla
export async function descargarPlantilla({ mod, contrato, frentes, titulo }) {
  const ExcelJS = window.ExcelJS;
  const cols = columnasImportables(mod, contrato);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Datos", { views: [{ state: "frozen", ySplit: 1 }] });
  const listas = wb.addWorksheet("Listas", { state: "hidden" });
  const inst = wb.addWorksheet("Instrucciones");

  // Anchos según el tipo de dato (un texto largo no necesita el mismo ancho
  // que una fecha o un estado).
  const ancho = (c) => ({ textarea: 48, url: 30, date: 14, month: 12, money: 16, number: 11, pct: 10, pctMes: 11, select: 22, frente: 14, persona: 28 }[c.type] || Math.max(14, Math.min(34, c.label.length + 4)));
  ws.columns = cols.map((c) => ({ header: `${c.label}${c.required ? " *" : ""}`, key: c.key, width: ancho(c) }));
  const enc = ws.getRow(1);
  enc.height = 32;
  enc.eachCell((cell, i) => {
    const c = cols[i - 1];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.required ? "FFB86F00" : "FF1F2732" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.note = AYUDA_TIPO[c.type] || "Texto";
  });

  // Listas desplegables desde la hoja oculta (las opciones pueden llevar
  // comas, así que no se escriben dentro de la validación).
  let colLista = 1;
  cols.forEach((c, i) => {
    const ops = opcionesDe(c, frentes);
    const letraDatos = ws.getColumn(i + 1).letter;
    if (ops && ops.length) {
      const letra = listas.getColumn(colLista).letter;
      ops.forEach((o, j) => { listas.getCell(j + 1, colLista).value = o; });
      for (let r = 2; r <= 500; r++) ws.getCell(`${letraDatos}${r}`).dataValidation = { type: "list", allowBlank: !c.required, formulae: [`Listas!$${letra}$1:$${letra}$${ops.length}`], showErrorMessage: true, errorTitle: "Valor no válido", error: "Elige una opción de la lista." };
      colLista++;
    }
    if (["date"].includes(c.type)) for (let r = 2; r <= 500; r++) ws.getCell(`${letraDatos}${r}`).numFmt = "dd/mm/yyyy";
    if (c.type === "money") for (let r = 2; r <= 500; r++) ws.getCell(`${letraDatos}${r}`).numFmt = "#,##0";
  });

  inst.columns = [{ width: 34 }, { width: 14 }, { width: 46 }, { width: 60 }];
  inst.addRow([`Plantilla de importación — ${titulo}`]).font = { bold: true, size: 13 };
  inst.addRow([`Contrato ${contrato.numero || ""}. Llena la hoja «Datos» a partir de la fila 2 (una fila por registro). Las columnas en naranja (*) son obligatorias. No cambies los encabezados.`]);
  if (mod.claveImport) {
    const campoClave = mod.campos.find((c) => c.key === mod.claveImport);
    inst.addRow([`Si «${campoClave?.label}» ya existe en el aplicativo, la fila ACTUALIZA ese registro en lugar de crear uno nuevo.`]);
  }
  inst.addRow([]);
  const h = inst.addRow(["Columna", "Obligatoria", "Qué escribir", "Opciones válidas"]);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2732" } }; });
  cols.forEach((c) => {
    const ops = opcionesDe(c, frentes);
    const r = inst.addRow([c.label, c.required ? "Sí" : "No", c.ayuda ? `${AYUDA_TIPO[c.type] || "Texto"}. ${c.ayuda}` : (AYUDA_TIPO[c.type] || "Texto"), ops ? ops.join(" · ") : ""]);
    r.alignment = { wrapText: true, vertical: "top" };
  });

  // Se ve primero: columnas, cuáles son obligatorias y las opciones válidas.
  mostrarLibro(wb, `Plantilla ${titulo} (Contrato ${String(contrato.numero || "").replace(/[\/:*?"<>|]/g, "-")}).xlsx`, { titulo: `Plantilla de importación — ${titulo}`, nota: "La hoja «Datos» es la que se llena (una fila por registro); «Instrucciones» explica cada columna y sus opciones." });
}

// ------------------------------------------------------------ lectura y validación
function aNumero(v, esPct) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v.result != null) return aNumero(v.result, esPct);
  let t = String(v).replace(/[$\s%]/g, "");
  if (t.includes(".") && t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  else if ((t.match(/\./g) || []).length > 1 || /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
const dosDig = (n) => String(n).padStart(2, "0");
// "AAAA-MM-DD" solo si el día existe de verdad (rechaza 31/02, 13/13…).
function fechaValida(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d && a >= 1990 && a <= 2100 ? iso : "invalida";
}
function aFecha(v) {
  const r = aFechaSinValidar(v);
  return r && r !== "invalida" ? fechaValida(r) : r;
}
function aFechaSinValidar(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return `${v.getUTCFullYear()}-${dosDig(v.getUTCMonth() + 1)}-${dosDig(v.getUTCDate())}`;
  if (typeof v === "object" && v.result != null) return aFechaSinValidar(v.result);
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${dosDig(m[2])}-${dosDig(m[3])}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const a = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${a}-${dosDig(m[2])}-${dosDig(m[1])}`; }
  return "invalida";
}
function aMes(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return `${v.getUTCFullYear()}-${dosDig(v.getUTCMonth() + 1)}`;
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${dosDig(m[2])}`;
  m = t.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[2]}-${dosDig(m[1])}`;
  const f = aFecha(t);
  return f && f !== "invalida" ? f.slice(0, 7) : "invalida";
}
function textoCelda(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.text) return String(v.text);
    if (v.hyperlink) return String(v.hyperlink);
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.result != null) return String(v.result);
  }
  return String(v).trim();
}

export async function leerArchivo(archivo, { mod, contrato, frentes, personal, existentes }) {
  const ExcelJS = window.ExcelJS;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await archivo.arrayBuffer());
  const ws = wb.getWorksheet("Datos") || wb.worksheets.find((w) => w.state !== "hidden");
  if (!ws) throw new Error("El archivo no tiene hojas con datos.");
  const cols = columnasImportables(mod, contrato);

  // Encabezados reconocidos por su texto (sin tildes, sin * ni mayúsculas).
  const mapa = new Map();
  ws.getRow(1).eachCell((cell, i) => {
    const t = sinTildes(textoCelda(cell.value).replace(/\*/g, ""));
    const c = cols.find((x) => sinTildes(x.label) === t || x.key === t);
    if (c) mapa.set(i, c);
  });
  if (!mapa.size) throw new Error("No se reconoció ninguna columna. Usa la plantilla del módulo sin cambiar los encabezados.");
  const faltan = cols.filter((c) => c.required && ![...mapa.values()].includes(c)).map((c) => c.label);

  const frentesNorm = new Map(["General", ...frentes].map((f) => [sinTildes(f), f]));
  const filas = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const datos = {};
    const errores = [];
    let vacia = true;
    for (const [i, c] of mapa) {
      const crudo = row.getCell(i).value;
      const texto = textoCelda(crudo);
      if (texto !== "" || crudo instanceof Date || typeof crudo === "number") vacia = false;
      if (c.type === "pctMes") {
        const v = aNumero(crudo instanceof Object && !(crudo instanceof Date) ? crudo : texto || crudo);
        if (v == null) continue;
        const p = row.getCell(i).numFmt?.includes("%") && v <= 1 ? v * 100 : v;
        if (Number.isNaN(p) || p < 0 || p > 100) { errores.push(`${c.label}: debe ser de 0 a 100`); continue; }
        datos[c.padre] = { ...(datos[c.padre] || {}), [c.ym]: Math.round(p * 10) / 10 };
        continue;
      }
      let v;
      switch (c.type) {
        case "money": case "number": case "pct": {
          v = aNumero(typeof crudo === "number" ? crudo : texto);
          if (v != null && c.type === "pct" && row.getCell(i).numFmt?.includes("%") && v <= 1) v *= 100;
          if (Number.isNaN(v)) { errores.push(`${c.label}: «${texto}» no es un número`); v = null; }
          break;
        }
        case "date": v = aFecha(crudo instanceof Date ? crudo : texto); if (v === "invalida") { errores.push(`${c.label}: fecha no válida «${texto}»`); v = null; } break;
        case "month": v = aMes(crudo instanceof Date ? crudo : texto); if (v === "invalida") { errores.push(`${c.label}: mes no válido «${texto}»`); v = null; } break;
        case "select": {
          if (!texto) { v = ""; break; }
          const ops = c.opcionesObj || c.opciones.map((o) => ({ valor: o, texto: o }));
          const hit = ops.find((o) => sinTildes(o.texto) === sinTildes(texto) || sinTildes(o.valor) === sinTildes(texto));
          if (hit) v = hit.valor; else { errores.push(`${c.label}: «${texto}» no es una opción válida`); v = ""; }
          break;
        }
        case "frente": {
          if (!texto) { v = ""; break; }
          v = frentesNorm.get(sinTildes(texto));
          if (!v) { errores.push(`${c.label}: «${texto}» no es un frente del contrato`); v = ""; }
          break;
        }
        case "persona": {
          if (!texto) { v = ""; break; }
          const p = personal.find((x) => sinTildes(x.nombre) === sinTildes(texto) || (cedulaNorm(x.cedula) && cedulaNorm(x.cedula) === cedulaNorm(texto)));
          if (p) v = p.id; else { errores.push(`${c.label}: «${texto}» no está en el Listado de personal`); v = ""; }
          break;
        }
        default: v = texto;
      }
      datos[c.key] = v;
    }
    if (vacia) return;
    for (const c of cols) {
      if (!c.required || c.type === "pctMes") continue;
      const v = datos[c.key];
      if ((v == null || v === "") && !errores.some((e) => e.startsWith(c.label))) errores.push(`${c.label}: obligatorio`);
    }
    // ¿Actualiza un registro existente?
    let existente = null;
    if (mod.claveImport && datos[mod.claveImport] != null && datos[mod.claveImport] !== "") {
      const norm = (x) => (mod.claveImport === "cedula" ? cedulaNorm(x) : sinTildes(x));
      existente = existentes.find((r) => norm(r[mod.claveImport]) === norm(datos[mod.claveImport])) || null;
    }
    // Campos sin columna en el archivo: no se tocan al actualizar; al crear
    // toman su valor por defecto.
    if (!existente) mod.campos.forEach((c) => { if (c.porDefecto && (datos[c.key] == null || datos[c.key] === "")) datos[c.key] = c.porDefecto(); });
    filas.push({ n, datos, errores, existente });
  });
  return { filas, faltan, columnas: [...mapa.values()].map((c) => c.label) };
}

// ------------------------------------------------------------ guardado
export async function importarFilas({ filas, mod, contrato, coleccionRef, cap, user, perfil, personal, titulo }) {
  const validas = filas.filter((f) => !f.errores.length);
  let creados = 0, actualizados = 0;
  // 200 filas por lote: cada fila son 2 escrituras (registro + historial),
  // por debajo del límite de 500 de Firestore.
  for (let i = 0; i < validas.length; i += 200) {
    const lote = writeBatch(db);
    for (const f of validas.slice(i, i + 200)) {
      const datos = { ...f.datos, actualizadoPor: perfil.nombre || user.email, actualizadoEn: serverTimestamp() };
      if (mod.porCapitulo && cap) datos[mod.porCapitulo] = cap;
      const base = { user, perfil, modulo: mod.id, moduloLabel: titulo };
      if (f.existente) {
        // Al actualizar, las celdas vacías NO borran lo que ya existe y el
        // campo que identifica el registro (ej. la cédula) conserva su
        // formato original.
        for (const k of Object.keys(datos)) {
          if (datos[k] === "" || datos[k] == null || k === mod.claveImport) delete datos[k];
        }
        if (f.existente.avance && datos.avance) datos.avance = { ...f.existente.avance, ...datos.avance };
        const cambios = diferencias(mod.campos, f.existente, datos, personal);
        if (!cambios.length) continue;
        lote.update(doc(coleccionRef, f.existente.id), datos);
        anotarEnLote(lote, contrato.id, { ...base, registroId: f.existente.id, accion: "editar", resumen: `(Importado de Excel) ${identificar(mod, { ...f.existente, ...datos })}`, cambios });
        actualizados++;
      } else {
        datos.creadoPor = perfil.nombre || user.email;
        datos.creadoEn = serverTimestamp();
        const nuevo = doc(coleccionRef);
        lote.set(nuevo, datos);
        anotarEnLote(lote, contrato.id, { ...base, registroId: nuevo.id, accion: "crear", resumen: `(Importado de Excel) ${identificar(mod, datos)}`, cambios: diferencias(mod.campos, {}, datos, personal) });
        creados++;
      }
    }
    await lote.commit();
  }
  return { creados, actualizados, omitidas: filas.length - validas.length };
}

// ------------------------------------------------------------ interfaz
export function configurarImportacion({ mod, contrato, ctx, user, perfil, coleccionRef, cap, frentesContrato, titulo }) {
  const btn = document.getElementById("ipImportarBtn");
  if (!btn || mod.campos.some((c) => c.type === "imagen")) return;
  btn.classList.remove("hidden");
  const modal = document.getElementById("ipImportModal");
  const archivoEl = document.getElementById("ipImportArchivo");
  const previa = document.getElementById("ipImportPrevia");
  const alerta = document.getElementById("ipImportAlerta");
  const confirmar = document.getElementById("ipImportConfirmar");
  let resultado = null;

  const reiniciar = () => { resultado = null; archivoEl.value = ""; previa.innerHTML = ""; confirmar.classList.add("hidden"); limpiarAlerta(alerta); };
  btn.addEventListener("click", () => {
    reiniciar();
    document.getElementById("ipImportTitulo").textContent = `Importar desde Excel — ${titulo}`;
    const clave = mod.claveImport ? mod.campos.find((c) => c.key === mod.claveImport)?.label : null;
    document.getElementById("ipImportNota").textContent = clave
      ? `Si «${clave}» ya existe, la fila actualiza ese registro en lugar de crear uno nuevo.`
      : "Cada fila del archivo crea un registro nuevo.";
    abrirModal("ipImportModal");
  });
  document.getElementById("ipImportPlantilla").addEventListener("click", () => descargarPlantilla({ mod, contrato, frentes: frentesContrato(), titulo }).catch((err) => mostrarAlerta(alerta, errorAmigable(err))));
  document.getElementById("ipImportCerrar").addEventListener("click", () => cerrarModal("ipImportModal"));
  modal.addEventListener("click", (e) => { if (e.target === modal) cerrarModal("ipImportModal"); });

  archivoEl.addEventListener("change", async () => {
    limpiarAlerta(alerta);
    previa.innerHTML = '<p class="text-muted ip-sin-margen">Leyendo el archivo…</p>';
    confirmar.classList.add("hidden");
    const archivo = archivoEl.files[0];
    if (!archivo) { previa.innerHTML = ""; return; }
    try {
      resultado = await leerArchivo(archivo, { mod, contrato, frentes: frentesContrato(), personal: ctx.datos.personal || [], existentes: ctx.registros });
      const { filas, faltan } = resultado;
      const ok = filas.filter((f) => !f.errores.length);
      const nuevos = ok.filter((f) => !f.existente).length;
      const actualiza = ok.length - nuevos;
      const errores = filas.length - ok.length;
      const muestra = mod.columnas.filter((c) => !c.render).slice(0, 4);
      const valor = (f, c) => {
        const campo = mod.campos.find((x) => x.key === c.key) || {};
        const v = f.datos[c.key];
        if (campo.type === "persona") return (ctx.datos.personal || []).find((p) => p.id === v)?.nombre || "";
        if (campo.opcionesObj) return nombreCapitulo(v);
        return v ?? "";
      };
      previa.innerHTML = `
        ${faltan.length ? `<div class="alert error ip-alerta-fija">Faltan columnas obligatorias en el archivo: ${esc(faltan.join(", "))}.</div>` : ""}
        <div class="ip-import-resumen">
          <span class="badge ok">${nuevos} nuevas</span>
          <span class="badge warn">${actualiza} actualizan</span>
          <span class="badge danger">${errores} con error (no se importan)</span>
        </div>
        <div class="tabla-scroll ip-import-tabla"><table class="tabla-compacta">
          <thead><tr><th>Fila</th><th>Resultado</th>${muestra.map((c) => `<th>${esc(c.label || mod.campos.find((x) => x.key === c.key)?.label || c.key)}</th>`).join("")}</tr></thead>
          <tbody>${filas.map((f) => `<tr class="${f.errores.length ? "ip-import-error" : ""}"><td>${f.n}</td>
            <td>${f.errores.length ? `<span class="badge danger">Error</span> <span class="ip-import-motivo">${esc(f.errores.join(" · "))}</span>` : f.existente ? '<span class="badge warn">Actualiza</span>' : '<span class="badge ok">Nueva</span>'}</td>
            ${muestra.map((c) => `<td>${esc(String(valor(f, c)).slice(0, 60))}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>`;
      if (ok.length && !faltan.length) {
        confirmar.textContent = `Importar ${ok.length} fila(s) válida(s)`;
        confirmar.classList.remove("hidden");
      } else if (!filas.length) {
        previa.innerHTML += '<p class="text-muted">El archivo no tiene filas con datos.</p>';
      }
    } catch (err) {
      previa.innerHTML = "";
      mostrarAlerta(alerta, errorAmigable(err));
    }
  });

  confirmar.addEventListener("click", async () => {
    if (!resultado) return;
    confirmar.disabled = true;
    confirmar.textContent = "Importando…";
    try {
      const r = await importarFilas({ filas: resultado.filas, mod, contrato, coleccionRef, cap, user, perfil, personal: ctx.datos.personal || [], titulo });
      mostrarAlerta(alerta, `Listo: ${r.creados} creado(s), ${r.actualizados} actualizado(s)${r.omitidas ? `, ${r.omitidas} fila(s) con error omitidas` : ""}. Todo quedó en el historial de cambios.`, "success");
      confirmar.classList.add("hidden");
      resultado = null;
    } catch (err) {
      mostrarAlerta(alerta, errorAmigable(err));
    } finally {
      confirmar.disabled = false;
    }
  });
}
