// Informe mensual de Interventoría PRO en Word (.docx), armado con los
// datos registrados en los módulos para el mes elegido. Sigue la
// estructura de los informes reales de Cinco S.A.S. ("7. CONTRATO 040-2026
// CINCO - SEPTIEMBRE 2026" de servicios y "10. Informe de Interventoría
// octubre 2025 (Contrato 183 2024)" de obra): introducción, aspectos
// administrativos, financieros, jurídicos, SST, sociales, ambientales,
// técnicos (con curva S), matriz de riesgos y registro fotográfico.
//
// Misma librería y apariencia que el módulo Informes del Control de
// Contratos (web/js/control/informes-docx.js): docx autoalojado en
// web/js/vendor/docx.iife.js (window.docx), encabezado navy con logo,
// pie con número de página e índice nativo de Word.

import { esc, moneda, numero, fecha, mesCorto, mesLargo, mesesDelContrato, diasEntre } from "./ip-core.js";
import {
  MODULOS, nombreCapitulo, curvaS, svgCurvaS, estadoFinanciero, indicadoresSST, INDICADORES_SST,
  activoEnMes, avanceReal, inicioActividad
} from "./ip-modulos.js";

const NAVY = "1F2732";
const AMBER = "FEB209";
const MUTED = "5C6570";
const GRIS = "F2F3F5";
const LOGO_NAVY = "../assets/img/logo.png";
const LOGO_CLARO = "../assets/img/logo-texto-oscuro.png";
const PX_POR_MM = 96 / 25.4;

// ------------------------------------------------------------------ util
function finDeMes(ym) {
  const [a, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
}
function fechaLarga(iso) {
  if (!iso) return "-";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}
function cargarImagen(url, fondo = "#ffffff", tipo = "image/jpeg") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.fillStyle = fondo; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      c.toBlob((b) => (b ? b.arrayBuffer().then((buffer) => resolve({ buffer, ancho: c.width, alto: c.height })) : reject(new Error("imagen"))), tipo, 0.88);
    };
    img.onerror = reject;
    img.src = url;
  });
}
// SVG (curva S) -> PNG en buffer, al doble de resolución para que se vea nítido.
function svgAPng(svg) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth * 2; c.height = img.naturalHeight * 2;
      const ctx = c.getContext("2d");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => b.arrayBuffer().then((buffer) => resolve({ buffer, ancho: img.naturalWidth, alto: img.naturalHeight })), "image/png");
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// Anchos de columna proporcionales al contenido real (encabezado + filas),
// con mínimo y máximo por columna — nunca partes iguales.
function anchosProporcionales(encabezados, filas) {
  const largo = encabezados.map((h, i) => {
    const textos = [h, ...filas.map((f) => String(f[i] ?? ""))];
    const max = Math.max(...textos.map((t) => Math.min(t.length, 60)));
    return Math.max(4, max);
  });
  const total = largo.reduce((s, n) => s + n, 0);
  let pct = largo.map((n) => Math.max(5, Math.min(55, (n / total) * 100)));
  const suma = pct.reduce((s, n) => s + n, 0);
  pct = pct.map((p) => (p / suma) * 100);
  return pct;
}

// ------------------------------------------------------------------ generador
export async function generarInformeMensual({ contrato, ym, datos, elaboradoPor, cargo }) {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, ShadingType, WidthType,
    Header, Footer, AlignmentType, PageNumber, VerticalAlign, HeadingLevel, LevelFormat, BorderStyle, TableOfContents, PageBreak
  } = window.docx;

  const corte = finDeMes(ym);
  const esObra = contrato.tipo === "Obra";
  const mesesHasta = mesesDelContrato(contrato).filter((m) => m <= ym);
  const del = (col, campo = "fecha") => (datos[col] || []).filter((r) => String(r[campo] || "").startsWith(ym));
  const hasta = (col, campo = "fecha") => (datos[col] || []).filter((r) => !r[campo] || String(r[campo]) <= corte);
  const porCap = (col, cap) => (datos[col] || []).filter((r) => r.capitulo === cap && String(r.mes || "").startsWith(ym));
  const personaNombre = (id) => (datos.personal || []).find((p) => p.id === id)?.nombre || "-";

  const cuerpo = [];
  const T = (texto, o = {}) => new TextRun({ text: String(texto ?? ""), size: o.size || 20, bold: o.bold, italics: o.italics, color: o.color, font: "Arial" });
  const P = (texto, o = {}) => new Paragraph({ alignment: o.align || AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 120, line: 276 }, children: [T(texto, o)] });
  const nota = (texto) => P(texto, { italics: true, color: MUTED });

  const REF = "numeracion-informe";
  const H1 = (texto) => cuerpo.push(new Paragraph({ heading: HeadingLevel.HEADING_1, numbering: { reference: REF, level: 0 }, spacing: { before: 280, after: 140 }, children: [new TextRun({ text: texto.toUpperCase(), bold: true, color: NAVY, size: 24, font: "Arial" })] }));
  const H2 = (texto) => cuerpo.push(new Paragraph({ heading: HeadingLevel.HEADING_2, numbering: { reference: REF, level: 1 }, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: texto, bold: true, color: NAVY, size: 21, font: "Arial" })] }));

  const borde = { style: BorderStyle.SINGLE, size: 4, color: "C9CED6" };
  const bordes = { top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde };
  function tabla(encabezados, filas, { anchos, tam = 16, alinearNum = [] } = {}) {
    if (!filas.length) return null;
    const pct = anchos || anchosProporcionales(encabezados, filas);
    const celda = (txt, i, esEnc) => new TableCell({
      width: { size: pct[i], type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      shading: esEnc ? { type: ShadingType.CLEAR, fill: NAVY, color: "auto" } : undefined,
      margins: { top: 40, bottom: 40, left: 70, right: 70 },
      children: String(txt ?? "").split("\n").map((linea) => new Paragraph({
        alignment: esEnc ? AlignmentType.CENTER : alinearNum.includes(i) ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: linea, size: tam, bold: esEnc, color: esEnc ? "FFFFFF" : "1C1F24", font: "Arial" })]
      }))
    });
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: bordes,
      rows: [
        new TableRow({ tableHeader: true, children: encabezados.map((h, i) => celda(h, i, true)) }),
        ...filas.map((f) => new TableRow({ children: f.map((v, i) => celda(v, i, false)) }))
      ]
    });
  }
  const ponerTabla = (encabezados, filas, opciones, vacio) => {
    const t = tabla(encabezados, filas, opciones);
    if (t) { cuerpo.push(t); cuerpo.push(P("", { after: 80 })); }
    else cuerpo.push(nota(vacio || "No se registró información para este periodo."));
  };
  // Tabla tipo × mes con conteos (novedades, exámenes, capacitación, inspecciones).
  function matriz(registros, campoTipo, tipos, campoFecha = "fecha") {
    const filas = tipos.map((t) => {
      const c = mesesHasta.map((m) => registros.filter((r) => r[campoTipo] === t && String(r[campoFecha] || "").startsWith(m)).length);
      return [t, ...c.map((n) => (n ? String(n) : "–")), String(c.reduce((s, n) => s + n, 0))];
    });
    const anchoMes = Math.min(6, 60 / Math.max(mesesHasta.length, 1));
    const anchos = [100 - anchoMes * mesesHasta.length - 7, ...mesesHasta.map(() => anchoMes), 7];
    ponerTabla(["Descripción", ...mesesHasta.map(mesCorto), "Total"], filas, { anchos, tam: 14, alinearNum: mesesHasta.map((_, i) => i + 1).concat([mesesHasta.length + 1]) });
  }
  const observaciones = (cap) => {
    const obs = porCap("observaciones", cap);
    if (obs.length) obs.forEach((o) => String(o.texto).split("\n").forEach((l) => cuerpo.push(P(l))));
    else cuerpo.push(nota("Sin observaciones registradas para este periodo."));
  };
  const anexos = (cap) => {
    const docs = (datos.anexos || []).filter((d) => d.capitulo === cap && String(d.mes || d.fecha || "").startsWith(ym));
    ponerTabla(["Documento", "Fecha", "Enlace"], docs.map((d) => [d.nombre, d.fecha ? fecha(d.fecha) : mesLargo(d.mes), d.enlace || "-"]), { tam: 15 }, "Sin documentos anexos registrados para este periodo.");
  };

  // ================================================================ 1. INTRODUCCIÓN
  H1("Introducción");
  H2(esObra ? "Objetivo de la interventoría" : "Objetivo del seguimiento contractual");
  cuerpo.push(P(contrato.objetivo || `Efectuar de manera organizada el seguimiento técnico, administrativo, financiero, jurídico, social, ambiental y de seguridad y salud en el trabajo del contrato ${contrato.numero || ""}, cuyo objeto es: ${contrato.objeto || ""}.`));
  H2(esObra ? "Alcance de la interventoría" : "Alcance del seguimiento contractual");
  cuerpo.push(P(contrato.alcance || `El presente informe recoge, de manera organizada, el avance del contrato durante ${mesLargo(ym)}, con las cifras, tablas y evidencias que soportan la gestión adelantada en cada uno de sus aspectos.`));

  // ================================================================ 2. ADMINISTRATIVOS
  H1("Aspectos administrativos");
  H2("Información básica del contrato");
  const ef = estadoFinanciero(contrato, hasta("financiero"));
  ponerTabla(["Concepto", "Detalle"], [
    ["Contrato N.º", contrato.numero], ["Objeto", contrato.objeto], ["Contratante", contrato.contratante],
    [esObra ? "Contratista / proveedor" : "Contratista", contrato.contratista], ["Interventor / director", contrato.director],
    ["Supervisor", contrato.supervisor], ...(contrato.municipio ? [["Municipio", contrato.municipio]] : []),
    ["Valor inicial", moneda(contrato.valorInicial)], ["Valor total (con adiciones)", moneda(ef.valorTotal)],
    ["Fecha de inicio", fechaLarga(contrato.fechaInicio)], ["Fecha de terminación", fechaLarga(contrato.fechaFin)],
    ["Plazo", contrato.plazo || "-"]
  ].map(([a, b]) => [a, b || "-"]), { anchos: [30, 70], tam: 17 });
  H2("Resumen cronológico de actividades administrativas");
  ponerTabla(["Descripción", "Tipo", "Fecha"], hasta("cronologia").sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map((r) => [r.descripcion, r.tipo, fechaLarga(r.fecha)]), {}, "Sin actas ni eventos registrados.");
  H2("Observaciones administrativas"); observaciones("administrativo");
  H2("Documentos administrativos anexos"); anexos("administrativo");

  // ================================================================ 3. FINANCIEROS
  H1("Aspectos financieros");
  H2("Estado financiero del contrato");
  {
    let saldo = Number(contrato.valorInicial) || 0, acum = 0;
    const filas = [["Valor inicial del contrato", moneda(saldo), "–", moneda(saldo), "0 %"]];
    hasta("financiero").sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).forEach((m) => {
      const v = Number(m.valor) || 0;
      if (m.tipo === "Adición") { saldo += v; filas.push([m.descripcion, moneda(v), "–", moneda(saldo), "–"]); }
      else if (m.tipo === "Reducción") { saldo -= v; filas.push([m.descripcion, `-${moneda(v)}`, "–", moneda(saldo), "–"]); }
      else if (m.tipo === "Anticipo") { filas.push([m.descripcion, "–", moneda(v), "–", ef.valorTotal ? `${numero((v / ef.valorTotal) * 100, 2)} %` : "–"]); }
      else if (m.tipo === "Amortización de anticipo") { filas.push([m.descripcion, "–", moneda(v), "–", "–"]); }
      else { saldo -= v; acum += v; filas.push([m.descripcion, "–", moneda(v), moneda(saldo), ef.valorTotal ? `${numero((acum / ef.valorTotal) * 100, 2)} %` : "–"]); }
    });
    filas.push(["TOTAL", moneda(ef.valorTotal), moneda(ef.ejecutado), moneda(ef.saldo), `${numero(ef.pct, 2)} %`]);
    ponerTabla(["Descripción", "Valores asignados", "Valor ejecutado", "Saldo", "Avance financiero"], filas, { tam: 16, alinearNum: [1, 2, 3, 4] });
  }
  H2("Informe de inversión del anticipo");
  if (ef.anticipo) {
    const inv = hasta("anticipo");
    const invertido = inv.reduce((s, r) => s + (Number(r.valor) || 0), 0);
    ponerTabla(["Concepto", "Fecha", "Valor"], inv.map((r) => [r.concepto, fechaLarga(r.fecha), moneda(r.valor)]), { alinearNum: [2] }, "Sin inversiones del anticipo registradas.");
    cuerpo.push(P(`Anticipo recibido: ${moneda(ef.anticipo)} · Invertido (soportado): ${moneda(invertido)} · Amortizado: ${moneda(ef.amortizado)}.`));
  } else cuerpo.push(nota("El contrato no contempla anticipo."));
  H2("Observaciones financieras"); observaciones("financiero");
  H2("Documentos financieros anexos"); anexos("financiero");

  // ================================================================ 4. JURÍDICOS
  H1("Aspectos jurídicos");
  H2("Estado general de las garantías");
  ponerTabla(["Amparo", "Aseguradora", "Póliza N.º", "Valor asegurado", "Desde", "Hasta", "Estado"],
    (datos.garantias || []).map((g) => [g.amparo, g.aseguradora, g.poliza, moneda(g.valorAsegurado), fecha(g.vigenciaDesde), fecha(g.vigenciaHasta), g.vigenciaHasta && g.vigenciaHasta < corte ? "Vencida" : "Vigente"]),
    { tam: 15, alinearNum: [3] }, "Sin garantías registradas.");

  // ================================================================ 5. SST
  H1("Aspectos de seguridad y salud en el trabajo");
  H2("Listado de personal");
  const activos = (datos.personal || []).filter((p) => activoEnMes(p, ym)).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
  ponerTabla(["N.º", "Nombre", "Cédula", "Cargo", "Matrícula / licencia", "EPS", "AFP", "ARL"],
    activos.map((p, i) => [String(i + 1), p.nombre, p.cedula, p.cargo, p.matricula || "-", p.eps || "-", p.afp || "-", p.arl || "-"]), { tam: 14 }, "Sin personal vinculado en el periodo.");
  H2("Novedades de personal");
  matriz(datos.novedades || [], "tipo", MODULOS.novedades.campos[1].opciones);
  H2(esObra ? "Entrega de elementos de protección personal" : "Entrega de elementos de protección personal y/o dotación");
  ponerTabla(["Nombre", "Cargo", "Fecha", "Tipo", "Elementos"],
    del("epp").map((r) => { const p = (datos.personal || []).find((x) => x.id === r.persona) || {}; return [p.nombre || "-", p.cargo || "-", fecha(r.fecha), r.tipo, r.elementos || "-"]; }),
    { tam: 15 }, "Sin entregas de EPP o dotación en el periodo.");
  H2("Exámenes ocupacionales de ingreso, periódicos y de egreso");
  matriz(datos.examenes || [], "tipo", ["Ingreso", "Periódico", "Egreso"]);
  H2("Afiliación y pagos de seguridad social");
  ponerTabla(["Mes", "Personal vinculado", "Cotizantes pagados", "N.º de planilla", "Fecha de pago"],
    mesesHasta.map((m) => {
      const pl = (datos.segsocial || []).filter((r) => r.mes === m);
      return [mesLargo(m), String((datos.personal || []).filter((p) => activoEnMes(p, m)).length), pl.length ? String(pl.reduce((s, r) => s + (Number(r.cotizantes) || 0), 0)) : "–", pl.map((r) => r.planilla).join(", ") || "–", pl.map((r) => fecha(r.fechaPago)).join(", ") || "–"];
    }), { tam: 15, alinearNum: [1, 2] });
  H2("Accidentalidad");
  const accMes = del("accidentes");
  if (!accMes.length) cuerpo.push(P(`El contratista ${contrato.contratista || ""} no presenta accidentes ni incidentes de trabajo durante el periodo reportado.`));
  else ponerTabla(["Fecha", "Tipo", "Persona", "Descripción", "Días incap.", "Investigado"], accMes.map((a) => [fecha(a.fecha), a.tipo, personaNombre(a.persona), a.descripcion, String(a.diasIncapacidad || 0), a.investigado || "-"]), { tam: 15 });
  const ind = indicadoresSST(mesesHasta, { personal: datos.personal || [], accidentes: datos.accidentes || [], novedades: datos.novedades || [] });
  {
    const anchoMes = Math.min(6, 55 / Math.max(mesesHasta.length, 1));
    ponerTabla(["Indicador", ...mesesHasta.map(mesCorto)], INDICADORES_SST.map((d) => [`${d.nombre}\n${d.formula}`, ...ind.map((x) => `${numero(x[d.clave], x[d.clave] % 1 ? 2 : 0)}%`)]),
      { anchos: [100 - anchoMes * mesesHasta.length, ...mesesHasta.map(() => anchoMes)], tam: 13, alinearNum: mesesHasta.map((_, i) => i + 1) });
  }
  H2("Capacitación");
  matriz((datos.capacitaciones || []).filter((c) => c.categoria !== "ambiental"), "tipo", MODULOS.capacitaciones.campos[1].opciones);
  H2("Inspecciones");
  matriz(datos.inspecciones || [], "tipo", MODULOS.inspecciones.campos[1].opciones);
  H2("Observaciones de seguridad y salud en el trabajo"); observaciones("sst");
  H2("Documentos de seguridad y salud en el trabajo (anexos)"); anexos("sst");

  // ================================================================ 6. SOCIALES
  H1("Aspectos sociales");
  H2("Socialización del proyecto");
  ponerTabla(["Fecha", "Actividad", "Lugar", "Asistentes", "Descripción"], del("socializacion").map((r) => [fecha(r.fecha), r.actividad, r.lugar || "-", String(r.asistentes || "-"), r.descripcion || "-"]), { tam: 15 }, "Sin actividades de socialización en el periodo.");
  H2("Documentos anexos"); anexos("social");

  // ================================================================ 7. AMBIENTALES
  H1("Aspectos ambientales");
  H2("Identificación de aspectos e impactos ambientales");
  ponerTabla(["Actividad", "Aspecto ambiental", "Impacto ambiental", "Controles"], (datos.aspectos || []).map((r) => [r.actividad, r.aspecto, r.impacto, r.control || "-"]), { tam: 15 }, "Sin aspectos ambientales identificados.");
  H2("Gestión ambiental y estado del plan de gestión ambiental");
  ponerTabla(["Actividad", "Programada", "Estado"], hasta("planambiental", "fechaProgramada").map((r) => [r.actividad, fecha(r.fechaProgramada), r.estado]), { tam: 15 }, "Sin actividades del plan de gestión ambiental registradas.");
  H2("Estado de cumplimiento de indicadores ambientales");
  ponerTabla(["Indicador", "Meta", "Resultado", "Unidad", "Cumple"], del("indicadores", "mes").map((r) => [r.indicador, String(r.meta), String(r.resultado), r.unidad || "-", MODULOS.indicadores.validar(r).texto]), { tam: 15 }, "Sin medición de indicadores ambientales en el periodo.");
  H2("Cumplimiento de requisitos legales ambientales");
  ponerTabla(["Norma", "Requisito", "Cumple"], (datos.requisitos || []).map((r) => [r.norma, r.requisito, r.cumple]), { tam: 15 }, "Sin requisitos legales ambientales registrados.");
  H2("Incidentes ambientales");
  const incAmb = del("incidentesamb");
  if (incAmb.length) ponerTabla(["Fecha", "Descripción", "Acción", "Estado"], incAmb.map((r) => [fecha(r.fecha), r.descripcion, r.accion || "-", r.estado || "-"]), { tam: 15 });
  else cuerpo.push(P("No se presentaron incidentes ambientales durante el periodo reportado."));
  H2("Capacitaciones realizadas con la gestión ambiental");
  ponerTabla(["Fecha", "Tipo", "Tema", "Asistentes"], (datos.capacitaciones || []).filter((c) => c.categoria === "ambiental" && String(c.fecha || "").startsWith(ym)).map((r) => [fecha(r.fecha), r.tipo, r.tema, String(r.asistentes || "-")]), { tam: 15 }, "Sin capacitaciones ambientales en el periodo.");
  H2("Observaciones ambientales"); observaciones("ambiental");
  H2("Documentos y anexos de aspectos ambientales"); anexos("ambiental");

  // ================================================================ 8. TÉCNICOS
  H1("Aspectos técnicos");
  H2("Resumen general de actividades técnicas");
  if (esObra) {
    ponerTabla(["Componente", "Tipo", "Especificación", "Und.", "Contratada", "Ejecutada", "% ejec.", "Estado"],
      (datos.cantidades || []).sort((a, b) => String(a.componente).localeCompare(String(b.componente), "es")).map((r) => {
        const c = Number(r.cantidadContratada) || 0, e = Number(r.cantidadEjecutada) || 0;
        return [r.componente, r.tipo || "-", r.especificacion, r.unidad, numero(c, c % 1 ? 2 : 0), numero(e, e % 1 ? 2 : 0), c ? `${Math.round((e / c) * 100)}%` : "-", r.estado || "-"];
      }), { tam: 14, alinearNum: [4, 5, 6] }, "Sin cantidades de obra registradas.");
  }
  observaciones("tecnico");
  H2("Avance porcentual de actividades");
  const acts = [...(datos.actividades || [])].sort((a, b) => (Number(a.item) || 0) - (Number(b.item) || 0));
  if (acts.length) {
    const anchoMes = Math.min(4.5, 50 / Math.max(mesesHasta.length, 1));
    const anchos = [5, 100 - 5 - 8 - 10 - anchoMes * mesesHasta.length, 8, 10, ...mesesHasta.map(() => anchoMes)];
    ponerTabla(["Ítem", "Actividad", "Duración (sem.)", "Fecha terminación", ...mesesHasta.map(mesCorto)],
      acts.map((a) => [String(a.item ?? ""), a.actividad, String(a.duracionSemanas ?? "-"), a.fechaFin ? a.fechaFin.split("-").reverse().join("/") : "-", ...mesesHasta.map((m) => (a.avance?.[m] != null && a.avance[m] !== "" ? String(a.avance[m]) : ""))]),
      { anchos, tam: 13, alinearNum: [2, ...mesesHasta.map((_, i) => i + 4)] });
  } else cuerpo.push(nota("Sin actividades registradas."));
  H2("Avance gráfico del contrato — curva S");
  if (acts.length) {
    const puntos = curvaS(acts, contrato, ym);
    try {
      const png = await svgAPng(svgCurvaS(puntos, { ancho: 760, alto: 320 }));
      const anchoPx = Math.round(170 * PX_POR_MM);
      cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: png.buffer, type: "png", transformation: { width: anchoPx, height: Math.round(anchoPx * (png.alto / png.ancho)) } })] }));
      cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [T(`Figura. Curva S — avance programado contra ejecutado acumulado a ${mesLargo(ym)}.`, { size: 17, italics: true, color: MUTED })] }));
    } catch (e) { cuerpo.push(nota("No se pudo dibujar la curva S.")); }
    const enCorte = puntos.find((p) => p.ym === ym) || { programado: 0, ejecutado: 0 };
    ponerTabla(["Mes", "Programado acumulado", "Ejecutado acumulado", "Diferencia (pts)"],
      puntos.filter((p) => p.ym <= ym).map((p) => [mesLargo(p.ym), `${numero(p.programado, 1)}%`, p.ejecutado == null ? "–" : `${numero(p.ejecutado, 1)}%`, p.ejecutado == null ? "–" : numero(p.ejecutado - p.programado, 1)]),
      { anchos: [34, 22, 22, 22], tam: 15, alinearNum: [1, 2, 3] });
    cuerpo.push(P(`A ${mesLargo(ym)} el contrato registra un avance ejecutado acumulado de ${numero(enCorte.ejecutado ?? 0, 1)}% frente a un avance programado de ${numero(enCorte.programado, 1)}%.`));
  } else cuerpo.push(nota("Registra las actividades del contrato para obtener la curva S."));
  H2("Observaciones al avance del contrato");
  {
    const atrasadas = acts.filter((a) => {
      const prog = (() => { const ini = inicioActividad(a); if (!ini || !a.fechaFin) return null; if (corte < ini) return 0; if (corte >= a.fechaFin) return 100; return Math.round((diasEntre(ini, corte) / (diasEntre(ini, a.fechaFin) || 1)) * 100); })();
      return prog != null && avanceReal(a, ym) < prog - 10;
    });
    if (atrasadas.length) atrasadas.forEach((a) => cuerpo.push(P(`• ${a.actividad}: avance ejecutado ${avanceReal(a, ym)}%, por debajo de lo programado a la fecha de corte.`)));
    else if (acts.length) cuerpo.push(P("Las actividades avanzan de acuerdo con lo programado a la fecha de corte."));
  }

  // ================================================================ 9. RIESGOS
  H1("Seguimiento a la matriz de riesgos");
  ponerTabla(["Ítem", "Riesgo", "Probabilidad", "Impacto", "Monitoreo y revisión", "Estado"],
    [...(datos.riesgos || [])].sort((a, b) => (Number(a.item) || 0) - (Number(b.item) || 0)).map((r) => [String(r.item ?? ""), `${r.categoria}: ${r.riesgo}`, r.probabilidad, r.impacto, r.monitoreo || "-", r.estado || "-"]),
    { tam: 15 }, "Sin riesgos registrados en la matriz.");

  // ================================================================ 10. REGISTRO FOTOGRÁFICO
  H1("Registro fotográfico");
  const fotos = del("fotos").sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  if (!fotos.length) cuerpo.push(nota("Sin registro fotográfico para el periodo."));
  for (let i = 0; i < fotos.length; i += 2) {
    const par = fotos.slice(i, i + 2);
    const celdas = await Promise.all(par.map(async (f) => {
      const hijos = [];
      try {
        const img = await cargarImagen(f.foto);
        const anchoPx = Math.round(80 * PX_POR_MM);
        hijos.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: img.buffer, type: "jpg", transformation: { width: anchoPx, height: Math.round(anchoPx * Math.min(1, img.alto / img.ancho)) } })] }));
      } catch (e) {
        hijos.push(new Paragraph({ children: [T("(No se pudo cargar la foto)", { italics: true, color: MUTED, size: 16 })] }));
      }
      hijos.push(new Paragraph({ spacing: { before: 60 }, children: [T("Observación: ", { bold: true, size: 17 }), T(f.observacion || "-", { size: 17 })] }));
      hijos.push(new Paragraph({ children: [T(fechaLarga(f.fecha), { size: 16, color: MUTED })] }));
      return new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: hijos });
    }));
    if (celdas.length === 1) celdas.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [] })] }));
    cuerpo.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordes, rows: [new TableRow({ children: celdas })] }));
    cuerpo.push(P("", { after: 60 }));
  }

  // ================================================================ firma
  cuerpo.push(new Paragraph({ spacing: { before: 600 }, children: [T("______________________________________")] }));
  cuerpo.push(new Paragraph({ children: [T(elaboradoPor || contrato.director || "", { bold: true })] }));
  cuerpo.push(new Paragraph({ children: [T(cargo || (esObra ? "Director de Interventoría" : "Director del contrato"), { color: MUTED })] }));
  cuerpo.push(new Paragraph({ children: [T("CONSTRUCCIÓN, INGENIERÍA Y CONSULTORÍA – CINCO S.A.S.", { color: MUTED, size: 18 })] }));

  // ================================================================ encabezado, pie y portada
  let logoNavy = null, logoClaro = null;
  try { logoNavy = await cargarImagen(LOGO_NAVY, `#${NAVY}`, "image/png"); } catch (e) { /* sin logo */ }
  try { logoClaro = await cargarImagen(LOGO_CLARO, "#ffffff", "image/png"); } catch (e) { /* sin logo */ }
  const tituloInforme = esObra ? "Informe mensual de interventoría" : "Informe mensual de seguimiento contractual";
  const sinBordes = (() => { const n = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }; return { top: n, bottom: n, left: n, right: n, insideHorizontal: n, insideVertical: n }; })();
  const celdaNavy = (hijos, pct, alin = AlignmentType.LEFT) => new TableCell({ width: { size: pct, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" }, verticalAlign: VerticalAlign.CENTER, margins: { top: 120, bottom: 120, left: 180, right: 180 }, children: hijos.map((h) => (h instanceof Paragraph ? h : new Paragraph({ alignment: alin, children: [h] }))) });
  const encabezado = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: sinBordes,
    rows: [new TableRow({ children: [
      celdaNavy(logoNavy ? [new ImageRun({ data: logoNavy.buffer, type: "png", transformation: { height: Math.round(12 * PX_POR_MM), width: Math.round(12 * PX_POR_MM * (logoNavy.ancho / logoNavy.alto)) } })] : [T("")], 40),
      celdaNavy([new TextRun({ text: `${tituloInforme} — ${mesLargo(ym)}`, bold: true, color: "FFFFFF", size: 16, font: "Arial" }), new TextRun({ text: `Contrato ${contrato.numero || ""}`, color: AMBER, size: 15, font: "Arial" })], 60, AlignmentType.RIGHT)
    ] })]
  });
  const pie = new Paragraph({ alignment: AlignmentType.RIGHT, children: [
    new TextRun({ text: `Interventoría PRO · Cinco S.A.S. · Página `, color: MUTED, size: 14, font: "Arial" }),
    new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 14, font: "Arial" }),
    new TextRun({ text: " de ", color: MUTED, size: 14, font: "Arial" }),
    new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 14, font: "Arial" })
  ] });

  const portada = [];
  if (logoClaro) portada.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 400 }, children: [new ImageRun({ data: logoClaro.buffer, type: "png", transformation: { height: Math.round(30 * PX_POR_MM), width: Math.round(30 * PX_POR_MM * (logoClaro.ancho / logoClaro.alto)) } })] }));
  portada.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: tituloInforme.toUpperCase(), bold: true, size: 34, color: NAVY, font: "Arial" })] }));
  portada.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [new TextRun({ text: mesLargo(ym).toUpperCase(), bold: true, size: 26, color: "D99400", font: "Arial" })] }));
  portada.push(tabla(["INFORME", ""], [
    ["Contrato N.º", contrato.numero || "-"], ["Objeto", contrato.objeto || "-"], ["Contratante", contrato.contratante || "-"],
    [esObra ? "Contratista / proveedor" : "Contratista", contrato.contratista || "-"],
    ["Interventor", "CONSTRUCCIÓN, INGENIERÍA Y CONSULTORÍA – CINCO S.A.S."],
    ["Periodo del informe", `${fechaLarga(`${ym}-01`)} al ${fechaLarga(corte)}`]
  ], { anchos: [30, 70], tam: 19 }));
  portada.push(new Paragraph({ children: [new PageBreak()] }));
  portada.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "CONTENIDO", bold: true, color: NAVY, size: 24, font: "Arial" })] }));
  portada.push(new TableOfContents("Contenido", { hyperlink: true, headingStyleRange: "1-2" }));
  portada.push(new Paragraph({ children: [new PageBreak()] }));

  const doc = new Document({
    features: { updateFields: true },
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    numbering: { config: [{ reference: REF, levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 360, hanging: 360 } } } },
      { level: 1, format: LevelFormat.DECIMAL, text: "%1.%2.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 576, hanging: 576 } } } }
    ] }] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1134, bottom: 1134, left: 1247, right: 1134, header: 340, footer: 340 } } },
      headers: { default: new Header({ children: [encabezado] }) },
      footers: { default: new Footer({ children: [pie] }) },
      children: [...portada, ...cuerpo]
    }]
  });
  return Packer.toBlob(doc);
}
