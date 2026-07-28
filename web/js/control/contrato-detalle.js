import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth } from "./firebase-control.js";
import { CAMPOS, FASES } from "./plantillas.js";

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

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  const contratoRef = doc(db, "contratos", id);
  const contratoSnap = await getDoc(contratoRef);
  if (!contratoSnap.exists()) {
    window.location.href = "contratos.html";
    return;
  }
  const contrato = contratoSnap.data();

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

  document.getElementById("borrarContratoBtn").addEventListener("click", async () => {
    const confirmado = window.confirm(
      `¿Seguro que quieres borrar el contrato "${contrato.nombre}"?\n\nEsta acción no se puede deshacer: se pierde todo el checklist (Servicio al Cliente, Talento Humano y Actividades) registrado en él.`
    );
    if (!confirmado) return;
    await Promise.all(items.map((item) => deleteDoc(item.ref)));
    await deleteDoc(contratoRef);
    window.location.href = "contratos.html";
  });

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
