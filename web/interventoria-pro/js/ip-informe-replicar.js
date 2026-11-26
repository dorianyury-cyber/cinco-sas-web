// Replicar el informe de un mes en otro: copia el «Contenido adicional» de
// los capítulos elegidos (párrafos, títulos, tablas, figuras y firmas, con su
// ubicación y la opción «Usar solo mi contenido») del mes de origen al mes del
// informe. Lo demás no hace falta copiarlo: las tablas y cifras de los módulos
// salen solas del mes elegido, y las secciones marcadas se conservan.
//
// Opcionalmente cambia en los textos «octubre de 2026» por «noviembre de
// 2026» (no toca fechas con día, como «15 de octubre de 2026»).
import { collection, getDocs, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, esc, mesLargo, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ip-core.js";
import { anotarEnLote } from "./ip-historial.js";

const NOMBRES = { parrafo: ["párrafo", "párrafos"], titulo: ["título", "títulos"], tabla: ["tabla", "tablas"], imagen: ["figura", "figuras"], firma: ["firma", "firmas"] };
function resumenBloques(bloques) {
  const n = {};
  bloques.forEach((b) => { n[b.tipo] = (n[b.tipo] || 0) + 1; });
  return Object.entries(n).map(([t, k]) => `${k} ${(NOMBRES[t] || [t, t])[k === 1 ? 0 : 1]}`).join(", ");
}

// «octubre de 2026» (o «octubre del 2026») → «noviembre de 2026», respetando
// mayúsculas; las fechas con día se dejan como están.
export function cambiarMesEnTexto(texto, ymOrigen, ymDestino) {
  if (!texto || typeof texto !== "string") return texto;
  const [mesO, anioO] = mesLargo(ymOrigen).split(" de ");
  const [mesD, anioD] = mesLargo(ymDestino).split(" de ");
  const re = new RegExp(`(\\d{1,2}\\s+de\\s+)?(${mesO})(\\s+(?:del?\\s+)?(?:año\\s+)?)(${anioO})`, "gi");
  return texto.replace(re, (todo, dia, mes, enlace, anio) => {
    if (dia) return todo;
    const nuevo = mes === mes.toUpperCase() ? mesD.toUpperCase() : mes[0] === mes[0].toUpperCase() ? mesD[0].toUpperCase() + mesD.slice(1) : mesD;
    return `${nuevo}${enlace}${anioD}`;
  });
}
function cambiarMesEnBloque(b, o, d) {
  const c = structuredClone(b);
  if (c.tipo === "parrafo" || c.tipo === "titulo") c.texto = cambiarMesEnTexto(c.texto, o, d);
  if (c.tipo === "imagen") { c.nombre = cambiarMesEnTexto(c.nombre, o, d); c.pieDeFoto = cambiarMesEnTexto(c.pieDeFoto, o, d); }
  if (c.tipo === "tabla") {
    c.titulo = cambiarMesEnTexto(c.titulo, o, d);
    c.filas = (c.filas || []).map((f) => (Array.isArray(f) ? f.map((x) => cambiarMesEnTexto(x, o, d)) : { ...f, celdas: (f.celdas || []).map((x) => cambiarMesEnTexto(x, o, d)) }));
  }
  return c;
}

export function montarReplicar({ contrato, user, perfil, selMes, capitulos, alTerminar }) {
  const modal = document.getElementById("replicarModal");
  const origenEl = document.getElementById("replicarOrigen");
  const destinoEl = document.getElementById("replicarDestino");
  const listaEl = document.getElementById("replicarCapitulos");
  const cambiarMesEl = document.getElementById("replicarCambiarMes");
  const cambiarMesTxt = document.getElementById("replicarCambiarMesTexto");
  const alerta = document.getElementById("replicarAlerta");
  const copiarBtn = document.getElementById("replicarCopiarBtn");
  const avisoEl = document.getElementById("replicarAviso");
  const ref = collection(db, "ipContratos", contrato.id, "informeAdicional");
  let porMes = {}; // { ym: { capitulos, ocultos } }

  const bloquesDe = (ym) => porMes[ym]?.capitulos || {};
  const total = (ym) => Object.values(bloquesDe(ym)).reduce((s, l) => s + (l?.length || 0), 0);
  const conContenido = (ym) => Object.keys(capitulos).filter((c) => bloquesDe(ym)[c]?.length);
  const origenesPara = (destino) => Object.keys(porMes).filter((m) => m !== destino && total(m) > 0).sort().reverse();
  const origenSugerido = (destino) => { const o = origenesPara(destino); return o.find((m) => m < destino) || o[0] || ""; };

  async function recargar() {
    porMes = {};
    try { (await getDocs(ref)).docs.forEach((d) => { porMes[d.id] = d.data(); }); } catch (err) { /* sin contenido adicional todavía */ }
  }

  // Aviso arriba del contenido: el mes del informe está vacío y hay uno anterior para partir.
  function pintarAviso() {
    const destino = selMes.value;
    const origen = origenSugerido(destino);
    if (total(destino) > 0 || !origen) { avisoEl.hidden = true; avisoEl.innerHTML = ""; return; }
    avisoEl.hidden = false;
    avisoEl.innerHTML = `<span>📋 <strong>${esc(mesLargo(destino))}</strong> todavía no tiene contenido adicional. Puedes partir del informe de <strong>${esc(mesLargo(origen))}</strong> (${total(origen)} bloque(s) en ${conContenido(origen).length} capítulo(s)) y luego actualizar lo que cambió.</span>
      <button type="button" class="btn" data-replicar-desde="${esc(origen)}">Replicar ${esc(mesLargo(origen))}</button>`;
  }
  avisoEl.addEventListener("click", (e) => { const b = e.target.closest("[data-replicar-desde]"); if (b) abrir(b.dataset.replicarDesde); });

  function pintarLista() {
    const origen = origenEl.value;
    const destino = selMes.value;
    const [mo] = mesLargo(origen).split(" de ");
    cambiarMesTxt.innerHTML = `Actualizar el mes en los textos copiados: «${esc(mesLargo(origen))}» pasa a «${esc(mesLargo(destino))}». No cambia las fechas con día (ej. «15 de ${esc(mo)}»).`;
    const caps = conContenido(origen);
    if (!caps.length) { listaEl.innerHTML = '<p class="text-muted">Ese mes no tiene contenido adicional.</p>'; copiarBtn.disabled = true; return; }
    copiarBtn.disabled = false;
    listaEl.innerHTML = caps.map((c) => {
      const ya = bloquesDe(destino)[c]?.length || 0;
      return `<label class="ip-replicar-cap">
        <input type="checkbox" data-cap="${esc(c)}" checked>
        <span><strong>${esc(capitulos[c])}</strong> <span class="text-muted">— ${esc(resumenBloques(bloquesDe(origen)[c]))}</span>
        ${ya ? `<br><span class="ip-replicar-ya">${esc(mesLargo(destino))} ya tiene ${ya} bloque(s) aquí: ver la opción de abajo.</span>` : ""}</span>
      </label>`;
    }).join("");
    document.getElementById("replicarSiExiste").hidden = !caps.some((c) => bloquesDe(destino)[c]?.length);
  }

  async function abrir(origenPedido = "") {
    limpiarAlerta(alerta);
    await recargar();
    const destino = selMes.value;
    destinoEl.textContent = mesLargo(destino);
    const origenes = origenesPara(destino);
    if (!origenes.length) {
      origenEl.innerHTML = "";
      listaEl.innerHTML = '<p class="text-muted">Ningún otro mes de este contrato tiene contenido adicional para copiar.</p>';
      copiarBtn.disabled = true;
    } else {
      origenEl.innerHTML = origenes.map((m) => `<option value="${m}">${esc(mesLargo(m))} (${total(m)} bloques)</option>`).join("");
      origenEl.value = origenes.includes(origenPedido) ? origenPedido : origenSugerido(destino);
      pintarLista();
    }
    modal.classList.add("open");
  }
  origenEl.addEventListener("change", pintarLista);

  const cerrar = () => modal.classList.remove("open");
  document.getElementById("replicarCerrarBtn").addEventListener("click", cerrar);
  modal.addEventListener("click", (e) => { if (e.target === modal) cerrar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) cerrar(); });

  copiarBtn.addEventListener("click", async () => {
    limpiarAlerta(alerta);
    const origen = origenEl.value;
    const destino = selMes.value;
    const caps = [...listaEl.querySelectorAll("input[data-cap]:checked")].map((c) => c.dataset.cap);
    if (!caps.length) { mostrarAlerta(alerta, "Marca al menos un capítulo para copiar."); return; }
    const reemplazar = document.querySelector('input[name="replicarModo"]:checked')?.value === "reemplazar";
    const cambiar = cambiarMesEl.checked;
    const nuevos = {}, ocultos = {};
    let n = 0;
    caps.forEach((c) => {
      const copiados = (bloquesDe(origen)[c] || []).map((b) => (cambiar ? cambiarMesEnBloque(b, origen, destino) : structuredClone(b)));
      const existentes = reemplazar ? [] : (bloquesDe(destino)[c] || []);
      nuevos[c] = [...existentes, ...copiados];
      const oc = new Set([...(reemplazar ? [] : porMes[destino]?.ocultos?.[c] || []), ...(porMes[origen]?.ocultos?.[c] || [])]);
      ocultos[c] = [...oc];
      n += copiados.length;
    });
    copiarBtn.disabled = true;
    try {
      const lote = writeBatch(db);
      lote.set(doc(ref, destino), { ym: destino, capitulos: nuevos, ocultos, actualizadoEn: serverTimestamp(), actualizadoPor: user.email }, { merge: true });
      anotarEnLote(lote, contrato.id, {
        user, perfil, modulo: "informe", moduloLabel: "Informe mensual", accion: "editar",
        resumen: `Contenido adicional replicado de ${mesLargo(origen)} a ${mesLargo(destino)}: ${n} bloque(s) en ${caps.length} capítulo(s)${reemplazar ? " (reemplazando lo que había)" : ""}`
      });
      await lote.commit();
      await recargar();
      cerrar();
      await alTerminar?.({ origen, destino, n, caps: caps.length });
    } catch (err) {
      mostrarAlerta(alerta, `No se pudo copiar: ${errorAmigable(err)}`);
    } finally {
      copiarBtn.disabled = false;
    }
  });

  return { recargar, pintarAviso, abrir };
}
