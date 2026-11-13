// Editor de tablas del editor de bloques (Informes de Cinco SAS y el
// "Contenido adicional" del informe mensual de Interventoría PRO): cuadrícula
// de celdas con filas/columnas, vaciar, pegar desde Excel/Word, combinar y
// separar celdas, centrar/izquierda/arriba, negrilla, color de letra y listas
// desplegables por columna. Sacado tal cual de informes.js para compartirlo.
// Quien lo usa le pasa tres funciones:
//   antesDeCambiar() — guarda el estado para «Deshacer» (opcional)
//   alCambiar()      — vuelve a dibujar los bloques
//   avisar(texto, tipo) — muestra un aviso ("error" / "ok")
import {
  normalizarMerges, celdaCombinada, expandirRangoConMerges, quitarMergesQueIntersectan,
  celdaCentrada, normalizarCentrados, centrarRango, alinearIzquierdaRango, anchosColumnaEditor,
  redimensionarFilas, celdaNegrita, normalizarNegritas, negritaRango, quitarNegritaRango,
  colorCelda, normalizarColoresCelda, colorearRango, normalizarOpcionesColumna,
  insertarFilaEnBloque, eliminarFilaEnBloque, filasEncabezadoAutomatico,
  celdaCentradaVertical, normalizarCentradosVertical, centrarVerticalRango, alinearArribaRango,
  anchosManuales, fijarAnchoColumna
} from "./tabla-celdas.js";
import { tablaDesdeHtml } from "./tabla-pegar-html.js";

export { tablaDesdeHtml };

// Bloque "tabla" nuevo a partir del HTML de una tabla copiada de Word/Excel
// (para pegarla dentro de un párrafo: el editor la vuelve un bloque Tabla).
export function tablaNuevaDesdeHtml(html) {
  const t = tablaDesdeHtml(html);
  if (!t) return null;
  const { anchosColumna, ...resto } = t;
  return { ...nuevaTabla(), ...resto, ...(anchosColumna ? { anchosColumna } : {}) };
}

const tablaVacia = (bloque) => bloque.filas.every((f) => f.every((v) => !String(v || "").trim()));

// Pega la tabla de Word/Excel (ya leída de su HTML) desde la celda fi, ci:
// celdas combinadas, saltos de línea dentro de la celda, negrilla, centrado,
// color y, si la tabla estaba vacía o se pega desde la primera columna
// cubriéndola toda, también el ancho de las columnas.
function pegarHtmlEnTabla(bloque, filaInicio, colInicio, t) {
  guardarHistorialBloques();
  if (tablaVacia(bloque)) { filaInicio = 0; colInicio = 0; bloque.filas = [[""]]; bloque.merges = []; bloque.centrados = []; bloque.centradosVertical = []; bloque.negritas = []; bloque.coloresCelda = []; bloque.filasEncabezado = t.filasEncabezado; }
  const nf = t.filas.length, nc = t.filas[0].length;
  const colsNecesarias = colInicio + nc, filasNecesarias = filaInicio + nf;
  const anchoActual = Math.max(...bloque.filas.map((f) => f.length));
  bloque.filas.forEach((fila) => { while (fila.length < Math.max(colsNecesarias, anchoActual)) fila.push(""); });
  while (bloque.filas.length < filasNecesarias) bloque.filas.push(bloque.filas[0].map(() => ""));
  const fMax = filaInicio + nf - 1, cMax = colInicio + nc - 1;
  const fuera = (c) => !(c.fila >= filaInicio && c.fila <= fMax && c.col >= colInicio && c.col <= cMax);
  const mover = (c) => ({ ...c, fila: c.fila + filaInicio, col: c.col + colInicio });
  bloque.merges = [...quitarMergesQueIntersectan(bloque.merges || [], filaInicio, fMax, colInicio, cMax), ...t.merges.map(mover)];
  bloque.centrados = [...(bloque.centrados || []).filter(fuera), ...t.centrados.map(mover)];
  bloque.centradosVertical = [...(bloque.centradosVertical || []).filter(fuera), ...t.centradosVertical.map(mover)];
  bloque.negritas = [...(bloque.negritas || []).filter(fuera), ...t.negritas.map(mover)];
  bloque.coloresCelda = [...(bloque.coloresCelda || []).filter(fuera), ...t.coloresCelda.map(mover)];
  t.filas.forEach((fila, fi) => fila.forEach((v, ci) => { bloque.filas[filaInicio + fi][colInicio + ci] = v; }));
  if (t.anchosColumna && colInicio === 0 && bloque.filas[0].length === nc) bloque.anchosColumna = t.anchosColumna;
  bloque._selA = null;
  bloque._selB = null;
  renderBloques();
  mostrarAlerta(`Tabla pegada: ${nf} fila(s) × ${nc} columna(s)${t.merges.length ? `, ${t.merges.length} celda(s) combinada(s)` : ""}.`, "ok");
}

// ¿El HTML del portapapeles es una tabla de verdad (más de una celda)?
function tablaPegable(html) {
  const t = tablaDesdeHtml(html);
  return t && (t.filas.length > 1 || t.filas[0].length > 1) ? t : null;
}

let ctx = { antesDeCambiar: () => {}, alCambiar: () => {}, avisar: () => {} };
const guardarHistorialBloques = () => ctx.antesDeCambiar();
const renderBloques = () => ctx.alCambiar();
const mostrarAlerta = (texto, tipo) => ctx.avisar(texto, tipo);

export function crearEditorTabla(bloque, { antesDeCambiar = () => {}, alCambiar, avisar = () => {} }) {
  ctx = { antesDeCambiar, alCambiar, avisar };
  return renderTablaEditor(bloque);
}

export function nuevaTabla() {
  return { tipo: "tabla", titulo: "", nota: "", filas: [["", ""], ["", ""]], merges: [], centrados: [], filasEncabezado: 1 };
}

function pegarEnTabla(bloque, filaInicio, colInicio, texto) {
  const filas = texto.replace(/\r/g, "").split("\n");
  while (filas.length > 1 && filas[filas.length - 1] === "") filas.pop();
  const datos = filas.map((fila) => fila.split("\t"));

  guardarHistorialBloques();
  const colsNecesarias = colInicio + Math.max(...datos.map((f) => f.length));
  const filasNecesarias = filaInicio + datos.length;
  while (bloque.filas[0].length < colsNecesarias) bloque.filas.forEach((fila) => fila.push(""));
  while (bloque.filas.length < filasNecesarias) bloque.filas.push(bloque.filas[0].map(() => ""));

  // Los datos pegados ya no respetan ninguna combinación previa que caiga
  // dentro del rango que se va a sobrescribir.
  bloque.merges = quitarMergesQueIntersectan(
    bloque.merges || [], filaInicio, filaInicio + datos.length - 1, colInicio, colsNecesarias - 1
  );

  datos.forEach((fila, fi) => {
    fila.forEach((valor, ci) => { bloque.filas[filaInicio + fi][colInicio + ci] = valor; });
  });
  renderBloques();
}

function rangoOrdenado(a, b) {
  return { fMin: Math.min(a.fi, b.fi), fMax: Math.max(a.fi, b.fi), cMin: Math.min(a.ci, b.ci), cMax: Math.max(a.ci, b.ci) };
}

// Editor de una tabla: cuadrícula de <input>, con botones para agregar o
// quitar filas/columnas. Se construye de cero en cada render (más simple
// que sincronizar un DOM parcial) — no pesa porque las tablas de un
// informe son de tamaño moderado, no miles de filas.
function renderTablaEditor(bloque) {
  const cont = document.createElement("div");
  cont.className = "control-tabla-editor";

  const tituloInput = document.createElement("input");
  tituloInput.type = "text";
  tituloInput.maxLength = 200;
  tituloInput.placeholder = "Título de la tabla (aparece arriba, centrado, y en la Lista de tablas)";
  tituloInput.value = bloque.titulo || "";
  tituloInput.addEventListener("input", () => { bloque.titulo = tituloInput.value; });
  cont.appendChild(tituloInput);

  // Una tabla pegada desde Excel/Word puede llegar "dispareja" (una fila
  // con menos celdas que las demás, típicamente porque el origen tenía una
  // celda ya combinada) — se completa a un rectángulo parejo con celdas
  // vacías antes de seguir. Si no, "+ Fila"/"+ Columna" (que se basan en el
  // ancho de la fila 0) heredaban ese ancho corto y agregaban filas/columnas
  // incompletas.
  const numFilas = bloque.filas.length;
  const numCols = Math.max(...bloque.filas.map((f) => f.length));
  bloque.filas.forEach((fila) => { while (fila.length < numCols) fila.push(""); });
  bloque.merges = normalizarMerges(bloque.merges || [], numFilas, numCols);
  bloque.centrados = normalizarCentrados(bloque.centrados || [], numFilas, numCols);
  bloque.centradosVertical = normalizarCentradosVertical(bloque.centradosVertical || [], numFilas, numCols);
  bloque.negritas = normalizarNegritas(bloque.negritas || [], numFilas, numCols);
  bloque.coloresCelda = normalizarColoresCelda(bloque.coloresCelda || [], numFilas, numCols);
  bloque.opcionesColumna = normalizarOpcionesColumna(bloque.opcionesColumna || {}, numCols);

  // Tamaño directo: para tablas grandes es más rápido escribir "12 filas,
  // 9 columnas" de una vez que hacer clic en +Fila/+Columna una por una.
  const tamanoDiv = document.createElement("div");
  tamanoDiv.className = "control-tabla-tamano";
  const filasSizeInput = document.createElement("input");
  filasSizeInput.type = "number";
  filasSizeInput.min = "1";
  filasSizeInput.value = numFilas;
  const colsSizeInput = document.createElement("input");
  colsSizeInput.type = "number";
  colsSizeInput.min = "1";
  colsSizeInput.value = numCols;
  const labelFilas = document.createElement("label");
  labelFilas.textContent = "Filas";
  labelFilas.appendChild(filasSizeInput);
  const labelCols = document.createElement("label");
  labelCols.textContent = "Columnas";
  labelCols.appendChild(colsSizeInput);
  const tamanoBtn = document.createElement("button");
  tamanoBtn.type = "button";
  tamanoBtn.className = "control-btn-mini";
  tamanoBtn.textContent = "↕ Cambiar tamaño";
  tamanoBtn.title = "Ajusta la tabla al número de filas y columnas escrito (agrega vacías o quita desde el final)";
  tamanoBtn.addEventListener("click", () => {
    const nf = Math.max(1, parseInt(filasSizeInput.value, 10) || numFilas);
    const nc = Math.max(1, parseInt(colsSizeInput.value, 10) || numCols);
    if (nf === numFilas && nc === numCols) return;
    guardarHistorialBloques();
    redimensionarFilas(bloque.filas, nf, nc);
    renderBloques();
  });
  tamanoDiv.append(labelFilas, labelCols, tamanoBtn);
  cont.appendChild(tamanoDiv);

  // Cuántas filas desde arriba son "encabezado": se repiten al principio
  // de cada página nueva en la que siga la tabla (PDF y Word), no solo la
  // fila 0 — para encabezados de dos filas como "Memorias de cálculo"
  // combinada arriba de "Pág. inicial"/"Pág. final". El estilo (fondo
  // gris, negrilla) sigue siendo solo el de la fila 0, esto solo controla
  // cuántas se repiten. Se detecta solo en cuanto combinas celdas en la
  // fila 0 (ver filasEncabezadoAutomatico) — este campo solo hace falta
  // tocarlo si el cálculo automático no da lo que necesitas.
  const encabezadoDiv = document.createElement("div");
  encabezadoDiv.className = "control-tabla-tamano";
  const encabezadoInput = document.createElement("input");
  encabezadoInput.type = "number";
  encabezadoInput.min = "1";
  encabezadoInput.max = String(Math.max(1, numFilas - 1));
  encabezadoInput.value = bloque.filasEncabezado || filasEncabezadoAutomatico(numFilas, bloque.merges);
  encabezadoInput.title = "Se calcula solo según si la fila 0 tiene columnas combinadas — cámbialo aquí solo si necesitas forzar otro número";
  encabezadoInput.addEventListener("input", () => {
    const valor = Math.max(1, Math.min(parseInt(encabezadoInput.value, 10) || 1, Math.max(1, numFilas - 1)));
    bloque.filasEncabezado = valor;
  });
  const labelEncabezado = document.createElement("label");
  labelEncabezado.textContent = "Filas de encabezado";
  labelEncabezado.appendChild(encabezadoInput);
  encabezadoDiv.appendChild(labelEncabezado);
  cont.appendChild(encabezadoDiv);

  const grid = document.createElement("div");
  grid.className = "control-tabla-grid";
  // Ancho de columna proporcional a su contenido (no partes iguales) —
  // mismo criterio que el PDF/Word, ver anchosColumnaEditor.
  // Si se fijó el ancho a mano («Ancho de columnas»), ese reparto manda.
  const pesosCol = anchosColumnaEditor(bloque.filas, bloque.merges, numFilas, numCols);
  const manuales = anchosManuales(bloque, numCols);
  // Con muchas columnas (ej. ítem + actividad + 12 meses) el mínimo de 90 px
  // mandaba las últimas (DIC) fuera de la vista, detrás de un desplazamiento
  // horizontal que no se notaba, y parecía que la tabla llegaba solo hasta
  // NOV (Nataly, 2026-11-13): el mínimo baja según cuántas columnas hay.
  const minimoCol = numCols > 12 ? 50 : numCols > 8 ? 64 : 90;
  grid.style.gridTemplateColumns = (manuales || pesosCol).map((p) => `minmax(${minimoCol}px, ${p}fr)`).join(" ");
  grid.classList.toggle("control-tabla-grid-densa", numCols > 8);

  // Barra flotante — aparece pegada a la última celda seleccionada con las
  // acciones más usadas (negrilla, alinear, combinar), para no tener que
  // bajar hasta la barra fija de abajo cada vez ("así como en Excel"). Sus
  // botones se llenan más abajo, una vez que negritaBtn/combinarBtn/etc. ya
  // existen — solo repiten el clic de esos mismos botones.
  const flotante = document.createElement("div");
  flotante.className = "control-tabla-flotante inactiva";
  flotante.title = "Selecciona (arrastra sobre) las celdas y usa estos botones";
  cont.appendChild(flotante);

  // Pinta el rango [bloque._selA.._selB] (si hay uno activo) como
  // seleccionado — se llama tras cada clic/arrastre sin re-renderizar toda
  // la cuadrícula, para no perder el foco mientras se arrastra.
  function actualizarResaltado() {
    const rango = bloque._selA && bloque._selB ? rangoOrdenado(bloque._selA, bloque._selB) : null;
    grid.querySelectorAll("input, select, textarea").forEach((campo) => {
      const fi = Number(campo.dataset.fi);
      const ci = Number(campo.dataset.ci);
      const sel = !!rango && fi >= rango.fMin && fi <= rango.fMax && ci >= rango.cMin && ci <= rango.cMax;
      campo.classList.toggle("control-celda-sel", sel);
    });
    // La barra ya no flota junto a la celda (tapaba el texto que se estaba
    // leyendo): queda fija encima de la cuadrícula y solo se atenúa cuando
    // no hay celdas seleccionadas.
    flotante.classList.toggle("inactiva", !rango);
  }

  bloque.filas.forEach((fila, fi) => {
    fila.forEach((celda, ci) => {
      const info = celdaCombinada(bloque.merges, fi, ci);
      if (info && !info.esAncla) return; // celda cubierta por un rango combinado: no se dibuja

      // Una columna con opciones definidas (ver botón "☰ Opciones") se edita
      // con un <select> en el cuerpo — la fila 0 (encabezado) siempre es
      // texto libre, aunque su columna tenga opciones.
      const opciones = fi > 0 ? bloque.opcionesColumna[ci] : null;
      const celdaInput = document.createElement(opciones ? "select" : "textarea");
      if (opciones) {
        [["", "—"], ...opciones.map((o) => [o, o])].forEach(([valor, texto]) => {
          const opt = document.createElement("option");
          opt.value = valor;
          opt.textContent = texto;
          celdaInput.appendChild(opt);
        });
        celdaInput.value = celda;
        celdaInput.addEventListener("change", () => { bloque.filas[fi][ci] = celdaInput.value; });
      } else {
        celdaInput.rows = 1;
        // 300 caracteres no alcanzaban para una celda de hallazgo o de acción
        // requerida (las importadas ya traían más, y al editarlas se cortaban).
        celdaInput.maxLength = 1500;
        celdaInput.value = celda;
        celdaInput.placeholder = fi === 0 ? `Columna ${ci + 1}` : "";
        const autoAltura = () => { celdaInput.style.height = "auto"; celdaInput.style.height = `${celdaInput.scrollHeight}px`; };
        celdaInput.addEventListener("input", () => { bloque.filas[fi][ci] = celdaInput.value; autoAltura(); });
        setTimeout(autoAltura, 0);
        // Un salto de línea escrito o pegado DENTRO de una celda se queda en
        // esa misma celda (el textarea ya lo permite de por sí) — solo un
        // TAB en el texto pegado señala de verdad un rango de Excel de
        // varias columnas, así que solo ESE caso se reparte en celdas
        // nuevas. Antes cualquier salto de línea pegado (ej. un párrafo
        // copiado de Word) se repartía como si fueran filas nuevas, sin
        // forma de pegarlo tal cual en una sola celda.
        celdaInput.addEventListener("paste", (e) => {
          // Tabla copiada de Word/Excel: se lee su HTML para conservar
          // combinadas, saltos de línea en la celda, negrilla, centrado y anchos.
          const t = tablaPegable(e.clipboardData?.getData("text/html") || "");
          if (t) { e.preventDefault(); pegarHtmlEnTabla(bloque, fi, ci, t); return; }
          const texto = e.clipboardData?.getData("text/plain") ?? "";
          if (texto.includes("\t")) { e.preventDefault(); pegarEnTabla(bloque, fi, ci, texto); }
        });
      }
      celdaInput.dataset.fi = fi;
      celdaInput.dataset.ci = ci;
      celdaInput.style.gridColumn = info ? `${ci + 1} / span ${info.merge.cols}` : `${ci + 1}`;
      celdaInput.style.gridRow = info ? `${fi + 1} / span ${info.merge.filas}` : `${fi + 1}`;
      celdaInput.style.textAlign = celdaCentrada(bloque.centrados, fi, ci) ? "center" : "left";
      // Centrado vertical (en el PDF/Word, el texto en la mitad del alto de la fila).
      celdaInput.style.alignSelf = celdaCentradaVertical(bloque.centradosVertical, fi, ci) ? "center" : "start";
      if (celdaNegrita(bloque.negritas, fi, ci)) celdaInput.style.fontWeight = "700";
      const colorTexto = colorCelda(bloque.coloresCelda, fi, ci);
      if (colorTexto) celdaInput.style.color = colorTexto;
      // Recuerda dónde estaba el cursor para que el botón "Pegar tabla"
      // sepa dónde empezar si el pegado no se hizo directo sobre una celda.
      celdaInput.addEventListener("focus", () => { bloque._filaFoco = fi; bloque._colFoco = ci; });
      // Selección de un rango arrastrando sobre la cuadrícula (como en
      // Excel), para los botones "Combinar celdas"/"Centrar"/"Negrilla"/
      // "Color" — un solo clic selecciona esa celda sola y no estorba para
      // escribir o elegir una opción.
      celdaInput.addEventListener("mousedown", () => {
        bloque._selA = { fi, ci };
        bloque._selB = { fi, ci };
        actualizarResaltado();
      });
      celdaInput.addEventListener("mouseenter", (e) => {
        if (e.buttons === 1 && bloque._selA) {
          bloque._selB = { fi, ci };
          actualizarResaltado();
        }
      });
      grid.appendChild(celdaInput);
    });
  });
  cont.appendChild(grid);
  actualizarResaltado();

  // Suprimir/Retroceso con varias celdas seleccionadas (arrastrando, como
  // en Excel) borra el texto de TODAS las celdas de ese rango de una vez —
  // si el rango es una sola celda, se deja el comportamiento normal de la
  // tecla (borrar un carácter) sin interceptarla.
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    const rango = bloque._selA && bloque._selB ? rangoOrdenado(bloque._selA, bloque._selB) : null;
    if (!rango || (rango.fMin === rango.fMax && rango.cMin === rango.cMax)) return;
    e.preventDefault();
    guardarHistorialBloques();
    for (let fi = rango.fMin; fi <= rango.fMax; fi++) {
      for (let ci = rango.cMin; ci <= rango.cMax; ci++) {
        const info = celdaCombinada(bloque.merges, fi, ci);
        if (info && !info.esAncla) continue;
        bloque.filas[fi][ci] = "";
      }
    }
    renderBloques();
  });

  const botones = document.createElement("div");
  botones.className = "control-tabla-botones";
  // Insertar/quitar relativo a la última celda donde se hizo clic
  // (bloque._filaFoco, la misma que ya usa "Pegar desde Excel/Word") — así
  // se puede meter o sacar una fila en medio de una tabla larga sin tener
  // que recortar y volver a pegar todo lo de abajo. Sin ningún clic previo
  // (bloque recién creado), caen al comportamiento de antes: agregar al
  // final / quitar la última.
  const agregarFilaArriba = document.createElement("button");
  agregarFilaArriba.type = "button";
  agregarFilaArriba.className = "control-btn-mini";
  agregarFilaArriba.textContent = "+ Fila arriba";
  agregarFilaArriba.title = "Inserta una fila vacía antes de la celda donde hiciste clic por última vez";
  agregarFilaArriba.addEventListener("click", () => {
    guardarHistorialBloques();
    const indice = bloque._filaFoco ?? bloque.filas.length;
    insertarFilaEnBloque(bloque, indice, numCols);
    renderBloques();
  });
  const agregarFilaAbajo = document.createElement("button");
  agregarFilaAbajo.type = "button";
  agregarFilaAbajo.className = "control-btn-mini";
  agregarFilaAbajo.textContent = "+ Fila abajo";
  agregarFilaAbajo.title = "Inserta una fila vacía después de la celda donde hiciste clic por última vez";
  agregarFilaAbajo.addEventListener("click", () => {
    guardarHistorialBloques();
    const indice = bloque._filaFoco === undefined ? bloque.filas.length : bloque._filaFoco + 1;
    insertarFilaEnBloque(bloque, indice, numCols);
    renderBloques();
  });
  const quitarFila = document.createElement("button");
  quitarFila.type = "button";
  quitarFila.className = "control-btn-mini";
  quitarFila.textContent = "- Fila";
  quitarFila.title = "Quita la fila donde hiciste clic por última vez";
  quitarFila.disabled = bloque.filas.length <= 1;
  quitarFila.addEventListener("click", () => {
    if (bloque.filas.length <= 1) return;
    guardarHistorialBloques();
    const indice = Math.min(bloque._filaFoco ?? bloque.filas.length - 1, bloque.filas.length - 1);
    eliminarFilaEnBloque(bloque, indice);
    renderBloques();
  });
  const agregarCol = document.createElement("button");
  agregarCol.type = "button";
  agregarCol.className = "control-btn-mini";
  agregarCol.textContent = "+ Columna";
  agregarCol.addEventListener("click", () => {
    guardarHistorialBloques();
    bloque.filas.forEach((fila) => fila.push(""));
    renderBloques();
  });
  const quitarCol = document.createElement("button");
  quitarCol.type = "button";
  quitarCol.className = "control-btn-mini";
  quitarCol.textContent = "- Columna";
  quitarCol.disabled = numCols <= 1;
  quitarCol.addEventListener("click", () => {
    if (numCols > 1) { guardarHistorialBloques(); bloque.filas.forEach((fila) => fila.pop()); renderBloques(); }
  });
  const vaciarBtn = document.createElement("button");
  vaciarBtn.type = "button";
  vaciarBtn.className = "control-btn-mini";
  vaciarBtn.textContent = "🧹 Vaciar tabla";
  vaciarBtn.title = "Borra todas las filas/columnas y combinaciones para empezar una tabla nueva — el título de la tabla (arriba) NO se borra";
  vaciarBtn.addEventListener("click", () => {
    if (!confirm("¿Vaciar esta tabla? Se borra todo su contenido (filas, columnas, combinaciones) para empezar de cero. El título de la tabla no se borra.")) return;
    guardarHistorialBloques();
    bloque.filas = [["", ""], ["", ""]];
    bloque.merges = [];
    bloque.centrados = [];
    bloque.centradosVertical = [];
    bloque.negritas = [];
    bloque.coloresCelda = [];
    bloque.opcionesColumna = {};
    bloque.filasEncabezado = 1;
    bloque._selA = null;
    bloque._selB = null;
    renderBloques();
  });
  const pegarBtn = document.createElement("button");
  pegarBtn.type = "button";
  pegarBtn.className = "control-btn-mini";
  pegarBtn.textContent = "📋 Pegar desde Excel/Word";
  pegarBtn.title = "Copia el rango en Excel (o la tabla en Word) y haz clic aquí — también puedes pegar (Ctrl+V) directo sobre cualquier celda";
  pegarBtn.addEventListener("click", async () => {
    const fi = bloque._filaFoco ?? 0;
    const ci = bloque._colFoco ?? 0;
    try {
      // Primero el HTML (estructura completa); si no se puede, el texto.
      try {
        for (const item of await navigator.clipboard.read()) {
          if (!item.types.includes("text/html")) continue;
          const t = tablaPegable(await (await item.getType("text/html")).text());
          if (t) { pegarHtmlEnTabla(bloque, fi, ci, t); return; }
        }
      } catch (e) { /* sin permiso para leer HTML: se intenta el texto */ }
      const texto = await navigator.clipboard.readText();
      if (!texto) { mostrarAlerta("El portapapeles está vacío. Copia primero el rango en Excel o la tabla en Word.", "error"); return; }
      pegarEnTabla(bloque, fi, ci, texto);
    } catch (e) {
      mostrarAlerta("El navegador no dejó leer el portapapeles automáticamente. Haz clic en la celda donde quieres empezar y pega con Ctrl+V — funciona igual.", "error");
    }
  });
  const combinarBtn = document.createElement("button");
  combinarBtn.type = "button";
  combinarBtn.className = "control-btn-mini";
  combinarBtn.textContent = "🔗 Combinar celdas";
  combinarBtn.title = "Arrastra sobre las celdas que quieras combinar y haz clic aquí";
  combinarBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas que quieras combinar antes de hacer clic aquí.", "error");
      return;
    }
    let { fMin, fMax, cMin, cMax } = expandirRangoConMerges(bloque.merges, rangoOrdenado(bloque._selA, bloque._selB));
    if (fMin === fMax && cMin === cMax) {
      mostrarAlerta("Selecciona al menos 2 celdas para combinar.", "error");
      return;
    }
    guardarHistorialBloques();
    // El texto de las celdas que se van a "esconder" no se pierde: se une
    // al de la celda ancla (arriba-izquierda), separado por espacios.
    const textos = [];
    for (let fi = fMin; fi <= fMax; fi++) {
      for (let ci = cMin; ci <= cMax; ci++) {
        if (bloque.filas[fi][ci]) textos.push(bloque.filas[fi][ci]);
      }
    }
    bloque.filas[fMin][cMin] = textos.join(" ").trim();
    for (let fi = fMin; fi <= fMax; fi++) {
      for (let ci = cMin; ci <= cMax; ci++) {
        if (fi !== fMin || ci !== cMin) bloque.filas[fi][ci] = "";
      }
    }
    bloque.merges = quitarMergesQueIntersectan(bloque.merges, fMin, fMax, cMin, cMax);
    bloque.merges.push({ fila: fMin, col: cMin, filas: fMax - fMin + 1, cols: cMax - cMin + 1 });
    bloque._selA = { fi: fMin, ci: cMin };
    bloque._selB = { fi: fMin, ci: cMin };
    renderBloques();
  });
  const separarBtn = document.createElement("button");
  separarBtn.type = "button";
  separarBtn.className = "control-btn-mini";
  separarBtn.textContent = "✂ Separar celdas";
  separarBtn.title = "Selecciona (o haz clic sobre) una celda combinada y haz clic aquí para deshacer la combinación";
  separarBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Haz clic sobre la celda combinada que quieras separar.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = expandirRangoConMerges(bloque.merges, rangoOrdenado(bloque._selA, bloque._selB));
    const quedan = quitarMergesQueIntersectan(bloque.merges, fMin, fMax, cMin, cMax);
    if (quedan.length === bloque.merges.length) {
      mostrarAlerta("No hay celdas combinadas en la selección.", "error");
      return;
    }
    guardarHistorialBloques();
    bloque.merges = quedan;
    renderBloques();
  });
  const centrarBtn = document.createElement("button");
  centrarBtn.type = "button";
  centrarBtn.className = "control-btn-mini";
  centrarBtn.textContent = "↔ Centrar";
  centrarBtn.title = "Arrastra sobre las celdas (una fila, una columna o cualquier bloque) y haz clic aquí para centrar su texto";
  centrarBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas que quieras centrar antes de hacer clic aquí.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = rangoOrdenado(bloque._selA, bloque._selB);
    guardarHistorialBloques();
    bloque.centrados = centrarRango(bloque.centrados, fMin, fMax, cMin, cMax);
    renderBloques();
  });
  const izquierdaBtn = document.createElement("button");
  izquierdaBtn.type = "button";
  izquierdaBtn.className = "control-btn-mini";
  izquierdaBtn.textContent = "⇤ Izquierda";
  izquierdaBtn.title = "Arrastra sobre las celdas y haz clic aquí para volver a alinear su texto a la izquierda";
  izquierdaBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas que quieras alinear a la izquierda antes de hacer clic aquí.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = rangoOrdenado(bloque._selA, bloque._selB);
    guardarHistorialBloques();
    bloque.centrados = alinearIzquierdaRango(bloque.centrados, fMin, fMax, cMin, cMax);
    renderBloques();
  });
  // Alineación vertical (traída de los Informes de gestión de Cinco Conecta).
  const centrarVerticalBtn = document.createElement("button");
  centrarVerticalBtn.type = "button";
  centrarVerticalBtn.className = "control-btn-mini";
  centrarVerticalBtn.textContent = "↕ Centrar vertical";
  centrarVerticalBtn.title = "Centra el texto en la mitad del alto de la fila (útil cuando una celda de al lado tiene varias líneas y esta queda corta)";
  centrarVerticalBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas que quieras centrar verticalmente antes de hacer clic aquí.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = rangoOrdenado(bloque._selA, bloque._selB);
    guardarHistorialBloques();
    bloque.centradosVertical = centrarVerticalRango(bloque.centradosVertical, fMin, fMax, cMin, cMax);
    renderBloques();
  });
  const arribaBtn = document.createElement("button");
  arribaBtn.type = "button";
  arribaBtn.className = "control-btn-mini";
  arribaBtn.textContent = "⬆ Arriba";
  arribaBtn.title = "Vuelve a dejar el texto arriba de la celda (el valor por defecto)";
  arribaBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas antes de hacer clic aquí.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = rangoOrdenado(bloque._selA, bloque._selB);
    guardarHistorialBloques();
    bloque.centradosVertical = alinearArribaRango(bloque.centradosVertical, fMin, fMax, cMin, cMax);
    renderBloques();
  });
  const negritaBtn = document.createElement("button");
  negritaBtn.type = "button";
  negritaBtn.className = "control-btn-mini";
  negritaBtn.textContent = "N Negrilla";
  negritaBtn.title = "Arrastra sobre las celdas y haz clic aquí para poner/quitar negrilla";
  negritaBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas que quieras poner en negrilla antes de hacer clic aquí.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = rangoOrdenado(bloque._selA, bloque._selB);
    guardarHistorialBloques();
    // Alterna según la primera celda del rango: si ya está en negrilla, se
    // quita de todo el rango; si no, se pone en todo el rango.
    const yaNegrita = celdaNegrita(bloque.negritas, fMin, cMin);
    bloque.negritas = yaNegrita
      ? quitarNegritaRango(bloque.negritas, fMin, fMax, cMin, cMax)
      : negritaRango(bloque.negritas, fMin, fMax, cMin, cMax);
    renderBloques();
  });
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.className = "control-tabla-color";
  colorInput.title = "Arrastra sobre las celdas y elige un color para su letra";
  colorInput.value = "#1a1e20";
  colorInput.addEventListener("input", () => {
    if (!bloque._selA || !bloque._selB) return;
    const { fMin, fMax, cMin, cMax } = rangoOrdenado(bloque._selA, bloque._selB);
    guardarHistorialBloques();
    bloque.coloresCelda = colorearRango(bloque.coloresCelda, fMin, fMax, cMin, cMax, colorInput.value);
    renderBloques();
  });
  const colorQuitarBtn = document.createElement("button");
  colorQuitarBtn.type = "button";
  colorQuitarBtn.className = "control-btn-mini";
  colorQuitarBtn.textContent = "Quitar color";
  colorQuitarBtn.title = "Arrastra sobre las celdas y haz clic aquí para volver al color de letra por defecto";
  colorQuitarBtn.addEventListener("click", () => {
    if (!bloque._selA || !bloque._selB) {
      mostrarAlerta("Arrastra sobre las celdas antes de hacer clic aquí.", "error");
      return;
    }
    const { fMin, fMax, cMin, cMax } = rangoOrdenado(bloque._selA, bloque._selB);
    guardarHistorialBloques();
    bloque.coloresCelda = colorearRango(bloque.coloresCelda, fMin, fMax, cMin, cMax, null);
    renderBloques();
  });
  const opcionesBtn = document.createElement("button");
  opcionesBtn.type = "button";
  opcionesBtn.className = "control-btn-mini";
  opcionesBtn.textContent = "☰ Opciones de columna";
  opcionesBtn.title = "Haz clic en una celda de la columna y define una lista fija separada por comas (ej. Sí, No, N.A.) para que esa columna se edite con un desplegable en vez de texto libre";
  opcionesBtn.addEventListener("click", () => {
    if (!bloque._selA) {
      mostrarAlerta("Haz clic en una celda de la columna que quieras convertir en lista de opciones.", "error");
      return;
    }
    const ci = bloque._selA.ci;
    const actuales = (bloque.opcionesColumna[ci] || []).join(", ");
    const texto = window.prompt("Opciones separadas por coma para esta columna (déjalo vacío para quitar la lista):", actuales);
    if (texto === null) return;
    guardarHistorialBloques();
    const opciones = texto.split(",").map((o) => o.trim()).filter(Boolean);
    if (opciones.length) bloque.opcionesColumna[ci] = opciones;
    else delete bloque.opcionesColumna[ci];
    renderBloques();
  });
  // Ancho de columnas: por defecto según el contenido; aquí se puede dejar
  // todas iguales, fijar el % de una columna o volver al automático. El PDF
  // y el Word usan el mismo reparto (bloque.anchosColumna).
  const botonMini = (texto, titulo, alClic) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "control-btn-mini";
    b.textContent = texto;
    b.title = titulo;
    b.addEventListener("click", alClic);
    return b;
  };
  const igualesBtn = botonMini("↔ Columnas iguales", "Reparte el ancho de la tabla en partes iguales entre todas las columnas", () => {
    guardarHistorialBloques();
    bloque.anchosColumna = new Array(numCols).fill(Math.round(1000 / numCols) / 10);
    renderBloques();
  });
  const anchoColBtn = botonMini("📏 Ancho de esta columna…", "Haz clic en una celda de la columna y escribe qué porcentaje del ancho de la tabla debe ocupar; las demás se ajustan solas", () => {
    if (!bloque._selA) {
      mostrarAlerta("Haz clic en una celda de la columna a la que le quieres cambiar el ancho.", "error");
      return;
    }
    const ci = bloque._selA.ci;
    const actual = Math.round((anchosManuales(bloque, numCols) || pesosCol.map((p) => p / pesosCol.reduce((s, x) => s + x, 0)))[ci] * 100);
    const texto = window.prompt(`Ancho de la columna ${ci + 1} en % del ancho de la tabla (ahora ${actual} %):`, String(actual));
    if (texto === null) return;
    const pct = Number(String(texto).replace(",", ".").replace("%", "").trim());
    if (!(pct > 0 && pct < 100)) {
      mostrarAlerta("Escribe un porcentaje entre 1 y 99.", "error");
      return;
    }
    guardarHistorialBloques();
    fijarAnchoColumna(bloque, numCols, ci, pct, pesosCol);
    renderBloques();
  });
  const autoAnchoBtn = botonMini("↺ Automático", "Vuelve al reparto automático: cada columna tan ancha como su contenido", () => {
    guardarHistorialBloques();
    delete bloque.anchosColumna;
    renderBloques();
  });
  autoAnchoBtn.disabled = !manuales;
  const anchosTexto = document.createElement("span");
  anchosTexto.className = "control-tabla-anchos";
  anchosTexto.textContent = manuales ? `Fijado: ${manuales.map((f) => `${Math.round(f * 100)} %`).join(" · ")}` : "Automático (según el contenido)";

  // Botones en "tarjeticas" con título propio (como los Informes de gestión
  // de Cinco Conecta), en vez de una sola fila corrida: se ve de una qué
  // hace cada grupo sin tener que leer todos los botones.
  function grupoBotones(titulo, elementos) {
    const grupo = document.createElement("div");
    grupo.className = "control-tabla-grupo";
    const tituloEl = document.createElement("div");
    tituloEl.className = "control-tabla-grupo-titulo";
    tituloEl.textContent = titulo;
    const fila = document.createElement("div");
    fila.className = "control-tabla-grupo-botones";
    fila.append(...elementos);
    grupo.append(tituloEl, fila);
    return grupo;
  }
  botones.classList.add("control-tabla-grupos");
  botones.append(
    grupoBotones("Filas y columnas", [agregarFilaArriba, agregarFilaAbajo, quitarFila, agregarCol, quitarCol]),
    grupoBotones("Vaciar tabla", [vaciarBtn]),
    grupoBotones("Pegar datos", [pegarBtn]),
    grupoBotones("Combinar celdas", [combinarBtn, separarBtn]),
    grupoBotones("Ancho de columnas", [igualesBtn, anchoColBtn, autoAnchoBtn, anchosTexto]),
    grupoBotones("Alineación y negrilla", [centrarBtn, izquierdaBtn, centrarVerticalBtn, arribaBtn, negritaBtn]),
    grupoBotones("Color de letra", [colorInput, colorQuitarBtn]),
    grupoBotones("Lista desplegable por columna", [opcionesBtn])
  );
  cont.appendChild(botones);

  const notaInput = document.createElement("input");
  notaInput.type = "text";
  notaInput.maxLength = 200;
  notaInput.placeholder = "Nota / pie de tabla (aparece abajo, alineada a la derecha)";
  notaInput.value = bloque.nota || "";
  notaInput.addEventListener("input", () => { bloque.nota = notaInput.value; });
  cont.appendChild(notaInput);

  // Botones de la barra flotante — cada uno solo repite el clic del botón
  // fijo correspondiente (misma lógica, sin duplicarla), para poder usar la
  // acción sin bajar hasta la barra de abajo.
  [
    [negritaBtn, "N", "Negrilla"],
    [centrarBtn, "↔", "Centrar"],
    [izquierdaBtn, "⇤", "Izquierda"],
    [combinarBtn, "🔗", "Combinar celdas"],
    [separarBtn, "✂", "Separar celdas"]
  ].forEach(([btnOriginal, texto, titulo]) => {
    const mini = document.createElement("button");
    mini.type = "button";
    mini.className = "control-btn-mini";
    mini.textContent = texto;
    mini.title = titulo;
    mini.addEventListener("mousedown", (e) => e.preventDefault()); // no perder la selección de celdas al hacer clic
    mini.addEventListener("click", () => btnOriginal.click());
    flotante.appendChild(mini);
  });

  return cont;
}
