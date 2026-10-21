// Gráfico tiempo-corriente (TCC) en escala log-log para la coordinación de
// protecciones. Devuelve un SVG en texto (sin estilos en línea: los colores
// van como atributos, permitido por la política de seguridad del sitio).
import { tiempoRele, esTierra } from "./rt-calculos.js";
import { puntosCurva } from "./rt-normas.js";

// Corriente desde la que opera una protección (la del primer punto en una curva por puntos).
const arranque = (r) => (r.curva === "PUNTOS" ? puntosCurva(r.puntos)[0]?.[0] || 0 : Number(r.pickup) || 0);

const COLORES = ["#1f6fb2", "#d9820b", "#2e9e5b", "#b0413e", "#7a4fb5", "#0f8b8d"];
const fmtI = (v) => (v >= 1000 ? `${v / 1000} k` : String(v));

export function svgTCC({ reles = [], fallas = [], inrush = 0 }, { ancho = 720, alto = 460 } = {}) {
  const pick = reles.map(arranque).filter((v) => v > 0);
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
  const nLey = reles.filter((r) => arranque(r)).length;
  if (nLey) s += `<rect x="${m.l + 6}" y="${m.t + H - 12 - nLey * 18}" width="200" height="${nLey * 18 + 6}" fill="#ffffff" fill-opacity="0.9" stroke="#ccc"/>`;
  let iLey = 0;
  reles.forEach((r, i) => {
    const is = arranque(r);
    if (!is) return;
    const tierra = esTierra(r);
    const color = COLORES[i % COLORES.length];
    const pts = [];
    const desde = Math.log10(is * (r.curva === "PUNTOS" ? 1 : 1.03)), hasta = Math.log10(iMax);
    for (let k = 0; k <= 160; k++) {
      const I = Math.pow(10, desde + ((hasta - desde) * k) / 160);
      const t = tiempoRele(r, I);
      if (Number.isFinite(t)) pts.push(`${x(I).toFixed(1)},${y(Math.max(tMin, Math.min(tMax, t))).toFixed(1)}`);
    }
    if (pts.length) s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2.2"${tierra ? ' stroke-dasharray="7 4"' : ""}/>`;
    const yL = m.t + H - 12 - nLey * 18 + 12 + iLey++ * 18;
    s += `<rect x="${m.l + 14}" y="${yL - 4}" width="12" height="4" fill="${color}"/><text x="${m.l + 32}" y="${yL + 1}" fill="#222">${String(r.nombre || `Protección ${i + 1}`).slice(0, 30)}${tierra ? " (tierra)" : ""}</text>`;
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

// ---------------------------------------------------------------- diagrama unifilar
// Tronco vertical: red, DPS, protección de MT, transformador, medida y las barras hasta la de
// los circuitos; de esa barra salen los tableros siguientes (alimentadores), los circuitos y
// la generación solar.
const escX = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nf = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString("es-CO", { maximumFractionDigits: d }) : "—");
// Parte un texto en dos líneas como máximo, cortando en el espacio más cercano al límite.
const partir = (t, n = 17) => {
  const s = String(t ?? "");
  if (s.length <= n) return [s];
  const i = s.lastIndexOf(" ", n);
  const corte = i > 4 ? i : n;
  const b = s.slice(corte).trim();
  return [s.slice(0, corte).trim(), b.length > n ? `${b.slice(0, n - 1)}…` : b];
};
export function svgUnifilar(g) {
  const C = "#1f2732", NAR = "#d9820b", AZ = "#1f6fb2", VE = "#2e9e5b";
  const posteriores = g.barras.slice(g.barraC + 1);
  const salidas = [...posteriores.map((b) => ({ tipo: "b", ...b })), ...g.circuitos.map((c) => ({ tipo: "c", ...c })), ...(g.fv ? [{ tipo: "fv" }] : [])];
  const largoNombre = Math.max(10, ...g.barras.map((b) => String(b.nombre).length));
  const paso = 110, x0 = Math.min(330, 60 + largoNombre * 6.4), W = Math.max(780, x0 + 40 + salidas.length * paso);
  let y = 26, s = "";
  const linea = (x1, y1, x2, y2, color = C, ancho = 2) => { s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${ancho}"/>`; };
  const texto = (x, yy, t, { a = "start", t2 = 11, peso = "normal", color = "#222" } = {}) => { s += `<text x="${x}" y="${yy}" text-anchor="${a}" font-size="${t2}" font-weight="${peso}" fill="${color}">${escX(t)}</text>`; };
  const interruptor = (x, yy) => { s += `<rect x="${x - 7}" y="${yy}" width="14" height="14" fill="#fff" stroke="${C}" stroke-width="2"/><line x1="${x - 7}" y1="${yy}" x2="${x + 7}" y2="${yy + 14}" stroke="${C}" stroke-width="1.5"/>`; };
  // Red del operador.
  s += `<circle cx="${x0}" cy="${y + 12}" r="12" fill="#fff" stroke="${C}" stroke-width="2"/><path d="M${x0 - 7} ${y + 12} q 3.5 -7 7 0 t 7 0" fill="none" stroke="${C}" stroke-width="1.8"/>`;
  texto(x0 + 22, y + 9, "Red del operador", { peso: "bold" }); texto(x0 + 22, y + 23, `${nf(g.red.kv)} kV${g.red.sk ? ` · S"k ${nf(g.red.sk, 0)} MVA` : ""}`);
  y += 24; linea(x0, y, x0, y + 50);
  if (g.dps) {
    linea(x0, y + 12, x0 - 40, y + 12);
    s += `<rect x="${x0 - 50}" y="${y + 12}" width="20" height="24" fill="#fff" stroke="${C}" stroke-width="1.6"/><path d="M${x0 - 40} ${y + 15} l -4 8 h 8 l -4 8" fill="none" stroke="${C}" stroke-width="1.4"/><line x1="${x0 - 40}" y1="${y + 36}" x2="${x0 - 40}" y2="${y + 44}" stroke="${C}" stroke-width="1.6"/><line x1="${x0 - 47}" y1="${y + 44}" x2="${x0 - 33}" y2="${y + 44}" stroke="${C}" stroke-width="2"/>`;
    texto(x0 - 58, y + 28, "DPS", { a: "end" });
  }
  if (g.protMT) { s += `<rect x="${x0 - 6}" y="${y + 14}" width="12" height="26" fill="#fff" stroke="${C}" stroke-width="2"/><line x1="${x0}" y1="${y + 14}" x2="${x0}" y2="${y + 40}" stroke="${C}" stroke-width="1"/>`; texto(x0 + 16, y + 31, g.protMT); }
  y += 50;
  // Transformador.
  if (g.trafo) {
    s += `<circle cx="${x0}" cy="${y + 15}" r="15" fill="none" stroke="${NAR}" stroke-width="2.2"/><circle cx="${x0}" cy="${y + 37}" r="15" fill="none" stroke="${NAR}" stroke-width="2.2"/>`;
    texto(x0 + 26, y + 20, `T1 · ${nf(g.trafo.kva, 0)} kVA`, { peso: "bold" });
    texto(x0 + 26, y + 34, `${nf(g.trafo.vp, 1)} / ${nf(g.trafo.vs, 3)} kV · ${g.trafo.grupo}${g.trafo.z ? ` · Z ${nf(g.trafo.z, 1)} %` : ""}`);
    y += 52;
  }
  linea(x0, y, x0, y + 16); y += 16;
  if (g.medidor) { linea(x0, y, x0 + 18, y, C, 1.2); s += `<rect x="${x0 + 18}" y="${y - 10}" width="22" height="20" rx="3" fill="#fff" stroke="${C}" stroke-width="1.5"/>`; texto(x0 + 29, y + 4, "M", { a: "middle", peso: "bold", t2: 10 }); texto(x0 + 48, y + 4, g.medidor, { t2: 10 }); linea(x0, y, x0, y + 16); y += 16; }
  // Barras en cascada hasta la de los circuitos.
  const barraEtiqueta = (b, yy, xIzq) => { texto(xIzq - 8, yy + 4, b.nombre, { a: "end", peso: "bold" }); texto(xIzq - 8, yy + 17, `${Number.isFinite(b.ik3) ? `Ik" ${nf(b.ik3, 2)} kA` : ""}${b.icu ? ` · Icu ${nf(b.icu, 1)} kA` : ""}`, { a: "end", t2: 10, color: "#555" }); };
  g.barras.slice(0, g.barraC + 1).forEach((b, i) => {
    if (i) { interruptor(x0, y); linea(x0, y + 14, x0, y + 36); texto(x0 + 14, y + 11, b.cable, { t2: 10, color: "#444" }); y += 36; }
    const ultima = i === g.barraC;
    const xIzq = x0 - 30, largo = ultima ? Math.max(240, salidas.length * paso + 40) : 200;
    linea(xIzq, y, xIzq + largo, y, ultima ? AZ : C, 5);
    barraEtiqueta(b, y, xIzq);
    if (!ultima) { linea(x0, y, x0, y + 16); y += 16; }
  });
  // Salidas de la barra de los circuitos.
  const yC = y;
  salidas.forEach((c, k) => {
    const x = x0 + 10 + k * paso;
    linea(x, yC, x, yC + 18);
    if (c.tipo === "fv") {
      s += `<rect x="${x - 16}" y="${yC + 18}" width="32" height="28" fill="#fff" stroke="${VE}" stroke-width="2"/>`; texto(x, yC + 31, "~", { a: "middle", peso: "bold", color: VE, t2: 12 }); texto(x, yC + 43, "=", { a: "middle", peso: "bold", color: VE, t2: 12 });
      linea(x, yC + 46, x, yC + 62, VE);
      s += `<rect x="${x - 18}" y="${yC + 62}" width="36" height="22" fill="#fff4cc" stroke="${VE}" stroke-width="2"/><line x1="${x - 18}" y1="${yC + 73}" x2="${x + 18}" y2="${yC + 73}" stroke="${VE}" stroke-width="1"/>`;
      texto(x, yC + 100, "Solar FV", { a: "middle", peso: "bold", t2: 10 }); texto(x, yC + 113, `${nf(g.fv.kwp, 1)} kWp`, { a: "middle", t2: 10 }); texto(x, yC + 126, `${nf(g.fv.kw, 1)} kW AC`, { a: "middle", t2: 10 });
      return;
    }
    interruptor(x, yC + 18);
    if (c.tipo === "b") {
      linea(x, yC + 32, x, yC + 76);
      linea(x - 34, yC + 76, x + 34, yC + 76, C, 4);
      if (c.alim?.icu) texto(x + 11, yC + 29, `Icu ${nf(c.alim.icu, 0)} kA`, { t2: 9.5, peso: "bold" });
      String(c.cable || "").split(", ").forEach((p, j) => texto(x + 7, yC + 48 + j * 11, p, { t2: 9.5, color: "#444" }));
      partir(c.nombre).forEach((p, j) => texto(x, yC + 92 + j * 12, p, { a: "middle", peso: "bold", t2: 10 }));
      const yK = yC + 92 + partir(c.nombre).length * 12 + 1;
      if (Number.isFinite(c.ik3)) texto(x, yK, `Ik" ${nf(c.ik3, 2)} kA`, { a: "middle", t2: 9.5, color: "#555" });
      if (c.icu) texto(x, yK + 11, `Icu ${nf(c.icu, 0)} kA`, { a: "middle", t2: 9.5, color: "#555" });
      return;
    }
    linea(x, yC + 32, x, yC + 70);
    texto(x + 10, yC + 30, `${c.In} A`, { t2: 10, peso: "bold" });
    s += `<path d="M${x - 6} ${yC + 70} l 6 10 l 6 -10 z" fill="${C}"/>`;
    texto(x, yC + 96, `C${c.nombre}`, { a: "middle", peso: "bold", t2: 10 });
    // Descripción en líneas cortas (cabe en el paso entre circuitos).
    const corto = (t, n = 17) => (String(t).length > n ? `${String(t).slice(0, n - 1)}…` : String(t));
    texto(x, yC + 109, corto(c.desc || ""), { a: "middle", t2: 9.5, color: "#333" });
    texto(x, yC + 121, c.conductor, { a: "middle", t2: 9.5, color: "#333" });
    texto(x, yC + 133, `${nf(c.I, 1)} A`, { a: "middle", t2: 9.5, color: "#555" });
  });
  const H = yC + (salidas.length ? 160 : 40);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif"><rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>${s}</svg>`;
}
