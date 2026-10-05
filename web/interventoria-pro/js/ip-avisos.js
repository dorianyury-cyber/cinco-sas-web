// Avisos por correo al gestor de Interventoría PRO: la interventoría revisa
// lo que el servidor detecta como vencido o por vencer, marca qué avisos
// incluir, elige destinatarios (gestores y, si quiere, equipo del
// contrato), agrega una nota y envía. Nada se envía de forma automática y
// no se permiten correos externos. El cálculo y el envío los hace la
// función enviarAvisosInterventoriaPro (functions/src/
// avisosInterventoriaPro.js), que deja constancia en ipContratos/{id}/avisos
// y en el historial de cambios.
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "../../js/control/firebase-control.js";
import { db, iniciarPagina, pintarEncabezado, esc, imgModulo, hrefModulo, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ip-core.js";
import { fechaHora } from "./ip-historial.js";

const ctx = await iniciarPagina();
if (ctx) iniciar(ctx);

async function iniciar({ contrato }) {
  pintarEncabezado(`${imgModulo("avisos", "ip-h1-foto")} Avisos por correo`, contrato);
  const funcion = httpsCallable(getFunctions(app), "enviarAvisosInterventoriaPro");
  const alerta = document.getElementById("avAlerta");
  const avisosEl = document.getElementById("avAvisos");
  const gestoresEl = document.getElementById("avGestores");
  const equipoEl = document.getElementById("avEquipo");
  const notaEl = document.getElementById("avNota");
  const resumenEl = document.getElementById("avResumen");
  const enviarBtn = document.getElementById("avEnviar");
  let avisos = [];

  const casilla = (m, marcada) => `<label class="ip-miembro"><input type="checkbox" class="av-dest" value="${esc(m.email)}" ${marcada ? "checked" : ""}><span><strong>${esc(m.nombre)}</strong> <span class="text-muted">${esc(m.email)}</span></span></label>`;

  async function calcular() {
    limpiarAlerta(alerta);
    avisosEl.innerHTML = '<p class="text-muted ip-sin-margen">Revisando el contrato…</p>';
    try {
      const { data } = await funcion({ contratoId: contrato.id, accion: "calcular" });
      avisos = data.avisos || [];
      pintarAvisos();
      // Los avisos van al gestor: los gestores vienen marcados por defecto.
      gestoresEl.innerHTML = (data.gestores || []).map((m) => casilla(m, true)).join("")
        || '<p class="text-muted ip-sin-margen">No hay gestores de Interventoría PRO configurados (permiso en Empleados).</p>';
      equipoEl.innerHTML = (data.equipo || []).map((m) => casilla(m, false)).join("")
        || '<p class="text-muted ip-sin-margen">No hay otros miembros en el equipo del contrato.</p>';
      actualizarResumen();
    } catch (err) {
      avisosEl.innerHTML = "";
      mostrarAlerta(alerta, `No se pudieron calcular los avisos: ${errorAmigable(err)}`);
    }
  }

  function pintarAvisos() {
    if (!avisos.length) {
      avisosEl.innerHTML = '<p class="ip-sin-margen">✅ No hay avisos pendientes: nada vencido ni por vencer en este momento.</p>';
      return;
    }
    const grupos = {};
    avisos.forEach((a) => { (grupos[a.grupo] = grupos[a.grupo] || []).push(a); });
    avisosEl.innerHTML = Object.entries(grupos).map(([g, lista]) => `
      <div class="ip-avisos-grupo">
        <h3>${esc(g)}${lista[0].modulo ? ` <a href="${hrefModulo(lista[0].modulo)}">ver módulo</a>` : ""}</h3>
        ${lista.map((a) => `<label class="ip-aviso ip-aviso-${a.nivel}"><input type="checkbox" class="av-chk" value="${esc(a.clave)}"> <span>${esc(a.texto)}</span></label>`).join("")}
      </div>`).join("");
  }

  const elegidos = () => [...avisosEl.querySelectorAll(".av-chk:checked")].map((c) => c.value);
  const destinatarios = () => [...new Set([...document.querySelectorAll(".av-dest:checked")].map((c) => c.value))];
  function actualizarResumen() {
    const n = elegidos().length;
    const para = destinatarios();
    resumenEl.innerHTML = `Se enviarán <strong>${n}</strong> aviso(s) a <strong>${para.length}</strong> destinatario(s).`;
    enviarBtn.disabled = !n || !para.length;
  }
  document.addEventListener("change", (e) => { if (e.target.matches(".av-chk, .av-dest")) actualizarResumen(); });
  const marcar = (filtro) => {
    avisosEl.querySelectorAll(".av-chk").forEach((c) => { c.checked = filtro(avisos.find((a) => a.clave === c.value)); });
    actualizarResumen();
  };
  document.getElementById("avMarcarTodos").addEventListener("click", () => marcar(() => true));
  document.getElementById("avMarcarVencidos").addEventListener("click", () => marcar((a) => a.nivel === "rojo"));
  document.getElementById("avDesmarcar").addEventListener("click", () => marcar(() => false));
  document.getElementById("avRecalcular").addEventListener("click", calcular);

  enviarBtn.addEventListener("click", async () => {
    const claves = elegidos();
    const para = destinatarios();
    if (!claves.length || !para.length) return;
    if (!confirm(`¿Enviar ${claves.length} aviso(s) por correo a:\n\n${para.join("\n")}\n\nQuedará registrado en el historial de cambios.`)) return;
    enviarBtn.disabled = true;
    enviarBtn.textContent = "Enviando…";
    limpiarAlerta(alerta);
    try {
      const { data } = await funcion({ contratoId: contrato.id, accion: "enviar", claves, destinatarios: para, nota: notaEl.value });
      mostrarAlerta(alerta, `Correo enviado: ${data.enviados} aviso(s) a ${data.destinatarios.length} destinatario(s).`, "success");
      notaEl.value = "";
      cargarEnvios();
    } catch (err) {
      mostrarAlerta(alerta, `No se pudo enviar: ${errorAmigable(err)}`);
    } finally {
      enviarBtn.textContent = "📧 Enviar correo";
      actualizarResumen();
    }
  });

  async function cargarEnvios() {
    const cont = document.getElementById("avEnvios");
    try {
      const snap = await getDocs(query(collection(db, "ipContratos", contrato.id, "avisos"), orderBy("fecha", "desc"), limit(30)));
      const envios = snap.docs.map((d) => d.data()).filter((e) => e.destinatarios);
      cont.innerHTML = envios.length ? `<div class="tabla-scroll"><table class="tabla-compacta ip-tabla-hist">
        <colgroup><col class="ip-w12"><col class="ip-w12"><col class="ip-w26"><col></colgroup>
        <thead><tr><th>Fecha</th><th>Enviado por</th><th>Destinatarios</th><th>Avisos</th></tr></thead>
        <tbody>${envios.map((e) => `<tr><td>${esc(fechaHora(e.fecha))}</td><td>${esc(e.usuarioNombre)}</td><td>${esc((e.destinatarios || []).join(", "))}</td>
          <td class="ip-hist-cambios">${esc((e.avisos || []).map((a) => a.texto).join(" · "))}${e.nota ? `<br><em>Nota: ${esc(e.nota)}</em>` : ""}</td></tr>`).join("")}</tbody></table></div>`
        : '<p class="text-muted ip-sin-margen">Todavía no se han enviado avisos de este contrato.</p>';
    } catch (err) {
      cont.innerHTML = `<p class="text-muted ip-sin-margen">${esc(errorAmigable(err))}</p>`;
    }
  }

  calcular();
  cargarEnvios();
}
