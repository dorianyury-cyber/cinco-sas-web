// Definición de los módulos de Interventoría PRO — uno por numeral del
// informe mensual de seguimiento contractual (ej. "7. CONTRATO 040-2026
// CINCO - SEPTIEMBRE 2026.docx"), agrupados en sus 9 capítulos.
//
// Cada módulo es una configuración que interpreta la página genérica
// modulo.html (js/ip-modulo.js): campos del formulario, columnas de la
// tabla, validación por fila (semáforo), resumen arriba de la tabla y
// alertas que también aparecen en Inicio. Así agregar o ajustar un numeral
// es tocar esta configuración, no escribir otra página.
//
// Tipos de campo: text, textarea, number, money, pct, date, month, select
// (opciones), persona (elige del Listado de personal), url, imagen (foto
// comprimida a Storage) y avance (avance acumulado % mes a mes del
// contrato).

import { esc, moneda, numero, fecha, mesCorto, hoyISO, mesActual, diasEntre, mesesDelContrato } from "./ip-core.js";
import { LISTA_ACTA_INICIO, CATEGORIAS_ACTA, expandirPorFrentes } from "./ip-plantillas.js";

// ------------------------------------------------------------ utilidades

const SI_NO = ["Sí", "No"];
const SI_NO_NA = ["Sí", "No", "N/A"];

function badge(nivel, texto) {
  const clase = nivel === "danger" ? "danger" : nivel === "warn" ? "warn" : "ok";
  return `<span class="badge ${clase}">${esc(texto)}</span>`;
}

function finDeMes(ym) {
  const [a, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
}

// ¿La persona estuvo vinculada al contrato durante ese mes?
export function activoEnMes(p, ym) {
  const ini = p.fechaIngreso || "0000-00-00";
  if (ini > finDeMes(ym)) return false;
  if (p.fechaRetiro && p.fechaRetiro < `${ym}-01`) return false;
  return true;
}
function estaActivo(p) {
  return p.estado !== "Retirado" && (!p.fechaRetiro || p.fechaRetiro >= hoyISO());
}

function tarjetas(items) {
  return `<div class="grid ip-tarjetas">${items.map((t, i) => `
    <div class="stat-tile icon-tile cinta cinta-${(t.cinta ?? i) % 4}">
      <div class="icon">${t.icon || "📌"}</div>
      <div class="text"><div class="value">${t.valor}</div><div class="label">${esc(t.label)}</div></div>
    </div>`).join("")}</div>`;
}

// Tabla "tipo × mes" con conteos — la forma en que el informe presenta
// novedades, capacitaciones, inspecciones, exámenes, etc.
function matrizMensual({ registros, campoTipo, tipos, campoFecha = "fecha", meses, titulo }) {
  const conteo = (tipo, ym) => registros.filter((r) => r[campoTipo] === tipo && String(r[campoFecha] || "").startsWith(ym)).length;
  const filas = tipos.map((tipo) => {
    const celdas = meses.map((ym) => conteo(tipo, ym));
    const total = celdas.reduce((s, n) => s + n, 0);
    return `<tr><td>${esc(tipo)}</td>${celdas.map((n) => `<td class="ip-num">${n || "–"}</td>`).join("")}<td class="ip-num"><strong>${total}</strong></td></tr>`;
  }).join("");
  return `<div class="card"><h2>${esc(titulo)}</h2><div class="tabla-scroll"><table class="tabla-compacta ip-matriz">
    <thead><tr><th>Descripción</th>${meses.map((ym) => `<th class="ip-num">${mesCorto(ym)}</th>`).join("")}<th class="ip-num">Total</th></tr></thead>
    <tbody>${filas}</tbody></table></div></div>`;
}

function pctCantidad(r) {
  const c = Number(r.cantidadContratada) || 0;
  return c ? Math.round(((Number(r.cantidadEjecutada) || 0) / c) * 100) : 0;
}

function curvaSHtml(ctx) {
  if (!ctx.registros.length) return "";
  const puntos = curvaS(ctx.registros, ctx.contrato);
  const filas = puntos.map((p) => `<tr><td>${mesCorto(p.ym)}</td><td class="ip-num">${numero(p.programado, 1)}%</td><td class="ip-num">${p.ejecutado == null ? "–" : numero(p.ejecutado, 1) + "%"}</td><td class="ip-num">${p.ejecutado == null ? "–" : (p.ejecutado - p.programado >= 0 ? "+" : "") + numero(p.ejecutado - p.programado, 1)}</td></tr>`).join("");
  return `<div class="card"><h2>Avance gráfico del contrato — Curva S</h2>
    <div class="ip-curva-s">${svgCurvaS(puntos)}</div>
    <div class="tabla-scroll"><table class="tabla-compacta ip-matriz"><thead><tr><th>Mes</th><th class="ip-num">Programado acumulado</th><th class="ip-num">Ejecutado acumulado</th><th class="ip-num">Diferencia (pts)</th></tr></thead><tbody>${filas}</tbody></table></div></div>`;
}

function indicadoresHtml(ctx) {
  const meses = mesesDelContrato(ctx.contrato, { hastaHoy: true });
  const ind = indicadoresSST(meses, { personal: ctx.datos.personal || [], accidentes: ctx.registros, novedades: ctx.datos.novedades || [] });
  const filas = INDICADORES_SST.map((d) => `<tr><td><strong>${esc(d.nombre)}</strong><br><span class="text-muted ip-formula">${esc(d.formula)}</span></td>${ind.map((x) => `<td class="ip-num">${numero(x[d.clave], x[d.clave] % 1 ? 2 : 0)}%</td>`).join("")}</tr>`).join("");
  return `<div class="card"><h2>Indicadores de accidentalidad, mes a mes</h2><div class="tabla-scroll"><table class="tabla-compacta ip-matriz">
    <thead><tr><th>Indicador</th>${meses.map((ym) => `<th class="ip-num">${mesCorto(ym)}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table></div></div>`;
}

// Validación por estado de un trámite con fecha límite (entregables,
// cambios, requerimientos): vencido si pasó la fecha sin cerrarse.
function estadoConPlazo(r, cerrados, campoLimite) {
  if (cerrados.includes(r.estado)) return { nivel: "ok", texto: r.estado };
  if (r[campoLimite] && r[campoLimite] < hoyISO()) return { nivel: "danger", texto: "Vencido" };
  if (r.estado === "Con observaciones" || r.estado === "Rechazado" || r.estado === "No conforme") return { nivel: "danger", texto: r.estado };
  return { nivel: "warn", texto: r.estado || "Pendiente" };
}

function nombrePersona(ctx, id) {
  const p = (ctx.datos.personal || []).find((x) => x.id === id);
  return p ? p.nombre : "-";
}

// Avance acumulado registrado de una actividad hasta el mes "hasta"
// (incluido) — se arrastra el último valor reportado.
export function avanceReal(act, hasta = mesActual()) {
  const meses = Object.keys(act.avance || {}).filter((ym) => ym <= hasta && act.avance[ym] !== "" && act.avance[ym] != null).sort();
  return meses.length ? Number(act.avance[meses[meses.length - 1]]) || 0 : 0;
}
function sumarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
// Inicio de la actividad: el registrado o, si no, fecha de terminación
// menos su duración en semanas (así viene el cronograma en los informes de
// obra: "duración (semanas)" + "fecha de terminación").
export function inicioActividad(act) {
  if (act.fechaInicio) return act.fechaInicio;
  if (act.fechaFin && Number(act.duracionSemanas)) return sumarDias(act.fechaFin, -Math.round(Number(act.duracionSemanas) * 7));
  return act.fechaFin || null;
}
// Avance que DEBERÍA llevar en una fecha según su cronograma (lineal).
export function avanceProgramado(act, fechaISO = hoyISO()) {
  const ini = inicioActividad(act);
  if (!ini || !act.fechaFin) return null;
  if (fechaISO < ini) return 0;
  if (fechaISO >= act.fechaFin) return 100;
  const total = diasEntre(ini, act.fechaFin) || 1;
  return Math.round((diasEntre(ini, fechaISO) / total) * 100);
}

// Curva S: avance acumulado ponderado del contrato, mes a mes — programado
// (cronograma de cada actividad, repartido linealmente entre su inicio y
// su terminación y ponderado por su peso) contra ejecutado (avance
// acumulado reportado de cada actividad, ponderado). El ejecutado se
// calcula solo hasta el mes "hasta" (por defecto el actual).
export function curvaS(actividades, contrato, hasta = mesActual()) {
  const pesoTotal = actividades.reduce((s, a) => s + (Number(a.peso) || 0), 0);
  const meses = mesesDelContrato(contrato);
  return meses.map((ym) => {
    const corte = finDeMes(ym);
    let prog = 0, ejec = 0;
    actividades.forEach((a) => {
      const w = pesoTotal ? (Number(a.peso) || 0) / pesoTotal : 0;
      prog += w * (avanceProgramado(a, corte) ?? 0);
      ejec += w * avanceReal(a, ym);
    });
    return {
      ym,
      programado: Math.round(prog * 10) / 10,
      ejecutado: ym <= hasta ? Math.round(ejec * 10) / 10 : null
    };
  });
}

// Gráfico SVG de la curva S (atributos de presentación, sin style="" —
// la CSP del sitio no permite estilos en línea). Lo usa la pantalla y,
// convertido a PNG, el informe Word.
export function svgCurvaS(puntos, { ancho = 760, alto = 320, fondo = "#ffffff" } = {}) {
  const m = { izq: 44, der: 24, arr: 26, aba: 46 };
  const w = ancho - m.izq - m.der, h = alto - m.arr - m.aba;
  const n = Math.max(puntos.length - 1, 1);
  const x = (i) => m.izq + (i / n) * w;
  const y = (v) => m.arr + h - (Math.max(0, Math.min(100, v)) / 100) * h;
  const linea = (clave) => puntos.map((p, i) => (p[clave] == null ? null : `${x(i).toFixed(1)},${y(p[clave]).toFixed(1)}`)).filter(Boolean).join(" ");
  const rejilla = [0, 25, 50, 75, 100].map((v) => `<line x1="${m.izq}" x2="${m.izq + w}" y1="${y(v)}" y2="${y(v)}" stroke="#e5e7eb" stroke-width="1"/><text x="${m.izq - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#6b7280" font-family="Arial">${v}%</text>`).join("");
  const etiquetas = puntos.map((p, i) => `<text x="${x(i)}" y="${m.arr + h + 16}" font-size="10.5" text-anchor="middle" fill="#6b7280" font-family="Arial">${mesCorto(p.ym)}</text>`).join("");
  const puntosSerie = (clave, color) => puntos.map((p, i) => (p[clave] == null ? "" : `<circle cx="${x(i)}" cy="${y(p[clave])}" r="3.2" fill="${color}"/>`)).join("");
  const ultimo = [...puntos].reverse().find((p) => p.ejecutado != null);
  const iUlt = ultimo ? puntos.indexOf(ultimo) : -1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">
    <rect x="0" y="0" width="${ancho}" height="${alto}" fill="${fondo}"/>
    ${rejilla}${etiquetas}
    <polyline points="${linea("programado")}" fill="none" stroke="#1f5fbf" stroke-width="2.5" stroke-dasharray="7 5"/>
    <polyline points="${linea("ejecutado")}" fill="none" stroke="#e08a00" stroke-width="3"/>
    ${puntosSerie("programado", "#1f5fbf")}${puntosSerie("ejecutado", "#e08a00")}
    ${iUlt >= 0 ? `<text x="${x(iUlt)}" y="${y(ultimo.ejecutado) - 9}" font-size="12" font-weight="bold" text-anchor="${iUlt === puntos.length - 1 ? "end" : "middle"}" fill="#b86f00" font-family="Arial">${ultimo.ejecutado}%</text>` : ""}
    <line x1="${m.izq}" x2="${m.izq + 26}" y1="${alto - 12}" y2="${alto - 12}" stroke="#1f5fbf" stroke-width="2.5" stroke-dasharray="7 5"/>
    <text x="${m.izq + 32}" y="${alto - 8}" font-size="11.5" fill="#374151" font-family="Arial">Programado acumulado</text>
    <line x1="${m.izq + 190}" x2="${m.izq + 216}" y1="${alto - 12}" y2="${alto - 12}" stroke="#e08a00" stroke-width="3"/>
    <text x="${m.izq + 222}" y="${alto - 8}" font-size="11.5" fill="#374151" font-family="Arial">Ejecutado acumulado</text>
  </svg>`;
}
export function avancePonderado(actividades) {
  const pesoTotal = actividades.reduce((s, a) => s + (Number(a.peso) || 0), 0);
  if (!pesoTotal) return { real: 0, programado: 0 };
  let real = 0, prog = 0;
  actividades.forEach((a) => {
    const w = (Number(a.peso) || 0) / pesoTotal;
    real += w * avanceReal(a);
    prog += w * (avanceProgramado(a) ?? 0);
  });
  return { real: Math.round(real * 10) / 10, programado: Math.round(prog * 10) / 10 };
}

// Estado financiero: valor total (inicial + adiciones - reducciones),
// ejecutado (actas/constancias de cumplimiento) y saldo.
export function estadoFinanciero(contrato, movimientos) {
  const suma = (tipo) => movimientos.filter((m) => m.tipo === tipo).reduce((s, m) => s + (Number(m.valor) || 0), 0);
  const valorTotal = (Number(contrato?.valorInicial) || 0) + suma("Adición") - suma("Reducción");
  const ejecutado = suma("Acta parcial / Constancia de cumplimiento") + suma("Acta de recibo final");
  return {
    valorTotal, ejecutado,
    saldo: valorTotal - ejecutado,
    pct: valorTotal ? Math.round((ejecutado / valorTotal) * 10000) / 100 : 0,
    anticipo: suma("Anticipo"),
    amortizado: suma("Amortización de anticipo")
  };
}

// Indicadores de accidentalidad mes a mes (Res. 0312 de 2019), con el
// personal vinculado de cada mes como base — así los presenta el informe
// de obra: tasa de accidentalidad, severidad, enfermedad laboral y
// ausentismo.
export function indicadoresSST(meses, { personal = [], accidentes = [], novedades = [] }) {
  return meses.map((ym) => {
    const trabajadores = personal.filter((p) => activoEnMes(p, ym)).length;
    const delMes = accidentes.filter((a) => String(a.fecha || "").startsWith(ym));
    const at = delMes.filter((a) => a.tipo === "Accidente de trabajo").length;
    const el = accidentes.filter((a) => a.tipo === "Enfermedad laboral" && String(a.fecha || "") <= finDeMes(ym)).length;
    const diasAT = delMes.reduce((s, a) => s + (Number(a.diasIncapacidad) || 0), 0);
    const ini = `${ym}-01`, fin = finDeMes(ym);
    const diasAusencia = novedades.filter((n) => n.tipo === "Incapacidad").reduce((s, n) => {
      const desde = n.fecha > ini ? n.fecha : ini;
      const hasta = (n.fechaFin || n.fecha) < fin ? (n.fechaFin || n.fecha) : fin;
      return s + (hasta >= desde ? diasEntre(desde, hasta) + 1 : 0);
    }, 0);
    const pct = (num, den) => (den ? Math.round((num / den) * 10000) / 100 : 0);
    return {
      ym, trabajadores,
      accidentalidad: pct(at, trabajadores),
      severidad: pct(diasAT, trabajadores),
      enfermedad: pct(el, trabajadores),
      ausentismo: pct(diasAusencia, trabajadores * 30)
    };
  });
}
export const INDICADORES_SST = [
  { clave: "accidentalidad", nombre: "Tasa de accidentalidad", formula: "(N.º de accidentes de trabajo del mes / N.º de trabajadores del mes) × 100" },
  { clave: "severidad", nombre: "Severidad de los accidentes de trabajo", formula: "(Días de incapacidad por accidente de trabajo del mes / N.º de trabajadores del mes) × 100" },
  { clave: "enfermedad", nombre: "Tasa de enfermedad laboral", formula: "(Casos de enfermedad laboral / N.º de trabajadores del mes) × 100" },
  { clave: "ausentismo", nombre: "Ausentismo", formula: "(Días de ausencia por incapacidad del mes / días programados de trabajo) × 100" }
];

// ------------------------------------------------------------ capítulos

const CAPITULO_LABEL = {
  administrativo: "Aspectos administrativos", financiero: "Aspectos financieros", juridico: "Aspectos jurídicos",
  sst: "Seguridad y salud en el trabajo", social: "Aspectos sociales", ambiental: "Aspectos ambientales",
  tecnico: "Aspectos técnicos", riesgos: "Matriz de riesgos", fotografico: "Registro fotográfico",
  calidad: "Calidad (ISO 9001)"
};
export const CAPITULOS_OPCIONES = Object.entries(CAPITULO_LABEL).map(([valor, texto]) => ({ valor, texto }));
export function nombreCapitulo(id) { return CAPITULO_LABEL[id] || id || "-"; }

// Menú lateral / pantalla de bienvenida: capítulos del informe en su orden
// (la numeración es la del informe mensual). Dentro de cada capítulo, los
// módulos van en el orden en que ocurren en una interventoría real (pedido
// del usuario): primero lo que se exige al iniciar, luego lo del día a día
// y al final observaciones y anexos. El orden del informe NO sale de aquí
// (ip-informe-contenido.js tiene el suyo).
export const CAPITULOS = [
  { id: "administrativo", numero: "1", label: "Administrativo", icon: "🗂️", desc: "Información del contrato, acta de inicio, cronología de actas y anexos", items: [
    { href: "contratos.html", label: "Información del contrato", foto: "info-contrato" }, { m: "actainicio" }, { m: "cronologia" }, { m: "observaciones", cap: "administrativo" }, { m: "anexos", cap: "administrativo" }
  ] },
  { id: "financiero", numero: "2", label: "Financiero", icon: "💰", desc: "Inversión del anticipo, estado financiero y actas de pago", items: [
    { m: "anticipo" }, { m: "financiero" }, { m: "observaciones", cap: "financiero" }, { m: "anexos", cap: "financiero" }
  ] },
  { id: "juridico", numero: "3", label: "Jurídico", icon: "⚖️", desc: "Pólizas, requerimientos y multas", items: [
    { m: "garantias" }, { m: "requerimientos" }, { m: "observaciones", cap: "juridico" }, { m: "anexos", cap: "juridico" }
  ] },
  { id: "sst", numero: "4", label: "Seguridad y Salud en el Trabajo", icon: "🦺", desc: "Personal, exámenes, seguridad social, EPP, capacitación y accidentalidad", items: [
    { m: "personal" }, { m: "examenes" }, { m: "segsocial" }, { m: "epp" },
    { m: "capacitaciones", cap: "sst" }, { m: "inspecciones" }, { m: "novedades" }, { m: "accidentes" },
    { m: "observaciones", cap: "sst" }, { m: "anexos", cap: "sst" }
  ] },
  { id: "social", numero: "5", label: "Social", icon: "🤝", desc: "Socialización del proyecto con la comunidad", items: [
    { m: "socializacion" }, { m: "anexos", cap: "social" }
  ] },
  { id: "ambiental", numero: "6", label: "Ambiental", icon: "🌱", desc: "Aspectos e impactos, indicadores y requisitos legales", items: [
    { m: "requisitos" }, { m: "aspectos" }, { m: "planambiental" },
    { m: "capacitaciones", cap: "ambiental", label: "Capacitaciones ambientales", foto: "capacitaciones-ambiental" },
    { m: "indicadores" }, { m: "incidentesamb" },
    { m: "observaciones", cap: "ambiental" }, { m: "anexos", cap: "ambiental" }
  ] },
  { id: "tecnico", numero: "7", label: "Técnico", icon: "📐", desc: "Avance y curva S, equipos FAT/SAT, consignaciones, cantidades y cambios", items: [
    { m: "actividades" }, { m: "suministros" }, { m: "consignaciones" }, { m: "cantidades" }, { m: "cambios" }, { m: "observaciones", cap: "tecnico", label: "Resumen y observaciones" }, { m: "anexos", cap: "tecnico" }
  ] },
  { id: "riesgos", numero: "8", label: "Matriz de riesgos", icon: "⚠️", desc: "Riesgos del contrato, impacto y monitoreo", items: [
    { m: "riesgos" }
  ] },
  { id: "fotografico", numero: "9", label: "Registro fotográfico", icon: "📷", desc: "Evidencias fotográficas con su observación", items: [
    { m: "fotos" }
  ] },
  { id: "calidad", numero: "10", label: "Calidad (ISO 9001)", icon: "🏅", desc: "Plan de calidad, entregables del contratista y no conformidades", items: [
    { m: "entregables" }, { m: "noconformidades" }, { m: "observaciones", cap: "calidad" }, { m: "anexos", cap: "calidad" }
  ] }
];

// ------------------------------------------------------------ módulos

export const MODULOS = {
  // ======================= 1. ADMINISTRATIVO
  cronologia: {
    acumulaEnInforme: true,
    label: "Cronología de actas", icon: "🗓️", coleccion: "cronologia",
    desc: "Resumen cronológico de las actividades administrativas: actas de inicio, suspensión, reinicio, adiciones, prórrogas, liquidación.",
    campos: [
      { key: "tipo", label: "Tipo", type: "select", opciones: ["Acta de inicio", "Acta de suspensión", "Acta de reinicio", "Adición", "Prórroga", "Otrosí", "Acta parcial", "Acta de recibo final", "Acta de liquidación", "Comunicación", "Otro"], required: true },
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "descripcion", label: "Descripción", type: "textarea", required: true, ancho: true },
      { key: "enlace", label: "Documento (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 13 }, { key: "tipo", ancho: 20 }, { key: "descripcion", ancho: 52 }, { key: "enlace", ancho: 15 }],
    orden: { key: "fecha", dir: 1 }
  },

  observaciones: {
    label: "Observaciones", icon: "📝", coleccion: "observaciones", porCapitulo: "capitulo",
    desc: "Observaciones del periodo, mes a mes, para este capítulo del informe.",
    campos: [
      { key: "mes", label: "Mes del informe", type: "month", required: true, porDefecto: () => mesActual() },
      { key: "texto", label: "Observación", type: "textarea", required: true, ancho: true, filas: 6 }
    ],
    columnas: [{ key: "mes", ancho: 14 }, { key: "texto", ancho: 86 }],
    orden: { key: "mes", dir: -1 }
  },

  anexos: {
    label: "Documentos anexos", icon: "📎", coleccion: "anexos", porCapitulo: "capitulo",
    desc: "Documentos soporte (enlaces a OneDrive/Drive) de este capítulo, por mes.",
    campos: [
      { key: "nombre", label: "Nombre del documento", type: "text", required: true, ancho: true },
      { key: "mes", label: "Mes", type: "month", porDefecto: () => mesActual() },
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "enlace", label: "Enlace", type: "url", required: true, ancho: true }
    ],
    columnas: [{ key: "mes", ancho: 12 }, { key: "nombre", ancho: 58 }, { key: "fecha", ancho: 12 }, { key: "enlace", ancho: 18 }],
    orden: { key: "mes", dir: -1 }
  },

  // ======================= 2. FINANCIERO
  financiero: {
    acumulaEnInforme: true,
    label: "Estado financiero", icon: "💵", coleccion: "financiero",
    desc: "Adiciones, actas parciales / constancias de cumplimiento, anticipo y amortizaciones. El valor inicial se toma de la información del contrato.",
    campos: [
      { key: "tipo", label: "Tipo de movimiento", type: "select", opciones: ["Acta parcial / Constancia de cumplimiento", "Acta de recibo final", "Adición", "Reducción", "Anticipo", "Amortización de anticipo"], required: true },
      { key: "descripcion", label: "Descripción", type: "text", required: true, placeholder: "Ej. Constancia de cumplimiento 7" },
      { key: "numero", label: "N.º acta / factura", type: "text" },
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "valor", label: "Valor", type: "money", required: true }
    ],
    columnas: [{ key: "fecha", ancho: 11 }, { key: "tipo", ancho: 26 }, { key: "descripcion", ancho: 33 }, { key: "numero", ancho: 12 }, { key: "valor", ancho: 18 }],
    orden: { key: "fecha", dir: 1 },
    necesita: ["actividades"],
    resumen(ctx) {
      const ef = estadoFinanciero(ctx.contrato, ctx.registros);
      const tecnico = avancePonderado(ctx.datos.actividades || []).real;
      // Tabla como la del informe: valor inicial, adiciones y cada acta con
      // su ejecutado, el saldo que queda y el avance financiero acumulado.
      let saldo = Number(ctx.contrato.valorInicial) || 0;
      let acumulado = 0;
      const filas = [`<tr><td>Valor inicial del contrato</td><td class="ip-num">${moneda(saldo)}</td><td class="ip-num">–</td><td class="ip-num">${moneda(saldo)}</td><td class="ip-num">–</td></tr>`];
      [...ctx.registros].filter((m) => ["Adición", "Reducción", "Acta parcial / Constancia de cumplimiento", "Acta de recibo final"].includes(m.tipo))
        .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
        .forEach((m) => {
          const v = Number(m.valor) || 0;
          if (m.tipo === "Adición") { saldo += v; filas.push(`<tr><td>${esc(m.descripcion)}</td><td class="ip-num">${moneda(v)}</td><td class="ip-num">–</td><td class="ip-num">${moneda(saldo)}</td><td class="ip-num">–</td></tr>`); }
          else if (m.tipo === "Reducción") { saldo -= v; filas.push(`<tr><td>${esc(m.descripcion)}</td><td class="ip-num">-${moneda(v)}</td><td class="ip-num">–</td><td class="ip-num">${moneda(saldo)}</td><td class="ip-num">–</td></tr>`); }
          else { saldo -= v; acumulado += v; filas.push(`<tr><td>${esc(m.descripcion)}</td><td class="ip-num">–</td><td class="ip-num">${moneda(v)}</td><td class="ip-num">${moneda(saldo)}</td><td class="ip-num">${ef.valorTotal ? numero((acumulado / ef.valorTotal) * 100, 2) : 0}%</td></tr>`); }
        });
      filas.push(`<tr class="ip-fila-total"><td>Total</td><td class="ip-num">${moneda(ef.valorTotal)}</td><td class="ip-num">${moneda(ef.ejecutado)}</td><td class="ip-num">${moneda(ef.saldo)}</td><td class="ip-num">${numero(ef.pct, 2)}%</td></tr>`);
      return tarjetas([
        { icon: "📄", valor: moneda(ef.valorTotal), label: "Valor total del contrato" },
        { icon: "✅", valor: moneda(ef.ejecutado), label: "Valor ejecutado" },
        { icon: "💼", valor: moneda(ef.saldo), label: "Saldo por ejecutar" },
        { icon: "📊", valor: `${numero(ef.pct, 2)}%`, label: `Avance financiero (técnico: ${numero(tecnico, 1)}%)` }
      ]) + `<div class="card"><h2>Estado financiero del contrato</h2><div class="tabla-scroll"><table class="tabla-compacta">
        <thead><tr><th>Descripción</th><th class="ip-num">Valores asignados</th><th class="ip-num">Valor ejecutado</th><th class="ip-num">Saldo</th><th class="ip-num">Avance financiero</th></tr></thead>
        <tbody>${filas.join("")}</tbody></table></div></div>`;
    },
    alertas(ctx) {
      const out = [];
      if (!Number(ctx.contrato.valorInicial)) out.push({ nivel: "warn", texto: "El contrato no tiene valor inicial registrado (Información del contrato)." });
      const ef = estadoFinanciero(ctx.contrato, ctx.registros);
      if (ef.saldo < 0) out.push({ nivel: "danger", texto: `Lo ejecutado supera el valor del contrato en ${moneda(-ef.saldo)}.` });
      return out;
    }
  },

  anticipo: {
    acumulaEnInforme: true,
    label: "Inversión del anticipo", icon: "🏦", coleccion: "anticipo",
    desc: "En qué se invirtió el anticipo recibido. El anticipo y sus amortizaciones se registran en Estado financiero.",
    campos: [
      { key: "concepto", label: "Concepto", type: "text", required: true, ancho: true },
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "valor", label: "Valor", type: "money", required: true },
      { key: "soporte", label: "Soporte (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 13 }, { key: "concepto", ancho: 55 }, { key: "valor", ancho: 17 }, { key: "soporte", ancho: 15 }],
    orden: { key: "fecha", dir: 1 },
    necesita: ["financiero"],
    resumen(ctx) {
      const ef = estadoFinanciero(ctx.contrato, ctx.datos.financiero || []);
      const invertido = ctx.registros.reduce((s, r) => s + (Number(r.valor) || 0), 0);
      if (!ef.anticipo && !invertido) {
        return `<div class="card"><p class="text-muted ip-sin-margen">Este contrato no registra anticipo. Si lo tiene, regístralo en <a href="modulo.html?m=financiero">Estado financiero</a> como movimiento tipo "Anticipo".</p></div>`;
      }
      return tarjetas([
        { icon: "🏦", valor: moneda(ef.anticipo), label: "Anticipo recibido" },
        { icon: "🧾", valor: moneda(invertido), label: "Invertido (soportado)" },
        { icon: "⏳", valor: moneda(ef.anticipo - invertido), label: "Por invertir" },
        { icon: "↩️", valor: moneda(ef.anticipo - ef.amortizado), label: "Por amortizar" }
      ]);
    },
    alertas(ctx) {
      const ef = estadoFinanciero(ctx.contrato, ctx.datos.financiero || []);
      const invertido = ctx.registros.reduce((s, r) => s + (Number(r.valor) || 0), 0);
      return invertido > ef.anticipo && ef.anticipo > 0 ? [{ nivel: "warn", texto: "Lo invertido supera el anticipo recibido." }] : [];
    }
  },

  // ======================= 3. JURÍDICO
  garantias: {
    sinFiltroMes: true,
    label: "Garantías y pólizas", icon: "🛡️", coleccion: "garantias",
    desc: "Cuadro de control de garantías: aseguradora, póliza, amparo y vigencia. Avisa lo vencido y lo que vence en 30 días.",
    campos: [
      { key: "aseguradora", label: "Compañía aseguradora", type: "text", required: true },
      { key: "poliza", label: "Póliza N.º", type: "text", required: true },
      { key: "amparo", label: "Amparo", type: "select", opciones: ["Cumplimiento", "Buen manejo y correcta inversión del anticipo", "Pago de salarios, prestaciones sociales e indemnizaciones", "Calidad del servicio", "Estabilidad y calidad de la obra", "Responsabilidad civil extracontractual", "Otro"], required: true },
      { key: "valorAsegurado", label: "Valor asegurado", type: "money" },
      { key: "vigenciaDesde", label: "Vigencia desde", type: "date", required: true },
      { key: "vigenciaHasta", label: "Vigencia hasta", type: "date", required: true },
      { key: "clausula", label: "Cláusula / exigencia contractual", type: "text", ancho: true },
      { key: "observacion", label: "Observación", type: "textarea", ancho: true }
    ],
    columnas: [{ key: "amparo", ancho: 30 }, { key: "aseguradora", ancho: 18 }, { key: "poliza", ancho: 12 }, { key: "valorAsegurado", ancho: 14 }, { key: "vigenciaHasta", label: "Vence", ancho: 11 }],
    orden: { key: "vigenciaHasta", dir: 1 },
    validar(r) {
      if (!r.vigenciaHasta) return { nivel: "warn", texto: "Sin vigencia" };
      const dias = diasEntre(hoyISO(), r.vigenciaHasta);
      if (dias < 0) return { nivel: "danger", texto: "Vencida" };
      if (dias <= 30) return { nivel: "warn", texto: `Vence en ${dias} d` };
      return { nivel: "ok", texto: "Vigente" };
    },
    alertas(ctx) {
      const out = [];
      ctx.registros.forEach((r) => {
        const v = MODULOS.garantias.validar(r);
        if (v.nivel !== "ok") out.push({ nivel: v.nivel, texto: `Póliza ${r.poliza} (${r.amparo}): ${v.texto.toLowerCase()}.` });
      });
      if (!ctx.registros.length) out.push({ nivel: "warn", texto: "No hay garantías registradas." });
      return out;
    }
  },

  // ======================= 4. SST
  personal: {
    claveImport: "cedula",
    filtroMes: (r, ym) => activoEnMes(r, ym),
    label: "Listado de personal", icon: "👷", coleccion: "personal",
    desc: "Personal que labora en el contrato, con afiliaciones y salario. Valida que el salario no esté por debajo del SMMLV ni del pactado para el cargo.",
    campos: [
      { key: "nombre", label: "Nombre completo", type: "text", required: true },
      { key: "cedula", label: "Cédula", type: "text", required: true },
      { key: "cargo", label: "Cargo", type: "text", required: true },
      { key: "matricula", label: "Matrícula / licencia profesional", type: "text" },
      { key: "eps", label: "EPS", type: "text" },
      { key: "afp", label: "AFP (pensión)", type: "text" },
      { key: "arl", label: "ARL", type: "text" },
      { key: "tipoVinculacion", label: "Tipo de vinculación", type: "select", opciones: ["Término fijo", "Término indefinido", "Obra o labor", "Prestación de servicios"] },
      { key: "salario", label: "Salario / honorarios mensual", type: "money" },
      { key: "salarioPactado", label: "Salario pactado para el cargo (propuesta)", type: "money", ayuda: "Valor ofrecido en la propuesta o exigido en los términos para este cargo. Si el salario real es menor, se marca." },
      { key: "fechaIngreso", label: "Fecha de ingreso al contrato", type: "date", required: true },
      { key: "fechaRetiro", label: "Fecha de retiro", type: "date" },
      { key: "estado", label: "Estado", type: "select", opciones: ["Activo", "Retirado"], required: true, porDefecto: () => "Activo" },
      { key: "telefono", label: "Teléfono", type: "text" },
      { key: "correo", label: "Correo", type: "text" }
    ],
    columnas: [{ key: "nombre", ancho: 20 }, { key: "cedula", ancho: 10 }, { key: "cargo", ancho: 16 }, { key: "eps", ancho: 9 }, { key: "afp", ancho: 9 }, { key: "arl", ancho: 8 }, { key: "salario", ancho: 11 }, { key: "estado", ancho: 7 }],
    orden: { key: "nombre", dir: 1 },
    validar(r, ctx) {
      if (r.estado === "Retirado") return { nivel: "ok", texto: "Retirado" };
      const smmlv = Number(ctx.contrato.smmlv) || 0;
      const salario = Number(r.salario) || 0;
      if (!salario) return { nivel: "warn", texto: "Sin salario" };
      if (smmlv && r.tipoVinculacion !== "Prestación de servicios" && salario < smmlv) return { nivel: "danger", texto: "Bajo el SMMLV" };
      if (Number(r.salarioPactado) && salario < Number(r.salarioPactado)) return { nivel: "danger", texto: "Menor al pactado" };
      if (!r.eps || !r.afp || !r.arl) return { nivel: "warn", texto: "Falta afiliación" };
      return { nivel: "ok", texto: "OK" };
    },
    resumen(ctx) {
      const activos = ctx.registros.filter(estaActivo);
      const nomina = activos.reduce((s, p) => s + (Number(p.salario) || 0), 0);
      const conProblema = activos.filter((p) => MODULOS.personal.validar(p, ctx).nivel !== "ok").length;
      const avisoSmmlv = Number(ctx.contrato.smmlv) ? "" : `<div class="alert info ip-alerta-fija">Para validar salarios contra el mínimo, registra el SMMLV vigente en la <a href="contratos.html?editar=${ctx.contrato.id}">información del contrato</a>.</div>`;
      return avisoSmmlv + tarjetas([
        { icon: "👷", valor: activos.length, label: "Personal activo" },
        { icon: "🚪", valor: ctx.registros.length - activos.length, label: "Retirados" },
        { icon: "💵", valor: moneda(nomina), label: "Nómina mensual (activos)" },
        { icon: conProblema ? "⚠️" : "✅", valor: conProblema, label: "Con salario o afiliación por revisar", cinta: conProblema ? 1 : 3 }
      ]);
    },
    alertas(ctx) {
      return ctx.registros.filter(estaActivo).map((p) => ({ p, v: MODULOS.personal.validar(p, ctx) }))
        .filter((x) => x.v.nivel !== "ok")
        .map((x) => ({ nivel: x.v.nivel, texto: `${x.p.nombre}: ${x.v.texto}.` }));
    }
  },

  novedades: {
    label: "Novedades de personal", icon: "🔄", coleccion: "novedades",
    desc: "Afiliaciones, retiros, incapacidades, vacaciones, licencias y cambios de cargo, con el conteo mes a mes del informe.",
    campos: [
      { key: "persona", label: "Persona", type: "persona", required: true },
      { key: "tipo", label: "Novedad", type: "select", opciones: ["Afiliación / ingreso", "Retiro", "Incapacidad", "Vacaciones", "Licencia", "Cambio de cargo", "Otra"], required: true },
      { key: "fecha", label: "Fecha inicio", type: "date", required: true },
      { key: "fechaFin", label: "Fecha fin", type: "date" },
      { key: "observacion", label: "Observación / evidencia", type: "textarea", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 12 }, { key: "persona", ancho: 28 }, { key: "tipo", ancho: 20 }, { key: "fechaFin", ancho: 12 }, { key: "observacion", ancho: 28 }],
    orden: { key: "fecha", dir: -1 },
    resumen(ctx) {
      return matrizMensual({ registros: ctx.registros, campoTipo: "tipo", tipos: MODULOS.novedades.campos[1].opciones, meses: mesesDelContrato(ctx.contrato), titulo: "Número de novedades por mes" });
    }
  },

  epp: {
    label: "EPP y dotación", icon: "🥽", coleccion: "epp",
    desc: "Entregas de elementos de protección personal y/o dotación. Avisa quién está activo y no tiene ninguna entrega registrada.",
    campos: [
      { key: "persona", label: "Persona", type: "persona", required: true },
      { key: "fecha", label: "Fecha de entrega", type: "date", required: true },
      { key: "tipo", label: "Tipo", type: "select", opciones: ["EPP", "Dotación", "EPP y dotación"], required: true },
      { key: "elementos", label: "Elementos entregados", type: "textarea", ancho: true },
      { key: "evidencia", label: "Evidencia (enlace al acta firmada)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 12 }, { key: "persona", ancho: 28 }, { key: "tipo", ancho: 14 }, { key: "elementos", ancho: 32 }, { key: "evidencia", ancho: 14 }],
    orden: { key: "fecha", dir: -1 },
    necesita: ["personal"],
    resumen(ctx) {
      const activos = (ctx.datos.personal || []).filter(estaActivo);
      const filas = activos.map((p) => {
        const ultima = ctx.registros.filter((r) => r.persona === p.id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
        return `<tr><td>${esc(p.nombre)}</td><td>${esc(p.cargo || "")}</td><td>${ultima ? badge("ok", "Sí") : badge("danger", "No")}</td><td>${ultima ? fecha(ultima.fecha) : "-"}</td></tr>`;
      }).join("");
      return `<div class="card"><h2>Entrega por persona activa</h2><div class="tabla-scroll"><table class="tabla-compacta">
        <thead><tr><th>Nombre</th><th>Cargo</th><th>Entrega</th><th>Última entrega</th></tr></thead><tbody>${filas || '<tr><td colspan="4" class="text-muted">Registra primero el personal.</td></tr>'}</tbody></table></div></div>`;
    },
    alertas(ctx) {
      const sin = (ctx.datos.personal || []).filter(estaActivo).filter((p) => !ctx.registros.some((r) => r.persona === p.id));
      return sin.length ? [{ nivel: "warn", texto: `${sin.length} persona(s) activa(s) sin entrega de EPP/dotación registrada.` }] : [];
    }
  },

  examenes: {
    label: "Exámenes ocupacionales", icon: "🩺", coleccion: "examenes",
    desc: "Exámenes de ingreso, periódicos y de egreso. Avisa quién no tiene examen de ingreso y qué periódicos están vencidos.",
    campos: [
      { key: "persona", label: "Persona", type: "persona", required: true },
      { key: "tipo", label: "Tipo de examen", type: "select", opciones: ["Ingreso", "Periódico", "Egreso"], required: true },
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "concepto", label: "Concepto", type: "select", opciones: ["Apto", "Apto con restricciones", "No apto", "Pendiente"] },
      { key: "vence", label: "Próximo examen / vence", type: "date", ayuda: "Normalmente un año después del examen." },
      { key: "evidencia", label: "Evidencia (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 12 }, { key: "persona", ancho: 30 }, { key: "tipo", ancho: 13 }, { key: "concepto", ancho: 18 }, { key: "vence", ancho: 13 }],
    orden: { key: "fecha", dir: -1 },
    necesita: ["personal"],
    validar(r) {
      if (r.vence && r.vence < hoyISO()) return { nivel: "danger", texto: "Vencido" };
      if (r.concepto === "No apto") return { nivel: "danger", texto: "No apto" };
      return { nivel: "ok", texto: "OK" };
    },
    resumen(ctx) {
      const meses = mesesDelContrato(ctx.contrato);
      return matrizMensual({ registros: ctx.registros, campoTipo: "tipo", tipos: ["Ingreso", "Periódico", "Egreso"], meses, titulo: "Número de exámenes realizados por mes" });
    },
    alertas(ctx) {
      const out = [];
      const activos = (ctx.datos.personal || []).filter(estaActivo);
      const sinIngreso = activos.filter((p) => !ctx.registros.some((r) => r.persona === p.id && r.tipo === "Ingreso"));
      if (sinIngreso.length) out.push({ nivel: "warn", texto: `${sinIngreso.length} persona(s) activa(s) sin examen de ingreso: ${sinIngreso.slice(0, 4).map((p) => p.nombre).join(", ")}${sinIngreso.length > 4 ? "…" : ""}.` });
      activos.forEach((p) => {
        const ultimo = ctx.registros.filter((r) => r.persona === p.id && r.tipo !== "Egreso").sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
        if (ultimo?.vence && ultimo.vence < hoyISO()) out.push({ nivel: "danger", texto: `${p.nombre}: examen periódico vencido desde ${fecha(ultimo.vence)}.` });
      });
      return out;
    }
  },

  segsocial: {
    label: "Seguridad social", icon: "🏥", coleccion: "segsocial",
    desc: "Planilla PILA de cada mes. Compara los cotizantes pagados con el personal que estuvo vinculado ese mes y avisa los meses sin planilla.",
    campos: [
      { key: "mes", label: "Mes (periodo cotizado)", type: "month", required: true, porDefecto: () => mesActual() },
      { key: "planilla", label: "N.º de planilla", type: "text", required: true },
      { key: "fechaPago", label: "Fecha de pago", type: "date", required: true },
      { key: "cotizantes", label: "N.º de cotizantes (empleados)", type: "number", required: true },
      { key: "valor", label: "Valor pagado", type: "money" },
      { key: "evidencia", label: "Evidencia (enlace)", type: "url", ancho: true },
      { key: "observacion", label: "Observación", type: "textarea", ancho: true }
    ],
    columnas: [{ key: "mes", ancho: 12 }, { key: "planilla", ancho: 18 }, { key: "fechaPago", ancho: 13 }, { key: "cotizantes", ancho: 12 }, { key: "valor", ancho: 17 }],
    orden: { key: "mes", dir: -1 },
    necesita: ["personal"],
    validar(r, ctx) {
      const vinculados = (ctx.datos.personal || []).filter((p) => activoEnMes(p, r.mes)).length;
      if (Number(r.cotizantes) < vinculados) return { nivel: "danger", texto: `Faltan ${vinculados - Number(r.cotizantes)}` };
      return { nivel: "ok", texto: "OK" };
    },
    resumen(ctx) {
      const meses = mesesDelContrato(ctx.contrato, { hastaHoy: true });
      const filas = meses.map((ym) => {
        const vinc = (ctx.datos.personal || []).filter((p) => activoEnMes(p, ym)).length;
        const pl = ctx.registros.filter((r) => r.mes === ym);
        const cot = pl.reduce((s, r) => s + (Number(r.cotizantes) || 0), 0);
        const estado = !vinc && !pl.length ? '<span class="text-muted">Sin personal</span>' : !pl.length ? badge(ym < mesActual() ? "danger" : "warn", "Sin planilla") : cot < vinc ? badge("danger", `Faltan ${vinc - cot}`) : badge("ok", "Completo");
        return `<tr><td>${mesCorto(ym)}</td><td class="ip-num">${vinc}</td><td class="ip-num">${pl.length ? cot : "-"}</td><td>${pl.map((r) => esc(r.planilla)).join(", ") || "-"}</td><td>${pl.map((r) => fecha(r.fechaPago)).join(", ") || "-"}</td><td>${estado}</td></tr>`;
      }).join("");
      return `<div class="card"><h2>Afiliación y pagos de seguridad social, mes a mes</h2><div class="tabla-scroll"><table class="tabla-compacta">
        <thead><tr><th>Mes</th><th class="ip-num">Personal vinculado</th><th class="ip-num">Cotizantes pagados</th><th>Planilla</th><th>Fecha de pago</th><th>Estado</th></tr></thead>
        <tbody>${filas}</tbody></table></div></div>`;
    },
    alertas(ctx) {
      const out = [];
      mesesDelContrato(ctx.contrato, { hastaHoy: true }).filter((ym) => ym < mesActual()).forEach((ym) => {
        const vinc = (ctx.datos.personal || []).filter((p) => activoEnMes(p, ym)).length;
        if (!vinc) return;
        const pl = ctx.registros.filter((r) => r.mes === ym);
        const cot = pl.reduce((s, r) => s + (Number(r.cotizantes) || 0), 0);
        if (!pl.length) out.push({ nivel: "danger", texto: `Sin planilla de seguridad social registrada para ${mesCorto(ym)}.` });
        else if (cot < vinc) out.push({ nivel: "danger", texto: `${mesCorto(ym)}: ${cot} cotizantes pagados para ${vinc} personas vinculadas.` });
      });
      return out;
    }
  },

  accidentes: {
    necesita: ["personal", "novedades"],
    label: "Accidentalidad", icon: "🚑", coleccion: "accidentes",
    desc: "Accidentes e incidentes de trabajo: reporte a la ARL, investigación y días de incapacidad.",
    campos: [
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "tipo", label: "Tipo", type: "select", opciones: ["Accidente de trabajo", "Incidente", "Enfermedad laboral"], required: true },
      { key: "persona", label: "Persona", type: "persona" },
      { key: "descripcion", label: "Descripción", type: "textarea", required: true, ancho: true },
      { key: "diasIncapacidad", label: "Días de incapacidad", type: "number" },
      { key: "reportadoArl", label: "¿Reportado a la ARL?", type: "select", opciones: SI_NO_NA },
      { key: "investigado", label: "¿Investigado?", type: "select", opciones: SI_NO },
      { key: "evidencia", label: "Evidencia (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 12 }, { key: "tipo", ancho: 18 }, { key: "persona", ancho: 20 }, { key: "descripcion", ancho: 34 }, { key: "diasIncapacidad", label: "Días", ancho: 8 }],
    orden: { key: "fecha", dir: -1 },
    validar(r) {
      if (r.investigado !== "Sí") return { nivel: "warn", texto: "Sin investigar" };
      return { nivel: "ok", texto: "Investigado" };
    },
    resumen(ctx) {
      const tablaInd = indicadoresHtml(ctx);
      if (!ctx.registros.length) return `<div class="card"><p class="ip-sin-margen">✅ El contratista no presenta accidentes ni incidentes de trabajo registrados durante la ejecución del contrato.</p></div>` + tablaInd;
      const dias = ctx.registros.reduce((s, r) => s + (Number(r.diasIncapacidad) || 0), 0);
      return tarjetas([
        { icon: "🚑", valor: ctx.registros.filter((r) => r.tipo === "Accidente de trabajo").length, label: "Accidentes de trabajo" },
        { icon: "⚠️", valor: ctx.registros.filter((r) => r.tipo === "Incidente").length, label: "Incidentes" },
        { icon: "🛏️", valor: dias, label: "Días de incapacidad" },
        { icon: "🔍", valor: ctx.registros.filter((r) => r.investigado !== "Sí").length, label: "Sin investigar", cinta: 1 }
      ]) + tablaInd;
    },
    alertas(ctx) {
      const n = ctx.registros.filter((r) => r.investigado !== "Sí").length;
      return n ? [{ nivel: "warn", texto: `${n} accidente(s)/incidente(s) sin investigar.` }] : [];
    }
  },

  capacitaciones: {
    label: "Capacitación", icon: "🎓", coleccion: "capacitaciones", porCapitulo: "categoria",
    desc: "Inducciones, capacitaciones, pausas activas y simulacros, con el número de asistentes y el conteo mes a mes.",
    campos: [
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "tipo", label: "Tipo", type: "select", opciones: ["Inducción", "Reinducción", "Capacitación", "Pausas activas", "Simulacro", "Charla", "Otra"], required: true },
      { key: "tema", label: "Tema", type: "text", required: true, ancho: true },
      { key: "asistentes", label: "N.º de asistentes", type: "number" },
      { key: "evidencia", label: "Evidencia (formato de asistencia)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 12 }, { key: "tipo", ancho: 16 }, { key: "tema", ancho: 50 }, { key: "asistentes", ancho: 10 }, { key: "evidencia", ancho: 12 }],
    orden: { key: "fecha", dir: -1 },
    resumen(ctx) {
      return matrizMensual({ registros: ctx.registros, campoTipo: "tipo", tipos: MODULOS.capacitaciones.campos[1].opciones, meses: mesesDelContrato(ctx.contrato), titulo: "Número de capacitaciones realizadas por mes" });
    }
  },

  inspecciones: {
    label: "Inspecciones", icon: "🔎", coleccion: "inspecciones",
    desc: "Inspecciones de vehículos, equipos y herramientas, EPP, botiquín, extintores y locativas, con hallazgos y acción correctiva.",
    campos: [
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "tipo", label: "Tipo de inspección", type: "select", opciones: ["Vehículos", "Equipos y herramientas", "Elementos de protección personal", "Botiquín", "Extintores", "Locativa", "Otra"], required: true },
      { key: "resultado", label: "Resultado", type: "select", opciones: ["Conforme", "No conforme"], required: true },
      { key: "hallazgos", label: "Hallazgos", type: "textarea", ancho: true },
      { key: "accion", label: "Acción correctiva", type: "textarea", ancho: true },
      { key: "evidencia", label: "Evidencia (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 12 }, { key: "tipo", ancho: 26 }, { key: "resultado", ancho: 14 }, { key: "hallazgos", ancho: 48 }],
    orden: { key: "fecha", dir: -1 },
    validar(r) {
      if (r.resultado === "No conforme" && !r.accion) return { nivel: "danger", texto: "Sin acción" };
      if (r.resultado === "No conforme") return { nivel: "warn", texto: "No conforme" };
      return { nivel: "ok", texto: "Conforme" };
    },
    resumen(ctx) {
      return matrizMensual({ registros: ctx.registros, campoTipo: "tipo", tipos: MODULOS.inspecciones.campos[1].opciones, meses: mesesDelContrato(ctx.contrato), titulo: "Número de inspecciones por mes" });
    },
    alertas(ctx) {
      const n = ctx.registros.filter((r) => r.resultado === "No conforme" && !r.accion).length;
      return n ? [{ nivel: "danger", texto: `${n} inspección(es) no conforme(s) sin acción correctiva.` }] : [];
    }
  },

  // ======================= 5. SOCIAL
  socializacion: {
    label: "Socialización del proyecto", icon: "📣", coleccion: "socializacion",
    desc: "Reuniones y actividades de socialización con la comunidad, el cliente o la supervisión.",
    campos: [
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "actividad", label: "Actividad", type: "text", required: true, ancho: true },
      { key: "lugar", label: "Lugar", type: "text" },
      { key: "asistentes", label: "N.º de asistentes", type: "number" },
      { key: "descripcion", label: "Descripción / acuerdos", type: "textarea", ancho: true },
      { key: "evidencia", label: "Evidencia (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 12 }, { key: "actividad", ancho: 40 }, { key: "lugar", ancho: 20 }, { key: "asistentes", ancho: 12 }, { key: "evidencia", ancho: 16 }],
    orden: { key: "fecha", dir: -1 }
  },

  // ======================= 6. AMBIENTAL
  aspectos: {
    sinFiltroMes: true,
    label: "Aspectos e impactos", icon: "🍃", coleccion: "aspectos",
    desc: "Identificación de aspectos e impactos ambientales por actividad, con su medida de control.",
    campos: [
      { key: "actividad", label: "Actividad", type: "text", required: true, ancho: true },
      { key: "aspecto", label: "Aspecto ambiental", type: "text", required: true },
      { key: "impacto", label: "Impacto ambiental", type: "text", required: true },
      { key: "significancia", label: "Significancia", type: "select", opciones: ["Alta", "Media", "Baja"] },
      { key: "control", label: "Medida de control / gestión", type: "textarea", ancho: true }
    ],
    columnas: [{ key: "actividad", ancho: 26 }, { key: "aspecto", ancho: 22 }, { key: "impacto", ancho: 24 }, { key: "significancia", ancho: 10 }, { key: "control", ancho: 18 }],
    orden: { key: "actividad", dir: 1 }
  },

  planambiental: {
    label: "Plan de gestión ambiental", icon: "🗒️", coleccion: "planambiental",
    desc: "Actividades del plan de gestión ambiental y gestión derivada de los impactos, con su estado de cumplimiento.",
    campos: [
      { key: "actividad", label: "Actividad", type: "text", required: true, ancho: true },
      { key: "fechaProgramada", label: "Fecha programada", type: "date", required: true },
      { key: "estado", label: "Estado", type: "select", opciones: ["Pendiente", "En curso", "Cumplida"], required: true, porDefecto: () => "Pendiente" },
      { key: "evidencia", label: "Evidencia (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fechaProgramada", label: "Programada", ancho: 14 }, { key: "actividad", ancho: 60 }, { key: "estado", ancho: 12 }],
    orden: { key: "fechaProgramada", dir: 1 },
    validar(r) {
      if (r.estado === "Cumplida") return { nivel: "ok", texto: "Cumplida" };
      if (r.fechaProgramada && r.fechaProgramada < hoyISO()) return { nivel: "danger", texto: "Vencida" };
      return { nivel: "warn", texto: r.estado || "Pendiente" };
    },
    resumen(ctx) {
      const total = ctx.registros.length;
      const cumplidas = ctx.registros.filter((r) => r.estado === "Cumplida").length;
      return total ? tarjetas([
        { icon: "🗒️", valor: total, label: "Actividades del plan" },
        { icon: "✅", valor: cumplidas, label: "Cumplidas" },
        { icon: "📊", valor: `${Math.round((cumplidas / total) * 100)}%`, label: "Cumplimiento del plan" }
      ]) : "";
    },
    alertas(ctx) {
      const n = ctx.registros.filter((r) => MODULOS.planambiental.validar(r).nivel === "danger").length;
      return n ? [{ nivel: "danger", texto: `${n} actividad(es) del plan de gestión ambiental vencida(s).` }] : [];
    }
  },

  indicadores: {
    label: "Indicadores ambientales", icon: "📈", coleccion: "indicadores",
    desc: "Medición mensual de los indicadores ambientales frente a su meta.",
    campos: [
      { key: "indicador", label: "Indicador", type: "text", required: true, ancho: true },
      { key: "mes", label: "Mes", type: "month", required: true, porDefecto: () => mesActual() },
      { key: "meta", label: "Meta", type: "number", required: true },
      { key: "resultado", label: "Resultado", type: "number", required: true },
      { key: "sentido", label: "La meta se cumple si el resultado es…", type: "select", opciones: ["Mayor o igual", "Menor o igual"], porDefecto: () => "Mayor o igual" },
      { key: "unidad", label: "Unidad", type: "text", placeholder: "%, kWh, kg…" }
    ],
    columnas: [{ key: "mes", ancho: 12 }, { key: "indicador", ancho: 48 }, { key: "meta", ancho: 12 }, { key: "resultado", ancho: 12 }, { key: "unidad", ancho: 10 }],
    orden: { key: "mes", dir: -1 },
    validar(r) {
      const ok = r.sentido === "Menor o igual" ? Number(r.resultado) <= Number(r.meta) : Number(r.resultado) >= Number(r.meta);
      return ok ? { nivel: "ok", texto: "Cumple" } : { nivel: "danger", texto: "No cumple" };
    }
  },

  requisitos: {
    sinFiltroMes: true,
    label: "Requisitos legales ambientales", icon: "📜", coleccion: "requisitos",
    desc: "Normas ambientales aplicables y su cumplimiento.",
    campos: [
      { key: "norma", label: "Norma", type: "text", required: true },
      { key: "requisito", label: "Requisito", type: "textarea", required: true, ancho: true },
      { key: "cumple", label: "¿Cumple?", type: "select", opciones: SI_NO_NA, required: true },
      { key: "evidencia", label: "Evidencia (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "norma", ancho: 20 }, { key: "requisito", ancho: 62 }, { key: "cumple", ancho: 10 }],
    orden: { key: "norma", dir: 1 },
    validar(r) { return r.cumple === "No" ? { nivel: "danger", texto: "No cumple" } : { nivel: "ok", texto: r.cumple || "-" }; },
    alertas(ctx) {
      const n = ctx.registros.filter((r) => r.cumple === "No").length;
      return n ? [{ nivel: "danger", texto: `${n} requisito(s) legal(es) ambiental(es) sin cumplir.` }] : [];
    }
  },

  incidentesamb: {
    label: "Incidentes ambientales", icon: "🛢️", coleccion: "incidentesamb",
    desc: "Incidentes ambientales, acción tomada y su estado.",
    campos: [
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "descripcion", label: "Descripción", type: "textarea", required: true, ancho: true },
      { key: "accion", label: "Acción tomada", type: "textarea", ancho: true },
      { key: "estado", label: "Estado", type: "select", opciones: ["Abierto", "Cerrado"], porDefecto: () => "Abierto" }
    ],
    columnas: [{ key: "fecha", ancho: 12 }, { key: "descripcion", ancho: 48 }, { key: "accion", ancho: 30 }],
    orden: { key: "fecha", dir: -1 },
    validar(r) { return r.estado === "Cerrado" ? { nivel: "ok", texto: "Cerrado" } : { nivel: "warn", texto: "Abierto" }; },
    resumen(ctx) {
      return ctx.registros.length ? "" : `<div class="card"><p class="ip-sin-margen">✅ No se presentan incidentes ambientales registrados.</p></div>`;
    }
  },

  // ======================= 7. TÉCNICO
  actividades: {
    claveImport: "item",
    sinFiltroMes: true,
    label: "Avance de actividades", icon: "📊", coleccion: "actividades",
    desc: "Actividades del contrato con su peso y fechas. Registra el avance acumulado (%) de cada mes: el sistema calcula el avance ponderado y lo compara con lo programado a hoy.",
    campos: [
      { key: "item", label: "Ítem", type: "number", required: true },
      { key: "actividad", label: "Actividad", type: "text", required: true, ancho: true },
      { key: "peso", label: "Peso (%) dentro del contrato", type: "pct", required: true, ayuda: "Lo que pesa esta actividad en el avance total. Lo ideal es que los pesos sumen 100%." },
      { key: "duracionSemanas", label: "Duración (semanas)", type: "number", ayuda: "Si no registras la fecha de inicio, se calcula como fecha de terminación menos esta duración." },
      { key: "fechaInicio", label: "Fecha de inicio", type: "date" },
      { key: "fechaFin", label: "Fecha de terminación", type: "date", required: true },
      { key: "avance", label: "Avance acumulado (%) por mes", type: "avance", ancho: true }
    ],
    columnas: [
      { key: "item", ancho: 6 }, { key: "actividad", ancho: 42 }, { key: "peso", ancho: 9 }, { key: "fechaFin", label: "Termina", ancho: 12 },
      { key: "_real", label: "Real", ancho: 9, render: (r) => `${numero(avanceReal(r), 0)}%` },
      { key: "_prog", label: "Programado", ancho: 11, render: (r) => { const p = avanceProgramado(r); return p == null ? "-" : `${p}%`; } }
    ],
    orden: { key: "item", dir: 1, numerico: true },
    validar(r) {
      const real = avanceReal(r);
      const prog = avanceProgramado(r);
      if (real >= 100) return { nivel: "ok", texto: "Terminada" };
      if (prog != null && real < prog - 10) return { nivel: "danger", texto: `Atrasada ${Math.round(prog - real)} pts` };
      if (prog != null && real < prog) return { nivel: "warn", texto: "Leve atraso" };
      return { nivel: "ok", texto: "Al día" };
    },
    resumen(ctx) {
      const { real, programado } = avancePonderado(ctx.registros);
      const pesoTotal = ctx.registros.reduce((s, a) => s + (Number(a.peso) || 0), 0);
      const barras = [...ctx.registros].sort((a, b) => (Number(a.item) || 0) - (Number(b.item) || 0)).map((a) => {
        const r = avanceReal(a); const p = avanceProgramado(a) ?? 0;
        return `<div class="ip-barra-fila"><div class="ip-barra-label">${esc(a.item)}. ${esc(a.actividad)}</div>
          <div class="ip-barra-pista"><div class="ip-barra-prog" data-ancho="${p}"></div><div class="ip-barra-real" data-ancho="${r}"></div></div>
          <div class="ip-barra-valor">${numero(r, 0)}% <span class="text-muted">/ ${p}%</span></div></div>`;
      }).join("");
      return (Math.abs(pesoTotal - 100) > 0.5 && ctx.registros.length ? `<div class="alert info ip-alerta-fija">Los pesos de las actividades suman ${numero(pesoTotal, 1)}% — el avance ponderado se calcula proporcional, pero lo ideal es que sumen 100%.</div>` : "") +
        tarjetas([
          { icon: "📊", valor: `${numero(real, 1)}%`, label: "Avance real ponderado" },
          { icon: "🎯", valor: `${numero(programado, 1)}%`, label: "Avance programado a hoy" },
          { icon: real < programado - 5 ? "⚠️" : "✅", valor: `${real >= programado ? "+" : ""}${numero(real - programado, 1)} pts`, label: "Diferencia", cinta: real < programado - 5 ? 1 : 3 },
          { icon: "📋", valor: ctx.registros.length, label: "Actividades" }
        ]) +
        curvaSHtml(ctx) +
        (barras ? `<div class="card"><h2>Avance por actividad</h2><p class="text-muted ip-leyenda"><span class="ip-leyenda-real"></span> Real &nbsp; <span class="ip-leyenda-prog"></span> Programado a hoy</p>${barras}</div>` : "");
    },
    alertas(ctx) {
      return ctx.registros.map((a) => ({ a, v: MODULOS.actividades.validar(a) })).filter((x) => x.v.nivel === "danger")
        .map((x) => ({ nivel: "danger", texto: `Actividad ${x.a.item} (${x.a.actividad}): ${x.v.texto.toLowerCase()}.` }));
    }
  },

  cantidades: {
    label: "Cantidades de obra", icon: "🏗️", coleccion: "cantidades", soloObra: true, sinFiltroMes: true,
    desc: "Resumen general de actividades técnicas: cantidades contratadas contra ejecutadas por componente (redes de media y baja tensión, acometidas, transformadores, medida, apoyos…).",
    campos: [
      { key: "componente", label: "Componente", type: "select", opciones: ["Líneas de media tensión (LMT)", "Redes de baja tensión (RBT)", "Acometidas", "Transformadores", "Sistema de medida", "Apoyos", "Alumbrado público", "Obra civil", "Otro"], required: true },
      { key: "tipo", label: "Tipo / fases", type: "text", placeholder: "Ej. 2ø, 3ø, 1ø, AMI" },
      { key: "especificacion", label: "Especificación", type: "text", required: true, placeholder: "Ej. Red trenzada 2×50+50, 25 kVA, concreto 750 kg", ancho: true },
      { key: "unidad", label: "Unidad", type: "select", opciones: ["km", "m", "und", "global"], required: true },
      { key: "cantidadContratada", label: "Cantidad contratada", type: "number", required: true },
      { key: "cantidadEjecutada", label: "Cantidad ejecutada", type: "number" },
      { key: "estado", label: "Estado", type: "text", placeholder: "Ej. Construida, conectada y energizada", ancho: true }
    ],
    columnas: [
      { key: "componente", ancho: 20 }, { key: "tipo", ancho: 7 }, { key: "especificacion", ancho: 25 }, { key: "unidad", ancho: 6 },
      { key: "cantidadContratada", label: "Contratada", ancho: 9 }, { key: "cantidadEjecutada", label: "Ejecutada", ancho: 9 },
      { key: "_pct", label: "% ejec.", ancho: 7, render: (r) => `${pctCantidad(r)}%` },
      { key: "estado", ancho: 17 }
    ],
    orden: { key: "componente", dir: 1 },
    validar(r) {
      const p = pctCantidad(r);
      if (p >= 100) return { nivel: "ok", texto: p > 100 ? "Mayor cantidad" : "Completa" };
      if (p > 0) return { nivel: "warn", texto: "En ejecución" };
      return { nivel: "warn", texto: "Sin ejecutar" };
    },
    resumen(ctx) {
      if (!ctx.registros.length) return "";
      const grupos = {};
      ctx.registros.forEach((r) => {
        const g = (grupos[r.componente] = grupos[r.componente] || { contratada: 0, ejecutada: 0, n: 0 });
        g.n++; g.contratada += Math.min(100, pctCantidad(r));
      });
      const items = Object.entries(grupos).map(([nombre, g], i) => ({ icon: "🏗️", valor: `${Math.round(g.contratada / g.n)}%`, label: nombre, cinta: i }));
      return tarjetas(items);
    }
  },

  // ======================= 8. RIESGOS
  riesgos: {
    sinFiltroMes: true,
    label: "Matriz de riesgos", icon: "🧭", coleccion: "riesgos",
    desc: "Riesgos del contrato con su probabilidad, impacto, medida de monitoreo y responsable.",
    campos: [
      { key: "item", label: "Ítem", type: "number" },
      { key: "categoria", label: "Categoría", type: "select", opciones: ["Regulatorio", "Técnico", "Financiero", "Operativo", "Seguridad y salud", "Ambiental", "Social", "Contractual", "Otro"], required: true },
      { key: "riesgo", label: "Riesgo", type: "textarea", required: true, ancho: true },
      { key: "probabilidad", label: "Probabilidad", type: "select", opciones: ["Alta", "Media", "Baja"], required: true },
      { key: "impacto", label: "Impacto", type: "select", opciones: ["Alto", "Medio", "Bajo"], required: true },
      { key: "monitoreo", label: "Monitoreo y revisión (medida)", type: "textarea", ancho: true },
      { key: "responsable", label: "Responsable", type: "text" },
      { key: "estado", label: "Estado", type: "select", opciones: ["Abierto", "Mitigado", "Cerrado"], porDefecto: () => "Abierto" },
      { key: "fechaRevision", label: "Última revisión", type: "date" }
    ],
    columnas: [{ key: "item", ancho: 6 }, { key: "categoria", ancho: 14 }, { key: "riesgo", ancho: 40 }, { key: "probabilidad", ancho: 10 }, { key: "impacto", ancho: 10 }, { key: "estado", ancho: 10 }],
    orden: { key: "item", dir: 1, numerico: true },
    validar(r) {
      if (r.estado === "Cerrado") return { nivel: "ok", texto: "Cerrado" };
      const p = { Alta: 3, Media: 2, Baja: 1 }[r.probabilidad] || 1;
      const i = { Alto: 3, Medio: 2, Bajo: 1 }[r.impacto] || 1;
      const nivel = p * i;
      if (nivel >= 6) return { nivel: "danger", texto: "Nivel alto" };
      if (nivel >= 3) return { nivel: "warn", texto: "Nivel medio" };
      return { nivel: "ok", texto: "Nivel bajo" };
    },
    resumen(ctx) {
      const abiertos = ctx.registros.filter((r) => r.estado !== "Cerrado");
      const cuenta = (n) => abiertos.filter((r) => MODULOS.riesgos.validar(r).texto === n).length;
      return tarjetas([
        { icon: "🔴", valor: cuenta("Nivel alto"), label: "Riesgos de nivel alto", cinta: 1 },
        { icon: "🟠", valor: cuenta("Nivel medio"), label: "Riesgos de nivel medio", cinta: 2 },
        { icon: "🟢", valor: cuenta("Nivel bajo"), label: "Riesgos de nivel bajo", cinta: 3 },
        { icon: "✔️", valor: ctx.registros.length - abiertos.length, label: "Cerrados", cinta: 0 }
      ]);
    },
    alertas(ctx) {
      const n = ctx.registros.filter((r) => MODULOS.riesgos.validar(r).texto === "Nivel alto").length;
      return n ? [{ nivel: "warn", texto: `${n} riesgo(s) abierto(s) de nivel alto en la matriz.` }] : [];
    }
  },

  // ======================= 9. REGISTRO FOTOGRÁFICO
  fotos: {
    label: "Registro fotográfico", icon: "📷", coleccion: "fotos", vista: "galeria",
    desc: "Fotos de las actividades con su observación y fecha — base del registro fotográfico del informe.",
    campos: [
      { key: "foto", label: "Foto", type: "imagen", required: true, ancho: true },
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "capitulo", label: "Capítulo relacionado", type: "select", opcionesObj: CAPITULOS_OPCIONES },
      { key: "observacion", label: "Observación", type: "textarea", required: true, ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 14 }, { key: "observacion", ancho: 60 }, { key: "capitulo", ancho: 26 }],
    orden: { key: "fecha", dir: -1 }
  },

  // ======================= ACTA DE INICIO (Administrativo)
  actainicio: {
    label: "Requisitos acta de inicio", icon: "✅", coleccion: "actainicio", sinFiltroMes: true,
    desc: "Lista de chequeo de requisitos previos para suscribir el acta de inicio (garantías, personal, plan de calidad, cronograma, anticipo, SST, sitio). Usa «Cargar lista base» para traer los requisitos de los términos de referencia.",
    plantilla: LISTA_ACTA_INICIO,
    expandir: expandirPorFrentes,
    claveUnica: "requisito",
    campos: [
      { key: "categoria", label: "Categoría", type: "select", opciones: CATEGORIAS_ACTA, required: true },
      { key: "proyecto", label: "Proyecto / frente", type: "frente" },
      { key: "requisito", label: "Requisito", type: "textarea", required: true, ancho: true },
      { key: "soporte", label: "Soporte (numeral TDR / norma)", type: "text" },
      { key: "responsable", label: "Responsable", type: "select", opciones: ["Contratista", "Contratante", "Interventoría"], required: true },
      { key: "estado", label: "Estado", type: "select", opciones: ["Pendiente", "Recibido", "Con observaciones", "Aprobado", "No aplica"], required: true, porDefecto: () => "Pendiente" },
      { key: "fecha", label: "Fecha de recibo / verificación", type: "date" },
      { key: "observacion", label: "Observación", type: "textarea", ancho: true },
      { key: "evidencia", label: "Evidencia (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "categoria", ancho: 15 }, { key: "requisito", ancho: 43 }, { key: "proyecto", label: "Frente", ancho: 9 }, { key: "soporte", ancho: 11 }, { key: "responsable", ancho: 10 }],
    orden: { key: "categoria", dir: 1 },
    validar(r) {
      if (["Aprobado", "No aplica"].includes(r.estado)) return { nivel: "ok", texto: r.estado };
      if (r.estado === "Con observaciones") return { nivel: "danger", texto: "Con observaciones" };
      return { nivel: "warn", texto: r.estado || "Pendiente" };
    },
    resumen(ctx) {
      if (!ctx.registros.length) return "";
      const listos = ctx.registros.filter((r) => ["Aprobado", "No aplica"].includes(r.estado)).length;
      const obs = ctx.registros.filter((r) => r.estado === "Con observaciones").length;
      const pct = Math.round((listos / ctx.registros.length) * 100);
      const porCat = CATEGORIAS_ACTA.map((c) => {
        const regs = ctx.registros.filter((r) => r.categoria === c);
        if (!regs.length) return "";
        const ok = regs.filter((r) => ["Aprobado", "No aplica"].includes(r.estado)).length;
        const p = Math.round((ok / regs.length) * 100);
        return `<div class="ip-barra-fila"><div class="ip-barra-label">${esc(c)}</div><div class="ip-barra-pista"><div class="ip-barra-real" data-ancho="${p}"></div></div><div class="ip-barra-valor">${ok} / ${regs.length}</div></div>`;
      }).join("");
      return tarjetas([
        { icon: pct === 100 ? "✅" : "📋", valor: `${pct}%`, label: "Requisitos cumplidos", cinta: pct === 100 ? 3 : 0 },
        { icon: "⏳", valor: ctx.registros.length - listos - obs, label: "Pendientes o en revisión", cinta: 2 },
        { icon: "⚠️", valor: obs, label: "Con observaciones", cinta: 1 },
        { icon: "🧾", valor: ctx.registros.length, label: "Requisitos en la lista" }
      ]) + `<div class="card"><h2>Avance por categoría</h2>${porCat}</div>`;
    },
    alertas(ctx) {
      const pend = ctx.registros.filter((r) => !["Aprobado", "No aplica"].includes(r.estado)).length;
      const actaFirmada = (ctx.datos.cronologia || []).some((c) => c.tipo === "Acta de inicio");
      if (!ctx.registros.length) return [{ nivel: "warn", texto: "No se ha cargado la lista de chequeo del acta de inicio." }];
      if (pend && !actaFirmada) return [{ nivel: "warn", texto: `${pend} requisito(s) del acta de inicio sin aprobar.` }];
      if (pend && actaFirmada) return [{ nivel: "danger", texto: `El acta de inicio ya se registró pero quedan ${pend} requisito(s) sin aprobar.` }];
      return [];
    },
    necesita: ["cronologia"]
  },

  // ======================= 3. JURÍDICO — requerimientos e incumplimientos
  requerimientos: {
    label: "Requerimientos y multas", icon: "📮", coleccion: "requerimientos",
    desc: "Requerimientos por incumplimiento y su debido proceso: explicación solicitada, respuesta del contratista, análisis de la interventoría y multa propuesta según el contrato.",
    campos: [
      { key: "fecha", label: "Fecha del requerimiento", type: "date", required: true },
      { key: "proyecto", label: "Proyecto / frente", type: "frente" },
      { key: "obligacion", label: "Obligación incumplida", type: "textarea", required: true, ancho: true },
      { key: "radicado", label: "Radicado / oficio", type: "text" },
      { key: "plazoRespuesta", label: "Plazo de respuesta", type: "date" },
      { key: "respuesta", label: "Respuesta del contratista", type: "textarea", ancho: true },
      { key: "estado", label: "Estado", type: "select", opciones: ["Enviado", "Respondido", "Subsanado", "Escalado al contratante", "Multa impuesta", "Cerrado"], required: true, porDefecto: () => "Enviado" },
      { key: "diasRetraso", label: "Días de retraso (si es por plazo)", type: "number" },
      { key: "multaPropuesta", label: "Multa propuesta", type: "money", ayuda: "Según la cláusula de multas del contrato (ej. 0,5 % del valor por día de retraso o por obligación incumplida, con tope del 10 %)." },
      { key: "evidencia", label: "Evidencia (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 11 }, { key: "obligacion", ancho: 38 }, { key: "proyecto", label: "Frente", ancho: 10 }, { key: "radicado", ancho: 12 }, { key: "plazoRespuesta", label: "Responder antes de", ancho: 13 }],
    orden: { key: "fecha", dir: -1 },
    validar(r) { return estadoConPlazo(r, ["Subsanado", "Cerrado", "Multa impuesta"], "plazoRespuesta"); },
    resumen(ctx) {
      if (!ctx.registros.length) return "";
      const multas = ctx.registros.reduce((s, r) => s + (Number(r.multaPropuesta) || 0), 0);
      const tope = (Number(ctx.contrato.valorInicial) || 0) * 0.1;
      return tarjetas([
        { icon: "📮", valor: ctx.registros.length, label: "Requerimientos" },
        { icon: "⏳", valor: ctx.registros.filter((r) => !["Subsanado", "Cerrado", "Multa impuesta"].includes(r.estado)).length, label: "Abiertos", cinta: 2 },
        { icon: "💸", valor: moneda(multas), label: tope ? `Multas propuestas (tope 10 %: ${moneda(tope)})` : "Multas propuestas", cinta: 1 }
      ]);
    },
    alertas(ctx) {
      const venc = ctx.registros.filter((r) => estadoConPlazo(r, ["Subsanado", "Cerrado", "Multa impuesta"], "plazoRespuesta").texto === "Vencido").length;
      return venc ? [{ nivel: "danger", texto: `${venc} requerimiento(s) con plazo de respuesta vencido.` }] : [];
    }
  },

  // ======================= 7. TÉCNICO — suministro de equipos (FAT / SAT)
  suministros: {
    label: "Equipos y suministros (FAT/SAT)", icon: "🏭", coleccion: "suministros", sinFiltroMes: true,
    desc: "Seguimiento de los equipos y suministros principales: ficha técnica, certificados de conformidad, pruebas en fábrica (FAT), despacho, llegada a sitio y pruebas en sitio (SAT).",
    campos: [
      { key: "equipo", label: "Equipo", type: "text", required: true, placeholder: "Ej. Transformador de potencia 40/50 MVA", ancho: true },
      { key: "proyecto", label: "Proyecto / frente", type: "frente", required: true },
      { key: "tipo", label: "Tipo", type: "select", opciones: ["Transformador de potencia", "Celdas o tableros", "Interruptores", "Seccionadores", "Transformadores de instrumentación", "Descargadores (DPS)", "Equipos de protección y control (IED)", "Servicios auxiliares AC/DC", "Equipos de medida", "Cables y conductores", "Estructuras y apoyos", "Otro"], required: true },
      { key: "fabricante", label: "Fabricante / referencia", type: "text" },
      { key: "fichaTecnica", label: "Ficha técnica", type: "select", opciones: ["Pendiente", "En revisión", "Con observaciones", "Aprobada"], porDefecto: () => "Pendiente" },
      { key: "certificados", label: "Certificado RETIE / conformidad", type: "select", opciones: ["Pendiente", "Recibido", "No aplica"], porDefecto: () => "Pendiente" },
      { key: "fatProgramada", label: "FAT programada", type: "date" },
      { key: "fatResultado", label: "Resultado FAT", type: "select", opciones: ["Sin realizar", "Aprobada", "Aprobada con observaciones", "Rechazada"], porDefecto: () => "Sin realizar" },
      { key: "llegadaSitio", label: "Llegada a sitio", type: "date" },
      { key: "satResultado", label: "Resultado SAT", type: "select", opciones: ["Sin realizar", "Aprobada", "Aprobada con observaciones", "Rechazada"], porDefecto: () => "Sin realizar" },
      { key: "declaracionImportacion", label: "Declaración de importación DIAN", type: "select", opciones: ["Pendiente", "Recibida", "No aplica"], porDefecto: () => "No aplica" },
      { key: "observacion", label: "Observación", type: "textarea", ancho: true },
      { key: "evidencia", label: "Protocolos / evidencia (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "equipo", ancho: 26 }, { key: "proyecto", label: "Frente", ancho: 9 }, { key: "fichaTecnica", label: "Ficha", ancho: 11 }, { key: "fatProgramada", label: "FAT", ancho: 11 }, { key: "fatResultado", label: "Resultado FAT", ancho: 13 }, { key: "llegadaSitio", label: "En sitio", ancho: 10 }, { key: "satResultado", label: "SAT", ancho: 10 }],
    orden: { key: "proyecto", dir: 1 },
    validar(r) {
      if (r.fatResultado === "Rechazada" || r.satResultado === "Rechazada") return { nivel: "danger", texto: "Prueba rechazada" };
      if (r.fichaTecnica === "Con observaciones") return { nivel: "danger", texto: "Ficha con obs." };
      if (r.fatProgramada && r.fatProgramada < hoyISO() && r.fatResultado === "Sin realizar") return { nivel: "danger", texto: "FAT vencida" };
      if (r.satResultado === "Aprobada") return { nivel: "ok", texto: "En servicio" };
      if (r.llegadaSitio) return { nivel: "ok", texto: "En sitio" };
      if (r.fichaTecnica !== "Aprobada") return { nivel: "warn", texto: "Ficha sin aprobar" };
      return { nivel: "warn", texto: "En fabricación" };
    },
    resumen(ctx) {
      if (!ctx.registros.length) return "";
      const n = (f) => ctx.registros.filter(f).length;
      return tarjetas([
        { icon: "📄", valor: `${n((r) => r.fichaTecnica === "Aprobada")}/${ctx.registros.length}`, label: "Fichas técnicas aprobadas" },
        { icon: "🏭", valor: n((r) => (r.fatResultado || "").startsWith("Aprobada")), label: "FAT aprobadas", cinta: 2 },
        { icon: "🚚", valor: n((r) => !!r.llegadaSitio), label: "Equipos en sitio", cinta: 0 },
        { icon: "⚡", valor: n((r) => (r.satResultado || "").startsWith("Aprobada")), label: "SAT aprobadas", cinta: 3 }
      ]);
    },
    alertas(ctx) {
      return ctx.registros.map((r) => ({ r, v: MODULOS.suministros.validar(r) })).filter((x) => x.v.nivel === "danger")
        .map((x) => ({ nivel: "danger", texto: `${x.r.equipo} (${x.r.proyecto || "-"}): ${x.v.texto.toLowerCase()}.` }));
    }
  },

  // ======================= 7. TÉCNICO — control de cambios de diseño
  cambios: {
    label: "Control de cambios", icon: "🔁", coleccion: "cambios",
    desc: "Ajustes al diseño o a la ejecución propuestos por el contratista: justificación técnica, profesional responsable, concepto de la interventoría e impacto en costo y plazo.",
    campos: [
      { key: "fecha", label: "Fecha de solicitud", type: "date", required: true },
      { key: "proyecto", label: "Proyecto / frente", type: "frente", required: true },
      { key: "descripcion", label: "Cambio propuesto", type: "textarea", required: true, ancho: true },
      { key: "justificacion", label: "Justificación técnica", type: "textarea", ancho: true },
      { key: "firmadoPor", label: "Ingeniero que firma (matrícula)", type: "text" },
      { key: "impactoCosto", label: "Impacto en costo", type: "money" },
      { key: "impactoPlazo", label: "Impacto en plazo (días)", type: "number" },
      { key: "plazoRespuesta", label: "Responder antes de", type: "date" },
      { key: "estado", label: "Estado", type: "select", opciones: ["Radicado", "En revisión", "Con observaciones", "Aprobado", "Rechazado"], required: true, porDefecto: () => "Radicado" },
      { key: "evidencia", label: "Planos / memorias (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 11 }, { key: "proyecto", label: "Frente", ancho: 10 }, { key: "descripcion", ancho: 44 }, { key: "impactoCosto", label: "Costo", ancho: 13 }, { key: "impactoPlazo", label: "Días", ancho: 7 }],
    orden: { key: "fecha", dir: -1 },
    validar(r) { return estadoConPlazo(r, ["Aprobado"], "plazoRespuesta"); },
    alertas(ctx) {
      const abiertos = ctx.registros.filter((r) => ["Radicado", "En revisión"].includes(r.estado));
      const venc = abiertos.filter((r) => r.plazoRespuesta && r.plazoRespuesta < hoyISO()).length;
      return venc ? [{ nivel: "danger", texto: `${venc} solicitud(es) de cambio sin respuesta de la interventoría dentro del plazo.` }] : [];
    }
  },

  // ======================= 7. TÉCNICO — plan de consignaciones
  consignaciones: {
    label: "Plan de consignaciones", icon: "🔌", coleccion: "consignaciones",
    desc: "Consignaciones y maniobras para trabajar en instalaciones en servicio (ej. subestaciones o redes energizadas): programación, solicitud al operador y cumplimiento de tiempos.",
    campos: [
      { key: "fecha", label: "Fecha programada", type: "date", required: true },
      { key: "proyecto", label: "Proyecto / frente", type: "frente", required: true },
      { key: "equipo", label: "Bahía / equipo a consignar", type: "text", required: true },
      { key: "trabajo", label: "Trabajo a realizar", type: "textarea", required: true, ancho: true },
      { key: "horaInicio", label: "Hora inicio", type: "text", placeholder: "07:00" },
      { key: "duracionHoras", label: "Duración (horas)", type: "number" },
      { key: "numero", label: "N.º de consignación", type: "text" },
      { key: "estado", label: "Estado", type: "select", opciones: ["Programada", "Solicitada", "Aprobada", "Ejecutada", "Ejecutada con retraso", "Cancelada"], required: true, porDefecto: () => "Programada" },
      { key: "observacion", label: "Observación", type: "textarea", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 11 }, { key: "proyecto", label: "Frente", ancho: 10 }, { key: "equipo", ancho: 20 }, { key: "trabajo", ancho: 33 }, { key: "duracionHoras", label: "Horas", ancho: 7 }, { key: "numero", label: "N.º", ancho: 9 }],
    orden: { key: "fecha", dir: -1 },
    validar(r) {
      if (r.estado === "Ejecutada") return { nivel: "ok", texto: "Ejecutada" };
      if (r.estado === "Ejecutada con retraso") return { nivel: "danger", texto: "Con retraso" };
      if (r.estado === "Cancelada") return { nivel: "warn", texto: "Cancelada" };
      if (r.fecha < hoyISO()) return { nivel: "danger", texto: "Sin cierre" };
      return { nivel: "warn", texto: r.estado };
    }
  },

  // ======================= 10. CALIDAD — plan de calidad y entregables
  entregables: {
    label: "Plan de calidad y entregables", icon: "🏅", coleccion: "entregables",
    desc: "Documentos que el contratista debe presentar para revisión y aprobación de la interventoría (ej. plan de calidad, procedimientos, cronograma, programa SST, planos as-built, protocolos de prueba).",
    campos: [
      { key: "documento", label: "Documento", type: "text", required: true, ancho: true },
      { key: "tipo", label: "Tipo", type: "select", opciones: ["Plan de calidad", "Procedimiento / instructivo", "Cronograma", "Programa SST", "Plan de manejo ambiental", "Ingeniería / planos", "Memorias de cálculo", "Protocolos de prueba", "Planos as-built", "Dictamen RETIE", "Informe del contratista", "Dossier de calidad", "Otro"], required: true },
      { key: "proyecto", label: "Proyecto / frente", type: "frente" },
      { key: "version", label: "Versión", type: "text", placeholder: "Ej. V1" },
      { key: "fechaRadicado", label: "Fecha de radicado", type: "date" },
      { key: "plazoRevision", label: "Revisar antes de", type: "date", ayuda: "Fecha límite para que la interventoría emita concepto." },
      { key: "estado", label: "Estado", type: "select", opciones: ["Pendiente de entrega", "Radicado", "En revisión", "Con observaciones", "Aprobado"], required: true, porDefecto: () => "Pendiente de entrega" },
      { key: "fechaAprobacion", label: "Fecha de aprobación", type: "date" },
      { key: "observacion", label: "Observaciones de la interventoría", type: "textarea", ancho: true },
      { key: "enlace", label: "Documento (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "documento", ancho: 33 }, { key: "tipo", ancho: 16 }, { key: "proyecto", label: "Frente", ancho: 9 }, { key: "version", ancho: 7 }, { key: "fechaRadicado", label: "Radicado", ancho: 10 }, { key: "plazoRevision", label: "Revisar antes de", ancho: 12 }],
    orden: { key: "fechaRadicado", dir: -1 },
    validar(r) {
      if (r.estado === "Aprobado") return { nivel: "ok", texto: "Aprobado" };
      if (r.estado === "Con observaciones") return { nivel: "danger", texto: "Con observaciones" };
      if (["Radicado", "En revisión"].includes(r.estado) && r.plazoRevision && r.plazoRevision < hoyISO()) return { nivel: "danger", texto: "Revisión vencida" };
      return { nivel: "warn", texto: r.estado };
    },
    resumen(ctx) {
      if (!ctx.registros.length) return "";
      const plan = ctx.registros.find((r) => r.tipo === "Plan de calidad");
      const n = (e) => ctx.registros.filter((r) => r.estado === e).length;
      return tarjetas([
        { icon: plan?.estado === "Aprobado" ? "✅" : "🏅", valor: plan ? plan.estado : "No registrado", label: "Plan de calidad", cinta: plan?.estado === "Aprobado" ? 3 : 1 },
        { icon: "📥", valor: n("Radicado") + n("En revisión"), label: "En revisión de la interventoría", cinta: 2 },
        { icon: "⚠️", valor: n("Con observaciones"), label: "Devueltos con observaciones", cinta: 1 },
        { icon: "📄", valor: `${n("Aprobado")}/${ctx.registros.length}`, label: "Aprobados", cinta: 0 }
      ]);
    },
    alertas(ctx) {
      const out = [];
      if (!ctx.registros.some((r) => r.tipo === "Plan de calidad")) out.push({ nivel: "warn", texto: "No se ha registrado el Plan de Calidad del contratista (normalmente debe presentarse antes del inicio y ser aprobado por la interventoría)." });
      const venc = ctx.registros.filter((r) => MODULOS.entregables.validar(r).texto === "Revisión vencida").length;
      if (venc) out.push({ nivel: "danger", texto: `${venc} documento(s) con plazo de revisión de la interventoría vencido.` });
      return out;
    }
  },

  // ======================= 10. CALIDAD — no conformidades y acciones correctivas
  noconformidades: {
    label: "No conformidades y acciones", icon: "🛠️", coleccion: "noconformidades",
    desc: "Producto o trabajo no conforme, acciones correctivas y preventivas del contratista, responsable, fecha de cierre y verificación de eficacia.",
    campos: [
      { key: "fecha", label: "Fecha de detección", type: "date", required: true },
      { key: "proyecto", label: "Proyecto / frente", type: "frente" },
      { key: "origen", label: "Origen", type: "select", opciones: ["Inspección en obra", "Prueba FAT/SAT", "Revisión documental", "Auditoría", "Queja / reclamo", "Otro"], required: true },
      { key: "descripcion", label: "No conformidad", type: "textarea", required: true, ancho: true },
      { key: "accion", label: "Acción correctiva / preventiva", type: "textarea", ancho: true },
      { key: "responsable", label: "Responsable (contratista)", type: "text" },
      { key: "fechaCompromiso", label: "Fecha compromiso de cierre", type: "date" },
      { key: "estado", label: "Estado", type: "select", opciones: ["Abierta", "En tratamiento", "Cerrada", "Cerrada - eficacia verificada"], required: true, porDefecto: () => "Abierta" },
      { key: "evidencia", label: "Evidencia de cierre (enlace)", type: "url", ancho: true }
    ],
    columnas: [{ key: "fecha", ancho: 11 }, { key: "proyecto", label: "Frente", ancho: 9 }, { key: "origen", ancho: 14 }, { key: "descripcion", ancho: 36 }, { key: "fechaCompromiso", label: "Cierre", ancho: 11 }],
    orden: { key: "fecha", dir: -1 },
    validar(r) { return estadoConPlazo(r, ["Cerrada", "Cerrada - eficacia verificada"], "fechaCompromiso"); },
    resumen(ctx) {
      if (!ctx.registros.length) return "";
      const abiertas = ctx.registros.filter((r) => !(r.estado || "").startsWith("Cerrada"));
      return tarjetas([
        { icon: "🛠️", valor: ctx.registros.length, label: "No conformidades" },
        { icon: "⏳", valor: abiertas.length, label: "Abiertas", cinta: 2 },
        { icon: "⏰", valor: abiertas.filter((r) => r.fechaCompromiso && r.fechaCompromiso < hoyISO()).length, label: "Vencidas", cinta: 1 },
        { icon: "✅", valor: ctx.registros.filter((r) => r.estado === "Cerrada - eficacia verificada").length, label: "Eficacia verificada", cinta: 3 }
      ]);
    },
    alertas(ctx) {
      const venc = ctx.registros.filter((r) => !(r.estado || "").startsWith("Cerrada") && r.fechaCompromiso && r.fechaCompromiso < hoyISO()).length;
      return venc ? [{ nivel: "danger", texto: `${venc} no conformidad(es) abiertas con fecha de cierre vencida.` }] : [];
    }
  },
};

Object.entries(MODULOS).forEach(([id, m]) => { m.id = id; });

// Fotos de evidencia en todos los módulos (pedido del usuario): desde el
// computador o desde el celular (tomar foto o elegir de la galería). El
// Registro fotográfico ya trae su propia foto por registro.
Object.values(MODULOS).forEach((m) => {
  if (m.campos.some((c) => c.type === "imagen")) return;
  m.campos.push({ key: "fotosEvidencia", label: "Fotos de evidencia", type: "fotos", ancho: true });
});
// Documentos PDF adjuntos en todos los módulos (ej. la póliza firmada, un
// acta, una planilla): se ven en el visor y se pueden quitar al editar.
Object.values(MODULOS).forEach((m) => {
  m.campos.push({ key: "documentos", label: "Documentos adjuntos (PDF)", type: "documentos", ancho: true });
});
