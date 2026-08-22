import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, getDoc, runTransaction, serverTimestamp,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { AREAS, TIPOS, nombreArea, nombreTipo } from "./documentos-plantillas.js";

const ESTADO_LABEL = { vigente: "Vigente", obsoleto: "Obsoleto" };

const tbody = document.getElementById("listaDocumentos");
const sinDocumentos = document.getElementById("sinDocumentos");
const form = document.getElementById("nuevoDocumentoForm");
const alertBox = document.getElementById("crearDocumentoAlert");
const crearBtn = document.getElementById("crearDocumentoBtn");
const vistaPreviaBtn = document.getElementById("vistaPreviaBtn");
const vistaPreviaBox = document.getElementById("vistaPreviaBox");
const filtroArea = document.getElementById("filtroArea");
const filtroTipo = document.getElementById("filtroTipo");
const filtroEstado = document.getElementById("filtroEstado");

// Ventana modal en vez del <details> inline (mismo cambio ya hecho en
// Documentos del contrato, pedido del usuario para el resto de formularios
// "+ Nuevo..." del panel).
const nuevoDocumentoBackdrop = document.getElementById("nuevoDocumentoBackdrop");
document.getElementById("nuevoDocumentoBtn").addEventListener("click", () => {
  nuevoDocumentoBackdrop.classList.add("open");
});
document.getElementById("cancelarDocumentoMaestroBtn").addEventListener("click", () => {
  nuevoDocumentoBackdrop.classList.remove("open");
});
const filtroSocializado = document.getElementById("filtroSocializado");

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

function llenarSelect(select, opciones) {
  opciones.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.clave;
    opt.textContent = `${o.clave} — ${o.nombre}`;
    select.appendChild(opt);
  });
}

llenarSelect(document.getElementById("area"), AREAS);
llenarSelect(document.getElementById("tipo"), TIPOS);
llenarSelect(filtroArea, AREAS);
llenarSelect(filtroTipo, TIPOS);

// Vista previa: lee el consecutivo actual del contador área+tipo SIN
// incrementarlo, para que el administrador vea el código que se le
// asignaría y revise nombre/área/tipo antes de gastar un consecutivo real
// (crear y borrar no libera el número, así que conviene revisar antes).
vistaPreviaBtn.addEventListener("click", async () => {
  const area = document.getElementById("area").value;
  const tipo = document.getElementById("tipo").value;
  const nombre = document.getElementById("nombre").value.trim();
  if (!nombre) {
    vistaPreviaBox.textContent = "Escribe el nombre del documento primero.";
    vistaPreviaBox.className = "form-alert show error";
    return;
  }
  vistaPreviaBtn.disabled = true;
  try {
    const contadorSnap = await getDoc(doc(db, "contadores", `${area}_${tipo}`));
    const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
    const codigoProbable = `${area}-${tipo}-${String(siguiente).padStart(3, "0")}`;
    vistaPreviaBox.innerHTML = "";
    const resumen = document.createElement("div");
    resumen.innerHTML =
      `<strong>Código probable:</strong> ${codigoProbable}<br>` +
      `<strong>Nombre:</strong> ${nombre}<br>` +
      `<strong>Área:</strong> ${area} — ${nombreArea(area)}<br>` +
      `<strong>Tipo:</strong> ${tipo} — ${nombreTipo(tipo)}<br>` +
      `<span class="text-muted">El código real se asigna al crear — puede variar si alguien más crea uno del mismo área+tipo primero.</span>`;
    vistaPreviaBox.appendChild(resumen);
    vistaPreviaBox.className = "form-alert show ok";
  } catch (err) {
    vistaPreviaBox.textContent = err.message || "No se pudo calcular la vista previa.";
    vistaPreviaBox.className = "form-alert show error";
  } finally {
    vistaPreviaBtn.disabled = false;
  }
});

let documentos = [];

function celda(tag, texto) {
  const el = document.createElement(tag);
  el.textContent = texto;
  return el;
}

function renderTabla() {
  const area = filtroArea.value;
  const tipo = filtroTipo.value;
  const estado = filtroEstado.value;
  const socializado = filtroSocializado.value;
  const filtrados = documentos.filter((d) =>
    (!area || d.area === area) &&
    (!tipo || d.tipo === tipo) &&
    (!estado || d.estado === estado) &&
    (!socializado || (socializado === "si" ? !!d.socializado : !d.socializado))
  );

  tbody.innerHTML = "";
  sinDocumentos.classList.toggle("oculto", filtrados.length > 0);

  filtrados.forEach((d) => {
    const fila = document.createElement("tr");
    fila.className = "control-fila-doc";
    fila.appendChild(celda("td", d.codigo));
    fila.appendChild(celda("td", d.nombre));
    fila.appendChild(celda("td", nombreArea(d.area)));
    fila.appendChild(celda("td", nombreTipo(d.tipo)));
    fila.appendChild(celda("td", "v" + d.versionActual));
    const tdEstado = document.createElement("td");
    const pillEstado = document.createElement("span");
    pillEstado.className = `control-estado-pill control-estado-${d.estado === "obsoleto" ? "obsoleto" : "vigente"}`;
    pillEstado.textContent = ESTADO_LABEL[d.estado] || d.estado;
    tdEstado.appendChild(pillEstado);
    fila.appendChild(tdEstado);
    const tdSocializado = document.createElement("td");
    const pillSocializado = document.createElement("span");
    pillSocializado.className = `control-estado-pill control-estado-${d.socializado ? "vigente" : "obsoleto"}`;
    pillSocializado.textContent = d.socializado ? "Sí" : "No";
    tdSocializado.appendChild(pillSocializado);
    fila.appendChild(tdSocializado);
    fila.addEventListener("click", () => { window.location.href = `documento.html?id=${d.id}`; });
    tbody.appendChild(fila);
  });
}

filtroArea.addEventListener("change", renderTabla);
filtroTipo.addEventListener("change", renderTabla);
filtroEstado.addEventListener("change", renderTabla);
filtroSocializado.addEventListener("change", renderTabla);

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  const perfil = await obtenerPerfil(user.email);
  const puedeGestionar = perfil?.estado === "activo" && (perfil?.rol === "admin" || perfil?.gestionaDocumentos === true);
  if (!puedeGestionar) {
    document.getElementById("nuevoDocumentoBtn").classList.add("oculto");
    document.getElementById("soloGestorAviso").classList.remove("oculto");
  }

  const q = query(collection(db, "documentos"), orderBy("codigo"));
  onSnapshot(q, (snapshot) => {
    documentos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTabla();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    crearBtn.disabled = true;
    crearBtn.textContent = "Creando...";
    alertBox.className = "form-alert";

    const area = document.getElementById("area").value;
    const tipo = document.getElementById("tipo").value;
    const nombre = document.getElementById("nombre").value;
    const enlace = document.getElementById("enlace").value;
    const codigoAnterior = document.getElementById("codigoAnterior").value;

    try {
      const contadorRef = doc(db, "contadores", `${area}_${tipo}`);
      const documentoRef = doc(collection(db, "documentos"));
      const cambioRef = doc(collection(db, "documentos", documentoRef.id, "cambios"));

      await runTransaction(db, async (tx) => {
        const contadorSnap = await tx.get(contadorRef);
        const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
        const codigo = `${area}-${tipo}-${String(siguiente).padStart(3, "0")}`;

        tx.set(contadorRef, { siguiente: siguiente + 1 });
        tx.set(documentoRef, {
          codigo, area, tipo, consecutivo: siguiente, nombre, enlace,
          versionActual: 1, estado: "vigente", socializado: false, codigoAnterior: codigoAnterior || "",
          creadoPor: user.email, creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(), actualizadoPor: user.email
        });
        tx.set(cambioRef, {
          version: 1,
          fecha: new Date().toISOString().slice(0, 10),
          motivo: codigoAnterior ? `Recodificación desde ${codigoAnterior}` : "Alta inicial",
          hechoPor: user.email,
          en: serverTimestamp()
        });
      });

      form.reset();
      nuevoDocumentoBackdrop.classList.remove("open");
      vistaPreviaBox.className = "form-alert";
      mostrarAlerta("Documento creado.", "ok");
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo crear el documento.", "error");
    } finally {
      crearBtn.disabled = false;
      crearBtn.textContent = "Crear documento";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
