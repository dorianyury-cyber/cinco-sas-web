import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, addDoc, doc, writeBatch, serverTimestamp,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth } from "./firebase-control.js";
import { itemsIniciales } from "./plantillas.js";

const TIPO_LABEL = { obra: "Obra / Interventoría", consultoria: "Consultoría" };

const lista = document.getElementById("listaContratos");
const sinContratos = document.getElementById("sinContratos");
const form = document.getElementById("nuevoContratoForm");
const alertBox = document.getElementById("crearAlert");
const crearBtn = document.getElementById("crearBtn");

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
    card.appendChild(elemento("span", { class: "pill", text: TIPO_LABEL[c.tipo] || c.tipo }));
    card.appendChild(elemento("h3", { text: c.nombre }));
    card.appendChild(elemento("p", { text: c.cliente + (c.numero ? " · " + c.numero : "") }));
    card.appendChild(elemento("p", {
      class: "text-muted",
      text: `Inicio: ${c.fechaInicio || "—"} · ${c.estado === "cerrado" ? "Cerrado" : "Activo"}`
    }));
    lista.appendChild(card);
  });
}

requireAuth((user) => {
  document.getElementById("userEmail").textContent = user.email;

  const q = query(collection(db, "contratos"), orderBy("creadoEn", "desc"));
  onSnapshot(q, renderContratos);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    crearBtn.disabled = true;
    crearBtn.textContent = "Creando...";
    alertBox.className = "form-alert";

    const tipo = document.getElementById("tipo").value;
    const datos = {
      nombre: document.getElementById("nombre").value,
      cliente: document.getElementById("cliente").value,
      tipo,
      numero: document.getElementById("numero").value,
      fechaInicio: document.getElementById("fechaInicio").value,
      estado: "activo",
      creadoPor: user.email,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp()
    };

    try {
      const contratoRef = await addDoc(collection(db, "contratos"), datos);

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
