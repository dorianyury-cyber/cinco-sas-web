// Contenido adicional del informe mensual: por capítulo (y la Introducción),
// párrafos, subtítulos, tablas e imágenes que el informe no saca de los
// módulos — mismo editor por bloques de los Informes de gestión (las tablas
// usan TAL CUAL su editor: web/js/control/editor-tabla.js).
// Se guarda por contrato y mes en ipContratos/{id}/informeAdicional/{ym}
// como { capitulos: { [capId]: [bloques] } }; las imágenes se suben a
// Storage (interventoria-pro/{contratoId}/informe-{ym}/...) al elegirlas y el
// bloque guarda su URL. construirInforme las pone al final de su capítulo,
// tanto en el PDF como en el Word.
import { doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { db, storage, mesLargo, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ip-core.js";
import { comprimir } from "./ip-formulario.js";
import { anotarEnLote } from "./ip-historial.js";
import { crearEditorTabla, nuevaTabla } from "../../js/control/editor-tabla.js";

const ETIQUETA = { parrafo: "Párrafo", titulo2: "Subtítulo", tabla: "Tabla", imagen: "Imagen" };
// Firestore no admite listas dentro de listas: las filas de una tabla se
// guardan como [{celdas: [...]}] y se desenvuelven al editar (igual que Informes).
const filasEditables = (filas) => (filas || []).map((f) => (Array.isArray(f) ? f : f.celdas || []));
// Sin valores indefinidos (Firestore los rechaza) ni el estado interno del editor (_selA, _filaFoco…).
const sinIndefinidos = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k.startsWith("_") ? undefined : v)));

export function montarEditorAdicional({ contrato, user, perfil, alGuardar }) {
  const modal = document.getElementById("adicionalModal");
  const tituloEl = document.getElementById("adicionalTitulo");
  const mesEl = document.getElementById("adicionalMes");
  const lista = document.getElementById("adicionalBloques");
  const archivo = document.getElementById("adicionalArchivo");
  const alerta = document.getElementById("adicionalAlerta");
  const guardarBtn = document.getElementById("adicionalGuardarBtn");

  let porMes = {};          // { [capId]: [bloques] } del mes cargado
  let ymCargado = null;
  let capActual = null;
  let bloques = [];         // copia en edición del capítulo abierto

  async function cargarMes(ym) {
    ymCargado = ym;
    porMes = {};
    try {
      const snap = await getDoc(doc(db, "ipContratos", contrato.id, "informeAdicional", ym));
      if (snap.exists()) porMes = snap.data().capitulos || {};
    } catch (err) { /* sin contenido adicional todavía */ }
    return porMes;
  }

  function pintar() {
    lista.replaceChildren();
    if (!bloques.length) {
      const p = document.createElement("p");
      p.className = "text-muted ip-adicional-vacio";
      p.textContent = "Todavía no hay contenido adicional en este capítulo. Agrégalo con los botones de abajo.";
      lista.appendChild(p);
      return;
    }
    bloques.forEach((b, i) => {
      const fila = document.createElement("div");
      fila.className = "ip-adicional-bloque";
      const cab = document.createElement("div");
      cab.className = "ip-adicional-cab";
      const etq = document.createElement("strong");
      etq.textContent = ETIQUETA[b.tipo] || b.tipo;
      cab.appendChild(etq);
      const accion = (texto, titulo, fn, clase = "") => {
        const bt = document.createElement("button");
        bt.type = "button";
        bt.className = `btn secondary ip-adicional-accion ${clase}`;
        bt.textContent = texto;
        bt.title = titulo;
        bt.disabled = (texto === "↑" && i === 0) || (texto === "↓" && i === bloques.length - 1);
        bt.addEventListener("click", fn);
        cab.appendChild(bt);
      };
      accion("↑", "Subir", () => { [bloques[i - 1], bloques[i]] = [bloques[i], bloques[i - 1]]; pintar(); });
      accion("↓", "Bajar", () => { [bloques[i + 1], bloques[i]] = [bloques[i], bloques[i + 1]]; pintar(); });
      accion("Quitar", "Quitar este bloque", () => { bloques.splice(i, 1); pintar(); }, "ip-adicional-quitar");
      fila.appendChild(cab);

      if (b.tipo === "parrafo" || b.tipo === "titulo2") {
        const campo = document.createElement(b.tipo === "parrafo" ? "textarea" : "input");
        if (b.tipo === "parrafo") campo.rows = 4; else campo.type = "text";
        campo.className = "ip-adicional-texto";
        campo.placeholder = b.tipo === "parrafo" ? "Escribe el párrafo…" : "Escribe el subtítulo…";
        campo.value = b.texto || "";
        campo.addEventListener("input", () => { b.texto = campo.value; });
        fila.appendChild(campo);
      } else if (b.tipo === "tabla") {
        const avisar = (texto, tipo) => mostrarAlerta(alerta, texto, tipo === "ok" ? "success" : "error");
        fila.appendChild(crearEditorTabla(b, { alCambiar: pintar, avisar }));
      } else if (b.tipo === "imagen") {
        // Como en Informes: título de la figura arriba, la imagen, su tamaño
        // en el informe y la fuente debajo.
        const titulo = document.createElement("input");
        titulo.type = "text";
        titulo.className = "ip-adicional-texto";
        titulo.placeholder = "Título de la figura — ej. Recuperación de energía estimada (kWh/mes)";
        titulo.value = b.nombre || "";
        titulo.addEventListener("input", () => { b.nombre = titulo.value; });
        const img = document.createElement("img");
        img.className = "ip-adicional-img";
        img.src = b.url;
        img.alt = b.nombre || "Imagen";
        const tam = document.createElement("label");
        tam.className = "ip-adicional-tamano";
        const tamTexto = document.createElement("span");
        const rango = document.createElement("input");
        rango.type = "range"; rango.min = "30"; rango.max = "100"; rango.step = "5";
        rango.value = String(b.tamano || 85);
        tamTexto.textContent = `Tamaño en el informe: ${rango.value}%`;
        rango.addEventListener("input", () => { b.tamano = Number(rango.value); tamTexto.textContent = `Tamaño en el informe: ${rango.value}%`; });
        tam.append(tamTexto, rango);
        const fuente = document.createElement("input");
        fuente.type = "text";
        fuente.className = "ip-adicional-texto";
        fuente.placeholder = "Fuente (opcional) — ej. Fuente: Elaboración propia";
        fuente.value = b.pieDeFoto || "";
        fuente.addEventListener("input", () => { b.pieDeFoto = fuente.value; });
        fila.append(titulo, img, tam, fuente);
      }
      lista.appendChild(fila);
    });
  }

  async function subirImagenes(archivos) {
    limpiarAlerta(alerta);
    for (const f of archivos) {
      if (!/^image\//.test(f.type)) continue;
      const aviso = document.createElement("p");
      aviso.className = "text-muted";
      aviso.textContent = `Subiendo ${f.name}…`;
      lista.appendChild(aviso);
      try {
        const blob = await comprimir(f);
        const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const r = ref(storage, `interventoria-pro/${contrato.id}/informe-${ymCargado}/${nombre}`);
        await uploadBytes(r, blob, { contentType: "image/jpeg" });
        bloques.push({ tipo: "imagen", url: await getDownloadURL(r), nombre: "", tamano: 85, pieDeFoto: "" });
      } catch (err) {
        mostrarAlerta(alerta, `No se pudo subir ${f.name}: ${errorAmigable(err)}`);
      }
      pintar();
    }
  }

  modal.querySelectorAll("[data-adicional]").forEach((bt) => bt.addEventListener("click", () => {
    const tipo = bt.dataset.adicional;
    if (tipo === "imagen") { archivo.click(); return; }
    bloques.push(tipo === "tabla" ? nuevaTabla() : { tipo, texto: "" });
    pintar();
    lista.querySelector(".ip-adicional-bloque:last-child .ip-adicional-texto")?.focus();
  }));
  archivo.addEventListener("change", async () => {
    const elegidos = [...archivo.files];
    archivo.value = "";
    await subirImagenes(elegidos);
  });

  const cerrar = () => modal.classList.remove("open");
  document.getElementById("adicionalCerrarBtn").addEventListener("click", cerrar);
  modal.addEventListener("click", (e) => { if (e.target === modal) cerrar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) cerrar(); });

  guardarBtn.addEventListener("click", async () => {
    limpiarAlerta(alerta);
    // Bloques vacíos (párrafo o subtítulo sin texto) no se guardan.
    const limpios = bloques
      .filter((b) => (b.tipo === "imagen" ? b.url : b.tipo === "tabla" ? b.filas?.length : String(b.texto || "").trim()))
      .map((b) => {
        if (b.tipo === "imagen") return { tipo: "imagen", url: b.url, nombre: String(b.nombre || "").trim(), tamano: Number(b.tamano) || 85, pieDeFoto: String(b.pieDeFoto || "").trim() };
        if (b.tipo === "tabla") return sinIndefinidos({ ...b, filas: filasEditables(b.filas).map((f) => ({ celdas: f })) });
        return { tipo: b.tipo, texto: String(b.texto).trim() };
      });
    guardarBtn.disabled = true;
    try {
      const lote = writeBatch(db);
      lote.set(doc(db, "ipContratos", contrato.id, "informeAdicional", ymCargado), {
        ym: ymCargado, capitulos: { [capActual.id]: limpios }, actualizadoEn: serverTimestamp(), actualizadoPor: user.email
      }, { merge: true });
      anotarEnLote(lote, contrato.id, {
        user, perfil, modulo: "informe", moduloLabel: "Informe mensual", accion: "editar",
        resumen: `Contenido adicional de «${capActual.label}» (${mesLargo(ymCargado)}): ${limpios.length} bloque(s)`
      });
      await lote.commit();
      porMes[capActual.id] = limpios;
      cerrar();
      alGuardar?.();
    } catch (err) {
      mostrarAlerta(alerta, `No se pudo guardar: ${errorAmigable(err)}`);
    } finally {
      guardarBtn.disabled = false;
    }
  });

  return {
    cargarMes,
    contenido: () => porMes,
    cuantos: (capId) => (porMes[capId] || []).length,
    abrir(cap) {
      capActual = cap;
      // Copia profunda: si se cancela, lo guardado no queda tocado.
      bloques = (porMes[cap.id] || []).map((b) => (b.tipo === "tabla" ? { ...structuredClone(b), filas: filasEditables(b.filas) } : { ...b }));
      tituloEl.textContent = `Contenido adicional — ${cap.label}`;
      mesEl.textContent = mesLargo(ymCargado);
      limpiarAlerta(alerta);
      pintar();
      modal.classList.add("open");
    }
  };
}
