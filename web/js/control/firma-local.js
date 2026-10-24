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
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}
