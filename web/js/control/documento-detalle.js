import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, getDoc, updateDoc, addDoc, collection, getDocs, query, orderBy, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { AREAS, TIPOS, nombreArea, nombreTipo } from "./documentos-plantillas.js";

const id = new URLSearchParams(window.location.search).get("id");
if (!id) window.location.href = "documentos.html";

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});

function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

requireAuth(async (user) => {
  document.getElementById("userEmail").textContent = user.email;

  const documentoRef = doc(db, "documentos", id);
  const documentoSnap = await getDoc(documentoRef);
  if (!documentoSnap.exists()) {
    window.location.href = "documentos.html";
    return;
  }
  const documento = documentoSnap.data();

  const perfil = await obtenerPerfil(user.email);
  const puedeGestionar = perfil?.estado === "activo" && (perfil?.rol === "admin" || perfil?.gestionaDocumentos === true);
  if (!puedeGestionar) document.getElementById("soloGestorAviso").classList.remove("oculto");

  document.getElementById("documentoCodigo").textContent = documento.codigo;
  document.getElementById("documentoNombre").textContent = documento.nombre;
  document.getElementById("documentoArea").textContent = `${documento.area} — ${nombreArea(documento.area)}`;
  document.getElementById("documentoTipo").textContent = `${documento.tipo} — ${nombreTipo(documento.tipo)}`;
  document.getElementById("documentoCodigoAnterior").textContent =
    documento.codigoAnterior ? `Código anterior: ${documento.codigoAnterior}` : "";
  document.getElementById("documentoVersion").textContent = "Versión actual: v" + documento.versionActual;

  const nombreInput = document.getElementById("nombre");
  const enlaceInput = document.getElementById("enlace");
  const abrirEnlaceBtn = document.getElementById("abrirEnlaceBtn");
  nombreInput.value = documento.nombre || "";
  enlaceInput.value = documento.enlace || "";
  nombreInput.disabled = !puedeGestionar;
  enlaceInput.disabled = !puedeGestionar;

  function actualizarAbrirEnlace() {
    const url = enlaceInput.value.trim();
    abrirEnlaceBtn.href = url || "#";
    abrirEnlaceBtn.classList.toggle("oculto", !url);
  }
  actualizarAbrirEnlace();
  enlaceInput.addEventListener("input", actualizarAbrirEnlace);

  const guardar = (campoDoc, valor) =>
    updateDoc(documentoRef, { [campoDoc]: valor, actualizadoEn: serverTimestamp(), actualizadoPor: user.email });

  nombreInput.addEventListener("change", () => {
    guardar("nombre", nombreInput.value);
    document.getElementById("documentoNombre").textContent = nombreInput.value;
  });
  enlaceInput.addEventListener("change", () => guardar("enlace", enlaceInput.value));

  const estadoSelect = document.getElementById("documentoEstado");
  estadoSelect.value = documento.estado || "vigente";
  estadoSelect.disabled = !puedeGestionar;
  estadoSelect.addEventListener("change", () => {
    const nuevo = estadoSelect.value;
    const mensaje = nuevo === "obsoleto"
      ? "¿Marcar este documento como obsoleto? Deja de ser una referencia vigente."
      : "¿Reactivar este documento como vigente?";
    if (!window.confirm(mensaje)) {
      estadoSelect.value = documento.estado;
      return;
    }
    documento.estado = nuevo;
    guardar("estado", nuevo);
  });

  // ---- Socializado: marca que el documento ya se comunicó al resto del
  // equipo. Mientras esté en "No", el área/tipo (y por tanto el código)
  // se pueden corregir libremente si hubo un error al crearlo; una vez en
  // "Sí" se oculta esa opción para no romper un código que ya circuló.
  const socializadoSelect = document.getElementById("documentoSocializado");
  const recodificarDetails = document.getElementById("recodificarDetails");
  socializadoSelect.value = documento.socializado ? "si" : "no";
  socializadoSelect.disabled = !puedeGestionar;
  function actualizarVisibilidadRecodificar() {
    recodificarDetails.classList.toggle("oculto", !puedeGestionar || !!documento.socializado);
  }
  actualizarVisibilidadRecodificar();
  socializadoSelect.addEventListener("change", () => {
    const nuevo = socializadoSelect.value === "si";
    const mensaje = nuevo
      ? "¿Marcar este documento como socializado? Ya no se podrá cambiar el área/tipo (el código queda fijo)."
      : "¿Volver a marcarlo como no socializado?";
    if (!window.confirm(mensaje)) {
      socializadoSelect.value = documento.socializado ? "si" : "no";
      return;
    }
    documento.socializado = nuevo;
    guardar("socializado", nuevo);
    actualizarVisibilidadRecodificar();
  });

  // ---- Recodificar: cambiar área/tipo genera un código nuevo (mismo
  // contador que "Nuevo documento"), guarda el código actual como
  // "código anterior" y deja constancia en el control de cambios — no se
  // reescribe el código en el mismo documento porque eso rompería
  // cualquier referencia externa ya guardada con el código viejo.
  const selectNuevaArea = document.getElementById("nuevaArea");
  const selectNuevoTipo = document.getElementById("nuevoTipo");
  function llenarSelect(select, opciones) {
    opciones.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.clave;
      opt.textContent = `${o.clave} — ${o.nombre}`;
      select.appendChild(opt);
    });
  }
  llenarSelect(selectNuevaArea, AREAS);
  llenarSelect(selectNuevoTipo, TIPOS);
  selectNuevaArea.value = documento.area;
  selectNuevoTipo.value = documento.tipo;

  const recodificarForm = document.getElementById("recodificarForm");
  const recodificarAlert = document.getElementById("recodificarAlert");
  const recodificarBtn = document.getElementById("recodificarBtn");

  recodificarForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevaArea = selectNuevaArea.value;
    const nuevoTipo = selectNuevoTipo.value;
    if (nuevaArea === documento.area && nuevoTipo === documento.tipo) {
      recodificarAlert.textContent = "El área y el tipo ya son esos — no hay nada que recodificar.";
      recodificarAlert.className = "form-alert show error";
      return;
    }
    if (!window.confirm(`¿Generar un código nuevo para área ${nuevaArea} / tipo ${nuevoTipo}? El código actual (${documento.codigo}) queda como "código anterior".`)) return;

    recodificarBtn.disabled = true;
    recodificarAlert.className = "form-alert";
    try {
      const codigoViejo = documento.codigo;
      const contadorRef = doc(db, "contadores", `${nuevaArea}_${nuevoTipo}`);
      const cambioRef = doc(collection(db, "documentos", id, "cambios"));
      let codigoNuevo;

      await runTransaction(db, async (tx) => {
        const contadorSnap = await tx.get(contadorRef);
        const siguiente = contadorSnap.exists() ? contadorSnap.data().siguiente : 1;
        codigoNuevo = `${nuevaArea}-${nuevoTipo}-${String(siguiente).padStart(3, "0")}`;
        tx.set(contadorRef, { siguiente: siguiente + 1 });
        tx.update(documentoRef, {
          area: nuevaArea, tipo: nuevoTipo, codigo: codigoNuevo, consecutivo: siguiente,
          codigoAnterior: codigoViejo, actualizadoEn: serverTimestamp(), actualizadoPor: user.email
        });
        tx.set(cambioRef, {
          version: documento.versionActual || 1,
          fecha: hoyISO(),
          motivo: `Recodificación: ${documento.area}-${documento.tipo} → ${nuevaArea}-${nuevoTipo} (código anterior: ${codigoViejo})`,
          hechoPor: user.email,
          en: serverTimestamp()
        });
      });

      documento.area = nuevaArea;
      documento.tipo = nuevoTipo;
      documento.codigo = codigoNuevo;
      documento.codigoAnterior = codigoViejo;
      document.getElementById("documentoCodigo").textContent = codigoNuevo;
      document.getElementById("documentoArea").textContent = `${nuevaArea} — ${nombreArea(nuevaArea)}`;
      document.getElementById("documentoTipo").textContent = `${nuevoTipo} — ${nombreTipo(nuevoTipo)}`;
      document.getElementById("documentoCodigoAnterior").textContent = `Código anterior: ${codigoViejo}`;
      agregarFilaCambio({
        version: documento.versionActual || 1, fecha: hoyISO(),
        motivo: `Recodificación: código anterior ${codigoViejo}`, hechoPor: user.email
      });

      recodificarForm.closest("details").open = false;
      recodificarAlert.textContent = `Código nuevo: ${codigoNuevo}.`;
      recodificarAlert.className = "form-alert show ok";
    } catch (err) {
      recodificarAlert.textContent = err.message || "No se pudo recodificar.";
      recodificarAlert.className = "form-alert show error";
    } finally {
      recodificarBtn.disabled = false;
    }
  });

  // ---- control de cambios ----
  const listaCambios = document.getElementById("listaCambios");

  function agregarFilaCambio(c) {
    const fila = document.createElement("tr");
    fila.appendChild(celda("v" + c.version));
    fila.appendChild(celda(c.fecha || ""));
    fila.appendChild(celda(c.motivo || ""));
    fila.appendChild(celda(c.hechoPor || ""));
    listaCambios.prepend(fila);
  }

  const cambiosSnap = await getDocs(query(collection(db, "documentos", id, "cambios"), orderBy("version")));
  cambiosSnap.docs.forEach((d) => agregarFilaCambio(d.data()));

  const nuevaVersionForm = document.getElementById("nuevaVersionForm");
  const nuevaVersionAlert = document.getElementById("nuevaVersionAlert");
  const nuevaVersionBtn = document.getElementById("nuevaVersionBtn");
  if (!puedeGestionar) nuevaVersionForm.closest("details").classList.add("oculto");

  nuevaVersionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    nuevaVersionBtn.disabled = true;
    nuevaVersionBtn.textContent = "Guardando...";
    nuevaVersionAlert.className = "form-alert";

    const motivo = document.getElementById("motivo").value;
    const enlaceNuevo = document.getElementById("enlaceNuevaVersion").value;
    const version = (documento.versionActual || 1) + 1;

    try {
      await updateDoc(documentoRef, {
        versionActual: version,
        ...(enlaceNuevo ? { enlace: enlaceNuevo } : {}),
        actualizadoEn: serverTimestamp(),
        actualizadoPor: user.email
      });
      await addDoc(collection(db, "documentos", id, "cambios"), {
        version, fecha: hoyISO(), motivo, hechoPor: user.email, en: serverTimestamp()
      });

      documento.versionActual = version;
      document.getElementById("documentoVersion").textContent = "Versión actual: v" + version;
      if (enlaceNuevo) { enlaceInput.value = enlaceNuevo; documento.enlace = enlaceNuevo; actualizarAbrirEnlace(); }
      agregarFilaCambio({ version, fecha: hoyISO(), motivo, hechoPor: user.email });

      nuevaVersionForm.reset();
      nuevaVersionForm.closest("details").open = false;
      nuevaVersionAlert.textContent = "Nueva versión registrada.";
      nuevaVersionAlert.className = "form-alert show ok";
    } catch (err) {
      nuevaVersionAlert.textContent = err.message || "No se pudo registrar la versión.";
      nuevaVersionAlert.className = "form-alert show error";
    } finally {
      nuevaVersionBtn.disabled = false;
      nuevaVersionBtn.textContent = "Registrar versión";
    }
  });
});
