// Contratos de Interventoría PRO: en una sola página, el estado de todos
// los contratos (semáforo, avance, alertas — antes "Tablero de contratos"),
// la información básica de cada uno (numeral "Información Básica del
// Contrato" del informe) y su equipo.
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
  const miembrosEl = document.getElementById("c_miembros");
  const buscarMiembro = document.getElementById("c_buscarMiembro");
  const esAdmin = perfil.rol === "admin";
  let editandoId = null;
  let empleados = [];
  let seleccion = new Set();

  if (esGestor) {
    document.getElementById("nuevoContratoBtn").classList.remove("hidden");
    const snap = await getDocs(collection(db, "empleados"));
    empleados = snap.docs.map((d) => ({ email: d.id, ...d.data() }))
      .filter((e) => e.estado === "activo")
      .sort((a, b) => String(a.nombre || a.email).localeCompare(String(b.nombre || b.email), "es"));
  }

  // ---------------------------------------------------------- formulario
  const CAMPOS = ["numero", "tipo", "estado", "objeto", "municipio", "objetivo", "alcance", "frentes", "contratante", "contratista", "supervisor", "director", "valorInicial", "anticipoPct", "fechaInicio", "fechaFin", "plazo", "smmlv"];
  const NUMERICOS = new Set(["valorInicial", "anticipoPct", "smmlv"]);
  // Etiquetas y tipos para el historial de cambios del contrato.
  const ETIQUETAS = { numero: "Contrato N.º", tipo: "Tipo de interventoría", estado: "Estado", objeto: "Objeto", municipio: "Municipio", objetivo: "Objetivo", alcance: "Alcance", frentes: "Proyectos / frentes", contratante: "Contratante", contratista: "Contratista", supervisor: "Supervisor", director: "Director / interventor", valorInicial: "Valor inicial", anticipoPct: "Anticipo (%)", fechaInicio: "Fecha de inicio", fechaFin: "Fecha de terminación", plazo: "Plazo", smmlv: "SMMLV" };
  const CAMPOS_HIST = CAMPOS.map((k) => ({ key: k, label: ETIQUETAS[k] || k, type: ["valorInicial", "smmlv"].includes(k) ? "money" : k.startsWith("fecha") ? "date" : "text" }));

  function pintarMiembros() {
    const t = buscarMiembro.value.trim().toLowerCase();
    const visibles = empleados.filter((e) => !t || `${e.nombre || ""} ${e.email} ${e.cargo || ""}`.toLowerCase().includes(t));
    miembrosEl.innerHTML = visibles.map((e) => `
      <label class="ip-miembro"><input type="checkbox" value="${esc(e.email)}" ${seleccion.has(e.email) ? "checked" : ""}>
        <span><strong>${esc(e.nombre || e.email)}</strong> <span class="text-muted">${esc(e.cargo || "")} · ${esc(e.email)}</span></span></label>`).join("")
      || '<p class="text-muted ip-sin-margen">Ningún empleado coincide.</p>';
    miembrosEl.querySelectorAll("input[type=checkbox]").forEach((chk) => chk.addEventListener("change", () => {
      if (chk.checked) seleccion.add(chk.value); else seleccion.delete(chk.value);
    }));
  }
  buscarMiembro.addEventListener("input", pintarMiembros);

  function abrirFormulario(c = null) {
    editandoId = c?.id || null;
    limpiarAlerta(alerta);
    document.getElementById("contratoFormTitulo").textContent = c ? `Editar contrato ${c.numero || ""}` : "Nuevo contrato";
    CAMPOS.forEach((k) => { document.getElementById(`c_${k}`).value = c?.[k] ?? (k === "estado" ? "Activo" : k === "tipo" ? "Servicios" : k === "contratista" ? "CINCO S.A.S." : ""); });
    seleccion = new Set(c?.miembros || [user.email]);
    buscarMiembro.value = "";
    pintarMiembros();
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
    datos.miembros = [...seleccion];
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
        const antesEq = new Set(antes.miembros || []);
        const agregados = datos.miembros.filter((m) => !antesEq.has(m));
        const quitados = [...antesEq].filter((m) => !datos.miembros.includes(m));
        if (agregados.length || quitados.length) cambios.push({ campo: "miembros", etiqueta: "Equipo", antes: quitados.length ? `Salen: ${quitados.join(", ")}` : "—", despues: agregados.length ? `Entran: ${agregados.join(", ")}` : "—" });
        lote.update(doc(db, "ipContratos", editandoId), datos);
        if (cambios.length) anotarEnLote(lote, editandoId, { user, perfil, modulo: "contrato", moduloLabel: "Información del contrato", registroId: editandoId, accion: "contrato", resumen: `Contrato ${datos.numero}`, cambios });
      } else {
        datos.creadoEn = serverTimestamp();
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
