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
    case "imagen":
      control = `<div class="ip-foto-botones">
          <label class="btn ip-foto-boton">📷 Tomar foto<input type="file" accept="image/*" capture="environment" data-foto-de="${c.key}" class="ip-oculto"></label>
          <label class="btn secondary ip-foto-boton">🖼️ Elegir de galería<input type="file" accept="image/*" data-foto-de="${c.key}" class="ip-oculto"></label>
        </div>
        <input type="hidden" id="${id}">
        <img id="${id}_prev" class="ip-foto-prev ${v ? "" : "hidden"}" src="${esc(v)}" alt="">`;
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
  return `<div class="ip-campo ${c.ancho || ["textarea", "avance", "imagen", "fotos"].includes(c.type) ? "ip-campo-ancho" : ""}">
    <label for="${id}">${esc(c.label)}${c.required ? " *" : ""}</label>${control}
    ${c.ayuda ? `<p class="text-muted ip-ayuda">${esc(c.ayuda)}</p>` : ""}</div>`;
}

export const MAX_FOTOS = 6;

// Maneja los campos de foto de un formulario ya pintado: comprime cada
// foto al elegirla (como en Copropiedad Saludable: así nunca se guarda ni
// se previsualiza una foto pesada), muestra miniaturas y deja quitar
// fotos. registro = el registro que se edita (para las fotos ya subidas).
export function controlFotos(contenedor, campos, registro = null) {
  const unica = {};   // imagen: key -> Blob comprimido
  const fotos = {};   // fotos: key -> { conservadas: [{url, ruta}], nuevas: [Blob] }
  campos.filter((c) => c.type === "fotos").forEach((c) => {
    fotos[c.key] = { conservadas: Array.isArray(registro?.[c.key]) ? [...registro[c.key]] : [], nuevas: [] };
  });

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

  contenedor.querySelectorAll("[data-fotos-de]").forEach((inp) => inp.addEventListener("change", async () => {
    const key = inp.dataset.fotosDe;
    const f = fotos[key];
    const libres = MAX_FOTOS - f.conservadas.length - f.nuevas.length;
    const elegidas = [...inp.files].slice(0, Math.max(0, libres));
    if (inp.files.length > elegidas.length) alert(`Máximo ${MAX_FOTOS} fotos por registro: se agregaron ${elegidas.length}.`);
    for (const archivo of elegidas) f.nuevas.push(await comprimir(archivo));
    inp.value = "";
    pintarFotos(key);
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
    archivo: (key) => unica[key] || null,
    fotos: (key) => fotos[key] || { conservadas: [], nuevas: [] },
    camposFotos: () => Object.keys(fotos)
  };
}

export function leerFormulario(campos, contenedor) {
  const datos = {};
  for (const c of campos) {
    if (c.type === "imagen" || c.type === "fotos") continue;
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
