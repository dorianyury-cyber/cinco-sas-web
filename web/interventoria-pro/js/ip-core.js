// Núcleo compartido de Interventoría PRO (web/interventoria-pro/*).
//
// Vive dentro del proyecto Firebase "cinco-sas" y reutiliza su ingreso y
// sus perfiles: la cuenta es la misma del módulo interno (o la de Cinco
// Conecta, vía iniciarSesionConConecta) y el perfil sale de la colección
// "empleados". Quién ve qué:
//   - Gestor de Interventoría PRO: empleados.rol === "admin" o
//     empleados.gestionaInterventoriaPro === true. Ve TODOS los contratos,
//     los crea/edita y define su equipo.
//   - Miembro: cualquier empleado activo cuyo correo esté en
//     ipContratos/{id}.miembros. Ve y registra información SOLO de esos
//     contratos.
// La barrera real está en firestore.rules (match /ipContratos); esto solo
// arma la interfaz.
//
// Varios contratos: cada uno es un documento ipContratos/{id} y todo lo que
// se registra de él vive en sus subcolecciones (personal, garantias...).
// El contrato "activo" se recuerda en este navegador (localStorage) y se
// cambia desde el selector del menú lateral o desde Contratos.

import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, storage, obtenerPerfil } from "../../js/control/firebase-control.js";
import { CAPITULOS, MODULOS } from "./ip-modulos.js";

export { auth, db, storage };

const CLAVE_CONTRATO = "ip-contrato-activo";
const CLAVE_TEMA = "ip-theme";
const CLAVE_GRUPOS = "ip-nav-abiertos";

// ---------------------------------------------------------------- formato

export function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function moneda(n) {
  const v = Number(n) || 0;
  return `${v < 0 ? "-" : ""}$ ${Math.abs(Math.round(v)).toLocaleString("es-CO")}`;
}

export function numero(n, decimales = 0) {
  return (Number(n) || 0).toLocaleString("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

// Fechas "AAAA-MM-DD" se anclan al mediodía para que en Colombia (UTC-5)
// no se muestren un día antes.
export function fecha(valor) {
  if (!valor) return "-";
  const v = typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00` : valor;
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "2-digit" });
}

// Formato compacto (dd/mm/aaaa) para celdas de tablas densas de una línea.
export function fechaCorta(valor) {
  if (!valor) return "-";
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split("-");
    return `${d}/${m}/${a}`;
  }
  return fecha(valor);
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function mesCorto(ym) {
  if (!ym) return "-";
  const [a, m] = ym.split("-").map(Number);
  return `${MESES_CORTOS[m - 1]} ${String(a).slice(2)}`;
}
export function mesLargo(ym) {
  if (!ym) return "-";
  const [a, m] = ym.split("-").map(Number);
  return `${MESES_LARGOS[m - 1]} de ${a}`;
}

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function mesActual() {
  return hoyISO().slice(0, 7);
}
export function diasEntre(desdeISO, hastaISO) {
  const a = new Date(`${desdeISO}T12:00:00`);
  const b = new Date(`${hastaISO}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

// Meses ("AAAA-MM") del contrato, desde su inicio hasta su fin — o hasta
// hoy si no tiene fin. Base de todas las tablas "mes a mes".
export function mesesDelContrato(contrato, { hastaHoy = false } = {}) {
  const ini = (contrato?.fechaInicio || hoyISO()).slice(0, 7);
  let fin = (contrato?.fechaFin || hoyISO()).slice(0, 7);
  if (hastaHoy && fin > mesActual()) fin = mesActual();
  const meses = [];
  let [a, m] = ini.split("-").map(Number);
  while (`${a}-${String(m).padStart(2, "0")}` <= fin && meses.length < 120) {
    meses.push(`${a}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; a++; }
  }
  return meses;
}

// La política de seguridad del sitio no permite style="" en el HTML: los
// anchos de barras se ponen después por JS (CSSOM sí está permitido).
export function aplicarAnchos(contenedor) {
  contenedor.querySelectorAll("[data-ancho]").forEach((el) => {
    el.style.width = `${Math.max(0, Math.min(100, Number(el.dataset.ancho) || 0))}%`;
  });
}

export function mostrarAlerta(el, texto, tipo = "error") {
  if (!el) return;
  el.textContent = texto;
  el.className = `alert ${tipo}`;
}
export function limpiarAlerta(el) {
  if (!el) return;
  el.textContent = "";
  el.className = "alert";
}

export function errorAmigable(err) {
  const code = err?.code || "";
  if (code.includes("permission-denied")) return "No tienes permiso para hacer esto en este contrato.";
  if (code.includes("unavailable")) return "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  return err?.message || "Ocurrió un error inesperado.";
}

// ---------------------------------------------------------------- tema

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
}
(function iniciarTema() {
  let tema = "light";
  try { tema = localStorage.getItem(CLAVE_TEMA) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch (e) { /* sin almacenamiento */ }
  aplicarTema(tema);
  const crearBoton = () => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.title = "Cambiar modo claro/oscuro";
    const pintar = () => { btn.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀️" : "🌙"; };
    pintar();
    btn.addEventListener("click", () => {
      const nuevo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      aplicarTema(nuevo);
      try { localStorage.setItem(CLAVE_TEMA, nuevo); } catch (e) { /* sin almacenamiento */ }
      pintar();
    });
    document.body.appendChild(btn);
  };
  if (document.body) crearBoton(); else document.addEventListener("DOMContentLoaded", crearBoton);
})();

// ---------------------------------------------------------------- sesión

function esperarUsuario() {
  return new Promise((resolve) => {
    const cancelar = onAuthStateChanged(auth, (user) => { cancelar(); resolve(user); });
  });
}

// Cierra todos los capítulos del menú lateral (se llama al abrir el
// aplicativo: bienvenida e ingreso).
export function reiniciarMenu() {
  try { sessionStorage.removeItem(CLAVE_GRUPOS); } catch (e) { /* sin almacenamiento */ }
}

export async function cerrarSesion() {
  reiniciarMenu();
  try { localStorage.removeItem(CLAVE_CONTRATO); } catch (e) { /* sin almacenamiento */ }
  await signOut(auth);
  window.location.href = "index.html";
}

export function contratoActivoId() {
  try { return localStorage.getItem(CLAVE_CONTRATO); } catch (e) { return null; }
}
export function fijarContratoActivo(id) {
  try { localStorage.setItem(CLAVE_CONTRATO, id); } catch (e) { /* sin almacenamiento */ }
}

export async function cargarContratosVisibles(user, esGestor) {
  const ref = collection(db, "ipContratos");
  const snap = esGestor
    ? await getDocs(ref)
    : await getDocs(query(ref, where("miembros", "array-contains", user.email)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.numero || "").localeCompare(String(b.numero || ""), "es"));
}

// Arranque común de cada página interna. Devuelve null si no hay acceso
// (ya mostró el aviso o redirigió).
export async function iniciarPagina({ requiereContrato = true, conMenu = true } = {}) {
  const user = await esperarUsuario();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  const perfil = await obtenerPerfil(user.email);
  if (!perfil || perfil.estado !== "activo") {
    mostrarSinAcceso("Tu cuenta no tiene un perfil activo en Cinco S.A.S. Pídele a un administrador que te registre en Empleados.");
    return null;
  }
  const esGestor = perfil.rol === "admin" || perfil.gestionaInterventoriaPro === true;
  const contratos = await cargarContratosVisibles(user, esGestor);

  const deUrl = new URLSearchParams(location.search).get("contrato");
  if (deUrl && contratos.some((c) => c.id === deUrl)) fijarContratoActivo(deUrl);
  let contrato = contratos.find((c) => c.id === contratoActivoId()) || null;
  if (!contrato && contratos.length === 1) {
    contrato = contratos[0];
    fijarContratoActivo(contrato.id);
  }

  if (requiereContrato && !contrato) {
    window.location.href = "contratos.html";
    return null;
  }

  const ctx = { user, perfil, esGestor, contratos, contrato };
  if (conMenu) pintarMenu(ctx);
  document.documentElement.classList.remove("ip-preparando");
  // Botón de Ayuda con buscador (se carga aparte: importa las guías).
  import("./ip-ayuda.js").then((m) => m.montarAyuda()).catch(() => {});
  return ctx;
}

function mostrarSinAcceso(texto) {
  document.documentElement.classList.remove("ip-preparando");
  document.body.innerHTML = `
    <div class="auth-page"><div class="auth-card">
      <h1>Interventoría PRO</h1>
      <p class="text-muted">${esc(texto)}</p>
      <button type="button" class="btn" id="salirSinAcceso">Cerrar sesión</button>
    </div></div>`;
  document.getElementById("salirSinAcceso").addEventListener("click", cerrarSesion);
}

// Recarga el contrato activo desde Firestore (tras editarlo).
export async function recargarContrato(id) {
  const snap = await getDoc(doc(db, "ipContratos", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------------------------------------------------------------- menú

// Íconos de módulos: fotos propias de Cinco S.A.S. (línea de tiempo
// corporativa y servicios) recortadas a 160 px en assets/modulos/.
export function fotoModulo(nombre) {
  return `assets/modulos/${nombre}.jpg`;
}
export function imgModulo(nombre, clase = "nav-icon-img") {
  return `<img class="${clase}" src="${fotoModulo(nombre)}" alt="" loading="lazy">`;
}

// Secciones de Generalidades: forman el grupo "Conoce el aplicativo" del
// menú lateral y de la bienvenida.
export const SECCIONES_GENERALIDADES = [
  { id: "gen-que", foto: "gen-que", label: "¿Qué es Interventoría PRO?", desc: "Para qué sirve y qué abarca el seguimiento del contrato" },
  { id: "gen-roles", foto: "gen-roles", label: "Principios y roles", desc: "Cómo se usa y quién hace qué: gestor y equipo del contrato" },
  { id: "gen-flujo", foto: "gen-flujo", label: "Flujo de trabajo", desc: "Qué hacer al iniciar el contrato, cada mes, al cierre y al finalizar" },
  { id: "gen-rutina", foto: "gen-rutina", label: "Rutina de la interventoría", desc: "Qué revisar cada día, cada semana y cada mes" },
  { id: "gen-convenciones", foto: "gen-convenciones", label: "Convenciones", desc: "Semáforo, alertas, fechas, Excel y registro en campo" },
  { id: "gen-capitulos", foto: "gen-capitulos", label: "Qué controla cada capítulo", desc: "Los módulos de cada capítulo del informe y lo que controlan" }
];

export function hrefModulo(m, cap) {
  return `modulo.html?m=${m}${cap ? `&cap=${cap}` : ""}`;
}

function leerGrupos() {
  try { return new Set(JSON.parse(sessionStorage.getItem(CLAVE_GRUPOS) || "[]")); } catch (e) { return new Set(); }
}
function guardarGrupos(set) {
  try { sessionStorage.setItem(CLAVE_GRUPOS, JSON.stringify([...set])); } catch (e) { /* sin almacenamiento */ }
}

// Menú lateral igual al de Copropiedad Saludable: marca arriba, Inicio, un
// grupo plegable por capítulo del informe y la caja de usuario abajo.
function pintarMenu({ user, perfil, esGestor, contratos, contrato }) {
  const aside = document.getElementById("sidebar");
  if (!aside) return;
  const actual = location.pathname.split("/").pop() + location.search.replace(/&?contrato=[^&]*/, "");
  const params = new URLSearchParams(location.search);
  const moduloActual = params.get("m");
  const capActual = params.get("cap");

  const enlace = (href, icono, texto, extraClase = "") => {
    const activo = href === actual || href === actual.replace(/\?$/, "");
    return `<a href="${href}" class="${extraClase}${activo ? " active" : ""}">${imgModulo(icono)}${esc(texto)}</a>`;
  };

  const grupos = CAPITULOS.map((cap) => {
    // Cantidades de obra solo aplica a contratos de obra.
    const visibles = cap.items.filter((it) => !(it.m && MODULOS[it.m].soloObra && contrato?.tipo !== "Obra"));
    const items = visibles.map((it) => {
      if (it.href) return enlace(it.href, it.foto, it.label);
      const mod = MODULOS[it.m];
      const href = hrefModulo(it.m, it.cap);
      const esActivo = moduloActual === it.m && (capActual || null) === (it.cap || null);
      return `<a href="${href}" class="${esActivo ? "active" : ""}">${imgModulo(it.foto || it.m)}${esc(it.label || mod.label)}</a>`;
    }).join("");
    const contieneActivo = cap.items.some((it) => moduloActual === it.m && (capActual || null) === (it.cap || null));
    return { cap, items, contieneActivo };
  });

  // Los dos grupos (Herramientas / Capítulos del informe) y cada capítulo
  // arrancan plegados (pedido del usuario): solo quedan
  // abiertos los que la persona abrió a mano durante esta visita. Al
  // entrar de nuevo al aplicativo (bienvenida o ingreso) se olvidan — ver
  // reiniciarMenu().
  const abiertos = leerGrupos();

  aside.innerHTML = `
    <div class="ip-sidebar-cabeza">
      <a href="bienvenida.html" class="brand">
        <img src="assets/logo.png" alt="CINCO S.A.S.">
        <span>Interventoría PRO</span>
      </a>
      <button type="button" class="ip-menu-movil" id="ipMenuMovil" aria-expanded="false">☰ Menú</button>
    </div>
    <div class="ip-selector-contrato">
      <label for="ipSelectorContrato">Contrato</label>
      <select id="ipSelectorContrato">
        ${contratos.length === 0 ? '<option value="">Sin contratos</option>' : ""}
        ${contratos.map((c) => `<option value="${c.id}" ${contrato?.id === c.id ? "selected" : ""}>${esc(c.numero || "Sin número")} — ${esc(c.contratante || c.objeto || "")}</option>`).join("")}
      </select>
    </div>
    <nav>
      <div class="nav-pilar nav-pilar-2">
        <div class="collapsible-toggle nav-group-toggle ip-pilar-toggle" data-target="ipGrupo-conoce">
          <span>${imgModulo("grupo-conoce")}Conoce el aplicativo</span><span class="chevron">▾</span>
        </div>
        <div class="nav-group-body" id="ipGrupo-conoce">
        ${SECCIONES_GENERALIDADES.map((s) => enlace(`generalidades.html#${s.id}`, s.foto, s.label)).join("")}
        </div>
      </div>
      <div class="nav-pilar nav-pilar-0">
        <div class="collapsible-toggle nav-group-toggle ip-pilar-toggle" data-target="ipGrupo-herramientas">
          <span>${imgModulo("grupo-herramientas")}Herramientas</span><span class="chevron">▾</span>
        </div>
        <div class="nav-group-body" id="ipGrupo-herramientas">
        ${enlace("inicio.html", "inicio", "Inicio")}
        ${contrato ? enlace("campo.html", "campo", "Registro en campo") : ""}
        ${contrato ? enlace("informe.html", "informe", "Informe mensual") : ""}
        ${enlace("contratos.html", "contratos", esGestor ? "Contratos" : "Mis contratos")}
        ${contrato ? enlace("historial.html", "historial", "Historial de cambios") : ""}
        ${contrato ? enlace("avisos.html", "avisos", "Avisos por correo") : ""}
        </div>
      </div>
      <div class="nav-pilar nav-pilar-1">
        <div class="collapsible-toggle nav-group-toggle ip-pilar-toggle" data-target="ipGrupo-capitulos">
          <span>${imgModulo("grupo-capitulos")}Capítulos del informe</span><span class="chevron">▾</span>
        </div>
        <div class="nav-group-body" id="ipGrupo-capitulos">
      ${grupos.map((g, i) => `
        <div class="nav-group ip-nav-cap ip-nav-cap-${i % 4}">
          <div class="collapsible-toggle nav-group-toggle" data-target="ipGrupo-${g.cap.id}">
            <span>${imgModulo(`cap-${g.cap.id}`)}${esc(g.cap.numero)}. ${esc(g.cap.label)}</span>
            <span class="chevron">▾</span>
          </div>
          <div class="nav-group-body" id="ipGrupo-${g.cap.id}">${g.items}</div>
        </div>`).join("")}
        </div>
      </div>
    </nav>
    <div class="spacer"></div>
    <div class="user-box">
      <div id="userName">${esc(perfil.nombre || user.email)}</div>
      <div class="text-muted ip-user-rol">${esGestor ? "Gestor de Interventoría PRO" : "Equipo del contrato"}</div>
      <a href="../control/cambiar-clave.html" class="ip-user-link">🔒 Cambiar contraseña</a>
      <button class="btn secondary" id="logoutBtn">Cerrar sesión</button>
    </div>`;

  aside.querySelectorAll(".nav-group-toggle").forEach((toggle) => {
    const id = toggle.dataset.target;
    const body = document.getElementById(id);
    const chevron = toggle.querySelector(".chevron");
    const capId = id.replace("ipGrupo-", "");
    const aplicar = (plegado) => { body.classList.toggle("hidden", plegado); chevron.textContent = plegado ? "▸" : "▾"; };
    aplicar(!abiertos.has(capId));
    toggle.addEventListener("click", () => {
      const plegar = !body.classList.contains("hidden");
      aplicar(plegar);
      if (plegar) abiertos.delete(capId); else abiertos.add(capId);
      guardarGrupos(abiertos);
    });
  });
  guardarGrupos(abiertos);

  document.getElementById("ipSelectorContrato").addEventListener("change", (e) => {
    if (!e.target.value) return;
    fijarContratoActivo(e.target.value);
    location.reload();
  });
  document.getElementById("logoutBtn").addEventListener("click", cerrarSesion);

  // En el celular el menú arranca recogido detrás del botón "☰ Menú" para
  // que el contenido de la página quede a la vista sin bajar.
  const botonMovil = document.getElementById("ipMenuMovil");
  botonMovil.addEventListener("click", () => {
    const abierto = aside.classList.toggle("ip-menu-abierto");
    botonMovil.setAttribute("aria-expanded", String(abierto));
    botonMovil.textContent = abierto ? "✕ Cerrar" : "☰ Menú";
  });
}

// Encabezado de cada página: título + franja con el contrato activo.
export function pintarEncabezado(titulo, contrato, subtitulo = "") {
  const header = document.getElementById("ipHeader");
  if (!header) return;
  header.innerHTML = `
    <h1>${titulo}</h1>
    ${contrato ? `<p class="ip-contrato-franja"><strong>Contrato ${esc(contrato.numero || "")}</strong>${contrato.contratante ? ` · ${esc(contrato.contratante)}` : ""}${subtitulo ? ` · ${esc(subtitulo)}` : ""}</p>` : ""}`;
}

// Ventana emergente simple reutilizable.
export function abrirModal(id) { document.getElementById(id)?.classList.add("open"); }
export function cerrarModal(id) { document.getElementById(id)?.classList.remove("open"); }
