// Novedades contractuales (otrosí/prórroga, acta de suspensión, acta de
// reinicio) de un contrato — web/control/contrato.html, botón "Novedades".
//
// Se guardan como arreglo "novedades" dentro del mismo documento del
// contrato, y "fechaFin"/"valorContrato" se recalculan siempre desde cero
// a partir de "fechaFinOriginal"/"valorOriginal" + las novedades en orden
// de fecha (calcularVigencia). Así el resto del aplicativo (Inicio, lista
// de contratos, informes, meses de informes) sigue leyendo "fechaFin" y ve
// solo el plazo vigente, sin saber nada de novedades; y borrar una novedad
// mal registrada deja todo exactamente como si nunca hubiera existido.
import { updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { registrarActividad } from "./actividad.js";
import { fechaLocalISO } from "./texto.js";

export const TIPOS_NOVEDAD = {
  otrosi: "Otrosí / prórroga",
  suspension: "Acta de suspensión",
  reinicio: "Acta de reinicio"
};

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

// Fechas "YYYY-MM-DD" en UTC puro, para que sumar días nunca se corra uno
// por la zona horaria (mismo problema que se corrigió en f5f05d5).
const aUTC = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export const diasEntre = (desde, hasta) => Math.round((aUTC(hasta) - aUTC(desde)) / 86400000);
export const sumarDias = (s, n) => new Date(aUTC(s) + n * 86400000).toISOString().slice(0, 10);

function ordenadas(novedades) {
  return [...(novedades || [])].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || (a.creadoEn || "").localeCompare(b.creadoEn || ""));
}

// Plazo y valor vigentes según las novedades. Sin novedades registradas
// todavía, la base es la fecha/valor que ya tenía el contrato.
export function calcularVigencia(c) {
  let fechaFin = c.fechaFinOriginal !== undefined ? c.fechaFinOriginal : (c.fechaFin || null);
  let valor = c.valorOriginal !== undefined ? c.valorOriginal : (c.valorContrato || null);
  let suspendidoDesde = null;
  let diasSuspendido = 0;
  ordenadas(c.novedades).forEach((n) => {
    if (n.tipo === "otrosi") {
      if (n.fechaFinNueva) fechaFin = n.fechaFinNueva;
      if (n.valorAdicional) valor = (Number(valor) || 0) + Number(n.valorAdicional);
    } else if (n.tipo === "suspension") {
      suspendidoDesde = n.fecha;
    } else if (n.tipo === "reinicio") {
      if (suspendidoDesde) diasSuspendido += Math.max(0, diasEntre(suspendidoDesde, n.fecha));
      fechaFin = n.fechaFinNueva || (fechaFin && suspendidoDesde ? sumarDias(fechaFin, diasEntre(suspendidoDesde, n.fecha)) : fechaFin);
      suspendidoDesde = null;
    }
  });
  return { fechaFin, valor, suspendidoDesde, diasSuspendido };
}

// Texto corto de lo que cambió cada novedad, para la tabla del historial.
function efectoNovedad(n, suspendidoDesde) {
  const partes = [];
  if (n.tipo === "suspension") partes.push("Suspende el plazo");
  if (n.tipo === "reinicio" && suspendidoDesde) partes.push(`${diasEntre(suspendidoDesde, n.fecha)} días suspendido`);
  if (n.fechaFinNueva) partes.push(`Fin → ${n.fechaFinNueva}`);
  if (n.valorAdicional) partes.push(`+ ${formatoMoneda.format(n.valorAdicional)}`);
  return partes.join(" · ") || "—";
}

// Cablea el modal de novedades. "alCambiar" repinta la cabecera del
// contrato después de guardar (fecha fin, valor, estado).
export function iniciarNovedades({ contrato, contratoRef, puedeEditar, alCambiar }) {
  const backdrop = document.getElementById("novedadesBackdrop");
  const resumenEl = document.getElementById("novResumen");
  const tbody = document.getElementById("novLista");
  const sinNovedades = document.getElementById("novSinNovedades");
  const form = document.getElementById("novedadForm");
  const alertBox = document.getElementById("novAlert");
  const tipoSel = document.getElementById("novTipo");
  const fechaEl = document.getElementById("novFecha");
  const fechaLabel = document.getElementById("novFechaLabel");
  const documentoSel = document.getElementById("novDocumentoSel");
  const documentoEl = document.getElementById("novDocumento");
  const ayudaProrroga = document.getElementById("novAyudaProrroga");
  const diasEl = document.getElementById("novDias");
  const fechaFinEl = document.getElementById("novFechaFin");
  const valorEl = document.getElementById("novValor");
  const ayudaReinicio = document.getElementById("novAyudaReinicio");
  const guardarBtn = document.getElementById("novGuardarBtn");

  form.classList.toggle("oculto", !puedeEditar);
  // Cerrar: botón del pie, la × de arriba (siempre visible, también para
  // quien solo puede ver), Esc, o clic en el fondo oscuro fuera de la ventana.
  const cerrar = () => backdrop.classList.remove("open");
  document.getElementById("novCerrarBtn").addEventListener("click", cerrar);
  document.getElementById("novCerrarX").addEventListener("click", cerrar);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) cerrar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && backdrop.classList.contains("open")) cerrar(); });

  // Documento: lista con los nombres usuales y el consecutivo siguiente ya
  // puesto (Otrosí N.° 2 si ya hay uno), más "Otro…" para escribirlo a mano.
  const VALOR_OTRO = "__otro__";
  const NOMBRES_DOCUMENTO = {
    otrosi: ["Otrosí", "Otrosí modificatorio", "Otrosí de prórroga", "Otrosí de adición", "Otrosí de adición y prórroga", "Acta de modificación"],
    suspension: ["Acta de suspensión", "Acta de ampliación de suspensión"],
    reinicio: ["Acta de reinicio"]
  };
  function poblarDocumentos(tipo) {
    const siguiente = (contrato.novedades || []).filter((n) => n.tipo === tipo).length + 1;
    documentoSel.innerHTML = "";
    NOMBRES_DOCUMENTO[tipo].forEach((nombre) => documentoSel.appendChild(new Option(`${nombre} N.° ${siguiente}`)));
    documentoSel.appendChild(new Option("Otro (escribirlo)…", VALOR_OTRO));
    documentoEl.value = "";
    documentoEl.classList.add("oculto");
  }
  documentoSel.addEventListener("change", () => {
    const otro = documentoSel.value === VALOR_OTRO;
    documentoEl.classList.toggle("oculto", !otro);
    if (otro) documentoEl.focus();
  });
  const leerDocumento = () => (documentoSel.value === VALOR_OTRO ? documentoEl.value.trim() : documentoSel.value);

  function mostrarAlerta(texto, tipo) {
    alertBox.textContent = texto;
    alertBox.className = `form-alert campo-ancho show ${tipo}`;
  }

  // Solo se ofrece lo que tiene sentido según el estado actual: suspender
  // si está corriendo, reiniciar si está suspendido.
  function ajustarTipos() {
    const { suspendidoDesde } = calcularVigencia(contrato);
    tipoSel.querySelector('[value="suspension"]').disabled = !!suspendidoDesde;
    tipoSel.querySelector('[value="reinicio"]').disabled = !suspendidoDesde;
    tipoSel.value = suspendidoDesde ? "reinicio" : "otrosi";
  }

  // Campos visibles y textos de ayuda según el tipo — en el reinicio se
  // propone sola la nueva fecha de fin (fin vigente + días suspendidos),
  // editable por si el acta dice otra cosa.
  function actualizarFormulario() {
    const tipo = tipoSel.value;
    form.querySelectorAll("[data-nov-tipos]").forEach((el) => {
      el.classList.toggle("oculto", !el.dataset.novTipos.split(" ").includes(tipo));
    });
    fechaLabel.textContent = { otrosi: "Fecha del otrosí", suspension: "Suspendido desde", reinicio: "Fecha de reinicio" }[tipo];
    poblarDocumentos(tipo);
    diasEl.value = "";
    fechaFinEl.value = "";
    if (tipo === "reinicio") proponerFinReinicio();
    if (tipo === "otrosi") pintarAyudaProrroga();
  }

  // Línea visible bajo los campos: "Fin vigente + N días = nueva fecha",
  // para que se vea de inmediato el resultado al escribir los días.
  function pintarAyudaProrroga() {
    const { fechaFin } = calcularVigencia(contrato);
    if (!fechaFin) {
      ayudaProrroga.textContent = "El contrato no tiene fecha de finalización: escribe directamente la nueva fecha.";
    } else if (fechaFinEl.value) {
      const total = diasEntre(fechaFin, fechaFinEl.value);
      ayudaProrroga.innerHTML = `Fin vigente <strong>${fechaFin}</strong> + <strong>${total} días</strong> → nueva fecha de finalización <strong>${fechaFinEl.value}</strong>`;
    } else {
      ayudaProrroga.innerHTML = `Fin vigente: <strong>${fechaFin}</strong>. Escribe los días de prórroga y se calcula la nueva fecha.`;
    }
  }

  function proponerFinReinicio() {
    const { fechaFin, suspendidoDesde } = calcularVigencia(contrato);
    if (!fechaEl.value || !suspendidoDesde) { ayudaReinicio.textContent = ""; return; }
    const dias = Math.max(0, diasEntre(suspendidoDesde, fechaEl.value));
    ayudaReinicio.textContent = `Suspendido desde ${suspendidoDesde}: ${dias} días. El plazo se corre esos mismos días.`;
    if (fechaFin) fechaFinEl.value = sumarDias(fechaFin, dias);
  }

  // Prórroga: días ↔ nueva fecha, el que se escriba calcula el otro.
  function alCambiarDias() {
    const { fechaFin } = calcularVigencia(contrato);
    const dias = Number(diasEl.value);
    if (fechaFin) fechaFinEl.value = dias > 0 ? sumarDias(fechaFin, dias) : "";
    pintarAyudaProrroga();
  }
  function alCambiarFechaFin() {
    if (tipoSel.value !== "otrosi") return;
    const { fechaFin } = calcularVigencia(contrato);
    if (fechaFin && fechaFinEl.value) diasEl.value = diasEntre(fechaFin, fechaFinEl.value);
    pintarAyudaProrroga();
  }
  ["input", "change"].forEach((ev) => {
    diasEl.addEventListener(ev, alCambiarDias);
    fechaFinEl.addEventListener(ev, alCambiarFechaFin);
  });
  tipoSel.addEventListener("change", actualizarFormulario);
  fechaEl.addEventListener("input", () => { if (tipoSel.value === "reinicio") proponerFinReinicio(); });

  function pintar() {
    const v = calcularVigencia(contrato);
    const finInicial = contrato.fechaFinOriginal !== undefined ? contrato.fechaFinOriginal : contrato.fechaFin;
    const valorInicial = contrato.valorOriginal !== undefined ? contrato.valorOriginal : contrato.valorContrato;
    const dato = (etq, val, clase = "") => `<div class="${clase}"><span>${etq}</span><strong>${val}</strong></div>`;
    resumenEl.innerHTML = [
      dato("Fin inicial", finInicial || "—"),
      dato("Fin vigente", v.fechaFin || "—"),
      dato("Prórroga total", finInicial && v.fechaFin ? `${diasEntre(finInicial, v.fechaFin)} días` : "—"),
      valorInicial !== v.valor ? dato("Valor inicial", valorInicial ? formatoMoneda.format(valorInicial) : "—") : "",
      dato("Valor vigente", v.valor ? formatoMoneda.format(v.valor) : "—"),
      v.suspendidoDesde ? dato("Estado", `Suspendido desde ${v.suspendidoDesde}`, "control-nov-suspendido") : ""
    ].join("");

    tbody.innerHTML = "";
    let suspendidoDesde = null;
    const lista = ordenadas(contrato.novedades);
    sinNovedades.classList.toggle("oculto", lista.length > 0);
    tbody.closest(".control-tabla-wrap").classList.toggle("oculto", lista.length === 0);
    lista.forEach((n) => {
      const tr = document.createElement("tr");
      [n.fecha, TIPOS_NOVEDAD[n.tipo] || n.tipo, n.documento || "—", efectoNovedad(n, suspendidoDesde), n.observaciones || ""].forEach((t) => {
        const td = document.createElement("td");
        td.textContent = t;
        td.title = t;
        tr.appendChild(td);
      });
      if (n.tipo === "suspension") suspendidoDesde = n.fecha;
      if (n.tipo === "reinicio") suspendidoDesde = null;
      const tdAccion = document.createElement("td");
      if (puedeEditar) {
        const borrar = document.createElement("button");
        borrar.type = "button";
        borrar.className = "control-btn-mini";
        borrar.textContent = "Quitar";
        borrar.addEventListener("click", () => quitar(n));
        tdAccion.appendChild(borrar);
      }
      tr.appendChild(tdAccion);
      tbody.appendChild(tr);
    });
  }

  // Guarda el arreglo completo + los campos derivados de una sola vez.
  // La primera novedad congela fecha/valor de ese momento como "original".
  async function guardar(novedades, detalleActividad) {
    const base = {
      fechaFinOriginal: contrato.fechaFinOriginal !== undefined ? contrato.fechaFinOriginal : (contrato.fechaFin || null),
      valorOriginal: contrato.valorOriginal !== undefined ? contrato.valorOriginal : (contrato.valorContrato || null)
    };
    const v = calcularVigencia({ ...base, novedades });
    const cambios = { ...base, novedades, fechaFin: v.fechaFin, valorContrato: v.valor, actualizadoEn: serverTimestamp() };
    if (contrato.estado !== "cerrado") cambios.estado = v.suspendidoDesde ? "suspendido" : "activo";
    await updateDoc(contratoRef, cambios);
    Object.assign(contrato, cambios);
    registrarActividad({ tipo: "contrato", seccion: "Contrato", detalle: detalleActividad });
    pintar();
    alCambiar();
  }

  async function quitar(n) {
    if (!window.confirm(`¿Quitar "${TIPOS_NOVEDAD[n.tipo]}${n.documento ? ` — ${n.documento}` : ""}" del ${n.fecha}?\n\nEl plazo y el valor se recalculan sin ella.`)) return;
    try {
      await guardar((contrato.novedades || []).filter((x) => x !== n), `Quitó la novedad ${TIPOS_NOVEDAD[n.tipo]} ${n.documento || ""} del ${n.fecha}`.trim());
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo quitar la novedad.", "error");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tipo = tipoSel.value;
    const novedad = {
      tipo,
      fecha: fechaEl.value,
      documento: leerDocumento(),
      observaciones: document.getElementById("novObservaciones").value.trim(),
      creadoEn: new Date().toISOString()
    };
    if (tipo === "otrosi" || tipo === "reinicio") novedad.fechaFinNueva = fechaFinEl.value || null;
    if (tipo === "otrosi") novedad.valorAdicional = Number(valorEl.value) || null;
    if (!novedad.documento) {
      mostrarAlerta("Escribe el nombre del documento.", "error");
      documentoEl.focus();
      return;
    }
    if (tipo === "otrosi" && !novedad.fechaFinNueva && !novedad.valorAdicional) {
      mostrarAlerta("Indica la prórroga (días o nueva fecha de finalización) o el valor adicional.", "error");
      return;
    }
    const v = calcularVigencia(contrato);
    if (tipo === "reinicio" && fechaEl.value < v.suspendidoDesde) {
      mostrarAlerta("La fecha de reinicio no puede ser anterior a la de suspensión.", "error");
      return;
    }
    guardarBtn.disabled = true;
    try {
      await guardar([...(contrato.novedades || []), novedad], `Registró ${TIPOS_NOVEDAD[tipo]} ${novedad.documento}`.trim() + ` (${efectoNovedad(novedad, v.suspendidoDesde)})`);
      form.reset();
      abrirFormularioLimpio();
      mostrarAlerta("Novedad registrada.", "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo registrar la novedad.", "error");
    } finally {
      guardarBtn.disabled = false;
    }
  });

  function abrirFormularioLimpio() {
    fechaEl.value = fechaLocalISO();
    ajustarTipos();
    actualizarFormulario();
  }

  return function abrir() {
    form.reset();
    alertBox.className = "form-alert campo-ancho";
    abrirFormularioLimpio();
    pintar();
    backdrop.classList.add("open");
  };
}
