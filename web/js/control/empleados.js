import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, setDoc, getDoc, updateDoc, serverTimestamp,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth, obtenerPerfil } from "./firebase-control.js";
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

// Ventana modal en vez del <details> inline (mismo cambio ya hecho en
// Documentos del contrato, pedido del usuario para el resto de formularios
// "+ Nuevo..." del panel).
const nuevoEmpleadoBackdrop = document.getElementById("nuevoEmpleadoBackdrop");
document.getElementById("nuevoEmpleadoBtn").addEventListener("click", () => {
  nuevoEmpleadoBackdrop.classList.add("open");
});
document.getElementById("cancelarEmpleadoBtn").addEventListener("click", () => {
  nuevoEmpleadoBackdrop.classList.remove("open");
});

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

// ---- controles editables (autoguardado al cambiar) — antes vivían cada
// uno en su propia columna de la tabla; ahora se reubican en el panel de
// vista previa (fila = solo lo justo para escanear y elegir), mismo
// patrón que Contratos/Correspondencia/Órdenes de Trabajo. Cada función
// devuelve el control suelto (no un <td>); quien pinta el panel lo envuelve
// con campoEditable()/grupoEl() para el mismo formato de caja que las
// otras listas. ----

// Columnas del checklist que puede tocar/ver: admin/coadmin no aplica (ven
// y editan todo). Para apoyo/empleado, un resumen + las casillas para
// ajustarlas, autoguardado igual que el resto.
function controlCampos(empleado, esAdmin) {
  const campo = campoDeRol(empleado.rol);
  if (!campo) return celda("span", "—");

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
  return detalle;
}

// Checkbox de autorización + botón para subir/cambiar la firma de esa
// persona — se sube UNA vez aquí y se reusa en cada oferta que firme.
function controlOfertas(empleado, esAdmin) {
  const fila = document.createElement("div");
  fila.className = "control-celda-inline";

  const label = document.createElement("label");
  label.className = "control-check-inline";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = !!empleado.autorizadoOfertas;
  check.disabled = !esAdmin;
  check.addEventListener("change", () => {
    updateDoc(doc(db, "empleados", empleado.id), { autorizadoOfertas: check.checked, actualizadoEn: serverTimestamp() });
  });
  label.appendChild(check);
  label.appendChild(document.createTextNode("Autorizado"));
  fila.appendChild(label);

  if (esAdmin) {
    const btnFirma = document.createElement("button");
    btnFirma.type = "button";
    btnFirma.className = "icon-btn";
    btnFirma.title = empleado.firmaUrl ? "Cambiar firma" : "Subir firma";
    btnFirma.textContent = "🖊️";
    const inputFirma = document.createElement("input");
    inputFirma.type = "file";
    inputFirma.accept = "image/*";
    inputFirma.hidden = true;
    btnFirma.addEventListener("click", () => inputFirma.click());
    inputFirma.addEventListener("change", async () => {
      const archivo = inputFirma.files[0];
      if (!archivo) return;
      btnFirma.disabled = true;
      btnFirma.title = "Subiendo...";
      try {
        const ext = archivo.name.includes(".") ? archivo.name.split(".").pop() : "png";
        const archivoRef = ref(storage, `empleados/${empleado.id}/firma.${ext}`);
        await uploadBytes(archivoRef, archivo);
        const url = await getDownloadURL(archivoRef);
        await updateDoc(doc(db, "empleados", empleado.id), { firmaUrl: url, actualizadoEn: serverTimestamp() });
      } catch (err) {
        window.alert(err.message || "No se pudo subir la firma.");
      } finally {
        btnFirma.disabled = false;
        btnFirma.title = empleado.firmaUrl ? "Cambiar firma" : "Subir firma";
        inputFirma.value = "";
      }
    });
    fila.append(btnFirma, inputFirma);
  }
  return fila;
}

function controlCheckboxSimple(empleado, esAdmin, campo, etiqueta) {
  const label = document.createElement("label");
  label.className = "control-check-inline";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = !!empleado[campo];
  check.disabled = !esAdmin;
  check.addEventListener("change", () => {
    updateDoc(doc(db, "empleados", empleado.id), { [campo]: check.checked, actualizadoEn: serverTimestamp() });
  });
  label.appendChild(check);
  label.appendChild(document.createTextNode(etiqueta));
  return label;
}

// Texto libre (cédula/teléfono), autoguardado al perder el foco. No hay
// modal de "editar datos" en este módulo — el panel es la única forma de
// completar el dato en empleados creados antes de que existiera el campo.
function controlTexto(empleado, esAdmin, campo, placeholder) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = empleado[campo] || "";
  input.placeholder = placeholder || "";
  input.disabled = !esAdmin;
  input.addEventListener("change", () => {
    updateDoc(doc(db, "empleados", empleado.id), { [campo]: input.value.trim(), actualizadoEn: serverTimestamp() });
  });
  return input;
}

function controlRol(empleado, esAdmin) {
  const select = document.createElement("select");
  ROLES.forEach((valor) => {
    const opt = celda("option", ROL_LABEL[valor]);
    opt.value = valor;
    if (valor === empleado.rol) opt.selected = true;
    select.appendChild(opt);
  });
  select.disabled = !esAdmin;
  select.addEventListener("change", () => {
    updateDoc(doc(db, "empleados", empleado.id), { rol: select.value, actualizadoEn: serverTimestamp() });
  });
  return select;
}

function controlEstado(empleado, esAdmin) {
  const select = document.createElement("select");
  [["activo", "Activo"], ["inactivo", "Inactivo"]].forEach(([valor, label]) => {
    const opt = celda("option", label);
    opt.value = valor;
    if (valor === empleado.estado) opt.selected = true;
    select.appendChild(opt);
  });
  select.disabled = !esAdmin;
  select.addEventListener("change", () => {
    updateDoc(doc(db, "empleados", empleado.id), { estado: select.value, actualizadoEn: serverTimestamp() });
  });
  return select;
}

// ---- fila compacta + panel de vista previa (mismo patrón que Contratos/
// Correspondencia/Órdenes de Trabajo): la fila es solo lo justo para
// escanear y elegir; todos los controles editables de arriba viven en el
// panel de la persona fijada. ----
const vistaPreviaEl = document.getElementById("empleadoVistaPrevia");
const filtroInput = document.getElementById("filtroEmpleado");
const filtroRolSelect = document.getElementById("filtroEmpleadoRol");
const filtroEstadoSelect = document.getElementById("filtroEmpleadoEstado");
let empleadosListaCompleta = [];
let empleadosListaActual = [];
let esAdminActual = false;
let empleadoSeleccionadoId = null;

function renderTabla(empleados, esAdmin) {
  empleadosListaCompleta = empleados;
  esAdminActual = esAdmin;
  aplicarFiltroEmpleados();
}

function aplicarFiltroEmpleados() {
  const texto = filtroInput.value.trim().toLowerCase();
  const rol = filtroRolSelect.value;
  const estado = filtroEstadoSelect.value;
  empleadosListaActual = empleadosListaCompleta.filter((e) => {
    if (rol && e.rol !== rol) return false;
    if (estado && e.estado !== estado) return false;
    if (!texto) return true;
    return `${e.nombre || ""} ${e.email || ""} ${e.cargo || ""}`.toLowerCase().includes(texto);
  });

  tbody.innerHTML = "";
  sinEmpleados.textContent = empleadosListaCompleta.length === 0
    ? "Todavía no hay empleados registrados."
    : "Ningún empleado coincide con el filtro.";
  sinEmpleados.classList.toggle("oculto", empleadosListaActual.length > 0);

  if (empleadosListaActual.length === 0) {
    empleadoSeleccionadoId = null;
    pintarVistaPreviaEmpleado();
    return;
  }
  if (!empleadoSeleccionadoId || !empleadosListaActual.some((e) => e.id === empleadoSeleccionadoId)) {
    empleadoSeleccionadoId = empleadosListaActual[0].id;
  }

  empleadosListaActual.forEach((e) => {
    const fila = document.createElement("tr");
    fila.dataset.id = e.id;
    fila.appendChild(celda("td", e.nombre));
    fila.appendChild(celda("td", e.email));
    fila.appendChild(celda("td", e.cargo || "—"));
    fila.appendChild(celda("td", ROL_LABEL[e.rol] || e.rol));
    const tdEstado = celda("td", e.estado === "activo" ? "Activo" : "Inactivo");
    tdEstado.className = e.estado === "activo" ? "" : "text-muted";
    fila.appendChild(tdEstado);
    fila.addEventListener("click", () => {
      empleadoSeleccionadoId = e.id;
      actualizarResaltadoEmpleado();
      pintarVistaPreviaEmpleado();
    });
    tbody.appendChild(fila);
  });
  actualizarResaltadoEmpleado();
  pintarVistaPreviaEmpleado();
}
filtroInput.addEventListener("input", aplicarFiltroEmpleados);
filtroRolSelect.addEventListener("change", aplicarFiltroEmpleados);
filtroEstadoSelect.addEventListener("change", aplicarFiltroEmpleados);

function actualizarResaltadoEmpleado() {
  tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.classList.toggle("control-fila-fijada", tr.dataset.id === empleadoSeleccionadoId);
  });
}

function campoEditable(etiqueta, controlEl) {
  const div = document.createElement("div");
  div.className = "control-vp-campo";
  const lbl = document.createElement("span");
  lbl.className = "control-vp-etiqueta";
  lbl.textContent = etiqueta;
  div.append(lbl, controlEl);
  return div;
}

function grupoEl(titulo, hijos) {
  const div = document.createElement("div");
  div.className = "control-vp-grupo";
  const t = document.createElement("div");
  t.className = "control-vp-grupo-titulo";
  t.textContent = titulo;
  const campos = document.createElement("div");
  campos.className = "control-vp-grupo-campos";
  hijos.forEach((h) => campos.appendChild(h));
  div.append(t, campos);
  return div;
}

function pintarVistaPreviaEmpleado() {
  const e = empleadosListaActual.find((x) => x.id === empleadoSeleccionadoId);
  if (!e) {
    vistaPreviaEl.innerHTML = `<p class="text-muted" style="margin:0;">${empleadosListaCompleta.length === 0 ? "Todavía no hay empleados registrados." : "Ningún empleado coincide con el filtro."}</p>`;
    return;
  }

  vistaPreviaEl.innerHTML = "";
  const encabezado = document.createElement("div");
  encabezado.className = "control-vp-encabezado";
  const titulo = document.createElement("span");
  titulo.className = "control-vp-titulo";
  titulo.textContent = `${e.nombre} — ${e.email}`;
  encabezado.appendChild(titulo);
  vistaPreviaEl.appendChild(encabezado);

  const grupos = document.createElement("div");
  grupos.className = "control-vp-grupos";

  grupos.appendChild(grupoEl("Datos", [
    campoEditable("Cédula", controlTexto(e, esAdminActual, "cedula", "Ej. 1075320443")),
    campoEditable("Teléfono", controlTexto(e, esAdminActual, "telefono", "Ej. 3101234567"))
  ]));

  grupos.appendChild(grupoEl("Acceso", [
    campoEditable("Rol", controlRol(e, esAdminActual)),
    campoEditable("Estado", controlEstado(e, esAdminActual))
  ]));

  if (campoDeRol(e.rol)) {
    grupos.appendChild(grupoEl(e.rol === "apoyo" ? "Columnas que puede editar" : "Columnas que puede ver", [controlCampos(e, esAdminActual)]));
  }

  grupos.appendChild(grupoEl("Permisos", [
    campoEditable("Ofertas comerciales", controlOfertas(e, esAdminActual)),
    campoEditable("Listado Maestro de Documentos", controlCheckboxSimple(e, esAdminActual, "gestionaDocumentos", "Autorizado")),
    campoEditable("Aprobación de contratos", controlCheckboxSimple(e, esAdminActual, "aprobadorContratos", "Requerido")),
    campoEditable("Órdenes de Trabajo", controlCheckboxSimple(e, esAdminActual, "autorizadoOrdenesTrabajo", "Autorizado"))
  ]));

  vistaPreviaEl.appendChild(grupos);
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  const perfil = await obtenerPerfil(user.email);
  const esAdmin = perfil?.estado === "activo" && perfil?.rol === "admin";

  if (!esAdmin) {
    document.getElementById("nuevoEmpleadoBtn").classList.add("oculto");
    document.getElementById("soloAdminAviso").classList.remove("oculto");
  }
  document.getElementById("navOrdenesTrabajo")?.classList.toggle("oculto", !(esAdmin || (perfil?.estado === "activo" && perfil?.autorizadoOrdenesTrabajo === true)));

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
    const cargo = document.getElementById("cargo").value.trim();
    const cedula = document.getElementById("cedula").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const autorizadoOfertas = document.getElementById("autorizadoOfertas").checked;
    const gestionaDocumentos = document.getElementById("gestionaDocumentos").checked;
    const aprobadorContratos = document.getElementById("aprobadorContratos").checked;
    const autorizadoOrdenesTrabajo = document.getElementById("autorizadoOrdenesTrabajo").checked;
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
        nombre, email, cargo, cedula, telefono, rol, estado: "activo",
        autorizadoOfertas, gestionaDocumentos, aprobadorContratos, autorizadoOrdenesTrabajo,
        ...(campo ? { [campo]: seleccionadas } : {}),
        creadoPor: user.email, creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp()
      });

      form.reset();
      nuevoEmpleadoBackdrop.classList.remove("open");
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
