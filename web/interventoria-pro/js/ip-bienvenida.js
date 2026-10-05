// Pantalla de bienvenida (igual que en Copropiedad Saludable): un botón
// grande por cada capítulo del informe, más Inicio y Contratos. Es la
// primera pantalla después de ingresar.
import { iniciarPagina, esc, cerrarSesion, fijarContratoActivo, hrefModulo, fotoModulo, reiniciarMenu } from "./ip-core.js";
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
  const tarjetas = [
    { href: "inicio.html", foto: "inicio", label: "Inicio", desc: "Resumen del contrato: avance, finanzas y alertas" },
    { href: "campo.html", foto: "campo", label: "Registro en campo", desc: "Desde el celular en la obra: fotos, inspecciones y novedades, aun sin señal" },
    { href: "tablero.html", foto: "tablero", label: "Tablero de contratos", desc: "Todos los contratos en una vista, con su semáforo y alertas" },
    { href: "contratos.html", foto: "contratos", label: esGestor ? "Contratos" : "Mis contratos", desc: esGestor ? "Crea contratos, su información básica y su equipo" : "Contratos en los que participas" },
    { href: "generalidades.html", foto: "generalidades", label: "Generalidades", desc: "Qué es el aplicativo, cómo se usa y qué controla cada módulo" },
    { href: "informe.html", foto: "informe", label: "Informe mensual", desc: "Elige el mes, marca las secciones y genera el informe en PDF o Word" },
    ...CAPITULOS.map((c) => ({ href: c.items[0].href || hrefModulo(c.items[0].m, c.items[0].cap), foto: `cap-${c.id}`, label: `${c.numero}. ${c.label}`, desc: c.desc }))
  ];
  document.getElementById("bienvenidaModulos").innerHTML = tarjetas.map((t, i) => {
    // Sin contratos todavía, los módulos llevan a Contratos (no tienen
    // dónde registrar nada) — pero las tarjetas se ven normales; el aviso
    // de arriba explica qué hacer primero.
    const destino = sinContrato && t.href !== "generalidades.html" ? "contratos.html" : t.href;
    return `<a class="modulo-card cinta cinta-${i % 4}" href="${destino}">
      <span class="modulo-icon"><img src="${fotoModulo(t.foto)}" alt=""></span>
      <span class="modulo-label">${esc(t.label)}</span>
      <span class="modulo-desc">${esc(t.desc)}</span>
    </a>`;
  }).join("");
}
