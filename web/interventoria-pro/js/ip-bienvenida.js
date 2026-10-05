// Pantalla de bienvenida (igual que en Copropiedad Saludable): un botón
// grande por cada capítulo del informe, más Inicio y Contratos. Es la
// primera pantalla después de ingresar.
import { iniciarPagina, esc, cerrarSesion, fijarContratoActivo, hrefModulo, fotoModulo, reiniciarMenu, SECCIONES_GENERALIDADES } from "./ip-core.js";
import { CAPITULOS } from "./ip-modulos.js";

// Abrir el aplicativo deja todos los capítulos del menú lateral cerrados.
reiniciarMenu();

const ctx = await iniciarPagina({ requiereContrato: false, conMenu: false });
if (ctx) {
  const { user, perfil, esGestor, contratos, contrato } = ctx;
  document.getElementById("bienvenidaNombre").textContent = `Hola, ${perfil.nombre || user.email}`;
  document.getElementById("logoutBtn").addEventListener("click", cerrarSesion);

  const selector = document.getElementById("bienvenidaContrato");
  selector.innerHTML = contratos.length
    ? contratos.map((c) => `<option value="${c.id}" ${contrato?.id === c.id ? "selected" : ""}>${esc(c.numero || "Sin número")} — ${esc(c.contratante || c.objeto || "")}</option>`).join("")
    : `<option value="">${esGestor ? "Aún no hay contratos — créalo en Contratos" : "No estás asignado a ningún contrato"}</option>`;
  if (!contrato && contratos.length) {
    fijarContratoActivo(contratos[0].id);
  }
  selector.addEventListener("change", () => { if (selector.value) fijarContratoActivo(selector.value); });

  const sinContrato = contratos.length === 0;
  const aviso = document.getElementById("bienvenidaAviso");
  if (sinContrato) {
    aviso.innerHTML = esGestor
      ? 'Aún no hay contratos. <a href="contratos.html">Crea el primero en Contratos</a> para empezar a registrar información en los módulos.'
      : "Todavía no estás asignado a ningún contrato. Pídele al gestor de Interventoría PRO que te agregue al equipo.";
    aviso.className = "alert info ip-aviso-bienvenida";
  }
  const herramientas = [
    { href: "inicio.html", foto: "inicio", label: "Inicio", desc: "Resumen del contrato: avance, finanzas y alertas" },
    { href: "campo.html", foto: "campo", label: "Registro en campo", desc: "Desde el celular en la obra: fotos, inspecciones y novedades, aun sin señal" },
    { href: "informe.html", foto: "informe", label: "Informe mensual", desc: "Elige el mes, marca las secciones y genera el informe en PDF o Word" },
    { href: "contratos.html", foto: "contratos", label: esGestor ? "Contratos" : "Mis contratos", desc: esGestor ? "Todos los contratos con su semáforo y alertas; crea y edita contratos y su equipo" : "Tus contratos con su semáforo, alertas e información básica" },
    { href: "historial.html", foto: "historial", label: "Historial de cambios", desc: "Quién registró o cambió cada dato, cuándo y qué cambió" },
    { href: "avisos.html", foto: "avisos", label: "Avisos por correo", desc: "Envía al gestor lo vencido o por vencer, cuando la interventoría lo decida" },
  ];
  const capitulos = CAPITULOS.map((c) => ({ href: c.items[0].href || hrefModulo(c.items[0].m, c.items[0].cap), foto: `cap-${c.id}`, label: `${c.numero}. ${c.label}`, desc: c.desc }));
  // Sin contratos todavía, las tarjetas llevan a Contratos (no hay dónde
  // registrar nada) — pero se ven normales; el aviso de arriba explica qué
  // hacer primero.
  const tarjeta = (t, i) => {
    const destino = sinContrato && !t.href.startsWith("generalidades.html") ? "contratos.html" : t.href;
    return `<a class="modulo-card cinta cinta-${i % 4}" href="${destino}">
      <span class="modulo-icon"><img src="${fotoModulo(t.foto)}" alt=""></span>
      <span class="modulo-label">${esc(t.label)}</span>
      <span class="modulo-desc">${esc(t.desc)}</span>
    </a>`;
  };
  document.getElementById("bienvenidaHerramientas").innerHTML = herramientas.map(tarjeta).join("");
  document.getElementById("bienvenidaCapitulos").innerHTML = capitulos.map(tarjeta).join("");
  const conoce = SECCIONES_GENERALIDADES.map((s) => ({ href: `generalidades.html#${s.id}`, foto: s.foto, label: s.label, desc: s.desc }));
  document.getElementById("bienvenidaConoce").innerHTML = conoce.map(tarjeta).join("");
  document.getElementById("cuentaConoce").textContent = `${conoce.length} temas`;
  document.getElementById("cuentaHerramientas").textContent = `${herramientas.length} herramientas`;
  document.getElementById("cuentaCapitulos").textContent = `${capitulos.length} capítulos`;

  // Solo se ven las dos tarjetas de grupo; al tocar una se despliegan sus
  // opciones debajo (y se pliega la otra, para no alargar la página).
  const grupos = { conoce: "grupoConoce", herramientas: "grupoHerramientas", capitulos: "grupoCapitulos" };
  document.querySelectorAll(".ip-bienv-grupo-btn").forEach((btn) => btn.addEventListener("click", () => {
    const abrir = btn.getAttribute("aria-expanded") !== "true";
    document.querySelectorAll(".ip-bienv-grupo-btn").forEach((b) => {
      const activo = abrir && b === btn;
      b.setAttribute("aria-expanded", String(activo));
      b.classList.toggle("abierto", activo);
      document.getElementById(grupos[b.dataset.grupo]).classList.toggle("hidden", !activo);
    });
    if (abrir) document.getElementById(grupos[btn.dataset.grupo]).scrollIntoView({ behavior: "smooth", block: "nearest" });
  }));
}
