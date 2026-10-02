// Informe mensual: el usuario elige el mes, ve qué se registró en cada
// capítulo ese mes (para completar lo que falte antes de generar) y
// descarga el Word armado con esos datos (ip-informe-docx.js).
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, iniciarPagina, pintarEncabezado, esc, mesLargo, mesActual, mesesDelContrato, imgModulo, hrefModulo, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ip-core.js";
import { MODULOS, CAPITULOS, activoEnMes } from "./ip-modulos.js";
import { generarInformeMensual } from "./ip-informe-docx.js";

const ctx = await iniciarPagina();
if (ctx) iniciar(ctx);

async function iniciar({ user, perfil, contrato }) {
  pintarEncabezado(`${imgModulo("informe", "ip-h1-foto")} Informe mensual`, contrato);
  const selMes = document.getElementById("informeMes");
  const cont = document.getElementById("informeContenido");
  const alerta = document.getElementById("informeAlerta");
  const btn = document.getElementById("generarInformeBtn");
  document.getElementById("informeElaborado").value = contrato.director || perfil.nombre || "";
  document.getElementById("informeCargo").value = contrato.tipo === "Obra" ? "Director de Interventoría" : "Director del contrato";

  const meses = mesesDelContrato(contrato, { hastaHoy: true });
  selMes.innerHTML = meses.slice().reverse().map((ym) => `<option value="${ym}">${mesLargo(ym)}</option>`).join("");
  // Por defecto el mes anterior (el informe se presenta a mes vencido).
  const anterior = meses.filter((m) => m < mesActual()).pop();
  if (anterior) selMes.value = anterior;

  // Todas las colecciones del contrato, una lectura cada una.
  const colecciones = [...new Set(Object.values(MODULOS).map((m) => m.coleccion))];
  const datos = {};
  await Promise.all(colecciones.map(async (c) => {
    const snap = await getDocs(collection(db, "ipContratos", contrato.id, c));
    datos[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }));

  // Cuántos registros tiene cada módulo en el mes elegido.
  function delMes(mod, cap, ym) {
    let regs = datos[mod.coleccion] || [];
    if (mod.porCapitulo && cap) regs = regs.filter((r) => r[mod.porCapitulo] === cap);
    if (mod.filtroMes) return regs.filter((r) => mod.filtroMes(r, ym)).length;
    if (mod.sinFiltroMes) return regs.length;
    if (mod.acumulaEnInforme) {
      const c = mod.campos.find((x) => x.type === "date");
      const [a, m] = ym.split("-").map(Number);
      const corte = `${ym}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
      return regs.filter((r) => String(r[c.key] || "") <= corte).length;
    }
    const campo = mod.campos.find((c) => c.type === "month") || mod.campos.find((c) => c.type === "date");
    return campo ? regs.filter((r) => String(r[campo.key] || "").startsWith(ym)).length : regs.length;
  }

  function pintar() {
    const ym = selMes.value;
    cont.innerHTML = `<div class="ip-informe-grid">${CAPITULOS.map((cap, i) => {
      const items = cap.items.filter((it) => !(it.m && MODULOS[it.m].soloObra && contrato.tipo !== "Obra")).map((it) => {
        if (it.href) return `<li><span class="badge ok">✓</span> <a href="${it.href}">${esc(it.label)}</a></li>`;
        const mod = MODULOS[it.m];
        const n = delMes(mod, it.cap, ym);
        const acumulado = mod.sinFiltroMes || mod.acumulaEnInforme || ["personal"].includes(mod.id);
        return `<li><span class="badge ${n ? "ok" : "warn"}">${n}</span> <a href="${hrefModulo(it.m, it.cap)}">${esc(it.label || mod.label)}</a>${acumulado ? ' <span class="text-muted">(acumulado)</span>' : ""}</li>`;
      }).join("");
      return `<div class="card cinta cinta-${i % 4}"><h2>${imgModulo(`cap-${cap.id}`, "ip-capitulo-foto")} ${cap.numero}. ${esc(cap.label)}</h2><ul class="ip-informe-lista">${items}</ul></div>`;
    }).join("")}</div>`;
  }
  selMes.addEventListener("change", pintar);
  pintar();

  btn.addEventListener("click", async () => {
    limpiarAlerta(alerta);
    if (!window.docx) { mostrarAlerta(alerta, "No se pudo cargar el generador de Word. Recarga la página."); return; }
    const ym = selMes.value;
    btn.disabled = true;
    btn.textContent = "Generando…";
    try {
      const blob = await generarInformeMensual({
        contrato, ym, datos,
        elaboradoPor: document.getElementById("informeElaborado").value.trim(),
        cargo: document.getElementById("informeCargo").value.trim()
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Informe ${contrato.tipo === "Obra" ? "de Interventoría" : "de seguimiento"} ${mesLargo(ym)} (Contrato ${String(contrato.numero || "").replace(/[\/:*?"<>|]/g, "-")}).docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      mostrarAlerta(alerta, "Informe generado. Al abrirlo, Word puede preguntar si actualiza los campos: responde «Sí» para que se llene la tabla de contenido.", "success");
    } catch (err) {
      console.error(err);
      mostrarAlerta(alerta, `No se pudo generar el informe: ${errorAmigable(err)}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "📄 Generar informe Word";
    }
  });
}
