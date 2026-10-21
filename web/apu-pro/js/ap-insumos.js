// Insumos de APU PRO por tipo (materiales, mano de obra, equipos, EPP, transporte):
// listado de una línea por fila con el panel de detalle arriba (fila 1 por defecto),
// historial de precios con fuente y fecha, y alta / edición / nuevo precio.
import { iniciarPagina, listarInsumos, listarParametros, parametrosVigentes, crearInsumo, actualizarInsumo, registrarPrecio, eliminarInsumo, esc, pesos, numero, fechaCorta, hoyISO, leerNumero, mostrarAlerta, limpiarAlerta, errorAmigable, colgroupProporcional, aplicarAnchos } from "./ap-core.js";
import { pintarMenu, marcarActivo } from "./ap-shell.js";
import { TIPOS, ORDEN_TIPOS, BASES, estadoPrecio, jornalMO, valorMensual, normalizar, siguienteCodigo } from "./ap-calculos.js";

const ctx = await iniciarPagina();
let insumos = [], parametros = [], tipo = "MA", seleccion = null, editando = null;
const $ = (id) => document.getElementById(id);
const alerta = $("alerta");

if (ctx) {
  try {
    [insumos, parametros] = await Promise.all([listarInsumos(), listarParametros()]);
  } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  pintarMenu(ctx, { activo: `insumos-${tipo}`, conteos: conteos() });
  const anioSel = $("anioParametros");
  anioSel.innerHTML = parametros.map((p) => `<option value="${p.anio}">${p.anio}</option>`).join("");
  const vig = parametrosVigentes(parametros);
  if (vig) anioSel.value = String(vig.anio);
  leerHash();
  conectar();
  pintar();
}

function conteos() { return Object.fromEntries(ORDEN_TIPOS.map((t) => [t, insumos.filter((x) => x.tipo === t).length])); }
function leerHash() {
  const [t, q] = location.hash.replace("#", "").split("?");
  tipo = TIPOS[t] ? t : "MA";
  const estado = new URLSearchParams(q || "").get("estado") || "";
  $("filtroEstado").value = estado;
  seleccion = null;
}
function parametrosAnio() { return parametros.find((p) => String(p.anio) === $("anioParametros").value) || parametrosVigentes(parametros); }

// ---------------------------------------------------------------- listado
function filtrados() {
  const palabras = normalizar($("buscar").value).split(" ").filter(Boolean);
  const est = $("filtroEstado").value;
  return insumos
    .filter((x) => x.tipo === tipo)
    .filter((x) => { if (!palabras.length) return true; const t = normalizar(`${x.codigo} ${x.descripcion} ${(x.codigosAnteriores || []).join(" ")} ${x.fuente || ""}`); return palabras.every((p) => t.includes(p)); })
    .filter((x) => !est || tipo === "MO" || (x.precio == null ? "muted" : estadoPrecio(x.fechaPrecio).clase) === est)
    .sort((a, b) => (Number(a.codigo.replace(/\D+/g, "")) || 0) - (Number(b.codigo.replace(/\D+/g, "")) || 0));
}

function columnas() {
  const p = parametrosAnio();
  if (tipo === "MO") return {
    enc: ["Código", "Cargo", "Factor", "Jornal", "Prestaciones", "Total día"],
    fila: (x) => { const j = jornalMO(x.factorSalarial, p); return [x.codigo, x.descripcion, numero(x.factorSalarial, 2), pesos(j?.jornal), pesos(j?.prestaciones), pesos(j?.total)]; },
    num: [2, 3, 4, 5], html: []
  };
  if (tipo === "MA") return {
    enc: ["Código", "Descripción", "Und", "Precio", "Fecha", "Estado", "Fuente"],
    fila: (x) => [x.codigo, x.descripcion, x.unidad, pesos(x.precio), fechaCorta(x.fechaPrecio), estado(x), x.fuente || "—"],
    num: [3], html: [5]
  };
  return {
    enc: ["Código", "Descripción", "Und", "Valor", "Base", "Mensual", "Fecha", "Estado"],
    fila: (x) => [x.codigo, x.descripcion, x.unidad, pesos(x.precio), x.base === "vidaUtil" ? `Vida útil ${numero(x.vidaUtilAnios, 2)} a` : x.base === "unidad" ? "Por unidad" : "Mensual", x.base === "unidad" ? "—" : pesos(valorMensual(x)), fechaCorta(x.fechaPrecio), estado(x)],
    num: [3, 5], html: [7]
  };
}
function estado(x) {
  const e = x.precio == null ? { clase: "muted", texto: "Sin precio" } : estadoPrecio(x.fechaPrecio);
  return `<span class="badge ${e.clase}">${e.texto}</span>`;
}

function pintar() {
  marcarActivo(`insumos-${tipo}`);
  const T = TIPOS[tipo];
  $("titulo").textContent = `${T.icono} ${T.nombre}`;
  $("subtitulo").textContent = {
    MA: "Precios comerciales con IVA, con fecha, fuente y enlace. Al registrar un precio nuevo, el anterior queda en el historial.",
    MO: "Cargos con su factor salarial. El jornal se calcula con los parámetros del año: (factor × salario mínimo + auxilio de transporte si el factor es 2 o menos) ÷ días hábiles, más el % prestacional.",
    EH: "Equipos y herramientas con valor mensual o valor de compra y vida útil; en el APU se prorratean por días hábiles y rendimiento.",
    ED: "Elementos de protección personal y dotación con su valor y vida útil; en el APU se reparten según el número de trabajadores.",
    TV: "Vehículos y maquinaria con valor mensual (o por unidad, como ton·km o m³) y viáticos."
  }[tipo];
  $("pestanas").innerHTML = ORDEN_TIPOS.map((t) => `<a href="#${t}" class="ap-pestana${t === tipo ? " activa" : ""}">${TIPOS[t].icono} ${esc(TIPOS[t].nombre)} <span>${insumos.filter((x) => x.tipo === t).length}</span></a>`).join("");
  $("anioCaja").classList.toggle("hidden", tipo !== "MO");
  $("filtroEstado").classList.toggle("hidden", tipo === "MO");
  $("nuevoBtn").textContent = `＋ ${T.nuevo}`;

  const lista = filtrados();
  $("cuenta").textContent = `${lista.length} de ${insumos.filter((x) => x.tipo === tipo).length}`;
  if (!seleccion || !lista.some((x) => x.codigo === seleccion)) seleccion = lista[0]?.codigo || null;
  const c = columnas();
  const filas = lista.map((x) => c.fila(x));
  const tabla = $("tabla");
  tabla.innerHTML = lista.length ? `${colgroupProporcional(c.enc, filas.slice(0, 300))}
    <thead><tr>${c.enc.map((h, j) => `<th class="${c.num.includes(j) ? "ap-num" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${lista.map((x, i) => `<tr data-codigo="${esc(x.codigo)}" class="${x.codigo === seleccion ? "ap-sel" : ""}">${filas[i].map((v, j) => `<td class="${c.num.includes(j) ? "ap-num" : ""}" title="${esc(String(v).replace(/<[^>]*>/g, ""))}">${c.html.includes(j) ? v : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>`
    : '<tbody><tr><td class="text-muted">No hay insumos con ese filtro.</td></tr></tbody>';
  aplicarAnchos(tabla);
  pintarDetalle();
}

// ---------------------------------------------------------------- panel de detalle
function pintarDetalle() {
  const el = $("vistaPrevia");
  const x = insumos.find((i) => i.codigo === seleccion);
  if (!x) { el.innerHTML = `<p class="text-muted">${insumos.some((i) => i.tipo === tipo) ? "Ningún insumo coincide con el filtro." : "Todavía no hay insumos de este tipo. Carga la base inicial desde el Tablero o crea uno nuevo."}</p>`; return; }
  const par = (et, v) => `<div><span>${esc(et)}</span><strong>${v}</strong></div>`;
  const p = parametrosAnio();
  const datos = [par("Unidad", esc(x.unidad || "—"))];
  const calculo = [];
  if (x.tipo === "MO") {
    const j = jornalMO(x.factorSalarial, p);
    datos.push(par("Factor salarial", numero(x.factorSalarial, 2)));
    if (p) calculo.push(par(`Jornal ${p.anio}`, pesos(j?.jornal)), par(`Prestaciones (${numero(p.prestacional * 100, 0)} %)`, pesos(j?.prestaciones)), par("Total por día", pesos(j?.total)), par("Total por mes", pesos(j?.mensual)));
    else calculo.push(par("Jornal", 'Registra los <a href="parametros.html">parámetros del año</a>'));
  } else {
    if (x.tipo !== "MA") datos.push(par("Base", esc(BASES[x.base] || "Valor mensual")));
    if (x.base === "vidaUtil") datos.push(par("Vida útil", `${numero(x.vidaUtilAnios, 2)} años`));
    datos.push(par("IVA", x.incluyeIva === false ? "Antes de IVA" : "Incluido"));
    const e = x.precio == null ? { clase: "muted", texto: "Sin precio" } : estadoPrecio(x.fechaPrecio);
    calculo.push(par("Precio vigente", pesos(x.precio)), par("Fecha", `${fechaCorta(x.fechaPrecio)} <span class="badge ${e.clase}">${e.texto}${e.meses != null ? ` · ${e.meses} m` : ""}</span>`));
    calculo.push(par("Fuente", x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.fuente || "Enlace")}</a>` : esc(x.fuente || "—")));
    if (x.tipo !== "MA" && x.base !== "unidad") { const m = valorMensual(x); calculo.push(par("Valor mensual", pesos(m)), par(`Valor por día (${p?.diasHabiles || 21} días)`, pesos(m != null ? m / (p?.diasHabiles || 21) : null))); }
  }
  if (x.codigosAnteriores?.length) datos.push(par("Códigos anteriores", esc(x.codigosAnteriores.join(", "))));
  if (x.notaPrecio) datos.push(par("Nota del precio", esc(x.notaPrecio)));
  if (x.notas) datos.push(par("Notas", esc(x.notas)));
  const hist = (x.precios || []).slice(0, 12);
  el.innerHTML = `
    <div class="ap-vp-cabeza">
      <h2>${esc(x.codigo)} — ${esc(x.descripcion)}</h2>
      <div class="rt-acciones">
        ${x.tipo !== "MO" ? '<button type="button" class="btn" id="vpPrecio">💲 Registrar precio</button>' : ""}
        <button type="button" class="btn secondary" id="vpEditar">✎ Editar</button>
        ${ctx.esAdmin ? '<button type="button" class="btn secondary ap-peligro" id="vpEliminar">Eliminar</button>' : ""}
      </div>
    </div>
    <div class="ap-vp-grupos">
      <div class="ap-vp-grupo"><h3>Datos</h3><div class="ap-pares">${datos.join("")}</div></div>
      <div class="ap-vp-grupo"><h3>${x.tipo === "MO" ? `Costo con parámetros ${p?.anio || ""}` : "Precio"}</h3><div class="ap-pares">${calculo.join("")}</div></div>
      ${x.tipo !== "MO" ? `<div class="ap-vp-grupo ap-vp-historial"><h3>Historial de precios (${(x.precios || []).length})</h3>${hist.length ? `<table class="ap-tabla ap-tabla-mini"><thead><tr><th>Fecha</th><th class="ap-num">Valor</th><th>Fuente</th></tr></thead><tbody>${hist.map((h) => `<tr><td>${fechaCorta(h.fecha)}</td><td class="ap-num">${pesos(h.valor)}</td><td title="${esc(h.fuente)}">${h.url ? `<a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer">${esc(h.fuente || "Enlace")}</a>` : esc(h.fuente || "—")}</td></tr>`).join("")}</tbody></table>` : '<p class="text-muted">Sin precios registrados.</p>'}</div>` : ""}
    </div>`;
  el.querySelector("#vpPrecio")?.addEventListener("click", () => abrirPrecio(x));
  el.querySelector("#vpEditar").addEventListener("click", () => abrirInsumo(x));
  el.querySelector("#vpEliminar")?.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar ${x.codigo} — ${x.descripcion}? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarInsumo(x.codigo);
      insumos = insumos.filter((i) => i.codigo !== x.codigo);
      seleccion = null;
      pintarMenu(ctx, { activo: `insumos-${tipo}`, conteos: conteos() });
      pintar();
      mostrarAlerta(alerta, `Se eliminó ${x.codigo}.`, "success");
    } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });
}

// ---------------------------------------------------------------- formularios
function abrirInsumo(x = null) {
  editando = x;
  const dlg = $("insumoDlg");
  limpiarAlerta($("insumoDlgAlerta"));
  $("insumoDlgTitulo").textContent = x ? `Editar ${x.codigo}` : TIPOS[tipo].nuevo;
  dlg.querySelectorAll(".ap-solo").forEach((d) => {
    const visible = d.classList.contains(`ap-solo-${tipo}`) && (!d.classList.contains("ap-solo-nuevo") || !x);
    d.classList.toggle("hidden", !visible);
  });
  $("fCodigo").value = x ? x.codigo : siguienteCodigo(tipo, insumos.map((i) => i.codigo));
  $("fCodigo").disabled = !!x;
  $("fDescripcion").value = x?.descripcion || "";
  $("fUnidad").value = x?.unidad || (tipo === "MO" ? "Día" : "U");
  $("fFactor").value = x?.factorSalarial ?? "";
  $("fBase").value = x?.base || (tipo === "ED" ? "vidaUtil" : "mensual");
  $("fVida").value = x?.vidaUtilAnios ?? "";
  $("fIva").value = x?.incluyeIva === false ? "no" : "si";
  $("fNotas").value = x?.notas || "";
  ["fPrecio", "fFuente", "fUrl"].forEach((id) => { $(id).value = ""; });
  $("fFecha").value = hoyISO();
  dlg.showModal();
}
async function guardarInsumo() {
  const al = $("insumoDlgAlerta");
  const datos = {
    tipo, codigo: $("fCodigo").value.trim().toUpperCase(), descripcion: $("fDescripcion").value.trim(), unidad: $("fUnidad").value.trim(), notas: $("fNotas").value.trim()
  };
  if (!/^[A-Z]{1,3}-\d+$/.test(datos.codigo)) return mostrarAlerta(al, "El código debe tener la forma MA-123, MO-4, EH-10…");
  if (!datos.descripcion || !datos.unidad) return mostrarAlerta(al, "Escribe la descripción y la unidad.");
  if (tipo === "MO") {
    datos.factorSalarial = leerNumero($("fFactor").value);
    if (!(datos.factorSalarial > 0)) return mostrarAlerta(al, "Escribe el factor salarial (por ejemplo 2 para un técnico).");
  } else {
    datos.incluyeIva = $("fIva").value === "si";
    if (tipo !== "MA") {
      datos.base = $("fBase").value;
      datos.vidaUtilAnios = datos.base === "vidaUtil" ? leerNumero($("fVida").value) : null;
      if (datos.base === "vidaUtil" && !(datos.vidaUtilAnios > 0)) return mostrarAlerta(al, "Escribe la vida útil en años (por ejemplo 0,33 para cuatro meses).");
    }
  }
  try {
    if (editando) {
      await actualizarInsumo(editando.codigo, datos, ctx.user);
      Object.assign(editando, datos);
    } else {
      const valor = leerNumero($("fPrecio").value);
      if (tipo !== "MO" && valor != null) {
        if (!$("fFuente").value.trim()) return mostrarAlerta(al, "Indica la fuente del precio.");
        Object.assign(datos, { precio: valor, fechaPrecio: $("fFecha").value, fuente: $("fFuente").value.trim(), url: $("fUrl").value.trim(), precios: [{ valor, fecha: $("fFecha").value, fuente: $("fFuente").value.trim(), url: $("fUrl").value.trim(), registradoPor: ctx.user.email }] });
      }
      await crearInsumo(datos, ctx.user);
      insumos.push({ precios: [], codigosAnteriores: [], ...datos });
      seleccion = datos.codigo;
      pintarMenu(ctx, { activo: `insumos-${tipo}`, conteos: conteos() });
    }
    $("insumoDlg").close();
    pintar();
    mostrarAlerta(alerta, `Se guardó ${datos.codigo}.`, "success");
  } catch (err) { mostrarAlerta(al, errorAmigable(err)); }
}

let precioDe = null;
function abrirPrecio(x) {
  precioDe = x;
  limpiarAlerta($("precioDlgAlerta"));
  $("precioDlgInsumo").textContent = `${x.codigo} — ${x.descripcion} (${x.unidad}). Precio vigente: ${pesos(x.precio)} del ${fechaCorta(x.fechaPrecio)}.`;
  $("pValorEtiqueta").textContent = x.tipo === "MA" ? "Valor por unidad ($)" : x.base === "vidaUtil" ? "Valor de compra ($)" : x.base === "unidad" ? "Valor por unidad ($)" : "Valor mensual ($)";
  $("pValor").value = ""; $("pFecha").value = hoyISO(); $("pFuente").value = ""; $("pUrl").value = "";
  $("pIva").value = x.incluyeIva === false ? "no" : "si";
  $("precioDlg").showModal();
}
async function guardarPrecio() {
  const al = $("precioDlgAlerta");
  const valor = leerNumero($("pValor").value);
  if (!(valor > 0)) return mostrarAlerta(al, "Escribe un valor mayor que cero.");
  if (!$("pFecha").value || !$("pFuente").value.trim()) return mostrarAlerta(al, "Indica la fecha y la fuente del precio.");
  try {
    const datos = await registrarPrecio(precioDe, { valor, fecha: $("pFecha").value, fuente: $("pFuente").value.trim(), url: $("pUrl").value.trim(), incluyeIva: $("pIva").value === "si" }, ctx.user);
    Object.assign(precioDe, datos);
    $("precioDlg").close();
    pintar();
    mostrarAlerta(alerta, `Precio registrado para ${precioDe.codigo}.`, "success");
  } catch (err) { mostrarAlerta(al, errorAmigable(err)); }
}

// ---------------------------------------------------------------- eventos
function conectar() {
  window.addEventListener("hashchange", () => { leerHash(); pintar(); });
  let t = null;
  $("buscar").addEventListener("input", () => { clearTimeout(t); t = setTimeout(pintar, 150); });
  $("filtroEstado").addEventListener("change", pintar);
  $("anioParametros").addEventListener("change", pintar);
  $("tabla").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-codigo]");
    if (!tr) return;
    seleccion = tr.dataset.codigo;
    $("tabla").querySelectorAll("tr.ap-sel").forEach((r) => r.classList.remove("ap-sel"));
    tr.classList.add("ap-sel");
    pintarDetalle();
    document.getElementById("vistaPrevia").scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  $("nuevoBtn").addEventListener("click", () => abrirInsumo());
  $("insumoGuardar").addEventListener("click", guardarInsumo);
  $("precioGuardar").addEventListener("click", guardarPrecio);
  $("insumoForm").addEventListener("submit", (e) => { e.preventDefault(); guardarInsumo(); });
  $("precioForm").addEventListener("submit", (e) => { e.preventDefault(); guardarPrecio(); });
  document.querySelectorAll("dialog").forEach((d) => {
    d.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", () => d.close()));
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  });
}
