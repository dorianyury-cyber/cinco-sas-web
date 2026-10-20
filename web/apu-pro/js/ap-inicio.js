// Tablero de APU PRO: conteo de insumos por tipo, antigüedad de los precios,
// parámetros vigentes y carga de la base inicial cuando la base está vacía.
import { iniciarPagina, listarInsumos, listarParametros, parametrosVigentes, leerSerie, importarSemilla, validarSemilla, esc, pesos, numero, fechaCorta, mostrarAlerta, errorAmigable } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { TIPOS, ORDEN_TIPOS, estadoPrecio, jornalMO, variacionIPP } from "./ap-calculos.js";

const ctx = await iniciarPagina();
if (ctx) await cargar();

async function cargar() {
  const alerta = document.getElementById("tableroAlerta");
  try {
    const [insumos, parametros, ipp] = await Promise.all([listarInsumos(), listarParametros(), leerSerie("ipp")]);
    const conteos = Object.fromEntries(ORDEN_TIPOS.map((t) => [t, insumos.filter((x) => x.tipo === t).length]));
    pintarMenu(ctx, { activo: "tablero", conteos });
    document.getElementById("cargaCard").classList.toggle("hidden", insumos.length > 0);
    pintarKpis(insumos, conteos);
    pintarAntiguedad(insumos);
    pintarParametros(parametros, ipp, insumos);
    prepararCarga(insumos);
  } catch (err) {
    pintarMenu(ctx, { activo: "tablero" });
    mostrarAlerta(alerta, errorAmigable(err));
  }
}

function pintarKpis(insumos, conteos) {
  document.getElementById("kpis").innerHTML = ORDEN_TIPOS.map((t) => `
    <a class="ap-kpi" href="insumos.html#${t}">
      <span class="ap-kpi-icono">${TIPOS[t].icono}</span>
      <span><strong>${conteos[t]}</strong><small>${esc(TIPOS[t].nombre)}</small></span>
    </a>`).join("");
}

function pintarAntiguedad(insumos) {
  const conPrecio = insumos.filter((x) => x.tipo !== "MO");
  const filas = ORDEN_TIPOS.filter((t) => t !== "MO").map((t) => {
    const del = conPrecio.filter((x) => x.tipo === t);
    const c = { ok: 0, warn: 0, danger: 0, muted: 0 };
    for (const x of del) c[estadoPrecio(x.fechaPrecio).clase]++;
    return { t, total: del.length, ...c };
  });
  const tot = filas.reduce((o, f) => ({ total: o.total + f.total, ok: o.ok + f.ok, warn: o.warn + f.warn, danger: o.danger + f.danger, muted: o.muted + f.muted }), { total: 0, ok: 0, warn: 0, danger: 0, muted: 0 });
  const celda = (n, clase, t) => (n ? `<a class="badge ${clase}" href="insumos.html#${t}${clase === "ok" ? "" : "?estado=" + clase}">${n}</a>` : `<span class="text-muted">0</span>`);
  document.getElementById("antiguedad").innerHTML = !conPrecio.length ? '<p class="text-muted">Sin insumos todavía.</p>' : `
    <table class="ap-tabla ap-tabla-resumen">
      <thead><tr><th>Tipo</th><th>Total</th><th>Vigente</th><th>Revisar</th><th>Desactualizado</th><th>Sin fecha</th></tr></thead>
      <tbody>${filas.map((f) => `<tr><td>${TIPOS[f.t].icono} ${esc(TIPOS[f.t].nombre)}</td><td>${f.total}</td><td>${celda(f.ok, "ok", f.t)}</td><td>${celda(f.warn, "warn", f.t)}</td><td>${celda(f.danger, "danger", f.t)}</td><td>${celda(f.muted, "muted", f.t)}</td></tr>`).join("")}
        <tr class="ap-fila-total"><td>Total</td><td>${tot.total}</td><td>${tot.ok}</td><td>${tot.warn}</td><td>${tot.danger}</td><td>${tot.muted}</td></tr></tbody>
    </table>`;
}

function pintarParametros(lista, ipp, insumos) {
  const el = document.getElementById("parametros");
  const anio = new Date().getFullYear();
  const p = parametrosVigentes(lista, anio);
  if (!p) { el.innerHTML = '<p class="text-muted">No hay parámetros registrados. <a href="parametros.html">Regístralos aquí</a>.</p>'; return; }
  const aviso = p.anio !== anio ? `<p class="alert error">No hay parámetros de ${anio}: se usan los de ${p.anio}. <a href="parametros.html">Registra los de ${anio}</a> (salario mínimo y auxilio de transporte).</p>` : "";
  const ayudante = insumos.find((x) => x.tipo === "MO" && x.factorSalarial === 1);
  const j = ayudante ? jornalMO(1, p) : null;
  const v = variacionIPP(ipp?.puntos, 1);
  el.innerHTML = `${aviso}
    <div class="ap-pares">
      <div><span>Año</span><strong>${p.anio}</strong></div>
      <div><span>Salario mínimo</span><strong>${pesos(p.smmlv)}</strong></div>
      <div><span>Auxilio de transporte</span><strong>${pesos(p.auxTransporte)}</strong></div>
      <div><span>Prestaciones</span><strong>${numero((p.prestacional || 0) * 100, 1)} %</strong></div>
      <div><span>Días hábiles por mes</span><strong>${p.diasHabiles}</strong></div>
      ${j ? `<div><span>Jornal ayudante (factor 1)</span><strong>${pesos(j.total)}/día</strong></div>` : ""}
      ${v ? `<div><span>Variación anual IPP</span><strong>${numero(v.tasaAnual * 100, 2)} %</strong><small>${fechaCorta(v.desde)} a ${fechaCorta(v.hasta)}</small></div>` : ""}
    </div>`;
}

function prepararCarga(insumos) {
  const btn = document.getElementById("semillaBtn");
  const archivo = document.getElementById("semillaArchivo");
  const progreso = document.getElementById("semillaProgreso");
  const alerta = document.getElementById("tableroAlerta");
  if (btn.dataset.listo) return;
  btn.dataset.listo = "1";
  btn.addEventListener("click", () => archivo.click());
  archivo.addEventListener("change", async () => {
    const f = archivo.files[0];
    archivo.value = "";
    if (!f) return;
    try {
      const json = validarSemilla(JSON.parse(await f.text()));
      const resumen = ORDEN_TIPOS.map((t) => `${json.insumos.filter((x) => x.tipo === t).length} ${TIPOS[t].nombre.toLowerCase()}`).join(", ");
      if (!confirm(`Se cargarán ${json.insumos.length} insumos (${resumen}), ${json.parametros?.length || 0} años de parámetros, ${json.ipp?.length || 0} meses de IPP y ${json.monedas?.length || 0} monedas. ¿Continuar?`)) return;
      btn.disabled = true;
      const r = await importarSemilla(json, ctx.user, { existentes: new Set(insumos.map((x) => x.codigo)), progreso: (h, n) => { progreso.textContent = `Guardando insumos: ${h} de ${n}…`; } });
      progreso.textContent = "";
      mostrarAlerta(alerta, `Base cargada: ${r.insumos} insumos, ${r.parametros} años de parámetros y ${r.ipp} meses de IPP.`, "success");
      await cargar();
    } catch (err) {
      mostrarAlerta(alerta, errorAmigable(err));
    } finally {
      btn.disabled = false;
    }
  });
}
