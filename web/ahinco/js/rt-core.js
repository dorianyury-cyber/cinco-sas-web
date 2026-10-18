// Núcleo de AHÍNCO (web/ahinco/*): sesión, perfil, proyectos y cálculo
// encadenado entre módulos. Vive en el proyecto Firebase "cinco-sas" y usa
// el mismo ingreso de Cinco S.A.S. (cuenta propia o la de Cinco Conecta) y
// el perfil de la colección "empleados" (debe estar activo).
//
// Datos: rtProyectos/{id} (datos generales del proyecto) y
// rtProyectos/{id}/calculos/{clave} = { entradas, etiqueta?, actualizadoEn, actualizadoPor }.
// La clave es el id del módulo ("aislamiento") o, para repetir un cálculo
// en el mismo proyecto, el id con un número ("aislamiento-2", "aislamiento-3").
// La barrera real está en firestore.rules (match /rtProyectos).

import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, obtenerPerfil } from "../../js/control/firebase-control.js";
import { CALCULOS } from "./rt-calculos.js";
import { MODULOS, entradasPorDefecto } from "./rt-modulos.js";

export { auth, db };
export const NOMBRE_APP = "AHÍNCO";
const CLAVE_TEMA = "ip-theme";

export function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function fechaCorta(v) {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  return d && !isNaN(d) ? d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "2-digit" }) : "—";
}
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function mostrarAlerta(el, texto, tipo = "error") { if (el) { el.textContent = texto; el.className = `alert ${tipo}`; } }
export function limpiarAlerta(el) { if (el) { el.textContent = ""; el.className = "alert"; } }
export function errorAmigable(err) {
  const code = err?.code || "";
  if (code.includes("permission-denied")) return "No tienes permiso para esta acción.";
  if (code.includes("unavailable")) return "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  return err?.message || "Ocurrió un error inesperado.";
}

// ---------------------------------------------------------------- tema claro / oscuro (compartido con Interventoría PRO)
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
  if (!perfil || perfil.estado !== "activo") {
    document.documentElement.classList.remove("rt-preparando");
    document.body.innerHTML = `<div class="auth-page"><div class="auth-card"><h1>${NOMBRE_APP}</h1><p class="text-muted">Tu cuenta no tiene un perfil activo en Cinco S.A.S. Pídele a un administrador que te registre en Empleados.</p><button type="button" class="btn" id="salirSinAcceso">Cerrar sesión</button></div></div>`;
    document.getElementById("salirSinAcceso").addEventListener("click", cerrarSesion);
    return null;
  }
  const btn = document.getElementById("logoutBtn");
  if (btn) btn.addEventListener("click", cerrarSesion);
  const quien = document.getElementById("rtUsuario");
  if (quien) quien.textContent = perfil.nombre || user.email;
  document.documentElement.classList.remove("rt-preparando");
  return { user, perfil, esAdmin: perfil.rol === "admin" };
}

// ---------------------------------------------------------------- proyectos
const col = () => collection(db, "rtProyectos");
export async function listarProyectos() {
  const snap = await getDocs(query(col(), orderBy("actualizadoEn", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function leerProyecto(id) {
  const snap = await getDoc(doc(db, "rtProyectos", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export async function crearProyecto(datos, user) {
  const ref = await addDoc(col(), { ...datos, creadoPor: user.email, creadoEn: serverTimestamp(), actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
  return ref.id;
}
export async function actualizarProyecto(id, datos, user) {
  await updateDoc(doc(db, "rtProyectos", id), { ...datos, actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
}
export async function eliminarProyecto(id) {
  const calc = await getDocs(collection(db, "rtProyectos", id, "calculos"));
  for (const d of calc.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db, "rtProyectos", id));
}
export async function leerCalculos(id) {
  const snap = await getDocs(collection(db, "rtProyectos", id, "calculos"));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
}
export async function guardarCalculo(id, clave, entradas, user, etiqueta = "") {
  await setDoc(doc(db, "rtProyectos", id, "calculos", clave), { entradas, etiqueta, actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
  await updateDoc(doc(db, "rtProyectos", id), { actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
}

// ---------------------------------------------------------------- exportar / importar
// Archivo JSON con los datos del proyecto y todos sus cálculos, para pasar
// un proyecto entre personas o cargar uno preparado por fuera.
const FORMATO = "ahinco-proyecto";
const CAMPOS_PROYECTO = ["nombre", "modo", "cliente", "ubicacion", "altitud", "tempAmbiente", "tipoDiseno", "descripcion", "autorDiseno", "documentosRevisados", "disenador", "matricula", "radicado", "literales"];
export function exportarProyecto(proyecto, guardados) {
  const datos = Object.fromEntries(CAMPOS_PROYECTO.filter((k) => proyecto[k] !== undefined).map((k) => [k, proyecto[k]]));
  const calculos = Object.fromEntries(Object.entries(guardados).map(([k, v]) => [k, { entradas: v.entradas, etiqueta: v.etiqueta || "" }]));
  return { formato: FORMATO, version: 1, exportado: new Date().toISOString(), proyecto: datos, calculos };
}
export function validarImportacion(json) {
  if (!json || json.formato !== FORMATO) throw new Error("El archivo no es un proyecto de AHÍNCO.");
  if (!json.proyecto?.nombre) throw new Error("El proyecto del archivo no tiene nombre.");
  const calculos = json.calculos || {};
  for (const [k, v] of Object.entries(calculos)) {
    if (!/^[A-Za-z]+(-\d+)?$/.test(k) || !MODULOS[moduloDe(k)]) throw new Error(`Cálculo desconocido en el archivo: «${k}».`);
    if (!v || typeof v.entradas !== "object") throw new Error(`El cálculo «${k}» no tiene datos de entrada.`);
  }
  return calculos;
}
export async function importarProyecto(json, user) {
  const calculos = validarImportacion(json);
  const datos = Object.fromEntries(CAMPOS_PROYECTO.filter((k) => json.proyecto[k] !== undefined).map((k) => [k, json.proyecto[k]]));
  const id = await crearProyecto({ literales: {}, ...datos }, user);
  for (const [k, v] of Object.entries(calculos)) {
    await setDoc(doc(db, "rtProyectos", id, "calculos", k), { entradas: v.entradas, etiqueta: String(v.etiqueta || ""), actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
  }
  return { id, n: Object.keys(calculos).length };
}

export async function eliminarCalculo(id, clave, user) {
  await deleteDoc(doc(db, "rtProyectos", id, "calculos", clave));
  await updateDoc(doc(db, "rtProyectos", id), { actualizadoPor: user.email, actualizadoEn: serverTimestamp() });
}

// ---------------------------------------------------------------- instancias de un módulo
export const moduloDe = (clave) => String(clave).split("-")[0];
const numeroDe = (clave) => Number(String(clave).split("-")[1] || 1);
// Claves guardadas de un módulo, en orden (la base primero).
export function clavesDe(m, guardados) {
  return Object.keys(guardados).filter((k) => moduloDe(k) === m).sort((a, b) => numeroDe(a) - numeroDe(b));
}
export function nuevaClave(m, guardados) {
  const ns = clavesDe(m, guardados).map(numeroDe);
  return ns.length ? `${m}-${Math.max(...ns) + 1}` : m;
}
export const tituloCalculo = (r) => `${MODULOS[r.modulo].titulo}${r.etiqueta ? ` — ${r.etiqueta}` : ""}`;

// ---------------------------------------------------------------- cálculo encadenado
// Orden con dependencias: el transformador usa la demanda del cuadro de
// cargas y el cortocircuito usa los datos del transformador.
export const ORDEN_MODULOS = ["cargas", "conductores", "conductorEconomico", "regulacion", "canalizaciones", "transformador", "trafoPotencia", "cortocircuito", "armonicos", "cableMT", "coordinacion", "arcoElectrico", "malla", "rayos", "apantallamiento", "aislamiento", "distancias", "camposEM", "mecanico", "fvArreglo", "fvProduccion", "fvConductores", "fvConexion"];

export function calcularModulo(id, entradas, proyecto, ctx = {}) {
  try {
    return CALCULOS[id](entradas, proyecto, ctx);
  } catch (err) {
    console.error(id, err);
    return { error: err.message || String(err), resumen: [], tablas: [], pasos: [], verificaciones: [], conclusion: "No se pudo calcular con los datos ingresados." };
  }
}

// guardados: { clave: { entradas, etiqueta } }. Calcula todos los cálculos
// guardados, en el orden de dependencias (o, si se pide, los módulos sin
// guardar con sus valores de ejemplo). El resultado queda por clave, con
// r.modulo, r.clave y r.etiqueta. Los módulos siguientes reciben las salidas
// del primer cálculo de cada módulo (ctx[modulo]).
export function calcularProyecto(proyecto, guardados, { incluirEjemplos = false, sobrescribir = {} } = {}) {
  const ctx = {}, res = {};
  for (const id of ORDEN_MODULOS) {
    let claves = [...new Set([...clavesDe(id, guardados), ...Object.keys(sobrescribir).filter((k) => moduloDe(k) === id)])].sort((a, b) => numeroDe(a) - numeroDe(b));
    if (!claves.length && incluirEjemplos) claves = [id];
    for (const clave of claves) {
      const entradas = sobrescribir[clave] || guardados[clave]?.entradas || entradasPorDefecto(id);
      const r = calcularModulo(id, entradas, proyecto, ctx);
      Object.assign(r, { modulo: id, clave, etiqueta: guardados[clave]?.etiqueta || "" });
      if (r.salidas && !ctx[id]) ctx[id] = r.salidas;
      res[clave] = r;
    }
  }
  return res;
}

export function estadoModulo(r) {
  if (!r) return { texto: "Sin datos", clase: "muted" };
  if (r.error) return { texto: "Error", clase: "danger" };
  const v = r.verificaciones || [];
  if (!v.length) return { texto: "Calculado", clase: "ok" };
  const fallan = v.filter((x) => x.cumple === false).length;
  return fallan ? { texto: `No cumple (${fallan})`, clase: "danger" } : { texto: "Cumple", clase: "ok" };
}

export const modulosPorArea = (area) => ORDEN_MODULOS.filter((id) => MODULOS[id].area === area);
