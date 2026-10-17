// Página de un módulo de cálculo: formulario generado desde rt-modulos.js,
// cálculo en vivo (rt-calculos.js) y guardado en rtProyectos/{id}/calculos.
import { iniciarPagina, leerProyecto, leerCalculos, guardarCalculo, calcularProyecto, esc, mostrarAlerta, limpiarAlerta, errorAmigable } from "./rt-core.js";
import { MODULOS, AREAS, entradasPorDefecto } from "./rt-modulos.js";
import { svgTCC } from "./rt-grafico.js";

const ctx = await iniciarPagina();
const params = new URLSearchParams(location.search);
const id = params.get("id"), mid = params.get("m");
const mod = MODULOS[mid];
const alerta = document.getElementById("alerta");

if (ctx && (!id || !mod)) {
  mostrarAlerta(alerta, "Falta el proyecto o el módulo. Vuelve a la lista de proyectos.");
} else if (ctx) {
  const proyecto = await leerProyecto(id);
  if (!proyecto) {
    mostrarAlerta(alerta, "El proyecto no existe o no tienes acceso.");
  } else {
    iniciar(proyecto, await leerCalculos(id));
  }
}

function iniciar(proyecto, guardados) {
  document.title = `${mod.titulo} — RETINCO`;
  document.getElementById("migas").innerHTML = `<a href="proyecto.html?id=${encodeURIComponent(proyecto.id)}">← ${esc(proyecto.nombre)}</a> · ${esc(AREAS[mod.area].nombre)}`;
  document.getElementById("titulo").textContent = `${mod.icono} ${mod.titulo}`;
  document.getElementById("objeto").textContent = mod.objeto;
  document.getElementById("normas").textContent = `Normas: ${mod.normas.join(" · ")}`;
  const estado = document.getElementById("estadoGuardado");
  const avisoEj = document.getElementById("avisoEjemplo");

  let entradas = guardados[mid]?.entradas ? structuredClone(guardados[mid].entradas) : entradasPorDefecto(mid);
  // Campos nuevos que no existían cuando se guardó: toman el valor por defecto.
  mod.campos.forEach((c) => { if (entradas[c.key] === undefined) entradas[c.key] = entradasPorDefecto(mid)[c.key]; });
  avisoEj.classList.toggle("hidden", !!guardados[mid]);
  let sinGuardar = false;
  const marcar = (v) => { sinGuardar = v; estado.textContent = v ? "● Cambios sin guardar" : guardados[mid] ? "Guardado" : "Sin guardar"; estado.className = `rt-estado-guardado${v ? " pendiente" : ""}`; };
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
    const res = calcularProyecto(proyecto, guardados, { sobrescribir: { [mid]: entradas } })[mid];
    if (!res) { resultados.innerHTML = ""; return; }
    const fallan = (res.verificaciones || []).filter((v) => v.cumple === false).length;
    resultados.innerHTML = `
      <h2>Resultados</h2>
      ${res.error ? `<div class="alert error">${esc(res.error)}</div>` : ""}
      <div class="rt-resumen">${(res.resumen || []).map((r) => `<div class="rt-resumen-item"><div class="valor">${esc(r.valor)} <span class="rt-unidad">${esc(r.unidad)}</span></div><div class="etiqueta">${esc(r.etiqueta)}</div></div>`).join("")}</div>
      <div class="rt-conclusion ${fallan || res.error ? "mal" : "ok"}">${esc(res.conclusion || "")}</div>
      ${(res.verificaciones || []).length ? tablaHtml({ titulo: "Verificaciones", encabezados: ["Criterio", "Norma", "Valor", "Límite", "Resultado"], filas: res.verificaciones.map((v) => [v.criterio, v.norma, v.valor, v.limite, v.cumple ? "✔ Cumple" : "✖ No cumple"]) }) : ""}
      ${res.grafico?.tipo === "tcc" ? `<h3>Curvas tiempo-corriente</h3><div class="rt-grafico">${svgTCC(res.grafico)}</div>` : ""}
      ${(res.tablas || []).map(tablaHtml).join("")}
      <h3>Cálculos</h3>${(res.pasos || []).map((p) => `<div class="rt-paso"><strong>${esc(p.titulo)}</strong><span class="rt-formula">${esc(p.formula)}</span><span class="text-muted">${esc(p.sustitucion)}</span><span>${esc(p.resultado)}</span></div>`).join("")}
      ${(res.notas || []).map((n) => `<p class="rt-nota">ℹ️ ${esc(n)}</p>`).join("")}`;
  }

  document.getElementById("guardarBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    limpiarAlerta(alerta);
    try {
      await guardarCalculo(proyecto.id, mid, entradas, ctx.user);
      guardados[mid] = { entradas: structuredClone(entradas) };
      avisoEj.classList.add("hidden");
      marcar(false);
      mostrarAlerta(alerta, "Cálculo guardado.", "success");
    } catch (err) {
      mostrarAlerta(alerta, errorAmigable(err));
    } finally {
      btn.disabled = false;
    }
  });
  document.getElementById("ejemploBtn").addEventListener("click", () => {
    if (!confirm("¿Reemplazar los datos del formulario por los valores de ejemplo? No se guarda hasta que pulses «Guardar».")) return;
    entradas = entradasPorDefecto(mid);
    marcar(true);
    pintarCampos();
    recalcular();
  });

  pintarCampos();
  recalcular();
}
