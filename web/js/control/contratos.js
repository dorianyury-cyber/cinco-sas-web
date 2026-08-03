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
//
// totalAprobadores > 0: hay gente marcada en Empleados como aprobadora
// obligatoria de contratos — se agrega un badge de un vistazo (sin tener
// que entrar a cada ficha) para que quien aprueba encuentre rápido los
// contratos que todavía le faltan.
function renderContratos(snapshot, totalAprobadores) {
  lista.innerHTML = "";
  sinContratos.classList.toggle("oculto", !snapshot.empty);
  snapshot.forEach((docSnap) => {
    const c = docSnap.data();
    const card = document.createElement("a");
    card.className = "card control-contrato-card";
    card.href = `contrato.html?id=${docSnap.id}`;
    if (c.codigo) card.appendChild(elemento("span", { class: "control-badge", text: c.codigo }));
    card.appendChild(elemento("span", { class: "pill", text: TIPO_LABEL[c.tipo] || c.tipo }));
    if (totalAprobadores > 0) {
      const aprobados = Object.keys(c.aprobaciones || {}).length;
      card.appendChild(elemento("span", {
        class: `control-badge${aprobados >= totalAprobadores ? " completo" : ""}`,
        text: aprobados >= totalAprobadores ? "✅ Aprobado" : `⏳ Aprobación ${aprobados}/${totalAprobadores}`
      }));
    }
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
      form.closest("details").open = false;
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
