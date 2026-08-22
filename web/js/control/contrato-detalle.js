import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, getDoc, updateDoc, deleteDoc, setDoc, collection, getDocs, onSnapshot,
  query, orderBy, serverTimestamp, arrayUnion, arrayRemove, deleteField
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { CAMPOS, FASES, COLUMNAS_ITEM } from "./plantillas.js";
import { capitalizarOracion, capitalizarNombrePropio } from "./texto.js";

const TIPO_DOC_LABEL = { contrato: "Contrato", interno: "Interno", externo: "Externo" };

const TIPO_LABEL = { obra: "Obra", servicio: "Servicio" };

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const ESTADOS = [
  { valor: "pendiente", label: "Pendiente" },
  { valor: "en_proceso", label: "En proceso" },
  { valor: "completado", label: "Completado" },
  { valor: "no_aplica", label: "No aplica" }
];

const FASE_ORDEN = FASES.map((f) => f.clave);
const FASE_NOMBRE = Object.fromEntries(FASES.map((f) => [f.clave, f.nombre]));

const id = new URLSearchParams(window.location.search).get("id");
if (!id) window.location.href = "contratos.html";

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});

function campo(tag, opts = {}) {
  const el = document.createElement(tag);
  Object.entries(opts).forEach(([k, v]) => {
    if (k === "text") el.textContent = v;
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v);
  });
  return el;
}

function formatearFechaHora(valor) {
  if (!valor) return "";
  const fecha = typeof valor.toDate === "function" ? valor.toDate() : valor;
  return fecha.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

// Fecha corta "DD/MM/AAAA" para un string plano "YYYY-MM-DD" (docFecha del
// formulario "Agregar documento manual") — distinto de formatearFechaHora,
// que espera un Timestamp de Firestore.
function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return "";
  return new Date(fechaISO + "T12:00:00").toLocaleDateString("es-CO");
}

// ¿Ya está completa (o no aplica) toda una fase de Actividades? Se usa para
// la alerta suave de "la fase anterior no ha terminado" — no bloquea, solo
// avisa, porque en la práctica sí hay excepciones válidas.
function faseCompleta(todosLosItems, fase) {
  const relevantes = todosLosItems.filter(
    (i) => i.campo === "actividades" && i.fase === fase && i.estado !== "no_aplica"
  );
  return relevantes.every((i) => i.estado === "completado");
}

// Placeholder para una columna que el rol "Empleado" no tiene en su lista
// de camposVisibles — reemplaza al input/select en vez de solo deshabilitarlo,
// para no mostrar ese dato en absoluto (aviso: esto es solo de interfaz, no
// una barrera de seguridad — ver la nota en firestore.rules).
function celdaOculta() {
  return campo("span", { class: "control-item-oculto", text: "—" });
}

// Fila compacta de un ítem del checklist, más un panel de detalle opcional
// (oculto por defecto) con historial de estados y verificación — se abre
// con el botón "⋯" para no recargar visualmente la tabla del día a día.
// Se construye con la API del DOM (sin innerHTML) para no exponer los
// valores guardados por el usuario (notas, responsable...) a inyección de HTML.
//
// "permisos" decide qué puede tocar/ver cada rol en esta fila:
// - esGestor (admin/coadmin): edita todo, incluida la verificación.
// - apoyo: permisoColumna(clave).editable según empleados/{email}.camposPermitidos.
// - empleado: nunca editable; permisoColumna(clave).visible según camposVisibles
//   (las columnas no asignadas se reemplazan por celdaOculta()).
function crearFilaItem(item, user, onEstadoChange, contenedor, todosLosItems, permisos) {
  const fila = campo("div", { class: "control-item" });

  fila.appendChild(campo("span", { class: "control-item-nombre", text: item.nombre }));

  const pEstado = permisos.permisoColumna("estado");
  const selectEstado = document.createElement("select");
  selectEstado.className = "control-item-estado";
  ESTADOS.forEach((e) => {
    const opt = campo("option", { value: e.valor, text: e.label });
    if (e.valor === item.estado) opt.selected = true;
    selectEstado.appendChild(opt);
  });
  selectEstado.disabled = !pEstado.editable;
  fila.appendChild(pEstado.visible ? selectEstado : celdaOculta());

  const pFecha = permisos.permisoColumna("fecha");
  const fecha = document.createElement("input");
  fecha.type = "date";
  fecha.className = "control-item-fecha";
  fecha.value = item.fecha || "";
  fecha.disabled = !pFecha.editable;
  fila.appendChild(pFecha.visible ? fecha : celdaOculta());

  const pResponsable = permisos.permisoColumna("responsable");
  const responsable = document.createElement("input");
  responsable.type = "text";
  responsable.className = "control-item-responsable";
  responsable.placeholder = "Responsable";
  responsable.maxLength = 80;
  responsable.value = item.responsable || "";
  responsable.disabled = !pResponsable.editable;
  fila.appendChild(pResponsable.visible ? responsable : celdaOculta());

  const pEnlace = permisos.permisoColumna("enlace");
  const enlace = document.createElement("input");
  enlace.type = "url";
  enlace.className = "control-item-enlace";
  enlace.placeholder = "Enlace OneDrive";
  enlace.maxLength = 500;
  enlace.value = item.enlace || "";
  enlace.disabled = !pEnlace.editable;
  fila.appendChild(pEnlace.visible ? enlace : celdaOculta());

  const pNotas = permisos.permisoColumna("notas");
  const celdaNotas = campo("div", { class: "control-item-notas-celda" });
  const notas = document.createElement("input");
  notas.type = "text";
  notas.className = "control-item-notas";
  notas.placeholder = "Notas";
  notas.maxLength = 200;
  notas.value = item.notas || "";
  notas.disabled = !pNotas.editable;
  celdaNotas.appendChild(pNotas.visible ? notas : celdaOculta());

  const botonMas = document.createElement("button");
  botonMas.type = "button";
  botonMas.className = "control-item-mas";
  botonMas.title = "Ver historial y verificación";
  botonMas.textContent = "⋯";
  celdaNotas.appendChild(botonMas);
  fila.appendChild(celdaNotas);

  // ---- panel de detalle: verificación + historial de estados ----
  const panel = campo("div", { class: "control-item-detalle" });
  panel.hidden = true;

  const filaVerif = campo("div", { class: "control-item-detalle-verif" });
  const labelVerifPor = campo("label", { text: "Verificado por " });
  const verificadoPor = document.createElement("input");
  verificadoPor.type = "text";
  verificadoPor.placeholder = "Nombre de quien verifica";
  verificadoPor.maxLength = 80;
  verificadoPor.value = item.verificadoPor || "";
  verificadoPor.disabled = !permisos.esGestor;
  labelVerifPor.appendChild(verificadoPor);
  filaVerif.appendChild(labelVerifPor);

  const labelVerifFecha = campo("label", { text: "Fecha de verificación " });
  const fechaVerificacion = document.createElement("input");
  fechaVerificacion.type = "date";
  fechaVerificacion.value = item.fechaVerificacion || "";
  fechaVerificacion.disabled = !permisos.esGestor;
  labelVerifFecha.appendChild(fechaVerificacion);
  filaVerif.appendChild(labelVerifFecha);
  panel.appendChild(filaVerif);

  const historialBox = campo("div", { class: "control-item-historial" });
  historialBox.appendChild(campo("strong", { text: "Historial de estado" }));
  const listaHistorial = document.createElement("ul");
  historialBox.appendChild(listaHistorial);
  panel.appendChild(historialBox);

  // Borrar ítem: mismo permiso que "+ Agregar ítem" (solo Admin/Coadministrador)
  // — pedido del usuario tras crear por error un ítem suelto que no debía
  // estar ahí, sin forma de quitarlo. Queda dentro del panel "⋯" (no en la
  // fila principal) para no exponer un botón de borrar en el día a día.
  // Solo para ítems agregados manualmente (clave "manual_...", ver
  // botonAgregarItem más abajo) — los ítems fijos de la plantilla
  // (Servicio al Cliente/Talento Humano/Actividades) no se pueden borrar,
  // para que todo contrato conserve siempre esa estructura base.
  const esManual = typeof item.clave === "string" && item.clave.startsWith("manual_");
  if (permisos.esGestor && esManual) {
    const borrarItemBtn = campo("button", { type: "button", class: "control-btn-danger control-item-borrar" });
    borrarItemBtn.textContent = "Borrar ítem";
    borrarItemBtn.addEventListener("click", async () => {
      const confirmado = window.confirm(`¿Seguro que quieres borrar el ítem "${item.nombre}" del checklist?\n\nEsta acción no se puede deshacer.`);
      if (!confirmado) return;
      borrarItemBtn.disabled = true;
      try {
        await deleteDoc(item.ref);
        window.location.reload();
      } catch (err) {
        window.alert(err.message || "No se pudo borrar el ítem.");
        borrarItemBtn.disabled = false;
      }
    });
    panel.appendChild(borrarItemBtn);
  }

  function renderHistorial() {
    listaHistorial.innerHTML = "";
    const historial = item.historialEstado || [];
    if (!historial.length) {
      listaHistorial.appendChild(campo("li", { class: "text-muted", text: "Sin cambios registrados todavía." }));
      return;
    }
    [...historial].reverse().forEach((h) => {
      const label = ESTADOS.find((e) => e.valor === h.estado)?.label || h.estado;
      listaHistorial.appendChild(
        campo("li", { text: `${label} — ${h.por} — ${formatearFechaHora(h.en)}` })
      );
    });
  }
  renderHistorial();

  botonMas.addEventListener("click", () => { panel.hidden = !panel.hidden; });

  const guardar = (campoDoc, valor) =>
    updateDoc(item.ref, { [campoDoc]: valor, actualizadoEn: serverTimestamp(), actualizadoPor: user.email });

  selectEstado.addEventListener("change", () => {
    const nuevoValor = selectEstado.value;

    if (nuevoValor === "completado" && item.campo === "actividades" && item.fase) {
      const idx = FASE_ORDEN.indexOf(item.fase);
      const faseAnterior = idx > 0 ? FASE_ORDEN[idx - 1] : null;
      if (faseAnterior && !faseCompleta(todosLosItems, faseAnterior)) {
        const seguir = window.confirm(
          `Todavía hay ítems sin completar en "${FASE_NOMBRE[faseAnterior]}".\n\n¿Marcar igual este como Completado?`
        );
        if (!seguir) { selectEstado.value = item.estado; return; }
      }
    }

    item.estado = nuevoValor;
    item.historialEstado = [...(item.historialEstado || []), { estado: nuevoValor, por: user.email, en: new Date() }];
    updateDoc(item.ref, {
      estado: nuevoValor,
      historialEstado: item.historialEstado,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: user.email
    });
    renderHistorial();
    onEstadoChange();
  });
  // "change" (no "input") para no escribir en cada tecla: solo al salir del campo.
  fecha.addEventListener("change", () => guardar("fecha", fecha.value));
  responsable.addEventListener("change", () => guardar("responsable", responsable.value));
  enlace.addEventListener("change", () => guardar("enlace", enlace.value));
  notas.addEventListener("change", () => guardar("notas", notas.value));
  verificadoPor.addEventListener("change", () => guardar("verificadoPor", verificadoPor.value));
  fechaVerificacion.addEventListener("change", () => guardar("fechaVerificacion", fechaVerificacion.value));

  contenedor.appendChild(fila);
  contenedor.appendChild(panel);
}

function encabezadoItems() {
  const fila = campo("div", { class: "control-item control-item-header" });
  fila.appendChild(campo("span", { text: "Ítem" }));
  fila.appendChild(campo("span", { text: "Estado" }));
  fila.appendChild(campo("span", { text: "Fecha" }));
  fila.appendChild(campo("span", { text: "Responsable" }));
  fila.appendChild(campo("span", { text: "Enlace" }));
  fila.appendChild(campo("span", { text: "Notas" }));
  return fila;
}

function badgeAvance(items) {
  const relevantes = items.filter((i) => i.estado !== "no_aplica");
  if (!relevantes.length) return { texto: "—", completo: false };
  const completos = relevantes.filter((i) => i.estado === "completado").length;
  return { texto: `${completos}/${relevantes.length}`, completo: completos === relevantes.length };
}

// Aplica el texto "x/y" a un badge y lo pone en verde (.completo) cuando
// llegó a su meta — mismo helper para el avance general, por campo y por
// fase, para no repetir el toggle de clase en cada sitio.
function aplicarBadgeAvance(el, items) {
  if (!el) return;
  const { texto, completo } = badgeAvance(items);
  el.textContent = texto;
  el.classList.toggle("completo", completo);
}

// ---- Equipo asignado ----
// Solo admin/coadmin ven el formulario para agregar/quitar (las reglas de
// Firestore también lo exigen); el resto del equipo ve la lista en
// solo lectura.
function cargarEquipo(contratoRef, contrato, puedeGestionar, empleados) {
  const lista = document.getElementById("equipoLista");
  const badge = document.getElementById("equipoBadge");
  const form = document.getElementById("agregarEquipoForm");
  const select = document.getElementById("equipoSelect");
  const alertBox = document.getElementById("equipoAlert");

  const porEmail = Object.fromEntries(empleados.map((e) => [e.email, e]));

  function render() {
    const equipo = contrato.equipo || [];
    badge.textContent = String(equipo.length);
    lista.innerHTML = "";
    if (!equipo.length) {
      lista.appendChild(campo("p", { class: "text-muted", text: "Todavía no hay nadie asignado." }));
    }
    equipo.forEach((email) => {
      const fila = campo("div", { class: "control-equipo-fila" });
      fila.appendChild(campo("span", { text: porEmail[email]?.nombre || email }));
      fila.appendChild(campo("span", { class: "text-muted", text: email }));
      if (puedeGestionar) {
        const quitar = document.createElement("button");
        quitar.type = "button";
        quitar.className = "control-btn-mini";
        quitar.textContent = "Quitar";
        quitar.addEventListener("click", async () => {
          await updateDoc(contratoRef, { equipo: arrayRemove(email), actualizadoEn: serverTimestamp() });
          contrato.equipo = (contrato.equipo || []).filter((e) => e !== email);
          renderSelect();
          render();
        });
        fila.appendChild(quitar);
      }
      lista.appendChild(fila);
    });
  }

  function renderSelect() {
    const equipo = contrato.equipo || [];
    select.innerHTML = "";
    empleados
      .filter((e) => e.estado === "activo" && !equipo.includes(e.email))
      .forEach((e) => {
        const opt = campo("option", { text: `${e.nombre} — ${e.email}` });
        opt.value = e.email;
        select.appendChild(opt);
      });
  }

  if (puedeGestionar) {
    form.classList.remove("oculto");
    renderSelect();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!select.value) return;
      await updateDoc(contratoRef, { equipo: arrayUnion(select.value), actualizadoEn: serverTimestamp() });
      contrato.equipo = [...(contrato.equipo || []), select.value];
      renderSelect();
      render();
      alertBox.textContent = "Agregado al equipo.";
      alertBox.className = "form-alert show ok";
    });
  }

  render();
}

// ---- Aprobación del contrato ----
// Cada empleado activo marcado como aprobador obligatorio (Empleados >
// "Debe leer y aprobar cada contrato nuevo" — ej. Administradora, Gerente)
// debe leer y aprobar este contrato. Se guarda en contratos/{id}.aprobaciones,
// un mapa por email — ver firestore.rules: un aprobador sin rol de gestor
// (esGestor) solo puede tocar SU PROPIA entrada ahí, nunca la de otro ni el
// resto del contrato.
function cargarAprobaciones(contratoRef, contrato, empleados, user) {
  const lista = document.getElementById("aprobacionLista");
  const badge = document.getElementById("aprobacionBadge");
  const sinAprobadores = document.getElementById("sinAprobadores");

  const aprobadores = empleados.filter((e) => e.estado === "activo" && e.aprobadorContratos === true);
  sinAprobadores.classList.toggle("oculto", aprobadores.length > 0);
  if (!aprobadores.length) {
    badge.textContent = "";
    return;
  }

  function render() {
    const aprobaciones = contrato.aprobaciones || {};
    const aprobados = aprobadores.filter((a) => aprobaciones[a.email]).length;
    badge.textContent = `${aprobados}/${aprobadores.length}`;
    badge.classList.toggle("completo", aprobados === aprobadores.length);

    lista.innerHTML = "";
    aprobadores.forEach((a) => {
      const info = aprobaciones[a.email];
      const fila = campo("div", { class: "control-equipo-fila" });
      fila.appendChild(campo("span", { text: a.nombre || a.email }));
      fila.appendChild(campo("span", { class: "text-muted", text: a.cargo || a.email }));
      fila.appendChild(info
        ? campo("span", { class: "control-estado-pill control-estado-vigente", text: `✅ Aprobado el ${formatearFechaHora(info.en)}` })
        : campo("span", { class: "control-badge", text: "⏳ Pendiente" }));

      if (a.email === user.email) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "control-btn-mini";
        btn.textContent = info ? "Quitar mi aprobación" : "Marcar como leído y aprobado";
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            if (info) {
              await updateDoc(contratoRef, { [`aprobaciones.${user.email}`]: deleteField(), actualizadoEn: serverTimestamp() });
              const restante = { ...contrato.aprobaciones };
              delete restante[user.email];
              contrato.aprobaciones = restante;
            } else {
              await updateDoc(contratoRef, { [`aprobaciones.${user.email}`]: { en: serverTimestamp() }, actualizadoEn: serverTimestamp() });
              contrato.aprobaciones = { ...(contrato.aprobaciones || {}), [user.email]: { en: new Date() } };
            }
            render();
          } catch (err) {
            window.alert(err.message || "No se pudo guardar la aprobación.");
          } finally {
            btn.disabled = false;
          }
        });
        fila.appendChild(btn);
      }

      lista.appendChild(fila);
    });
  }

  render();
}

// Lista de meses "YYYY-MM" entre fechaInicio y fechaFin (o hasta hoy si el
// contrato no tiene fecha de fin), para el checklist de Informes mensuales.
function rangoMeses(fechaInicio, fechaFin) {
  if (!fechaInicio) return [];
  const [anioIni, mesIni] = fechaInicio.split("-").map(Number);
  const limite = fechaFin || new Date().toISOString().slice(0, 10);
  const [anioFin, mesFin] = limite.split("-").map(Number);
  const meses = [];
  let anio = anioIni;
  let mes = mesIni;
  while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
    meses.push(`${anio}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) { mes = 1; anio += 1; }
  }
  return meses;
}

const FORMATO_MES = new Intl.DateTimeFormat("es-CO", { month: "short", year: "numeric" });
function nombreMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  return FORMATO_MES.format(new Date(anio, mes - 1, 1));
}

// ---- Informes mensuales ----
// Checklist visual (no una lista aparte en Firestore): se apoya en los
// mismos documentos manuales de abajo que tengan "mes" diligenciado —
// ver "Mes del informe" en el formulario de documento manual.
function renderInformesMensuales(contrato, documentosConMes) {
  const contenedor = document.getElementById("informesMensualesLista");
  const badge = document.getElementById("informesBadge");
  const meses = rangoMeses(contrato.fechaInicio, contrato.fechaFin);
  const mesesHechos = new Set(documentosConMes.map((d) => d.mes));

  contenedor.innerHTML = "";
  badge.textContent = `${mesesHechos.size}/${meses.length}`;
  badge.classList.toggle("completo", meses.length > 0 && mesesHechos.size === meses.length);
  meses.forEach((mesISO) => {
    const hecho = mesesHechos.has(mesISO);
    const pill = document.createElement(hecho ? "span" : "button");
    if (!hecho) pill.type = "button";
    pill.className = `control-mes-pill ${hecho ? "hecho" : "pendiente"}`;
    pill.textContent = `${nombreMes(mesISO)}${hecho ? " ✓" : ""}`;
    if (!hecho) {
      pill.title = "Agregar el informe de este mes";
      pill.addEventListener("click", () => {
        const detalleManual = document.getElementById("docMes").closest("details");
        detalleManual.open = true;
        document.getElementById("docMes").value = mesISO;
        document.getElementById("docNombre").focus();
        detalleManual.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    contenedor.appendChild(pill);
  });
}

// ---- Documentos del contrato ----
// Combina lo que llega solo (desde Documentos/Correspondencia, cuando esa
// carta o formato se creó eligiendo este contrato) con lo agregado a mano
// para lo que no pasa por ninguno de los dos generadores todavía. Admin,
// coadmin y apoyo pueden ver y agregar filas manuales; "empleado" solo ve
// la lista (ni "Ver" ni "+ Agregar documento manual" — aviso: al igual que
// camposVisibles, ocultar "Ver" es solo de interfaz, no bloquea el dato en
// Firestore; lo que sí es una barrera real es que la regla de Firestore le
// niega crear filas en esta subcolección). Excepción: un aprobador de
// contratos SÍ necesita poder abrir "Ver" aunque su rol sea "empleado" —
// si no, no podría leer el contrato antes de aprobarlo (ver puedeVer).
function cargarDocumentosContrato(contratoId, contrato, esEmpleado, puedeArchivar, esGestor, puedeVer) {
  const tbody = document.getElementById("listaDocumentosContrato");
  const sinDocs = document.getElementById("sinDocumentosContrato");
  const badge = document.getElementById("documentosBadge");
  const form = document.getElementById("nuevoDocumentoManualForm");
  const alertBox = document.getElementById("nuevoDocumentoManualAlert");
  const btn = document.getElementById("agregarDocumentoBtn");
  const idEnEdicionInput = document.getElementById("docIdEnEdicion");
  const abrirBtn = document.getElementById("agregarDocumentoManualBtn");
  const cancelarBtn = document.getElementById("cancelarDocumentoBtn");
  const modalBackdrop = document.getElementById("modalDocumentoBackdrop");
  const modalTitulo = document.getElementById("modalDocumentoTitulo");

  if (esEmpleado) abrirBtn.classList.add("oculto");

  // Cerrar la ventana sirve tanto de "Cancelar" (al agregar) como de salir
  // de edición sin guardar — antes eran dos botones/estados separados
  // dentro del <details> inline; con la ventana modal, cerrarla ya cubre
  // ambos casos.
  function cerrarModal() {
    idEnEdicionInput.value = "";
    form.reset();
    btn.textContent = "Agregar";
    alertBox.className = "form-alert";
    modalBackdrop.classList.remove("open");
  }
  cancelarBtn.addEventListener("click", cerrarModal);

  abrirBtn.addEventListener("click", () => {
    cerrarModal();
    modalTitulo.textContent = "Agregar documento";
    modalBackdrop.classList.add("open");
  });

  // Solo admin/coadmin cambian un documento ya archivado (pedido explícito
  // del usuario) — apoyo puede archivar/borrar pero no editar lo ya subido.
  function editarDocumento(docId, d) {
    idEnEdicionInput.value = docId;
    document.getElementById("docNombre").value = d.nombre || "";
    document.getElementById("docTipo").value = d.tipo || "interno";
    document.getElementById("docFecha").value = d.fecha || "";
    document.getElementById("docEnlace").value = d.origen === "manual" ? (d.enlace || "") : "";
    document.getElementById("docMes").value = d.mes || "";
    btn.textContent = "Guardar cambios";
    modalTitulo.textContent = "Editar documento";
    modalBackdrop.classList.add("open");
  }

  const enlaceDocumento = (d) => {
    if (d.origen === "documentos") return `documento.html?id=${d.refId}`;
    if (d.origen === "correspondencia") return `correspondencia.html?id=${d.refId}`;
    return d.enlace || "#";
  };

  // Sin orderBy en la consulta: el orden ya no es por creadoEn (cuándo se
  // subió) sino por la fecha real de la actuación contractual (docFecha del
  // formulario) — pedido del usuario para que la tabla siga el orden
  // cronológico de los hechos, no el de cuándo alguien tuvo tiempo de
  // subir el archivo. Se ordena en el cliente porque hay que mezclar dos
  // campos distintos (fecha manual vs. creadoEn de respaldo para los
  // documentos que vienen de Informes/Correspondencia, que no tienen
  // fecha manual) — con pocos documentos por contrato, ordenar acá no
  // tiene costo real.
  const fechaEfectiva = (d) => (d.fecha ? new Date(d.fecha + "T12:00:00") : (d.creadoEn?.toDate() || new Date(0)));
  const q = query(collection(db, "contratos", contratoId, "documentos"));
  onSnapshot(q, (snapshot) => {
    badge.textContent = String(snapshot.size);
    tbody.innerHTML = "";
    sinDocs.classList.toggle("oculto", !snapshot.empty);
    renderInformesMensuales(contrato, snapshot.docs.map((d) => d.data()).filter((d) => d.mes));
    const docsOrdenados = [...snapshot.docs].sort((a, b) => fechaEfectiva(b.data()) - fechaEfectiva(a.data()));
    docsOrdenados.forEach((docSnap) => {
      const d = docSnap.data();
      const fila = document.createElement("tr");
      // El documento del contrato es de origen externo (lo redacta el
      // cliente, no Cinco) — no le damos un consecutivo del SGC como a
      // Informes/Ofertas/Correspondencia (eso implicaría que Cinco lo
      // versiona, lo cual sería un hallazgo en una auditoría de calidad).
      // Sí queda trazable con el código del contrato mismo.
      const codigoMostrado = d.codigo || (d.tipo === "contrato" ? contrato.codigo : "—");
      fila.appendChild(campo("td", { text: codigoMostrado || "—" }));
      fila.appendChild(campo("td", { text: d.nombre || "" }));
      fila.appendChild(campo("td", { text: TIPO_DOC_LABEL[d.tipo] || d.tipo }));
      fila.appendChild(campo("td", { text: d.fecha ? formatearFechaCorta(d.fecha) : (d.creadoEn ? formatearFechaHora(d.creadoEn) : "") }));
      const tdAccion = document.createElement("td");
      tdAccion.className = "control-tabla-acciones";
      if (puedeVer) {
        // Fila delgada de una sola línea (mismo criterio que la tabla de
        // Activos en Copropiedad Saludable): ícono con title en vez de
        // botón de texto, para que "Ver/Editar/Borrar" quepan siempre en
        // una sola línea de la celda de acciones.
        const ver = document.createElement("a");
        ver.href = enlaceDocumento(d);
        ver.className = "icon-btn";
        ver.title = "Ver";
        ver.textContent = "👁️";
        if (d.origen === "manual") ver.target = "_blank";
        tdAccion.appendChild(ver);
      }
      // Solo los documentos manuales (subidos a mano, con enlace o archivo
      // desde este mismo formulario) se pueden editar/borrar aquí. Los que
      // vienen de Informes/Correspondencia se gestionan desde su propio
      // módulo, no como una fila suelta de esta lista.
      if (esGestor && d.origen === "manual") {
        const editar = document.createElement("button");
        editar.type = "button";
        editar.className = "icon-btn";
        editar.title = "Editar";
        editar.textContent = "✏️";
        editar.addEventListener("click", () => editarDocumento(docSnap.id, d));
        tdAccion.appendChild(editar);
      }
      if (puedeArchivar && d.origen === "manual") {
        const borrar = document.createElement("button");
        borrar.type = "button";
        borrar.className = "icon-btn danger";
        borrar.title = "Borrar";
        borrar.textContent = "🗑️";
        borrar.addEventListener("click", async () => {
          const confirmado = window.confirm(`¿Seguro que quieres borrar "${d.nombre}" de los documentos del contrato?\n\nEsta acción no se puede deshacer.`);
          if (!confirmado) return;
          borrar.disabled = true;
          try {
            await deleteDoc(docSnap.ref);
          } catch (err) {
            window.alert(err.message || "No se pudo borrar el documento.");
            borrar.disabled = false;
          }
        });
        tdAccion.appendChild(borrar);
      }
      fila.appendChild(tdAccion);
      tbody.appendChild(fila);
    });
  });

  const inputArchivoPdf = document.getElementById("docArchivoPdf");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.className = "form-alert";

    const idEnEdicion = idEnEdicionInput.value;
    const enlaceEscrito = document.getElementById("docEnlace").value;
    const archivo = inputArchivoPdf.files[0];
    if (!enlaceEscrito && !archivo) {
      alertBox.textContent = "Escribe un enlace o sube el archivo.";
      alertBox.className = "form-alert show error";
      return;
    }

    btn.disabled = true;
    try {
      const mes = document.getElementById("docMes").value;
      const docRef = idEnEdicion
        ? doc(db, "contratos", contratoId, "documentos", idEnEdicion)
        : doc(collection(db, "contratos", contratoId, "documentos"));

      let enlace = enlaceEscrito;
      if (archivo) {
        const extension = archivo.name.split(".").pop().toLowerCase();
        const archivoRef = ref(storage, `contratos/${contratoId}/documentos/${docRef.id}.${extension}`);
        await uploadBytes(archivoRef, archivo);
        enlace = await getDownloadURL(archivoRef);
      }

      const fecha = document.getElementById("docFecha").value;
      const datos = {
        nombre: document.getElementById("docNombre").value,
        tipo: document.getElementById("docTipo").value,
        enlace,
        ...(mes ? { mes } : {}),
        ...(fecha ? { fecha } : {})
      };

      if (idEnEdicion) {
        await updateDoc(docRef, {
          ...datos,
          actualizadoPor: auth.currentUser.email,
          actualizadoEn: serverTimestamp()
        });
      } else {
        await setDoc(docRef, {
          ...datos,
          origen: "manual",
          creadoPor: auth.currentUser.email,
          creadoEn: serverTimestamp()
        });
      }
      cerrarModal();
    } catch (err) {
      alertBox.textContent = err.message || "No se pudo guardar el documento.";
      alertBox.className = "form-alert show error";
    } finally {
      btn.disabled = false;
    }
  });
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  const contratoRef = doc(db, "contratos", id);
  const contratoSnap = await getDoc(contratoRef);
  if (!contratoSnap.exists()) {
    window.location.href = "contratos.html";
    return;
  }
  const contrato = contratoSnap.data();
  const perfil = await obtenerPerfil(user.email);
  const perfilActivo = perfil?.estado === "activo";
  const esAdmin = perfilActivo && perfil?.rol === "admin";
  const esCoadmin = perfilActivo && perfil?.rol === "coadmin";
  // "Gestor" = admin o coadministrador: edita todo el contrato salvo
  // borrarlo (esAdmin-only) y tocar empleados/roles (siempre esAdmin-only).
  const esGestor = esAdmin || esCoadmin;
  const esApoyo = perfilActivo && perfil?.rol === "apoyo";
  const esEmpleado = perfilActivo && perfil?.rol === "empleado";
  // Aprobador obligatorio (Empleados > "Debe leer y aprobar cada contrato
  // nuevo") — necesita poder abrir "Ver" en Documentos del contrato aunque
  // su rol de contratos sea "empleado", si no no podría leerlo antes de
  // aprobarlo (ver cargarDocumentosContrato).
  const esAprobador = perfilActivo && perfil?.aprobadorContratos === true;
  const camposPermitidos = new Set(esApoyo ? (perfil.camposPermitidos || []) : []);
  const camposVisibles = new Set(esEmpleado ? (perfil.camposVisibles || []) : []);

  // Qué puede tocar/ver cada rol en una columna del checklist (estado,
  // fecha, responsable, enlace, notas) — ver COLUMNAS_ITEM en plantillas.js.
  function permisoColumna(clave) {
    if (esGestor) return { editable: true, visible: true };
    if (esApoyo) return { editable: camposPermitidos.has(clave), visible: true };
    if (esEmpleado) return { editable: false, visible: camposVisibles.has(clave) };
    return { editable: false, visible: false };
  }
  const permisosItem = { esGestor, permisoColumna };

  function pintarCabecera() {
    document.getElementById("contratoCodigo").textContent = contrato.codigo || "";
    document.getElementById("contratoNombre").textContent = contrato.nombre;
    document.getElementById("contratoCliente").textContent = contrato.cliente;
    document.getElementById("contratoTipo").textContent = TIPO_LABEL[contrato.tipo] || contrato.tipo;
    document.getElementById("contratoNumero").textContent = contrato.numero ? `N.º ${contrato.numero}` : "";
    document.getElementById("contratoFechaInicio").textContent = contrato.fechaInicio || "—";
    document.getElementById("contratoFechaFin").textContent = contrato.fechaFin || "—";
    document.getElementById("contratoValor").textContent = contrato.valorContrato ? formatoMoneda.format(contrato.valorContrato) : "—";
    const supervisorEl = document.getElementById("contratoSupervisor");
    supervisorEl.textContent = contrato.supervisor || "—";
    supervisorEl.closest("label").classList.toggle("oculto", !contrato.supervisor);
  }
  pintarCabecera();
  const selectContratoEstado = document.getElementById("contratoEstado");
  selectContratoEstado.value = contrato.estado || "activo";
  selectContratoEstado.disabled = !esGestor;
  selectContratoEstado.addEventListener("change", (e) => {
    updateDoc(contratoRef, { estado: e.target.value, actualizadoEn: serverTimestamp() });
  });

  // ---- Edición de los datos básicos del contrato (admin/coadmin) ----
  const cabeceraVista = document.getElementById("cabeceraVista");
  const editarBtn = document.getElementById("editarContratoBtn");
  const editarForm = document.getElementById("editarContratoForm");
  const editarAlert = document.getElementById("editarContratoAlert");
  const guardarEdicionBtn = document.getElementById("guardarEdicionBtn");

  if (esGestor) {
    editarBtn.classList.remove("oculto");
    editarBtn.addEventListener("click", () => {
      document.getElementById("editNombre").value = contrato.nombre || "";
      document.getElementById("editCliente").value = contrato.cliente || "";
      document.getElementById("editTipo").value = contrato.tipo || "obra";
      document.getElementById("editNumero").value = contrato.numero || "";
      document.getElementById("editValorContrato").value = contrato.valorContrato || "";
      document.getElementById("editFechaInicio").value = contrato.fechaInicio || "";
      document.getElementById("editFechaFin").value = contrato.fechaFin || "";
      document.getElementById("editSupervisor").value = contrato.supervisor || "";
      editarAlert.className = "form-alert";
      cabeceraVista.classList.add("oculto");
      editarForm.classList.remove("oculto");
    });

    document.getElementById("cancelarEdicionBtn").addEventListener("click", () => {
      editarForm.classList.add("oculto");
      cabeceraVista.classList.remove("oculto");
    });

    editarForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      guardarEdicionBtn.disabled = true;
      guardarEdicionBtn.textContent = "Guardando...";
      try {
        const cambios = {
          nombre: capitalizarOracion(document.getElementById("editNombre").value),
          cliente: capitalizarNombrePropio(document.getElementById("editCliente").value),
          tipo: document.getElementById("editTipo").value,
          numero: document.getElementById("editNumero").value,
          valorContrato: Number(document.getElementById("editValorContrato").value) || null,
          fechaInicio: document.getElementById("editFechaInicio").value,
          fechaFin: document.getElementById("editFechaFin").value || null,
          supervisor: capitalizarNombrePropio(document.getElementById("editSupervisor").value),
          actualizadoEn: serverTimestamp()
        };
        await updateDoc(contratoRef, cambios);
        Object.assign(contrato, cambios);
        pintarCabecera();
        editarForm.classList.add("oculto");
        cabeceraVista.classList.remove("oculto");
      } catch (err) {
        editarAlert.textContent = err.message || "No se pudo guardar los cambios.";
        editarAlert.className = "form-alert show error";
      } finally {
        guardarEdicionBtn.disabled = false;
        guardarEdicionBtn.textContent = "Guardar cambios";
      }
    });
  }

  const itemsSnap = await getDocs(query(collection(db, "contratos", id, "items"), orderBy("orden")));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  const borrarBtn = document.getElementById("borrarContratoBtn");
  if (esAdmin) borrarBtn.classList.remove("oculto");
  borrarBtn.addEventListener("click", async () => {
    const confirmado = window.confirm(
      `¿Seguro que quieres borrar el contrato "${contrato.nombre}"?\n\nEsta acción no se puede deshacer: se pierde todo el checklist (Servicio al Cliente, Talento Humano y Actividades) registrado en él.`
    );
    if (!confirmado) return;
    const documentosSnap = await getDocs(collection(db, "contratos", id, "documentos"));
    await Promise.all(items.map((item) => deleteDoc(item.ref)));
    await Promise.all(documentosSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(contratoRef);
    window.location.href = "contratos.html";
  });

  const empleadosSnap = await getDocs(query(collection(db, "empleados"), orderBy("nombre")));
  const empleados = empleadosSnap.docs.map((d) => d.data());

  cargarEquipo(contratoRef, contrato, esGestor, empleados);
  cargarAprobaciones(contratoRef, contrato, empleados, user);
  // Mismo permiso que exige la regla de Firestore para escribir en
  // contratos/{id}/documentos: gestor siempre, apoyo solo si está en el
  // equipo de este contrato puntual.
  const puedeArchivar = esGestor || (esApoyo && (contrato.equipo || []).includes(user.email));
  cargarDocumentosContrato(id, contrato, esEmpleado, puedeArchivar, esGestor, !esEmpleado || esAprobador);

  const badges = { general: document.getElementById("avanceGeneral") };
  const contenedor = document.getElementById("camposContainer");

  function recalcularAvances() {
    const general = badgeAvance(items);
    badges.general.textContent = "Avance general: " + general.texto;
    badges.general.classList.toggle("completo", general.completo);
    CAMPOS.forEach((c) => {
      aplicarBadgeAvance(badges[c.clave], items.filter((i) => i.campo === c.clave));
    });
    if (badges.actividades_fases) {
      FASES.forEach((f) => {
        const el = badges.actividades_fases[f.clave];
        aplicarBadgeAvance(el, items.filter((i) => i.campo === "actividades" && i.fase === f.clave));
      });
    }
  }

  badges.actividades_fases = {};

  // Botón para agregar un ítem suelto al checklist de un contrato ya
  // creado — la plantilla (plantillas.js) solo se aplica al crear el
  // contrato, así que si cambia después (o hace falta algo puntual para
  // este contrato), no había forma de sumarlo sin tocar la base de datos
  // a mano. Solo Admin/Coadministrador, igual que el resto de cambios
  // estructurales del checklist.
  function botonAgregarItem(campoClave, faseClave) {
    const btn = campo("button", { type: "button", class: "control-btn-mini" });
    btn.textContent = "+ Agregar ítem";
    btn.addEventListener("click", async () => {
      const nombre = window.prompt("Nombre del nuevo ítem del checklist:");
      if (!nombre || !nombre.trim()) return;
      btn.disabled = true;
      try {
        const ordenMax = Math.max(0, ...items.map((i) => i.orden || 0));
        const itemRef = doc(collection(db, "contratos", id, "items"));
        await setDoc(itemRef, {
          clave: `manual_${Date.now()}`, nombre: nombre.trim(), fase: faseClave, campo: campoClave,
          orden: ordenMax + 1, estado: "pendiente", responsable: "", fecha: null, enlace: "", notas: "",
          actualizadoEn: serverTimestamp(), actualizadoPor: user.email
        });
        window.location.reload();
      } catch (err) {
        window.alert(err.message || "No se pudo agregar el ítem.");
        btn.disabled = false;
      }
    });
    return btn;
  }

  // Numeración pedida por el usuario para las "carpetas" del contrato: los
  // 3 CAMPOS dinámicos (1/2/4 — Equipo asignado ocupa el 3, ver más abajo),
  // las fases de Actividades como 4.1/4.2/4.3, y Equipo/Informes/Documentos
  // fijos en el HTML (contrato.html) como 3/5/6.
  const NUMERO_CAMPO = { servicio_cliente: "1", talento_humano: "2", actividades: "4" };

  let detalleActividades = null;
  CAMPOS.forEach((c) => {
    const detalle = campo("details", { class: "card control-campo" });
    const resumen = document.createElement("summary");
    resumen.appendChild(campo("span", { text: `${NUMERO_CAMPO[c.clave]}. ${c.nombre}` }));
    const badge = campo("span", { class: "control-badge" });
    badges[c.clave] = badge;
    resumen.appendChild(badge);
    detalle.appendChild(resumen);

    const itemsDelCampo = items.filter((i) => i.campo === c.clave);

    if (c.clave === "actividades") {
      detalleActividades = detalle;
      FASES.forEach((f, idxFase) => {
        const itemsFase = itemsDelCampo.filter((i) => i.fase === f.clave);
        if (!itemsFase.length) return;
        const detalleFase = campo("details", { class: "control-fase" });
        const resumenFase = document.createElement("summary");
        resumenFase.appendChild(campo("span", { text: `4.${idxFase + 1} ${f.nombre}` }));
        const badgeFase = campo("span", { class: "control-badge" });
        badges.actividades_fases[f.clave] = badgeFase;
        resumenFase.appendChild(badgeFase);
        detalleFase.appendChild(resumenFase);

        const lista = campo("div", { class: "control-items" });
        lista.appendChild(encabezadoItems());
        itemsFase.forEach((item) => crearFilaItem(item, user, recalcularAvances, lista, items, permisosItem));
        detalleFase.appendChild(lista);
        if (esGestor) detalleFase.appendChild(botonAgregarItem("actividades", f.clave));
        detalle.appendChild(detalleFase);
      });
    } else {
      const lista = campo("div", { class: "control-items" });
      lista.appendChild(encabezadoItems());
      itemsDelCampo.forEach((item) => crearFilaItem(item, user, recalcularAvances, lista, items, permisosItem));
      detalle.appendChild(lista);
      if (esGestor) detalle.appendChild(botonAgregarItem(c.clave, null));
    }

    contenedor.appendChild(detalle);
  });

  // "Equipo asignado" (3.) vive como <details> estático en contrato.html,
  // fuera de camposContainer — se reubica acá para que quede entre Talento
  // Humano (2.) y Actividades (4.), como pidió el usuario. cargarEquipo()
  // ya cableó sus listeners sobre ese mismo nodo antes de este punto, así
  // que moverlo con insertBefore no los pierde.
  const equipoDetails = document.getElementById("equipoDetails");
  if (equipoDetails && detalleActividades) {
    contenedor.insertBefore(equipoDetails, detalleActividades);
  }

  recalcularAvances();
});
