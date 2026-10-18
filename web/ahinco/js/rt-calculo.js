// Página de un módulo de cálculo: formulario generado desde rt-modulos.js,
// cálculo en vivo (rt-calculos.js) y guardado en rtProyectos/{id}/calculos.
// Con ?rapido=1&m=módulo es un cálculo rápido: sin proyecto, con borrador en
// el navegador, salidas de ese solo cálculo y opción de guardarlo en un proyecto.
import { iniciarPagina, leerProyecto, leerCalculos, guardarCalculo, eliminarCalculo, calcularProyecto, moduloDe, nuevaClave, esc, mostrarAlerta, limpiarAlerta, errorAmigable, listarProyectos, crearProyecto, tituloCalculo } from "./rt-core.js";
import { MODULOS, AREAS, entradasPorDefecto } from "./rt-modulos.js";
import { svgTCC } from "./rt-grafico.js";
import { menuProyecto, menuInicio } from "./rt-shell.js";
import { ALCANCE } from "./rt-alcance.js";

const ctx = await iniciarPagina();
const params = new URLSearchParams(location.search);
// k = clave del cálculo ("aislamiento" o "aislamiento-2"); m + nuevo=1 = otro cálculo del módulo.
const id = params.get("id"), mid = params.get("k") ? moduloDe(params.get("k")) : params.get("m");
const mod = MODULOS[mid];
const alerta = document.getElementById("alerta");
const rapido = params.get("rapido") === "1";
// Borrador del cálculo rápido en este navegador (si el almacenamiento no está disponible, no pasa nada).
const BORRADOR = `ahinco-rapido-${mid}`;
const leerBorrador = () => { try { return JSON.parse(localStorage.getItem(BORRADOR) || "null"); } catch { return null; } };
const escribirBorrador = (d) => { try { localStorage.setItem(BORRADOR, JSON.stringify(d)); } catch { /* sin almacenamiento */ } };
const borrarBorrador = () => { try { localStorage.removeItem(BORRADOR); } catch { /* sin almacenamiento */ } };

if (ctx && rapido) {
  if (!mod) mostrarAlerta(alerta, "Elija un cálculo en «Cálculo rápido».");
  else {
    const b = leerBorrador();
    const proyecto = { id: null, nombre: "Cálculo rápido", modo: "diseno", altitud: b?.altitud ?? 1000, tempAmbiente: b?.tempAmbiente ?? 30, tipoDiseno: "Cálculo rápido", disenador: ctx.perfil?.nombre || ctx.user.email, matricula: "", literales: {} };
    iniciar(proyecto, b?.entradas ? { [mid]: { entradas: b.entradas, etiqueta: b.etiqueta || "" } } : {}, true);
  }
} else if (ctx && (!id || !mod)) {
  mostrarAlerta(alerta, "Falta el proyecto o el módulo. Vuelve a la lista de proyectos.");
} else if (ctx) {
  const proyecto = await leerProyecto(id);
  if (!proyecto) {
    mostrarAlerta(alerta, "El proyecto no existe o no tienes acceso.");
  } else {
    iniciar(proyecto, await leerCalculos(id));
  }
}

function iniciar(proyecto, guardados, esRapido = false) {
  const clave = esRapido ? mid : params.get("k") || (params.get("nuevo") ? nuevaClave(mid, guardados) : mid);
  document.title = `${mod.titulo}${esRapido ? " (cálculo rápido)" : ""} — AHÍNCO`;
  document.getElementById("migas").innerHTML = esRapido
    ? `<a href="rapido.html">Cálculo rápido</a> › ${esc(AREAS[mod.area].nombre)}`
    : `<a href="proyecto.html?id=${encodeURIComponent(proyecto.id)}#resumen">${esc(proyecto.nombre)}</a> › ${esc(AREAS[mod.area].nombre)}`;
  const pintarMenu = () => (esRapido ? menuInicio(ctx, { activo: "rapido" }) : menuProyecto(ctx, { proyecto, guardados, resultados: calcularProyecto(proyecto, guardados), activo: clave }));
  pintarMenu();
  document.getElementById("titulo").textContent = `${mod.icono} ${mod.titulo}`;
  document.getElementById("objeto").textContent = mod.objeto;
  document.getElementById("normas").textContent = `Normas: ${mod.normas.join(" · ")}`;
  const estado = document.getElementById("estadoGuardado");
  const avisoEj = document.getElementById("avisoEjemplo");

  // Un cálculo nuevo del mismo módulo parte de los datos del primero.
  const origen = guardados[clave] || (clave !== mid ? guardados[mid] : null);
  let entradas = origen?.entradas ? structuredClone(origen.entradas) : entradasPorDefecto(mid);
  const etiquetaEl = document.getElementById("etiqueta");
  etiquetaEl.value = guardados[clave]?.etiqueta || "";
  etiquetaEl.addEventListener("input", () => marcar(true));
  const btnEliminar = document.getElementById("eliminarCalcBtn");
  btnEliminar.classList.toggle("hidden", !guardados[clave]);
  // Campos nuevos que no existían cuando se guardó: toman el valor por defecto.
  mod.campos.forEach((c) => { if (entradas[c.key] === undefined) entradas[c.key] = entradasPorDefecto(mid)[c.key]; });
  avisoEj.classList.toggle("hidden", !!origen || esRapido);
  let sinGuardar = false;
  const marcar = (v) => {
    if (esRapido) { if (v) guardarBorrador(); estado.textContent = "Borrador en este navegador"; estado.className = "rt-estado-guardado"; return; }
    sinGuardar = v; estado.textContent = v ? "● Cambios sin guardar" : guardados[clave] ? "Guardado" : "Sin guardar"; estado.className = `rt-estado-guardado${v ? " pendiente" : ""}`;
  };
  const guardarBorrador = () => escribirBorrador({ entradas, etiqueta: etiquetaEl.value.trim(), altitud: proyecto.altitud, tempAmbiente: proyecto.tempAmbiente });
  marcar(false);
  window.addEventListener("beforeunload", (e) => { if (sinGuardar) { e.preventDefault(); e.returnValue = ""; } });

  const contCampos = document.getElementById("campos");
  const resultados = document.getElementById("resultados");

  const opciones = (c, valor) => c.opciones.map((o) => `<option value="${esc(o.valor)}"${String(o.valor) === String(valor ?? "") ? " selected" : ""}>${esc(o.texto)}</option>`).join("");
  function campoSimple(c) {
    const v = entradas[c.key];
    const unidad = c.unidad ? ` <span class="rt-unidad">(${esc(c.unidad)})</span>` : "";
    const control = c.tipo === "select"
      ? `<select data-k="${c.key}">${opciones(c, v)}</select>`
      : `<input data-k="${c.key}" ${c.tipo === "numero" ? 'type="number" step="any"' : 'type="text"'} value="${esc(v)}">`;
    return `<div class="rt-campo" data-campo="${c.key}"><label>${esc(c.label)}${unidad}${control}</label></div>`;
  }
  function campoTabla(c) {
    const filas = entradas[c.key] || [];
    const total = c.columnas.reduce((s, col) => s + (col.ancho || 10), 0) + 3;
    return `<div class="rt-tabla-campo" data-campo="${c.key}"><label>${esc(c.label)}</label>
      <div class="rt-tabla-scroll"><table class="rt-tabla-edit"><colgroup>${c.columnas.map((col) => `<col data-ancho="${((col.ancho || 10) / total) * 100}">`).join("")}<col data-ancho="${(3 / total) * 100}"></colgroup>
      <thead><tr>${c.columnas.map((col) => `<th>${esc(col.label)}</th>`).join("")}<th></th></tr></thead>
      <tbody>${filas.map((f, i) => `<tr>${c.columnas.map((col) => `<td>${col.tipo === "select"
        ? `<select data-t="${c.key}" data-i="${i}" data-c="${col.key}">${opciones(col, f[col.key])}</select>`
        : `<input data-t="${c.key}" data-i="${i}" data-c="${col.key}" ${col.tipo === "numero" ? 'type="number" step="any"' : 'type="text"'} value="${esc(f[col.key])}">`}</td>`).join("")}
        <td><button type="button" class="rt-quitar" data-quitar="${c.key}" data-i="${i}" title="Quitar fila">✕</button></td></tr>`).join("")}</tbody></table></div>
      <button type="button" class="rt-agregar" data-agregar="${c.key}">+ Agregar fila</button></div>`;
  }
  function pintarCampos() {
    contCampos.innerHTML = mod.campos.map((c) => (c.tipo === "tabla" ? campoTabla(c) : campoSimple(c))).join("");
    contCampos.querySelectorAll("col[data-ancho]").forEach((col) => { col.style.width = `${col.dataset.ancho}%`; });
    visibilidad();
  }
  function visibilidad() {
    mod.campos.filter((c) => c.soloSi).forEach((c) => {
      const [k, v] = Object.entries(c.soloSi)[0];
      contCampos.querySelector(`[data-campo="${c.key}"]`)?.classList.toggle("rt-oculto", String(entradas[k]) !== String(v));
    });
  }
  const leer = (el) => (el.type === "number" ? (el.value === "" ? "" : Number(el.value)) : el.value);
  contCampos.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.k) entradas[el.dataset.k] = leer(el);
    else if (el.dataset.t) entradas[el.dataset.t][Number(el.dataset.i)][el.dataset.c] = leer(el);
    else return;
    marcar(true);
    visibilidad();
    recalcular();
  });
  contCampos.addEventListener("click", (e) => {
    const ag = e.target.closest("[data-agregar]"), qu = e.target.closest("[data-quitar]");
    if (ag) {
      const c = mod.campos.find((x) => x.key === ag.dataset.agregar);
      entradas[c.key] = [...(entradas[c.key] || []), { ...(c.nueva || {}) }];
    } else if (qu) {
      entradas[qu.dataset.quitar].splice(Number(qu.dataset.i), 1);
    } else return;
    marcar(true);
    pintarCampos();
    recalcular();
  });

  function tablaHtml(t) {
    return `<h3>${esc(t.titulo)}</h3><div class="tabla-scroll"><table class="rt-tabla-res"><thead><tr>${t.encabezados.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.filas.map((f) => `<tr>${f.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function recalcular() {
    const res = calcularProyecto(proyecto, guardados, { sobrescribir: { [clave]: entradas } })[clave];
    if (!res) { resultados.innerHTML = ""; return; }
    const fallan = (res.verificaciones || []).filter((v) => v.cumple === false).length;
    resultados.innerHTML = `
      <h2>Resultados</h2>
      ${res.error ? `<div class="alert error">${esc(res.error)}</div>` : ""}
      <div class="rt-resumen">${(res.resumen || []).map((r) => `<div class="rt-resumen-item"><div class="valor">${esc(r.valor)} <span class="rt-unidad">${esc(r.unidad)}</span></div><div class="etiqueta">${esc(r.etiqueta)}</div></div>`).join("")}</div>
      <div class="rt-conclusion ${fallan || res.error ? "mal" : "ok"}">${esc(res.conclusion || "")}</div>
      ${ALCANCE[mid] ? `<details class="rt-alcance"><summary>⚠ Alcance y limitaciones de este cálculo (léalas antes de usar el resultado)</summary><p>${esc(ALCANCE[mid].metodo)}</p><ul>${ALCANCE[mid].limitaciones.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><p class="rt-nota"><a href="acerca.html">Ver el alcance y la validación de AHÍNCO →</a></p></details>` : ""}
      ${(res.verificaciones || []).length ? tablaHtml({ titulo: "Verificaciones", encabezados: ["Criterio", "Norma", "Valor", "Límite", "Resultado"], filas: res.verificaciones.map((v) => [v.criterio, v.norma, v.valor, v.limite, v.cumple ? "✔ Cumple" : "✖ No cumple"]) }) : ""}
      ${res.grafico?.tipo === "tcc" ? `<h3>Curvas tiempo-corriente</h3><div class="rt-grafico">${svgTCC(res.grafico)}</div>` : ""}
      ${(res.tablas || []).map(tablaHtml).join("")}
      <h3>Cálculos</h3>${(res.pasos || []).map((p) => `<div class="rt-paso"><strong>${esc(p.titulo)}</strong><span class="rt-formula">${esc(p.formula)}</span><span class="text-muted">${esc(p.sustitucion)}</span><span>${esc(p.resultado)}</span></div>`).join("")}
      ${(res.notas || []).map((n) => `<p class="rt-nota">ℹ️ ${esc(n)}</p>`).join("")}`;
  }

  if (esRapido) conectarRapido({ proyecto, clave, obtener: () => ({ entradas, etiqueta: etiquetaEl.value.trim() }), recalcular, marcar });
  document.getElementById("guardarBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    limpiarAlerta(alerta);
    try {
      const etiqueta = etiquetaEl.value.trim();
      await guardarCalculo(proyecto.id, clave, entradas, ctx.user, etiqueta);
      guardados[clave] = { entradas: structuredClone(entradas), etiqueta };
      btnEliminar.classList.remove("hidden");
      pintarMenu();
      if (!params.get("k")) history.replaceState(null, "", `calculo.html?id=${encodeURIComponent(proyecto.id)}&k=${encodeURIComponent(clave)}`);
      avisoEj.classList.add("hidden");
      marcar(false);
      mostrarAlerta(alerta, "Cálculo guardado.", "success");
    } catch (err) {
      mostrarAlerta(alerta, errorAmigable(err));
    } finally {
      btn.disabled = false;
    }
  });
  btnEliminar.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este cálculo del proyecto? No se puede deshacer.")) return;
    try {
      await eliminarCalculo(proyecto.id, clave, ctx.user);
      sinGuardar = false;
      window.location.href = `proyecto.html?id=${encodeURIComponent(proyecto.id)}#resumen`;
    } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });
  document.getElementById("ejemploBtn").addEventListener("click", () => {
    if (!confirm(esRapido ? "¿Reemplazar los datos del formulario por los valores de ejemplo?" : "¿Reemplazar los datos del formulario por los valores de ejemplo? No se guarda hasta que pulses «Guardar».")) return;
    entradas = entradasPorDefecto(mid);
    marcar(true);
    pintarCampos();
    recalcular();
  });

  pintarCampos();
  recalcular();
}

// ---------------------------------------------------------------- cálculo rápido
function conectarRapido({ proyecto, clave, obtener, recalcular, marcar }) {
  ["guardarBtn", "eliminarCalcBtn"].forEach((b) => document.getElementById(b).classList.add("hidden"));
  document.getElementById("rapidoBarra").classList.remove("hidden");
  const alt = document.getElementById("rAltitud"), tmp = document.getElementById("rTemp");
  alt.value = proyecto.altitud; tmp.value = proyecto.tempAmbiente;
  const sitio = () => { proyecto.altitud = Number(alt.value) || 0; proyecto.tempAmbiente = Number(tmp.value) || 30; marcar(true); recalcular(); };
  alt.addEventListener("input", sitio); tmp.addEventListener("input", sitio);
  // Datos para los generadores de documentos: un proyecto con este único cálculo.
  const datos = () => {
    const { entradas, etiqueta } = obtener();
    const guardados = { [clave]: { entradas: structuredClone(entradas), etiqueta } };
    const resultados = calcularProyecto(proyecto, guardados);
    const nombre = tituloCalculo(resultados[clave]);
    return { proyecto: { ...proyecto, nombre }, resultados, guardados, rapido: true };
  };
  const generar = async (tipo, btn) => {
    limpiarAlerta(alerta);
    btn.disabled = true; btn.classList.add("generando");
    try {
      if (tipo === "excel") { const { descargarExcel } = await import("./rt-excel.js"); await descargarExcel(datos()); }
      else { const { descargarCalculo } = await import("./rt-memoria.js"); await descargarCalculo(datos(), tipo); }
    } catch (err) { console.error(err); mostrarAlerta(alerta, `No se pudo generar: ${errorAmigable(err)}`); }
    finally { btn.disabled = false; btn.classList.remove("generando"); }
  };
  document.getElementById("rPdf").addEventListener("click", (e) => generar("pdf", e.currentTarget));
  document.getElementById("rWord").addEventListener("click", (e) => generar("word", e.currentTarget));
  document.getElementById("rExcel").addEventListener("click", (e) => generar("excel", e.currentTarget));
  // Guardar en un proyecto existente o en uno nuevo.
  const dlg = document.getElementById("rDialogo"), sel = document.getElementById("rProyecto");
  const campoNuevo = document.getElementById("rNuevoNombreCampo"), nuevoNombre = document.getElementById("rNuevoNombre"), dAlerta = document.getElementById("rDialogoAlerta");
  sel.addEventListener("change", () => campoNuevo.classList.toggle("hidden", sel.value !== "__nuevo"));
  document.getElementById("rGuardar").addEventListener("click", async () => {
    limpiarAlerta(dAlerta);
    sel.innerHTML = '<option value="">Cargando…</option>';
    dlg.showModal();
    try {
      const lista = await listarProyectos();
      sel.innerHTML = `<option value="__nuevo">＋ Proyecto nuevo</option>${lista.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join("")}`;
      sel.value = lista[0]?.id || "__nuevo";
      nuevoNombre.value = datos().proyecto.nombre;
      campoNuevo.classList.toggle("hidden", sel.value !== "__nuevo");
    } catch (err) { mostrarAlerta(dAlerta, errorAmigable(err)); }
  });
  const cerrar = () => dlg.close();
  document.getElementById("rDialogoCerrar").addEventListener("click", cerrar);
  document.getElementById("rCancelar").addEventListener("click", cerrar);
  document.getElementById("rConfirmar").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    limpiarAlerta(dAlerta);
    btn.disabled = true;
    try {
      let pid = sel.value;
      if (!pid) throw new Error("Elija un proyecto.");
      if (pid === "__nuevo") {
        const nombre = nuevoNombre.value.trim();
        if (!nombre) throw new Error("Escriba el nombre del proyecto nuevo.");
        pid = await crearProyecto({ nombre, modo: "diseno", cliente: "", ubicacion: "", altitud: proyecto.altitud, tempAmbiente: proyecto.tempAmbiente, tipoDiseno: "Diseño detallado", descripcion: "", disenador: proyecto.disenador, matricula: "", literales: {} }, ctx.user);
      }
      const { entradas, etiqueta } = obtener();
      const nueva = nuevaClave(mid, await leerCalculos(pid));
      await guardarCalculo(pid, nueva, entradas, ctx.user, etiqueta);
      borrarBorrador();
      window.location.href = `calculo.html?id=${encodeURIComponent(pid)}&k=${encodeURIComponent(nueva)}`;
    } catch (err) {
      mostrarAlerta(dAlerta, err.message && !err.code ? err.message : errorAmigable(err));
      btn.disabled = false;
    }
  });
}
