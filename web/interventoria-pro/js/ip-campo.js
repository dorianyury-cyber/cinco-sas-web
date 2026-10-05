// Registro en campo (campo.html): pantalla para el celular en la obra.
// Botones grandes para lo que se registra en terreno (fotos, inspecciones,
// accidentes, novedades...). Cada registro se guarda PRIMERO en este
// teléfono (IndexedDB, con la foto ya comprimida) y luego se sube: si no hay
// señal queda en "Pendientes por subir" y se reintenta solo al volver la
// conexión (y cada 30 s mientras la página esté abierta). Al subir se usan
// los mismos campos, la misma ruta de fotos y el mismo historial de cambios
// que en la página de cada módulo.
//
// Para no duplicar un registro cuyo envío sí llegó pero no alcanzó a
// confirmarse (señal intermitente), el id del documento se fija al guardar
// en el teléfono y antes de reintentar se pregunta al servidor si ya existe.
import { collection, doc, getDocs, getDocFromServer, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { db, storage, iniciarPagina, pintarEncabezado, esc, imgModulo, hoyISO, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ip-core.js";
import { MODULOS, CAPITULOS, nombreCapitulo } from "./ip-modulos.js";
import { htmlCampo, leerFormulario, comprimir } from "./ip-formulario.js";
import { anotarEnLote, diferencias, identificar } from "./ip-historial.js";

// Lo que se registra en terreno. cap fijo = capítulo del módulo; elegirCap =
// la persona elige el capítulo (observaciones).
const ACCESOS = [
  { m: "fotos", label: "Foto de obra", desc: "Evidencia fotográfica con su observación" },
  { m: "inspecciones", label: "Inspección", desc: "Vehículos, herramientas, EPP, extintores, locativa" },
  { m: "accidentes", label: "Accidente o incidente", desc: "Evento de trabajo y su reporte" },
  { m: "novedades", label: "Novedad de personal", desc: "Ingreso, retiro, incapacidad, licencia" },
  { m: "capacitaciones", cap: "sst", label: "Charla o capacitación SST", desc: "Charla de 5 minutos, inducción, pausas activas" },
  { m: "incidentesamb", label: "Incidente ambiental", desc: "Derrame, residuos, afectación al entorno" },
  { m: "socializacion", label: "Socialización", desc: "Reunión o actividad con la comunidad" },
  { m: "observaciones", elegirCap: true, label: "Observación", desc: "Nota del periodo para un capítulo del informe" }
].filter((a) => MODULOS[a.m]);

const BD = "ip-campo";
const ALMACEN = "pendientes";
const LIMITE_SUBIDA_MS = 90000;
const LIMITE_GUARDADO_MS = 30000;

// ------------------------------------------------------------ IndexedDB
function abrirBD() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(ALMACEN, { keyPath: "qid" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function operar(modo, fn) {
  const bd = await abrirBD();
  return new Promise((resolve, reject) => {
    const tx = bd.transaction(ALMACEN, modo);
    const req = fn(tx.objectStore(ALMACEN));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}
const guardarLocal = (item) => operar("readwrite", (s) => s.put(item));
const borrarLocal = (qid) => operar("readwrite", (s) => s.delete(qid));
const listarLocal = () => operar("readonly", (s) => s.getAll());

function conLimite(promesa, ms, texto) {
  return Promise.race([promesa, new Promise((_, rej) => setTimeout(() => rej(new Error(texto)), ms))]);
}

// ------------------------------------------------------------ página
const ctxPagina = await iniciarPagina();
if (ctxPagina) iniciar(ctxPagina);

async function iniciar({ user, perfil, contrato }) {
  pintarEncabezado(`${imgModulo("campo", "ip-h1-foto")} Registro en campo`, contrato);
  const tilesEl = document.getElementById("cpTiles");
  const formCard = document.getElementById("cpFormCard");
  const camposEl = document.getElementById("cpCampos");
  const alertaEl = document.getElementById("cpAlerta");
  const mensajeEl = document.getElementById("cpMensaje");
  const colaEl = document.getElementById("cpCola");
  const redEl = document.getElementById("cpRed");
  const pendEl = document.getElementById("cpPendientes");
  const subirBtn = document.getElementById("cpSubirBtn");
  const form = document.getElementById("cpForm");
  const guardarBtn = document.getElementById("cpGuardarBtn");
  const otroBtn = document.getElementById("cpOtroBtn");

  // Personal del contrato para los campos "persona"; se guarda una copia en
  // el teléfono por si luego se abre el formulario sin señal.
  const clavePersonal = `ip-personal-${contrato.id}`;
  let personal = [];
  try {
    const snap = await conLimite(getDocs(collection(db, "ipContratos", contrato.id, "personal")), 15000, "sin señal");
    personal = snap.docs.map((d) => ({ id: d.id, nombre: d.data().nombre, estado: d.data().estado }));
    try { localStorage.setItem(clavePersonal, JSON.stringify(personal)); } catch (e) { /* sin almacenamiento */ }
  } catch (e) {
    try { personal = JSON.parse(localStorage.getItem(clavePersonal) || "[]"); } catch (e2) { personal = []; }
  }

  tilesEl.innerHTML = ACCESOS.map((a, i) => `
    <button type="button" class="ip-campo-tile cinta cinta-${i % 4}" data-i="${i}">
      ${imgModulo(a.m === "capacitaciones" ? "capacitaciones" : a.m, "ip-campo-tile-foto")}
      <span><strong>${esc(a.label)}</strong><span class="text-muted">${esc(a.desc)}</span></span>
    </button>`).join("");
  tilesEl.querySelectorAll(".ip-campo-tile").forEach((b) => b.addEventListener("click", () => abrir(ACCESOS[Number(b.dataset.i)])));

  // ---------------------------------------------------------- formulario
  let acceso = null;
  let foto = null;
  let otro = false;

  function abrir(a, conservar = {}) {
    acceso = a;
    foto = null;
    const mod = MODULOS[a.m];
    limpiarAlerta(alertaEl);
    limpiarAlerta(mensajeEl);
    document.getElementById("cpFormTitulo").textContent = a.label;
    const capOpcion = a.elegirCap
      ? `<div class="ip-campo"><label for="f__cap">Capítulo *</label><select id="f__cap" required><option value="">— Elige —</option>${CAPITULOS.filter((c) => c.items.some((it) => it.m === a.m)).map((c) => `<option value="${c.id}" ${conservar._cap === c.id ? "selected" : ""}>${esc(c.numero)}. ${esc(c.label)}</option>`).join("")}</select></div>`
      : "";
    camposEl.innerHTML = capOpcion + mod.campos.map((c) => {
      let v = conservar[c.key];
      if (v === undefined) v = c.porDefecto ? c.porDefecto() : c.type === "date" && c.key === "fecha" ? hoyISO() : "";
      return htmlCampo(c, v, { contrato, personal, camara: true });
    }).join("");
    camposEl.querySelectorAll("[data-foto-de]").forEach((inp) => inp.addEventListener("change", async () => {
      const f = inp.files[0];
      if (!f) return;
      foto = await comprimir(f);
      const prev = document.getElementById(`${inp.dataset.fotoDe}_prev`);
      prev.src = URL.createObjectURL(foto);
      prev.classList.remove("hidden");
    }));
    tilesEl.classList.add("hidden");
    formCard.classList.remove("hidden");
    formCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cerrar() {
    formCard.classList.add("hidden");
    tilesEl.classList.remove("hidden");
    acceso = null;
  }
  document.getElementById("cpCancelarBtn").addEventListener("click", cerrar);
  otroBtn.addEventListener("click", () => { otro = true; form.requestSubmit(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const seguirOtro = otro;
    otro = false;
    limpiarAlerta(alertaEl);
    const mod = MODULOS[acceso.m];
    const campoFoto = mod.campos.find((c) => c.type === "imagen");
    if (campoFoto?.required && !foto) { mostrarAlerta(alertaEl, "Toma o elige una foto."); return; }
    const datos = leerFormulario(mod.campos, camposEl);
    const cap = acceso.elegirCap ? document.getElementById("f__cap").value : acceso.cap || null;
    if (mod.porCapitulo && cap) datos[mod.porCapitulo] = cap;
    guardarBtn.disabled = otroBtn.disabled = true;
    try {
      const item = {
        qid: crypto.randomUUID(),
        contratoId: contrato.id, contratoNumero: contrato.numero || "",
        usuario: user.email, modulo: mod.id, cap,
        docId: doc(collection(db, "ipContratos", contrato.id, mod.coleccion)).id,
        datos, foto: foto || null, campoFoto: campoFoto?.key || null,
        creadoLocal: new Date().toISOString(), intentos: 0, ultimoError: ""
      };
      await guardarLocal(item);
      const conservar = seguirOtro ? { ...datos, _cap: cap } : null;
      if (conservar) {
        // Lo que suele repetirse (fecha, tipo, capítulo) se deja; lo que
        // describe el registro se limpia.
        mod.campos.forEach((c) => { if (["textarea", "imagen", "url", "number", "money", "pct"].includes(c.type)) delete conservar[c.key]; });
      }
      if (seguirOtro) abrir(acceso, conservar); else cerrar();
      mostrarAlerta(mensajeEl, navigator.onLine ? "Guardado en el teléfono. Subiendo…" : "Guardado en el teléfono. Se subirá cuando haya señal.", "info");
      await pintarCola();
      sincronizar();
    } catch (err) {
      mostrarAlerta(alertaEl, `No se pudo guardar en el teléfono: ${errorAmigable(err)}`);
    } finally {
      guardarBtn.disabled = otroBtn.disabled = false;
    }
  });

  // ---------------------------------------------------------- cola
  const misPendientes = async () => (await listarLocal()).filter((x) => x.usuario === user.email).sort((a, b) => a.creadoLocal.localeCompare(b.creadoLocal));

  function pintarRed() {
    redEl.textContent = navigator.onLine ? "📶 Con señal" : "📵 Sin señal";
    redEl.className = `ip-red ${navigator.onLine ? "ip-red-si" : "ip-red-no"}`;
  }

  async function pintarCola() {
    const cola = await misPendientes();
    pendEl.textContent = cola.length ? `${cola.length} pendiente(s) por subir` : "✅ Todo subido";
    subirBtn.classList.toggle("hidden", !cola.length);
    colaEl.innerHTML = cola.length
      ? `<ul class="ip-cola">${cola.map((x) => {
          const mod = MODULOS[x.modulo];
          const otroContrato = x.contratoId !== contrato.id ? ` · contrato ${esc(x.contratoNumero)}` : "";
          return `<li>${x.foto ? `<img class="ip-cola-foto" data-qid="${x.qid}" alt="">` : imgModulo(x.modulo, "ip-cola-foto")}
            <span><strong>${esc(mod?.label || x.modulo)}</strong>${otroContrato}<br><span class="text-muted">${esc(identificar(mod || {}, x.datos) || "")}</span>
            ${x.ultimoError ? `<br><span class="ip-texto-rojo">${esc(x.ultimoError)}</span>` : ""}</span></li>`;
        }).join("")}</ul>`
      : '<p class="text-muted ip-sin-margen">No hay nada pendiente: todo lo registrado en este teléfono ya está en el aplicativo.</p>';
    cola.forEach((x) => { if (x.foto) { const img = colaEl.querySelector(`img[data-qid="${x.qid}"]`); if (img) img.src = URL.createObjectURL(x.foto); } });
  }

  async function subirUno(x) {
    const mod = MODULOS[x.modulo];
    const docRef = doc(db, "ipContratos", x.contratoId, mod.coleccion, x.docId);
    if (x.intentos > 0) {
      const ya = await conLimite(getDocFromServer(docRef), LIMITE_GUARDADO_MS, "Sin respuesta del servidor");
      if (ya.exists()) return;
    }
    const datos = { ...x.datos };
    if (x.foto && x.campoFoto) {
      const ruta = `interventoria-pro/${x.contratoId}/${mod.coleccion}/${x.qid}.jpg`;
      const r = ref(storage, ruta);
      await conLimite(uploadBytes(r, x.foto, { contentType: "image/jpeg" }), LIMITE_SUBIDA_MS, "La foto no alcanzó a subir (señal débil)");
      datos[x.campoFoto] = await getDownloadURL(r);
      datos[`${x.campoFoto}Ruta`] = ruta;
    }
    const nombre = perfil.nombre || user.email;
    Object.assign(datos, { creadoPor: nombre, creadoEn: serverTimestamp(), actualizadoPor: nombre, actualizadoEn: serverTimestamp(), registradoEnCampo: x.creadoLocal });
    const lote = writeBatch(db);
    lote.set(docRef, datos);
    const etiqueta = mod.porCapitulo && x.cap ? `${mod.label} — ${nombreCapitulo(x.cap)}` : mod.label;
    anotarEnLote(lote, x.contratoId, { user, perfil, modulo: mod.id, moduloLabel: etiqueta, registroId: x.docId, accion: "crear", resumen: `${identificar(mod, datos)} · desde campo`, cambios: diferencias(mod.campos, {}, datos, personal) });
    await conLimite(lote.commit(), LIMITE_GUARDADO_MS, "Sin respuesta del servidor (señal débil)");
  }

  let sincronizando = false;
  async function sincronizar() {
    if (sincronizando || !navigator.onLine) { pintarRed(); return; }
    sincronizando = true;
    subirBtn.disabled = true;
    let subidos = 0;
    let fallas = 0;
    try {
      for (const x of await misPendientes()) {
        try {
          await subirUno(x);
          await borrarLocal(x.qid);
          subidos++;
        } catch (err) {
          fallas++;
          await guardarLocal({ ...x, intentos: x.intentos + 1, ultimoError: errorAmigable(err) });
        }
      }
    } finally {
      sincronizando = false;
      subirBtn.disabled = false;
    }
    if (subidos && !fallas) mostrarAlerta(mensajeEl, `✅ ${subidos} registro(s) subido(s) al aplicativo.`, "success");
    else if (fallas) mostrarAlerta(mensajeEl, `${subidos ? `${subidos} subido(s); ` : ""}${fallas} siguen pendientes: se reintentará solo cuando mejore la señal.`, "error");
    pintarRed();
    pintarCola();
  }

  subirBtn.addEventListener("click", sincronizar);
  window.addEventListener("online", sincronizar);
  window.addEventListener("offline", pintarRed);
  setInterval(() => { if (navigator.onLine) misPendientes().then((c) => { if (c.length) sincronizar(); }); }, 30000);
  // Aviso al salir con cosas pendientes (no se pierden, pero conviene saberlo).
  window.addEventListener("beforeunload", (e) => { if (pendEl.textContent.includes("pendiente")) { e.preventDefault(); e.returnValue = ""; } });

  pintarRed();
  await pintarCola();
  sincronizar();
}
