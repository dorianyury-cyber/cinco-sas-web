// Página del proyecto, organizada en secciones del menú lateral: Resumen,
// Datos del proyecto, Literales a) a x), Hallazgos (o pendientes) y
// Documentos. La sección visible sale del #hash de la dirección.
import { iniciarPagina, leerProyecto, leerCalculos, actualizarProyecto, eliminarProyecto, calcularProyecto, estadoModulo, clavesDe, tituloCalculo, exportarProyecto, ORDEN_MODULOS, esc, mostrarAlerta, limpiarAlerta, errorAmigable, listarVersiones, guardarVersion, restaurarVersion, fechaCorta } from "./rt-core.js";
import { compararVersiones } from "./rt-versiones.js";
import { MODULOS, AREAS } from "./rt-modulos.js";
import { LITERALES, FUENTE_LITERALES, estadoLiteral, normalizarTipoDiseno } from "./rt-literales.js";
import { hallazgos, supuestos, modoDe, esVerificacion } from "./rt-hallazgos.js";
import { menuProyecto, marcarSeccion, urlCalculo } from "./rt-shell.js";

const ctx = await iniciarPagina();
const id = new URLSearchParams(location.search).get("id");
const alerta = document.getElementById("alerta");
const SECCIONES = ["resumen", "datos", "literales", "hallazgos", "documentos", "versiones"];

if (ctx) {
  const proyecto = id ? await leerProyecto(id) : null;
  if (!proyecto) mostrarAlerta(alerta, "El proyecto no existe o no tienes acceso.");
  else iniciar(proyecto, await leerCalculos(id));
}

function tablaHtml(encabezados, filas, clase = "") {
  return `<div class="tabla-scroll"><table class="rt-tabla-res ${clase}"><thead><tr>${encabezados.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function iniciar(proyecto, guardados) {
  const resultados = calcularProyecto(proyecto, guardados);
  let literales = structuredClone(proyecto.literales || {});
  const aside = menuProyecto(ctx, { proyecto, guardados, resultados, activo: "resumen" });

  // ---- secciones
  function mostrar() {
    const s = SECCIONES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "resumen";
    document.querySelectorAll(".rt-seccion").forEach((el) => el.classList.toggle("visible", el.dataset.seccion === s));
    marcarSeccion(s);
    aside.classList.remove("ip-menu-abierto");
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", mostrar);

  // ---- encabezado
  const pintarEncabezado = () => {
    const modo = modoDe(proyecto);
    document.title = `${proyecto.nombre} — AHÍNCO`;
    document.getElementById("migas").innerHTML = `<span class="rt-modo rt-modo-${esVerificacion(proyecto) ? "verificacion" : "diseno"}">${esc(modo.nombre)}</span> ${esc(proyecto.cliente || "")}`;
    document.getElementById("titulo").textContent = proyecto.nombre;
    document.getElementById("subtitulo").textContent = [proyecto.ubicacion, proyecto.tipoDiseno].filter(Boolean).join(" · ");
  };
  pintarEncabezado();

  // ---- resumen
  function pintarResumen() {
    const modo = modoDe(proyecto);
    const hall = hallazgos(proyecto, resultados);
    const calcs = Object.values(resultados);
    const cumplen = calcs.filter((r) => estadoModulo(r).clase === "ok").length;
    const estados = LITERALES.map((l) => estadoLiteral(l, literales[l.l], resultados, proyecto.tipoDiseno));
    const listos = estados.filter((e) => e.clase !== "warn" && e.texto !== "No aplica sin justificación").length;
    const kpi = (valor, etiqueta, clase = "") => `<div class="rt-kpi ${clase}"><div class="valor">${valor}</div><div class="etiqueta">${esc(etiqueta)}</div></div>`;
    document.getElementById("kpis").innerHTML = kpi(calcs.length, "Cálculos") + kpi(cumplen, "Cumplen", "ok") + kpi(hall.length, modo.hallazgos, hall.length ? "mal" : "ok") + kpi(`${listos}/${LITERALES.length}`, "Literales desarrollados", listos === LITERALES.length ? "ok" : "");
    document.getElementById("tituloHallResumen").textContent = `${modo.hallazgos} principales`;
    document.getElementById("accesoHallTitulo").textContent = modo.hallazgos;
    document.getElementById("accesoHall").textContent = hall.length ? `${hall.length} por resolver` : "Sin incumplimientos";
    document.getElementById("hallResumen").innerHTML = hall.length
      ? `<ul class="rt-hall-lista">${hall.slice(0, 6).map((h) => `<li><span class="rt-hall-cod">${h.codigo}</span><span><strong>${esc(h.criterio)}</strong><small>${esc(h.valor)} frente a ${esc(h.limite)} · ${esc(h.calculo)} · lit. ${esc(h.literales)}</small></span></li>`).join("")}</ul>${hall.length > 6 ? `<p class="rt-nota">y ${hall.length - 6} más.</p>` : ""}`
      : `<p class="rt-vacio">✔ Todos los criterios verificados cumplen.</p>`;
    document.getElementById("chipsLit").innerHTML = LITERALES.map((l, i) => `<a href="#literales" class="rt-chip rt-chip-${estados[i].clase}" title="${l.l}) ${esc(l.texto)} — ${esc(estados[i].texto)}">${l.l}</a>`).join("");
    const orden = Object.values(resultados).sort((a, b) => ORDEN_MODULOS.indexOf(a.modulo) - ORDEN_MODULOS.indexOf(b.modulo));
    document.getElementById("calcResumen").innerHTML = orden.length ? orden.map((r) => {
      const e = estadoModulo(r);
      return `<a class="rt-calc-item ${AREAS[MODULOS[r.modulo].area].clase}" href="${urlCalculo(proyecto.id, r.clave)}"><span class="rt-modulo-icono">${MODULOS[r.modulo].icono}</span><span class="rt-calc-texto"><strong>${esc(MODULOS[r.modulo].titulo)}</strong><small>${esc(r.etiqueta || AREAS[MODULOS[r.modulo].area].nombre)}</small></span><span class="badge ${e.clase}">${esc(e.texto)}</span></a>`;
    }).join("") : `<p class="rt-vacio">Este proyecto todavía no tiene cálculos. Use «＋ Agregar cálculo».</p>`;
  }
  document.getElementById("agregarDesdeResumen").addEventListener("click", (e) => { e.preventDefault(); document.getElementById("rtSelector").showModal(); });

  // ---- datos del proyecto
  const form = document.getElementById("datosForm");
  form.querySelectorAll("[data-p]").forEach((el) => { el.value = el.dataset.p === "tipoDiseno" ? normalizarTipoDiseno(proyecto.tipoDiseno) : proyecto[el.dataset.p] ?? ""; });
  const radios = document.querySelectorAll('input[name="modo"]');
  const pintarModo = (modo) => {
    radios.forEach((r) => { r.checked = r.value === modo; r.closest(".rt-modo-op").classList.toggle("activo", r.value === modo); });
    document.body.classList.toggle("rt-verificacion", modo === "verificacion");
    document.getElementById("lblFirma").textContent = modo === "verificacion" ? "Interventor que verifica (firma el documento)" : "Diseñador (ingeniero responsable)";
  };
  pintarModo(esVerificacion(proyecto) ? "verificacion" : "diseno");
  radios.forEach((r) => r.addEventListener("change", () => pintarModo(r.value)));
  document.getElementById("guardarDatosBtn").addEventListener("click", async () => {
    const datos = { modo: document.querySelector('input[name="modo"]:checked')?.value || "diseno" };
    form.querySelectorAll("[data-p]").forEach((el) => { datos[el.dataset.p] = el.type === "number" ? Number(el.value) || 0 : el.value.trim(); });
    if (!datos.nombre) { mostrarAlerta(alerta, "El proyecto debe tener nombre."); return; }
    try {
      await actualizarProyecto(proyecto.id, datos, ctx.user);
      Object.assign(proyecto, datos);
      pintarEncabezado(); pintarResumen(); pintarHallazgos(); pintarDocumentos();
      menuProyecto(ctx, { proyecto, guardados, resultados, activo: "datos" });
      mostrarAlerta(alerta, "Datos guardados.", "success");
    } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });
  document.getElementById("eliminarBtn").addEventListener("click", async () => {
    if (!confirm(`¿Eliminar el proyecto «${proyecto.nombre}» con todos sus cálculos? No se puede deshacer.`)) return;
    try { await eliminarProyecto(proyecto.id); window.location.href = "inicio.html"; } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });

  // ---- literales a) a x)
  document.getElementById("fuenteLiterales").textContent = `Fuente: ${FUENTE_LITERALES}.`;
  const tabla = document.getElementById("literales");
  const estadoLit = document.getElementById("estadoLit");
  const badgeMod = (m) => {
    const claves = clavesDe(m, guardados);
    if (!claves.length) return `<span class="rt-lit-calc rt-lit-calc-nulo">${MODULOS[m].icono} ${esc(MODULOS[m].titulo)}</span>`;
    return claves.map((k) => { const e = estadoModulo(resultados[k]); return `<a class="rt-lit-calc" href="${urlCalculo(proyecto.id, k)}"><span class="rt-punto rt-punto-${e.clase === "ok" ? "ok" : e.clase === "danger" ? "mal" : "nulo"}"></span>${esc(tituloCalculo(resultados[k]))}</a>`; }).join("");
  };
  function pintarLiterales() {
    tabla.innerHTML = `<colgroup><col data-ancho="4"><col data-ancho="28"><col data-ancho="22"><col data-ancho="8"><col data-ancho="38"></colgroup>
      <thead><tr><th>Lit.</th><th>Contenido exigido por el RETIE</th><th>Cálculos</th><th>Aplica</th><th>Desarrollo / justificación si no aplica</th></tr></thead>
      <tbody>${LITERALES.map((lit) => {
        const d = literales[lit.l] || {};
        const e = estadoLiteral(lit, d, resultados, proyecto.tipoDiseno);
        return `<tr><td><strong>${lit.l})</strong><br><span class="rt-punto rt-punto-${e.clase === "ok" ? "ok" : e.clase === "danger" ? "mal" : e.clase === "warn" ? "pend" : "nulo"}" title="${esc(e.texto)}"></span></td>
          <td>${esc(lit.texto)}${lit.guia ? `<span class="rt-nota">${esc(lit.guia)}</span>` : ""}</td>
          <td>${lit.modulos.length ? lit.modulos.map(badgeMod).join("") : '<span class="text-muted">Desarrollo escrito</span>'}<span class="badge ${e.clase}">${esc(e.texto)}</span></td>
          <td><select data-l="${lit.l}" data-c="aplica"><option${d.aplica !== "No" ? " selected" : ""}>Sí</option><option${d.aplica === "No" ? " selected" : ""}>No</option></select></td>
          <td><textarea data-l="${lit.l}" data-c="texto" rows="3" placeholder="${d.aplica === "No" ? "Razón por la que no aplica" : lit.modulos.length ? "Texto complementario (opcional)" : "Desarrollo del literal"}">${esc(d.texto || "")}</textarea></td></tr>`;
      }).join("")}</tbody>`;
    tabla.querySelectorAll("col[data-ancho]").forEach((c) => { c.style.width = `${c.dataset.ancho}%`; });
  }
  const pendiente = () => { estadoLit.textContent = "● Cambios sin guardar"; estadoLit.className = "rt-estado-guardado pendiente"; };
  tabla.addEventListener("change", (e) => {
    const el = e.target;
    if (!el.dataset.l) return;
    literales[el.dataset.l] = { ...(literales[el.dataset.l] || {}), [el.dataset.c]: el.value };
    pendiente();
    if (el.dataset.c === "aplica") pintarLiterales();
  });
  tabla.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.l && el.dataset.c === "texto") { literales[el.dataset.l] = { ...(literales[el.dataset.l] || {}), texto: el.value }; pendiente(); }
  });
  document.getElementById("guardarLitBtn").addEventListener("click", async () => {
    try {
      await actualizarProyecto(proyecto.id, { literales }, ctx.user);
      proyecto.literales = structuredClone(literales);
      estadoLit.textContent = "Guardado"; estadoLit.className = "rt-estado-guardado";
      pintarLiterales(); pintarResumen(); pintarHallazgos();
    } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });

  // ---- hallazgos y supuestos
  function pintarHallazgos() {
    const verif = esVerificacion(proyecto), modo = modoDe(proyecto);
    const hall = hallazgos(proyecto, resultados), sup = supuestos({ ...proyecto, literales }, guardados);
    document.getElementById("tituloHall").textContent = modo.hallazgos;
    document.getElementById("introHall").textContent = verif
      ? "Cada criterio que no cumple en los cálculos es un hallazgo de la interventoría sobre el diseño revisado. La tabla sale también al inicio del informe PDF y Word, lista para el oficio al contratista."
      : "Criterios que todavía no cumplen. Corríjalos en cada cálculo antes de entregar la memoria.";
    document.getElementById("tablaHall").innerHTML = hall.length
      ? tablaHtml(["N.º", "Cálculo", "Criterio", "Valor", "Límite", "Norma", "Lit."], hall.map((h) => [`<strong>${h.codigo}</strong>`, `<a href="${urlCalculo(proyecto.id, h.clave)}">${esc(h.calculo)}</a>`, esc(h.criterio), esc(h.valor), esc(h.limite), esc(h.norma), esc(h.literales)]), "rt-tabla-hall")
      : `<p class="rt-vacio">✔ Todos los criterios verificados cumplen.</p>`;
    document.getElementById("introSup").textContent = verif
      ? "Valores marcados con «(S)» en los literales y en los cálculos: son supuestos de la interventoría y deben confirmarse con el contratista o el operador de red."
      : "Valores marcados con «(S)»: confírmelos antes de firmar la memoria.";
    document.getElementById("tablaSup").innerHTML = sup.length
      ? tablaHtml(["Origen", "Supuesto"], sup.map((s) => [esc(s.origen), esc(s.texto)]), "rt-tabla-sup")
      : `<p class="rt-vacio">No hay valores marcados con «(S)».</p>`;
  }

  // ---- documentos
  function pintarDocumentos() {
    document.getElementById("descPdf").textContent = esVerificacion(proyecto)
      ? "Informe de verificación de la memoria de cálculo: tabla de hallazgos al inicio y desarrollo por literales a) a x)."
      : "Memoria de cálculo completa, organizada por los literales a) a x), lista para radicar.";
  }
  const pendientesSinJustificar = () => LITERALES.filter((l) => literales[l.l]?.aplica === "No" && !(literales[l.l]?.texto || "").trim()).map((l) => `${l.l})`);
  async function generar(tipo, btn) {
    limpiarAlerta(alerta);
    if (!Object.keys(resultados).length && tipo !== "excel" && tipo !== "verExcel") { mostrarAlerta(alerta, "Todavía no hay cálculos guardados en este proyecto."); return; }
    const sinJust = pendientesSinJustificar();
    if (tipo !== "verMemoria" && tipo !== "verExcel" && sinJust.length && !confirm(`Los literales ${sinJust.join(", ")} están marcados «No aplica» sin justificación (el RETIE exige mencionarla). ¿Generar de todas formas?`)) return;
    btn.disabled = true; btn.classList.add("generando");
    try {
      const datos = { proyecto: { ...proyecto, literales }, resultados, guardados };
      if (tipo === "verMemoria") {
        const [{ verPdf }, M] = await Promise.all([import("./rt-visor.js"), import("./rt-memoria.js")]);
        await verPdf({ titulo: `Vista previa — ${proyecto.nombre}`, generar: () => M.pdfMemoria(datos), nombre: M.nombreMemoria(datos), acciones: [{ texto: "⬇ Word", fn: () => M.descargarMemoria(datos, "word") }] });
      } else if (tipo === "verExcel") {
        const [{ verLibro }, X] = await Promise.all([import("./rt-visor.js"), import("./rt-excel.js")]);
        await verLibro(await X.construirLibro(datos), X.nombreExcel(datos));
      } else if (tipo === "excel") {
        const { descargarExcel } = await import("./rt-excel.js");
        await descargarExcel(datos);
      } else {
        const { descargarMemoria } = await import("./rt-memoria.js");
        await descargarMemoria(datos, tipo);
      }
    } catch (err) {
      console.error(err);
      mostrarAlerta(alerta, `No se pudo generar: ${errorAmigable(err)}`);
    } finally {
      btn.disabled = false; btn.classList.remove("generando");
    }
  }
  // ---- versiones: copias del proyecto para comparar, ver su memoria o restaurar
  let versiones = [];
  const actual = () => ({ proyecto: { ...proyecto, literales }, calculos: guardados });
  const hallazgosDe = (p, g) => hallazgos(p, calcularProyecto(p, g));
  const nombreV = (v) => `V${v.numero}${v.nota ? ` — ${v.nota}` : ""} (${fechaCorta(v.creadoEn)})`;
  const descargarJson = (obj, nombre) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" }));
    a.download = nombre.replace(/[\\/:*?"<>|]/g, "-"); document.body.appendChild(a); a.click(); a.remove();
  };
  async function pintarVersiones() {
    const lista = document.getElementById("listaVersiones");
    try { versiones = await listarVersiones(proyecto.id); } catch (err) { lista.innerHTML = `<p class="alert error">${esc(errorAmigable(err))}</p>`; return; }
    const modo = modoDe(proyecto);
    document.getElementById("ultimaVersion").textContent = versiones.length ? nombreV(versiones[0]) : "Sin versiones guardadas";
    lista.innerHTML = versiones.length
      ? tablaHtml(["N.º", "Fecha", "Autor", "Nota", "Cálculos", modo.hallazgos, "Acciones"], versiones.map((v) => [`<b>V${v.numero}</b>`, esc(fechaCorta(v.creadoEn)), esc(v.creadoPor || ""), esc(v.nota || "—"), String(Object.keys(v.calculos || {}).length), String(v.resumen?.hallazgos ?? "—"),
        `<span class="rt-version-acciones"><button type="button" data-vcomp="${esc(v.id)}">Comparar con la actual</button><button type="button" data-vver="${esc(v.id)}">Ver memoria</button><button type="button" data-vexp="${esc(v.id)}">Exportar</button><button type="button" data-vres="${esc(v.id)}">Restaurar</button></span>`]), "rt-tabla-versiones")
      : '<p class="rt-vacio">Todavía no hay versiones guardadas.</p>';
    const opciones = ['<option value="actual">Estado actual</option>', ...versiones.map((v) => `<option value="${esc(v.id)}">${esc(nombreV(v))}</option>`)].join("");
    const a = document.getElementById("compA"), b = document.getElementById("compB");
    a.innerHTML = opciones; b.innerHTML = opciones;
    a.value = versiones[0]?.id || "actual"; b.value = "actual";
  }
  const snapshot = (vid) => (vid === "actual" ? actual() : (() => { const v = versiones.find((x) => x.id === vid); return { proyecto: { ...v.proyecto, id: proyecto.id }, calculos: v.calculos || {} }; })());
  const etiquetaDe = (vid) => (vid === "actual" ? "estado actual" : `V${versiones.find((x) => x.id === vid)?.numero}`);
  function pintarComparacion(aId, bId) {
    const r = compararVersiones(snapshot(aId), snapshot(bId), { hallazgosDe });
    const modo = modoDe(proyecto), cont = document.getElementById("resultadoComparacion");
    const lista = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>`;
    const h = r.hallazgos;
    cont.innerHTML = `<p class="text-muted">De <b>${esc(etiquetaDe(aId))}</b> a <b>${esc(etiquetaDe(bId))}</b>.</p>
      <div class="rt-comp-kpis"><div class="rt-kpi"><div class="valor">${h.antes} → ${h.despues}</div><div class="etiqueta">${esc(modo.hallazgos)}</div></div><div class="rt-kpi ok"><div class="valor">${h.cerrados.length}</div><div class="etiqueta">Cerrados</div></div><div class="rt-kpi ${h.nuevos.length ? "mal" : ""}"><div class="valor">${h.nuevos.length}</div><div class="etiqueta">Nuevos</div></div><div class="rt-kpi"><div class="valor">${r.cambiados.length + r.agregados.length + r.quitados.length}</div><div class="etiqueta">Cálculos con cambios</div></div></div>
      ${h.cerrados.length ? `<div class="rt-comp-bloque"><h3 class="rt-comp-cerrado">✔ ${esc(modo.hallazgos)} cerrados</h3>${lista(h.cerrados.map((x) => `<b>${esc(x.calculo)}</b>: ${esc(x.criterio)} (${esc(x.valor)}; límite ${esc(x.limite)})`))}</div>` : ""}
      ${h.nuevos.length ? `<div class="rt-comp-bloque"><h3 class="rt-comp-nuevo">✖ ${esc(modo.hallazgos)} nuevos</h3>${lista(h.nuevos.map((x) => `<b>${esc(x.calculo)}</b>: ${esc(x.criterio)} (${esc(x.valor)}; límite ${esc(x.limite)})`))}</div>` : ""}
      ${h.siguen.length ? `<div class="rt-comp-bloque"><h3>Siguen abiertos (${h.siguen.length})</h3>${lista(h.siguen.map((x) => `${esc(x.calculo)}: ${esc(x.criterio)}`))}</div>` : ""}
      ${r.sinCambios ? '<p class="rt-vacio">No hay diferencias en los datos.</p>' : ""}
      ${r.proyecto.length ? `<div class="rt-comp-bloque"><h3>Datos del proyecto</h3>${tablaHtml(["Dato", "Antes", "Después"], r.proyecto.map((x) => [esc(x.campo), esc(x.antes), esc(x.despues)]))}</div>` : ""}
      ${r.literales.length ? `<div class="rt-comp-bloque"><h3>Literales</h3>${lista(r.literales.map((x) => `${esc(x.literal)}) ${esc(x.cambio)}`))}</div>` : ""}
      ${r.agregados.length ? `<div class="rt-comp-bloque"><h3>Cálculos agregados</h3>${lista(r.agregados.map(esc))}</div>` : ""}
      ${r.quitados.length ? `<div class="rt-comp-bloque"><h3>Cálculos quitados</h3>${lista(r.quitados.map(esc))}</div>` : ""}
      ${r.cambiados.map((c) => `<div class="rt-comp-bloque"><h3>${esc(c.titulo)}</h3>
        ${c.campos.length ? tablaHtml(["Dato", "Antes", "Después"], c.campos.map((x) => [esc(x.campo), esc(x.antes), esc(x.despues)])) : ""}
        ${c.tablas.map((t) => `<p><b>${esc(t.tabla)}</b>: ${t.antes} → ${t.despues} filas${t.celdas.length ? `; ${t.celdas.length} celda${t.celdas.length === 1 ? "" : "s"} cambiada${t.celdas.length === 1 ? "" : "s"}` : ""}.</p>${t.celdas.length ? tablaHtml(["Fila", "Columna", "Antes", "Después"], t.celdas.slice(0, 40).map((x) => [String(x.fila), esc(x.columna), esc(x.antes), esc(x.despues)])) : ""}`).join("")}</div>`).join("")}`;
  }
  document.getElementById("guardarVersionBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget; btn.disabled = true; limpiarAlerta(alerta);
    try {
      const n = await guardarVersion(proyecto.id, { ...proyecto, literales }, guardados, ctx.user, document.getElementById("notaVersion").value.trim(), { calculos: Object.keys(guardados).length, hallazgos: hallazgos(proyecto, resultados).length });
      document.getElementById("notaVersion").value = "";
      mostrarAlerta(alerta, `Versión V${n} guardada.`, "success");
      await pintarVersiones();
    } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); } finally { btn.disabled = false; }
  });
  document.getElementById("compararBtn").addEventListener("click", () => pintarComparacion(document.getElementById("compA").value, document.getElementById("compB").value));
  document.getElementById("listaVersiones").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const v = versiones.find((x) => x.id === (b.dataset.vcomp || b.dataset.vver || b.dataset.vexp || b.dataset.vres));
    if (!v) return;
    limpiarAlerta(alerta);
    if (b.dataset.vcomp) { document.getElementById("compA").value = v.id; document.getElementById("compB").value = "actual"; pintarComparacion(v.id, "actual"); document.getElementById("resultadoComparacion").scrollIntoView({ behavior: "smooth" }); }
    if (b.dataset.vexp) descargarJson(exportarProyecto(v.proyecto, v.calculos || {}), `${proyecto.nombre} - V${v.numero}.ahinco.json`);
    if (b.dataset.vver) {
      try {
        const [{ verPdf }, M] = await Promise.all([import("./rt-visor.js"), import("./rt-memoria.js")]);
        const p = { ...v.proyecto, id: proyecto.id }, datos = { proyecto: p, resultados: calcularProyecto(p, v.calculos || {}), guardados: v.calculos || {} };
        await verPdf({ titulo: `Memoria de la versión V${v.numero}${v.nota ? ` — ${v.nota}` : ""}`, generar: () => M.pdfMemoria(datos), nombre: M.nombreMemoria(datos).replace(/\.pdf$/, ` - V${v.numero}.pdf`), acciones: [{ texto: "⬇ Word", fn: () => M.descargarMemoria(datos, "word") }] });
      } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
    }
    if (b.dataset.vres) {
      if (!confirm(`¿Restaurar la versión V${v.numero}? Los datos y cálculos actuales se reemplazan por los de esa versión; antes se guarda una copia del estado actual como versión nueva.`)) return;
      b.disabled = true;
      try {
        await guardarVersion(proyecto.id, { ...proyecto, literales }, guardados, ctx.user, `Copia automática antes de restaurar la V${v.numero}`, { calculos: Object.keys(guardados).length, hallazgos: hallazgos(proyecto, resultados).length });
        await restaurarVersion(proyecto.id, v, guardados, ctx.user);
        location.reload();
      } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); b.disabled = false; }
    }
  });
  pintarVersiones();

  document.getElementById("verMemoriaBtn").addEventListener("click", (e) => generar("verMemoria", e.currentTarget));
  document.getElementById("verExcelBtn").addEventListener("click", (e) => generar("verExcel", e.currentTarget));
  document.getElementById("pdfBtn").addEventListener("click", (e) => generar("pdf", e.currentTarget));
  document.getElementById("wordBtn").addEventListener("click", (e) => generar("word", e.currentTarget));
  document.getElementById("excelBtn").addEventListener("click", (e) => generar("excel", e.currentTarget));
  document.getElementById("exportarBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(exportarProyecto({ ...proyecto, literales }, guardados), null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${String(proyecto.nombre || "proyecto").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.ahinco.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  pintarResumen(); pintarLiterales(); pintarHallazgos(); pintarDocumentos();
  mostrar();
}
