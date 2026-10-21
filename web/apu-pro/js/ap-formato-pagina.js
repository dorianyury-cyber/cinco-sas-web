// Vista del APU en formato Cinco: hoja lista para imprimir o guardar en PDF y descarga en
// Excel con fórmulas. AIU e IVA se ajustan en la barra superior.
//   apu-formato.html?c=APU-286          → APU de la biblioteca (precios vigentes)
//   apu-formato.html?p=<proyecto>&i=<ítem> → APU dentro de un proyecto (su copia, parámetros,
//                                          AIU, factor de materiales y precios del proyecto)
import { iniciarPagina, leerApu, leerProyecto, listarInsumos, listarParametros, parametrosVigentes, numero, leerNumero, mostrarAlerta, errorAmigable } from "./ap-core.js";
import { calcularApu } from "./ap-apu.js";
import { resolverInsumo } from "./ap-presupuesto.js";
import { htmlFormatoApu, libroFormatoApus, logoBase64 } from "./ap-formato.js";

const ctx = await iniciarPagina();
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const codigo = q.get("c"), idProyecto = q.get("p"), idItem = q.get("i");
let apu = null, insumo = null, parametros = [], proyecto = null;

if (ctx) {
  try {
    const [ins, par] = await Promise.all([listarInsumos(), listarParametros()]);
    const base = new Map(ins.map((x) => [x.codigo, x]));
    parametros = par;
    if (idProyecto) {
      proyecto = await leerProyecto(idProyecto);
      if (!proyecto) throw new Error("No se encontró el proyecto.");
      const it = (proyecto.capitulos || []).flatMap((c) => c.items || []).find((x) => x.id === idItem);
      if (!it) throw new Error("No se encontró el ítem en el proyecto.");
      apu = it.apu;
      insumo = resolverInsumo(proyecto, base);
      $("volver").href = `proyecto.html?id=${encodeURIComponent(idProyecto)}`;
      $("volver").textContent = `← ${proyecto.codigo}`;
      const pct = (x) => numero(x * 100, 4);
      $("fA").value = pct(proyecto.aiu?.a ?? 0.15); $("fI").value = pct(proyecto.aiu?.i ?? 0.05); $("fU").value = pct(proyecto.aiu?.u ?? 0.05);
      $("fIva").value = pct(proyecto.iva ?? 0.19); $("fRegimen").value = proyecto.regimenIva || "utilidad";
    } else {
      apu = await leerApu(codigo);
      if (!apu) throw new Error(`No existe el APU ${codigo || ""}.`);
      insumo = (c) => base.get(c) || null;
      $("volver").href = `apus.html#${encodeURIComponent(apu.codigo)}`;
    }
    document.title = `${apu.codigo} — formato Cinco`;
    $("fAnio").innerHTML = par.map((p) => `<option value="${p.anio}">${p.anio}</option>`).join("");
    const anio = proyecto?.anioParametros || parametrosVigentes(par)?.anio;
    if (anio) $("fAnio").value = String(anio);
    pintar();
    ["fAnio", "fRegimen"].forEach((id) => $(id).addEventListener("change", pintar));
    ["fA", "fI", "fU", "fIva"].forEach((id) => $(id).addEventListener("input", pintar));
    $("imprimir").addEventListener("click", () => window.print());
    $("excel").addEventListener("click", descargarExcel);
  } catch (err) { mostrarAlerta($("alerta"), errorAmigable(err)); $("hoja").innerHTML = ""; }
}

function opciones() {
  const pct = (id, def) => { const v = leerNumero($(id).value); return (v == null ? def : v) / 100; };
  return {
    parametros: parametros.find((p) => String(p.anio) === $("fAnio").value) || parametrosVigentes(parametros),
    aiu: { a: pct("fA", 15), i: pct("fI", 5), u: pct("fU", 5) }, iva: pct("fIva", 19), regimenIva: $("fRegimen").value, redondeo: proyecto?.redondeo || "arriba",
    proyecto: proyecto ? `${proyecto.codigo} — ${proyecto.nombre}${proyecto.factorMateriales && proyecto.factorMateriales !== 1 ? ` · factor de materiales ${numero(proyecto.factorMateriales, 4)}` : ""}` : null
  };
}
function calcular(o) {
  return calcularApu(apu, { insumo, parametros: o.parametros, factorMateriales: Number(proyecto?.factorMateriales) || 1, redondeo: proyecto?.redondeo || "arriba" });
}

function pintar() {
  const o = opciones();
  $("hoja").innerHTML = htmlFormatoApu(apu, calcular(o), o);
  $("hoja").querySelectorAll("col[data-ancho]").forEach((c) => { c.style.width = `${c.dataset.ancho}%`; });
}

async function descargarExcel() {
  const btn = $("excel");
  btn.disabled = true;
  try {
    const o = { ...opciones(), logo: await logoBase64() };
    const wb = libroFormatoApus(window.ExcelJS, [{ apu, res: calcular(o) }], o);
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${apu.codigo} - ${apu.nombre.slice(0, 60).replace(/[\\/:*?"<>|]/g, "")}.xlsx` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) { mostrarAlerta($("alerta"), errorAmigable(err)); } finally { btn.disabled = false; }
}
