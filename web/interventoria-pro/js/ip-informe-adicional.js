// Contenido adicional del informe mensual: por capítulo (y la Introducción),
// el mismo editor por bloques de los Informes de gestión — párrafos con
// formato (negrilla, cursiva, color, viñetas), Títulos 1/2/3 numerados solos,
// tablas (TAL CUAL su editor: web/js/control/editor-tabla.js), imágenes
// (Figura N, tamaño, fuente) y firmas; botones para insertar entre bloques,
// ↑ ↓ Quitar y Deshacer.
//
// Numeración: el "Título 1" del editor es el siguiente numeral DENTRO del
// capítulo del informe (si el capítulo 7 ya trae 7.1–7.3, va como 7.4),
// "Título 2" queda debajo (7.4.1) y "Título 3" (7.4.1.1). Las tablas y
// figuras siguen el consecutivo del informe. En el editor el número es
// indicativo (ip-informe.js lo calcula con las secciones marcadas); el
// definitivo lo pone el PDF/Word al generarse.
//
// Se guarda por contrato y mes en ipContratos/{id}/informeAdicional/{ym}
// como { capitulos: { [capId]: [bloques] } }; imágenes y firmas se suben a
// Storage (interventoria-pro/{contratoId}/informe-{ym}/...) al elegirlas y el
// bloque guarda su URL. construirInforme las pone al final de su capítulo.
import { doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { db, storage, mesLargo, mostrarAlerta, limpiarAlerta, errorAmigable } from "./ip-core.js";
import { comprimir } from "./ip-formulario.js";
import { anotarEnLote } from "./ip-historial.js";
import { crearEditorTabla, nuevaTabla } from "../../js/control/editor-tabla.js";
import { crearCampoTextoRico, htmlParaCampoRico, textoPlanoDesdeHtml } from "../../js/control/texto-rico.js";

// Firestore no admite listas dentro de listas: las filas de una tabla se
// guardan como [{celdas: [...]}] y se desenvuelven al editar (igual que Informes).
const filasEditables = (filas) => (filas || []).map((f) => (Array.isArray(f) ? f : f.celdas || []));
// Sin valores indefinidos (Firestore los rechaza) ni el estado interno del editor (_selA, _filaFoco…).
const sinIndefinidos = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k.startsWith("_") ? undefined : v)));

const NUEVOS = {
  parrafo: () => ({ tipo: "parrafo", rico: true, texto: "" }),
  titulo1: () => ({ tipo: "titulo", nivel: 1, texto: "" }),
  titulo2: () => ({ tipo: "titulo", nivel: 2, texto: "" }),
  titulo3: () => ({ tipo: "titulo", nivel: 3, texto: "" }),
  tabla: () => nuevaTabla(),
  firma: () => ({ tipo: "firma", etiqueta: "", firmantes: [{ nombre: "", cargo: "" }] })
};
const BOTONES = [
  ["parrafo", "+ Párrafo"], ["titulo1", "+ Título 1"], ["titulo2", "+ Título 2"], ["titulo3", "+ Título 3"],
  ["tabla", "+ Tabla"], ["imagen", "+ Imagen"], ["firma", "+ Firma"]
];

// Bloques guardados con la primera versión del editor → los de ahora.
function normalizar(b) {
  if (b.tipo === "titulo2") return { tipo: "titulo", nivel: 1, texto: b.texto || "" };
  if (b.tipo === "parrafo" && !b.rico) return { tipo: "parrafo", rico: true, texto: htmlParaCampoRico(b.texto || "") };
  if (b.tipo === "tabla") return { ...structuredClone(b), filas: filasEditables(b.filas) };
  if (b.tipo === "firma") return structuredClone(b);
  return { ...b };
}

function boton(texto, clase, titulo, fn) {
  const bt = document.createElement("button");
  bt.type = "button";
  bt.className = clase;
  bt.textContent = texto;
  if (titulo) bt.title = titulo;
  bt.addEventListener("click", fn);
  return bt;
}

export function montarEditorAdicional({ contrato, user, perfil, alGuardar }) {
  const modal = document.getElementById("adicionalModal");
  const tituloEl = document.getElementById("adicionalTitulo");
  const mesEl = document.getElementById("adicionalMes");
  const numEl = document.getElementById("adicionalNumeracion");
  const lista = document.getElementById("adicionalBloques");
  const archivo = document.getElementById("adicionalArchivo");
  const alerta = document.getElementById("adicionalAlerta");
  const guardarBtn = document.getElementById("adicionalGuardarBtn");

  let porMes = {};          // { [capId]: [bloques] } del mes cargado
  let ymCargado = null;
  let capActual = null;
  let inicio = null;        // { capNum, titulos, tablas, figuras, incluido }
  let bloques = [];         // copia en edición del capítulo abierto
  let historial = [];       // para «Deshacer»
  let insertarEn = null;    // posición donde va la imagen que se está eligiendo
  let enfocar = null;

  async function cargarMes(ym) {
    ymCargado = ym;
    porMes = {};
    try {
      const snap = await getDoc(doc(db, "ipContratos", contrato.id, "informeAdicional", ym));
      if (snap.exists()) porMes = snap.data().capitulos || {};
    } catch (err) { /* sin contenido adicional todavía */ }
    return porMes;
  }

  const copia = () => bloques.map((b) => sinIndefinidos(b));
  function guardarHistorial() {
    historial.push(copia());
    if (historial.length > 40) historial.shift();
  }
  const avisar = (texto, tipo) => mostrarAlerta(alerta, texto, tipo === "ok" ? "success" : "error");

  // Números indicativos, como los pondrá el PDF.
  function numeros() {
    const t = [inicio?.titulos || 0, 0, 0];
    let nTabla = inicio?.tablas || 0, nFig = inicio?.figuras || 0;
    const cap = inicio?.capNum || "?";
    return bloques.map((b) => {
      if (b.tipo === "titulo") {
        const n = Math.min(3, Math.max(1, Number(b.nivel) || 1));
        t[n - 1] += 1;
        for (let k = n; k < 3; k++) t[k] = 0;
        return `${cap}.${t.slice(0, n).join(".")}.`;
      }
      if (b.tipo === "tabla") return `Tabla ${++nTabla}.`;
      if (b.tipo === "imagen") return `Figura ${++nFig}.`;
      return "";
    });
  }

  function barraInsertar(indice) {
    const barra = document.createElement("div");
    barra.className = "ip-adicional-insertar";
    BOTONES.forEach(([tipo, texto]) => barra.appendChild(boton(texto, "control-btn-mini", "", () => {
      if (tipo === "imagen") { insertarEn = indice; archivo.click(); return; }
      guardarHistorial();
      bloques.splice(indice, 0, NUEVOS[tipo]());
      enfocar = indice;
      pintar();
    })));
    return barra;
  }

  function etiqueta(texto, numero) {
    const e = document.createElement("span");
    e.className = "control-bloque-etiqueta";
    e.textContent = numero ? `${texto} · ${numero}` : texto;
    return e;
  }

  function editorTitulo(b, numero) {
    const fila = document.createElement("div");
    fila.className = "ip-adicional-titulo";
    const nivel = document.createElement("select");
    [1, 2, 3].forEach((n) => {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = `Título ${n}`;
      if ((Number(b.nivel) || 1) === n) o.selected = true;
      nivel.appendChild(o);
    });
    nivel.addEventListener("change", () => { guardarHistorial(); b.nivel = Number(nivel.value); pintar(); });
    const num = document.createElement("span");
    num.className = "control-numero-indicativo";
    num.textContent = numero;
    num.title = "Numeral indicativo: se calcula solo, siguiendo la numeración del capítulo en el informe. El definitivo lo pone el PDF/Word.";
    const texto = document.createElement("input");
    texto.type = "text";
    texto.maxLength = 300;
    texto.className = "ip-adicional-texto";
    texto.placeholder = "Texto del título, sin numerar — el número se agrega solo";
    texto.value = b.texto || "";
    texto.addEventListener("input", () => { b.texto = texto.value; });
    fila.append(nivel, num, texto);
    return fila;
  }

  function editorImagen(b) {
    const cont = document.createElement("div");
    cont.className = "ip-adicional-imagen";
    const nombre = document.createElement("input");
    nombre.type = "text";
    nombre.maxLength = 200;
    nombre.className = "ip-adicional-texto";
    nombre.placeholder = "Nombre de la gráfica o foto (arriba, centrado, y en la Lista de figuras) — sin «Figura N.»";
    nombre.value = b.nombre || "";
    nombre.addEventListener("input", () => { b.nombre = nombre.value; });
    const img = document.createElement("img");
    img.className = "ip-adicional-img";
    img.src = b.url;
    img.alt = b.nombre || "Imagen";
    const ponerAncho = () => { img.style.width = `${b.tamano || 85}%`; };
    ponerAncho();
    const tam = document.createElement("label");
    tam.className = "ip-adicional-tamano";
    const tamTexto = document.createElement("span");
    const rango = document.createElement("input");
    rango.type = "range"; rango.min = "30"; rango.max = "100"; rango.step = "5";
    rango.value = String(b.tamano || 85);
    tamTexto.textContent = `Tamaño en el informe: ${rango.value}%`;
    rango.addEventListener("input", () => { b.tamano = Number(rango.value); tamTexto.textContent = `Tamaño en el informe: ${rango.value}%`; ponerAncho(); });
    const cambiar = boton("Cambiar imagen", "control-btn-mini", "Reemplaza esta imagen por otra", () => {
      const sel = document.createElement("input");
      sel.type = "file"; sel.accept = "image/*";
      sel.addEventListener("change", async () => {
        const f = sel.files[0];
        if (!f) return;
        const url = await subir(f, "jpg");
        if (url) { guardarHistorial(); b.url = url; pintar(); }
      });
      sel.click();
    });
    tam.append(tamTexto, rango);
    const pie = document.createElement("input");
    pie.type = "text";
    pie.maxLength = 200;
    pie.className = "ip-adicional-texto";
    pie.placeholder = "Pie de foto / fuente (abajo, a la derecha) — ej. Fuente: Elaboración propia";
    pie.value = b.pieDeFoto || "";
    pie.addEventListener("input", () => { b.pieDeFoto = pie.value; });
    const acciones = document.createElement("div");
    acciones.className = "ip-adicional-img-acciones";
    acciones.append(tam, cambiar);
    cont.append(nombre, img, acciones, pie);
    return cont;
  }

  function editorFirma(b) {
    const cont = document.createElement("div");
    cont.className = "control-firma-editor";
    const etq = document.createElement("input");
    etq.type = "text";
    etq.maxLength = 40;
    etq.className = "ip-adicional-texto";
    etq.placeholder = "Etiqueta (ej. Elaboró, Revisó, Aprobó)";
    etq.value = b.etiqueta || "";
    etq.addEventListener("input", () => { b.etiqueta = etq.value; });
    cont.appendChild(etq);
    if (!b.firmantes?.length) b.firmantes = [{ nombre: "", cargo: "" }];
    const firmantes = document.createElement("div");
    firmantes.className = "control-firma-firmantes";
    b.firmantes.forEach((f, fi) => {
      const fila = document.createElement("div");
      fila.className = "control-firma-firmante";
      const campo = (clave, ph) => {
        const i = document.createElement("input");
        i.type = "text"; i.maxLength = 120; i.placeholder = ph; i.value = f[clave] || "";
        i.addEventListener("input", () => { f[clave] = i.value; });
        return i;
      };
      fila.append(campo("nombre", "Nombre"), campo("cargo", "Cargo"));
      const wrap = document.createElement("div");
      wrap.className = "control-firma-imagen-wrap";
      if (f.firmaUrl) {
        const im = document.createElement("img");
        im.src = f.firmaUrl;
        im.className = "control-firma-imagen-preview";
        const lab = document.createElement("label");
        lab.className = "control-firma-tamano";
        lab.textContent = "Tamaño (mm): ";
        const n = document.createElement("input");
        n.type = "number"; n.min = "6"; n.max = "60"; n.step = "1"; n.value = f.altoFirma || 14;
        n.addEventListener("input", () => { f.altoFirma = Number(n.value) || 14; });
        lab.appendChild(n);
        wrap.append(im, lab);
      }
      wrap.appendChild(boton(f.firmaUrl ? "Cambiar firma digital" : "+ Firma digital", "control-btn-mini",
        "Sube la imagen de la firma para que salga sobre el nombre; si no, queda el espacio para firmar a mano", () => {
          const sel = document.createElement("input");
          sel.type = "file"; sel.accept = "image/*";
          sel.addEventListener("change", async () => {
            const a = sel.files[0];
            if (!a) return;
            const url = await subir(a, "png");
            if (url) { guardarHistorial(); f.firmaUrl = url; pintar(); }
          });
          sel.click();
        }));
      if (f.firmaUrl) wrap.appendChild(boton("Quitar firma digital", "control-btn-mini", "", () => { guardarHistorial(); delete f.firmaUrl; pintar(); }));
      if (b.firmantes.length > 1) wrap.appendChild(boton("Quitar firmante", "control-btn-danger", "", () => { guardarHistorial(); b.firmantes.splice(fi, 1); pintar(); }));
      fila.appendChild(wrap);
      firmantes.appendChild(fila);
    });
    cont.appendChild(firmantes);
    cont.appendChild(boton("+ Agregar firmante", "control-btn-mini", "Otro firmante en la misma fila", () => { guardarHistorial(); b.firmantes.push({ nombre: "", cargo: "" }); pintar(); }));
    return cont;
  }

  function pintar() {
    const scroll = lista.scrollTop;
    lista.replaceChildren();
    const nums = numeros();

    const cabeza = document.createElement("div");
    cabeza.className = "ip-adicional-cabeza";
    const deshacer = boton("↩️ Deshacer", "control-btn-mini", "Deshace la última acción (agregar, quitar, mover o cambiar la estructura de un bloque)", () => {
      if (!historial.length) return;
      bloques = historial.pop().map(normalizar);
      pintar();
    });
    deshacer.disabled = !historial.length;
    cabeza.appendChild(deshacer);
    lista.appendChild(cabeza);
    lista.appendChild(barraInsertar(0));

    if (!bloques.length) {
      const p = document.createElement("p");
      p.className = "text-muted ip-adicional-vacio";
      p.textContent = "Todavía no hay contenido adicional en este capítulo. Agrégalo con los botones de arriba.";
      lista.appendChild(p);
    }

    let paraEnfocar = null;
    bloques.forEach((b, i) => {
      const fila = document.createElement("div");
      fila.className = "control-bloque ip-adicional-bloque";
      const cont = document.createElement("div");
      cont.className = "control-bloque-contenido";
      if (b.tipo === "titulo") {
        cont.appendChild(etiqueta(`Título ${Number(b.nivel) || 1}`));
        cont.appendChild(editorTitulo(b, nums[i]));
      } else if (b.tipo === "parrafo") {
        cont.appendChild(etiqueta("Párrafo"));
        cont.appendChild(crearCampoTextoRico({ valor: b.texto || "", placeholder: "Escribe el párrafo… (negrilla, cursiva, color y viñetas con la barra)", onInput: (html) => { b.texto = html; } }));
      } else if (b.tipo === "tabla") {
        cont.appendChild(etiqueta(nums[i]));
        cont.appendChild(crearEditorTabla(b, { antesDeCambiar: guardarHistorial, alCambiar: pintar, avisar }));
      } else if (b.tipo === "imagen") {
        cont.appendChild(etiqueta(`Imagen · ${nums[i]}`));
        cont.appendChild(editorImagen(b));
      } else if (b.tipo === "firma") {
        cont.appendChild(etiqueta("Firma"));
        cont.appendChild(editorFirma(b));
      }
      fila.appendChild(cont);
      if (i === enfocar) paraEnfocar = cont.querySelector("[contenteditable], input[type=text], textarea");

      const ctrl = document.createElement("div");
      ctrl.className = "control-bloque-controles";
      const subir = boton("↑", "control-btn-mini", "Subir", () => { guardarHistorial(); [bloques[i - 1], bloques[i]] = [bloques[i], bloques[i - 1]]; pintar(); });
      subir.disabled = i === 0;
      const bajar = boton("↓", "control-btn-mini", "Bajar", () => { guardarHistorial(); [bloques[i + 1], bloques[i]] = [bloques[i], bloques[i + 1]]; pintar(); });
      bajar.disabled = i === bloques.length - 1;
      ctrl.append(subir, bajar, boton("Quitar", "control-btn-danger", "Quitar este bloque", () => { guardarHistorial(); bloques.splice(i, 1); pintar(); }));
      fila.appendChild(ctrl);
      lista.appendChild(fila);
      lista.appendChild(barraInsertar(i + 1));
    });
    enfocar = null;
    if (paraEnfocar) paraEnfocar.focus(); else lista.scrollTop = scroll;
  }

  async function subir(f, ext) {
    if (!/^image\//.test(f.type)) { avisar("Elige un archivo de imagen (JPG o PNG)."); return null; }
    limpiarAlerta(alerta);
    try {
      const blob = ext === "png" ? f : await comprimir(f);
      const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext === "png" ? (f.type.split("/")[1] || "png") : "jpg"}`;
      const r = ref(storage, `interventoria-pro/${contrato.id}/informe-${ymCargado}/${nombre}`);
      await uploadBytes(r, blob, { contentType: ext === "png" ? f.type : "image/jpeg" });
      return await getDownloadURL(r);
    } catch (err) {
      avisar(`No se pudo subir ${f.name}: ${errorAmigable(err)}`);
      return null;
    }
  }

  archivo.addEventListener("change", async () => {
    const elegidos = [...archivo.files];
    archivo.value = "";
    let pos = insertarEn ?? bloques.length;
    insertarEn = null;
    for (const f of elegidos) {
      avisar(`Subiendo ${f.name}…`, "ok");
      const url = await subir(f, "jpg");
      if (!url) continue;
      guardarHistorial();
      bloques.splice(pos++, 0, { tipo: "imagen", url, nombre: "", tamano: 85, pieDeFoto: "" });
      limpiarAlerta(alerta);
      pintar();
    }
  });

  const cerrar = () => modal.classList.remove("open");
  document.getElementById("adicionalCerrarBtn").addEventListener("click", cerrar);
  modal.addEventListener("click", (e) => { if (e.target === modal) cerrar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) cerrar(); });

  guardarBtn.addEventListener("click", async () => {
    limpiarAlerta(alerta);
    // Bloques vacíos (párrafo o título sin texto) no se guardan.
    const limpios = bloques
      .filter((b) => {
        if (b.tipo === "imagen") return b.url;
        if (b.tipo === "tabla") return b.filas?.length;
        if (b.tipo === "firma") return b.firmantes?.some((f) => String(f.nombre || "").trim() || f.firmaUrl);
        if (b.tipo === "parrafo") return textoPlanoDesdeHtml(b.texto || "").trim();
        return String(b.texto || "").trim();
      })
      .map((b) => {
        if (b.tipo === "imagen") return { tipo: "imagen", url: b.url, nombre: String(b.nombre || "").trim(), tamano: Number(b.tamano) || 85, pieDeFoto: String(b.pieDeFoto || "").trim() };
        if (b.tipo === "tabla") return sinIndefinidos({ ...b, filas: filasEditables(b.filas).map((f) => ({ celdas: f })) });
        if (b.tipo === "titulo") return { tipo: "titulo", nivel: Math.min(3, Math.max(1, Number(b.nivel) || 1)), texto: String(b.texto).trim() };
        if (b.tipo === "parrafo") return { tipo: "parrafo", rico: true, texto: b.texto };
        return sinIndefinidos({ tipo: "firma", etiqueta: String(b.etiqueta || "").trim(), firmantes: b.firmantes.map((f) => ({ nombre: String(f.nombre || "").trim(), cargo: String(f.cargo || "").trim(), ...(f.firmaUrl ? { firmaUrl: f.firmaUrl, altoFirma: Number(f.altoFirma) || 14 } : {}) })) });
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
    // inicio: numeración del capítulo en el informe (ver numeracionCapitulo
    // en ip-informe.js) para que los títulos sigan desde el último numeral.
    abrir(cap, inicioCap = null) {
      capActual = cap;
      inicio = inicioCap;
      // Copia profunda: si se cancela, lo guardado no queda tocado.
      bloques = (porMes[cap.id] || []).map(normalizar);
      historial = [];
      tituloEl.textContent = `Contenido adicional — ${cap.label}`;
      mesEl.textContent = mesLargo(ymCargado);
      if (!inicio) numEl.textContent = "";
      else if (!inicio.incluido) numEl.textContent = "Este capítulo no tiene secciones marcadas para el informe: márcalo para que este contenido salga. Los números que ves son indicativos.";
      else numEl.textContent = `En el informe este capítulo es el ${inicio.capNum}${inicio.titulos ? ` y ya trae hasta el ${inicio.capNum}.${inicio.titulos}` : ""}: tu «Título 1» sigue como ${inicio.capNum}.${inicio.titulos + 1}, el «Título 2» como ${inicio.capNum}.${inicio.titulos + 1}.1 y el «Título 3» como ${inicio.capNum}.${inicio.titulos + 1}.1.1.`;
      limpiarAlerta(alerta);
      pintar();
      modal.classList.add("open");
    }
  };
}
