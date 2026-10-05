// Informe mensual: el usuario elige el mes, ve qué se registró en cada
// capítulo ese mes (para completar lo que falte antes de generar) y
// descarga el Word armado con esos datos (ip-informe-docx.js).
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, iniciarPagina, pintarEncabezado, esc, mesLargo, mesActual, mesesDelContrato, imgModulo, hrefModulo, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ip-core.js";
import { MODULOS, CAPITULOS, activoEnMes } from "./ip-modulos.js";
import { generarInformeMensual } from "./ip-informe-docx.js";
import { generarInformeMensualPDF } from "./ip-informe-pdf.js";
import { claveSeccion } from "./ip-informe-contenido.js";

// Secciones que no forman parte del informe clásico: por defecto entran
// solo si el contrato ya tiene información en ellas.
const OPCIONALES = new Set(["actainicio", "requerimientos", "suministros", "cambios", "consignaciones", "entregables", "noconformidades", "observaciones:calidad", "anexos:calidad", "observaciones:juridico", "anexos:juridico"]);

const ctx = await iniciarPagina({ permiso: "generarInforme" });
if (ctx) iniciar(ctx);

async function iniciar({ user, perfil, contrato }) {
  pintarEncabezado(`${imgModulo("informe", "ip-h1-foto")} Informe mensual`, contrato);
  const selMes = document.getElementById("informeMes");
  const cont = document.getElementById("informeContenido");
  const alerta = document.getElementById("informeAlerta");
  const btn = document.getElementById("generarInformeBtn");
  document.getElementById("informeElaborado").value = contrato.director || perfil.nombre || "";
  document.getElementById("informeCargo").value = contrato.tipo === "Obra" ? "Director de Interventoría" : "Director del contrato";

  const meses = mesesDelContrato(contrato, { hastaHoy: true });
  selMes.innerHTML = meses.slice().reverse().map((ym) => `<option value="${ym}">${mesLargo(ym)}</option>`).join("");
  // Por defecto el mes anterior (el informe se presenta a mes vencido).
  const anterior = meses.filter((m) => m < mesActual()).pop();
  if (anterior) selMes.value = anterior;

  // Todas las colecciones del contrato, una lectura cada una.
  const colecciones = [...new Set(Object.values(MODULOS).map((m) => m.coleccion))];
  const datos = {};
  await Promise.all(colecciones.map(async (c) => {
    const snap = await getDocs(collection(db, "ipContratos", contrato.id, c));
    datos[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }));

  // Cuántos registros tiene cada módulo en el mes elegido.
  function delMes(mod, cap, ym) {
    let regs = datos[mod.coleccion] || [];
    if (mod.porCapitulo && cap) regs = regs.filter((r) => r[mod.porCapitulo] === cap);
    if (mod.filtroMes) return regs.filter((r) => mod.filtroMes(r, ym)).length;
    if (mod.sinFiltroMes) return regs.length;
    if (mod.acumulaEnInforme) {
      const c = mod.campos.find((x) => x.type === "date");
      const [a, m] = ym.split("-").map(Number);
      const corte = `${ym}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
      return regs.filter((r) => String(r[c.key] || "") <= corte).length;
    }
    const campo = mod.campos.find((c) => c.type === "month") || mod.campos.find((c) => c.type === "date");
    return campo ? regs.filter((r) => String(r[campo.key] || "").startsWith(ym)).length : regs.length;
  }

  // ---------------------------------------------------------- selección de secciones
  // Cada ítem del menú es una sección del informe con su casilla; la
  // selección se recuerda por contrato en este navegador.
  const visibles = (cap) => cap.items.filter((it) => !(it.m && MODULOS[it.m].soloObra && contrato.tipo !== "Obra"));
  const todasLasClaves = ["intro", ...CAPITULOS.flatMap((cap) => visibles(cap).map(claveSeccion))];
  const CLAVE_SEL = `ip-informe-secciones-${contrato.id}`;
  function seleccionInicial() {
    try {
      const guardada = JSON.parse(localStorage.getItem(CLAVE_SEL) || "null");
      if (Array.isArray(guardada)) return new Set(guardada.filter((k) => todasLasClaves.includes(k)));
    } catch (e) { /* sin almacenamiento */ }
    return new Set(todasLasClaves.filter((k) => {
      if (!OPCIONALES.has(k)) return true;
      const [m, cap] = k.split(":");
      const regs = datos[MODULOS[m].coleccion] || [];
      return regs.some((r) => !cap || r.capitulo === cap);
    }));
  }
  const seleccion = seleccionInicial();
  const guardarSeleccion = () => { try { localStorage.setItem(CLAVE_SEL, JSON.stringify([...seleccion])); } catch (e) { /* sin almacenamiento */ } };

  const casilla = (clave) => `<input type="checkbox" class="ip-chk-seccion" data-clave="${esc(clave)}" ${seleccion.has(clave) ? "checked" : ""} title="Incluir en el informe">`;
  function tarjeta(i, foto, titulo, claves, itemsHtml) {
    const todas = claves.every((k) => seleccion.has(k));
    const algunas = claves.some((k) => seleccion.has(k));
    const parcial = !todas && algunas ? ' data-parcial="1"' : "";
    return `<div class="card cinta cinta-${i % 4}${algunas ? "" : " ip-cap-excluido"}">
      <h2><input type="checkbox" class="ip-chk-cap" data-claves="${claves.join(",")}" ${todas ? "checked" : ""}${parcial} title="Incluir o quitar todo el capítulo">${imgModulo(foto, "ip-capitulo-foto")} ${titulo}</h2>
      <ul class="ip-informe-lista">${itemsHtml}</ul></div>`;
  }
  function pintar() {
    const ym = selMes.value;
    const intro = tarjeta(3, "informe", "Introducción", ["intro"], `<li>${casilla("intro")} Objetivo y alcance <span class="text-muted">(de la información del contrato)</span></li>`);
    const caps = CAPITULOS.map((cap, i) => {
      const its = visibles(cap);
      const items = its.map((it) => {
        const k = claveSeccion(it);
        if (it.href) return `<li>${casilla(k)} <span class="badge ok">✓</span> <a href="${it.href}">${esc(it.label)}</a></li>`;
        const mod = MODULOS[it.m];
        const n = delMes(mod, it.cap, ym);
        const acumulado = mod.sinFiltroMes || mod.acumulaEnInforme || mod.id === "personal";
        const marca = acumulado ? ' <span class="text-muted">(acumulado)</span>' : "";
        return `<li>${casilla(k)} <span class="badge ${n ? "ok" : "warn"}">${n}</span> <a href="${hrefModulo(it.m, it.cap)}">${esc(it.label || mod.label)}</a>${marca}</li>`;
      }).join("");
      return tarjeta(i, `cap-${cap.id}`, `${cap.numero}. ${esc(cap.label)}`, its.map(claveSeccion), items);
    }).join("");
    cont.innerHTML = `<div class="ip-informe-grid">${intro}${caps}</div>`;
    cont.querySelectorAll("input[data-parcial]").forEach((chk) => { chk.indeterminate = true; });
    document.getElementById("informeConteo").textContent = `${seleccion.size} de ${todasLasClaves.length} secciones seleccionadas`;
  }
  cont.addEventListener("change", (e) => {
    const t = e.target;
    if (t.classList.contains("ip-chk-seccion")) {
      if (t.checked) seleccion.add(t.dataset.clave); else seleccion.delete(t.dataset.clave);
    } else if (t.classList.contains("ip-chk-cap")) {
      t.dataset.claves.split(",").forEach((k) => { if (t.checked) seleccion.add(k); else seleccion.delete(k); });
    } else return;
    guardarSeleccion();
    pintar();
  });
  document.getElementById("seleccionTodoBtn").addEventListener("click", () => { todasLasClaves.forEach((k) => seleccion.add(k)); guardarSeleccion(); pintar(); });
  document.getElementById("seleccionNadaBtn").addEventListener("click", () => { seleccion.clear(); guardarSeleccion(); pintar(); });
  selMes.addEventListener("change", pintar);
  pintar();
  const sinSeleccion = () => {
    if (seleccion.size) return false;
    mostrarAlerta(alerta, "Selecciona al menos una sección para incluir en el informe.");
    return true;
  };

  // ---------------------------------------------------------- PDF y visor
  const opciones = () => ({
    contrato, ym: selMes.value, datos,
    elaboradoPor: document.getElementById("informeElaborado").value.trim(),
    cargo: document.getElementById("informeCargo").value.trim(),
    radicado: document.getElementById("informeRadicado").value.trim(),
    incluir: new Set(seleccion)
  });
  const nombreArchivo = (ext) => `Informe ${contrato.tipo === "Obra" ? "de Interventoría" : "de seguimiento"} ${mesLargo(selMes.value)} (Contrato ${String(contrato.numero || "").replace(/[\/:*?"<>|]/g, "-")}).${ext}`;
  function descargar(url, nombre) {
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function conEspera(boton, texto, tarea) {
    limpiarAlerta(alerta);
    if (sinSeleccion()) return;
    if (!window.jspdf) { mostrarAlerta(alerta, "No se pudo cargar el generador de PDF. Recarga la página."); return; }
    const original = boton.textContent;
    boton.disabled = true;
    boton.textContent = texto;
    try { await tarea(); }
    catch (err) { console.error(err); mostrarAlerta(alerta, `No se pudo generar el PDF: ${errorAmigable(err)}`); }
    finally { boton.disabled = false; boton.textContent = original; }
  }
  const pdfBtn = (id, portada) => {
    const b = document.getElementById(id);
    b.addEventListener("click", () => conEspera(b, "Generando…", async () => {
      const doc = await generarInformeMensualPDF({ ...opciones(), portada });
      descargar(doc.output("bloburl"), nombreArchivo("pdf"));
    }));
  };
  pdfBtn("pdfOscuraBtn", "oscura");
  pdfBtn("pdfClaraBtn", "clara");

  const visor = document.getElementById("visorInformeModal");
  const visorPdf = document.getElementById("visorPdf");
  const visorPortada = document.getElementById("visorPortada");
  let urlVisor = null;
  async function pintarVisor() {
    visorPdf.innerHTML = '<p class="text-muted ip-visor-cargando">Generando vista previa…</p>';
    const doc = await generarInformeMensualPDF({ ...opciones(), portada: visorPortada.value });
    if (urlVisor) URL.revokeObjectURL(urlVisor);
    urlVisor = doc.output("bloburl");
    visorPdf.innerHTML = `<iframe title="Vista previa del informe" src="${urlVisor}#view=FitH"></iframe>`;
  }
  const visualizarBtn = document.getElementById("visualizarInformeBtn");
  visualizarBtn.addEventListener("click", () => conEspera(visualizarBtn, "Preparando…", async () => {
    visor.classList.add("open");
    await pintarVisor();
  }));
  visorPortada.addEventListener("change", () => pintarVisor().catch((err) => { visorPdf.innerHTML = `<p class="alert error">${esc(errorAmigable(err))}</p>`; }));
  document.getElementById("visorDescargarBtn").addEventListener("click", () => { if (urlVisor) descargar(urlVisor, nombreArchivo("pdf")); });
  const cerrarVisor = () => { visor.classList.remove("open"); visorPdf.innerHTML = ""; };
  document.getElementById("visorCerrarBtn").addEventListener("click", cerrarVisor);
  visor.addEventListener("click", (e) => { if (e.target === visor) cerrarVisor(); });

  btn.addEventListener("click", async () => {
    limpiarAlerta(alerta);
    if (!window.docx) { mostrarAlerta(alerta, "No se pudo cargar el generador de Word. Recarga la página."); return; }
    if (sinSeleccion()) return;
    const ym = selMes.value;
    btn.disabled = true;
    btn.textContent = "Generando…";
    try {
      const blob = await generarInformeMensual({
        contrato, ym, datos,
        elaboradoPor: document.getElementById("informeElaborado").value.trim(),
        cargo: document.getElementById("informeCargo").value.trim(),
        incluir: new Set(seleccion)
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Informe ${contrato.tipo === "Obra" ? "de Interventoría" : "de seguimiento"} ${mesLargo(ym)} (Contrato ${String(contrato.numero || "").replace(/[\/:*?"<>|]/g, "-")}).docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      mostrarAlerta(alerta, "Informe generado. Al abrirlo, Word puede preguntar si actualiza los campos: responde «Sí» para que se llene la tabla de contenido.", "success");
    } catch (err) {
      console.error(err);
      mostrarAlerta(alerta, `No se pudo generar el informe: ${errorAmigable(err)}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "📄 Word";
    }
  });
}
