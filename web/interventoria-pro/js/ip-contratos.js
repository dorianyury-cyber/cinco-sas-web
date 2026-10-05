// Contratos de Interventoría PRO: en una sola página, el estado de todos
// los contratos (semáforo, avance, alertas — antes "Tablero de contratos"),
// la información básica de cada uno (numeral "Información Básica del
// Contrato" del informe). El equipo de cada contrato se asigna aparte, en
// Equipo de interventoría (equipo.html).
// El gestor crea/edita contratos y define quién del personal de Cinco
// S.A.S. trabaja en cada uno; los miembros solo ven los suyos.
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { anotarEnLote, diferencias } from "./ip-historial.js";
import { montarTablero } from "./ip-tablero.js";
import {
  db, iniciarPagina, pintarEncabezado, esc, moneda, numero, fecha, fechaCorta, mostrarAlerta, limpiarAlerta, errorAmigable,
  fijarContratoActivo, abrirModal, cerrarModal, diasEntre, hoyISO, imgModulo
} from "./ip-core.js";

const ctx = await iniciarPagina({ requiereContrato: false });
if (ctx) iniciar(ctx);

async function iniciar({ user, perfil, esGestor, contratos, contrato }) {
  pintarEncabezado(`${imgModulo("contratos", "ip-h1-foto")} ${esGestor ? "Contratos" : "Mis contratos"}`, null);
  const form = document.getElementById("contratoForm");
  const alerta = document.getElementById("contratoAlerta");
  const esAdmin = perfil.rol === "admin";
  let editandoId = null;

  if (esGestor) document.getElementById("nuevoContratoBtn").classList.remove("hidden");

  // ---------------------------------------------------------- formulario
  const CAMPOS = ["numero", "tipo", "estado", "objeto", "municipio", "objetivo", "alcance", "frentes", "contratante", "contratista", "supervisor", "director", "valorInicial", "anticipoPct", "fechaInicio", "fechaFin", "plazo", "smmlv"];
  const NUMERICOS = new Set(["valorInicial", "anticipoPct", "smmlv"]);
  // Etiquetas y tipos para el historial de cambios del contrato.
  const ETIQUETAS = { numero: "Contrato N.º", tipo: "Tipo de interventoría", estado: "Estado", objeto: "Objeto", municipio: "Municipio", objetivo: "Objetivo", alcance: "Alcance", frentes: "Proyectos / frentes", contratante: "Contratante", contratista: "Contratista", supervisor: "Supervisor", director: "Director / interventor", valorInicial: "Valor inicial", anticipoPct: "Anticipo (%)", fechaInicio: "Fecha de inicio", fechaFin: "Fecha de terminación", plazo: "Plazo", smmlv: "SMMLV" };
  const CAMPOS_HIST = CAMPOS.map((k) => ({ key: k, label: ETIQUETAS[k] || k, type: ["valorInicial", "smmlv"].includes(k) ? "money" : k.startsWith("fecha") ? "date" : "text" }));


  function abrirFormulario(c = null) {
    editandoId = c?.id || null;
    limpiarAlerta(alerta);
    document.getElementById("contratoFormTitulo").textContent = c ? `Editar contrato ${c.numero || ""}` : "Nuevo contrato";
    CAMPOS.forEach((k) => { document.getElementById(`c_${k}`).value = c?.[k] ?? (k === "estado" ? "Activo" : k === "tipo" ? "Servicios" : k === "contratista" ? "CINCO S.A.S." : ""); });
    document.getElementById("contratoEliminarBtn").classList.toggle("hidden", !(c && esAdmin));
    abrirModal("contratoModal");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarAlerta(alerta);
    const datos = {};
    CAMPOS.forEach((k) => {
      const v = document.getElementById(`c_${k}`).value.trim();
      datos[k] = NUMERICOS.has(k) ? (v === "" ? null : Number(v)) : v;
    });
    if (datos.fechaFin && datos.fechaInicio && datos.fechaFin < datos.fechaInicio) {
      mostrarAlerta(alerta, "La fecha de terminación no puede ser anterior a la de inicio.");
      return;
    }
    datos.actualizadoEn = serverTimestamp();
    datos.actualizadoPor = user.email;
    const btn = document.getElementById("contratoGuardarBtn");
    btn.disabled = true;
    try {
      // El cambio al contrato y su entrada de historial van en un solo lote.
      const lote = writeBatch(db);
      if (editandoId) {
        const antes = contratos.find((c) => c.id === editandoId) || {};
        const cambios = diferencias(CAMPOS_HIST, antes, datos);
        lote.update(doc(db, "ipContratos", editandoId), datos);
        if (cambios.length) anotarEnLote(lote, editandoId, { user, perfil, modulo: "contrato", moduloLabel: "Información del contrato", registroId: editandoId, accion: "contrato", resumen: `Contrato ${datos.numero}`, cambios });
      } else {
        datos.creadoEn = serverTimestamp();
        datos.miembros = [user.email];
        datos.creadoPor = user.email;
        const nuevo = doc(collection(db, "ipContratos"));
        lote.set(nuevo, datos);
        anotarEnLote(lote, nuevo.id, { user, perfil, modulo: "contrato", moduloLabel: "Información del contrato", registroId: nuevo.id, accion: "crear", resumen: `Contrato ${datos.numero}` });
        fijarContratoActivo(nuevo.id);
      }
      await lote.commit();
      location.reload();
    } catch (err) {
      mostrarAlerta(alerta, errorAmigable(err));
      btn.disabled = false;
    }
  });

  document.getElementById("contratoEliminarBtn").addEventListener("click", async () => {
    const c = contratos.find((x) => x.id === editandoId);
    const escrito = prompt(`Esto elimina el contrato ${c.numero} de Interventoría PRO y deja inaccesible todo lo registrado en él.\n\nPara confirmar, escribe el número del contrato:`);
    if (escrito == null) return;
    if (escrito.trim() !== String(c.numero).trim()) { mostrarAlerta(alerta, "El número no coincide; no se eliminó nada."); return; }
    try {
      await deleteDoc(doc(db, "ipContratos", editandoId));
      location.reload();
    } catch (err) {
      mostrarAlerta(alerta, errorAmigable(err));
    }
  });

  document.getElementById("nuevoContratoBtn").addEventListener("click", () => abrirFormulario());
  document.getElementById("contratoCancelarBtn").addEventListener("click", () => cerrarModal("contratoModal"));
  document.getElementById("contratoModal").addEventListener("click", (e) => { if (e.target.id === "contratoModal") cerrarModal("contratoModal"); });

  // Lista con semáforo + ficha del seleccionado (ip-tablero.js). El gestor
  // edita desde la ficha.
  montarTablero({ contratos, activo: contrato, esGestor, onEditar: abrirFormulario });
  const editar = new URLSearchParams(location.search).get("editar");
  if (editar && esGestor) {
    const c = contratos.find((x) => x.id === editar);
    if (c) abrirFormulario(c);
  }
}
