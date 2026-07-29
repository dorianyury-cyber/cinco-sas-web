import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, setDoc, getDoc, updateDoc, serverTimestamp,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { COLUMNAS_ITEM } from "./plantillas.js";

const ROL_LABEL = { admin: "Administrador", coadmin: "Coadministrador", apoyo: "Apoyo", empleado: "Empleado" };
const ROLES = ["empleado", "apoyo", "coadmin", "admin"];

const ROL_AYUDA = {
  admin: "Control total: contratos, equipo, empleados y roles.",
  coadmin: "Edita todo lo de los contratos (datos, checklist, equipo, documentos). No puede borrar contratos ni tocar roles/empleados.",
  apoyo: "Solo puede editar las columnas del checklist que se marquen abajo. El resto del contrato lo ve, no lo edita.",
  empleado: "Solo puede ver — no edita nada. Además, solo ve las columnas del checklist marcadas abajo, y no puede crear ni descargar documentos del contrato."
};

// Campo de Firestore donde vive la lista de columnas permitidas/visibles,
// según el rol — null si ese rol no usa esta lista (admin/coadmin ven y
// editan todo el checklist sin restricción de columna).
function campoDeRol(rol) {
  if (rol === "apoyo") return "camposPermitidos";
  if (rol === "empleado") return "camposVisibles";
  return null;
}

const tbody = document.getElementById("listaEmpleados");
const sinEmpleados = document.getElementById("sinEmpleados");
const form = document.getElementById("nuevoEmpleadoForm");
const alertBox = document.getElementById("crearEmpleadoAlert");
const crearBtn = document.getElementById("crearEmpleadoBtn");

const selectRolNuevo = document.getElementById("rol");
const rolAyuda = document.getElementById("rolAyuda");
const camposContainer = document.getElementById("camposPermisoContainer");
const camposLabel = document.getElementById("camposPermisoLabel");
const camposLista = document.getElementById("camposPermisoLista");

function actualizarFormularioSegunRol() {
  const rol = selectRolNuevo.value;
  rolAyuda.textContent = ROL_AYUDA[rol] || "";

  const campo = campoDeRol(rol);
  camposContainer.classList.toggle("oculto", !campo);
  if (!campo) return;

  camposLabel.textContent = rol === "apoyo" ? "Columnas del checklist que puede editar" : "Columnas del checklist que puede ver";
  camposLista.innerHTML = "";
  COLUMNAS_ITEM.forEach((c) => {
    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.value = c.clave;
    check.className = "campo-permiso-check";
    label.appendChild(check);
    label.appendChild(document.createTextNode(c.nombre));
    camposLista.appendChild(label);
  });
}
selectRolNuevo.addEventListener("change", actualizarFormularioSegunRol);
actualizarFormularioSegunRol();

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

function celda(tag, texto) {
  const el = document.createElement(tag);
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Celda "Campos": para admin/coadmin no aplica (ven y editan todo el
// checklist). Para apoyo/empleado, un resumen + un <details> con las
// casillas para ajustar qué columnas puede tocar/ver, que guardan solas
// al marcarlas (mismo patrón de autoguardado que Rol/Estado en esta tabla).
function celdaCampos(empleado, esAdmin) {
  const td = celda("td");
  const campo = campoDeRol(empleado.rol);
  if (!campo) {
    td.textContent = "—";
    return td;
  }

  const actuales = new Set(empleado[campo] || []);
  const detalle = document.createElement("details");
  const resumen = document.createElement("summary");
  resumen.className = "control-campos-resumen";
  resumen.textContent = actuales.size
    ? COLUMNAS_ITEM.filter((c) => actuales.has(c.clave)).map((c) => c.nombre).join(", ")
    : "Ninguna columna asignada";
  detalle.appendChild(resumen);

  const fila = document.createElement("div");
  fila.className = "control-campos-fila";
  COLUMNAS_ITEM.forEach((c) => {
    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = actuales.has(c.clave);
    check.disabled = !esAdmin;
    check.addEventListener("change", () => {
      if (check.checked) actuales.add(c.clave); else actuales.delete(c.clave);
      updateDoc(doc(db, "empleados", empleado.id), {
        [campo]: COLUMNAS_ITEM.filter((col) => actuales.has(col.clave)).map((col) => col.clave),
        actualizadoEn: serverTimestamp()
      });
      resumen.textContent = actuales.size
        ? COLUMNAS_ITEM.filter((col) => actuales.has(col.clave)).map((col) => col.nombre).join(", ")
        : "Ninguna columna asignada";
    });
    label.appendChild(check);
    label.appendChild(document.createTextNode(c.nombre));
    fila.appendChild(label);
  });
  detalle.appendChild(fila);
  td.appendChild(detalle);
  return td;
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
    ROLES.forEach((valor) => {
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

    fila.appendChild(celdaCampos(e, esAdmin));

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
    const rol = selectRolNuevo.value;
    const campo = campoDeRol(rol);
    const seleccionadas = [...camposLista.querySelectorAll(".campo-permiso-check:checked")].map((c) => c.value);

    try {
      const empleadoRef = doc(db, "empleados", email);
      const existente = await getDoc(empleadoRef);
      if (existente.exists()) {
        throw new Error("Ya existe un empleado registrado con ese correo.");
      }
      await setDoc(empleadoRef, {
        nombre, email, rol, estado: "activo",
        ...(campo ? { [campo]: seleccionadas } : {}),
        creadoPor: user.email, creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp()
      });

      form.reset();
      form.closest("details").open = false;
      actualizarFormularioSegunRol();
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
