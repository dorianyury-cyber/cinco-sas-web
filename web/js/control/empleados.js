import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, setDoc, getDoc, updateDoc, serverTimestamp,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth, obtenerPerfil } from "./firebase-control.js";

const ROL_LABEL = { admin: "Administrador", empleado: "Empleado" };

const tbody = document.getElementById("listaEmpleados");
const sinEmpleados = document.getElementById("sinEmpleados");
const form = document.getElementById("nuevoEmpleadoForm");
const alertBox = document.getElementById("crearEmpleadoAlert");
const crearBtn = document.getElementById("crearEmpleadoBtn");

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

function celda(tag, texto) {
  const el = document.createElement(tag);
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function renderTabla(empleados, esAdmin) {
  tbody.innerHTML = "";
  sinEmpleados.classList.toggle("oculto", empleados.length > 0);

  empleados.forEach((e) => {
    const fila = document.createElement("tr");
    fila.appendChild(celda("td", e.nombre));
    fila.appendChild(celda("td", e.email));

    const tdRol = celda("td");
    const selectRol = document.createElement("select");
    ["empleado", "admin"].forEach((valor) => {
      const opt = celda("option", ROL_LABEL[valor]);
      opt.value = valor;
      if (valor === e.rol) opt.selected = true;
      selectRol.appendChild(opt);
    });
    selectRol.disabled = !esAdmin;
    selectRol.addEventListener("change", () => {
      updateDoc(doc(db, "empleados", e.id), { rol: selectRol.value, actualizadoEn: serverTimestamp() });
    });
    tdRol.appendChild(selectRol);
    fila.appendChild(tdRol);

    const tdEstado = celda("td");
    const selectEstado = document.createElement("select");
    [["activo", "Activo"], ["inactivo", "Inactivo"]].forEach(([valor, label]) => {
      const opt = celda("option", label);
      opt.value = valor;
      if (valor === e.estado) opt.selected = true;
      selectEstado.appendChild(opt);
    });
    selectEstado.disabled = !esAdmin;
    selectEstado.addEventListener("change", () => {
      updateDoc(doc(db, "empleados", e.id), { estado: selectEstado.value, actualizadoEn: serverTimestamp() });
    });
    tdEstado.appendChild(selectEstado);
    fila.appendChild(tdEstado);

    tbody.appendChild(fila);
  });
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  const perfil = await obtenerPerfil(user.email);
  const esAdmin = perfil?.estado === "activo" && perfil?.rol === "admin";

  if (!esAdmin) {
    document.getElementById("nuevoEmpleadoDetails").classList.add("oculto");
    document.getElementById("soloAdminAviso").classList.remove("oculto");
  }

  const q = query(collection(db, "empleados"), orderBy("nombre"));
  onSnapshot(q, (snapshot) => {
    renderTabla(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), esAdmin);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    crearBtn.disabled = true;
    crearBtn.textContent = "Creando...";
    alertBox.className = "form-alert";

    const nombre = document.getElementById("nombre").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const rol = document.getElementById("rol").value;

    try {
      const empleadoRef = doc(db, "empleados", email);
      const existente = await getDoc(empleadoRef);
      if (existente.exists()) {
        throw new Error("Ya existe un empleado registrado con ese correo.");
      }
      await setDoc(empleadoRef, {
        nombre, email, rol, estado: "activo",
        creadoPor: user.email, creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp()
      });

      form.reset();
      form.closest("details").open = false;
      mostrarAlerta("Empleado creado.", "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo crear el empleado.", "error");
    } finally {
      crearBtn.disabled = false;
      crearBtn.textContent = "Crear empleado";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
