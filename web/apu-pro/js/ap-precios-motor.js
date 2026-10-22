// APU PRO — actualización de precios de la base de insumos (sin Firebase ni DOM).
// Tres orígenes de precios nuevos que terminan en la misma lista de propuestas:
//   · un Excel (la plantilla de la aplicación o cualquier lista de precios),
//   · un reajuste por IPP de los precios antiguos,
//   · una cotización en PDF o pegada como texto.
// Cada propuesta lleva su variación y sus alertas para que se revise antes de aplicar.
import { normalizar, mesesDesde, variacionIPP } from "./ap-calculos.js";
import { aNumero, detectarColumnas, extraerItems, indiceApus, sugerirApus, AZUL, AMBAR, AMBAR_SUAVE, GRIS, GRIS_TXT, BORDES, fx, relleno, altoPara } from "./ap-revision-motor.js";

export const SALTO_ALERTA = 0.3; // variación (±30 %) a partir de la cual se pide revisar
export const IVA = 0.19;
export const UMBRAL_COINCIDENCIA = 0.35; // parecido mínimo para proponer (sin marcar) el insumo más parecido

export const COLUMNAS_PLANTILLA = ["Código", "Descripción", "Und", "Precio actual", "Fecha actual", "Precio nuevo", "Fecha del precio", "Fuente", "¿Incluye IVA?"];

// Filas de la plantilla: una por insumo, con el precio nuevo en blanco.
export function filasPlantilla(insumos) {
  return insumos.map((x) => [x.codigo, x.descripcion, x.unidad || "", x.precio ?? "", x.fechaPrecio || "", "", "", "", x.incluyeIva === false ? "No" : "Sí"]);
}


// ---------------------------------------------------------------- plantilla de Excel
// Formato Cinco (el mismo del Excel de revisión): logo, título con línea ámbar, tabla con filas
// alternas, columnas por llenar en ámbar, validaciones, hoja de instrucciones y listo para imprimir.
const ANCHOS = [11, 58, 7, 15, 13, 15, 14, 30, 11, 22, 11];
const MONEDA = '"$"#,##0';
function encabezadoCinco(wb, ws, { logo, titulo, subtitulo, info, anchos }) {
  ws.columns = anchos.map((w) => ({ width: w }));
  const n = anchos.length;
  let c0 = 1, px = 0, sangria = 0;
  while (c0 < n && px < 165) {
    if (px + anchos[c0 - 1] * 7.2 > 165 + 120) { sangria = Math.ceil((165 - px) / 9); break; } // columna muy ancha: el título empieza en ella, con sangría
    px += anchos[c0 - 1] * 7.2; c0++;
  } // el título empieza donde termina el logo
  if (logo) ws.addImage(wb.addImage({ base64: logo, extension: "png" }), { tl: { col: 0.15, row: 0.2 }, ext: { width: 150, height: 72 } });
  ws.getRow(1).height = 24; ws.getRow(2).height = 24; ws.getRow(3).height = 20;
  ws.mergeCells(1, c0, 2, n);
  Object.assign(ws.getCell(1, c0), { value: titulo.toUpperCase(), font: fx({ size: 15, bold: true }), alignment: { vertical: "middle", horizontal: "left", indent: sangria } });
  ws.mergeCells(3, c0, 3, n);
  Object.assign(ws.getCell(3, c0), { value: subtitulo, font: fx({ size: 11, bold: true, color: { argb: GRIS_TXT } }), alignment: { vertical: "middle", indent: sangria } });
  for (let c = 1; c <= n; c++) ws.getCell(4, c).border = { bottom: { style: "medium", color: { argb: AMBAR } } };
  ws.mergeCells(5, 1, 5, n);
  Object.assign(ws.getCell(5, 1), { value: info, font: fx({ size: 9, color: { argb: GRIS_TXT } }), alignment: { vertical: "middle" } });
  ws.getRow(5).height = 18;
}
const hojaImpresion = (wb, nombre, titulo, horizontal = true) => wb.addWorksheet(nombre, {
  pageSetup: { paperSize: 1, orientation: horizontal ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 } },
  headerFooter: { oddFooter: `&L&8Cinco S.A.S. · APU PRO&C&8${titulo}&R&8Página &P de &N` },
  views: [{ showGridLines: false }]
});

// filas: las de filasPlantilla (9 columnas). Se agregan la antigüedad y la variación (fórmula) de cada precio.
export function libroPlantilla(ExcelJS, filas, { logo = null, hoy = new Date() } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cinco S.A.S. · APU PRO";
  const fecha = hoy.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
  const ws = hojaImpresion(wb, "Precios", "Actualización de precios");
  const n = ANCHOS.length;
  encabezadoCinco(wb, ws, { logo, titulo: "Actualización de precios", subtitulo: "Base de precios de insumos", info: `${filas.length} insumos · Generada el ${fecha} · Llena las columnas amarillas y sube el archivo en APU PRO (Actualizar precios)`, anchos: ANCHOS });
  const h = 7, referencia = 5; // columnas 1 a 5 son de referencia; 6 a 9 se llenan; 10 y 11 se calculan
  const encabezados = [...COLUMNAS_PLANTILLA, "Antigüedad del precio", "Variación"];
  encabezados.forEach((t, j) => {
    const llenar = j >= referencia && j < 9;
    Object.assign(ws.getCell(h, j + 1), { value: t, font: fx({ size: 9, bold: true, color: { argb: llenar ? AZUL : "FFFFFFFF" } }), fill: relleno(llenar ? AMBAR : AZUL), border: BORDES, alignment: { horizontal: "center", vertical: "middle", wrapText: true } });
  });
  ws.getRow(h).height = 30;
  filas.forEach((f, k) => {
    const r = h + 1 + k, fila = ws.getRow(r);
    const meses = mesesDesde(f[4], hoy);
    const antig = f[3] === "" || f[3] == null ? "Sin precio" : meses == null ? "Sin fecha" : meses <= 6 ? `Vigente (${meses} m)` : meses <= 12 ? `Revisar (${meses} m)` : `Desactualizado (${meses} m)`;
    const valores = [f[0], f[1], f[2], f[3] === "" ? null : f[3], f[4] ? new Date(`${f[4]}T12:00:00`) : null, null, null, null, f[8], antig, null];
    const zebra = k % 2 ? GRIS : null;
    valores.forEach((v, j) => {
      const c = fila.getCell(j + 1);
      c.value = v;
      c.border = BORDES;
      c.font = fx(j === 0 ? { bold: true } : j === 9 ? { size: 9, color: { argb: GRIS_TXT } } : {});
      c.alignment = { vertical: "top", wrapText: j === 1, horizontal: j === 3 || j === 5 ? "right" : j >= 4 && j !== 7 ? "center" : "left" };
      const llenar = j >= referencia && j < 9;
      if (llenar) c.fill = relleno(AMBAR_SUAVE); else if (zebra) c.fill = relleno(zebra);
    });
    fila.getCell(4).numFmt = MONEDA; fila.getCell(6).numFmt = MONEDA;
    fila.getCell(5).numFmt = "dd/mm/yyyy"; fila.getCell(7).numFmt = "dd/mm/yyyy";
    // Variación = precio nuevo ÷ precio actual − 1 (vacía mientras no haya precio nuevo).
    const v = fila.getCell(11);
    v.value = { formula: `IF(OR(F${r}="",D${r}="",D${r}=0),"",F${r}/D${r}-1)` };
    v.numFmt = "+0.0%;-0.0%;0.0%"; v.alignment = { vertical: "top", horizontal: "center" };
    fila.height = altoPara([[f[1], ANCHOS[1]]]);
  });
  const ult = h + filas.length;
  if (filas.length) {
    ws.dataValidations.add(`I${h + 1}:I${ult}`, { type: "list", allowBlank: true, formulae: ['"Sí,No"'], showErrorMessage: true, errorTitle: "IVA", error: "Elige Sí o No." });
    ws.dataValidations.add(`F${h + 1}:F${ult}`, { type: "decimal", operator: "greaterThan", formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: "Precio nuevo", error: "Escribe un valor mayor que cero." });
    ws.dataValidations.add(`G${h + 1}:G${ult}`, { type: "date", operator: "greaterThan", formulae: [new Date(2000, 0, 1)], allowBlank: true, showErrorMessage: true, errorStyle: "warning", errorTitle: "Fecha", error: "Escribe una fecha válida (dd/mm/aaaa)." });
    // Una variación mayor al 30 % (arriba o abajo) se marca en rojo para revisar el precio.
    ws.addConditionalFormatting({ ref: `K${h + 1}:K${ult}`, rules: [{ type: "expression", formulae: [`AND(ISNUMBER(K${h + 1}),ABS(K${h + 1})>${SALTO_ALERTA})`], style: { font: { bold: true, color: { argb: "FF9B2C10" } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFF8D0C4" } } } }] });
    ws.autoFilter = { from: { row: h, column: 1 }, to: { row: ult, column: n } };
  }
  ws.views = [{ showGridLines: false, state: "frozen", xSplit: 2, ySplit: h }];
  ws.pageSetup.printTitlesRow = `${h}:${h}`;

  // ---- hoja de instrucciones
  const wi = hojaImpresion(wb, "Instrucciones", "Instrucciones", false);
  const ai = [5, 22, 70];
  encabezadoCinco(wb, wi, { logo, titulo: "Cómo actualizar los precios", subtitulo: "Plantilla de actualización de precios de APU PRO", info: `Generada el ${fecha}`, anchos: ai });
  const filaI = (r, a, b, c, { cabecera = false, color = null } = {}) => {
    [a, b, c].forEach((v, j) => {
      const cel = wi.getCell(r, j + 1);
      cel.value = v;
      cel.border = BORDES;
      cel.font = fx(cabecera ? { bold: true, size: 9 } : j === 1 ? { bold: true } : {});
      cel.alignment = { vertical: "top", wrapText: true, horizontal: j === 0 ? "center" : "left" };
      if (cabecera) cel.fill = relleno(AMBAR); else if (color && j === 1) cel.fill = relleno(color);
    });
    wi.getRow(r).height = altoPara([[c, ai[2]], [b, ai[1]]]);
  };
  let r = 7;
  wi.mergeCells(r, 1, r, 3);
  Object.assign(wi.getCell(r, 1), { value: "PASOS", font: fx({ size: 10, bold: true }), border: { bottom: { style: "thin", color: { argb: AMBAR } } } });
  r++;
  filaI(r++, "N.º", "Paso", "Qué hacer", { cabecera: true });
  [
    ["Llenar", "Escribe en la hoja «Precios» solo las columnas amarillas: Precio nuevo, Fecha del precio, Fuente y ¿Incluye IVA?. Las filas sin precio nuevo no se modifican."],
    ["Revisar", "La columna «Variación» calcula el cambio frente al precio actual y se marca en rojo si pasa del 30 %: confirma que la unidad, el IVA y el valor sean correctos."],
    ["Subir", "En APU PRO entra a Base de precios, Actualizar precios, Desde Excel, y sube este archivo. Verás una propuesta con las alertas; nada se guarda hasta que la apliques."],
    ["Aplicar", "Marca las filas que estén bien y pulsa «Aplicar». Cada precio queda en el historial del insumo con su fuente y su fecha."]
  ].forEach(([a, b], k) => filaI(r++, String(k + 1), a, b));
  r++;
  wi.mergeCells(r, 1, r, 3);
  Object.assign(wi.getCell(r, 1), { value: "REGLAS", font: fx({ size: 10, bold: true }), border: { bottom: { style: "thin", color: { argb: AMBAR } } } });
  r++;
  filaI(r++, "N.º", "Tema", "Detalle", { cabecera: true });
  [
    ["Códigos", "No cambies los códigos ni el orden de las columnas: con ellos se identifica cada insumo."],
    ["IVA", `Indica si el precio nuevo incluye IVA. Si no coincide con la base, APU PRO lo convierte con IVA de ${Math.round(IVA * 100)} % y lo avisa en la propuesta.`],
    ["Fecha y fuente", "Si dejas la fecha o la fuente en blanco, APU PRO usa la fecha y la fuente que escribas al subir el archivo."],
    ["Precios de proveedor", "También puedes subir directamente la lista de precios de un proveedor (con descripción, unidad y valor unitario): se empareja por descripción y tendrás que confirmar los insumos parecidos."],
    ["Colores", "Encabezado azul: datos de referencia y columnas calculadas, que no se modifican. Encabezado y celdas amarillas: lo que se llena."]
  ].forEach(([a, b], k) => filaI(r++, String(k + 1), a, b));
  return wb;
}

// ---------------------------------------------------------------- lectura de la hoja
const FECHA_ES = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
export function aFecha(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(FECHA_ES);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}
const aIva = (v) => {
  const t = normalizar(v);
  if (!t) return undefined;
  if (/^(si|s|1|true|con|incluye)/.test(t)) return true;
  if (/^(no|n|0|false|sin)/.test(t)) return false;
  return undefined;
};

// Encabezados: busca la fila con una columna de precio y otra de código o descripción.
function clasificar(textos) {
  const col = { codigo: -1, desc: -1, und: -1, nuevo: -1, generico: -1, fecha: -1, fuente: -1, iva: -1 };
  textos.forEach((raw, j) => {
    const t = normalizar(raw);
    if (!t || t.length > 40) return;
    const actual = /actual|anterior|vigente/.test(t);
    if (/fecha/.test(t)) { if (!actual && col.fecha < 0) col.fecha = j; return; }
    if (/iva/.test(t)) { if (col.iva < 0) col.iva = j; return; }
    if (/fuente|proveedor|origen|cotiz/.test(t)) { if (col.fuente < 0) col.fuente = j; return; }
    if (/^(cod|codigo|ref|referencia)\b/.test(t)) { if (col.codigo < 0) col.codigo = j; return; }
    if (/^(und|unid|unidad|um)\b/.test(t)) { if (col.und < 0) col.und = j; return; }
    if (/descrip|material|insumo|detalle|concepto|nombre|articulo|producto/.test(t)) { if (col.desc < 0) col.desc = j; return; }
    if (/precio|valor|vr\b|v\/r|costo|tarifa/.test(t) && !actual) {
      if (/nuevo/.test(t)) { if (col.nuevo < 0) col.nuevo = j; } else if (col.generico < 0 || /unit/.test(t)) col.generico = j;
    }
  });
  return { ...col, valor: col.nuevo >= 0 ? col.nuevo : col.generico };
}

// Matriz (filas × columnas) → filas de precios. Devuelve también las filas sin precio nuevo (omitidas).
export function leerFilasPrecios(matriz) {
  let fila = -1, col = null;
  for (let r = 0; r < Math.min(matriz.length, 60); r++) {
    const c = clasificar(matriz[r]);
    if (c.valor >= 0 && (c.codigo >= 0 || c.desc >= 0)) { fila = r; col = c; break; }
  }
  if (fila < 0) {
    // Sin encabezados reconocibles: se adivina como en la revisión de ofertas (descripción, unidad y valor unitario).
    const d = detectarColumnas(matriz);
    if (d.columnas.desc < 0 || d.columnas.vu < 0) return { filas: [], omitidas: 0, columnas: null, fila: -1 };
    col = { codigo: -1, desc: d.columnas.desc, und: d.columnas.und, valor: d.columnas.vu, fecha: -1, fuente: -1, iva: -1 };
    fila = d.fila;
  }
  const filas = [];
  let omitidas = 0;
  for (let r = fila + 1; r < matriz.length; r++) {
    const f = matriz[r], v = (j) => (j >= 0 ? f[j] : "");
    const valor = aNumero(v(col.valor));
    const codigo = String(v(col.codigo) ?? "").trim(), desc = String(v(col.desc) ?? "").trim();
    if (!codigo && !desc) continue;
    if (valor == null) { omitidas++; continue; }
    filas.push({ fila: r + 1, codigo, desc, und: String(v(col.und) ?? "").trim(), valor, fecha: aFecha(v(col.fecha)), fuente: String(v(col.fuente) ?? "").trim(), iva: aIva(v(col.iva)) });
  }
  return { filas, omitidas, columnas: col, fila };
}

// Cotización (PDF o texto pegado): ítems con descripción y valor unitario.
export function filasDeCotizacion(matriz) {
  const d = detectarColumnas(matriz);
  if (d.columnas.desc < 0 || d.columnas.vu < 0) return [];
  return extraerItems(matriz, d).items
    .filter((it) => it.desc && Number(it.vu) > 0)
    .map((it, k) => ({ fila: k + 1, codigo: "", desc: it.desc, und: it.und || "", valor: Number(it.vu), fecha: "", fuente: "", iva: undefined }));
}

// ---------------------------------------------------------------- emparejar con la base
const unidadClave = (u) => {
  const t = normalizar(u).replace(/[^a-z0-9]/g, "");
  if (["u", "un", "und", "unid", "unidad", "unidades"].includes(t)) return "u";
  if (["m", "ml", "mt", "mts", "metro", "metros"].includes(t)) return "m";
  return t;
};
export function crearIndice(insumos) {
  const porCodigo = new Map();
  for (const x of insumos) {
    porCodigo.set(normalizar(x.codigo), x);
    for (const c of x.codigosAnteriores || []) if (!porCodigo.has(normalizar(c))) porCodigo.set(normalizar(c), x);
  }
  const porDescripcion = new Map();
  for (const x of insumos) { const k = normalizar(x.descripcion); if (k && !porDescripcion.has(k)) porDescripcion.set(k, x); }
  const porInsumo = new Map(insumos.map((x) => [x.codigo, x]));
  return { porCodigo, porDescripcion, porInsumo, sugerencias: indiceApus(insumos.map((x) => ({ codigo: x.codigo, nombre: x.descripcion, unidad: x.unidad }))) };
}
// { ins, metodo } si hay coincidencia segura; si no, { ins: null, candidatos } para que el usuario elija.
export function emparejar(fila, indice) {
  if (fila.codigo) {
    const ins = indice.porCodigo.get(normalizar(fila.codigo));
    if (ins) return { ins, metodo: "codigo", candidatos: [] };
  }
  if (fila.desc) {
    const ins = indice.porDescripcion.get(normalizar(fila.desc));
    if (ins) return { ins, metodo: "descripcion", candidatos: [] };
    const candidatos = sugerirApus({ desc: fila.desc, und: fila.und }, indice.sugerencias, 4)
      .map((c) => ({ codigo: c.codigo, descripcion: c.nombre, puntaje: c.puntaje }));
    const mejor = candidatos[0];
    if (mejor && mejor.puntaje >= UMBRAL_COINCIDENCIA) return { ins: indice.porInsumo.get(mejor.codigo), metodo: "parecido", candidatos };
    return { ins: null, metodo: "ninguno", candidatos };
  }
  return { ins: null, metodo: "ninguno", candidatos: [] };
}

// ---------------------------------------------------------------- propuesta
// nivel: "error" (no se puede aplicar), "revisar" (queda sin marcar) o "info".
export function propuesta(ins, datos, { hoy = new Date().toISOString().slice(0, 10) } = {}) {
  const alertas = [];
  const aviso = (nivel, texto) => alertas.push({ nivel, texto });
  let valor = Number(datos.valor);
  const valorArchivo = valor;
  let incluyeIva = ins.incluyeIva !== false;
  if (!(valor > 0)) aviso("error", "El precio no es un número mayor que cero.");
  if (datos.iva !== undefined && datos.iva !== incluyeIva && valor > 0) {
    valor = datos.iva ? valor / (1 + IVA) : valor * (1 + IVA);
    aviso("info", `El archivo ${datos.iva ? "incluye" : "no incluye"} IVA y la base ${incluyeIva ? "sí" : "no"}: se convirtió con IVA de ${Math.round(IVA * 100)} %.`);
  }
  valor = Math.round(valor * 100) / 100;
  const fecha = datos.fecha || hoy;
  if (fecha > hoy) aviso("error", "La fecha del precio es futura.");
  if (ins.fechaPrecio && fecha < ins.fechaPrecio) aviso("revisar", "El precio es más antiguo que el vigente: solo quedaría en el historial.");
  const actual = Number(ins.precio) > 0 ? Number(ins.precio) : null;
  const variacion = actual && valor > 0 ? valor / actual - 1 : null;
  if (variacion != null) {
    if (Math.abs(variacion) < 0.0005) aviso("revisar", "Es el mismo precio que el vigente.");
    else if (Math.abs(variacion) > SALTO_ALERTA) aviso("revisar", `Variación de ${variacion > 0 ? "+" : ""}${(variacion * 100).toFixed(0)} %: verifica la unidad, el IVA y el valor.`);
  }
  if (datos.und && ins.unidad && unidadClave(datos.und) !== unidadClave(ins.unidad)) aviso("revisar", `Unidad distinta (archivo: ${datos.und}; base: ${ins.unidad}).`);
  if (datos.metodo === "parecido") aviso("revisar", "Emparejado por parecido de la descripción: confirma que es el mismo insumo.");
  if (datos.extrapolado) aviso("revisar", "El IPP no llega a la fecha elegida (faltan más de 3 meses): se estimó con la variación anual del último año.");
  const error = alertas.some((a) => a.nivel === "error");
  return {
    codigo: ins.codigo, descripcion: ins.descripcion, unidad: ins.unidad, actual, fechaActual: ins.fechaPrecio || "",
    valor, valorArchivo, fecha, fuente: datos.fuente || "", url: datos.url || "", incluyeIva, metodo: datos.metodo || "manual",
    variacion, alertas, error, aplicar: !error && !alertas.some((a) => a.nivel === "revisar")
  };
}

// Filas del archivo → propuestas (con las que no se pudieron emparejar al final, para elegirlas a mano).
export function proponerDesdeFilas(filas, insumos, { fuentePorDefecto = "", hoy } = {}) {
  const indice = crearIndice(insumos);
  const propuestas = [], sinPareja = [];
  for (const f of filas) {
    const e = emparejar(f, indice);
    if (!e.ins) { sinPareja.push({ ...f, candidatos: e.candidatos }); continue; }
    propuestas.push({ ...propuesta(e.ins, { ...f, fuente: f.fuente || fuentePorDefecto, metodo: e.metodo }, { hoy }), texto: f.desc, candidatos: e.candidatos, fila: f.fila });
  }
  return { propuestas, sinPareja, indice };
}

// ---------------------------------------------------------------- IPP
const mes = (iso) => String(iso || "").slice(0, 7);
// Índice del mes de la fecha (o del último mes anterior con dato); null si es anterior a la serie.
export function indiceEn(puntos, fechaISO) {
  const s = [...(puntos || [])].filter((p) => p.fecha && p.valor > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  let res = null;
  for (const p of s) { if (mes(p.fecha) <= mes(fechaISO)) res = p; else break; }
  return res;
}
const mesesEntre = (a, b) => (Number(mes(b).slice(0, 4)) - Number(mes(a).slice(0, 4))) * 12 + Number(mes(b).slice(5)) - Number(mes(a).slice(5));
// Factor para llevar un precio de la fecha `desde` a la fecha `hasta` con la serie del IPP.
export function factorIPP(puntos, desde, hasta) {
  const a = indiceEn(puntos, desde);
  if (!a) return null;
  const s = [...puntos].filter((p) => p.valor > 0).sort((x, y) => x.fecha.localeCompare(y.fecha));
  const ult = s[s.length - 1];
  let b = indiceEn(puntos, hasta), extrapolado = false, mesesExtra = 0;
  if (b && mes(hasta) > mes(ult.fecha)) {
    const v = variacionIPP(puntos, 1);
    if (!v) return null;
    b = { valor: ult.valor * Math.pow(1 + v.tasaAnual, mesesEntre(ult.fecha, hasta) / 12) };
    extrapolado = true;
    mesesExtra = mesesEntre(ult.fecha, hasta);
  }
  if (!b) return null;
  return { factor: b.valor / a.valor, extrapolado, mesesExtra };
}
// Factor con una tasa anual digitada (compuesta por los meses entre las dos fechas).
export const factorManual = (tasaAnual, desde, hasta) => Math.pow(1 + (Number(tasaAnual) || 0), Math.max(0, mesesEntre(desde, hasta)) / 12);

// Reajusta por IPP (o por una tasa anual si se da) los precios con al menos `minMeses` de antigüedad.
export function proponerIPP(insumos, puntos, { hasta, tipos = ["MA"], minMeses = 7, tasaAnual = null, hoy = new Date().toISOString().slice(0, 10) } = {}) {
  const propuestas = [], sinIndice = [];
  for (const x of insumos) {
    if (!tipos.includes(x.tipo) || x.tipo === "MO") continue;
    if (!(Number(x.precio) > 0) || !x.fechaPrecio) continue;
    const m = mesesDesde(x.fechaPrecio, new Date(`${hasta}T12:00:00`));
    if (m == null || m < minMeses) continue;
    let f = null, extrapolado = false;
    if (tasaAnual != null) f = { factor: factorManual(tasaAnual, x.fechaPrecio, hasta), extrapolado: false };
    else { f = factorIPP(puntos, x.fechaPrecio, hasta); extrapolado = (f?.mesesExtra || 0) > 3; } // hasta 3 meses sin dato del IPP es normal
    if (!f) { sinIndice.push(x); continue; }
    const fuente = tasaAnual != null ? `Reajuste por tasa anual ${(tasaAnual * 100).toFixed(1)} % (${mes(x.fechaPrecio)} a ${mes(hasta)})` : `Reajuste por IPP (${mes(x.fechaPrecio)} a ${mes(hasta)}, ×${f.factor.toFixed(4)})`;
    const valor = Math.round(Number(x.precio) * f.factor);
    propuestas.push({ ...propuesta(x, { valor, fecha: hasta, fuente, metodo: "ipp", extrapolado }, { hoy }), texto: "" });
  }
  return { propuestas, sinIndice };
}
