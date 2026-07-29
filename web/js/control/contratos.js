import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, writeBatch, runTransaction, serverTimestamp,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { itemsIniciales } from "./plantillas.js";
import { LINEAS_SERVICIO } from "./lineas-servicio.js";
import { capitalizarOracion, capitalizarNombrePropio } from "./texto.js";

const TIPO_LABEL = { obra: "Obra", servicio: "Servicio" };

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const lista = document.getElementById("listaContratos");
const sinContratos = document.getElementById("sinContratos");
const form = document.getElementById("nuevoContratoForm");
const alertBox = document.getElementById("crearAlert");
const crearBtn = document.getElementById("crearBtn");

const selectLinea = document.getElementById("lineaServicio");
LINEAS_SERVICIO.forEach((l) => {
  const opt = document.createElement("option");
  opt.value = l.clave;
  opt.textContent = `${l.clave} — ${l.nombre}`;
  selectLinea.appendChild(opt);
});

const nombreInput = document.getElementById("nombre");
const clienteInput = document.getElementById("cliente");
const supervisorInput = document.getElementById("supervisor");
nombreInput.addEventListener("blur", () => { nombreInput.value = capitalizarOracion(nombreInput.value); });
clienteInput.addEventListener("blur", () => { clienteInput.value = capitalizarNombrePropio(clienteInput.value); });
supervisorInput.addEventListener("blur", () => { supervisorInput.value = capitalizarNombrePropio(supervisorInput.value); });

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

function elemento(tag, opts = {}) {
  const el = document.createElement(tag);
  if (opts.class) el.className = opts.class;
  if (opts.text !== undefined) el.textContent = opts.text;
  return el;
}

// Se construye con la API del DOM (no innerHTML) porque nombre/cliente/
// número los escribe el usuario al crear el contrato.
function renderContratos(snapshot) {
  lista.innerHTML = "";
  sinContratos.classList.toggle("oculto", !snapshot.empty);
  snapshot.forEach((docSnap) => {
    const c = docSnap.data();
    const card = document.createElement("a");
    card.className = "card control-contrato-card";
    card.href = `contrato.html?id=${docSnap.id}`;
    if (c.codigo) card.appendChild(elemento("span", { class: "control-badge", text: c.codigo }));
    card.appendChild(elemento("span", { class: "pill", text: TIPO_LABEL[c.tipo] || c.tipo }));
    card.appendChild(elemento("h3", { text: c.nombre }));
    card.appendChild(elemento("p", { text: c.cliente + (c.numero ? " · " + c.numero : "") }));
    card.appendChild(elemento("p", {
      class: "text-muted",
      text: `Inicio: ${c.fechaInicio || "—"}${c.fechaFin ? " · Fin: " + c.fechaFin : ""} · ${c.estado === "cerrado" ? "Cerrado" : "Activo"}`
    }));
    if (c.valorContrato) {
      card.appendChild(elemento("p", { class: "text-muted", text: formatoMoneda.format(c.valorContrato) }));
    }
    lista.appendChild(card);
  });
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  // Solo admin/coadmin crean contratos (las reglas de Firestore también lo
  // exigen) — apoyo/empleado no ven el formulario, solo el listado.
  const perfil = await obtenerPerfil(user.email);
  const esGestor = perfil?.estado === "activo" && (perfil?.rol === "admin" || perfil?.rol === "coadmin");
  if (!esGestor) document.getElementById("nuevoContratoDetails").classList.add("oculto");

  const q = query(collection(db, "contratos"), orderBy("creadoEn", "desc"));
  onSnapshot(q, renderContratos);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    crearBtn.disabled = true;
    crearBtn.textContent = "Creando...";
    alertBox.className = "form-alert";

    const tipo = document.getElementById("tipo").value;
    const lineaServicio = selectLinea.value;
    const anio = new Date().getFullYear();
    const datosBase = {
      nombre: capitalizarOracion(nombreInput.value),
      cliente: capitalizarNombrePropio(clienteInput.value),
      tipo,
      lineaServicio,
      numero: document.getElementById("numero").value,
      valorContrato: Number(document.getElementById("valorContrato").value) || null,
      fechaInicio: document.getElementById("fechaInicio").value,
      fechaFin: document.getElementById("fechaFin").value || null,
      supervisor: capitalizarNombrePropio(supervisorInput.value),
      equipo: [],
      estado: "activo",
      creadoPor: user.email,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp()
    };

    try {
      const contadorRef = doc(db, "contadores", `contrato_${lineaServicio}_${anio}`);
      const contratoRef = doc(collection(db, "contratos"));

      await runTransaction(db, async (tx) => {
        const contadorSnap = await tx.get(contadorRef);
        const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
        const codigo = `${lineaServicio}-${anio}-${String(siguiente).padStart(3, "0")}`;

        tx.set(contadorRef, { siguiente: siguiente + 1 });
        tx.set(contratoRef, { ...datosBase, codigo });
      });

      const batch = writeBatch(db);
      itemsIniciales(tipo).forEach((item) => {
        const itemRef = doc(collection(db, "contratos", contratoRef.id, "items"));
        batch.set(itemRef, { ...item, actualizadoEn: serverTimestamp(), actualizadoPor: user.email });
      });
      await batch.commit();

      form.reset();
      form.closest("details").open = false;
      mostrarAlerta("Contrato creado.", "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo crear el contrato.", "error");
    } finally {
      crearBtn.disabled = false;
      crearBtn.textContent = "Crear contrato";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
