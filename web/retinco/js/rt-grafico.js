// Gráfico tiempo-corriente (TCC) en escala log-log para la coordinación de
// protecciones. Devuelve un SVG en texto (sin estilos en línea: los colores
// van como atributos, permitido por la política de seguridad del sitio).
import { tiempoRele } from "./rt-calculos.js";

const COLORES = ["#1f6fb2", "#d9820b", "#2e9e5b", "#b0413e", "#7a4fb5", "#0f8b8d"];
const fmtI = (v) => (v >= 1000 ? `${v / 1000} k` : String(v));

export function svgTCC({ reles = [], fallas = [], inrush = 0 }, { ancho = 720, alto = 460 } = {}) {
  const pick = reles.map((r) => Number(r.pickup) || 0).filter((v) => v > 0);
  const maxF = Math.max(...fallas.map((f) => f.I || 0), ...reles.map((r) => Number(r.inst) || 0), inrush || 0, 1);
  if (!pick.length) return "";
  const iMin = Math.pow(10, Math.floor(Math.log10(Math.min(...pick) * 0.8)));
  const iMax = Math.pow(10, Math.ceil(Math.log10(maxF * 1.5)));
  const tMin = 0.01, tMax = 100;
  const m = { l: 62, r: 18, t: 16, b: 46 };
  const W = ancho - m.l - m.r, H = alto - m.t - m.b;
  const x = (i) => m.l + ((Math.log10(i) - Math.log10(iMin)) / (Math.log10(iMax) - Math.log10(iMin))) * W;
  const y = (t) => m.t + (1 - (Math.log10(t) - Math.log10(tMin)) / (Math.log10(tMax) - Math.log10(tMin))) * H;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" font-family="Arial, Helvetica, sans-serif" font-size="11">`;
  s += `<rect x="0" y="0" width="${ancho}" height="${alto}" fill="#ffffff"/>`;
  // Rejilla logarítmica.
  for (let d = Math.log10(iMin); d <= Math.log10(iMax) + 1e-9; d++) {
    for (let k = 1; k <= 9; k++) {
      const v = Math.pow(10, d) * k;
      if (v > iMax * 1.0001) break;
      s += `<line x1="${x(v)}" y1="${m.t}" x2="${x(v)}" y2="${m.t + H}" stroke="${k === 1 ? "#b8bec7" : "#e6e9ee"}" stroke-width="1"/>`;
      if (k === 1) s += `<text x="${x(v)}" y="${m.t + H + 16}" text-anchor="middle" fill="#444">${fmtI(Math.round(v))}</text>`;
    }
  }
  for (let d = -2; d <= 2; d++) {
    for (let k = 1; k <= 9; k++) {
      const v = Math.pow(10, d) * k;
      if (v > tMax * 1.0001) break;
      s += `<line x1="${m.l}" y1="${y(v)}" x2="${m.l + W}" y2="${y(v)}" stroke="${k === 1 ? "#b8bec7" : "#e6e9ee"}" stroke-width="1"/>`;
      if (k === 1) s += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" fill="#444">${v}</text>`;
    }
  }
  s += `<rect x="${m.l}" y="${m.t}" width="${W}" height="${H}" fill="none" stroke="#5c6570"/>`;
  s += `<text x="${m.l + W / 2}" y="${alto - 8}" text-anchor="middle" fill="#222" font-weight="bold">Corriente (A)</text>`;
  s += `<text x="16" y="${m.t + H / 2}" text-anchor="middle" fill="#222" font-weight="bold" transform="rotate(-90 16 ${m.t + H / 2})">Tiempo (s)</text>`;
  // Corrientes de falla.
  fallas.forEach((f) => {
    if (!(f.I > iMin && f.I < iMax)) return;
    s += `<line x1="${x(f.I)}" y1="${m.t}" x2="${x(f.I)}" y2="${m.t + H}" stroke="#d64545" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    // Rótulo vertical junto a la línea, para que varias fallas no se encimen.
    s += `<text x="${x(f.I) - 4}" y="${m.t + H - 6}" fill="#d64545" transform="rotate(-90 ${x(f.I) - 4} ${m.t + H - 6})">${String(f.punto || "Falla").slice(0, 40)} (${Math.round(f.I).toLocaleString("es-CO")} A)</text>`;
  });
  if (inrush > iMin && inrush < iMax) s += `<circle cx="${x(inrush)}" cy="${y(0.1)}" r="5" fill="#d64545"/><text x="${x(inrush) + 7}" y="${y(0.1) - 6}" fill="#d64545">Inrush</text>`;
  // Curvas; la leyenda va abajo a la izquierda (zona libre de un diagrama TCC).
  const nLey = reles.filter((r) => Number(r.pickup)).length;
  if (nLey) s += `<rect x="${m.l + 6}" y="${m.t + H - 12 - nLey * 18}" width="200" height="${nLey * 18 + 6}" fill="#ffffff" fill-opacity="0.9" stroke="#ccc"/>`;
  let iLey = 0;
  reles.forEach((r, i) => {
    const is = Number(r.pickup) || 0;
    if (!is) return;
    const color = COLORES[i % COLORES.length];
    const pts = [];
    const desde = Math.log10(is * 1.03), hasta = Math.log10(iMax);
    for (let k = 0; k <= 160; k++) {
      const I = Math.pow(10, desde + ((hasta - desde) * k) / 160);
      const t = tiempoRele(r, I);
      if (Number.isFinite(t)) pts.push(`${x(I).toFixed(1)},${y(Math.max(tMin, Math.min(tMax, t))).toFixed(1)}`);
    }
    if (pts.length) s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2.2"/>`;
    const yL = m.t + H - 12 - nLey * 18 + 12 + iLey++ * 18;
    s += `<rect x="${m.l + 14}" y="${yL - 4}" width="12" height="4" fill="${color}"/><text x="${m.l + 32}" y="${yL + 1}" fill="#222">${String(r.nombre || `Protección ${i + 1}`).slice(0, 30)}</text>`;
  });
  return s + "</svg>";
}

// Convierte un SVG a PNG (data URL) para incrustarlo en el PDF o el Word.
export function svgAPng(svg, escala = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width * escala; c.height = img.height * escala;
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
