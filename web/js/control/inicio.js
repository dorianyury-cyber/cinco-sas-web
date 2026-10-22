// Inicio del módulo interno: contadores de cada módulo, alertas de vencimientos y últimos radicados.
// Cada colección se lee por separado: si el usuario no tiene permiso sobre una, su contador y sus alertas
// simplemente no aparecen.
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth, obtenerPerfil } from "./firebase-control.js";

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mediodia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
const HOY = mediodia(new Date());
const aFecha = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null; };
const diasEntre = (a, b) => Math.round((a - b) / 86400000); // días de a respecto de b
const fechaCorta = (d) => d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
const moneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const deTimestamp = (t) => (t?.toDate ? mediodia(t.toDate()) : null);
const mismoMes = (d) => d && d.getFullYear() === HOY.getFullYear() && d.getMonth() === HOY.getMonth();

async function leer(nombre) {
  try { return (await getDocs(collection(db, nombre))).docs.map((d) => ({ id: d.id, ...d.data() })); } catch (e) { return null; }
}

const NIVEL = { peligro: { orden: 0, texto: "Urgente" }, aviso: { orden: 1, texto: "Atención" }, info: { orden: 2, texto: "Informativo" } };
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const cuandoVence = (d) => (d < 0 ? `venció hace ${plural(-d, "día", "días")}` : d === 0 ? "vence hoy" : `vence en ${plural(d, "día", "días")}`);

function calcular({ contratos, ofertas, documentos, ordenes, informes, cartas, empleados }) {
  const alertas = [], porVencer = [];
  const resumen = { activos: 0, cerrados: 0, obra: 0, servicio: 0, valor: 0 };
  if (contratos) {
    const aprobadores = (empleados || []).filter((e) => e.estado === "activo" && e.aprobadorContratos === true).length;
    let sinAprobar = 0, sinFecha = 0;
    contratos.forEach((c) => {
      if (c.estado === "cerrado") { resumen.cerrados++; return; }
      resumen.activos++;
      if (c.tipo === "obra") resumen.obra++; else resumen.servicio++;
      resumen.valor += Number(c.valorContrato) || 0;
      const fin = aFecha(c.fechaFin);
      if (!fin) sinFecha++;
      else {
        const d = diasEntre(fin, HOY);
        if (d <= 90) porVencer.push({ c, fin, d });
        if (d <= 30) alertas.push({ nivel: d <= 7 ? "peligro" : "aviso", icono: "📋", titulo: `${c.codigo || "Contrato"} ${cuandoVence(d)}`, detalle: c.nombre, href: `contrato.html?id=${c.id}`, orden: d });
      }
      if (aprobadores > 0 && Object.keys(c.aprobaciones || {}).length < aprobadores) sinAprobar++;
    });
    // Contratos activos ya iniciados que no tienen ningún informe de este mes (los informes llevan el contrato elegido).
    if (informes) {
      const mesActual = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, "0")}`;
      const conInforme = new Set(informes.filter((i) => i.mes === mesActual || mismoMes(deTimestamp(i.creadoEn))).map((i) => i.contratoId).filter(Boolean));
      const sinInforme = contratos.filter((c) => c.estado !== "cerrado" && aFecha(c.fechaInicio) && aFecha(c.fechaInicio) <= HOY && !conInforme.has(c.id));
      if (sinInforme.length) alertas.push({ nivel: "info", icono: "📊", titulo: `${plural(sinInforme.length, "contrato activo", "contratos activos")} sin informe de este mes`, detalle: sinInforme.slice(0, 4).map((c) => c.codigo).filter(Boolean).join(", ") + (sinInforme.length > 4 ? "…" : ""), href: "informes.html", orden: 1003 });
    }
    if (sinAprobar) alertas.push({ nivel: "info", icono: "⏳", titulo: `${plural(sinAprobar, "contrato activo", "contratos activos")} con aprobación pendiente`, detalle: "Faltan firmas de los aprobadores.", href: "contratos.html", orden: 1000 });
    if (sinFecha) alertas.push({ nivel: "info", icono: "📅", titulo: `${plural(sinFecha, "contrato activo", "contratos activos")} sin fecha de finalización`, detalle: "Sin fecha no se puede avisar su vencimiento.", href: "contratos.html", orden: 1001 });
  }
  let ofertasVigentes = 0;
  if (ofertas) {
    ofertas.forEach((o) => {
      const dias = Number(o.condiciones?.validezDias) || 0, creada = deTimestamp(o.creadoEn);
      if (!dias || !creada) { ofertasVigentes++; return; }
      const vence = new Date(creada.getTime() + dias * 86400000), d = diasEntre(vence, HOY);
      if (d >= 0) ofertasVigentes++;
      if (d >= -30 && d <= 7) alertas.push({ nivel: "aviso", icono: "💼", titulo: `Oferta ${o.radicado || ""} ${cuandoVence(d)}`, detalle: o.titulo || o.cliente || "", href: "ofertas.html", orden: d });
    });
  }
  let sinSocializar = 0, docsVigentes = 0;
  if (documentos) {
    documentos.forEach((d) => { if (d.estado !== "obsoleto") { docsVigentes++; if (!d.socializado) sinSocializar++; } });
    if (sinSocializar) alertas.push({ nivel: "info", icono: "📑", titulo: `${plural(sinSocializar, "documento vigente", "documentos vigentes")} sin socializar`, detalle: "Listado maestro de documentos.", href: "documentos.html", orden: 1002 });
  }
  let abiertas = 0;
  if (ordenes) {
    ordenes.forEach((o) => {
      if ((o.estado || "ACTIVA") === "CERRADA") return;
      abiertas++;
      const creada = deTimestamp(o.creadoEn);
      if (creada && diasEntre(HOY, creada) > 30) alertas.push({ nivel: "aviso", icono: "🛠", titulo: `Orden de trabajo ${o.consecutivo || o.numero || ""} abierta hace ${diasEntre(HOY, creada)} días`.replace("  ", " "), detalle: o.descripcion || o.responsable || "", href: "ordenes-trabajo.html", orden: 500 });
    });
  }
  alertas.sort((a, b) => NIVEL[a.nivel].orden - NIVEL[b.nivel].orden || a.orden - b.orden);
  porVencer.sort((a, b) => a.d - b.d);
  const ultimos = [
    ...(ofertas || []).map((o) => ({ tipo: "Oferta", icono: "💼", radicado: o.radicado, texto: o.titulo, fecha: deTimestamp(o.creadoEn), href: "ofertas.html" })),
    ...(informes || []).map((o) => ({ tipo: "Informe", icono: "📊", radicado: o.radicado, texto: o.titulo, fecha: deTimestamp(o.creadoEn), href: "informes.html" })),
    ...(cartas || []).map((o) => ({ tipo: "Carta", icono: "✉️", radicado: o.radicado, texto: o.asunto, fecha: aFecha(o.fecha) || deTimestamp(o.creadoEn), href: "correspondencia.html" }))
  ].filter((x) => x.fecha).sort((a, b) => b.fecha - a.fecha).slice(0, 8);
  const kpis = [];
  const kpi = (icono, valor, etiqueta, sub, href, tono = "") => kpis.push({ icono, valor, etiqueta, sub, href, tono });
  if (contratos) {
    kpi("📋", resumen.activos, "Contratos activos", `de ${contratos.length} en total`, "contratos.html");
    const proximos = porVencer.filter((x) => x.d <= 30), vencidos = porVencer.filter((x) => x.d < 0).length;
    kpi("⏰", proximos.length, "Vencen en 30 días", vencidos ? `${vencidos} ya vencidos` : "o ya vencidos", "contratos.html", proximos.length ? (proximos.some((x) => x.d <= 7) ? "peligro" : "aviso") : "");
  }
  if (ofertas) kpi("💼", ofertas.length, "Ofertas", `${ofertasVigentes} con validez vigente`, "ofertas.html");
  if (informes) kpi("📊", informes.filter((x) => mismoMes(deTimestamp(x.creadoEn))).length, "Informes del mes", `${informes.length} en total`, "informes.html");
  if (cartas) kpi("✉️", cartas.filter((x) => mismoMes(aFecha(x.fecha) || deTimestamp(x.creadoEn))).length, "Cartas del mes", `${cartas.length} en total`, "correspondencia.html");
  if (documentos) kpi("📑", docsVigentes, "Documentos vigentes", sinSocializar ? `${sinSocializar} sin socializar` : "todos socializados", "documentos.html", sinSocializar ? "info" : "");
  if (ordenes) kpi("🛠", abiertas, "Órdenes abiertas", `${ordenes.length} en total`, "ordenes-trabajo.html");
  if (empleados) kpi("👥", empleados.filter((e) => e.estado === "activo").length, "Empleados activos", `${empleados.length} registrados`, "empleados.html");
  return { alertas, porVencer, resumen, ultimos, kpis, hayContratos: !!contratos };
}

function pintar(r) {
  document.getElementById("kpis").innerHTML = r.kpis.length
    ? r.kpis.map((k) => `<a class="ctl-kpi ${k.tono ? `ctl-kpi-${k.tono}` : ""}" href="${k.href}"><span class="ctl-kpi-icono">${k.icono}</span><span class="ctl-kpi-texto"><strong>${esc(k.valor)}</strong><span>${esc(k.etiqueta)}</span><small>${esc(k.sub)}</small></span></a>`).join("")
    : '<p class="text-muted">No hay datos disponibles para tu usuario.</p>';
  const MAX = 12;
  const filas = r.alertas.slice(0, MAX);
  document.getElementById("alertas").innerHTML = r.alertas.length
    ? filas.map((a) => `<a class="ctl-alerta" href="${a.href}"><span class="ctl-nivel ctl-nivel-${a.nivel}">${NIVEL[a.nivel].texto}</span><span class="ctl-alerta-cuerpo"><strong>${a.icono} ${esc(a.titulo)}</strong><small>${esc(a.detalle || "")}</small></span></a>`).join("") + (r.alertas.length > MAX ? `<p class="text-muted ctl-mas">y ${r.alertas.length - MAX} más</p>` : "")
    : '<p class="text-muted">✔ No hay alertas por ahora.</p>';
  document.getElementById("porVencer").innerHTML = r.porVencer.length
    ? `<table class="ctl-mini"><thead><tr><th>Código</th><th>Contrato</th><th>Vence</th><th></th></tr></thead><tbody>${r.porVencer.slice(0, 8).map(({ c, fin, d }) => `<tr><td><a href="contrato.html?id=${c.id}">${esc(c.codigo || "—")}</a></td><td title="${esc(c.nombre)}">${esc(c.nombre)}</td><td>${fechaCorta(fin)}</td><td><span class="ctl-nivel ctl-nivel-${d <= 7 ? "peligro" : d <= 30 ? "aviso" : "info"}">${d < 0 ? `hace ${-d} d` : `${d} d`}</span></td></tr>`).join("")}</tbody></table>${r.porVencer.length > 8 ? `<p class="text-muted ctl-mas">y ${r.porVencer.length - 8} más</p>` : ""}`
    : '<p class="text-muted">Ningún contrato activo vence en los próximos 90 días.</p>';
  const s = r.resumen;
  document.getElementById("resumen").innerHTML = r.hayContratos
    ? `<div class="ctl-resumen"><div><strong>${s.activos}</strong><span>activos</span></div><div><strong>${s.cerrados}</strong><span>cerrados</span></div><div><strong>${s.obra}</strong><span>de obra</span></div><div><strong>${s.servicio}</strong><span>de servicio</span></div></div><p class="ctl-valor">Valor de los contratos activos: <strong>${moneda.format(s.valor)}</strong></p>`
    : '<p class="text-muted">Sin acceso a los contratos.</p>';
  document.getElementById("ultimos").innerHTML = r.ultimos.length
    ? r.ultimos.map((u) => `<a class="ctl-ultimo" href="${u.href}"><span>${u.icono}</span><span class="ctl-ultimo-cuerpo"><strong>${esc(u.radicado || u.tipo)}</strong><small>${esc(u.texto || "")}</small></span><time>${fechaCorta(u.fecha)}</time></a>`).join("")
    : '<p class="text-muted">Todavía no hay radicados.</p>';
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;
  const perfil = await obtenerPerfil(user.email);
  document.getElementById("navOrdenesTrabajo")?.classList.toggle("oculto", perfil?.estado !== "activo");
  const nombres = ["contratos", "ofertas", "documentos", "ordenesTrabajo", "informes", "correspondencia", "empleados"];
  const [contratos, ofertas, documentos, ordenes, informes, cartas, empleados] = await Promise.all(nombres.map(leer));
  pintar(calcular({ contratos, ofertas, documentos, ordenes, informes, cartas, empleados }));
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
