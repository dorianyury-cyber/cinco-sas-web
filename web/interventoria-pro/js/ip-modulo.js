// Página genérica de módulo (modulo.html?m=<id>[&cap=<capítulo>]): arma
// resumen, alertas, tabla (o galería), formulario de alta/edición y
// exportación a Excel a partir de la configuración en ip-modulos.js.

import { collection, query, where, onSnapshot, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
  db, storage, iniciarPagina, pintarEncabezado, esc, moneda, numero, fecha, fechaCorta, mesCorto, mesLargo, mesesDelContrato,
  mostrarAlerta, limpiarAlerta, errorAmigable, aplicarAnchos, abrirModal, cerrarModal, imgModulo
} from "./ip-core.js";
import { MODULOS, nombreCapitulo } from "./ip-modulos.js";
import { GUIAS } from "./ip-guias.js";
import { anotarEnLote, diferencias, identificar, refHistorial, fechaHora, ACCIONES } from "./ip-historial.js";
import { configurarImportacion } from "./ip-importar.js";
import { htmlCampo, leerFormulario, frentesContrato, controlFotos } from "./ip-formulario.js";
const controlFotosVacio = () => ({ archivo: () => null, fotos: () => ({ conservadas: [], nuevas: [] }), camposFotos: () => [] });
import { mostrarLibro, mostrarTabla } from "./ip-visor.js";

const params = new URLSearchParams(location.search);
const mod = MODULOS[params.get("m")];
const cap = params.get("cap");

const ctxPagina = await iniciarPagina();
if (ctxPagina && !mod) {
  document.getElementById("ipContenido").innerHTML = `<div class="card"><p>Ese módulo no existe. <a href="inicio.html">Volver a Inicio</a></p></div>`;
} else if (ctxPagina) {
  iniciarModulo(ctxPagina);
}

function iniciarModulo({ user, perfil, contrato, puede }) {
  const esGestor = puede.eliminarRegistros; // (solo decide si se ve "Eliminar")
  const titulo = mod.porCapitulo ? `${mod.label} — ${nombreCapitulo(cap)}` : mod.label;
  const tituloModulo = titulo;
  pintarEncabezado(`${imgModulo(cap === "ambiental" && mod.id === "capacitaciones" ? "capacitaciones-ambiental" : mod.id, "ip-h1-foto")} ${esc(titulo)}`, contrato);
  document.title = `${titulo} — Interventoría PRO`;
  // Guía del módulo: qué se controla, cómo y qué revisa el aplicativo solo.
  // Plegable; si la persona la cierra, se recuerda en este navegador.
  const guia = GUIAS[mod.id];
  const descEl = document.getElementById("ipDescripcion");
  if (guia) {
    const claveGuia = `ip-guia-cerrada-${mod.id}`;
    let cerrada = false;
    try { cerrada = localStorage.getItem(claveGuia) === "1"; } catch (e) { /* sin almacenamiento */ }
    const det = document.createElement("details");
    det.className = "card ip-guia";
    det.open = !cerrada;
    det.innerHTML = `<summary>📘 Qué se controla y cómo</summary>
      <div class="ip-guia-cuerpo">
        <div><h3>Qué se controla</h3><p>${esc(guia.que)}</p>${guia.ejemplo ? `<p class="text-muted ip-guia-ejemplo">${esc(guia.ejemplo)}</p>` : ""}</div>
        <div><h3>Cómo se controla</h3><ol>${guia.como.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></div>
        <div><h3>Lo que el aplicativo revisa solo</h3><p>${esc(guia.automatico)}</p></div>
      </div>`;
    det.addEventListener("toggle", () => { try { localStorage.setItem(claveGuia, det.open ? "0" : "1"); } catch (e) { /* sin almacenamiento */ } });
    descEl.replaceWith(det);
  } else {
    descEl.textContent = mod.desc || "";
  }

  const resumenEl = document.getElementById("ipResumen");
  const alertasEl = document.getElementById("ipAlertas");
  const listaEl = document.getElementById("ipLista");
  const buscarEl = document.getElementById("ipBuscar");
  const filtroMesEl = document.getElementById("ipFiltroMes");
  const contadorEl = document.getElementById("ipContador");
  const form = document.getElementById("ipForm");
  const formCampos = document.getElementById("ipFormCampos");
  const formAlerta = document.getElementById("ipFormAlerta");
  const eliminarBtn = document.getElementById("ipEliminarBtn");
  const guardarBtn = document.getElementById("ipGuardarBtn");

  const coleccionRef = collection(db, "ipContratos", contrato.id, mod.coleccion);
  const usaPersona = mod.campos.some((c) => c.type === "persona");
  const necesita = new Set([...(mod.necesita || []), ...(usaPersona ? ["personal"] : [])]);
  const ctx = { contrato, registros: [], datos: {} };
  let editandoId = null;
  let fotosForm = controlFotosVacio();

  // ---------------------------------------------------------- datos
  async function cargarNecesarios() {
    await Promise.all([...necesita].filter((c) => c !== mod.coleccion).map(async (c) => {
      const snap = await getDocs(collection(db, "ipContratos", contrato.id, c));
      ctx.datos[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }));
  }

  const consulta = mod.porCapitulo && cap ? query(coleccionRef, where(mod.porCapitulo, "==", cap)) : coleccionRef;
  cargarNecesarios().then(() => {
    onSnapshot(consulta, (snap) => {
      ctx.registros = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (mod.coleccion === "personal") ctx.datos.personal = ctx.registros;
      pintar();
    }, (err) => {
      listaEl.innerHTML = `<div class="alert error">${esc(errorAmigable(err))}</div>`;
    });
  });

  // ---------------------------------------------------------- celdas
  function valorCelda(r, col) {
    if (col.render) return col.render(r, ctx);
    const campo = mod.campos.find((c) => c.key === col.key) || {};
    const v = r[col.key];
    if (v === undefined || v === null || v === "") return "-";
    switch (campo.type) {
      case "money": return moneda(v);
      case "date": return fechaCorta(v);
      case "month": return mesCorto(v);
      case "pct": return `${numero(v, Number(v) % 1 ? 1 : 0)}%`;
      case "number": return numero(v, Number(v) % 1 ? 2 : 0);
      case "persona": return esc((ctx.datos.personal || []).find((p) => p.id === v)?.nombre || "-");
      case "frente": return esc(v);
      case "url": return `<a href="${esc(v)}" target="_blank" rel="noopener" class="ip-link-celda">🔗 Abrir</a>`;
      case "select": return esc(campo.opcionesObj ? nombreCapitulo(v) : v);
      default: return esc(v);
    }
  }
  function textoPlano(r, col) {
    const html = valorCelda(r, col);
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent.replace("🔗 Abrir", r[col.key] || "").trim();
  }

  function ordenar(rows) {
    const { key, dir = 1, numerico } = mod.orden || {};
    if (!key) return rows;
    return [...rows].sort((a, b) => {
      const va = a[key] ?? "", vb = b[key] ?? "";
      const cmp = numerico ? (Number(va) || 0) - (Number(vb) || 0) : String(va).localeCompare(String(vb), "es", { numeric: true });
      return cmp * dir;
    });
  }

  // Filtro de mes: muestra solo lo registrado en ese mes (según el primer
  // campo de mes o de fecha del módulo; Personal = vinculados ese mes).
  // Los resúmenes y alertas de arriba siguen calculándose con todo.
  const campoMes = mod.campos.find((c) => c.type === "month") || mod.campos.find((c) => c.type === "date");
  const usaFiltroMes = !mod.sinFiltroMes && (mod.filtroMes || campoMes);
  if (usaFiltroMes) {
    filtroMesEl.innerHTML = '<option value="">Todos los meses</option>' + mesesDelContrato(contrato).slice().reverse()
      .map((ym) => `<option value="${ym}">${mesLargo(ym)}</option>`).join("");
    filtroMesEl.classList.remove("hidden");
    filtroMesEl.addEventListener("change", pintar);
  }
  function enMes(r, ym) {
    if (mod.filtroMes) return mod.filtroMes(r, ym);
    return String(r[campoMes.key] || "").startsWith(ym);
  }

  function filtrados() {
    const t = buscarEl.value.trim().toLowerCase();
    const ym = usaFiltroMes ? filtroMesEl.value : "";
    const rows = ordenar(ctx.registros).filter((r) => !ym || enMes(r, ym));
    if (!t) return rows;
    return rows.filter((r) => mod.columnas.some((c) => textoPlano(r, c).toLowerCase().includes(t)) ||
      mod.campos.some((c) => ["text", "textarea"].includes(c.type) && String(r[c.key] || "").toLowerCase().includes(t)));
  }

  // ---------------------------------------------------------- pintar
  function pintar() {
    resumenEl.innerHTML = mod.resumen ? mod.resumen(ctx) : "";
    aplicarAnchos(resumenEl);

    const alertas = mod.alertas ? mod.alertas(ctx) : [];
    alertasEl.innerHTML = alertas.length ? `<div class="card ip-alertas-card cinta cinta-1"><h2>⚠️ Para revisar (${alertas.length})</h2><ul class="ip-alertas">${alertas.map((a) => `<li class="ip-alerta-${a.nivel}">${esc(a.texto)}</li>`).join("")}</ul></div>` : "";

    const rows = filtrados();
    contadorEl.textContent = `${rows.length} de ${ctx.registros.length} registro(s)`;
    if (mod.vista === "galeria") return pintarGaleria(rows);

    const cols = mod.columnas;
    const conEstado = !!mod.validar;
    const anchoEstado = 12;
    const suma = cols.reduce((s, c) => s + (c.ancho || 10), 0);
    const factor = (100 - (conEstado ? anchoEstado : 0)) / suma;
    const etiqueta = (c) => c.label || mod.campos.find((f) => f.key === c.key)?.label || c.key;

    listaEl.innerHTML = rows.length === 0
      ? `<div class="card"><p class="text-muted ip-sin-margen">${ctx.registros.length ? "Ningún registro coincide con la búsqueda." : "Todavía no hay registros. Usa «+ Nuevo registro» para agregar el primero."}</p></div>`
      : `<div class="card ip-tabla-card"><div class="tabla-scroll"><table class="tabla-densa ip-tabla">
          <colgroup>${cols.map((c) => `<col data-ancho-col="${((c.ancho || 10) * factor).toFixed(2)}">`).join("")}${conEstado ? `<col data-ancho-col="${anchoEstado}">` : ""}</colgroup>
          <thead><tr>${cols.map((c) => `<th>${esc(etiqueta(c))}</th>`).join("")}${conEstado ? "<th>Validación</th>" : ""}</tr></thead>
          <tbody>${rows.map((r) => {
            const v = conEstado ? mod.validar(r, ctx) : null;
            // 📷 n en la primera celda si el registro tiene fotos de evidencia.
            const nFotos = mod.campos.filter((c) => c.type === "fotos").reduce((s, c) => s + (r[c.key]?.length || 0), 0);
            return `<tr data-id="${r.id}" class="ip-fila">${cols.map((c, j) => `<td>${valorCelda(r, c)}${j === 0 && nFotos ? ` <span class="ip-fotos-badge" title="Fotos de evidencia">📷${nFotos}</span>` : ""}</td>`).join("")}${v ? `<td><span class="badge ${v.nivel === "danger" ? "danger" : v.nivel === "warn" ? "warn" : "ok"}">${esc(v.texto)}</span></td>` : ""}</tr>`;
          }).join("")}</tbody></table></div></div>`;
    listaEl.querySelectorAll("col[data-ancho-col]").forEach((col) => { col.style.width = `${col.dataset.anchoCol}%`; });
    listaEl.querySelectorAll("tr.ip-fila").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        abrirFormulario(ctx.registros.find((r) => r.id === tr.dataset.id));
      });
    });
  }

  function pintarGaleria(rows) {
    listaEl.innerHTML = rows.length === 0
      ? `<div class="card"><p class="text-muted ip-sin-margen">Todavía no hay fotos. Usa «+ Nuevo registro» para subir la primera.</p></div>`
      : `<div class="ip-galeria">${rows.map((r) => `
          <button type="button" class="ip-foto-card" data-id="${r.id}">
            ${r.foto ? `<img src="${esc(r.foto)}" alt="" loading="lazy">` : '<div class="ip-foto-vacia">Sin foto</div>'}
            <span class="ip-foto-texto"><strong>${fecha(r.fecha)}</strong> · ${esc(nombreCapitulo(r.capitulo))}</span>
            <span class="ip-foto-obs">${esc(r.observacion || "")}</span>
          </button>`).join("")}</div>`;
    listaEl.querySelectorAll(".ip-foto-card").forEach((b) => b.addEventListener("click", () => abrirFormulario(ctx.registros.find((r) => r.id === b.dataset.id))));
  }

  buscarEl.addEventListener("input", pintar);

  // ---------------------------------------------------------- formulario
  const frentesDelContrato = () => frentesContrato(contrato);

  function abrirFormulario(registro = null) {
    editandoId = registro?.id || null;

    limpiarAlerta(formAlerta);
    document.getElementById("ipFormTitulo").textContent = registro ? `Editar — ${mod.label}` : `Nuevo — ${mod.label}`;
    formCampos.innerHTML = mod.campos.map((c) => htmlCampo(c, registro ? registro[c.key] : (c.porDefecto ? c.porDefecto() : ""), { contrato, personal: ctx.datos.personal })).join("");
    eliminarBtn.classList.toggle("hidden", !registro || !esGestor);
    pintarHistorialRegistro(registro);
    // Tomar foto / elegir de galería, ya comprimidas al elegirlas.
    fotosForm = controlFotos(formCampos, mod.campos, registro);
    abrirModal("ipModal");
    formCampos.querySelector("input, select, textarea")?.focus();
  }

  // Historial de este registro en la ventana de edición (lo más reciente
  // primero). Sin orderBy en la consulta para no requerir índice compuesto.
  const histEl = document.getElementById("ipHistorialRegistro");
  async function pintarHistorialRegistro(registro) {
    if (!registro) { histEl.classList.add("hidden"); histEl.innerHTML = ""; return; }
    histEl.classList.remove("hidden");
    histEl.innerHTML = `<summary>🕘 Historial de este registro</summary><p class="text-muted ip-sin-margen">Cargando…</p>`;
    try {
      const snap = await getDocs(query(refHistorial(contrato.id), where("registroId", "==", registro.id)));
      const entradas = snap.docs.map((d) => d.data()).sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
      const lineas = entradas.map((h) => `<li><strong>${esc(fechaHora(h.fecha))}</strong> · ${esc(h.usuarioNombre)} · ${esc(ACCIONES[h.accion] || h.accion)}${h.accion === "editar" && h.cambios?.length ? `<ul>${h.cambios.map((c) => `<li>${esc(c.etiqueta)}: <span class="ip-hist-antes">${esc(c.antes)}</span> → <span class="ip-hist-despues">${esc(c.despues)}</span></li>`).join("")}</ul>` : ""}</li>`).join("");
      const origen = registro.creadoPor ? `<li class="text-muted">Creado por ${esc(registro.creadoPor)}${registro.creadoEn ? ` el ${esc(fechaHora(registro.creadoEn))}` : ""}</li>` : "";
      histEl.innerHTML = `<summary>🕘 Historial de este registro (${entradas.length})</summary><ul class="ip-hist-lista">${lineas || ""}${entradas.some((h) => h.accion === "crear") ? "" : origen}${!lineas && !origen ? '<li class="text-muted">Sin cambios registrados desde que se activó el historial.</li>' : ""}</ul>`;
    } catch (err) {
      histEl.innerHTML = `<summary>🕘 Historial de este registro</summary><p class="text-muted ip-sin-margen">${esc(errorAmigable(err))}</p>`;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarAlerta(formAlerta);
    const datos = leerFormulario(mod.campos, formCampos);
    if (mod.porCapitulo && cap) datos[mod.porCapitulo] = cap;
    guardarBtn.disabled = true;
    guardarBtn.textContent = "Guardando...";
    try {
      const subir = async (blob) => {
        const ruta = `interventoria-pro/${contrato.id}/${mod.coleccion}/${crypto.randomUUID()}.jpg`;
        const r = ref(storage, ruta);
        await uploadBytes(r, blob, { contentType: "image/jpeg" });
        return { url: await getDownloadURL(r), ruta };
      };
      const img = mod.campos.find((c) => c.type === "imagen");
      // Registro nuevo con varias fotos: una entrada por foto (misma fecha,
      // capítulo y observación); se suben aquí y se crean más abajo.
      let fotosRegistros = [];
      if (img && editandoId && fotosForm.archivo(img.key)) {
        const { url, ruta } = await subir(fotosForm.archivo(img.key));
        datos[img.key] = url;
        datos[`${img.key}Ruta`] = ruta;
      } else if (img && !editandoId) {
        const blobs = fotosForm.archivos(img.key);
        if (!blobs.length) throw new Error("Toma o elige al menos una foto.");
        for (let i = 0; i < blobs.length; i++) {
          guardarBtn.textContent = `Subiendo foto ${i + 1} de ${blobs.length}…`;
          fotosRegistros.push(await subir(blobs[i]));
        }
      }
      // Fotos de evidencia: las que quedaron + las nuevas, ya subidas.
      for (const key of fotosForm.camposFotos()) {
        const f = fotosForm.fotos(key);
        if (f.nuevas.length) guardarBtn.textContent = `Subiendo ${f.nuevas.length} foto(s)…`;
        const subidas = [];
        for (const blob of f.nuevas) subidas.push(await subir(blob));
        datos[key] = [...f.conservadas, ...subidas];
      }
      datos.actualizadoPor = perfil.nombre || user.email;
      datos.actualizadoEn = serverTimestamp();
      // El cambio y su entrada de historial se guardan juntos (un lote).
      const lote = writeBatch(db);
      const base = { user, perfil, modulo: mod.id, moduloLabel: tituloModulo };
      if (editandoId) {
        const antes = ctx.registros.find((r) => r.id === editandoId) || {};
        const cambios = diferencias(mod.campos, antes, datos, ctx.datos.personal || []);
        lote.update(doc(coleccionRef, editandoId), datos);
        if (cambios.length) anotarEnLote(lote, contrato.id, { ...base, registroId: editandoId, accion: "editar", resumen: identificar(mod, { ...antes, ...datos }), cambios });
      } else {
        datos.creadoPor = perfil.nombre || user.email;
        datos.creadoEn = serverTimestamp();
        // Sin foto propia del módulo: un solo registro. Con fotos: uno por foto.
        const variantes = fotosRegistros.length ? fotosRegistros.map(({ url, ruta }) => ({ ...datos, [img.key]: url, [`${img.key}Ruta`]: ruta })) : [datos];
        variantes.forEach((d) => {
          const nuevo = doc(coleccionRef);
          lote.set(nuevo, d);
          anotarEnLote(lote, contrato.id, { ...base, registroId: nuevo.id, accion: "crear", resumen: identificar(mod, d), cambios: diferencias(mod.campos, {}, d, ctx.datos.personal || []) });
        });
      }
      await lote.commit();
      cerrarModal("ipModal");
    } catch (err) {
      mostrarAlerta(formAlerta, errorAmigable(err));
    } finally {
      guardarBtn.disabled = false;
      guardarBtn.textContent = "Guardar";
    }
  });

  eliminarBtn.addEventListener("click", async () => {
    if (!esGestor) return;
    if (!editandoId || !confirm("¿Eliminar este registro? Esta acción no se puede deshacer; quedará constancia en el historial.")) return;
    try {
      const antes = ctx.registros.find((r) => r.id === editandoId) || {};
      const lote = writeBatch(db);
      lote.delete(doc(coleccionRef, editandoId));
      // Se guarda el contenido eliminado para que no se pierda la evidencia.
      anotarEnLote(lote, contrato.id, { user, perfil, modulo: mod.id, moduloLabel: tituloModulo, registroId: editandoId, accion: "eliminar", resumen: identificar(mod, antes), cambios: diferencias(mod.campos, {}, antes, ctx.datos.personal || []) });
      await lote.commit();
      cerrarModal("ipModal");
    } catch (err) {
      mostrarAlerta(formAlerta, errorAmigable(err));
    }
  });

  document.getElementById("ipNuevoBtn").addEventListener("click", () => abrirFormulario());

  // Importación desde Excel (plantilla, vista previa y guardado con historial).
  configurarImportacion({ mod, contrato, ctx, user, perfil, coleccionRef, cap, frentesContrato: frentesDelContrato, titulo: tituloModulo });

  // ---------------------------------------------------------- plantilla
  // Módulos con lista base (ej. requisitos del acta de inicio): agrega de
  // un clic los ítems que aún no estén (compara por mod.claveUnica), así
  // se puede volver a usar sin duplicar.
  if (mod.plantilla) {
    const btnPlantilla = document.getElementById("ipPlantillaBtn");
    btnPlantilla.classList.remove("hidden");
    // Los ítems marcados "*" se repiten por cada frente del contrato.
    const listaBase = mod.expandir ? mod.expandir(mod.plantilla, frentesDelContrato()) : mod.plantilla;
    btnPlantilla.textContent = `📋 Ver y cargar lista base (${listaBase.length})`;
    btnPlantilla.addEventListener("click", async () => {
      const clave = mod.claveUnica;
      const existentes = new Set(ctx.registros.map((r) => String(r[clave] || "").trim()));
      const nuevos = listaBase.filter((p) => !existentes.has(p[clave].trim()));
      // Vista previa de toda la lista base: qué se agregaría y qué ya está.
      const cols = ["categoria", "requisito", "proyecto", "responsable", "soporte"].filter((k) => listaBase.some((p) => p[k]));
      const etiqueta = (k) => mod.campos.find((c) => c.key === k)?.label || { categoria: "Categoría", requisito: "Requisito", proyecto: "Proyecto / frente", responsable: "Responsable", soporte: "Soporte" }[k];
      mostrarTabla({
        titulo: `Lista base — ${tituloModulo}`,
        nota: nuevos.length
          ? `${listaBase.length} requisito(s) en la lista base: ${nuevos.length} se agregarían y ${listaBase.length - nuevos.length} ya están en el contrato (en gris; no se duplican). Después de cargarla puedes editar cada requisito o marcarlo «No aplica».`
          : `Los ${listaBase.length} requisito(s) de la lista base ya están en este contrato.`,
        columnas: ["", ...cols.map(etiqueta)],
        filas: listaBase.map((p) => [existentes.has(p[clave].trim()) ? "Ya está" : "Nuevo", ...cols.map((k) => p[k] || "")]),
        marcar: (f) => (f[0] === "Ya está" ? "ip-visor-existente" : ""),
        accion: nuevos.length ? { texto: `Agregar ${nuevos.length} requisito(s)`, fn: () => cargarLista(nuevos) } : null
      });
    });
    async function cargarLista(nuevos) {
      const clave = mod.claveUnica;
      btnPlantilla.disabled = true;
      try {
        for (let i = 0; i < nuevos.length; i += 400) {
          const lote = writeBatch(db);
          if (i === 0) anotarEnLote(lote, contrato.id, { user, perfil, modulo: mod.id, moduloLabel: tituloModulo, accion: "lista", resumen: `${nuevos.length} requisito(s) agregados desde la lista base` });
          nuevos.slice(i, i + 400).forEach((p) => {
            const base = {};
            mod.campos.forEach((c) => { if (c.porDefecto) base[c.key] = c.porDefecto(); });
            lote.set(doc(coleccionRef), { ...base, ...p, creadoPor: perfil.nombre || user.email, creadoEn: serverTimestamp() });
          });
          await lote.commit();
        }
      } catch (err) {
        alert(errorAmigable(err));
      } finally {
        btnPlantilla.disabled = false;
      }
    }
  }
  document.getElementById("ipCancelarBtn").addEventListener("click", () => cerrarModal("ipModal"));
  document.getElementById("ipModal").addEventListener("click", (e) => { if (e.target.id === "ipModal") cerrarModal("ipModal"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarModal("ipModal"); });

  // Sin el permiso "registrar" el módulo queda en consulta: se pueden abrir
  // los registros pero no crear, guardar, importar ni cargar listas.
  if (!puede.registrar) {
    ["ipNuevoBtn", "ipImportarBtn", "ipPlantillaBtn", "ipGuardarBtn"].forEach((id) => document.getElementById(id)?.classList.add("hidden"));
    document.getElementById("ipResumen").insertAdjacentHTML("beforebegin", '<div class="alert info ip-alerta-fija">👁 Tu rol solo permite consultar este módulo. Para registrar información pídele al administrador el permiso «Registrar y editar».</div>');
  }

  // ---------------------------------------------------------- Excel
  // Todas las columnas del formulario (no solo las de la tabla), con ancho
  // proporcional al contenido real de cada una.
  document.getElementById("ipExcelBtn").addEventListener("click", async () => {
    const ExcelJS = window.ExcelJS;
    if (!ExcelJS) { alert("No se pudo cargar el generador de Excel."); return; }
    const campos = mod.campos.filter((c) => !["imagen", "avance", "fotos"].includes(c.type));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(mod.label.slice(0, 31));
    ws.columns = [...campos.map((c) => ({ header: c.label, key: c.key })), ...(mod.validar ? [{ header: "Validación", key: "_estado" }] : [])];
    ordenar(ctx.registros).forEach((r) => {
      const fila = {};
      campos.forEach((c) => {
        const v = r[c.key];
        if (v == null || v === "") { fila[c.key] = ""; return; }
        if (["money", "number", "pct"].includes(c.type)) fila[c.key] = Number(v);
        else if (c.type === "persona") fila[c.key] = (ctx.datos.personal || []).find((p) => p.id === v)?.nombre || "";
        else if (c.opcionesObj) fila[c.key] = nombreCapitulo(v);
        else fila[c.key] = String(v);
      });
      if (mod.validar) fila._estado = mod.validar(r, ctx).texto;
      ws.addRow(fila);
    });
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9820B" } };
    ws.columns.forEach((col, i) => {
      const c = campos[i];
      if (c?.type === "money") col.numFmt = "#,##0";
      let max = String(col.header || "").length;
      col.eachCell({ includeEmpty: false }, (cell) => { max = Math.max(max, String(cell.value ?? "").length); });
      col.width = Math.min(60, Math.max(8, max + 2));
    });
    // Primero se ve en pantalla; desde ahí se descarga.
    mostrarLibro(wb, `${mod.id}${cap ? "_" + cap : ""}_${(contrato.numero || "contrato").replace(/[^\w-]/g, "_")}.xlsx`, { titulo: `Vista previa — ${tituloModulo}`, nota: `${ctx.registros.length} registro(s) con todas las columnas del formulario.` });
  });
}
