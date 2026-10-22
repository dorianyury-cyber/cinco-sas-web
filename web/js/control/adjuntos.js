// Documentos adjuntos a un ítem del checklist: varios archivos (PDF, imágenes, Word, Excel; hasta 25 MB),
// visualizador dentro de la página y las opciones Ver / Reemplazar / Eliminar. El enlace de OneDrive que
// tenían los ítems se conserva como un documento más. Todo se arma con la API del DOM (sin innerHTML).
import { updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { storage } from "./firebase-control.js";
import { registrarActividad } from "./actividad.js";
import { documentosDeItem, validarArchivo, tipoVisor, esUrlSegura, nombreDeEnlace, extensionDe } from "./actividad-motor.js";

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function boton(clase, texto, titulo, alClic) {
  const b = el("button", clase, texto);
  b.type = "button";
  b.title = titulo;
  b.addEventListener("click", alClic);
  return b;
}

// ---- Visualizador (una sola ventana reutilizada) ----
let visor = null;
let urlTemporal = null;

function cerrarVisor() {
  if (!visor) return;
  visor.fondo.classList.remove("open");
  visor.cuerpo.replaceChildren();
  if (urlTemporal) { URL.revokeObjectURL(urlTemporal); urlTemporal = null; }
}

function obtenerVisor() {
  if (visor) return visor;
  const fondo = el("div", "modal-backdrop control-visor-fondo");
  const caja = el("div", "control-visor");
  const cabecera = el("div", "control-visor-cabecera");
  const titulo = el("strong", "control-visor-titulo");
  const descargar = el("a", "control-btn-mini", "⬇ Descargar");
  descargar.target = "_blank";
  descargar.rel = "noopener";
  const cerrar = boton("control-btn-mini", "✕ Cerrar", "Cerrar", cerrarVisor);
  cabecera.append(titulo, descargar, cerrar);
  const cuerpo = el("div", "control-visor-cuerpo");
  caja.append(cabecera, cuerpo);
  fondo.appendChild(caja);
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrarVisor(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarVisor(); });
  document.body.appendChild(fondo);
  visor = { fondo, titulo, descargar, cuerpo };
  return visor;
}

function mensajeVisor(cuerpo, texto, url) {
  const p = el("p", "control-visor-mensaje", texto);
  cuerpo.replaceChildren(p);
  if (url) {
    const a = el("a", "btn", "Abrir en una pestaña nueva");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    cuerpo.appendChild(a);
  }
}

async function verDocumento(d) {
  if (d.tipo === "enlace") {
    if (esUrlSegura(d.url)) window.open(d.url, "_blank", "noopener");
    return;
  }
  const v = obtenerVisor();
  v.titulo.textContent = d.nombre;
  v.descargar.href = d.url;
  v.cuerpo.replaceChildren();
  v.fondo.classList.add("open");
  const clase = tipoVisor(d.nombre);
  if (clase === "imagen") {
    const img = el("img", "control-visor-imagen");
    img.alt = d.nombre;
    img.src = d.url;
    v.cuerpo.appendChild(img);
  } else if (clase === "pdf") {
    mensajeVisor(v.cuerpo, "Cargando…");
    try {
      const blob = await getBlob(ref(storage, d.ruta));
      if (!v.fondo.classList.contains("open")) return;
      urlTemporal = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const marco = el("iframe", "control-visor-marco");
      marco.title = d.nombre;
      marco.src = urlTemporal;
      v.cuerpo.replaceChildren(marco);
    } catch (err) {
      mensajeVisor(v.cuerpo, "No se pudo mostrar el PDF en esta ventana.", d.url);
    }
  } else {
    mensajeVisor(v.cuerpo, "Los archivos de Word y Excel no se pueden ver aquí: descárgalos para abrirlos.", d.url);
  }
}

function nuevoId() {
  return (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(16).slice(2)}`).replace(/-/g, "").slice(0, 20);
}

function tamanoLegible(n) {
  if (!n) return "";
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

// Celda "Documentos" de un ítem. `editable` = puede adjuntar, reemplazar y eliminar.
export function crearCeldaDocumentos({ item, contratoId, user, editable, seccion }) {
  const celda = el("div", "control-docs");
  const entrada = el("input");
  entrada.type = "file";
  entrada.multiple = true;
  entrada.accept = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx";
  entrada.hidden = true;
  let reemplazando = null;
  let ocupado = false;

  const reg = (tipo, detalle) => registrarActividad({ tipo, seccion, item: item.nombre, itemId: item.id, detalle });
  const guardar = (cambios) => updateDoc(item.ref, { ...cambios, actualizadoEn: serverTimestamp(), actualizadoPor: user.email });
  const avisar = (txt) => window.alert(txt);

  async function subir(archivo, extension, contentType) {
    const id = nuevoId();
    const ruta = `contratos/${contratoId}/items/${item.id}/${id}.${extension}`;
    const r = ref(storage, ruta);
    await uploadBytes(r, archivo, { contentType });
    return {
      id, tipo: "archivo", nombre: archivo.name, url: await getDownloadURL(r), ruta,
      tamano: archivo.size, contentType, subidoPor: user.email, subidoEn: new Date().toISOString()
    };
  }

  async function borrarDeAlmacen(d) {
    if (d.tipo === "archivo" && d.ruta) { try { await deleteObject(ref(storage, d.ruta)); } catch (e) { /* ya no existía */ } }
  }

  async function envolver(accion) {
    if (ocupado) return;
    ocupado = true;
    pintar();
    try { await accion(); } catch (err) { avisar(err.message || "No se pudo completar la acción."); }
    ocupado = false;
    pintar();
  }

  entrada.addEventListener("change", () => {
    const archivos = [...entrada.files];
    entrada.value = "";
    if (!archivos.length) return;
    const destino = reemplazando;
    reemplazando = null;
    envolver(async () => {
      const lista = destino ? archivos.slice(0, 1) : archivos;
      const nuevos = [];
      for (const f of lista) {
        const v = validarArchivo(f.name, f.size);
        if (!v.ok) { avisar(v.motivo); continue; }
        nuevos.push(await subir(f, v.extension, v.contentType));
      }
      if (!nuevos.length) return;
      const actuales = Array.isArray(item.documentos) ? [...item.documentos] : [];
      if (destino) {
        const idx = actuales.findIndex((x) => x.id === destino.id);
        if (idx >= 0) actuales[idx] = nuevos[0]; else actuales.push(nuevos[0]);
        await guardar({ documentos: actuales });
        item.documentos = actuales;
        await borrarDeAlmacen(destino);
        await reg("doc_reemplazo", `Reemplazó «${destino.nombre}» por «${nuevos[0].nombre}»`);
      } else {
        const todos = [...actuales, ...nuevos];
        await guardar({ documentos: todos });
        item.documentos = todos;
        for (const n of nuevos) await reg("doc_adjunto", `Adjuntó «${n.nombre}» (${tamanoLegible(n.tamano)})`);
      }
    });
  });

  function pedirEnlace(texto, valorInicial) {
    const url = window.prompt(texto, valorInicial || "https://");
    if (url === null) return null;
    const limpio = url.trim();
    if (!esUrlSegura(limpio) || limpio.length > 500) { avisar("Pega un enlace completo que empiece por https://"); return null; }
    return limpio;
  }

  function agregarEnlace() {
    const url = pedirEnlace("Pega el enlace del documento (por ejemplo, de OneDrive):");
    if (!url) return;
    envolver(async () => {
      const nuevo = { id: nuevoId(), tipo: "enlace", nombre: nombreDeEnlace(url), url, subidoPor: user.email, subidoEn: new Date().toISOString() };
      const todos = [...(Array.isArray(item.documentos) ? item.documentos : []), nuevo];
      await guardar({ documentos: todos });
      item.documentos = todos;
      await reg("doc_adjunto", `Agregó el enlace «${nuevo.nombre}»`);
    });
  }

  function reemplazar(d) {
    if (d.tipo === "enlace") {
      const url = pedirEnlace("Pega el enlace nuevo:", d.url);
      if (!url) return;
      envolver(async () => {
        if (d.heredado) {
          await guardar({ enlace: url });
          item.enlace = url;
        } else {
          const todos = item.documentos.map((x) => (x.id === d.id ? { ...x, url, nombre: nombreDeEnlace(url) } : x));
          await guardar({ documentos: todos });
          item.documentos = todos;
        }
        await reg("doc_reemplazo", `Reemplazó el enlace «${d.nombre}» por «${nombreDeEnlace(url)}»`);
      });
      return;
    }
    reemplazando = d;
    entrada.multiple = false;
    entrada.click();
    entrada.multiple = true;
  }

  function eliminar(d) {
    if (!window.confirm(`¿Eliminar «${d.nombre}» de este ítem?\n\nEl archivo se borra y no se puede recuperar (la bitácora conserva el registro).`)) return;
    envolver(async () => {
      if (d.heredado) {
        await guardar({ enlace: "" });
        item.enlace = "";
      } else {
        const resto = item.documentos.filter((x) => x.id !== d.id);
        await guardar({ documentos: resto });
        item.documentos = resto;
        await borrarDeAlmacen(d);
      }
      await reg("doc_eliminado", `Eliminó «${d.nombre}»`);
    });
  }

  function pintar() {
    celda.replaceChildren(entrada);
    const docs = documentosDeItem(item);
    if (editable) {
      const barra = el("div", "control-docs-barra");
      const adjuntar = boton("control-btn-mini control-docs-adjuntar", ocupado ? "Subiendo…" : "📎 Adjuntar", "Adjuntar uno o varios archivos (PDF, imágenes, Word, Excel; máx. 25 MB)", () => { reemplazando = null; entrada.click(); });
      adjuntar.disabled = ocupado;
      const enlace = boton("icon-btn", "🔗", "Pegar un enlace (por ejemplo, de OneDrive)", agregarEnlace);
      enlace.disabled = ocupado;
      barra.append(adjuntar, enlace);
      celda.appendChild(barra);
    } else if (!docs.length) {
      celda.appendChild(el("span", "control-item-oculto", "—"));
    }
    docs.forEach((d) => {
      const fila = el("div", "control-doc");
      const clase = d.tipo === "enlace" ? "enlace" : extensionDe(d.nombre);
      const nombre = boton("control-doc-nombre", `${d.tipo === "enlace" ? "🔗" : "📄"} ${d.nombre}`, `Ver «${d.nombre}»${d.tamano ? " — " + tamanoLegible(d.tamano) : ""}`, () => verDocumento(d));
      nombre.dataset.tipo = clase;
      fila.appendChild(nombre);
      if (editable) {
        const r = boton("icon-btn", "↻", "Reemplazar", () => reemplazar(d));
        const x = boton("icon-btn danger", "🗑️", "Eliminar", () => eliminar(d));
        r.disabled = x.disabled = ocupado;
        fila.append(r, x);
      }
      celda.appendChild(fila);
    });
  }

  pintar();
  return celda;
}
