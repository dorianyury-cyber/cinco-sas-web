// Ayuda de Interventoría PRO: botón "❓ Ayuda" fijo en todas las páginas
// que abre un panel con buscador (como la ayuda de las aplicaciones en la
// nube). Busca, sin importar tildes ni mayúsculas, en las preguntas
// frecuentes de aquí abajo, en la guía de cada módulo (ip-guias.js), en
// Generalidades (principios, roles, flujo, rutina, convenciones) y en las
// páginas del aplicativo. Cada resultado se abre en el mismo panel con su
// explicación y un botón para ir a donde se hace.
// Atajos: tecla "?" o Ctrl+K para abrir, Esc para cerrar.
import { esc, hrefModulo, SECCIONES_GENERALIDADES } from "./ip-core.js";
import { MODULOS, CAPITULOS } from "./ip-modulos.js";
import { GUIAS, GENERALIDADES as G } from "./ip-guias.js";

// Preguntas frecuentes: los "¿cómo hago…?" que no están en una sola guía.
const FAQ = [
  { t: "¿Cómo creo un contrato nuevo?", pasos: ["Entra a Contratos (grupo Herramientas).", "Usa «+ Nuevo contrato» (solo el gestor de Interventoría PRO lo ve).", "Llena la información básica, los proyectos o frentes (uno por línea) y marca el equipo del contrato.", "Guarda: el contrato queda como contrato en uso."], href: "contratos.html", ir: "Ir a Contratos" },
  { t: "¿Cómo cambio de contrato?", pasos: ["En el menú lateral, elige el contrato en el selector «Contrato» de arriba.", "También desde Contratos: selecciona el contrato y usa «Usar este contrato».", "En Registro en campo hay un selector propio a la vista."], href: "contratos.html", ir: "Ir a Contratos" },
  { t: "¿Cómo agrego personas al equipo de un contrato?", pasos: ["En Contratos, selecciona el contrato y usa «✏️ Editar» (solo el gestor).", "En «Equipo del contrato» busca y marca a las personas.", "Guarda: desde ese momento ven el contrato y pueden registrar información."], href: "contratos.html", ir: "Ir a Contratos" },
  { t: "¿Quién puede eliminar registros?", pasos: ["Solo el gestor de Interventoría PRO (permiso en Empleados del módulo interno).", "Lo eliminado queda guardado en el Historial de cambios con su contenido, la persona y la fecha."], href: "historial.html", ir: "Ver el historial" },
  { t: "¿Cómo genero el informe mensual en PDF o Word?", pasos: ["Entra a Informe mensual.", "Elige el mes y marca las secciones que quieres incluir.", "Revisa la vista previa y genera el PDF (portada clara u oscura) o el Word para los ajustes finales."], href: "informe.html", ir: "Ir al Informe mensual" },
  { t: "¿Cómo cargo información desde Excel?", pasos: ["En el módulo, usa «Importar desde Excel».", "Descarga la plantilla del módulo y llénala, una fila por registro.", "Elige el archivo y revisa la vista previa: solo se importan las filas sin error.", "En Personal (por cédula) y Actividades (por ítem) se actualiza el registro existente en vez de duplicarlo; las celdas vacías no borran datos."], href: hrefModulo("personal"), ir: "Ir a Listado de personal" },
  { t: "¿Cómo exporto un módulo a Excel?", pasos: ["En cualquier módulo usa «Exportar a Excel».", "El archivo trae todas las columnas del formulario y la validación (semáforo) de cada registro."], href: "inicio.html", ir: "Ir a Inicio" },
  { t: "¿Cómo registro desde la obra sin señal?", pasos: ["Abre Registro en campo en el celular mientras tienes señal y verifica el contrato elegido arriba.", "Registra fotos, inspecciones, accidentes, novedades o charlas: quedan guardados en el teléfono.", "Al volver la señal se suben solos; mientras tanto aparecen en «Pendientes por subir». No borres los datos del navegador antes de que suban."], href: "campo.html", ir: "Ir a Registro en campo" },
  { t: "¿Cómo tomo y subo fotos de la obra?", pasos: ["Desde el celular: Registro en campo → «Foto de obra» → «Tomar foto» o «De la galería».", "Desde el computador: capítulo 9, Registro fotográfico → «+ Nuevo registro».", "Las fotos se comprimen solas (máx. 1600 px) para subir rápido y gastar menos datos."], href: "campo.html", ir: "Ir a Registro en campo" },
  { t: "¿Cómo envío avisos por correo al gestor?", pasos: ["Entra a Avisos por correo (o desde Inicio, «Avisar al gestor por correo»).", "Marca los avisos que quieres incluir y los destinatarios (los gestores vienen marcados).", "Agrega una nota si quieres y envía. Nada se envía de forma automática y queda constancia en el historial."], href: "avisos.html", ir: "Ir a Avisos por correo" },
  { t: "¿Cómo cargo la lista de chequeo del acta de inicio?", pasos: ["Capítulo 1, Requisitos acta de inicio → «📋 Cargar lista base».", "Los ítems marcados para cada frente se repiten por cada proyecto o frente del contrato.", "Ajusta la lista a lo que pide el contrato y ve cambiando el estado de cada requisito hasta el 100 %."], href: hrefModulo("actainicio"), ir: "Ir a Requisitos acta de inicio" },
  { t: "¿Cómo veo quién cambió un dato?", pasos: ["Abre el registro: abajo aparece «🕘 Historial de este registro» con cada cambio (antes → después).", "Para todo el contrato, entra a Historial de cambios y filtra por módulo, persona o acción; se puede exportar a Excel."], href: "historial.html", ir: "Ir al Historial de cambios" },
  { t: "¿Qué significa el semáforo de los contratos?", pasos: ["🔴 En riesgo: hay alertas rojas, el plazo venció o el avance técnico va más de 5 puntos atrás de lo programado.", "🟡 Atención: solo hay alertas amarillas (pendientes o por vencer).", "🟢 Al día: ningún módulo tiene alertas."], href: "contratos.html", ir: "Ir a Contratos" },
  { t: "¿Cómo registro el avance y veo la curva S?", pasos: ["Capítulo 7, Avance de actividades: registra cada actividad con su peso y sus fechas programadas.", "Cada mes anota el % acumulado de cada actividad.", "La curva S compara lo programado con lo ejecutado y aparece en el módulo y en el informe."], href: hrefModulo("actividades"), ir: "Ir a Avance de actividades" },
  { t: "¿Cómo registro el SMMLV para validar salarios?", pasos: ["En Contratos, selecciona el contrato y usa «✏️ Editar» (gestor).", "Llena «SMMLV vigente» y guarda: el Listado de personal marcará los salarios por debajo del mínimo."], href: "contratos.html", ir: "Ir a Contratos" },
  { t: "¿Cómo cambio mi contraseña o cierro sesión?", pasos: ["Abajo en el menú lateral (en el celular, dentro de «☰ Menú»): «🔒 Cambiar contraseña» y «Cerrar sesión»."], href: "../control/cambiar-clave.html", ir: "Cambiar contraseña" },
  { t: "¿Cómo cambio entre modo claro y oscuro?", pasos: ["Usa el botón 🌙 / ☀️ de la pantalla; la preferencia queda guardada en este navegador."], href: null }
];

const PAGINAS = [
  { t: "Inicio", d: "Resumen del contrato en uso: tiempo, avance técnico y financiero, personal, garantías y todas las alertas.", href: "inicio.html" },
  { t: "Registro en campo", d: "Registro desde el celular en la obra, aun sin señal: fotos, inspecciones, accidentes, novedades y charlas.", href: "campo.html" },
  { t: "Contratos", d: "Todos los contratos con su semáforo, avance y alertas; ficha completa, creación y edición de contratos y su equipo.", href: "contratos.html" },
  { t: "Informe mensual", d: "Generación del informe del mes en PDF o Word con las secciones elegidas.", href: "informe.html" },
  { t: "Historial de cambios", d: "Quién creó, editó o eliminó cada registro, cuándo y qué cambió.", href: "historial.html" },
  { t: "Avisos por correo", d: "Envío consciente al gestor de lo vencido o por vencer.", href: "avisos.html" }
];

// ------------------------------------------------------------ índice
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function construirIndice() {
  const idx = [];
  FAQ.forEach((f) => idx.push({ tipo: "Pregunta frecuente", titulo: f.t, pasos: f.pasos, href: f.href, ir: f.ir }));
  // Un módulo por capítulo donde aparece (observaciones/anexos se listan una vez).
  const vistos = new Set();
  CAPITULOS.forEach((cap) => cap.items.forEach((it) => {
    if (!it.m || vistos.has(it.m)) return;
    vistos.add(it.m);
    const m = MODULOS[it.m];
    const g = GUIAS[it.m];
    idx.push({
      tipo: `Módulo · ${cap.numero}. ${cap.label}`, titulo: m.label,
      texto: g ? g.que : m.desc, pasos: g?.como, extra: g?.automatico ? `Lo que el aplicativo revisa solo: ${g.automatico}` : "", ejemplo: g?.ejemplo,
      href: hrefModulo(it.m, it.cap), ir: `Ir a ${m.label}`
    });
  }));
  PAGINAS.forEach((p) => idx.push({ tipo: "Página", titulo: p.t, texto: p.d, href: p.href, ir: `Ir a ${p.t}` }));
  const gen = (id) => `generalidades.html#${id}`;
  idx.push({ tipo: "Generalidades", titulo: "¿Qué es Interventoría PRO?", texto: G.proposito, href: gen("gen-que"), ir: "Ver en Generalidades" });
  G.principios.forEach((p) => idx.push({ tipo: "Generalidades · Principios", titulo: p.split(":")[0], texto: p, href: gen("gen-roles"), ir: "Ver en Generalidades" }));
  G.roles.forEach(([r, d]) => idx.push({ tipo: "Generalidades · Roles", titulo: `Rol: ${r}`, texto: d, href: gen("gen-roles"), ir: "Ver en Generalidades" }));
  G.flujo.forEach(([e, d]) => idx.push({ tipo: "Generalidades · Flujo de trabajo", titulo: e, texto: d, href: gen("gen-flujo"), ir: "Ver en Generalidades" }));
  (G.rutina || []).forEach((r) => idx.push({ tipo: "Rutina de la interventoría", titulo: `Qué revisar ${r.periodo.toLowerCase()}`, texto: r.desc, pasos: r.items.map(([t]) => t), href: gen("gen-rutina"), ir: "Ver la rutina" }));
  G.convenciones.forEach((c) => idx.push({ tipo: "Generalidades · Convenciones", titulo: c.split(/[:.]/)[0].slice(0, 70), texto: c, href: gen("gen-convenciones"), ir: "Ver en Generalidades" }));
  idx.forEach((e) => {
    e._titulo = norm(e.titulo);
    e._todo = norm([e.titulo, e.tipo, e.texto, ...(e.pasos || []), e.extra, e.ejemplo].join(" "));
  });
  return idx;
}

// Palabras que la gente usa distinto a como están en las guías.
const SINONIMOS = [
  ["poliza", "garantia", "amparo", "seguro"],
  ["celular", "telefono", "movil", "campo", "obra"],
  ["foto", "fotografi", "imagen", "evidencia"],
  ["senal", "conexion", "internet", "offline"],
  ["borrar", "eliminar"],
  ["correo", "email", "aviso"],
  ["trabajador", "personal", "empleado"],
  ["pago", "financiero", "factura", "acta parcial"],
  ["cronograma", "programacion", "curva s", "avance"],
  ["usuario", "equipo", "miembro"]
];
const variantes = (t) => {
  if (t.length < 4) return [t];
  const g = SINONIMOS.find((l) => l.some((w) => w.startsWith(t) || t.startsWith(w)));
  return g ? [t, ...g] : [t];
};

function buscar(idx, consulta) {
  const terminos = norm(consulta).split(/\s+/).filter((t) => t.length > 1);
  if (!terminos.length) return [];
  // Se muestran los que coinciden con más palabras de la búsqueda (todas,
  // si alguno las tiene todas); dentro de eso, por relevancia.
  const puntuados = idx
    .map((e) => {
      const coinciden = terminos.filter((t) => variantes(t).some((v) => e._todo.includes(v)));
      if (!coinciden.length) return null;
      let p = 0;
      coinciden.forEach((t) => { if (variantes(t).some((v) => e._titulo.includes(v))) p += 5; p += Math.min(3, e._todo.split(t).length - 1); });
      if (e.tipo === "Pregunta frecuente") p += 2;
      return { e, p, n: coinciden.length };
    })
    .filter(Boolean);
  const mejor = Math.max(0, ...puntuados.map((x) => x.n));
  return puntuados
    .filter((x) => x.n === mejor)
    .sort((a, b) => b.p - a.p)
    .slice(0, 25)
    .map((x) => x.e);
}

// Fragmento del texto alrededor del primer término encontrado, resaltado.
function fragmento(e, consulta) {
  const terminos = norm(consulta).split(/\s+/).filter((t) => t.length > 1);
  const base = [e.texto, ...(e.pasos || []), e.extra].filter(Boolean).join(" · ");
  const n = norm(base);
  let i = Math.max(0, Math.min(...terminos.map((t) => { const k = n.indexOf(t); return k < 0 ? Infinity : k; })));
  if (!isFinite(i)) i = 0;
  const ini = Math.max(0, i - 50);
  const trozo = (ini ? "…" : "") + base.slice(ini, ini + 170) + (base.length > ini + 170 ? "…" : "");
  return resaltar(trozo, terminos);
}
function resaltar(texto, terminos) {
  let html = esc(texto);
  terminos.forEach((t) => {
    // Resalta respetando tildes: compara sobre la versión normalizada.
    const plano = norm(html);
    let out = "", k = 0, pos;
    while ((pos = plano.indexOf(t, k)) >= 0) { out += html.slice(k, pos) + "<mark>" + html.slice(pos, pos + t.length) + "</mark>"; k = pos + t.length; }
    html = out + html.slice(k);
  });
  return html;
}

// ------------------------------------------------------------ interfaz
export function montarAyuda() {
  if (document.getElementById("ipAyudaBtn")) return;
  let indice = null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "ipAyudaBtn";
  btn.className = "ip-ayuda-btn";
  btn.title = "Ayuda (tecla ? o Ctrl+K)";
  btn.innerHTML = "❓ <span>Ayuda</span>";
  const panel = document.createElement("div");
  panel.className = "ip-ayuda-fondo";
  panel.innerHTML = `
    <aside class="ip-ayuda-panel" role="dialog" aria-label="Ayuda de Interventoría PRO">
      <div class="ip-ayuda-cabeza">
        <strong>❓ Ayuda de Interventoría PRO</strong>
        <button type="button" class="ip-ayuda-cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="ip-ayuda-buscador"><input type="search" id="ipAyudaQ" placeholder="Busca un tema: ej. póliza, curva S, sin señal, Excel…" autocomplete="off"></div>
      <div class="ip-ayuda-cuerpo" id="ipAyudaCuerpo"></div>
    </aside>`;
  document.body.append(btn, panel);
  const q = panel.querySelector("#ipAyudaQ");
  const cuerpo = panel.querySelector("#ipAyudaCuerpo");
  let resultados = [];

  function inicio() {
    cuerpo.innerHTML = `<p class="ip-ayuda-sub">Preguntas frecuentes</p>
      <ul class="ip-ayuda-lista">${FAQ.slice(0, 8).map((f, i) => `<li><button type="button" data-faq="${i}">${esc(f.t)}</button></li>`).join("")}</ul>
      <p class="ip-ayuda-sub">Para empezar</p>
      <ul class="ip-ayuda-lista">${SECCIONES_GENERALIDADES.map((s) => `<li><a href="generalidades.html#${s.id}">${esc(s.label)}</a></li>`).join("")}</ul>`;
    cuerpo.querySelectorAll("[data-faq]").forEach((b) => b.addEventListener("click", () => detalle(indice.find((e) => e.titulo === FAQ[Number(b.dataset.faq)].t))));
  }

  function listar() {
    const consulta = q.value.trim();
    if (!consulta) { inicio(); return; }
    resultados = buscar(indice, consulta);
    cuerpo.innerHTML = resultados.length
      ? `<p class="ip-ayuda-sub">${resultados.length} resultado(s)</p><ul class="ip-ayuda-resultados">${resultados.map((e, i) => `
          <li><button type="button" data-r="${i}"><span class="ip-ayuda-tipo">${esc(e.tipo)}</span><strong>${resaltar(e.titulo, norm(consulta).split(/\s+/).filter((t) => t.length > 1))}</strong><span class="ip-ayuda-frag">${fragmento(e, consulta)}</span></button></li>`).join("")}</ul>`
      : `<p class="ip-ayuda-vacio">No encontramos «${esc(consulta)}». Prueba con otra palabra (ej. «garantía» en vez de «póliza de cumplimiento») o revisa <a href="generalidades.html">Generalidades</a>.</p>`;
    cuerpo.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => detalle(resultados[Number(b.dataset.r)])));
  }

  function detalle(e) {
    if (!e) return;
    cuerpo.innerHTML = `<button type="button" class="ip-ayuda-volver">← Volver</button>
      <div class="ip-ayuda-detalle">
        <span class="ip-ayuda-tipo">${esc(e.tipo)}</span>
        <h3>${esc(e.titulo)}</h3>
        ${e.texto ? `<p>${esc(e.texto)}</p>` : ""}
        ${e.pasos?.length ? `<ol>${e.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>` : ""}
        ${e.extra ? `<p class="ip-ayuda-extra">${esc(e.extra)}</p>` : ""}
        ${e.ejemplo ? `<p class="text-muted">${esc(e.ejemplo)}</p>` : ""}
        ${e.href ? `<a class="btn" href="${e.href}">${esc(e.ir || "Ir")}</a>` : ""}
      </div>`;
    cuerpo.querySelector(".ip-ayuda-volver").addEventListener("click", listar);
    cuerpo.scrollTop = 0;
  }

  const abrir = () => {
    indice = indice || construirIndice();
    panel.classList.add("abierto");
    listar();
    setTimeout(() => q.focus(), 50);
  };
  const cerrar = () => panel.classList.remove("abierto");
  btn.addEventListener("click", abrir);
  panel.querySelector(".ip-ayuda-cerrar").addEventListener("click", cerrar);
  panel.addEventListener("click", (e) => { if (e.target === panel) cerrar(); });
  // Un enlace a la misma página con ancla (Generalidades) también cierra.
  panel.addEventListener("click", (e) => { if (e.target.closest("a[href]")) cerrar(); });
  let espera;
  q.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(listar, 120); });
  document.addEventListener("keydown", (e) => {
    const escribiendo = e.target.closest?.("input, textarea, select, [contenteditable]");
    if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); abrir(); }
    else if (e.key === "?" && !escribiendo) { e.preventDefault(); abrir(); }
    else if (e.key === "Escape" && panel.classList.contains("abierto")) cerrar();
  });
}
