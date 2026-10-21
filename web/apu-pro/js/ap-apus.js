// Biblioteca de APU: listado de una línea por fila con la hoja del APU seleccionado
// arriba (fila 1 por defecto), recalculada con la base de insumos y los parámetros del año.
import { iniciarPagina, listarApus, listarInsumos, listarParametros, parametrosVigentes, leerSerie, eliminarApu, importarBiblioteca, validarBiblioteca, esc, pesos, numero, fechaCorta, mostrarAlerta, errorAmigable, colgroupProporcional, aplicarAnchos } from "./ap-core.js";
import { pintarMenu } from "./ap-shell.js";
import { ORDEN_TIPOS, normalizar } from "./ap-calculos.js";
import { calcularApu, precioConAiu } from "./ap-apu.js";
import { htmlHojaApu } from "./ap-vista-apu.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");
let apus = [], insumos = new Map(), parametros = [], seleccion = decodeURIComponent(location.hash.slice(1)) || null, validacion = null;
const cache = new Map(); // codigo → resultado del cálculo (se limpia al cambiar el año)

if (ctx) {
  await cargar();
  conectar();
}

async function cargar() {
  try {
    const [a, ins, par, val] = await Promise.all([listarApus(), listarInsumos(), listarParametros(), leerSerie("validacionApu")]);
    apus = a; insumos = new Map(ins.map((x) => [x.codigo, x])); parametros = par; validacion = val;
    pintarMenu(ctx, { activo: "apus", apus: apus.length, conteos: Object.fromEntries(ORDEN_TIPOS.map((t) => [t, ins.filter((x) => x.tipo === t).length])) });
  } catch (err) {
    pintarMenu(ctx, { activo: "apus" });
    mostrarAlerta(alerta, errorAmigable(err));
  }
  const anio = $("anioParametros");
  anio.innerHTML = parametros.map((p) => `<option value="${p.anio}">${p.anio}</option>`).join("");
  const vig = parametrosVigentes(parametros);
  if (vig) anio.value = String(vig.anio);
  $("cargaCard").classList.toggle("hidden", apus.length > 0);
  const opciones = (vals) => [...new Set(vals.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { numeric: true })).map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  $("filtroCategoria").innerHTML = `<option value="">Todas las categorías</option>${opciones(apus.map((a) => a.categoria))}`;
  $("filtroOrigen").innerHTML = `<option value="">Todos los orígenes</option>${opciones(apus.map((a) => a.origen || "Creado en APU PRO"))}`;
  cache.clear();
  pintar();
}

function parametrosAnio() { return parametros.find((p) => String(p.anio) === $("anioParametros").value) || parametrosVigentes(parametros); }
function calcular(apu) {
  if (!cache.has(apu.codigo)) cache.set(apu.codigo, calcularApu(apu, { insumo: (c) => insumos.get(c) || null, parametros: parametrosAnio() }));
  return cache.get(apu.codigo);
}
function numeroCodigo(c) { const m = String(c).match(/^APU-(\d+)(?:-(\d+))?/); return m ? Number(m[1]) * 100 + (Number(m[2]) || 0) : 1e9; }

function filtrados() {
  const palabras = normalizar($("buscar").value).split(" ").filter(Boolean);
  const cat = $("filtroCategoria").value, ori = $("filtroOrigen").value;
  return apus
    .filter((a) => !cat || a.categoria === cat)
    .filter((a) => !ori || (a.origen || "Creado en APU PRO") === ori)
    .filter((a) => { if (!palabras.length) return true; const t = normalizar(`${a.codigo} ${a.nombre} ${a.categoria || ""} ${(a.codigosAnteriores || []).join(" ")}`); return palabras.every((p) => t.includes(p)); })
    .sort((a, b) => numeroCodigo(a.codigo) - numeroCodigo(b.codigo) || a.codigo.localeCompare(b.codigo));
}

function pintar() {
  const lista = filtrados();
  $("cuenta").textContent = `${lista.length} de ${apus.length}`;
  if (!seleccion || !lista.some((a) => a.codigo === seleccion)) seleccion = lista[0]?.codigo || null;
  const enc = ["Código", "Nombre", "Und", "Rend.", "Categoría", "Costo directo", "Origen"];
  const filas = lista.map((a) => [a.codigo, a.nombre, a.unidad, numero(a.rendimiento, 3), a.categoria || "—", pesos(calcular(a).costoDirecto), a.origen ? `${a.origen.replace(/^Presupuestos? /, "")}` : "Creado en APU PRO"]);
  const tabla = $("tabla");
  tabla.innerHTML = lista.length ? `${colgroupProporcional(enc, filas.slice(0, 300))}
    <thead><tr>${enc.map((h, j) => `<th class="${j === 3 || j === 5 ? "ap-num" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${lista.map((a, i) => `<tr data-codigo="${esc(a.codigo)}" class="${a.codigo === seleccion ? "ap-sel" : ""}">${filas[i].map((v, j) => `<td class="${j === 3 || j === 5 ? "ap-num" : ""}" title="${esc(v)}">${esc(v)}${j === 1 && a.observacionesOrigen?.length ? ' <span class="badge warn" title="El Excel de origen tenía un error">!</span>' : ""}</td>`).join("")}</tr>`).join("")}</tbody>`
    : `<tbody><tr><td class="text-muted">${apus.length ? "Ningún APU coincide con el filtro." : "La biblioteca está vacía."}</td></tr></tbody>`;
  aplicarAnchos(tabla);
  pintarDetalle();
}

function pintarDetalle() {
  const el = $("vistaPrevia");
  const a = apus.find((x) => x.codigo === seleccion);
  if (!a) { el.innerHTML = `<p class="text-muted">${apus.length ? "Ningún APU coincide con el filtro." : "Todavía no hay APU. Carga la biblioteca inicial o crea uno nuevo."}</p>`; return; }
  const r = calcular(a);
  const p = parametrosAnio();
  const ref = precioConAiu(r.costoDirecto);
  const par = (et, v) => `<div><span>${esc(et)}</span><strong>${v}</strong></div>`;
  const origen = a.origen
    ? `${esc(a.origen)}${a.fechaOrigen ? ` · ${fechaCorta(a.fechaOrigen)}` : ""}${a.valorOrigen != null ? ` · costo directo en el Excel: ${pesos(a.valorOrigen)}${a.factorMaterialesOrigen && a.factorMaterialesOrigen !== 1 ? ` (con factor ${numero(a.factorMaterialesOrigen, 2)} en materiales)` : ""}` : ""}`
    : "Creado en APU PRO";
  el.innerHTML = `
    <div class="ap-vp-cabeza">
      <h2>${esc(a.codigo)} — ${esc(a.nombre)}</h2>
      <div class="rt-acciones">
        <a class="btn" href="apu-formato.html?c=${encodeURIComponent(a.codigo)}">🖨 Formato Cinco</a>
        <a class="btn secondary" href="apu.html?c=${encodeURIComponent(a.codigo)}">✎ Editar</a>
        <a class="btn secondary" href="apu.html?copiar=${encodeURIComponent(a.codigo)}">⧉ Duplicar</a>
        ${ctx.esAdmin ? '<button type="button" class="btn secondary ap-peligro" id="vpEliminar">Eliminar</button>' : ""}
      </div>
    </div>
    <div class="ap-pares ap-pares-apu">
      ${par("Unidad", esc(a.unidad))}
      ${par("Rendimiento", `${numero(a.rendimiento, 3)} ${esc(a.unidad)}/día`)}
      ${par("Cuadrilla", `${numero(r.personas, 2)} personas`)}
      ${par("Categoría", esc(a.categoria || "—"))}
      ${par("Versión", String(a.version || 1))}
      ${par(`Costo directo (${p?.anio || "sin parámetros"})`, pesos(r.costoDirecto))}
      ${par("Con AIU 15/5/5 e IVA sobre la utilidad", `${pesos(ref.total)} <small>referencia</small>`)}
      ${a.codigosAnteriores?.length ? par("Códigos anteriores", esc(a.codigosAnteriores.join(", "))) : ""}
    </div>
    <p class="ap-origen text-muted"><strong>Origen:</strong> ${origen}</p>
    ${a.observacionesOrigen?.length ? `<p class="alert error ap-obs"><strong>Error encontrado en el Excel de origen:</strong> ${esc(a.observacionesOrigen.join(" · "))}. En la biblioteca el APU queda calculado correctamente.</p>` : ""}
    ${r.avisos.length ? `<p class="alert error ap-obs">${esc([...new Set(r.avisos)].slice(0, 6).join(" · "))}</p>` : ""}
    ${htmlHojaApu(r)}`;
  aplicarAnchos(el);
  el.querySelector("#vpEliminar")?.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar ${a.codigo} — ${a.nombre} y su historial de versiones? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarApu(a.codigo);
      apus = apus.filter((x) => x.codigo !== a.codigo);
      seleccion = null;
      pintar();
      mostrarAlerta(alerta, `Se eliminó ${a.codigo}.`, "success");
    } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });
}

function conectar() {
  let t = null;
  $("buscar").addEventListener("input", () => { clearTimeout(t); t = setTimeout(pintar, 150); });
  $("filtroCategoria").addEventListener("change", pintar);
  $("filtroOrigen").addEventListener("change", pintar);
  $("anioParametros").addEventListener("change", () => { cache.clear(); pintar(); });
  $("tabla").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-codigo]");
    if (!tr) return;
    seleccion = tr.dataset.codigo;
    $("tabla").querySelectorAll("tr.ap-sel").forEach((r) => r.classList.remove("ap-sel"));
    tr.classList.add("ap-sel");
    pintarDetalle();
    $("vistaPrevia").scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  const btn = $("bibliotecaBtn"), archivo = $("bibliotecaArchivo"), progreso = $("bibliotecaProgreso");
  btn.addEventListener("click", () => archivo.click());
  $("importarBtn").addEventListener("click", () => archivo.click());
  archivo.addEventListener("change", async () => {
    const f = archivo.files[0];
    archivo.value = "";
    if (!f) return;
    try {
      const json = validarBiblioteca(JSON.parse(await f.text()));
      if (!insumos.size && !confirm("La base de insumos está vacía: los APU quedarán sin precios hasta que la cargues desde el Tablero. ¿Continuar?")) return;
      const existe = (a) => apus.some((x) => x.codigo === a.codigo);
      const aActualizar = json.actualizar === true ? json.apus.filter(existe) : [];
      if (!confirm(aActualizar.length
        ? `Se actualizarán ${aActualizar.length} APU existentes (${aActualizar.map((a) => a.codigo).slice(0, 6).join(", ")}${aActualizar.length > 6 ? "…" : ""})${json.campos?.length ? `, solo en: ${json.campos.join(", ")}` : ""}. La versión anterior queda en el historial. ¿Continuar?`
        : `Se cargarán ${json.apus.length} APU. ¿Continuar?`)) return;
      btn.disabled = true;
      const r = await importarBiblioteca(json, ctx.user, { existentes: new Set(apus.map((a) => a.codigo)), progreso: (h, n) => { progreso.textContent = `Guardando APU: ${h} de ${n}…`; } });
      progreso.textContent = "";
      mostrarAlerta(alerta, r.actualizados ? `Se actualizaron ${r.actualizados} APU${r.apus ? ` y se cargaron ${r.apus} nuevos` : ""}.` : `Biblioteca cargada: ${r.apus} APU${r.omitidos ? ` (${r.omitidos} ya existían)` : ""}.`, "success");
      await cargar();
    } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); } finally { btn.disabled = false; }
  });
}
