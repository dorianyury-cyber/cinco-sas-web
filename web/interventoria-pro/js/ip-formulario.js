// Formulario de un registro a partir de los campos de un módulo
// (ip-modulos.js). Lo usan la página de módulo (modulo.html) y el
// Registro en campo (campo.html), para que ambos pidan y guarden igual.
import { esc, mesCorto, mesesDelContrato } from "./ip-core.js";

export function frentesContrato(contrato) {
  return String(contrato?.frentes || "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
}

function opcionesPersona(personal, valor) {
  const personas = [...(personal || [])].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
  return `<option value="">— Elige —</option>` + personas.map((p) => `<option value="${p.id}" ${p.id === valor ? "selected" : ""}>${esc(p.nombre)}${p.estado === "Retirado" ? " (retirado)" : ""}</option>`).join("");
}

// camara: en el celular ofrece "Tomar foto" (abre la cámara) además de
// elegir una de la galería.
export function htmlCampo(c, valor, { contrato, personal = [], camara = false } = {}) {
  const id = `f_${c.key}`;
  const req = c.required ? "required" : "";
  const v = valor ?? "";
  let control;
  switch (c.type) {
    case "textarea": control = `<textarea id="${id}" rows="${c.filas || 3}" ${req} placeholder="${esc(c.placeholder || "")}">${esc(v)}</textarea>`; break;
    case "select": {
      const ops = c.opcionesObj || c.opciones.map((o) => ({ valor: o, texto: o }));
      // Un valor guardado que ya no está en la lista (ej. una opción
      // renombrada) se conserva para no perderlo al editar.
      if (v && !ops.some((o) => o.valor === v)) ops.push({ valor: v, texto: v });
      control = `<select id="${id}" ${req}><option value="">— Elige —</option>${ops.map((o) => `<option value="${esc(o.valor)}" ${o.valor === v ? "selected" : ""}>${esc(o.texto)}</option>`).join("")}</select>`;
      break;
    }
    case "frente": {
      // Proyectos / frentes del contrato (Información del contrato), más
      // "General" para lo que aplica a todo el contrato.
      const frentes = ["General", ...frentesContrato(contrato)];
      if (v && !frentes.includes(v)) frentes.push(v);
      control = `<select id="${id}" ${req}><option value="">— Elige —</option>${frentes.map((fr) => `<option value="${esc(fr)}" ${fr === v ? "selected" : ""}>${esc(fr)}</option>`).join("")}</select>`;
      break;
    }
    case "persona":
      control = (personal || []).length
        ? `<select id="${id}" ${req}>${opcionesPersona(personal, v)}</select>`
        : `<p class="text-muted ip-sin-margen">Primero registra el personal en <a href="modulo.html?m=personal">Listado de personal</a>.</p>`;
      break;
    case "money": control = `<input type="number" id="${id}" step="1" min="0" value="${esc(v)}" ${req} placeholder="0" inputmode="numeric">`; break;
    case "pct": control = `<input type="number" id="${id}" step="0.1" min="0" max="100" value="${esc(v)}" ${req} inputmode="decimal">`; break;
    case "number": control = `<input type="number" id="${id}" step="any" value="${esc(v)}" ${req} inputmode="decimal">`; break;
    case "date": control = `<input type="date" id="${id}" value="${esc(v)}" ${req}>`; break;
    case "month": control = `<input type="month" id="${id}" value="${esc(v)}" ${req}>`; break;
    case "url": control = `<input type="url" id="${id}" value="${esc(v)}" ${req} placeholder="https://…">`; break;
    // Fotos: dos botones con dos <input> distintos (mismo patrón de
    // Copropiedad Saludable): el de cámara lleva capture="environment" y
    // abre la cámara del celular; el de galería NO lo lleva (con capture,
    // Android a veces esconde la galería) y en "fotos" permite elegir
    // varias. En el computador ambos abren el selector de archivos.
    // Registro nuevo con foto (ej. Registro fotográfico): se acumulan hasta
    // MAX_FOTOS y al guardar cada foto queda como su propio registro.
    // Al editar uno existente se reemplaza su única foto.
    case "imagen":
      if (!v) {
        control = `<div class="ip-foto-botones">
          <label class="btn ip-foto-boton">📷 Tomar foto<input type="file" accept="image/*" capture="environment" data-fotos-de="${c.key}" class="ip-oculto"></label>
          <label class="btn secondary ip-foto-boton">🖼️ Elegir de galería<input type="file" accept="image/*" multiple data-fotos-de="${c.key}" class="ip-oculto"></label>
        </div>
        <div class="ip-fotos-prev" id="${id}_prev"></div>
        <p class="text-muted ip-ayuda">Puedes tomar o elegir varias (hasta ${MAX_FOTOS}); se van sumando. Cada foto se guarda como un registro con la misma fecha y observación.</p>`;
        break;
      }
      control = `<div class="ip-foto-botones">
          <label class="btn ip-foto-boton">📷 Tomar foto<input type="file" accept="image/*" capture="environment" data-foto-de="${c.key}" class="ip-oculto"></label>
          <label class="btn secondary ip-foto-boton">🖼️ Elegir de galería<input type="file" accept="image/*" data-foto-de="${c.key}" class="ip-oculto"></label>
        </div>
        <input type="hidden" id="${id}">
        <img id="${id}_prev" class="ip-foto-prev ${v ? "" : "hidden"}" src="${esc(v)}" alt="">`;
      break;
    // Documentos PDF adjuntos (pólizas, actas, contratos firmados…).
    case "documentos":
      control = `<div class="ip-foto-botones">
          <label class="btn ip-foto-boton">📎 Adjuntar PDF<input type="file" accept="application/pdf,.pdf" multiple data-docs-de="${c.key}" class="ip-oculto"></label>
        </div>
        <div class="ip-docs-lista" id="${id}_lista"></div>`;
      break;
    case "fotos":
      control = `<div class="ip-foto-botones">
          <label class="btn ip-foto-boton">📷 Tomar foto<input type="file" accept="image/*" capture="environment" data-fotos-de="${c.key}" class="ip-oculto"></label>
          <label class="btn secondary ip-foto-boton">🖼️ Elegir de galería<input type="file" accept="image/*" multiple data-fotos-de="${c.key}" class="ip-oculto"></label>
        </div>
        <div class="ip-fotos-prev" id="${id}_prev"></div>`;
      break;
    case "avance": {
      const meses = mesesDelContrato(contrato);
      control = `<div class="ip-avance-grid">${meses.map((ym) => `
        <label class="ip-avance-mes"><span>${mesCorto(ym)}</span>
          <input type="number" min="0" max="100" step="0.1" data-avance-mes="${ym}" value="${esc(v?.[ym] ?? "")}"></label>`).join("")}</div>`;
      break;
    }
    default: control = `<input type="text" id="${id}" value="${esc(v)}" ${req} placeholder="${esc(c.placeholder || "")}">`;
  }
  return `<div class="ip-campo ${c.ancho || ["textarea", "avance", "imagen", "fotos", "documentos"].includes(c.type) ? "ip-campo-ancho" : ""}">
    <label for="${id}">${esc(c.label)}${c.required ? " *" : ""}</label>${control}
    ${c.ayuda ? `<p class="text-muted ip-ayuda">${esc(c.ayuda)}</p>` : ""}</div>`;
}

export const MAX_FOTOS = 6;

// Maneja los campos de foto de un formulario ya pintado: comprime cada
// foto al elegirla (como en Copropiedad Saludable: así nunca se guarda ni
// se previsualiza una foto pesada), muestra miniaturas y deja quitar
// fotos. registro = el registro que se edita (para las fotos ya subidas).
export function controlFotos(contenedor, campos, registro = null) {
  const unica = {};   // imagen al editar: key -> Blob comprimido (reemplaza la foto)
  const fotos = {};   // fotos (y imagen de un registro nuevo): key -> { conservadas: [{url, ruta}], nuevas: [Blob] }
  campos.filter((c) => c.type === "fotos").forEach((c) => {
    fotos[c.key] = { conservadas: Array.isArray(registro?.[c.key]) ? [...registro[c.key]] : [], nuevas: [] };
  });
  // Imagen de un registro nuevo: lista acumulable (una foto = un registro).
  const imagenesNuevas = campos.filter((c) => c.type === "imagen" && !registro?.[c.key]).map((c) => c.key);
  imagenesNuevas.forEach((k) => { fotos[k] = { conservadas: [], nuevas: [] }; });

  function pintarFotos(key) {
    const el = contenedor.querySelector(`#f_${key}_prev`);
    if (!el) return;
    const f = fotos[key];
    const total = f.conservadas.length + f.nuevas.length;
    el.innerHTML = [
      ...f.conservadas.map((x, i) => `<div class="ip-fotos-item"><a href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.url)}" alt=""></a><button type="button" data-quitar="c${i}" title="Quitar foto">✕</button></div>`),
      ...f.nuevas.map((b, i) => `<div class="ip-fotos-item ip-fotos-nueva"><img data-nueva="${i}" alt=""><button type="button" data-quitar="n${i}" title="Quitar foto">✕</button></div>`)
    ].join("") + `<span class="text-muted ip-fotos-cuenta">${total ? `${total} de ${MAX_FOTOS} foto(s)` : `Sin fotos (máx. ${MAX_FOTOS}). Se comprimen solas antes de subir.`}</span>`;
    el.querySelectorAll("img[data-nueva]").forEach((img) => { img.src = URL.createObjectURL(f.nuevas[Number(img.dataset.nueva)]); });
    el.querySelectorAll("[data-quitar]").forEach((b) => b.addEventListener("click", () => {
      const tipo = b.dataset.quitar[0], i = Number(b.dataset.quitar.slice(1));
      if (tipo === "c") f.conservadas.splice(i, 1); else f.nuevas.splice(i, 1);
      pintarFotos(key);
    }));
  }
  Object.keys(fotos).forEach(pintarFotos);

  // Cada selección SUMA a las anteriores (nunca las reemplaza). Los archivos
  // se copian antes de limpiar el campo, para poder volver a abrir la
  // cámara o la galería y elegir otra.
  contenedor.querySelectorAll("[data-fotos-de]").forEach((inp) => inp.addEventListener("change", async () => {
    const key = inp.dataset.fotosDe;
    const f = fotos[key];
    const archivos = [...inp.files];
    inp.value = "";
    const libres = MAX_FOTOS - f.conservadas.length - f.nuevas.length;
    const elegidas = archivos.slice(0, Math.max(0, libres));
    if (archivos.length > elegidas.length) alert(`Máximo ${MAX_FOTOS} fotos por registro: ${elegidas.length ? `se agregaron ${elegidas.length}` : "ya están completas"}.`);
    for (const archivo of elegidas) {
      f.nuevas.push(await comprimir(archivo));
      pintarFotos(key);
    }
  }));
  contenedor.querySelectorAll("[data-foto-de]").forEach((inp) => inp.addEventListener("change", async () => {
    const archivo = inp.files[0];
    if (!archivo) return;
    const key = inp.dataset.fotoDe;
    unica[key] = await comprimir(archivo);
    inp.value = "";
    const prev = contenedor.querySelector(`#f_${key}_prev`);
    prev.src = URL.createObjectURL(unica[key]);
    prev.classList.remove("hidden");
  }));

  return {
    // Foto que reemplaza la de un registro que se edita.
    archivo: (key) => unica[key] || null,
    // Fotos acumuladas de un registro nuevo (una por registro al guardar).
    archivos: (key) => (imagenesNuevas.includes(key) ? [...fotos[key].nuevas] : unica[key] ? [unica[key]] : []),
    fotos: (key) => fotos[key] || { conservadas: [], nuevas: [] },
    // Solo los campos "fotos" (lista dentro del mismo registro).
    camposFotos: () => Object.keys(fotos).filter((k) => !imagenesNuevas.includes(k))
  };
}

// ------------------------------------------------------------ documentos PDF
export const MAX_DOCS = 10;
export const MAX_MB_DOC = 20;
const tamano = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Visor de PDF en la misma página (blob en un iframe, permitido por la
// política del sitio). Si el archivo no se puede descargar para mostrarlo
// (ej. sin conexión), se abre en una pestaña nueva.
export async function verPdf(fuente, nombre = "Documento") {
  let url;
  try {
    const blob = fuente instanceof Blob ? fuente : await (await fetch(fuente)).blob();
    url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  } catch (err) {
    window.open(fuente, "_blank", "noopener");
    return;
  }
  const fondo = document.createElement("div");
  fondo.className = "modal-backdrop open ip-visor-fondo";
  fondo.innerHTML = `<div class="modal ip-modal-ancho ip-visor-modal ip-visor-pdf" role="dialog" aria-label="${esc(nombre)}">
    <h2>📄 ${esc(nombre)}</h2>
    <iframe title="${esc(nombre)}"></iframe>
    <div class="ip-form-acciones ip-visor-acciones">
      <a class="btn" download="${esc(nombre.endsWith(".pdf") ? nombre : `${nombre}.pdf`)}">⬇ Descargar</a>
      <button type="button" class="btn secondary">Cerrar</button>
    </div></div>`;
  fondo.querySelector("iframe").src = url;
  fondo.querySelector("a[download]").href = url;
  document.body.appendChild(fondo);
  const cerrar = () => { fondo.remove(); URL.revokeObjectURL(url); };
  fondo.querySelector("button").addEventListener("click", cerrar);
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
}

// Maneja los campos "documentos" de un formulario ya pintado: lista con los
// ya subidos (ver / quitar) y los nuevos por subir (solo PDF, máx.
// MAX_DOCS por registro y MAX_MB_DOC MB cada uno).
export function controlDocumentos(contenedor, campos, registro = null) {
  const docs = {};
  campos.filter((c) => c.type === "documentos").forEach((c) => {
    docs[c.key] = { conservados: Array.isArray(registro?.[c.key]) ? [...registro[c.key]] : [], nuevos: [] };
  });
  function pintar(key) {
    const el = contenedor.querySelector(`#f_${key}_lista`);
    if (!el) return;
    const d = docs[key];
    const fila = (nombre, peso, idx, nuevo) => `<div class="ip-doc-item${nuevo ? " ip-doc-nuevo" : ""}">
      <span class="ip-doc-nombre">📄 ${esc(nombre)} <span class="text-muted">${peso ? tamano(peso) : ""}${nuevo ? " · por subir" : ""}</span></span>
      <button type="button" class="ip-doc-ver" data-ver="${idx}">👁 Ver</button>
      <button type="button" class="ip-doc-quitar" data-quitar="${idx}" title="Quitar documento">✕</button></div>`;
    el.innerHTML = [
      ...d.conservados.map((x, i) => fila(x.nombre, x.tamano, `c${i}`, false)),
      ...d.nuevos.map((x, i) => fila(x.name, x.size, `n${i}`, true))
    ].join("") || `<span class="text-muted ip-fotos-cuenta">Sin documentos (PDF, máx. ${MAX_DOCS}, hasta ${MAX_MB_DOC} MB cada uno).</span>`;
    const pos = (v) => ({ tipo: v[0], i: Number(v.slice(1)) });
    el.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => {
      const { tipo, i } = pos(b.dataset.ver);
      if (tipo === "c") verPdf(d.conservados[i].url, d.conservados[i].nombre); else verPdf(d.nuevos[i], d.nuevos[i].name);
    }));
    el.querySelectorAll("[data-quitar]").forEach((b) => b.addEventListener("click", () => {
      const { tipo, i } = pos(b.dataset.quitar);
      if (tipo === "c") d.conservados.splice(i, 1); else d.nuevos.splice(i, 1);
      pintar(key);
    }));
  }
  Object.keys(docs).forEach(pintar);
  contenedor.querySelectorAll("[data-docs-de]").forEach((inp) => inp.addEventListener("change", () => {
    const key = inp.dataset.docsDe;
    const d = docs[key];
    const archivos = [...inp.files];
    inp.value = "";
    const rechazados = [];
    for (const a of archivos) {
      const esPdf = a.type === "application/pdf" || /\.pdf$/i.test(a.name);
      if (!esPdf) { rechazados.push(`${a.name}: no es PDF`); continue; }
      if (a.size > MAX_MB_DOC * 1048576) { rechazados.push(`${a.name}: pesa más de ${MAX_MB_DOC} MB`); continue; }
      if (d.conservados.length + d.nuevos.length >= MAX_DOCS) { rechazados.push(`${a.name}: ya hay ${MAX_DOCS} documentos`); continue; }
      d.nuevos.push(a);
    }
    if (rechazados.length) alert(`No se agregaron:\n${rechazados.join("\n")}`);
    pintar(key);
  }));
  return {
    docs: (key) => docs[key] || { conservados: [], nuevos: [] },
    camposDocs: () => Object.keys(docs)
  };
}

export function leerFormulario(campos, contenedor) {
  const datos = {};
  for (const c of campos) {
    if (c.type === "imagen" || c.type === "fotos" || c.type === "documentos") continue;
    if (c.type === "avance") {
      const mapa = {};
      contenedor.querySelectorAll("[data-avance-mes]").forEach((inp) => {
        if (inp.value !== "") mapa[inp.dataset.avanceMes] = Math.min(100, Math.max(0, Number(inp.value)));
      });
      datos[c.key] = mapa;
      continue;
    }
    const el = contenedor.querySelector(`#f_${c.key}`);
    if (!el) continue;
    let v = el.value.trim();
    if (["money", "number", "pct"].includes(c.type)) v = v === "" ? null : Number(v);
    datos[c.key] = v;
  }
  return datos;
}

// Foto comprimida antes de subir (máx. 1600 px, JPEG 0.8): una foto de
// celular pesa varios MB y no hace falta para el informe.
export function comprimir(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * escala);
      canvas.height = Math.round(img.naturalHeight * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.8);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
