import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, setDoc, writeBatch, runTransaction, serverTimestamp,
  onSnapshot, query, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { auth, db, storage, requireAuth, obtenerPerfil } from "./firebase-control.js";
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

// Ventana modal en vez del <details> inline (mismo cambio ya hecho en
// Documentos del contrato, pedido del usuario para el resto de formularios
// "+ Nuevo..." del panel).
const nuevoContratoBackdrop = document.getElementById("nuevoContratoBackdrop");
document.getElementById("nuevoContratoBtn").addEventListener("click", () => {
  nuevoContratoBackdrop.classList.add("open");
});
document.getElementById("cancelarContratoBtn").addEventListener("click", () => {
  nuevoContratoBackdrop.classList.remove("open");
});

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

function escapeHtml(texto) {
  return String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const vistaPreviaEl = document.getElementById("contratoVistaPrevia");
const filtroInput = document.getElementById("filtroContrato");
const filtroEstadoSelect = document.getElementById("filtroContratoEstado");
const filtroTipoSelect = document.getElementById("filtroContratoTipo");
let contratosListaCompleta = [];
let contratosListaActual = [];
let totalAprobadoresActual = 0;
let contratoSeleccionadoId = null;

function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

// Fila = solo lo justo para escanear y elegir (una sola línea, sin
// tarjetas) — mismo patrón que Órdenes de Trabajo/Empleados (Cinco
// Conecta) y Activos/Usuarios (Copropiedad Saludable): el detalle
// completo vive en el panel de vista previa de arriba, con el enlace a
// la ficha completa del contrato como su acción principal.
//
// totalAprobadores > 0: hay gente marcada en Empleados como aprobadora
// obligatoria de contratos — se muestra ese avance en el panel para que
// quien aprueba encuentre rápido los contratos que todavía le faltan.
function renderContratos(snapshot, totalAprobadores) {
  contratosListaCompleta = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  totalAprobadoresActual = totalAprobadores;
  aplicarFiltroContratos();
}

// Filtros de texto (código/contrato/cliente) + estado + tipo, todos sobre
// lo que ya está cargado — pedido del usuario para poder ver rápido, por
// ejemplo, "los contratos con un cliente" sin tener que buscarlos a ojo.
function aplicarFiltroContratos() {
  const texto = filtroInput.value.trim().toLowerCase();
  const estado = filtroEstadoSelect.value;
  const tipo = filtroTipoSelect.value;
  contratosListaActual = contratosListaCompleta.filter((c) => {
    if (estado && c.estado !== estado) return false;
    if (tipo && c.tipo !== tipo) return false;
    if (!texto) return true;
    return `${c.codigo || ""} ${c.nombre || ""} ${c.cliente || ""}`.toLowerCase().includes(texto);
  });

  lista.innerHTML = "";
  sinContratos.textContent = contratosListaCompleta.length === 0
    ? "Todavía no hay contratos registrados."
    : "Ningún contrato coincide con el filtro.";
  sinContratos.classList.toggle("oculto", contratosListaActual.length > 0);

  if (contratosListaActual.length === 0) {
    contratoSeleccionadoId = null;
    pintarVistaPreviaContrato();
    return;
  }
  if (!contratoSeleccionadoId || !contratosListaActual.some((c) => c.id === contratoSeleccionadoId)) {
    contratoSeleccionadoId = contratosListaActual[0].id;
  }

  contratosListaActual.forEach((c) => {
    const fila = document.createElement("tr");
    fila.dataset.id = c.id;
    fila.appendChild(celda(c.codigo || "—"));
    fila.appendChild(celda(c.nombre || "—"));
    fila.appendChild(celda(c.cliente || "—"));
    fila.appendChild(celda(TIPO_LABEL[c.tipo] || c.tipo || "—"));
    const tdEstado = celda(c.estado === "cerrado" ? "Cerrado" : "Activo");
    tdEstado.className = c.estado === "cerrado" ? "text-muted" : "";
    fila.appendChild(tdEstado);
    fila.addEventListener("click", () => {
      contratoSeleccionadoId = c.id;
      actualizarResaltadoContrato();
      pintarVistaPreviaContrato();
    });
    lista.appendChild(fila);
  });
  actualizarResaltadoContrato();
  pintarVistaPreviaContrato();
}
filtroInput.addEventListener("input", aplicarFiltroContratos);
filtroEstadoSelect.addEventListener("change", aplicarFiltroContratos);
filtroTipoSelect.addEventListener("change", aplicarFiltroContratos);

function actualizarResaltadoContrato() {
  lista.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.classList.toggle("control-fila-fijada", tr.dataset.id === contratoSeleccionadoId);
  });
}

function pintarVistaPreviaContrato() {
  const c = contratosListaActual.find((x) => x.id === contratoSeleccionadoId);
  if (!c) {
    vistaPreviaEl.innerHTML = `<p class="text-muted" style="margin:0;">${contratosListaCompleta.length === 0 ? "Todavía no hay contratos registrados." : "Ningún contrato coincide con el filtro."}</p>`;
    return;
  }

  const campo = (etiqueta, valor) => `
    <div class="control-vp-campo">
      <span class="control-vp-etiqueta">${etiqueta}</span>
      <span class="control-vp-valor">${escapeHtml(valor || "-")}</span>
    </div>`;
  const grupo = (titulo, camposHtml) => `
    <div class="control-vp-grupo">
      <div class="control-vp-grupo-titulo">${titulo}</div>
      <div class="control-vp-grupo-campos">${camposHtml}</div>
    </div>`;

  const aprobacionHtml = totalAprobadoresActual > 0
    ? (() => {
        const aprobados = Object.keys(c.aprobaciones || {}).length;
        return grupo("Aprobación", campo("Avance", aprobados >= totalAprobadoresActual ? "✅ Aprobado" : `⏳ ${aprobados}/${totalAprobadoresActual}`));
      })()
    : "";

  vistaPreviaEl.innerHTML = `
    <div class="control-vp-encabezado">
      <span class="control-vp-titulo">${escapeHtml(c.codigo || "")} — ${escapeHtml(c.nombre || "-")}</span>
      <div class="control-vp-acciones" id="contratoVpAcciones"></div>
    </div>
    <div class="control-vp-grupos">
      ${grupo("Contrato", `
        ${campo("Tipo", TIPO_LABEL[c.tipo] || c.tipo)}
        ${campo("Línea de servicio", c.lineaServicio)}
        ${campo("Número", c.numero)}
        ${campo("Estado", c.estado === "cerrado" ? "Cerrado" : "Activo")}
      `)}
      ${grupo("Cliente", `
        ${campo("Cliente", c.cliente)}
        ${campo("Supervisor/Interventor", c.supervisor)}
      `)}
      ${grupo("Fechas y valor", `
        ${campo("Inicio", c.fechaInicio)}
        ${campo("Finalización", c.fechaFin)}
        ${campo("Valor", c.valorContrato ? formatoMoneda.format(c.valorContrato) : "")}
      `)}
      ${aprobacionHtml}
    </div>
  `;

  const accionesEl = document.getElementById("contratoVpAcciones");
  const btnAbrir = document.createElement("a");
  btnAbrir.className = "control-btn-mini";
  btnAbrir.href = `contrato.html?id=${c.id}`;
  btnAbrir.textContent = "Abrir contrato →";
  accionesEl.appendChild(btnAbrir);
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  // Solo admin/coadmin crean contratos (las reglas de Firestore también lo
  // exigen) — apoyo/empleado no ven el formulario, solo el listado.
  const perfil = await obtenerPerfil(user.email);
  const esGestor = perfil?.estado === "activo" && (perfil?.rol === "admin" || perfil?.rol === "coadmin");
  if (!esGestor) document.getElementById("nuevoContratoBtn").classList.add("oculto");
  // Enlace "Orden de Trabajo": visible a cualquier empleado activo, no solo
  // a quien la gerencia autorice puntualmente (autorizadoOrdenesTrabajo) —
  // aunque no tenga ese permiso general, puede ser responsable/personal
  // asignado de una orden puntual (ver ordenes-trabajo.js: vista
  // "participante"), y sin el enlace no tenía cómo llegar hasta ahí desde
  // el computador (solo por el link de WhatsApp de esa orden).
  document.getElementById("navOrdenesTrabajo")?.classList.toggle("oculto", perfil?.estado !== "activo");

  const empleadosSnap = await getDocs(collection(db, "empleados"));
  const totalAprobadores = empleadosSnap.docs
    .map((d) => d.data())
    .filter((e) => e.estado === "activo" && e.aprobadorContratos === true).length;

  const q = query(collection(db, "contratos"), orderBy("creadoEn", "desc"));
  onSnapshot(q, (snapshot) => renderContratos(snapshot, totalAprobadores));

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

      // El contrato ya quedó creado en firme arriba; si esto falla no se
      // debe reportar como que la creación del contrato falló (llevaría a
      // reintentar y duplicar el contrato) — se avisa aparte.
      let avisoDocumento = "";
      const enlaceEscrito = document.getElementById("docContratoEnlace").value;
      const archivoContrato = document.getElementById("docContratoArchivo").files[0];
      if (enlaceEscrito || archivoContrato) {
        try {
          const docRef = doc(collection(db, "contratos", contratoRef.id, "documentos"));
          let enlace = enlaceEscrito;
          if (archivoContrato) {
            const extension = archivoContrato.name.split(".").pop().toLowerCase();
            const archivoRef = ref(storage, `contratos/${contratoRef.id}/documentos/${docRef.id}.${extension}`);
            await uploadBytes(archivoRef, archivoContrato);
            enlace = await getDownloadURL(archivoRef);
          }
          await setDoc(docRef, {
            nombre: "Documento del contrato",
            tipo: "contrato",
            enlace,
            origen: "manual",
            creadoPor: user.email,
            creadoEn: serverTimestamp()
          });
        } catch (errDoc) {
          avisoDocumento = " El contrato se creó, pero el documento no se pudo adjuntar — agrégalo luego desde su ficha.";
        }
      }

      form.reset();
      // Si el documento no se pudo adjuntar, la ventana se deja abierta con
      // el aviso visible en vez de cerrarla de una — si no, ese mensaje
      // quedaría escondido detrás de una ventana ya cerrada.
      if (!avisoDocumento) nuevoContratoBackdrop.classList.remove("open");
      mostrarAlerta("Contrato creado." + avisoDocumento, avisoDocumento ? "error" : "ok");
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
