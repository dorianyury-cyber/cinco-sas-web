// Núcleo de APU PRO (web/apu-pro/*): sesión, perfil y acceso a datos. Vive en el
// proyecto Firebase "cinco-sas" con el mismo ingreso de Cinco S.A.S. (cuenta propia o
// la de Cinco Conecta) y el perfil de "empleados" (activo y con autorizadoApuPro).
//
// Datos:
//   apParametros/{anio} = { anio, smmlv, auxTransporte, prestacional, diasHabiles, fuente }
//   apSeries/ipp = { puntos: [{ fecha, valor }] } · apSeries/monedas = { lista: [{ moneda, valor, fecha, fuente }] }
//   apInsumos/{codigo} = { tipo, codigo, descripcion, unidad, precio, fechaPrecio, fuente, url,
//                          incluyeIva, base, vidaUtilAnios, factorSalarial, precios: [historial],
//                          codigosAnteriores, notaPrecio }
// La barrera real está en firestore.rules (puedeApuPro).

import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, obtenerPerfil } from "../../js/control/firebase-control.js";

export { auth, db };
export const NOMBRE_APP = "APU PRO";
const CLAVE_TEMA = "ip-theme";

// ---------------------------------------------------------------- utilidades
export function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function pesos(v, dec = 0) {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return "—";
  return "$" + n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function numero(v, dec = 2) {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? "—" : n.toLocaleString("es-CO", { maximumFractionDigits: dec });
}
export function fechaCorta(iso) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(`${iso.slice(0, 10)}T12:00:00`) : iso?.toDate ? iso.toDate() : new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "2-digit" });
}
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function mostrarAlerta(el, texto, tipo = "error") { if (el) { el.textContent = texto; el.className = `alert ${tipo} show`; } }
export function limpiarAlerta(el) { if (el) { el.textContent = ""; el.className = "alert"; } }
export function errorAmigable(err) {
  const code = err?.code || "";
  if (code.includes("permission-denied")) return "No tienes permiso para esta acción.";
  if (code.includes("unavailable")) return "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  return err?.message || "Ocurrió un error inesperado.";
}
// Lee un número escrito con coma o punto decimal ("1.423.500", "0,6", "1423500").
export function leerNumero(texto) {
  let s = String(texto ?? "").trim().replace(/[$\s]/g, "");
  if (!s) return null;
  if (/,\d{1,6}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Anchos de columna proporcionales al contenido real (encabezado y celdas), como en
// AHÍNCO y en los informes: devuelve el <colgroup> con data-ancho (%); aplicarAnchos()
// lo pasa a estilo después de insertar el HTML (la CSP no permite estilos en línea).
export function colgroupProporcional(encabezados, filas, { min = 5, max = 48 } = {}) {
  const largo = (v) => String(v ?? "").replace(/<[^>]*>/g, "").length;
  const palabra = (v) => Math.max(0, ...String(v ?? "").replace(/<[^>]*>/g, "").split(/[\s/]+/).map((x) => x.length));
  const peso = (n) => (n <= 14 ? n : 14 + Math.sqrt(n - 14) * 3);
  const pesos = encabezados.map((h, j) => {
    const celdas = filas.map((f) => largo(f[j])).sort((a, b) => a - b);
    const p80 = celdas.length ? celdas[Math.min(celdas.length - 1, Math.floor(celdas.length * 0.8))] : 0;
    const minPalabra = Math.max(palabra(h) * 1.1, ...filas.slice(0, 200).map((f) => Math.min(18, palabra(f[j]))));
    return Math.max(minPalabra + 2, peso(p80) + 2, 4);
  });
  const total = pesos.reduce((s, x) => s + x, 0) || 1;
  let pct = pesos.map((x) => Math.min(max, Math.max(min, (x / total) * 100)));
  const suma = pct.reduce((s, x) => s + x, 0);
  pct = pct.map((x) => (x / suma) * 100);
  return `<colgroup>${pct.map((x) => `<col data-ancho="${x.toFixed(1)}">`).join("")}</colgroup>`;
}
export function aplicarAnchos(raiz) {
  raiz.querySelectorAll("col[data-ancho]").forEach((col) => { col.style.width = `${col.dataset.ancho}%`; });
}

// ---------------------------------------------------------------- tema claro / oscuro (compartido con Interventoría PRO y AHÍNCO)
(function iniciarTema() {
  let tema = "light";
  try { tema = localStorage.getItem(CLAVE_TEMA) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch (e) { /* sin almacenamiento */ }
  document.documentElement.setAttribute("data-theme", tema);
  const crear = () => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "theme-toggle"; btn.title = "Cambiar modo claro/oscuro";
    const pintar = () => { btn.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀️" : "🌙"; };
    pintar();
    btn.addEventListener("click", () => {
      const nuevo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nuevo);
      try { localStorage.setItem(CLAVE_TEMA, nuevo); } catch (e) { /* sin almacenamiento */ }
      pintar();
    });
    document.body.appendChild(btn);
  };
  if (document.body) crear(); else document.addEventListener("DOMContentLoaded", crear);
})();

// ---------------------------------------------------------------- sesión
function esperarUsuario() {
  return new Promise((resolve) => { const c = onAuthStateChanged(auth, (u) => { c(); resolve(u); }); });
}
export async function cerrarSesion() {
  await signOut(auth);
  window.location.href = "index.html";
}
export async function iniciarPagina() {
  const user = await esperarUsuario();
  if (!user) { window.location.href = "index.html"; return null; }
  const perfil = await obtenerPerfil(user.email);
  // Entran el administrador y los empleados activos con el permiso «APU PRO» marcado en
  // Empleados (las reglas de Firestore exigen lo mismo).
  const autorizado = perfil?.estado === "activo" && (perfil.rol === "admin" || perfil.autorizadoApuPro === true);
  if (!autorizado) {
    document.documentElement.classList.remove("ap-preparando");
    const motivo = !perfil || perfil.estado !== "activo"
      ? "Tu cuenta no tiene un perfil activo en Cinco S.A.S. Pídele a un administrador que te registre en Empleados."
      : "Tu cuenta no tiene autorización para ingresar a APU PRO. Pídele a un administrador que marque el permiso «APU PRO» en Empleados.";
    document.body.innerHTML = `<div class="auth-page"><div class="auth-card"><h1>${NOMBRE_APP}</h1><p class="text-muted">${motivo}</p><button type="button" class="btn" id="salirSinAcceso">Cerrar sesión</button></div></div>`;
    document.getElementById("salirSinAcceso").addEventListener("click", cerrarSesion);
    return null;
  }
  document.documentElement.classList.remove("ap-preparando");
  return { user, perfil, esAdmin: perfil.rol === "admin" };
}

// ---------------------------------------------------------------- parámetros por año
export async function listarParametros() {
  const snap = await getDocs(collection(db, "apParametros"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.anio || 0) - (a.anio || 0));
}
export async function guardarParametros(datos, user) {
  const anio = Number(datos.anio);
  await setDoc(doc(db, "apParametros", String(anio)), { ...datos, anio, actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
}
export async function eliminarParametros(anio) { await deleteDoc(doc(db, "apParametros", String(anio))); }
// Parámetros vigentes: los del año en curso o, si no existen, los del año más reciente.
export function parametrosVigentes(lista, anio = new Date().getFullYear()) {
  return lista.find((p) => p.anio === anio) || lista[0] || null;
}

// ---------------------------------------------------------------- series (IPP, monedas)
export async function leerSerie(id) {
  const snap = await getDoc(doc(db, "apSeries", id));
  return snap.exists() ? snap.data() : null;
}
export async function guardarSerie(id, datos, user) {
  await setDoc(doc(db, "apSeries", id), { ...datos, actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
}

// ---------------------------------------------------------------- insumos
export async function listarInsumos() {
  const snap = await getDocs(collection(db, "apInsumos"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
const CAMPOS_INSUMO = ["tipo", "codigo", "descripcion", "unidad", "precio", "fechaPrecio", "fuente", "url", "incluyeIva", "base", "vidaUtilAnios", "factorSalarial", "precios", "codigosAnteriores", "notaPrecio", "notas", "activo"];
const limpiar = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => CAMPOS_INSUMO.includes(k) && v !== undefined));
export async function crearInsumo(datos, user) {
  const ref = doc(db, "apInsumos", datos.codigo);
  if ((await getDoc(ref)).exists()) throw new Error(`Ya existe un insumo con el código ${datos.codigo}.`);
  await setDoc(ref, { precios: [], codigosAnteriores: [], activo: true, ...limpiar(datos), creadoPor: user.email, creadoEn: serverTimestamp(), actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
}
export async function actualizarInsumo(codigo, datos, user) {
  await updateDoc(doc(db, "apInsumos", codigo), { ...limpiar(datos), actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
}
// Registra un precio nuevo: queda en el historial y, si es el más reciente, pasa a ser el vigente.
export async function registrarPrecio(insumo, precio, user) {
  const entrada = { valor: precio.valor, fecha: precio.fecha, fuente: precio.fuente || "", url: precio.url || "", registradoPor: user.email };
  const precios = [entrada, ...(insumo.precios || [])].sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
  const vigente = precios[0];
  const datos = { precios, precio: vigente.valor, fechaPrecio: vigente.fecha, fuente: vigente.fuente, url: vigente.url };
  if (precio.incluyeIva !== undefined) datos.incluyeIva = precio.incluyeIva;
  await actualizarInsumo(insumo.codigo, datos, user);
  return datos;
}
export async function eliminarInsumo(codigo) { await deleteDoc(doc(db, "apInsumos", codigo)); }

// ---------------------------------------------------------------- APU (biblioteca)
// apApus/{codigo} = { codigo, nombre, unidad, rendimiento, categoria, notas, lineas, version,
//                     origen, fechaOrigen, valorOrigen, observacionesOrigen, codigosAnteriores }
// apApus/{codigo}/versiones/{auto} = copia inmutable de cada versión guardada.
const CAMPOS_APU = ["codigo", "nombre", "unidad", "rendimiento", "categoria", "notas", "lineas", "version", "origen", "fechaOrigen", "valorOrigen", "observacionesOrigen", "codigosAnteriores", "factorMaterialesOrigen", "redondeoOrigen"];
const limpiarApu = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => CAMPOS_APU.includes(k) && v !== undefined));
export async function listarApus() {
  const snap = await getDocs(collection(db, "apApus"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function leerApu(codigo) {
  const snap = await getDoc(doc(db, "apApus", codigo));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
// Guarda el APU como nueva versión: el documento queda con la versión vigente y la
// subcolección «versiones» conserva la copia de cada versión con su nota.
export async function guardarApu(apu, user, { nuevo = false, nota = "" } = {}) {
  const ref = doc(db, "apApus", apu.codigo);
  const actual = await getDoc(ref);
  if (nuevo && actual.exists()) throw new Error(`Ya existe un APU con el código ${apu.codigo}.`);
  const version = (actual.exists() ? Number(actual.data().version) || 1 : 0) + 1;
  const datos = { ...limpiarApu(apu), version };
  await setDoc(ref, { ...datos, ...(actual.exists() ? { creadoPor: actual.data().creadoPor || user.email, creadoEn: actual.data().creadoEn || serverTimestamp() } : { creadoPor: user.email, creadoEn: serverTimestamp() }), actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
  await setDoc(doc(collection(db, "apApus", apu.codigo, "versiones")), { ...datos, nota: String(nota || "").slice(0, 300), creadoPor: user.email, creadoEn: serverTimestamp() });
  return version;
}
export async function listarVersionesApu(codigo) {
  const snap = await getDocs(collection(db, "apApus", codigo, "versiones"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.version || 0) - (a.version || 0));
}
export async function eliminarApu(codigo) {
  const vers = await getDocs(collection(db, "apApus", codigo, "versiones"));
  for (const d of vers.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db, "apApus", codigo));
}
// Carga «APU PRO - biblioteca inicial de APU.json» (formato apupro-biblioteca). Cada APU
// entra como versión 1 con su copia en «versiones»; los que ya existan no se tocan.
export function validarBiblioteca(json) {
  if (!json || json.formato !== "apupro-biblioteca") throw new Error("El archivo no es una biblioteca de APU de APU PRO.");
  if (!Array.isArray(json.apus) || !json.apus.length) throw new Error("El archivo no trae APU.");
  for (const a of json.apus) if (!a.codigo || !a.nombre || !a.lineas) throw new Error(`APU incompleto en el archivo: ${JSON.stringify(a).slice(0, 80)}`);
  return json;
}
export async function importarBiblioteca(json, user, { existentes = new Set(), progreso = () => {} } = {}) {
  validarBiblioteca(json);
  const nuevos = json.apus.filter((a) => !existentes.has(a.codigo));
  for (let i = 0; i < nuevos.length; i += 200) {
    const lote = writeBatch(db);
    for (const a of nuevos.slice(i, i + 200)) {
      const datos = { ...limpiarApu(a), version: 1 };
      lote.set(doc(db, "apApus", a.codigo), { ...datos, creadoPor: user.email, creadoEn: serverTimestamp(), actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
      lote.set(doc(collection(db, "apApus", a.codigo, "versiones")), { ...datos, nota: `Importado de ${a.origen || "la biblioteca inicial"}`, creadoPor: user.email, creadoEn: serverTimestamp() });
    }
    await lote.commit();
    progreso(Math.min(i + 200, nuevos.length), nuevos.length);
  }
  if (json.validacion) await guardarSerie("validacionApu", { resumen: json.validacion.map(({ detalle, ...v }) => v), generado: json.generado }, user);
  return { apus: nuevos.length, omitidos: json.apus.length - nuevos.length };
}

// ---------------------------------------------------------------- base inicial
// Carga el archivo «APU PRO - base inicial de insumos.json» (formato apupro-semilla):
// parámetros por año, IPP, monedas e insumos. Los insumos que ya existan no se
// sobrescriben salvo que se pida (sobrescribir = true).
export function validarSemilla(json) {
  if (!json || json.formato !== "apupro-semilla") throw new Error("El archivo no es una base de APU PRO.");
  if (!Array.isArray(json.insumos) || !json.insumos.length) throw new Error("El archivo no trae insumos.");
  for (const x of json.insumos) if (!x.codigo || !x.tipo || !x.descripcion) throw new Error(`Insumo incompleto en el archivo: ${JSON.stringify(x).slice(0, 80)}`);
  return json;
}
export async function importarSemilla(json, user, { existentes = new Set(), sobrescribir = false, progreso = () => {} } = {}) {
  validarSemilla(json);
  for (const p of json.parametros || []) await guardarParametros(p, user);
  if (json.ipp?.length) await guardarSerie("ipp", { puntos: json.ipp, fuente: "Base inicial (CSS 226)" }, user);
  if (json.monedas?.length) await guardarSerie("monedas", { lista: json.monedas }, user);
  const nuevos = json.insumos.filter((x) => sobrescribir || !existentes.has(x.codigo));
  let hechos = 0;
  for (let i = 0; i < nuevos.length; i += 400) {
    const lote = writeBatch(db);
    for (const x of nuevos.slice(i, i + 400)) {
      lote.set(doc(db, "apInsumos", x.codigo), { activo: true, ...limpiar(x), creadoPor: user.email, creadoEn: serverTimestamp(), actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
    }
    await lote.commit();
    hechos += Math.min(400, nuevos.length - i);
    progreso(hechos, nuevos.length);
  }
  return { insumos: nuevos.length, omitidos: json.insumos.length - nuevos.length, parametros: (json.parametros || []).length, ipp: (json.ipp || []).length };
}
