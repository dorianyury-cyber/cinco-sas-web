// Presupuesto en formato Cinco (presupuesto-formato.html?id=…): hoja para imprimir o guardar
// en PDF (con los APU si se marca) y Excel con la hoja de presupuesto y una hoja por APU.
import { iniciarPagina, leerProyecto, listarInsumos, listarParametros, parametrosVigentes, mostrarAlerta, errorAmigable } from "./ap-core.js";
import { calcularPresupuesto, resolverInsumo } from "./ap-presupuesto.js";
import { htmlPresupuesto, libroProyecto } from "./ap-formato-presupuesto.js";
import { htmlFormatoApu, logoBase64 } from "./ap-formato.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");
let proyecto = null, calc = null, parametros = null;

if (ctx) {
  try {
    const [p, ins, par] = await Promise.all([leerProyecto(id), listarInsumos(), listarParametros()]);
    if (!p) throw new Error("No se encontró el proyecto.");
    proyecto = p;
    parametros = par.find((x) => x.anio === Number(p.anioParametros)) || parametrosVigentes(par);
    calc = calcularPresupuesto(p, { insumo: resolverInsumo(p, new Map(ins.map((x) => [x.codigo, x]))), parametros });
    document.title = `${p.codigo} — presupuesto formato Cinco`;
    $("volver").href = `proyecto.html?id=${encodeURIComponent(id)}`;
    $("hoja").innerHTML = htmlPresupuesto(p, calc, { parametros });
    pintarApus();
    $("conApus").addEventListener("change", () => $("apus").classList.toggle("hidden", !$("conApus").checked));
    $("imprimir").addEventListener("click", () => window.print());
    $("excel").addEventListener("click", descargar);
  } catch (err) { mostrarAlerta($("alerta"), errorAmigable(err)); $("hoja").innerHTML = ""; }
}

// Hojas de cada APU distinto del presupuesto (para imprimir junto con el presupuesto).
function pintarApus() {
  const vistos = new Set(), html = [];
  const o = { parametros, aiu: calc.opciones.aiu, iva: calc.opciones.iva, regimenIva: calc.opciones.regimenIva, redondeo: proyecto.redondeo || "arriba", proyecto: `${proyecto.codigo} — ${proyecto.nombre}` };
  for (const cap of calc.capitulos) for (const it of cap.items) {
    if (vistos.has(it.apu.codigo)) continue;
    vistos.add(it.apu.codigo);
    html.push(htmlFormatoApu(it.apu, it.res, o));
  }
  $("apus").innerHTML = html.join("");
  document.querySelectorAll("col[data-ancho]").forEach((c) => { c.style.width = `${c.dataset.ancho}%`; });
}

async function descargar() {
  const btn = $("excel");
  btn.disabled = true;
  try {
    const wb = libroProyecto(window.ExcelJS, proyecto, calc, { parametros, aiu: calc.opciones.aiu, iva: calc.opciones.iva, regimenIva: calc.opciones.regimenIva, logo: await logoBase64() });
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${proyecto.codigo} - ${proyecto.nombre.slice(0, 60).replace(/[\\/:*?"<>|]/g, "")}.xlsx` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) { mostrarAlerta($("alerta"), errorAmigable(err)); } finally { btn.disabled = false; }
}
