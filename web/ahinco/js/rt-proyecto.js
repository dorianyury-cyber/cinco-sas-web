// Página del proyecto: datos generales, matriz de literales a) a x) del
// RETIE, tarjetas de módulos por área y generación de la memoria.
import { iniciarPagina, leerProyecto, leerCalculos, actualizarProyecto, eliminarProyecto, calcularProyecto, estadoModulo, modulosPorArea, clavesDe, tituloCalculo, esc, mostrarAlerta, limpiarAlerta, errorAmigable } from "./rt-core.js";
import { MODULOS, AREAS } from "./rt-modulos.js";
import { LITERALES, FUENTE_LITERALES, estadoLiteral } from "./rt-literales.js";

const ctx = await iniciarPagina();
const id = new URLSearchParams(location.search).get("id");
const alerta = document.getElementById("alerta");

if (ctx) {
  const proyecto = id ? await leerProyecto(id) : null;
  if (!proyecto) mostrarAlerta(alerta, "El proyecto no existe o no tienes acceso.");
  else iniciar(proyecto, await leerCalculos(id));
}

function iniciar(proyecto, guardados) {
  const resultados = calcularProyecto(proyecto, guardados);
  let literales = structuredClone(proyecto.literales || {});
  const pintarEncabezado = () => {
    document.title = `${proyecto.nombre} — AHÍNCO`;
    document.getElementById("titulo").textContent = proyecto.nombre;
    document.getElementById("subtitulo").textContent = [proyecto.cliente, proyecto.ubicacion, proyecto.tipoDiseno].filter(Boolean).join(" · ");
  };
  pintarEncabezado();

  // ---- datos generales
  const form = document.getElementById("datosForm");
  form.querySelectorAll("[data-p]").forEach((el) => { el.value = proyecto[el.dataset.p] ?? ""; });
  if (!proyecto.matricula) document.getElementById("datosCard").open = true;
  document.getElementById("guardarDatosBtn").addEventListener("click", async () => {
    const datos = {};
    form.querySelectorAll("[data-p]").forEach((el) => { datos[el.dataset.p] = el.type === "number" ? Number(el.value) || 0 : el.value.trim(); });
    if (!datos.nombre) { mostrarAlerta(alerta, "El proyecto debe tener nombre."); return; }
    try {
      await actualizarProyecto(proyecto.id, datos, ctx.user);
      Object.assign(proyecto, datos);
      pintarEncabezado();
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
  const urlCalc = (clave) => `calculo.html?id=${encodeURIComponent(proyecto.id)}&k=${encodeURIComponent(clave)}`;
  // Un módulo puede tener varios cálculos (p. ej. aislamiento a 115 y a 34,5 kV).
  const badgeMod = (m) => {
    const claves = clavesDe(m, guardados);
    if (!claves.length) return `<a href="${urlCalc(m)}">${MODULOS[m].icono} ${esc(MODULOS[m].titulo)}</a> <span class="badge muted">Sin datos</span>`;
    return claves.map((k) => { const e = estadoModulo(resultados[k]); return `<a href="${urlCalc(k)}">${MODULOS[m].icono} ${esc(tituloCalculo(resultados[k]))}</a> <span class="badge ${e.clase}">${esc(e.texto)}</span>`; }).join("<br>");
  };
  function pintarLiterales() {
    tabla.innerHTML = `<colgroup><col data-ancho="4"><col data-ancho="30"><col data-ancho="22"><col data-ancho="10"><col data-ancho="34"></colgroup>
      <thead><tr><th>Lit.</th><th>Contenido exigido por el RETIE</th><th>Cálculo en AHÍNCO</th><th>Aplica</th><th>Desarrollo del diseñador / justificación si no aplica</th></tr></thead>
      <tbody>${LITERALES.map((lit) => {
        const d = literales[lit.l] || {};
        const e = estadoLiteral(lit, d, resultados);
        return `<tr><td><strong>${lit.l})</strong></td>
          <td>${esc(lit.texto)}${lit.guia ? `<span class="rt-nota">${esc(lit.guia)}</span>` : ""}</td>
          <td>${lit.modulos.length ? lit.modulos.map(badgeMod).join("<br>") : '<span class="text-muted">Desarrollo del diseñador</span>'}<br><span class="badge ${e.clase}">${esc(e.texto)}</span></td>
          <td><select data-l="${lit.l}" data-c="aplica"><option${d.aplica !== "No" ? " selected" : ""}>Sí</option><option${d.aplica === "No" ? " selected" : ""}>No</option></select></td>
          <td><textarea data-l="${lit.l}" data-c="texto" rows="2" placeholder="${d.aplica === "No" ? "Razón por la que no aplica" : lit.modulos.length ? "Texto complementario (opcional)" : "Desarrollo del literal"}">${esc(d.texto || "")}</textarea></td></tr>`;
      }).join("")}</tbody>`;
    tabla.querySelectorAll("col[data-ancho]").forEach((c) => { c.style.width = `${c.dataset.ancho}%`; });
  }
  tabla.addEventListener("change", (e) => {
    const el = e.target;
    if (!el.dataset.l) return;
    literales[el.dataset.l] = { ...(literales[el.dataset.l] || {}), [el.dataset.c]: el.value };
    estadoLit.textContent = "● Cambios sin guardar"; estadoLit.className = "rt-estado-guardado pendiente";
    if (el.dataset.c === "aplica") pintarLiterales();
  });
  tabla.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.l && el.dataset.c === "texto") { literales[el.dataset.l] = { ...(literales[el.dataset.l] || {}), texto: el.value }; estadoLit.textContent = "● Cambios sin guardar"; estadoLit.className = "rt-estado-guardado pendiente"; }
  });
  document.getElementById("guardarLitBtn").addEventListener("click", async () => {
    try {
      await actualizarProyecto(proyecto.id, { literales }, ctx.user);
      proyecto.literales = structuredClone(literales);
      estadoLit.textContent = "Guardado"; estadoLit.className = "rt-estado-guardado";
      pintarLiterales();
    } catch (err) { mostrarAlerta(alerta, errorAmigable(err)); }
  });
  pintarLiterales();

  // ---- módulos por área
  document.getElementById("areas").innerHTML = Object.entries(AREAS).map(([a, info]) => `
    <section class="rt-area ${info.clase}">
      <h2>${esc(info.nombre)}</h2><p class="text-muted">${esc(info.desc)}</p>
      <div class="rt-modulos">${modulosPorArea(a).map((m) => {
        const lits = LITERALES.filter((l) => l.modulos.includes(m)).map((l) => `${l.l})`).join(", ");
        const claves = clavesDe(m, guardados);
        const tarjeta = (clave) => {
          const r = resultados[clave], e = estadoModulo(r);
          return `<a class="rt-modulo-card" href="${urlCalc(clave)}">
          <span class="rt-modulo-icono">${MODULOS[m].icono}</span>
          <span><strong>${esc(r ? tituloCalculo(r) : MODULOS[m].titulo)}</strong><span class="text-muted">RETIE literal ${lits}</span><br><span class="badge ${e.clase}">${esc(e.texto)}</span></span></a>`;
        };
        const otro = claves.length ? `<a class="rt-modulo-otro" href="calculo.html?id=${encodeURIComponent(proyecto.id)}&m=${m}&nuevo=1" title="Repetir este cálculo, p. ej. para otro nivel de tensión">+ Otro cálculo de ${esc(MODULOS[m].titulo.toLowerCase())}</a>` : "";
        return (claves.length ? claves.map(tarjeta).join("") : tarjeta(m)) + otro;
      }).join("")}</div>
    </section>`).join("");

  // ---- memoria
  const pendientesSinJustificar = () => LITERALES.filter((l) => literales[l.l]?.aplica === "No" && !(literales[l.l]?.texto || "").trim()).map((l) => `${l.l})`);
  async function generar(tipo, btn) {
    limpiarAlerta(alerta);
    if (!Object.keys(resultados).length && tipo !== "excel") { mostrarAlerta(alerta, "Todavía no hay cálculos guardados en este proyecto."); return; }
    const sinJust = pendientesSinJustificar();
    if (sinJust.length && !confirm(`Los literales ${sinJust.join(", ")} están marcados «No aplica» sin justificación (el RETIE exige mencionarla). ¿Generar de todas formas?`)) return;
    const texto = btn.textContent;
    btn.disabled = true; btn.textContent = "Generando…";
    try {
      const datos = { proyecto: { ...proyecto, literales }, resultados, guardados };
      if (tipo === "excel") {
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
      btn.disabled = false; btn.textContent = texto;
    }
  }
  document.getElementById("pdfBtn").addEventListener("click", (e) => generar("pdf", e.currentTarget));
  document.getElementById("wordBtn").addEventListener("click", (e) => generar("word", e.currentTarget));
  document.getElementById("excelBtn").addEventListener("click", (e) => generar("excel", e.currentTarget));
}
