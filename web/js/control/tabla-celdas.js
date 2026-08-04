// Helpers puros (sin DOM, sin jsPDF/docx) para "celdas combinadas" en las
// tablas de Informes y Ofertas. Compartidos entre el editor
// (informes.js/ofertas.js) y los generadores de salida (informes-pdf.js,
// ofertas-pdf.js, informes-docx.js) para que los cinco sitios coincidan en
// qué celda es "ancla" y cuál queda "cubierta" por un rango combinado.
//
// Un merge es { fila, col, filas, cols }: (fila,col) es la celda ancla
// (arriba-izquierda, 0-based) y filas/cols cuántas filas/columnas abarca.
// bloque.filas (la cuadrícula string[][]) no cambia de forma — los merges
// son solo una capa de "qué se ve combinado" encima de esa cuadrícula.

// Recorta cualquier merge que se salga de las dimensiones actuales de la
// tabla (p. ej. tras "- Fila"/"- Columna") y descarta los que quedaron
// degenerados (1×1, ya no combinan nada). Se llama de forma defensiva en
// cada punto que lee bloque.merges contra el tamaño actual de filas — así
// no hace falta ajustar merges a mano en cada botón +Fila/-Fila/etc.
export function normalizarMerges(merges, numFilas, numCols) {
  return (merges || [])
    .filter((m) => m && m.fila >= 0 && m.col >= 0 && m.fila < numFilas && m.col < numCols)
    .map((m) => ({
      fila: m.fila,
      col: m.col,
      filas: Math.max(1, Math.min(m.filas || 1, numFilas - m.fila)),
      cols: Math.max(1, Math.min(m.cols || 1, numCols - m.col))
    }))
    .filter((m) => m.filas > 1 || m.cols > 1);
}

// null si (fi,ci) es una celda normal, o { merge, esAncla } si cae dentro
// de un rango combinado (esAncla = es la celda arriba-izquierda de ese
// rango, la única que se muestra/dibuja).
export function celdaCombinada(merges, fi, ci) {
  for (const m of merges) {
    if (fi >= m.fila && fi < m.fila + m.filas && ci >= m.col && ci < m.col + m.cols) {
      return { merge: m, esAncla: fi === m.fila && ci === m.col };
    }
  }
  return null;
}

// Copia de "filas" con el texto de las celdas combinadas en blanco, para
// pasársela a calcularAnchosColumna (PDF) / anchosColumnaDocx (Word) sin
// tocar esas funciones — así una celda combinada con texto largo no obliga
// a una sola columna a ensancharse de más (su texto en realidad se reparte
// entre todas las columnas que abarca).
export function filasSinTextoCombinado(filas, merges) {
  if (!merges.length) return filas;
  return filas.map((fila, fi) => fila.map((valor, ci) => (celdaCombinada(merges, fi, ci) ? "" : valor)));
}

// Amplía un rango [fMin..fMax, cMin..cMax] hasta que incluya completo
// cualquier merge que toque, igual que Excel al seleccionar sobre celdas
// ya combinadas (repite hasta que el rango deja de crecer).
export function expandirRangoConMerges(merges, rango) {
  let { fMin, fMax, cMin, cMax } = rango;
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const m of merges) {
      const mfMax = m.fila + m.filas - 1;
      const mcMax = m.col + m.cols - 1;
      const solapa = m.fila <= fMax && mfMax >= fMin && m.col <= cMax && mcMax >= cMin;
      if (!solapa) continue;
      if (m.fila < fMin) { fMin = m.fila; cambio = true; }
      if (mfMax > fMax) { fMax = mfMax; cambio = true; }
      if (m.col < cMin) { cMin = m.col; cambio = true; }
      if (mcMax > cMax) { cMax = mcMax; cambio = true; }
    }
  }
  return { fMin, fMax, cMin, cMax };
}

// Quita cualquier merge que se cruce con un rango — usado al pegar datos
// de Excel/Word encima de celdas combinadas: los datos nuevos ya no
// respetan la combinación anterior.
export function quitarMergesQueIntersectan(merges, fMin, fMax, cMin, cMax) {
  return merges.filter((m) => {
    const mfMax = m.fila + m.filas - 1;
    const mcMax = m.col + m.cols - 1;
    return !(m.fila <= fMax && mfMax >= fMin && m.col <= cMax && mcMax >= cMin);
  });
}

// ---- alineación de celdas (centrado) ----
// bloque.centrados: array de { fila, col } — lista dispersa de qué celdas
// están centradas (todo lo que no está en la lista se alinea a la
// izquierda, el valor por defecto). Mismo criterio de "lista dispersa de
// coordenadas" que los merges, pero sin filas/cols porque acá cada celda
// se marca individualmente (al centrar una fila o columna completa se
// agregan todas sus coordenadas, no un solo rango).

export function celdaCentrada(centrados, fi, ci) {
  return (centrados || []).some((c) => c.fila === fi && c.col === ci);
}

// Recorta cualquier coordenada que se salga de las dimensiones actuales de
// la tabla — mismo criterio que normalizarMerges.
export function normalizarCentrados(centrados, numFilas, numCols) {
  return (centrados || []).filter((c) => c && c.fila >= 0 && c.col >= 0 && c.fila < numFilas && c.col < numCols);
}

// Agrega al centrado todas las coordenadas de [fMin..fMax, cMin..cMax] que
// todavía no estén marcadas.
export function centrarRango(centrados, fMin, fMax, cMin, cMax) {
  const resultado = centrados.slice();
  for (let fi = fMin; fi <= fMax; fi++) {
    for (let ci = cMin; ci <= cMax; ci++) {
      if (!celdaCentrada(resultado, fi, ci)) resultado.push({ fila: fi, col: ci });
    }
  }
  return resultado;
}

// Quita del centrado cualquier coordenada dentro de [fMin..fMax, cMin..cMax].
export function alinearIzquierdaRango(centrados, fMin, fMax, cMin, cMax) {
  return centrados.filter((c) => !(c.fila >= fMin && c.fila <= fMax && c.col >= cMin && c.col <= cMax));
}
