// APU PRO — validación con casos reales que NO van en el repositorio (es público): una oferta
// en PDF con la extracción de referencia de su revisión manual, y un proyecto de Cinco rearmado
// en APU PRO y validado contra su Excel. Los archivos y los valores esperados viven en la carpeta
// APUPRO_VALIDACION (por defecto «APU PRO validacion» en la carpeta del usuario):
//   oferta.pdf, oferta-referencia.json, proyecto.json, esperado.json
// Si la carpeta no existe (por ejemplo en GitHub), estas pruebas se omiten.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { leerPaginas, tablaPresupuesto, leerApus } from "../../web/apu-pro/js/ap-pdf.js";
import * as M from "../../web/apu-pro/js/ap-revision-motor.js";
import { calcularPresupuesto, resolverInsumo } from "../../web/apu-pro/js/ap-presupuesto.js";

const CARPETA = process.env.APUPRO_VALIDACION || path.join(os.homedir(), "APU PRO validacion");
const archivo = (n) => path.join(CARPETA, n);
const hay = (...ns) => ns.every((n) => fs.existsSync(archivo(n)));
const leer = (n) => JSON.parse(fs.readFileSync(archivo(n), "utf8"));
const require = createRequire(import.meta.url);
const n = (s) => String(s || "").replace(/\s+/g, " ").trim();
const SIN = "sin la carpeta de validación local";

test("oferta real en PDF: presupuesto, APU e insumos idénticos a la revisión manual", { skip: !hay("oferta.pdf", "oferta-referencia.json", "esperado.json") && SIN }, async () => {
  const pdfjs = require("../../web/js/vendor/pdfjs/pdf.min.js");
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve("../../web/js/vendor/pdfjs/pdf.worker.min.js");
  const ref = leer("oferta-referencia.json"), esp = leer("esperado.json").oferta;
  const paginas = await leerPaginas(pdfjs, new Uint8Array(fs.readFileSync(archivo("oferta.pdf"))));
  const tp = tablaPresupuesto(paginas);
  const ex = M.extraerItems(tp.matriz, M.detectarColumnas(tp.matriz));
  const items = ref.presup.filter((r) => !r.total);
  assert.equal(ex.items.length, items.length);
  for (const r of items) {
    const it = ex.items.find((i) => i.item === r.apu);
    assert.ok(it, `falta el ítem ${r.apu}`);
    assert.deepEqual([n(it.desc), it.und, it.cant, it.vu, it.vt], [n(r.desc), r.und, r.cant, r.vu, r.vt], `ítem ${r.apu}`);
  }
  const apus = leerApus(paginas);
  assert.equal(apus.length, ref.apus.length);
  const SEC = { EQ: "equipo", MA: "materiales", TR: "transporte", MO: "mano" };
  for (const r of ref.apus) {
    const a = apus.find((x) => x.item === r.item);
    assert.ok(a, `falta el APU ${r.item}`);
    assert.equal(a.cd, r.cd, `costo directo del APU ${r.item}`);
    assert.equal(a.pu, r.pu, `precio del APU ${r.item}`);
    for (const [k, s] of Object.entries(SEC)) {
      const lineas = (r[s] || []).filter((x) => x.vu != null);
      assert.equal((a.secciones[k] || []).length, lineas.length, `${k} del APU ${r.item}`);
      if (k === "MA") lineas.forEach((m, j) => assert.deepEqual([n(a.secciones.MA[j].d), a.secciones.MA[j].c, a.secciones.MA[j].p, a.secciones.MA[j].v], [n(m.d), m.cant, m.pu, m.vu], `material ${j + 1} del APU ${r.item}`));
    }
  }
  // Hallazgos automáticos con los valores de la revisión manual.
  const d = M.datosDesdeApus(ex.items, apus);
  const rev = { ...ex, base: d.base, aiu: d.aiu, iva: d.iva, regimenIva: d.regimenIva, totalDeclarado: esp.totalDeclarado };
  const res = M.revisar(rev, { apus });
  const v = Object.fromEntries(res.verificaciones.map((x) => [x.clave, x]));
  assert.equal(rev.base, esp.base);
  assert.equal(v.total.estado, "ok");
  for (const [clave, valor] of Object.entries(esp.impactos)) assert.equal(Math.round(v[clave].impacto), valor, `impacto de «${clave}»`);
  for (const [clave, texto] of Object.entries(esp.textos)) assert.ok(v[clave].texto.includes(texto), `texto de «${clave}»: ${texto}`);
});

test("proyecto real rearmado: costo directo y total como su Excel", { skip: !hay("proyecto.json", "esperado.json") && SIN }, () => {
  const { proyecto, parametros, insumos } = leer("proyecto.json");
  const esp = leer("esperado.json").proyecto;
  const calc = calcularPresupuesto(proyecto, { insumo: resolverInsumo(proyecto, new Map(Object.entries(insumos))), parametros });
  assert.equal(calc.costoDirecto, esp.costoDirecto);
  assert.equal(Math.round(calc.total), esp.total);
  assert.equal(calc.avisos.length, 0);
});
