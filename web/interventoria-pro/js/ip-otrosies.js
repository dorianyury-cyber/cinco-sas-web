// Otrosíes, prórrogas y suspensiones de un contrato de Interventoría PRO
// (ventana desde la ficha del contrato en contratos.html).
//
// Mismo modelo que Control de contratos (web/js/control/novedades-contrato.js,
// de donde se toma calcularVigencia): las novedades van como arreglo
// "novedades" dentro del documento del contrato, "fechaFinOriginal" congela
// la terminación inicial y "fechaFin" se recalcula siempre desde cero. Así el
// resto del aplicativo (Inicio, tablero, informe, meses) sigue leyendo
// "fechaFin" y ve el plazo vigente; quitar una novedad deja todo como si no
// hubiera existido. El valor adicional de un otrosí NO toca valorInicial:
// entra al Estado financiero como adición (adicionesOtrosi en ip-modulos.js).
// Cada novedad deja además su acta en Cronología de actas, para el informe.
import { collection, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { calcularVigencia, diasEntre, sumarDias, TIPOS_NOVEDAD } from "../../js/control/novedades-contrato.js";
import { anotarEnLote } from "./ip-historial.js";
import { db, esc, moneda, fecha, mostrarAlerta, limpiarAlerta, errorAmigable, abrirModal, cerrarModal, hoyISO } from "./ip-core.js";

export { calcularVigencia };

const TIPO_CRONOLOGIA = { otrosi: "Otrosí", suspension: "Acta de suspensión", reinicio: "Acta de reinicio" };
const NOMBRES_DOCUMENTO = {
  otrosi: ["Otrosí", "Otrosí de prórroga", "Otrosí de adición", "Otrosí de adición y prórroga", "Otrosí modificatorio", "Acta de modificación"],
  suspension: ["Acta de suspensión", "Acta de ampliación de suspensión"],
  reinicio: ["Acta de reinicio"]
};
const OTRO = "__otro__";

const ordenadas = (novedades) => [...(novedades || [])].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || (a.creadoEn || "").localeCompare(b.creadoEn || ""));

// Terminación inicial del contrato (antes de cualquier prórroga).
export const fechaFinInicial = (c) => (c?.fechaFinOriginal !== undefined ? c.fechaFinOriginal : c?.fechaFin || null);

// Texto corto de lo que hizo cada novedad (tabla, cronología, informe).
export function efectoNovedad(n, suspendidoDesde = null) {
  const partes = [];
  if (n.tipo === "suspension") partes.push("Suspende el plazo");
  if (n.tipo === "reinicio" && suspendidoDesde) partes.push(`${diasEntre(suspendidoDesde, n.fecha)} días suspendido`);
  if (n.fechaFinNueva) partes.push(`Terminación → ${fecha(n.fechaFinNueva)}`);
  if (n.valorAdicional) partes.push(`Adición de ${moneda(n.valorAdicional)}`);
  return partes.join(" · ") || "—";
}

// Novedades con su efecto ya calculado en orden (para tablas del informe).
export function novedadesConEfecto(c, corte = null) {
  let suspendido = null;
  return ordenadas(c?.novedades).filter((n) => !corte || n.fecha <= corte).map((n) => {
    const efecto = efectoNovedad(n, suspendido);
    if (n.tipo === "suspension") suspendido = n.fecha;
    if (n.tipo === "reinicio") suspendido = null;
    return { ...n, tipoTexto: TIPO_CRONOLOGIA[n.tipo] || n.tipo, efecto };
  });
}

// Plazo vigente a una fecha de corte (el informe de un mes pasado no debe
// mostrar prórrogas firmadas después).
export function vigenciaAl(c, corte = null) {
  return calcularVigencia({ fechaFinOriginal: fechaFinInicial(c), novedades: (c?.novedades || []).filter((n) => !corte || n.fecha <= corte) });
}

const HTML = `
<div class="modal-backdrop" id="otrosiModal">
  <div class="modal ip-modal-ancho">
    <h2 id="otTitulo">Otrosíes, prórrogas y suspensiones</h2>
    <div class="ip-datos ip-ot-resumen" id="otResumen"></div>
    <div class="tabla-scroll" id="otTablaWrap">
      <table class="tabla-compacta tabla-fija">
        <colgroup><col class="ip-w11"><col class="ip-w13"><col class="ip-w18"><col class="ip-w26"><col><col class="ip-w8"></colgroup>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Documento</th><th>Efecto</th><th>Observaciones</th><th></th></tr></thead>
        <tbody id="otLista"></tbody>
      </table>
    </div>
    <p class="text-muted" id="otVacio">Sin otrosíes ni actas registradas: el contrato va con su plazo inicial.</p>
    <form id="otForm" class="ip-form-grid">
      <div class="ip-campo-ancho"><h3 class="ip-sin-margen">Registrar otrosí o acta</h3></div>
      <div class="ip-campo"><label for="otTipo">Tipo</label>
        <select id="otTipo">
          <option value="otrosi">Otrosí / prórroga (plazo y/o valor)</option>
          <option value="suspension">Acta de suspensión</option>
          <option value="reinicio">Acta de reinicio</option>
        </select></div>
      <div class="ip-campo"><label for="otFecha" id="otFechaLabel">Fecha del otrosí</label><input type="date" id="otFecha" required></div>
      <div class="ip-campo"><label for="otDocSel">Documento</label><select id="otDocSel"></select>
        <input type="text" id="otDoc" class="hidden" maxlength="80" placeholder="Escribe el nombre del documento"></div>
      <div class="ip-campo" data-ot-tipos="otrosi"><label for="otDias">Prórroga (días)</label><input type="number" id="otDias" min="0" step="1" placeholder="Ej. 60"></div>
      <div class="ip-campo" data-ot-tipos="otrosi reinicio"><label for="otFin">Nueva fecha de terminación</label><input type="date" id="otFin"></div>
      <div class="ip-campo" data-ot-tipos="otrosi"><label for="otValor">Valor adicional (opcional)</label><input type="number" id="otValor" min="0" step="1">
        <p class="text-muted ip-ayuda">Entra solo al Estado financiero como adición: no la registres también allá.</p></div>
      <p class="ip-campo-ancho text-muted ip-ayuda" id="otAyuda"></p>
      <div class="ip-campo ip-campo-ancho"><label for="otObs">Observaciones</label><input type="text" id="otObs" maxlength="200" placeholder="Ej. Prórroga por demoras en suministro de equipos"></div>
      <div class="ip-form-acciones ip-campo-ancho"><button type="submit" class="btn" id="otGuardarBtn">Registrar</button></div>
    </form>
    <div class="alert" id="otAlerta"></div>
    <div class="ip-form-acciones"><button type="button" class="btn secondary" id="otCerrarBtn">Cerrar</button></div>
  </div>
</div>`;

// Monta la ventana una vez y devuelve abrir(contrato). "alCerrarConCambios"
// se llama al cerrar si se registró o quitó algo (para refrescar la página:
// tiempo transcurrido, alertas y ficha dependen de la terminación).
export function montarOtrosies({ user, perfil, puedeEditar, puedeBorrarActas, alCerrarConCambios }) {
  document.body.insertAdjacentHTML("beforeend", HTML);
  const $ = (id) => document.getElementById(id);
  const form = $("otForm"), alerta = $("otAlerta"), tipoSel = $("otTipo"), fechaEl = $("otFecha"), docSel = $("otDocSel"), docEl = $("otDoc");
  const diasEl = $("otDias"), finEl = $("otFin"), valorEl = $("otValor"), ayuda = $("otAyuda"), btn = $("otGuardarBtn");
  let c = null;
  let huboCambios = false;

  form.classList.toggle("hidden", !puedeEditar);
  const cerrar = () => { cerrarModal("otrosiModal"); if (huboCambios) { huboCambios = false; alCerrarConCambios?.(c); } };
  $("otCerrarBtn").addEventListener("click", cerrar);
  $("otrosiModal").addEventListener("click", (e) => { if (e.target.id === "otrosiModal") cerrar(); });

  // Documento con el consecutivo siguiente (Otrosí N.° 2 si ya hay uno).
  function poblarDocumentos(tipo) {
    const siguiente = (c.novedades || []).filter((n) => n.tipo === tipo).length + 1;
    docSel.innerHTML = "";
    NOMBRES_DOCUMENTO[tipo].forEach((nombre) => docSel.appendChild(new Option(`${nombre} N.° ${siguiente}`)));
    docSel.appendChild(new Option("Otro (escribirlo)…", OTRO));
    docEl.value = "";
    docEl.classList.add("hidden");
  }
  docSel.addEventListener("change", () => { docEl.classList.toggle("hidden", docSel.value !== OTRO); if (docSel.value === OTRO) docEl.focus(); });
  const leerDocumento = () => (docSel.value === OTRO ? docEl.value.trim() : docSel.value);

  // Solo se ofrece lo que tiene sentido: suspender si corre, reiniciar si está suspendido.
  function ajustarTipos() {
    const { suspendidoDesde } = calcularVigencia(c);
    tipoSel.querySelector('[value="suspension"]').disabled = !!suspendidoDesde;
    tipoSel.querySelector('[value="reinicio"]').disabled = !suspendidoDesde;
    tipoSel.value = suspendidoDesde ? "reinicio" : "otrosi";
  }
  function actualizarFormulario() {
    const tipo = tipoSel.value;
    form.querySelectorAll("[data-ot-tipos]").forEach((el) => el.classList.toggle("hidden", !el.dataset.otTipos.split(" ").includes(tipo)));
    $("otFechaLabel").textContent = { otrosi: "Fecha del otrosí", suspension: "Suspendido desde", reinicio: "Fecha de reinicio" }[tipo];
    poblarDocumentos(tipo);
    diasEl.value = ""; finEl.value = ""; valorEl.value = "";
    ayuda.classList.toggle("hidden", tipo === "suspension");
    if (tipo === "reinicio") proponerFinReinicio();
    if (tipo === "otrosi") pintarAyudaProrroga();
  }
  // "Terminación vigente + N días = nueva fecha", visible mientras se escribe.
  function pintarAyudaProrroga() {
    const { fechaFin } = calcularVigencia(c);
    if (!fechaFin) ayuda.textContent = "El contrato no tiene fecha de terminación: escribe directamente la nueva fecha.";
    else if (finEl.value) ayuda.innerHTML = `Terminación vigente <strong>${fecha(fechaFin)}</strong> + <strong>${diasEntre(fechaFin, finEl.value)} días</strong> → nueva terminación <strong>${fecha(finEl.value)}</strong>`;
    else ayuda.innerHTML = `Terminación vigente: <strong>${fecha(fechaFin)}</strong>. Escribe los días de prórroga o la nueva fecha; el otro dato se calcula solo.`;
  }
  // Reinicio: se propone la terminación corrida los días suspendidos (editable).
  function proponerFinReinicio() {
    const { fechaFin, suspendidoDesde } = calcularVigencia(c);
    if (!fechaEl.value || !suspendidoDesde) { ayuda.textContent = ""; return; }
    const dias = Math.max(0, diasEntre(suspendidoDesde, fechaEl.value));
    ayuda.textContent = `Suspendido desde ${fecha(suspendidoDesde)}: ${dias} días. La terminación se corre esos mismos días.`;
    if (fechaFin) finEl.value = sumarDias(fechaFin, dias);
  }
  ["input", "change"].forEach((ev) => {
    diasEl.addEventListener(ev, () => {
      const { fechaFin } = calcularVigencia(c);
      const dias = Number(diasEl.value);
      if (fechaFin) finEl.value = dias > 0 ? sumarDias(fechaFin, dias) : "";
      pintarAyudaProrroga();
    });
    finEl.addEventListener(ev, () => {
      if (tipoSel.value !== "otrosi") return;
      const { fechaFin } = calcularVigencia(c);
      if (fechaFin && finEl.value) diasEl.value = diasEntre(fechaFin, finEl.value);
      pintarAyudaProrroga();
    });
  });
  tipoSel.addEventListener("change", actualizarFormulario);
  fechaEl.addEventListener("input", () => { if (tipoSel.value === "reinicio") proponerFinReinicio(); });

  function pintar() {
    const v = calcularVigencia(c);
    const ini = fechaFinInicial(c);
    const adiciones = (c.novedades || []).reduce((s, n) => s + (Number(n.valorAdicional) || 0), 0);
    const dato = (k, val) => `<div class="ip-dato"><span>${k}:</span> <strong>${val}</strong></div>`;
    $("otTitulo").textContent = `Otrosíes, prórrogas y suspensiones — Contrato ${c.numero || ""}`;
    $("otResumen").innerHTML = [
      dato("Terminación inicial", fecha(ini)),
      dato("Terminación vigente", fecha(v.fechaFin)),
      dato("Ampliación total del plazo", ini && v.fechaFin ? `${diasEntre(ini, v.fechaFin)} días` : "—"),
      v.diasSuspendido ? dato("Días suspendido", v.diasSuspendido) : "",
      adiciones ? dato("Adiciones por otrosí", moneda(adiciones)) : "",
      v.suspendidoDesde ? dato("Estado", `Suspendido desde ${fecha(v.suspendidoDesde)}`) : ""
    ].join("");
    const lista = novedadesConEfecto(c);
    $("otVacio").classList.toggle("hidden", lista.length > 0);
    $("otTablaWrap").classList.toggle("hidden", lista.length === 0);
    $("otLista").innerHTML = lista.map((n, i) => `<tr>
      <td>${fecha(n.fecha)}</td><td title="${esc(n.tipoTexto)}">${esc(n.tipoTexto)}</td><td title="${esc(n.documento || "")}">${esc(n.documento || "—")}</td>
      <td title="${esc(n.efecto)}">${esc(n.efecto)}</td><td title="${esc(n.observaciones || "")}">${esc(n.observaciones || "")}</td>
      <td>${puedeEditar ? `<button type="button" class="btn secondary ip-btn-mini" data-quitar="${i}" title="Quitar">✕</button>` : ""}</td></tr>`).join("");
    $("otLista").querySelectorAll("[data-quitar]").forEach((b) => b.addEventListener("click", () => quitar(lista[Number(b.dataset.quitar)])));
  }

  // Guarda el arreglo completo y los campos derivados, con su historial, en
  // un solo lote. La primera novedad congela la terminación de ese momento.
  async function guardar(novedades, { resumen, crono = null, borrarCrono = null }) {
    const base = { fechaFinOriginal: fechaFinInicial(c) };
    const v = calcularVigencia({ ...base, novedades });
    const cambios = { ...base, novedades, fechaFin: v.fechaFin, actualizadoEn: serverTimestamp(), actualizadoPor: user.email };
    if (!["Terminado", "Liquidado"].includes(c.estado)) cambios.estado = v.suspendidoDesde ? "Suspendido" : "Activo";
    const lote = writeBatch(db);
    lote.update(doc(db, "ipContratos", c.id), cambios);
    const hist = [];
    if ((c.fechaFin || null) !== v.fechaFin) hist.push({ campo: "fechaFin", etiqueta: "Fecha de terminación", antes: fecha(c.fechaFin), despues: fecha(v.fechaFin) });
    if (cambios.estado && cambios.estado !== (c.estado || "Activo")) hist.push({ campo: "estado", etiqueta: "Estado", antes: c.estado || "Activo", despues: cambios.estado });
    anotarEnLote(lote, c.id, { user, perfil, modulo: "contrato", moduloLabel: "Otrosíes y prórrogas", registroId: c.id, accion: "contrato", resumen, cambios: hist });
    if (crono) lote.set(crono.ref, crono.datos);
    if (borrarCrono) lote.delete(doc(db, "ipContratos", c.id, "cronologia", borrarCrono));
    await lote.commit();
    Object.assign(c, cambios, { actualizadoEn: new Date() });
    huboCambios = true;
    pintar();
  }

  async function quitar(n) {
    const original = (c.novedades || []).find((x) => x.creadoEn === n.creadoEn && x.fecha === n.fecha && x.tipo === n.tipo);
    if (!original) return;
    if (!confirm(`¿Quitar «${n.documento || n.tipoTexto}» del ${fecha(n.fecha)}?\n\nLa terminación del contrato se recalcula sin ella${original.cronologiaId && puedeBorrarActas ? " y se quita también de la Cronología de actas" : ""}.`)) return;
    limpiarAlerta(alerta);
    try {
      await guardar((c.novedades || []).filter((x) => x !== original), {
        resumen: `Quitó ${n.documento || n.tipoTexto} del ${fecha(n.fecha)}`,
        borrarCrono: puedeBorrarActas ? original.cronologiaId || null : null
      });
      mostrarAlerta(alerta, "Se quitó y se recalculó la terminación del contrato.", "success");
    } catch (err) {
      mostrarAlerta(alerta, errorAmigable(err));
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarAlerta(alerta);
    const tipo = tipoSel.value;
    const n = { tipo, fecha: fechaEl.value, documento: leerDocumento(), observaciones: $("otObs").value.trim(), creadoEn: new Date().toISOString(), creadoPor: user.email };
    if (tipo !== "suspension") n.fechaFinNueva = finEl.value || null;
    if (tipo === "otrosi") n.valorAdicional = Number(valorEl.value) || null;
    if (!n.documento) { mostrarAlerta(alerta, "Escribe el nombre del documento."); docEl.focus(); return; }
    if (tipo === "otrosi" && !n.fechaFinNueva && !n.valorAdicional) { mostrarAlerta(alerta, "Indica la prórroga (días o nueva fecha de terminación) o el valor adicional."); return; }
    const v = calcularVigencia(c);
    if (tipo === "reinicio" && n.fecha < v.suspendidoDesde) { mostrarAlerta(alerta, "La fecha de reinicio no puede ser anterior a la de suspensión."); return; }
    if (n.fechaFinNueva && c.fechaInicio && n.fechaFinNueva < c.fechaInicio) { mostrarAlerta(alerta, "La nueva fecha de terminación no puede ser anterior al inicio del contrato."); return; }
    // El acta queda también en Cronología de actas (informe mensual).
    const refCrono = doc(collection(db, "ipContratos", c.id, "cronologia"));
    n.cronologiaId = refCrono.id;
    const efecto = efectoNovedad(n, v.suspendidoDesde);
    const crono = {
      ref: refCrono,
      datos: { tipo: TIPO_CRONOLOGIA[tipo], fecha: n.fecha, descripcion: `${n.documento}: ${efecto}${n.observaciones ? `. ${n.observaciones}` : ""}`, origen: "otrosies", creadoPor: perfil.nombre || user.email, creadoEn: serverTimestamp() }
    };
    btn.disabled = true;
    try {
      await guardar([...(c.novedades || []), n], { resumen: `Registró ${n.documento} (${efecto})`, crono });
      form.reset();
      fechaEl.value = hoyISO();
      ajustarTipos();
      actualizarFormulario();
      mostrarAlerta(alerta, "Registrado. La terminación del contrato ya quedó actualizada.", "success");
    } catch (err) {
      mostrarAlerta(alerta, errorAmigable(err));
    } finally {
      btn.disabled = false;
    }
  });

  return function abrir(contrato) {
    c = contrato;
    form.reset();
    limpiarAlerta(alerta);
    fechaEl.value = hoyISO();
    ajustarTipos();
    actualizarFormulario();
    pintar();
    abrirModal("otrosiModal");
  };
}
