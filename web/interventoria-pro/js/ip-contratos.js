// Contratos de Interventoría PRO: información básica de cada contrato
// (numeral "Información Básica del Contrato" del informe) y su equipo.
// El gestor crea/edita contratos y define quién del personal de Cinco
// S.A.S. trabaja en cada uno; los miembros solo ven los suyos.
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  db, iniciarPagina, pintarEncabezado, esc, moneda, numero, fecha, fechaCorta, mostrarAlerta, limpiarAlerta, errorAmigable,
  fijarContratoActivo, abrirModal, cerrarModal, diasEntre, hoyISO, imgModulo
} from "./ip-core.js";

const ctx = await iniciarPagina({ requiereContrato: false });
if (ctx) iniciar(ctx);

async function iniciar({ user, perfil, esGestor, contratos, contrato }) {
  pintarEncabezado(`${imgModulo("contratos", "ip-h1-foto")} ${esGestor ? "Contratos" : "Mis contratos"}`, contrato);
  const lista = document.getElementById("contratosLista");
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

  // ---------------------------------------------------------- ficha del contrato activo
  function pintarFicha() {
    const el = document.getElementById("ipFicha");
    if (!contrato) { el.innerHTML = ""; return; }
    const c = contrato;
    const transcurrido = c.fechaInicio && c.fechaFin
      ? Math.max(0, Math.min(100, Math.round((diasEntre(c.fechaInicio, hoyISO()) / (diasEntre(c.fechaInicio, c.fechaFin) || 1)) * 100)))
      : null;
    const fila = (k, v) => `<tr><th>${k}</th><td>${v || "-"}</td></tr>`;
    el.innerHTML = `<div class="card cinta cinta-0">
      <h2>🗂️ Información básica del contrato activo</h2>
      <table class="tabla-compacta ip-tabla-ficha"><tbody>
        ${fila("Contrato N.º", esc(c.numero))}
        ${fila("Objeto", esc(c.objeto))}
        ${fila("Contratante", esc(c.contratante))}
        ${fila("Tipo de interventoría", esc(c.tipo || "Servicios"))}
        ${fila("Contratista / proveedor", esc(c.contratista))}
        ${fila("Municipio", esc(c.municipio))}
        ${fila("Proyectos / frentes", esc(String(c.frentes || "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).join(" · ")))}
        ${fila("Supervisor", esc(c.supervisor))}
        ${fila("Director / interventor", esc(c.director))}
        ${fila("Valor inicial", c.valorInicial ? moneda(c.valorInicial) : "-")}
        ${fila("Anticipo", c.anticipoPct ? `${numero(c.anticipoPct, 1)}%` : "-")}
        ${fila("Fecha de inicio", fecha(c.fechaInicio))}
        ${fila("Fecha de terminación", fecha(c.fechaFin))}
        ${fila("Plazo", esc(c.plazo))}
        ${fila("Tiempo transcurrido", transcurrido == null ? "-" : `${transcurrido}%`)}
        ${fila("SMMLV vigente", c.smmlv ? moneda(c.smmlv) : "<span class=\"text-muted\">Sin registrar</span>")}
        ${fila("Estado", esc(c.estado || "Activo"))}
        ${fila("Equipo", `${(c.miembros || []).length} persona(s)`)}
      </tbody></table>
      ${esGestor ? `<div class="ip-acciones-centro"><button type="button" class="btn secondary ip-btn-auto" id="editarActivoBtn">✏️ Editar información del contrato</button></div>` : ""}
    </div>`;
    document.getElementById("editarActivoBtn")?.addEventListener("click", () => abrirFormulario(contrato));
  }

  // ---------------------------------------------------------- lista
  function pintarLista() {
    document.getElementById("contratosContador").textContent = `${contratos.length} contrato(s)`;
    if (!contratos.length) {
      lista.innerHTML = `<div class="card"><p class="text-muted ip-sin-margen">${esGestor ? "Todavía no hay contratos. Usa «+ Nuevo contrato» para crear el primero." : "No estás asignado a ningún contrato. Pídele al gestor de Interventoría PRO que te agregue al equipo."}</p></div>`;
      return;
    }
    lista.innerHTML = `<div class="card ip-tabla-card"><div class="tabla-scroll"><table class="tabla-densa ip-tabla">
      <colgroup><col class="ip-w10"><col class="ip-w18"><col class="ip-w26"><col class="ip-w10"><col class="ip-w10"><col class="ip-w8"><col class="ip-w18"></colgroup>
      <thead><tr><th>Contrato</th><th>Contratante</th><th>Objeto</th><th>Inicio</th><th>Terminación</th><th>Estado</th><th></th></tr></thead>
      <tbody>${contratos.map((c) => `<tr class="${contrato?.id === c.id ? "ip-fila-activa" : ""}">
        <td><strong>${esc(c.numero || "-")}</strong></td><td>${esc(c.contratante || "-")}</td><td>${esc(c.objeto || "-")}</td>
        <td>${fechaCorta(c.fechaInicio)}</td><td>${fechaCorta(c.fechaFin)}</td><td>${esc(c.estado || "Activo")}</td>
        <td class="ip-acciones-celda">
          ${contrato?.id === c.id ? '<span class="badge ok">En uso</span>' : `<button type="button" class="btn ip-btn-mini" data-usar="${c.id}">Usar</button>`}
          ${esGestor ? `<button type="button" class="btn secondary ip-btn-mini" data-editar="${c.id}">Editar</button>` : ""}
        </td></tr>`).join("")}</tbody></table></div></div>`;
    lista.querySelectorAll("[data-usar]").forEach((b) => b.addEventListener("click", () => {
      fijarContratoActivo(b.dataset.usar);
      location.href = "inicio.html";
    }));
    lista.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => abrirFormulario(contratos.find((c) => c.id === b.dataset.editar))));
  }

  // ---------------------------------------------------------- formulario
  const CAMPOS = ["numero", "tipo", "estado", "objeto", "municipio", "objetivo", "alcance", "frentes", "contratante", "contratista", "supervisor", "director", "valorInicial", "anticipoPct", "fechaInicio", "fechaFin", "plazo", "smmlv"];
  const NUMERICOS = new Set(["valorInicial", "anticipoPct", "smmlv"]);

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
      if (editandoId) {
        await updateDoc(doc(db, "ipContratos", editandoId), datos);
      } else {
        datos.creadoEn = serverTimestamp();
        datos.creadoPor = user.email;
        const nuevo = await addDoc(collection(db, "ipContratos"), datos);
        fijarContratoActivo(nuevo.id);
      }
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

  pintarFicha();
  pintarLista();
  const editar = new URLSearchParams(location.search).get("editar");
  if (editar && esGestor) {
    const c = contratos.find((x) => x.id === editar);
    if (c) abrirFormulario(c);
  }
}
