// Firma manuscrita digitalizada de quien firma las cartas. NO se sube al repositorio ni a la base de datos:
// la elige cada usuario desde su equipo y queda en este navegador (localStorage); el PDF y el Word la usan
// al generarse. Si no hay una guardada, la carta sale con el espacio en blanco para firmar a mano.
const CLAVE = "cinco.firmaCarta";

export function firmaGuardada() {
  try { return localStorage.getItem(CLAVE) || null; } catch (e) { return null; }
}

export function guardarFirma(dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(CLAVE, dataUrl); else localStorage.removeItem(CLAVE);
    return true;
  } catch (e) { return false; }
}

// Cómo se pone la firma: alto en mm y si va montada sobre la línea de firma (o sobre el nombre, en una
// carta normal), como cuando se firma a mano encima de la raya. También queda solo en este navegador.
const CLAVE_AJUSTES = "cinco.firmaCartaAjustes";
export const FIRMA_ALTO_MIN = 12, FIRMA_ALTO_MAX = 45, FIRMA_SOLAPE = 0.45;

export function ajustesFirma() {
  let a = {};
  try { a = JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}") || {}; } catch (e) { a = {}; }
  const alto = Number(a.alto);
  return {
    alto: alto >= FIRMA_ALTO_MIN && alto <= FIRMA_ALTO_MAX ? alto : 19,
    sobreLinea: a.sobreLinea === true
  };
}

export function guardarAjustesFirma(ajustes) {
  try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch (e) { /* sin almacenamiento: quedan los de siempre */ }
}

// Reduce la imagen (máx. 600 px de alto) y la devuelve como PNG con fondo transparente conservado.
export function procesarArchivoFirma(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, 600 / img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * esc);
      c.height = Math.round(img.naturalHeight * esc);
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      // El fondo blanco (una firma escaneada o en JPG) se vuelve transparente: así, montada sobre la línea,
      // la firma no tapa la raya ni el nombre.
      const px = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < px.data.length; i += 4) {
        const claro = Math.min(px.data[i], px.data[i + 1], px.data[i + 2]);
        if (claro > 235) px.data[i + 3] = 0;
        else if (claro > 200) px.data[i + 3] = Math.round(px.data[i + 3] * (235 - claro) / 35);
      }
      ctx.putImageData(px, 0, 0);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}
