import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, getDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, onSnapshot,
  query, orderBy, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { CAMPOS, FASES, COLUMNAS_ITEM } from "./plantillas.js";
import { capitalizarOracion, capitalizarNombrePropio } from "./texto.js";

const TIPO_DOC_LABEL = { interno: "Interno", externo: "Externo" };

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
  if (!relevantes.length) return "—";
  const completos = relevantes.filter((i) => i.estado === "completado").length;
  return `${completos}/${relevantes.length}`;
}

// ---- Equipo asignado ----
// Solo admin/coadmin ven el formulario para agregar/quitar (las reglas de
// Firestore también lo exigen); el resto del equipo ve la lista en
// solo lectura.
async function cargarEquipo(contratoRef, contrato, puedeGestionar) {
  const lista = document.getElementById("equipoLista");
  const badge = document.getElementById("equipoBadge");
  const form = document.getElementById("agregarEquipoForm");
  const select = document.getElementById("equipoSelect");
  const alertBox = document.getElementById("equipoAlert");

  const empleadosSnap = await getDocs(query(collection(db, "empleados"), orderBy("nombre")));
  const empleados = empleadosSnap.docs.map((d) => d.data());
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

// ---- Documentos del contrato ----
// Combina lo que llega solo (desde Documentos/Correspondencia, cuando esa
// carta o formato se creó eligiendo este contrato) con lo agregado a mano
// para lo que no pasa por ninguno de los dos generadores todavía. Admin,
// coadmin y apoyo pueden ver y agregar filas manuales; "empleado" solo ve
// la lista (ni "Ver" ni "+ Agregar documento manual" — aviso: al igual que
// camposVisibles, ocultar "Ver" es solo de interfaz, no bloquea el dato en
// Firestore; lo que sí es una barrera real es que la regla de Firestore le
// niega crear filas en esta subcolección).
function cargarDocumentosContrato(contratoId, esEmpleado) {
  const tbody = document.getElementById("listaDocumentosContrato");
  const sinDocs = document.getElementById("sinDocumentosContrato");
  const badge = document.getElementById("documentosBadge");
  const form = document.getElementById("nuevoDocumentoManualForm");
  const alertBox = document.getElementById("nuevoDocumentoManualAlert");
  const btn = document.getElementById("agregarDocumentoBtn");

  if (esEmpleado) form.closest("details").classList.add("oculto");

  const enlaceDocumento = (d) => {
    if (d.origen === "documentos") return `documento.html?id=${d.refId}`;
    if (d.origen === "correspondencia") return `correspondencia.html?id=${d.refId}`;
    return d.enlace || "#";
  };

  const q = query(collection(db, "contratos", contratoId, "documentos"), orderBy("creadoEn", "desc"));
  onSnapshot(q, (snapshot) => {
    badge.textContent = String(snapshot.size);
    tbody.innerHTML = "";
    sinDocs.classList.toggle("oculto", !snapshot.empty);
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const fila = document.createElement("tr");
      fila.appendChild(campo("td", { text: d.codigo || "—" }));
      fila.appendChild(campo("td", { text: d.nombre || "" }));
      fila.appendChild(campo("td", { text: TIPO_DOC_LABEL[d.tipo] || d.tipo }));
      fila.appendChild(campo("td", { text: d.creadoEn ? formatearFechaHora(d.creadoEn) : "" }));
      const tdVer = document.createElement("td");
      if (!esEmpleado) {
        const ver = document.createElement("a");
        ver.href = enlaceDocumento(d);
        ver.className = "control-btn-mini";
        ver.textContent = "Ver";
        if (d.origen === "manual") ver.target = "_blank";
        tdVer.appendChild(ver);
      }
      fila.appendChild(tdVer);
      tbody.appendChild(fila);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    alertBox.className = "form-alert";
    try {
      await addDoc(collection(db, "contratos", contratoId, "documentos"), {
        nombre: document.getElementById("docNombre").value,
        tipo: document.getElementById("docTipo").value,
        enlace: document.getElementById("docEnlace").value,
        origen: "manual",
        creadoPor: auth.currentUser.email,
        creadoEn: serverTimestamp()
      });
      form.reset();
      form.closest("details").open = false;
      alertBox.textContent = "Documento agregado.";
      alertBox.className = "form-alert show ok";
    } catch (err) {
      alertBox.textContent = err.message || "No se pudo agregar el documento.";
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

  await cargarEquipo(contratoRef, contrato, esGestor);
  cargarDocumentosContrato(id, esEmpleado);

  const badges = { general: document.getElementById("avanceGeneral") };
  const contenedor = document.getElementById("camposContainer");

  function recalcularAvances() {
    badges.general.textContent = "Avance general: " + badgeAvance(items);
    CAMPOS.forEach((c) => {
      if (badges[c.clave]) badges[c.clave].textContent = badgeAvance(items.filter((i) => i.campo === c.clave));
    });
    if (badges.actividades_fases) {
      FASES.forEach((f) => {
        const el = badges.actividades_fases[f.clave];
        if (el) el.textContent = badgeAvance(items.filter((i) => i.campo === "actividades" && i.fase === f.clave));
      });
    }
  }

  badges.actividades_fases = {};

  CAMPOS.forEach((c) => {
    const detalle = campo("details", { class: "card control-campo" });
    const resumen = document.createElement("summary");
    resumen.appendChild(campo("span", { text: c.nombre }));
    const badge = campo("span", { class: "control-badge" });
    badges[c.clave] = badge;
    resumen.appendChild(badge);
    detalle.appendChild(resumen);

    const itemsDelCampo = items.filter((i) => i.campo === c.clave);

    if (c.clave === "actividades") {
      FASES.forEach((f) => {
        const itemsFase = itemsDelCampo.filter((i) => i.fase === f.clave);
        if (!itemsFase.length) return;
        const detalleFase = campo("details", { class: "control-fase" });
        const resumenFase = document.createElement("summary");
        resumenFase.appendChild(campo("span", { text: f.nombre }));
        const badgeFase = campo("span", { class: "control-badge" });
        badges.actividades_fases[f.clave] = badgeFase;
        resumenFase.appendChild(badgeFase);
        detalleFase.appendChild(resumenFase);

        const lista = campo("div", { class: "control-items" });
        lista.appendChild(encabezadoItems());
        itemsFase.forEach((item) => crearFilaItem(item, user, recalcularAvances, lista, items, permisosItem));
        detalleFase.appendChild(lista);
        detalle.appendChild(detalleFase);
      });
    } else {
      const lista = campo("div", { class: "control-items" });
      lista.appendChild(encabezadoItems());
      itemsDelCampo.forEach((item) => crearFilaItem(item, user, recalcularAvances, lista, items, permisosItem));
      detalle.appendChild(lista);
    }

    contenedor.appendChild(detalle);
  });

  recalcularAvances();
});
