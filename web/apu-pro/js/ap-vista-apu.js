// Hoja de un APU en pantalla (biblioteca y editor): los cinco capítulos con sus líneas,
// subtotales y costo directo, con el mismo orden de los reportes de Cinco S.A.S.
import { esc, pesos, numero } from "./ap-core.js";
import { CAPITULOS } from "./ap-apu.js";

// Anchos fijos por capítulo (%) para que las cinco tablas queden alineadas entre sí.
const COLS = {
  MA: { enc: ["Código", "Descripción", "Und", "Cantidad", "Desp.", "Vr. unitario", "Vr. total"], anchos: [9, 41, 7, 10, 7, 13, 13] },
  MO: { enc: ["Código", "Cargo", "Cantidad", "Factor", "Jornal + prest.", "", "Vr. total"], anchos: [9, 41, 10, 7, 13, 7, 13] },
  EH: { enc: ["Código", "Descripción", "Und", "Cantidad", "", "Vr. mensual", "Vr. total"], anchos: [9, 41, 7, 10, 7, 13, 13] },
  ED: { enc: ["Código", "Descripción", "Und", "Personas", "", "Vr. mensual", "Vr. total"], anchos: [9, 41, 7, 10, 7, 13, 13] },
  TV: { enc: ["Código", "Descripción", "Und", "Cantidad", "", "Vr. mensual o unitario", "Vr. total"], anchos: [9, 41, 7, 10, 7, 13, 13] }
};
const colgroup = (anchos) => `<colgroup>${anchos.map((a) => `<col data-ancho="${a}">`).join("")}</colgroup>`;

function celdas(tipo, f) {
  const aviso = f.falta ? ' <span class="badge danger">No está en la base</span>' : f.unitario == null ? ' <span class="badge warn">Sin precio</span>' : "";
  const desc = `<td title="${esc(f.descripcion)}">${esc(f.descripcion || "—")}${aviso}</td>`;
  if (tipo === "MO") return `<td>${esc(f.codigo)}</td>${desc}<td class="ap-num">${numero(f.cantidad, 3)}</td><td class="ap-num">${numero(f.factor, 2)}</td><td class="ap-num">${pesos(f.unitario)}</td><td></td><td class="ap-num">${pesos(f.total)}</td>`;
  const cant = tipo === "ED" ? `${numero(f.cantidad, 3)}${f.modo === "fija" ? "" : ' <small class="text-muted">cuadrilla</small>'}` : numero(f.cantidad, 4);
  const desp = tipo === "MA" ? (f.desperdicio ? `${numero(f.desperdicio * 100, 1)} %` : "—") : "";
  const unit = tipo === "TV" && f.porUnidad ? `${pesos(f.unitario)} <small class="text-muted">/und</small>` : pesos(f.unitario, f.unitario != null && f.unitario < 100 ? 2 : 0);
  return `<td>${esc(f.codigo)}</td>${desc}<td>${esc(f.unidad)}</td><td class="ap-num">${cant}</td><td class="ap-num">${desp}</td><td class="ap-num">${unit}</td><td class="ap-num">${pesos(f.total)}</td>`;
}

// res: resultado de calcularApu(); devuelve el HTML de los cinco capítulos y el costo directo.
export function htmlHojaApu(res) {
  return `<div class="ap-hoja">${CAPITULOS.map(({ tipo, letra, nombre }) => {
    const filas = res.capitulos[tipo] || [];
    if (!filas.length) return `<div class="ap-cap ap-cap-vacio"><span>${letra}. ${esc(nombre)}</span><span class="text-muted">Sin líneas</span><strong>${pesos(0)}</strong></div>`;
    const c = COLS[tipo];
    return `<table class="ap-tabla ap-tabla-apu">${colgroup(c.anchos)}
      <thead><tr class="ap-cap-titulo"><th colspan="6">${letra}. ${esc(nombre)}</th><th class="ap-num">${pesos(res.subtotales[tipo])}</th></tr>
      <tr>${c.enc.map((h, j) => `<th class="${j >= 3 ? "ap-num" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${filas.map((f) => `<tr>${celdas(tipo, f)}</tr>`).join("")}</tbody></table>`;
  }).join("")}
  <div class="ap-cd"><span>Costo directo (A + B + C + D + E)</span><strong>${pesos(res.costoDirecto)}</strong></div></div>`;
}
