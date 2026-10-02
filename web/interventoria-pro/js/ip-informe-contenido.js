// Contenido del informe mensual de Interventoría PRO, armado UNA vez como
// lista de bloques neutros (los mismos tipos que usa el módulo Informes del
// Control de Contratos: titulo1, titulo2, parrafo, tabla, imagen, firma) —
// de ahí salen tanto el Word (ip-informe-docx.js) como el PDF con portada
// oscura o clara (ip-informe-pdf.js -> js/control/informes-pdf.js), así
// los dos formatos nunca se desincronizan.
//
// Estructura de los informes reales de Cinco S.A.S.: servicios ("7.
// CONTRATO 040-2026 CINCO - SEPTIEMBRE 2026") y obra ("10. Informe de
// Interventoría octubre 2025 (Contrato 183 2024)").
//
// Bloques:
//   { tipo: "titulo1" | "titulo2", texto }
//   { tipo: "parrafo", texto, nota? }            (texto plano)
//   { tipo: "tabla", titulo?, encabezados, filas, anchos?, alinearNum?, tam? }
//   { tipo: "imagen", dataUrl | url, nombre, pieDeFoto?, tamano?, ancho, alto }
//   { tipo: "fotos", fotos: [{ url, observacion, fecha }] }   (cuadrícula 2×N)
//   { tipo: "firma", nombre, cargo, empresa }

import { moneda, numero, fecha, mesCorto, mesLargo, mesesDelContrato, diasEntre } from "./ip-core.js";
import {
  MODULOS, curvaS, svgCurvaS, estadoFinanciero, indicadoresSST, INDICADORES_SST,
  activoEnMes, avanceReal, inicioActividad
} from "./ip-modulos.js";

export function finDeMes(ym) {
  const [a, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
}
export function fechaLarga(iso) {
  if (!iso) return "-";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}
export function tituloInforme(contrato) {
  return contrato.tipo === "Obra" ? "Informe mensual de interventoría" : "Informe mensual de seguimiento contractual";
}

// SVG -> PNG (data URL), al doble de resolución.
function svgADataUrl(svg) {
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
      resolve({ dataUrl: c.toDataURL("image/png"), ancho: img.naturalWidth, alto: img.naturalHeight });
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export async function construirInforme({ contrato, ym, datos, elaboradoPor, cargo }) {
  const corte = finDeMes(ym);
  const esObra = contrato.tipo === "Obra";
  const mesesHasta = mesesDelContrato(contrato).filter((m) => m <= ym);
  const del = (col, campo = "fecha") => (datos[col] || []).filter((r) => String(r[campo] || "").startsWith(ym));
  const hasta = (col, campo = "fecha") => (datos[col] || []).filter((r) => !r[campo] || String(r[campo]) <= corte);
  const porCap = (col, cap) => (datos[col] || []).filter((r) => r.capitulo === cap && String(r.mes || "").startsWith(ym));
  const personaNombre = (id) => (datos.personal || []).find((p) => p.id === id)?.nombre || "-";

  const b = [];
  const H1 = (texto) => b.push({ tipo: "titulo1", texto });
  const H2 = (texto) => b.push({ tipo: "titulo2", texto });
  const P = (texto) => b.push({ tipo: "parrafo", texto: String(texto ?? "") });
  const nota = (texto) => b.push({ tipo: "parrafo", texto, nota: true });
  const tabla = (encabezados, filas, opciones = {}, vacio) => {
    if (filas.length) b.push({ tipo: "tabla", encabezados, filas: filas.map((f) => f.map((v) => String(v ?? ""))), ...opciones });
    else nota(vacio || "No se registró información para este periodo.");
  };
  const matriz = (registros, campoTipo, tipos, titulo, campoFecha = "fecha") => {
    const filas = tipos.map((t) => {
      const c = mesesHasta.map((m) => registros.filter((r) => r[campoTipo] === t && String(r[campoFecha] || "").startsWith(m)).length);
      return [t, ...c.map((n) => (n ? String(n) : "–")), String(c.reduce((s, n) => s + n, 0))];
    });
    const anchoMes = Math.min(6, 60 / Math.max(mesesHasta.length, 1));
    tabla(["Descripción", ...mesesHasta.map(mesCorto), "Total"], filas, {
      titulo, tam: 14, anchos: [100 - anchoMes * mesesHasta.length - 7, ...mesesHasta.map(() => anchoMes), 7],
      alinearNum: mesesHasta.map((_, i) => i + 1).concat([mesesHasta.length + 1])
    });
  };
  const observaciones = (cap) => {
    const obs = porCap("observaciones", cap);
    if (obs.length) obs.forEach((o) => String(o.texto).split("\n").filter((l) => l.trim()).forEach(P));
    else nota("Sin observaciones registradas para este periodo.");
  };
  const anexos = (cap) => {
    const docs = (datos.anexos || []).filter((d) => d.capitulo === cap && String(d.mes || d.fecha || "").startsWith(ym));
    tabla(["Documento", "Fecha", "Enlace"], docs.map((d) => [d.nombre, d.fecha ? fecha(d.fecha) : mesLargo(d.mes), d.enlace || "-"]), { tam: 15 }, "Sin documentos anexos registrados para este periodo.");
  };

  // ================================================================ 1. INTRODUCCIÓN
  H1("Introducción");
  H2(esObra ? "Objetivo de la interventoría" : "Objetivo del seguimiento contractual");
  P(contrato.objetivo || `Efectuar de manera organizada el seguimiento técnico, administrativo, financiero, jurídico, social, ambiental y de seguridad y salud en el trabajo del contrato ${contrato.numero || ""}, cuyo objeto es: ${contrato.objeto || ""}.`);
  H2(esObra ? "Alcance de la interventoría" : "Alcance del seguimiento contractual");
  P(contrato.alcance || `El presente informe recoge, de manera organizada, el avance del contrato durante ${mesLargo(ym)}, con las cifras, tablas y evidencias que soportan la gestión adelantada en cada uno de sus aspectos.`);

  // ================================================================ 2. ADMINISTRATIVOS
  H1("Aspectos administrativos");
  H2("Información básica del contrato");
  const ef = estadoFinanciero(contrato, hasta("financiero"));
  tabla(["Concepto", "Detalle"], [
    ["Contrato N.º", contrato.numero], ["Objeto", contrato.objeto], ["Contratante", contrato.contratante],
    [esObra ? "Contratista / proveedor" : "Contratista", contrato.contratista], ["Interventor / director", contrato.director],
    ["Supervisor", contrato.supervisor], ...(contrato.municipio ? [["Municipio", contrato.municipio]] : []),
    ["Valor inicial", moneda(contrato.valorInicial)], ["Valor total (con adiciones)", moneda(ef.valorTotal)],
    ["Fecha de inicio", fechaLarga(contrato.fechaInicio)], ["Fecha de terminación", fechaLarga(contrato.fechaFin)],
    ["Plazo", contrato.plazo || "-"]
  ].map(([a, v]) => [a, v || "-"]), { titulo: "Información básica del contrato", anchos: [30, 70], tam: 17 });
  H2("Resumen cronológico de actividades administrativas");
  tabla(["Descripción", "Tipo", "Fecha"], hasta("cronologia").sort((a, c) => String(a.fecha).localeCompare(String(c.fecha))).map((r) => [r.descripcion, r.tipo, fechaLarga(r.fecha)]), { titulo: "Resumen cronológico" }, "Sin actas ni eventos registrados.");
  H2("Observaciones administrativas"); observaciones("administrativo");
  H2("Documentos administrativos anexos"); anexos("administrativo");

  // ================================================================ 3. FINANCIEROS
  H1("Aspectos financieros");
  H2("Estado financiero del contrato");
  {
    let saldo = Number(contrato.valorInicial) || 0, acum = 0;
    const filas = [["Valor inicial del contrato", moneda(saldo), "–", moneda(saldo), "0 %"]];
    hasta("financiero").sort((a, c) => String(a.fecha).localeCompare(String(c.fecha))).forEach((m) => {
      const v = Number(m.valor) || 0;
      if (m.tipo === "Adición") { saldo += v; filas.push([m.descripcion, moneda(v), "–", moneda(saldo), "–"]); }
      else if (m.tipo === "Reducción") { saldo -= v; filas.push([m.descripcion, `-${moneda(v)}`, "–", moneda(saldo), "–"]); }
      else if (m.tipo === "Anticipo") { filas.push([m.descripcion, "–", moneda(v), "–", ef.valorTotal ? `${numero((v / ef.valorTotal) * 100, 2)} %` : "–"]); }
      else if (m.tipo === "Amortización de anticipo") { filas.push([m.descripcion, "–", moneda(v), "–", "–"]); }
      else { saldo -= v; acum += v; filas.push([m.descripcion, "–", moneda(v), moneda(saldo), ef.valorTotal ? `${numero((acum / ef.valorTotal) * 100, 2)} %` : "–"]); }
    });
    filas.push(["TOTAL", moneda(ef.valorTotal), moneda(ef.ejecutado), moneda(ef.saldo), `${numero(ef.pct, 2)} %`]);
    tabla(["Descripción", "Valores asignados", "Valor ejecutado", "Saldo", "Avance financiero"], filas, { titulo: "Estado financiero del contrato", tam: 16, alinearNum: [1, 2, 3, 4] });
  }
  H2("Informe de inversión del anticipo");
  if (ef.anticipo) {
    const inv = hasta("anticipo");
    const invertido = inv.reduce((s, r) => s + (Number(r.valor) || 0), 0);
    tabla(["Concepto", "Fecha", "Valor"], inv.map((r) => [r.concepto, fechaLarga(r.fecha), moneda(r.valor)]), { titulo: "Inversión del anticipo", alinearNum: [2] }, "Sin inversiones del anticipo registradas.");
    P(`Anticipo recibido: ${moneda(ef.anticipo)} · Invertido (soportado): ${moneda(invertido)} · Amortizado: ${moneda(ef.amortizado)}.`);
  } else nota("El contrato no contempla anticipo.");
  H2("Observaciones financieras"); observaciones("financiero");
  H2("Documentos financieros anexos"); anexos("financiero");

  // ================================================================ 4. JURÍDICOS
  H1("Aspectos jurídicos");
  H2("Estado general de las garantías");
  tabla(["Amparo", "Aseguradora", "Póliza N.º", "Valor asegurado", "Desde", "Hasta", "Estado"],
    (datos.garantias || []).map((g) => [g.amparo, g.aseguradora, g.poliza, moneda(g.valorAsegurado), fecha(g.vigenciaDesde), fecha(g.vigenciaHasta), g.vigenciaHasta && g.vigenciaHasta < corte ? "Vencida" : "Vigente"]),
    { titulo: "Cuadro de control de garantías", tam: 15, alinearNum: [3] }, "Sin garantías registradas.");

  // ================================================================ 5. SST
  H1("Aspectos de seguridad y salud en el trabajo");
  H2("Listado de personal");
  const activos = (datos.personal || []).filter((p) => activoEnMes(p, ym)).sort((a, c) => String(a.nombre).localeCompare(String(c.nombre), "es"));
  tabla(["N.º", "Nombre", "Cédula", "Cargo", "Matrícula / licencia", "EPS", "AFP", "ARL"],
    activos.map((p, i) => [String(i + 1), p.nombre, p.cedula, p.cargo, p.matricula || "-", p.eps || "-", p.afp || "-", p.arl || "-"]), { titulo: "Listado de personal", tam: 14 }, "Sin personal vinculado en el periodo.");
  H2("Novedades de personal");
  matriz(datos.novedades || [], "tipo", MODULOS.novedades.campos[1].opciones, "Novedades de personal por mes");
  H2(esObra ? "Entrega de elementos de protección personal" : "Entrega de elementos de protección personal y/o dotación");
  tabla(["Nombre", "Cargo", "Fecha", "Tipo", "Elementos"],
    del("epp").map((r) => { const p = (datos.personal || []).find((x) => x.id === r.persona) || {}; return [p.nombre || "-", p.cargo || "-", fecha(r.fecha), r.tipo, r.elementos || "-"]; }),
    { titulo: "Entregas de EPP y dotación", tam: 15 }, "Sin entregas de EPP o dotación en el periodo.");
  H2("Exámenes ocupacionales de ingreso, periódicos y de egreso");
  matriz(datos.examenes || [], "tipo", ["Ingreso", "Periódico", "Egreso"], "Exámenes ocupacionales por mes");
  H2("Afiliación y pagos de seguridad social");
  tabla(["Mes", "Personal vinculado", "Cotizantes pagados", "N.º de planilla", "Fecha de pago"],
    mesesHasta.map((m) => {
      const pl = (datos.segsocial || []).filter((r) => r.mes === m);
      return [mesLargo(m), String((datos.personal || []).filter((p) => activoEnMes(p, m)).length), pl.length ? String(pl.reduce((s, r) => s + (Number(r.cotizantes) || 0), 0)) : "–", pl.map((r) => r.planilla).join(", ") || "–", pl.map((r) => fecha(r.fechaPago)).join(", ") || "–"];
    }), { titulo: "Afiliación y pagos de seguridad social", tam: 15, alinearNum: [1, 2] });
  H2("Accidentalidad");
  const accMes = del("accidentes");
  if (!accMes.length) P(`El contratista ${contrato.contratista || ""} no presenta accidentes ni incidentes de trabajo durante el periodo reportado.`);
  else tabla(["Fecha", "Tipo", "Persona", "Descripción", "Días incap.", "Investigado"], accMes.map((a) => [fecha(a.fecha), a.tipo, personaNombre(a.persona), a.descripcion, String(a.diasIncapacidad || 0), a.investigado || "-"]), { titulo: "Accidentes e incidentes del periodo", tam: 15 });
  {
    const ind = indicadoresSST(mesesHasta, { personal: datos.personal || [], accidentes: datos.accidentes || [], novedades: datos.novedades || [] });
    const anchoMes = Math.min(6, 55 / Math.max(mesesHasta.length, 1));
    tabla(["Indicador", ...mesesHasta.map(mesCorto)], INDICADORES_SST.map((d) => [`${d.nombre}\n${d.formula}`, ...ind.map((x) => `${numero(x[d.clave], x[d.clave] % 1 ? 2 : 0)}%`)]),
      { titulo: "Indicadores de accidentalidad", anchos: [100 - anchoMes * mesesHasta.length, ...mesesHasta.map(() => anchoMes)], tam: 13, alinearNum: mesesHasta.map((_, i) => i + 1) });
  }
  H2("Capacitación");
  matriz((datos.capacitaciones || []).filter((c) => c.categoria !== "ambiental"), "tipo", MODULOS.capacitaciones.campos[1].opciones, "Capacitaciones por mes");
  H2("Inspecciones");
  matriz(datos.inspecciones || [], "tipo", MODULOS.inspecciones.campos[1].opciones, "Inspecciones por mes");
  H2("Observaciones de seguridad y salud en el trabajo"); observaciones("sst");
  H2("Documentos de seguridad y salud en el trabajo (anexos)"); anexos("sst");

  // ================================================================ 6. SOCIALES
  H1("Aspectos sociales");
  H2("Socialización del proyecto");
  tabla(["Fecha", "Actividad", "Lugar", "Asistentes", "Descripción"], del("socializacion").map((r) => [fecha(r.fecha), r.actividad, r.lugar || "-", String(r.asistentes || "-"), r.descripcion || "-"]), { titulo: "Socialización del proyecto", tam: 15 }, "Sin actividades de socialización en el periodo.");
  H2("Documentos anexos"); anexos("social");

  // ================================================================ 7. AMBIENTALES
  H1("Aspectos ambientales");
  H2("Identificación de aspectos e impactos ambientales");
  tabla(["Actividad", "Aspecto ambiental", "Impacto ambiental", "Controles"], (datos.aspectos || []).map((r) => [r.actividad, r.aspecto, r.impacto, r.control || "-"]), { titulo: "Aspectos e impactos ambientales", tam: 15 }, "Sin aspectos ambientales identificados.");
  H2("Gestión ambiental y estado del plan de gestión ambiental");
  tabla(["Actividad", "Programada", "Estado"], hasta("planambiental", "fechaProgramada").map((r) => [r.actividad, fecha(r.fechaProgramada), r.estado]), { titulo: "Plan de gestión ambiental", tam: 15 }, "Sin actividades del plan de gestión ambiental registradas.");
  H2("Estado de cumplimiento de indicadores ambientales");
  tabla(["Indicador", "Meta", "Resultado", "Unidad", "Cumple"], del("indicadores", "mes").map((r) => [r.indicador, String(r.meta), String(r.resultado), r.unidad || "-", MODULOS.indicadores.validar(r).texto]), { titulo: "Indicadores ambientales", tam: 15 }, "Sin medición de indicadores ambientales en el periodo.");
  H2("Cumplimiento de requisitos legales ambientales");
  tabla(["Norma", "Requisito", "Cumple"], (datos.requisitos || []).map((r) => [r.norma, r.requisito, r.cumple]), { titulo: "Requisitos legales ambientales", tam: 15 }, "Sin requisitos legales ambientales registrados.");
  H2("Incidentes ambientales");
  const incAmb = del("incidentesamb");
  if (incAmb.length) tabla(["Fecha", "Descripción", "Acción", "Estado"], incAmb.map((r) => [fecha(r.fecha), r.descripcion, r.accion || "-", r.estado || "-"]), { titulo: "Incidentes ambientales", tam: 15 });
  else P("No se presentaron incidentes ambientales durante el periodo reportado.");
  H2("Capacitaciones realizadas con la gestión ambiental");
  tabla(["Fecha", "Tipo", "Tema", "Asistentes"], (datos.capacitaciones || []).filter((c) => c.categoria === "ambiental" && String(c.fecha || "").startsWith(ym)).map((r) => [fecha(r.fecha), r.tipo, r.tema, String(r.asistentes || "-")]), { titulo: "Capacitaciones ambientales", tam: 15 }, "Sin capacitaciones ambientales en el periodo.");
  H2("Observaciones ambientales"); observaciones("ambiental");
  H2("Documentos y anexos de aspectos ambientales"); anexos("ambiental");

  // ================================================================ 8. TÉCNICOS
  H1("Aspectos técnicos");
  H2("Resumen general de actividades técnicas");
  if (esObra) {
    tabla(["Componente", "Tipo", "Especificación", "Und.", "Contratada", "Ejecutada", "% ejec.", "Estado"],
      [...(datos.cantidades || [])].sort((a, c) => String(a.componente).localeCompare(String(c.componente), "es")).map((r) => {
        const c = Number(r.cantidadContratada) || 0, e = Number(r.cantidadEjecutada) || 0;
        return [r.componente, r.tipo || "-", r.especificacion, r.unidad, numero(c, c % 1 ? 2 : 0), numero(e, e % 1 ? 2 : 0), c ? `${Math.round((e / c) * 100)}%` : "-", r.estado || "-"];
      }), { titulo: "Cantidades de obra", tam: 14, alinearNum: [4, 5, 6] }, "Sin cantidades de obra registradas.");
  }
  observaciones("tecnico");
  H2("Avance porcentual de actividades");
  const acts = [...(datos.actividades || [])].sort((a, c) => (Number(a.item) || 0) - (Number(c.item) || 0));
  if (acts.length) {
    const anchoMes = Math.min(4.5, 50 / Math.max(mesesHasta.length, 1));
    tabla(["Ítem", "Actividad", "Duración (sem.)", "Fecha terminación", ...mesesHasta.map(mesCorto)],
      acts.map((a) => [String(a.item ?? ""), a.actividad, String(a.duracionSemanas ?? "-"), a.fechaFin ? a.fechaFin.split("-").reverse().join("/") : "-", ...mesesHasta.map((m) => (a.avance?.[m] != null && a.avance[m] !== "" ? String(a.avance[m]) : ""))]),
      { titulo: "Avance mensual por actividad (%)", anchos: [5, 100 - 5 - 8 - 10 - anchoMes * mesesHasta.length, 8, 10, ...mesesHasta.map(() => anchoMes)], tam: 13, alinearNum: [2, ...mesesHasta.map((_, i) => i + 4)] });
  } else nota("Sin actividades registradas.");
  H2("Avance gráfico del contrato — curva S");
  if (acts.length) {
    const puntos = curvaS(acts, contrato, ym);
    try {
      const png = await svgADataUrl(svgCurvaS(puntos, { ancho: 760, alto: 320 }));
      b.push({ tipo: "imagen", dataUrl: png.dataUrl, url: png.dataUrl, ancho: png.ancho, alto: png.alto, tamano: 100, nombre: `Curva S — avance programado contra ejecutado acumulado a ${mesLargo(ym)}` });
    } catch (e) { nota("No se pudo dibujar la curva S."); }
    const enCorte = puntos.find((p) => p.ym === ym) || { programado: 0, ejecutado: 0 };
    tabla(["Mes", "Programado acumulado", "Ejecutado acumulado", "Diferencia (pts)"],
      puntos.filter((p) => p.ym <= ym).map((p) => [mesLargo(p.ym), `${numero(p.programado, 1)}%`, p.ejecutado == null ? "–" : `${numero(p.ejecutado, 1)}%`, p.ejecutado == null ? "–" : numero(p.ejecutado - p.programado, 1)]),
      { titulo: "Curva S — avance acumulado mes a mes", anchos: [34, 22, 22, 22], tam: 15, alinearNum: [1, 2, 3] });
    P(`A ${mesLargo(ym)} el contrato registra un avance ejecutado acumulado de ${numero(enCorte.ejecutado ?? 0, 1)}% frente a un avance programado de ${numero(enCorte.programado, 1)}%.`);
  } else nota("Registra las actividades del contrato para obtener la curva S.");
  H2("Observaciones al avance del contrato");
  {
    const atrasadas = acts.filter((a) => {
      const ini = inicioActividad(a);
      if (!ini || !a.fechaFin) return false;
      const prog = corte < ini ? 0 : corte >= a.fechaFin ? 100 : Math.round((diasEntre(ini, corte) / (diasEntre(ini, a.fechaFin) || 1)) * 100);
      return avanceReal(a, ym) < prog - 10;
    });
    if (atrasadas.length) atrasadas.forEach((a) => P(`• ${a.actividad}: avance ejecutado ${avanceReal(a, ym)}%, por debajo de lo programado a la fecha de corte.`));
    else if (acts.length) P("Las actividades avanzan de acuerdo con lo programado a la fecha de corte.");
  }

  // ================================================================ 9. RIESGOS
  H1("Seguimiento a la matriz de riesgos");
  tabla(["Ítem", "Riesgo", "Probabilidad", "Impacto", "Monitoreo y revisión", "Estado"],
    [...(datos.riesgos || [])].sort((a, c) => (Number(a.item) || 0) - (Number(c.item) || 0)).map((r) => [String(r.item ?? ""), `${r.categoria}: ${r.riesgo}`, r.probabilidad, r.impacto, r.monitoreo || "-", r.estado || "-"]),
    { titulo: "Matriz de riesgos", tam: 15 }, "Sin riesgos registrados en la matriz.");

  // ================================================================ 10. REGISTRO FOTOGRÁFICO
  H1("Registro fotográfico");
  const fotos = del("fotos").sort((a, c) => String(a.fecha).localeCompare(String(c.fecha)));
  if (fotos.length) b.push({ tipo: "fotos", fotos: fotos.map((f) => ({ url: f.foto, observacion: f.observacion || "-", fecha: fechaLarga(f.fecha) })) });
  else nota("Sin registro fotográfico para el periodo.");

  // ================================================================ firma
  b.push({ tipo: "firma", nombre: elaboradoPor || contrato.director || "", cargo: cargo || (esObra ? "Director de Interventoría" : "Director del contrato"), empresa: "CONSTRUCCIÓN, INGENIERÍA Y CONSULTORÍA – CINCO S.A.S." });

  return { titulo: `${tituloInforme(contrato)} — ${mesLargo(ym)}`, bloques: b };
}
