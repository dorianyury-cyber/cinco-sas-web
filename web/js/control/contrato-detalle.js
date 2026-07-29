import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, getDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, onSnapshot,
  query, orderBy, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { CAMPOS, FASES } from "./plantillas.js";

const TIPO_DOC_LABEL = { interno: "Interno", externo: "Externo" };

const TIPO_LABEL = { obra: "Obra / Interventoría", consultoria: "Consultoría" };
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

// Fila compacta de un ítem del checklist, más un panel de detalle opcional
// (oculto por defecto) con historial de estados y verificación — se abre
// con el botón "⋯" para no recargar visualmente la tabla del día a día.
// Se construye con la API del DOM (sin innerHTML) para no exponer los
// valores guardados por el usuario (notas, responsable...) a inyección de HTML.
function crearFilaItem(item, user, onEstadoChange, contenedor, todosLosItems) {
  const fila = campo("div", { class: "control-item" });

  fila.appendChild(campo("span", { class: "control-item-nombre", text: item.nombre }));

  const selectEstado = document.createElement("select");
  selectEstado.className = "control-item-estado";
  ESTADOS.forEach((e) => {
    const opt = campo("option", { value: e.valor, text: e.label });
    if (e.valor === item.estado) opt.selected = true;
    selectEstado.appendChild(opt);
  });
  fila.appendChild(selectEstado);

  const fecha = document.createElement("input");
  fecha.type = "date";
  fecha.className = "control-item-fecha";
  fecha.value = item.fecha || "";
  fila.appendChild(fecha);

  const responsable = document.createElement("input");
  responsable.type = "text";
  responsable.className = "control-item-responsable";
  responsable.placeholder = "Responsable";
  responsable.maxLength = 80;
  responsable.value = item.responsable || "";
  fila.appendChild(responsable);

  const enlace = document.createElement("input");
  enlace.type = "url";
  enlace.className = "control-item-enlace";
  enlace.placeholder = "Enlace OneDrive";
  enlace.maxLength = 500;
  enlace.value = item.enlace || "";
  fila.appendChild(enlace);

  const celdaNotas = campo("div", { class: "control-item-notas-celda" });
  const notas = document.createElement("input");
  notas.type = "text";
  notas.className = "control-item-notas";
  notas.placeholder = "Notas";
  notas.maxLength = 200;
  notas.value = item.notas || "";
  celdaNotas.appendChild(notas);

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
  labelVerifPor.appendChild(verificadoPor);
  filaVerif.appendChild(labelVerifPor);

  const labelVerifFecha = campo("label", { text: "Fecha de verificación " });
  const fechaVerificacion = document.createElement("input");
  fechaVerificacion.type = "date";
  fechaVerificacion.value = item.fechaVerificacion || "";
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
// Solo un admin ve el formulario para agregar/quitar (las reglas de
// Firestore también lo exigen); el resto del equipo ve la lista en
// solo lectura.
async function cargarEquipo(contratoRef, contrato, esAdmin) {
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
      if (esAdmin) {
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

  if (esAdmin) {
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
// para lo que no pasa por ninguno de los dos generadores todavía. Cualquiera
// con acceso al contrato (admin o equipo) puede agregar filas manuales —
// solo "Equipo asignado" es admin-only, según las reglas de Firestore.
function cargarDocumentosContrato(contratoId) {
  const tbody = document.getElementById("listaDocumentosContrato");
  const sinDocs = document.getElementById("sinDocumentosContrato");
  const badge = document.getElementById("documentosBadge");
  const form = document.getElementById("nuevoDocumentoManualForm");
  const alertBox = document.getElementById("nuevoDocumentoManualAlert");
  const btn = document.getElementById("agregarDocumentoBtn");

  const enlaceDocumento = (d) => {
    if (d.origen === "documentos") return `documento.html?id=${d.refId}`;
    if (d.origen === "correspondencia") return "correspondencia.html";
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
      const ver = document.createElement("a");
      ver.href = enlaceDocumento(d);
      ver.className = "control-btn-mini";
      ver.textContent = "Ver";
      if (d.origen === "manual") ver.target = "_blank";
      tdVer.appendChild(ver);
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
  const esAdmin = perfil?.estado === "activo" && perfil?.rol === "admin";

  document.getElementById("contratoCodigo").textContent = contrato.codigo || "";
  document.getElementById("contratoNombre").textContent = contrato.nombre;
  document.getElementById("contratoCliente").textContent = contrato.cliente;
  document.getElementById("contratoTipo").textContent = TIPO_LABEL[contrato.tipo] || contrato.tipo;
  document.getElementById("contratoNumero").textContent = contrato.numero ? `N.º ${contrato.numero}` : "";
  document.getElementById("contratoFechaInicio").textContent = contrato.fechaInicio || "—";
  document.getElementById("contratoEstado").value = contrato.estado || "activo";
  document.getElementById("contratoEstado").addEventListener("change", (e) => {
    updateDoc(contratoRef, { estado: e.target.value, actualizadoEn: serverTimestamp() });
  });

  const itemsSnap = await getDocs(query(collection(db, "contratos", id, "items"), orderBy("orden")));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  const borrarBtn = document.getElementById("borrarContratoBtn");
  if (esAdmin) borrarBtn.classList.remove("oculto");
  borrarBtn.addEventListener("click", async () => {
    const confirmado = window.confirm(
      `¿Seguro que quieres borrar el contrato "${contrato.nombre}"?\n\nEsta acción no se puede deshacer: se pierde todo el checklist (Servicio al Cliente, Talento Humano y Actividades) registrado en él.`
    );
    if (!confirmado) return;
    await Promise.all(items.map((item) => deleteDoc(item.ref)));
    await deleteDoc(contratoRef);
    window.location.href = "contratos.html";
  });

  await cargarEquipo(contratoRef, contrato, esAdmin);
  cargarDocumentosContrato(id);

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
        itemsFase.forEach((item) => crearFilaItem(item, user, recalcularAvances, lista, items));
        detalleFase.appendChild(lista);
        detalle.appendChild(detalleFase);
      });
    } else {
      const lista = campo("div", { class: "control-items" });
      lista.appendChild(encabezadoItems());
      itemsDelCampo.forEach((item) => crearFilaItem(item, user, recalcularAvances, lista, items));
      detalle.appendChild(lista);
    }

    contenedor.appendChild(detalle);
  });

  recalcularAvances();
});
