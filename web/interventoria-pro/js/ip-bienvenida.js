// Pantalla de bienvenida (igual que en Copropiedad Saludable): un botón
// grande por cada capítulo del informe, más Inicio y Contratos. Es la
// primera pantalla después de ingresar.
import { iniciarPagina, esc, cerrarSesion, fijarContratoActivo, hrefModulo } from "./ip-core.js";
import { CAPITULOS } from "./ip-modulos.js";

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
  const tarjetas = [
    { href: "inicio.html", icon: "🏠", label: "Inicio", desc: "Resumen del contrato: avance, finanzas y alertas" },
    { href: "contratos.html", icon: "📑", label: esGestor ? "Contratos" : "Mis contratos", desc: esGestor ? "Crea contratos, su información básica y su equipo" : "Contratos en los que participas" },
    ...CAPITULOS.map((c) => ({ href: c.items[0].href || hrefModulo(c.items[0].m, c.items[0].cap), icon: c.icon, label: `${c.numero}. ${c.label}`, desc: c.desc }))
  ];
  document.getElementById("bienvenidaModulos").innerHTML = tarjetas.map((t, i) => {
    const deshabilitada = sinContrato && t.href !== "contratos.html";
    return `<a class="modulo-card cinta cinta-${i % 4}${deshabilitada ? " ip-card-deshabilitada" : ""}" href="${deshabilitada ? "contratos.html" : t.href}">
      <span class="modulo-icon ip-modulo-emoji">${t.icon}</span>
      <span class="modulo-label">${esc(t.label)}</span>
      <span class="modulo-desc">${esc(t.desc)}</span>
    </a>`;
  }).join("");
}
