import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, addDoc, deleteDoc, getDocs, runTransaction, updateDoc, setDoc, serverTimestamp,
  onSnapshot, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, requireAuth, obtenerPerfil } from "./firebase-control.js";
import { generarOrdenTrabajoPDF } from "./ordenes-trabajo-pdf.js";
import { RIESGOS, PREOPERACIONALES } from "./ordenes-trabajo-datos.js";

const contenidoOrdenes = document.getElementById("contenidoOrdenes");
const contenidoParticipante = document.getElementById("contenidoParticipante");
const sinPermisoAviso = document.getElementById("sinPermisoAviso");
const navLink = document.getElementById("navOrdenesTrabajo");

const tbody = document.getElementById("listaOrdenes");
const sinOrdenes = document.getElementById("sinOrdenes");
const vistaPreviaOrdenEl = document.getElementById("otVistaPrevia");
const tbodyParticipante = document.getElementById("listaOrdenesParticipante");
const sinOrdenesParticipante = document.getElementById("sinOrdenesParticipante");
const form = document.getElementById("ordenForm");
const alertBox = document.getElementById("ordenAlert");
const guardarBtn = document.getElementById("guardarOrdenBtn");
const tituloModal = document.getElementById("tituloModalOrden");
const seccionesJefe = document.getElementById("otSeccionesJefe");
const seccionAlistamiento = document.getElementById("otSeccionAlistamiento");
const seccionCierre = document.getElementById("otSeccionCierre");
const resumenParticipante = document.getElementById("otResumenParticipante");
const confirmacionCreada = document.getElementById("otConfirmacionCreada");
const confirmacionNumero = document.getElementById("otConfirmacionNumero");
const confirmacionSinTelefono = document.getElementById("otConfirmacionSinTelefono");

const selectContrato = document.getElementById("otContrato");
const selectResponsable = document.getElementById("otResponsable");
const personalLista = document.getElementById("otPersonalLista");
const riesgosLista = document.getElementById("otRiesgosLista");
const preoperacionalesLista = document.getElementById("otPreoperacionalesLista");
const selectVehiculo = document.getElementById("otVehiculo");
const vehiculoOtroFila = document.getElementById("otVehiculoOtroFila");
const elaboraIdentidadEl = document.getElementById("otElaboraIdentidad");
const responsableIdentidadEl = document.getElementById("otResponsableIdentidad");
const descripcionEl = document.getElementById("otDescripcion");
const descripcionBloqueadaAviso = document.getElementById("otDescripcionBloqueadaAviso");

let empleadosActivos = [];
let vehiculosPorId = {};
let ordenIdEnEdicion = null;
let usuarioActual = null;
let perfilActual = null;

// "jefe": crear/editar completo (abrirModalNueva/abrirModalEditar).
// "riesgos": el responsable diligencia alto riesgo/PESV/preoperacionales
// por primera vez (Paso 3). "cierre": el responsable cierra la orden con
// firma (Paso 4). El submit (más abajo) guarda un subconjunto de campos
// distinto según este modo — así el responsable nunca puede pisar sin
// querer los datos generales/contrato/vehículo que diligenció el jefe.
let modoFormulario = "jefe";

// En qué paso está una orden para el responsable: si "altoRiesgo" nunca se
// guardó todavía, le falta el Paso 3 completo; si ya se guardó pero la
// orden sigue ACTIVA, le falta el Paso 4 (cerrarla con firma); si ya está
// CERRADA, no le queda nada pendiente.
function faseDeOrden(orden) {
  if (!orden.alistamientoCompletado) return "riesgos";
  if (orden.estado !== "CERRADA") return "cierre";
  return "cerrada";
}

// ---- firma dibujada a mano — fábrica reutilizable. Pointer Events cubre
// mouse/touch/lápiz con el mismo código, no hace falta una librería
// aparte para un trazo libre. Antes solo existía para el cierre (Paso 4,
// quien ejecuta los trabajos); ahora también hace falta para quien genera
// la orden (Paso 1) — cada una con su propio lienzo y estado, para que
// firmar una nunca pueda tocar ni borrar la otra (ver garantía de roles
// más abajo, y firmaCierre/firmaElabora donde se instancian).
function crearFirma(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#1f2732";
  let dibujando = false;
  let tieneTrazoNuevo = false;
  // Firma que ya traía la orden (o la firma guardada del perfil) al cargar
  // el lienzo — para no perderla sin querer al guardar si nadie dibujó
  // encima (tieneTrazoNuevo solo pasa a true con un trazo hecho a mano en
  // ESTA sesión del formulario; cargar() no cuenta).
  let existente = null;

  function posicion(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (canvas.dataset.soloLectura === "1") return;
    e.preventDefault();
    dibujando = true;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dibujando) return;
    e.preventDefault();
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    tieneTrazoNuevo = true;
  });
  window.addEventListener("pointerup", () => { dibujando = false; });

  function limpiar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    tieneTrazoNuevo = false;
    existente = null;
  }
  // Dibuja una firma ya guardada (de una orden ya diligenciada, o la firma
  // digital guardada en el perfil) — no cuenta como "trazo nuevo".
  function cargar(dataUrl) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    tieneTrazoNuevo = false;
    existente = dataUrl || null;
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = dataUrl;
  }
  return {
    canvas,
    limpiar,
    cargar,
    get tieneTrazoNuevo() { return tieneTrazoNuevo; },
    dataUrl() { return tieneTrazoNuevo ? canvas.toDataURL("image/png") : existente; }
  };
}

const firmaCierre = crearFirma(document.getElementById("otFirmaCanvas"));
document.getElementById("otLimpiarFirmaBtn").addEventListener("click", firmaCierre.limpiar);

const firmaElabora = crearFirma(document.getElementById("otFirmaElaboraCanvas"));
document.getElementById("otLimpiarFirmaElaboraBtn").addEventListener("click", firmaElabora.limpiar);
const guardarFirmaCheck = document.getElementById("otGuardarFirmaCheck");

// Orden puntual a abrir de un tirón al entrar (ver enlaceWhatsApp): el
// enlace que se manda al responsable trae "?id=" para que no tenga que
// buscarla a mano entre las suyas — se consume una sola vez (el flag
// abajo), así que cerrar el modal y volver a la lista no la vuelve a abrir.
const idDesdeUrl = new URLSearchParams(window.location.search).get("id");
let ordenDesdeUrlYaAbierta = false;
function abrirOrdenDesdeUrlSiHaceFalta(ordenes, abrir) {
  if (ordenDesdeUrlYaAbierta || !idDesdeUrl) return;
  const orden = ordenes.find((o) => o.id === idDesdeUrl);
  if (!orden) return;
  ordenDesdeUrlYaAbierta = true;
  abrir(orden);
}

const VALOR_VEHICULO_OTRO = "__otro__";
function actualizarVisibilidadVehiculoOtro() {
  vehiculoOtroFila.classList.toggle("oculto", selectVehiculo.value !== VALOR_VEHICULO_OTRO);
}
selectVehiculo.addEventListener("change", actualizarVisibilidadVehiculoOtro);

// Repuebla el <select> de vehículos desde "vehiculosPorId" (actualizado por
// el onSnapshot de más abajo) — se llama tanto al abrir el modal como cada
// vez que la lista cambia, para que un vehículo agregado por otra persona
// aparezca sin recargar. Conserva la selección actual si sigue existiendo.
function repoblarSelectVehiculo(valorPrevio) {
  const anterior = valorPrevio ?? selectVehiculo.value;
  selectVehiculo.innerHTML = "";
  selectVehiculo.appendChild(new Option("Selecciona un vehículo…", ""));
  Object.values(vehiculosPorId)
    .sort((a, b) => a.placa.localeCompare(b.placa))
    .forEach((v) => selectVehiculo.appendChild(new Option(`${v.placa} — ${v.tipo || "sin tipo"}`, v.id)));
  selectVehiculo.appendChild(new Option("Otro (vehículo distinto)", VALOR_VEHICULO_OTRO));
  if ([...selectVehiculo.options].some((o) => o.value === anterior)) selectVehiculo.value = anterior;
  actualizarVisibilidadVehiculoOtro();
}

document.getElementById("otAgregarVehiculoBtn").addEventListener("click", async () => {
  const placa = document.getElementById("otVehiculoNuevoPlaca").value.trim().toUpperCase();
  const tipo = document.getElementById("otVehiculoNuevoTipo").value.trim();
  if (!placa) { window.alert("Escribe la placa del vehículo."); return; }
  try {
    await addDoc(collection(db, "vehiculos"), { placa, tipo, creadoPor: usuarioActual.email, creadoEn: serverTimestamp() });
    document.getElementById("otVehiculoNuevoPlaca").value = "";
    document.getElementById("otVehiculoNuevoTipo").value = "";
  } catch (err) {
    window.alert(err.message || "No se pudo agregar el vehículo.");
  }
});

const nuevaOrdenBackdrop = document.getElementById("nuevaOrdenBackdrop");
// El modal vive en el HTML anidado dentro de #contenidoOrdenes, que se
// oculta con display:none para quien no tiene autorizadoOrdenesTrabajo
// (ver más abajo) — un display:none en un ancestro esconde cualquier
// descendiente aunque el modal reciba su propia clase .open, así que a un
// participante sin ese permiso general el botón "Completar" no le abría
// nada (el modal sí quedaba con .open, pero su contenedor padre seguía
// oculto). Sacarlo de ese contenedor apenas carga la página lo deja
// visible para los dos flujos (jefe y participante) sin tocar el resto
// del HTML.
document.body.appendChild(nuevaOrdenBackdrop);
document.getElementById("nuevaOrdenBtn").addEventListener("click", () => {
  abrirModalNueva();
  nuevaOrdenBackdrop.classList.add("open");
});
document.getElementById("cancelarOrdenBtn").addEventListener("click", () => {
  nuevaOrdenBackdrop.classList.remove("open");
});

function mostrarAlerta(texto, tipo) {
  alertBox.textContent = texto;
  alertBox.className = `form-alert show ${tipo}`;
}

// <option> de un empleado activo: mismo criterio que ofertas.js (nombre —
// cargo), con la cédula guardada en dataset para no tener que volver a
// buscar el empleado al leer el formulario — es lo que identifica al
// empleado en la Orden de Trabajo (ya no un "código" aparte). Los que
// vienen sincronizados de Cinco Conecta (ver más abajo) llevan "(Conecta)"
// al final para distinguirlos.
function opcionEmpleado(e) {
  const opt = document.createElement("option");
  opt.value = e.email;
  const etiquetaOrigen = e.origen === "conecta" ? " (Conecta)" : "";
  opt.textContent = (e.cargo ? `${e.nombre} — ${e.cargo}` : e.nombre) + etiquetaOrigen;
  opt.dataset.nombre = e.nombre;
  opt.dataset.cedula = e.cedula || "";
  opt.dataset.telefono = e.telefono || "";
  return opt;
}

function datosDeOpcion(select) {
  const opt = select.selectedOptions[0];
  if (!opt || !opt.value) return null;
  return { email: opt.value, nombre: opt.dataset.nombre, cedula: opt.dataset.cedula, telefono: opt.dataset.telefono };
}

// Pinta "Nombre — C.C. ###" en la fila inferior del bloque de
// Responsables, para verificar de una vez (antes de guardar) que la
// cédula sí quedó bien vinculada — en vez de descubrir recién en el PDF
// que llegó vacía. Sin nombre todavía (nada seleccionado) queda en "—".
function pintarIdentidad(el, nombre, cedula) {
  el.textContent = nombre ? `${nombre} — C.C. ${cedula || "sin cédula registrada"}` : "—";
  el.classList.toggle("sin-cedula", Boolean(nombre) && !cedula);
}

// Quien elabora la orden es siempre quien inició sesión (no se elige a
// mano) — su cédula sale de Cinco Conecta (fuente autorizada) si está
// sincronizado ahí; si no, de la cédula digitada a mano en su perfil de
// Cinco SAS control ("empleados"). Si la misma persona existe en ambas
// colecciones con el mismo correo, empleadosActivos trae las DOS entradas
// (propios primero, luego Conecta) — por eso se buscan TODAS las
// coincidencias y se prioriza la de origen "conecta", en vez de un
// .find() simple que se quedaría con la de "propios" (cédula casi
// siempre vacía) sin llegar nunca a mirar la de Conecta.
function identidadElaborador() {
  const coincidencias = empleadosActivos.filter((e) => e.email === usuarioActual?.email);
  const cedula = coincidencias.find((e) => e.origen === "conecta" && e.cedula)?.cedula
    || perfilActual?.cedula
    || coincidencias.find((e) => e.cedula)?.cedula
    || "";
  return { nombre: perfilActual?.nombre || usuarioActual?.email || "", cedula };
}

selectResponsable.addEventListener("change", () => {
  const datos = datosDeOpcion(selectResponsable);
  pintarIdentidad(responsableIdentidadEl, datos?.nombre, datos?.cedula);
});

function nuevaFilaPersonal(persona) {
  const fila = document.createElement("div");
  fila.className = "control-ot-personal-fila";

  const select = document.createElement("select");
  select.appendChild(new Option("Selecciona un empleado…", ""));
  empleadosActivos.forEach((e) => select.appendChild(opcionEmpleado(e)));
  if (persona?.email) select.value = persona.email;

  const btnQuitar = document.createElement("button");
  btnQuitar.type = "button";
  btnQuitar.className = "control-btn-mini";
  btnQuitar.textContent = "Quitar";
  btnQuitar.addEventListener("click", () => fila.remove());

  fila.append(select, btnQuitar);
  return fila;
}

// Checklists de riesgo/preoperacionales: un <select> chico por elemento,
// en vez de radios sueltos — más compacto para 8/15 ítems seguidos (ver
// .control-ot-riesgos/.control-ot-preoperacionales en styles.css).
function renderChecklist(contenedor, items, opciones, valores) {
  contenedor.innerHTML = "";
  items.forEach((item) => {
    const fila = document.createElement("div");
    fila.className = "control-ot-item";
    const span = document.createElement("span");
    span.textContent = item.nombre;
    const select = document.createElement("select");
    select.dataset.clave = item.clave;
    opciones.forEach((op) => select.appendChild(new Option(op, op)));
    select.value = valores?.[item.clave] || opciones[0];
    fila.append(span, select);
    contenedor.appendChild(fila);
  });
}

function leerChecklist(contenedor) {
  const valores = {};
  contenedor.querySelectorAll("select[data-clave]").forEach((sel) => { valores[sel.dataset.clave] = sel.value; });
  return valores;
}

document.getElementById("otAgregarPersonaBtn").addEventListener("click", () => {
  personalLista.appendChild(nuevaFilaPersonal());
});

// Deja los tres bloques del formulario (Datos generales.../Alto
// riesgo+PESV+Preoperacionales/Cierre) mostrando solo los que aplican al
// paso actual, y el formulario visible en vez de la confirmación de
// "orden creada" (ver mostrarConfirmacionCreada más abajo).
function mostrarPaso({ jefe = false, alistamiento = false, cierre = false }) {
  seccionesJefe.classList.toggle("oculto", !jefe);
  seccionAlistamiento.classList.toggle("oculto", !alistamiento);
  seccionCierre.classList.toggle("oculto", !cierre);
  form.classList.remove("oculto");
  confirmacionCreada.classList.add("oculto");
}

function habilitarCamposCierre(habilitado) {
  ["otObservaciones", "otFechaCierre", "otHorasAdicionales", "otValesAlimentacion", "otPernoctada"]
    .forEach((id) => { document.getElementById(id).disabled = !habilitado; });
  firmaCierre.canvas.dataset.soloLectura = habilitado ? "0" : "1";
  document.getElementById("otLimpiarFirmaBtn").classList.toggle("oculto", !habilitado);
  guardarBtn.classList.toggle("oculto", !habilitado);
}

// ---- Paso 1: el jefe crea la orden (Datos generales, Responsable,
// Descripción, Recursos) — nada de Alto riesgo/PESV/Preoperacionales/
// Cierre todavía, eso lo diligencia el responsable en los pasos 3 y 4. ----
function abrirModalNueva() {
  modoFormulario = "jefe";
  ordenIdEnEdicion = null;
  mostrarPaso({ jefe: true });
  resumenParticipante.classList.add("oculto");
  tituloModal.textContent = "Nueva orden de trabajo (Paso 1 de 4)";
  form.reset();
  personalLista.innerHTML = "";
  renderChecklist(riesgosLista, RIESGOS, ["NO", "SI"]);
  renderChecklist(preoperacionalesLista, PREOPERACIONALES, ["NO", "SI", "N/A"]);
  repoblarSelectVehiculo("");
  habilitarCamposCierre(true);
  firmaCierre.limpiar();
  guardarBtn.textContent = "Guardar y continuar";
  alertBox.className = "form-alert";

  // Nueva orden: quien la genera es siempre quien inició sesión (recién
  // se sabrá al guardar), y la descripción siempre es editable para él.
  const elaborador = identidadElaborador();
  pintarIdentidad(elaboraIdentidadEl, elaborador.nombre, elaborador.cedula);
  pintarIdentidad(responsableIdentidadEl, "", "");
  descripcionEl.readOnly = false;
  descripcionBloqueadaAviso.classList.add("oculto");

  // Firma de quien genera la orden: se pide desde ya, en este mismo Paso
  // 1 (no hay que esperar al cierre) — si ya guardó una firma digital en
  // su perfil, aparece sola; si no, queda el lienzo listo para dibujarla.
  firmaElabora.canvas.dataset.soloLectura = "0";
  firmaElabora.cargar(perfilActual?.firmaGuardada || null);
  document.getElementById("otLimpiarFirmaElaboraBtn").classList.remove("oculto");
  guardarFirmaCheck.checked = false;
  // Guardarla solo es posible con un perfil ya existente en "empleados"
  // (ver firestore.rules: la actualización propia de "firmaGuardada"
  // necesita el doc ya creado) — sin uno, se oculta en vez de ofrecer algo
  // que fallaría en silencio.
  guardarFirmaCheck.closest("label").classList.toggle("oculto", !perfilActual);
}

// Edición completa (botón "Editar" del jefe/administrador en la tabla
// principal) — a diferencia del flujo guiado, acá se ve y se puede
// corregir todo de una vez, por si algo quedó mal diligenciado.
function abrirModalEditar(orden) {
  modoFormulario = "jefe";
  ordenIdEnEdicion = orden.id;
  mostrarPaso({ jefe: true, alistamiento: true, cierre: true });
  resumenParticipante.classList.add("oculto");
  tituloModal.textContent = `Editar orden ${orden.numero}`;
  form.reset();

  selectContrato.value = orden.contratoId || "ADMON";
  document.getElementById("otMunicipio").value = orden.municipio || "";
  document.getElementById("otSector").value = orden.sector || "U";
  document.getElementById("otFechaInicio").value = orden.fechaHoraInicio || "";
  document.getElementById("otFechaTerminacion").value = orden.fechaHoraTerminacion || "";
  selectResponsable.value = orden.responsable?.email || "";
  descripcionEl.value = orden.descripcion || "";

  // Quien elabora quedó fijo desde que se creó la orden (no se recalcula
  // al editar); se muestra tal cual se guardó. La descripción solo la
  // puede tocar quien generó la orden — cualquier otra persona autorizada
  // a editar (otro admin, otro con permiso de OT) la ve pero no la toca,
  // para que nadie más le cambie a otro lo que va a hacer.
  pintarIdentidad(elaboraIdentidadEl, orden.elaboradoPor?.nombre, orden.elaboradoPor?.cedula);
  pintarIdentidad(responsableIdentidadEl, orden.responsable?.nombre, orden.responsable?.cedula);
  // Mismo criterio que la Rule de Firestore (ver firestore.rules,
  // match /ordenesTrabajo/): sin coincidencia exacta de correo, bloqueada.
  const puedeEditarDescripcion = orden.creadoPor === usuarioActual?.email;
  descripcionEl.readOnly = !puedeEditarDescripcion;
  descripcionBloqueadaAviso.classList.toggle("oculto", puedeEditarDescripcion);

  // Si el vehículo guardado sigue en el registro de la empresa (mismo id),
  // se selecciona ese; si no (vehículo "Otro" de cuando se creó la orden,
  // o uno que ya se borró del registro), queda en "Otro" con sus datos
  // sueltos rellenados a mano.
  const vehiculoId = orden.vehiculo?.vehiculoId;
  repoblarSelectVehiculo(vehiculoId && vehiculosPorId[vehiculoId] ? vehiculoId : VALOR_VEHICULO_OTRO);
  document.getElementById("otVehiculoTipo").value = orden.vehiculo?.tipo || "";
  document.getElementById("otVehiculoPlaca").value = orden.vehiculo?.placa || "";

  personalLista.innerHTML = "";
  (orden.personalAdicional || []).forEach((p) => personalLista.appendChild(nuevaFilaPersonal(p)));

  renderChecklist(riesgosLista, RIESGOS, ["NO", "SI"], orden.altoRiesgo);
  renderChecklist(preoperacionalesLista, PREOPERACIONALES, ["NO", "SI", "N/A"], orden.preoperacionales);

  document.getElementById("otOrigen").value = orden.pesv?.origen || "";
  document.getElementById("otDestino").value = orden.pesv?.destino || "";
  document.getElementById("otDescripcionRuta").value = orden.pesv?.descripcionRuta || "";
  document.getElementById("otPausasActivas").value = orden.pesv?.descripcionPausasActivas || "";

  document.getElementById("otObservaciones").value = orden.cierre?.observaciones || "";
  document.getElementById("otFechaCierre").value = orden.cierre?.fechaHoraCierre || "";
  document.getElementById("otHorasAdicionales").value = orden.cierre?.horasAdicionales || "";
  document.getElementById("otValesAlimentacion").value = orden.cierre?.valesAlimentacion || "";
  document.getElementById("otPernoctada").value = orden.cierre?.pernoctada || "NO";
  habilitarCamposCierre(true);
  firmaCierre.cargar(orden.cierre?.firmaDataUrl || null);

  // La firma de quien elabora quedó fija desde que se creó la orden (ver
  // identidadElaborador/elaboradoPor) — al editar se muestra tal cual,
  // siempre de solo lectura: nadie, ni siquiera quien la generó, puede
  // reescribirla encima desde este formulario.
  firmaElabora.canvas.dataset.soloLectura = "1";
  firmaElabora.cargar(orden.elaboradoPor?.firmaDataUrl || null);
  document.getElementById("otLimpiarFirmaElaboraBtn").classList.add("oculto");
  guardarFirmaCheck.closest("label").classList.add("oculto");

  guardarBtn.textContent = "Guardar cambios";
  alertBox.className = "form-alert";
  nuevaOrdenBackdrop.classList.add("open");
}

// Vista del responsable/personal asignado (sin autorizadoOrdenesTrabajo):
// mismo modal, pero solo ve "Datos generales/Responsable/Descripción/
// Recursos" como resumen de solo lectura (eso lo diligenció el jefe), y
// entra en el paso que le toque según faseDeOrden — nunca los dos al
// tiempo, para que a alguien completando el Paso 3 desde el celular no le
// aparezcan de una vez los campos de cierre que todavía no le corresponden.
function abrirModalCompletar(orden) {
  modoFormulario = faseDeOrden(orden) === "riesgos" ? "riesgos" : "cierre";
  ordenIdEnEdicion = orden.id;
  form.reset();

  resumenParticipante.classList.remove("oculto");
  resumenParticipante.innerHTML = "";
  [
    ["Contrato", orden.contratoNumero], ["Municipio", `${orden.municipio || ""} (${orden.sector === "R" ? "Rural" : "Urbano"})`],
    ["Responsable", orden.responsable?.nombre], ["Descripción", orden.descripcion]
  ].forEach(([etq, val]) => {
    const p = document.createElement("p");
    p.innerHTML = `<strong>${etq}:</strong> ${val || "—"}`;
    resumenParticipante.appendChild(p);
  });

  renderChecklist(riesgosLista, RIESGOS, ["NO", "SI"], orden.altoRiesgo);
  renderChecklist(preoperacionalesLista, PREOPERACIONALES, ["NO", "SI", "N/A"], orden.preoperacionales);

  document.getElementById("otOrigen").value = orden.pesv?.origen || "";
  document.getElementById("otDestino").value = orden.pesv?.destino || "";
  document.getElementById("otDescripcionRuta").value = orden.pesv?.descripcionRuta || "";
  document.getElementById("otPausasActivas").value = orden.pesv?.descripcionPausasActivas || "";

  document.getElementById("otObservaciones").value = orden.cierre?.observaciones || "";
  document.getElementById("otFechaCierre").value = orden.cierre?.fechaHoraCierre || "";
  document.getElementById("otHorasAdicionales").value = orden.cierre?.horasAdicionales || "";
  document.getElementById("otValesAlimentacion").value = orden.cierre?.valesAlimentacion || "";
  document.getElementById("otPernoctada").value = orden.cierre?.pernoctada || "NO";

  if (modoFormulario === "riesgos") {
    // Paso 3: alto riesgo + PESV + preoperacionales, todavía nada de cierre.
    mostrarPaso({ alistamiento: true });
    tituloModal.textContent = `Orden ${orden.numero} — Paso 3 de 4: antes de iniciar`;
    guardarBtn.textContent = "Guardar";
  } else {
    // Paso 4: cerrar la orden con firma — si ya estaba cerrada, se abre en
    // solo lectura (para verla, no para volver a firmarla encima).
    const yaCerrada = orden.estado === "CERRADA";
    mostrarPaso({ cierre: true });
    tituloModal.textContent = yaCerrada ? `Orden ${orden.numero} — cerrada` : `Orden ${orden.numero} — Paso 4 de 4: cerrar orden`;
    habilitarCamposCierre(!yaCerrada);
    firmaCierre.cargar(orden.cierre?.firmaDataUrl || null);
    guardarBtn.textContent = "Cerrar orden";
  }

  alertBox.className = "form-alert";
  nuevaOrdenBackdrop.classList.add("open");
}

function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

function escapeHtml(texto) {
  return String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const URL_APP = "https://cinco-sas.web.app/control/ordenes-trabajo.html";

// Link de wa.me: abre WhatsApp con el número del responsable y un mensaje
// listo, para que quien creó la orden lo mande desde SU PROPIO WhatsApp de
// un clic — sin API de WhatsApp Business ni número propio de la empresa.
// Un número de 10 dígitos se asume Colombia (57); si ya trae indicativo
// (más de 10 dígitos) se respeta tal cual.
function enlaceWhatsApp(orden) {
  const digitos = String(orden.responsable.telefono || "").replace(/\D/g, "");
  const numero = digitos.length === 10 ? `57${digitos}` : digitos;
  // "?id=" para que el enlace abra directo esa orden puntual (ver
  // abrirOrdenDesdeUrl más abajo) — antes llevaba a la pantalla general y
  // el responsable tenía que buscarla a mano entre las suyas.
  const mensaje = `Hola ${orden.responsable.nombre || ""}, te asignaron la Orden de Trabajo N.° ${orden.numero} (${orden.descripcion || "sin descripción"}). Ingresa a ${URL_APP}?id=${orden.id} con tu cuenta para completar el trabajo de alto riesgo, PESV, preoperacionales y cierre.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

// Abre el enlace y deja constancia en Firestore de que ya se mandó (al
// menos una vez) el aviso — a pedido del usuario, el botón NUNCA se quita
// después de usarlo (ni en la tabla ni en esta confirmación): solo cambia
// de "WhatsApp"/"Enviar por WhatsApp" a "Enviar nuevamente", para poder
// reenviarlo las veces que haga falta. Si falla el guardado del aviso no
// importa — el enlace ya se abrió igual, es solo un dato informativo.
async function abrirWhatsAppYMarcar(orden) {
  window.open(enlaceWhatsApp(orden), "_blank");
  try {
    await updateDoc(doc(db, "ordenesTrabajo", orden.id), { whatsappEnviadoEn: serverTimestamp() });
  } catch (err) { /* no crítico */ }
}

// Paso 2 (justo después de guardar el Paso 1): reemplaza el formulario por
// una confirmación con el botón de WhatsApp listo, en vez de dejar que el
// jefe tenga que cerrar el modal y buscar la fila de la orden recién
// creada en la tabla para encontrar ese mismo botón.
function mostrarConfirmacionCreada(orden) {
  form.classList.add("oculto");
  confirmacionCreada.classList.remove("oculto");
  confirmacionNumero.textContent = orden.numero;
  const btnWhatsApp = document.getElementById("otEnviarWhatsappBtn");
  const tieneTelefono = !!orden.responsable?.telefono;
  btnWhatsApp.classList.toggle("oculto", !tieneTelefono);
  btnWhatsApp.textContent = "📱 Enviar por WhatsApp al responsable";
  confirmacionSinTelefono.classList.toggle("oculto", tieneTelefono);
  btnWhatsApp.onclick = () => {
    abrirWhatsAppYMarcar(orden);
    btnWhatsApp.textContent = "📱 Enviar nuevamente por WhatsApp";
  };
}
document.getElementById("otCerrarConfirmacionBtn").addEventListener("click", () => {
  nuevaOrdenBackdrop.classList.remove("open");
});

// Fila = solo lo justo para escanear y elegir (una sola línea, sin
// acciones) — mismo patrón que Empleados en Cinco Conecta y
// Activos/Usuarios en Copropiedad Saludable: todo el detalle completo,
// incluidas las acciones, vive en el panel de vista previa de arriba
// (evita la barra horizontal que salía con la columna de acciones).
let ordenesListaCompleta = [];
let ordenesListaActual = [];
let autorizadoListaActual = false;
let ordenSeleccionadaId = null;

const otFiltroTexto = document.getElementById("otFiltroTexto");
const otFiltroContrato = document.getElementById("otFiltroContrato");
const otFiltroEstado = document.getElementById("otFiltroEstado");
otFiltroTexto.addEventListener("input", () => aplicarFiltroOrdenes());
otFiltroContrato.addEventListener("change", () => aplicarFiltroOrdenes());
otFiltroEstado.addEventListener("change", () => aplicarFiltroOrdenes());

function renderTabla(ordenes, autorizado) {
  ordenesListaCompleta = ordenes;
  autorizadoListaActual = autorizado;
  aplicarFiltroOrdenes();
}

// Filtros de texto (responsable/descripción) + contrato + estado, todos
// sobre lo que ya está cargado — pedido del usuario para encontrar rápido,
// por ejemplo, todas las órdenes de un contrato puntual.
function aplicarFiltroOrdenes() {
  const texto = otFiltroTexto.value.trim().toLowerCase();
  const contratoId = otFiltroContrato.value;
  const estado = otFiltroEstado.value;
  ordenesListaActual = ordenesListaCompleta.filter((o) => {
    if (estado && (o.estado || "ACTIVA") !== estado) return false;
    if (contratoId && o.contratoId !== (contratoId === "ADMON" ? null : contratoId)) return false;
    if (!texto) return true;
    return `${o.responsable?.nombre || ""} ${o.descripcion || ""}`.toLowerCase().includes(texto);
  });

  tbody.innerHTML = "";
  sinOrdenes.textContent = ordenesListaCompleta.length === 0
    ? "Todavía no hay órdenes de trabajo registradas."
    : "Ninguna orden coincide con el filtro.";
  sinOrdenes.classList.toggle("oculto", ordenesListaActual.length > 0);

  if (ordenesListaActual.length === 0) {
    ordenSeleccionadaId = null;
    pintarVistaPreviaOrden();
    return;
  }
  if (!ordenSeleccionadaId || !ordenesListaActual.some((o) => o.id === ordenSeleccionadaId)) {
    ordenSeleccionadaId = ordenesListaActual[0].id;
  }

  ordenesListaActual.forEach((o) => {
    const fila = document.createElement("tr");
    fila.dataset.id = o.id;
    fila.appendChild(celda(String(o.numero ?? "—")));

    const tdEstado = celda(o.estado || "ACTIVA");
    tdEstado.className = o.estado === "CERRADA" ? "text-muted" : "";
    fila.appendChild(tdEstado);

    fila.appendChild(celda(o.contratoNumero || "—"));
    fila.appendChild(celda(`${o.responsable?.nombre || "—"} · ${o.descripcion || ""}`.slice(0, 90)));
    fila.appendChild(celda((o.fechaHoraInicio || "").replace("T", " ")));

    fila.addEventListener("click", () => {
      ordenSeleccionadaId = o.id;
      actualizarResaltadoOrden();
      pintarVistaPreviaOrden();
    });
    tbody.appendChild(fila);
  });
  actualizarResaltadoOrden();
  pintarVistaPreviaOrden();
}

function actualizarResaltadoOrden() {
  tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.classList.toggle("control-fila-fijada", tr.dataset.id === ordenSeleccionadaId);
  });
}

function pintarVistaPreviaOrden() {
  const o = ordenesListaActual.find((x) => x.id === ordenSeleccionadaId);
  if (!o) {
    vistaPreviaOrdenEl.innerHTML = `<p class="text-muted" style="margin:0;">${ordenesListaCompleta.length === 0 ? "Todavía no hay órdenes de trabajo registradas." : "Ninguna orden coincide con el filtro."}</p>`;
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

  vistaPreviaOrdenEl.innerHTML = `
    <div class="control-vp-encabezado">
      <span class="control-vp-titulo">Orden ${escapeHtml(String(o.numero ?? "—"))} — ${escapeHtml(o.estado || "ACTIVA")}</span>
      <div class="control-vp-acciones" id="otVpAcciones"></div>
    </div>
    <div class="control-vp-grupos">
      ${grupo("Datos generales", `
        ${campo("Contrato", o.contratoNumero)}
        ${campo("Municipio", `${o.municipio || "-"} (${o.sector === "R" ? "Rural" : "Urbano"})`)}
        ${campo("Inicio", (o.fechaHoraInicio || "-").replace("T", " "))}
        ${campo("Terminación", (o.fechaHoraTerminacion || "-").replace("T", " "))}
      `)}
      ${grupo("Responsable de los trabajos", `
        ${campo("Nombre", o.responsable?.nombre)}
        ${campo("Teléfono", o.responsable?.telefono)}
      `)}
      ${grupo("Descripción", campo("Detalle", o.descripcion))}
    </div>
  `;

  const accionesEl = document.getElementById("otVpAcciones");

  const btnPdf = document.createElement("button");
  btnPdf.type = "button";
  btnPdf.className = "control-btn-mini";
  btnPdf.textContent = "PDF";
  btnPdf.addEventListener("click", async () => {
    btnPdf.disabled = true;
    try {
      const pdf = await generarOrdenTrabajoPDF(o);
      pdf.save(`orden-trabajo-${o.numero}.pdf`);
    } finally {
      btnPdf.disabled = false;
    }
  });
  accionesEl.appendChild(btnPdf);

  if (!autorizadoListaActual) return;

  const btnEditar = document.createElement("button");
  btnEditar.type = "button";
  btnEditar.className = "control-btn-mini";
  btnEditar.textContent = "Editar";
  btnEditar.addEventListener("click", () => abrirModalEditar(o));
  accionesEl.appendChild(btnEditar);

  // Abre WhatsApp Web/app del que genera la orden (con SU propia sesión
  // ya iniciada) con el mensaje y el número del responsable
  // pre-rellenados — nada se envía automático, hay que darle "Enviar" del
  // lado de WhatsApp. No requiere ninguna API de WhatsApp Business.
  if (o.responsable?.telefono) {
    const btnWhatsApp = document.createElement("button");
    btnWhatsApp.type = "button";
    btnWhatsApp.className = "control-btn-mini";
    btnWhatsApp.textContent = o.whatsappEnviadoEn ? "Enviar nuevamente" : "WhatsApp";
    btnWhatsApp.addEventListener("click", () => {
      abrirWhatsAppYMarcar(o);
      btnWhatsApp.textContent = "Enviar nuevamente";
    });
    accionesEl.appendChild(btnWhatsApp);
  }

  const btnBorrar = document.createElement("button");
  btnBorrar.type = "button";
  btnBorrar.className = "control-btn-danger";
  btnBorrar.textContent = "Borrar";
  btnBorrar.addEventListener("click", async () => {
    const confirmado = window.confirm(`¿Seguro que quieres borrar la orden ${o.numero}?\n\nEsta acción no se puede deshacer.`);
    if (!confirmado) return;
    btnBorrar.disabled = true;
    try {
      await deleteDoc(doc(db, "ordenesTrabajo", o.id));
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo borrar la orden.", "error");
      btnBorrar.disabled = false;
    }
  });
  accionesEl.appendChild(btnBorrar);
}

requireAuth(async (user) => {
  usuarioActual = user;
  document.getElementById("userEmail").textContent = user.email;

  perfilActual = await obtenerPerfil(user.email);
  const esAdmin = perfilActual?.estado === "activo" && perfilActual?.rol === "admin";
  const autorizado = esAdmin || (perfilActual?.estado === "activo" && perfilActual?.autorizadoOrdenesTrabajo === true);

  if (!autorizado) {
    navLink.classList.add("oculto");
    contenidoOrdenes.classList.add("oculto");

    // No tiene el permiso de gerencia, pero puede ser el responsable o
    // parte del personal adicional de alguna orden puntual — en ese caso
    // ve solo esas, para completar su parte desde el celular (ver
    // abrirModalCompletar). "personalEmails" es la lista plana que se
    // guarda junto con "responsable"/"personalAdicional" para esto mismo.
    // Si no tiene ninguna, sinOrdenesParticipante ya avisa que no hay
    // nada asignado — no hace falta el mensaje genérico de "sin permiso"
    // aparte para este caso.
    contenidoParticipante.classList.remove("oculto");
    onSnapshot(query(collection(db, "ordenesTrabajo"), where("personalEmails", "array-contains", user.email)), (snapshot) => {
      const misOrdenes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      abrirOrdenDesdeUrlSiHaceFalta(misOrdenes, abrirModalCompletar);
      tbodyParticipante.innerHTML = "";
      sinOrdenesParticipante.classList.toggle("oculto", misOrdenes.length > 0);
      misOrdenes.forEach((o) => {
        const fila = document.createElement("tr");
        fila.appendChild(celda(String(o.numero ?? "—")));
        fila.appendChild(celda(o.estado || "ACTIVA"));
        fila.appendChild(celda((o.descripcion || "").slice(0, 90)));
        const tdAccion = document.createElement("td");
        const btnCompletar = document.createElement("button");
        btnCompletar.type = "button";
        btnCompletar.className = "control-btn-mini";
        const fase = faseDeOrden(o);
        btnCompletar.textContent = fase === "riesgos" ? "Completar" : fase === "cierre" ? "Cerrar orden" : "Ver";
        btnCompletar.addEventListener("click", () => abrirModalCompletar(o));
        tdAccion.appendChild(btnCompletar);
        fila.appendChild(tdAccion);
        tbodyParticipante.appendChild(fila);
      });
    });

    // El modal (#ordenForm) se comparte con la vista del jefe, así que
    // necesita los mismos catálogos para las listas de riesgo/
    // preoperacionales (RIESGOS/PREOPERACIONALES ya están importados;
    // renderChecklist no depende de más datos). Los desplegables de
    // contrato/responsable/vehículo del jefe quedan vacíos, pero están
    // ocultos (#otSeccionesJefe) así que no importa.
    // Paso 3 (alistamientoCompletado:true la primera vez) o Paso 4 (cierre
    // + firma) según en qué fase haya abierto abrirModalCompletar — nunca
    // se manda contrato/responsable/vehículo, que son del jefe y acá ni
    // siquiera están rellenos (los <select> quedan en su opción vacía).
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      alertBox.className = "form-alert";

      if (modoFormulario === "cierre") {
        if (!document.getElementById("otFechaCierre").value) {
          mostrarAlerta("Escribe la fecha y hora de cierre.", "error");
          return;
        }
        if (!firmaCierre.tieneTrazoNuevo) {
          mostrarAlerta("Falta la firma de quien ejecutó los trabajos.", "error");
          return;
        }
      }

      guardarBtn.disabled = true;
      guardarBtn.textContent = "Guardando...";
      try {
        if (modoFormulario === "riesgos") {
          await updateDoc(doc(db, "ordenesTrabajo", ordenIdEnEdicion), {
            altoRiesgo: leerChecklist(riesgosLista),
            pesv: {
              origen: document.getElementById("otOrigen").value.trim(),
              destino: document.getElementById("otDestino").value.trim(),
              descripcionRuta: document.getElementById("otDescripcionRuta").value.trim(),
              descripcionPausasActivas: document.getElementById("otPausasActivas").value.trim()
            },
            preoperacionales: leerChecklist(preoperacionalesLista),
            alistamientoCompletado: true,
            actualizadoEn: serverTimestamp(),
            actualizadoPor: user.email
          });
          mostrarAlerta("Guardado. Cuando termines el trabajo, vuelve a entrar a esta orden para cerrarla con tu firma.", "ok");
        } else {
          await updateDoc(doc(db, "ordenesTrabajo", ordenIdEnEdicion), {
            cierre: {
              observaciones: document.getElementById("otObservaciones").value.trim(),
              fechaHoraCierre: document.getElementById("otFechaCierre").value,
              horasAdicionales: document.getElementById("otHorasAdicionales").value.trim(),
              valesAlimentacion: document.getElementById("otValesAlimentacion").value.trim(),
              pernoctada: document.getElementById("otPernoctada").value,
              firmaDataUrl: firmaCierre.dataUrl()
            },
            estado: "CERRADA",
            actualizadoEn: serverTimestamp(),
            actualizadoPor: user.email
          });
          mostrarAlerta("Orden cerrada.", "ok");
        }
        nuevaOrdenBackdrop.classList.remove("open");
      } catch (err) {
        mostrarAlerta(err.message || "No se pudo guardar.", "error");
      } finally {
        guardarBtn.disabled = false;
        guardarBtn.textContent = modoFormulario === "riesgos" ? "Guardar" : "Cerrar orden";
      }
    });
    document.getElementById("cancelarOrdenBtn").addEventListener("click", () => nuevaOrdenBackdrop.classList.remove("open"));
    return;
  }

  // Contratos (opción fija "Administrativo" primero, para trabajos que no
  // son de un contrato puntual — ver Tabla de contratos en contratos.js).
  selectContrato.appendChild(new Option("Administrativo (ADMON)", "ADMON"));
  otFiltroContrato.appendChild(new Option("Administrativo (ADMON)", "ADMON"));
  const contratosSnap = await getDocs(query(collection(db, "contratos"), orderBy("creadoEn", "desc")));
  const contratosPorId = {};
  contratosSnap.forEach((docSnap) => {
    const c = docSnap.data();
    contratosPorId[docSnap.id] = c;
    const etiqueta = `${c.numero || c.codigo || "(sin número)"} — ${c.cliente || ""}`;
    selectContrato.appendChild(new Option(etiqueta, docSnap.id));
    otFiltroContrato.appendChild(new Option(etiqueta, docSnap.id));
  });

  // Empleados activos, para el responsable y las filas de personal
  // adicional — mismo patrón que ofertas.js (query por nombre, filtro por
  // estado activo en el cliente). Se suman los de Cinco Conecta
  // ("empleadosConecta", mantenida al día por la Cloud Function
  // recibirStaffConecta — ver firestore.rules) normalizados a la misma
  // forma {nombre, email, cargo, cedula}, marcados con origen:"conecta"
  // para que opcionEmpleado() les agregue "(Conecta)".
  const [empleadosSnap, empleadosConectaSnap] = await Promise.all([
    getDocs(query(collection(db, "empleados"), orderBy("nombre"))),
    getDocs(query(collection(db, "empleadosConecta"), orderBy("nombre")))
  ]);
  const propios = empleadosSnap.docs.map((d) => d.data()).filter((e) => e.estado === "activo");
  const deConecta = empleadosConectaSnap.docs
    .map((d) => d.data())
    .filter((e) => e.estado === "activo")
    .map((e) => ({ nombre: e.nombre, email: e.correo, cargo: e.cargo, cedula: e.cedula || "", telefono: e.telefono || "", origen: "conecta" }));

  // Si la misma persona está en las dos colecciones con el mismo correo,
  // antes quedaban DOS opciones idénticas en el desplegable — si alguien
  // elegía por error la de "propios" (con cédula casi siempre vacía, ese
  // dato lo mantiene Conecta) la orden se guardaba sin cédula aunque la
  // persona sí la tuviera registrada en Conecta. Se combinan en una sola
  // entrada por correo, priorizando la cédula/teléfono de Conecta (fuente
  // autorizada) y completando con lo de "propios" solo si a Conecta le
  // falta.
  const porCorreo = new Map();
  [...propios, ...deConecta].forEach((e) => {
    const correo = (e.email || "").toLowerCase();
    if (!correo) return;
    const previo = porCorreo.get(correo);
    if (!previo) { porCorreo.set(correo, e); return; }
    const conecta = e.origen === "conecta" ? e : previo.origen === "conecta" ? previo : null;
    const otro = conecta === e ? previo : e;
    porCorreo.set(correo, {
      nombre: conecta?.nombre || otro.nombre,
      // Se conserva el correo tal cual venía (no forzado a minúsculas) —
      // es el mismo valor que queda guardado en la orden y con el que se
      // compara al reabrirla para editar (selectResponsable.value); forzar
      // minúsculas acá rompería esa coincidencia en órdenes ya guardadas
      // con el correo en otra escritura.
      email: conecta?.email || otro.email,
      cargo: conecta?.cargo || otro.cargo,
      cedula: conecta?.cedula || otro.cedula || "",
      telefono: conecta?.telefono || otro.telefono || "",
      origen: conecta ? "conecta" : otro.origen
    });
  });
  empleadosActivos = [...porCorreo.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  empleadosActivos.forEach((e) => selectResponsable.appendChild(opcionEmpleado(e)));

  const q = query(collection(db, "ordenesTrabajo"), orderBy("numero", "desc"));
  onSnapshot(q, (snapshot) => {
    const listaOrdenes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTabla(listaOrdenes, autorizado);
    abrirOrdenDesdeUrlSiHaceFalta(listaOrdenes, abrirModalEditar);
  });

  // Vehículos de la empresa — en vivo, para que uno agregado por otra
  // persona (o desde "+ Agregar a la lista de la empresa" en este mismo
  // formulario) aparezca en el desplegable sin recargar.
  onSnapshot(collection(db, "vehiculos"), (snapshot) => {
    vehiculosPorId = {};
    snapshot.forEach((d) => { vehiculosPorId[d.id] = { id: d.id, ...d.data() }; });
    if (nuevaOrdenBackdrop.classList.contains("open")) repoblarSelectVehiculo();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    guardarBtn.disabled = true;
    guardarBtn.textContent = "Guardando...";
    alertBox.className = "form-alert";

    const responsable = datosDeOpcion(selectResponsable);
    if (!responsable) {
      mostrarAlerta("Selecciona el empleado responsable.", "error");
      guardarBtn.disabled = false;
      guardarBtn.textContent = ordenIdEnEdicion ? "Guardar cambios" : "Guardar";
      return;
    }
    // La firma de quien genera la orden solo se pide (y solo existe el
    // lienzo habilitado) al crearla — al editar queda de solo lectura, ver
    // abrirModalEditar.
    if (!ordenIdEnEdicion && !firmaElabora.dataUrl()) {
      mostrarAlerta("Falta tu firma como responsable de la orden de trabajo.", "error");
      guardarBtn.disabled = false;
      guardarBtn.textContent = "Guardar";
      return;
    }

    const contratoId = selectContrato.value;
    const contratoNumero = contratoId === "ADMON" ? "ADMON" : (contratosPorId[contratoId]?.numero || contratosPorId[contratoId]?.codigo || "");

    const personalAdicional = [...personalLista.querySelectorAll(".control-ot-personal-fila select")]
      .map((sel) => datosDeOpcion(sel))
      .filter(Boolean);

    const fechaHoraCierre = document.getElementById("otFechaCierre").value;
    const datos = {
      contratoId: contratoId === "ADMON" ? null : contratoId,
      contratoNumero,
      municipio: document.getElementById("otMunicipio").value.trim(),
      sector: document.getElementById("otSector").value,
      fechaHoraInicio: document.getElementById("otFechaInicio").value,
      fechaHoraTerminacion: document.getElementById("otFechaTerminacion").value,
      responsable,
      // Lista plana de correos (responsable + personal adicional), aparte
      // de "responsable"/"personalAdicional" — Firestore Rules no puede
      // recorrer un arreglo de mapas para buscar un correo adentro, así
      // que se guarda también así de simple para que la regla de
      // "es participante de esta orden" (ver firestore.rules) pueda usar
      // un hasAny/in directo. Se recalcula completo en cada guardado, no
      // hay que mantenerla a mano.
      personalEmails: [responsable.email, ...personalAdicional.map((p) => p.email)],
      descripcion: descripcionEl.value.trim(),
      vehiculo: selectVehiculo.value && selectVehiculo.value !== VALOR_VEHICULO_OTRO
        ? { vehiculoId: selectVehiculo.value, tipo: vehiculosPorId[selectVehiculo.value]?.tipo || "", placa: vehiculosPorId[selectVehiculo.value]?.placa || "" }
        : {
            vehiculoId: null,
            tipo: document.getElementById("otVehiculoTipo").value.trim(),
            placa: document.getElementById("otVehiculoPlaca").value.trim().toUpperCase()
          },
      personalAdicional,
      altoRiesgo: leerChecklist(riesgosLista),
      pesv: {
        origen: document.getElementById("otOrigen").value.trim(),
        destino: document.getElementById("otDestino").value.trim(),
        descripcionRuta: document.getElementById("otDescripcionRuta").value.trim(),
        descripcionPausasActivas: document.getElementById("otPausasActivas").value.trim()
      },
      preoperacionales: leerChecklist(preoperacionalesLista),
      cierre: {
        observaciones: document.getElementById("otObservaciones").value.trim(),
        fechaHoraCierre,
        horasAdicionales: document.getElementById("otHorasAdicionales").value.trim(),
        valesAlimentacion: document.getElementById("otValesAlimentacion").value.trim(),
        pernoctada: document.getElementById("otPernoctada").value,
        firmaDataUrl: firmaCierre.dataUrl()
      },
      // La orden pasa sola a CERRADA en cuanto se guarda con fecha y hora
      // de cierre diligenciada — a pedido del usuario, sin botón aparte.
      estado: fechaHoraCierre ? "CERRADA" : "ACTIVA",
      actualizadoEn: serverTimestamp(),
      actualizadoPor: user.email
    };

    try {
      if (ordenIdEnEdicion) {
        await updateDoc(doc(db, "ordenesTrabajo", ordenIdEnEdicion), datos);
        mostrarAlerta("Orden de trabajo actualizada.", "ok");
        nuevaOrdenBackdrop.classList.remove("open");
      } else {
        // Mismo patrón transaccional de correspondencia.js/contratos.js,
        // pero con un único contador global sin prefijo ni año (el
        // consecutivo va pelado, igual que en la plantilla en papel) —
        // arranca en 18235 si el contador todavía no existe, para
        // continuar el último número real usado en papel (18234).
        const contadorRef = doc(db, "contadores", "ordenTrabajo");
        const ordenRef = doc(collection(db, "ordenesTrabajo"));
        let numero;
        await runTransaction(db, async (tx) => {
          const contadorSnap = await tx.get(contadorRef);
          numero = contadorSnap.exists() ? contadorSnap.data().siguiente : 18235;
          tx.set(contadorRef, { siguiente: numero + 1 });
          const elaborador = identidadElaborador();
          tx.set(ordenRef, {
            ...datos, numero,
            elaboradoPor: { email: user.email, nombre: elaborador.nombre, cedula: elaborador.cedula, firmaDataUrl: firmaElabora.dataUrl() },
            creadoPor: user.email, creadoEn: serverTimestamp()
          });
        });
        // "Guardar esta firma como mi firma digital": queda en el propio
        // perfil (empleados/{email}, campo suelto — ver firestore.rules)
        // para que la próxima orden que genere ya la traiga puesta sola.
        // No es crítico si falla (ej. sin perfil en "empleados" todavía);
        // la orden ya quedó guardada con su firma de todos modos.
        if (guardarFirmaCheck.checked) {
          try {
            await setDoc(doc(db, "empleados", user.email), { firmaGuardada: firmaElabora.dataUrl() }, { merge: true });
          } catch (err) { /* no crítico */ }
        }
        // Paso 2: en vez de cerrar el modal de una vez, se ofrece mandar
        // el enlace por WhatsApp al responsable ahí mismo — sin tener que
        // buscar la orden recién creada en la tabla para dar clic en su
        // botón "WhatsApp" aparte.
        mostrarConfirmacionCreada({ id: ordenRef.id, numero, responsable, descripcion: datos.descripcion });
      }
    } catch (err) {
      mostrarAlerta(err.message || "No se pudo guardar la orden.", "error");
    } finally {
      guardarBtn.disabled = false;
      guardarBtn.textContent = ordenIdEnEdicion ? "Guardar cambios" : "Guardar";
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => { window.location.href = "login.html"; });
});
