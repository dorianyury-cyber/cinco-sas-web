// APU PRO — lectura de ofertas en PDF. Se genera con jsPDF un PDF inventado con las
// dificultades reales encontradas (descripciones partidas arriba y abajo de los números,
// títulos de capítulo, encabezados repetidos, página de continuación sin encabezado, totales
// de capítulo, decimales con coma y APU con secciones) y se lee con el mismo pdf.js del sitio.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { leerPaginas, tablaPresupuesto, leerApus } from "../../web/apu-pro/js/ap-pdf.js";
import * as M from "../../web/apu-pro/js/ap-revision-motor.js";

const require = createRequire(import.meta.url);
const { jsPDF } = require("../../web/js/vendor/jspdf.umd.min.js");
const pdfjs = require("../../web/js/vendor/pdfjs/pdf.min.js");
pdfjs.GlobalWorkerOptions.workerSrc = require.resolve("../../web/js/vendor/pdfjs/pdf.worker.min.js");

function ofertaPdf() {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFontSize(7);
  const enc = (y) => { doc.text("Capitulo", 25, y); doc.text("APU", 74, y); doc.text("Descripcion", 214, y); doc.text("Unidad", 365, y); doc.text("Cantidad", 407, y); doc.text("Valor unitario", 457, y); doc.text("Valor total", 529, y); };
  const fila = (y, cap, item, desc, und, cant, vu, vt) => {
    doc.text(cap, 51, y); doc.text(item, 57, y);
    if (desc) doc.text(desc, 106, y);
    doc.text(und, 358, y);
    doc.text(cant, 445, y, { align: "right" }); doc.text(vu, 517, y, { align: "right" }); doc.text(vt, 584, y, { align: "right" });
  };
  // Página 1: título, encabezado, ítems (uno con la descripción partida arriba y abajo).
  doc.text("PRESUPUESTO CAPITULO 1", 249, 40);
  doc.text("Cliente", 19, 55); doc.text("COOPERATIVA DE PRUEBA", 57, 55);
  enc(80);
  doc.text("Suministro e instalacion de tablero trifasico de 18 circuitos con puerta y espacio para", 106, 96);
  fila(100, "1", "1-6", "", "U", "3,00", "$1.847.978", "$5.543.934");
  doc.text("Totalizador", 106, 105);
  fila(125, "1", "1-7", "Suministro e instalacion de interruptor enchufable de 1 x 20 amperios", "U", "31,00", "$65.017", "$2.015.527");
  fila(140, "1", "1-8", "Localizacion y replanteo de red", "Km", "0,317", "$678.734", "$215.159");
  doc.text("TOTAL CAPITULO 1", 445, 160); doc.text("$7.774.620", 584, 160, { align: "right" });
  // Página 2: continuación sin encabezado.
  doc.addPage();
  fila(60, "1", "1-9", "SUMINISTRO E INSTALACION DE TUBERIA EMT DE 1/2\"", "ML", "34,20", "$23.320", "$797.544");
  // Página 3: APU.
  doc.addPage();
  doc.setFontSize(9); doc.text("ANALISIS DE PRECIOS UNITARIOS", 298, 50); doc.setFontSize(7);
  doc.text("ITEM", 51, 245); doc.text("DESCRIPCION", 224, 245); doc.text("UNIDAD", 467, 245); doc.text("CANTIDAD", 526, 245);
  doc.text("1-7", 51, 262); doc.text("Suministro e instalacion de interruptor enchufable de 1 x 20 amperios", 91, 262); doc.text("U", 475, 262); doc.text("31,00", 534, 262);
  doc.text("I. EQUIPO", 26, 287);
  doc.text("DESCRIPCION", 113, 298); doc.text("UNIDAD", 232, 298); doc.text("CANTIDAD", 272, 298); doc.text("RENDIMIENTO", 327, 298); doc.text("VALOR DIA", 463, 298); doc.text("Vr. UNITARIO", 523, 298);
  doc.text("Herramienta Menor", 26, 309); doc.text("Gl", 239, 309); doc.text("1,00", 286, 309); doc.text("15,00", 376, 309); doc.text("$15.000", 465, 309); doc.text("$1.000", 570, 309, { align: "right" });
  doc.text("SUBTOTAL $", 474, 320); doc.text("$1.000", 570, 320, { align: "right" });
  doc.text("II. MATERIALES", 26, 340);
  doc.text("DESCRIPCION", 142, 351); doc.text("UNIDAD", 313, 351); doc.text("CANTIDAD BASE", 350, 351); doc.text("DESPERDICIO", 401, 351); doc.text("PRECIO UNIT.", 459, 351); doc.text("Vr. UNITARIO", 523, 351);
  doc.text("BREAKER ENCHUFABLE 1X20A", 26, 362); doc.text("unid", 318, 362); doc.text("1,00", 383, 362); doc.text("0%", 435, 362); doc.text("$23.503", 488, 362); doc.text("$23.503", 570, 362, { align: "right" });
  doc.text("SUBTOTAL $", 474, 373); doc.text("$23.503", 570, 373, { align: "right" });
  doc.text("IV. MANO DE OBRA", 26, 393);
  doc.text("COD", 26, 404); doc.text("TRABAJADOR", 157, 404); doc.text("CANTIDAD", 262, 404); doc.text("JORNAL", 313, 404); doc.text("PRESTACIONES", 351, 404); doc.text("JORNAL TOTAL", 399, 404); doc.text("RENDIMIENTO", 458, 404); doc.text("Vr. UNITARIO", 522, 404);
  doc.text("1", 85, 415); doc.text("Tecnico electricista", 152, 415); doc.text("1,00", 285, 415); doc.text("$87.545", 324, 415); doc.text("$53.827", 360, 415); doc.text("$141.372", 415, 415); doc.text("15,00", 469, 415); doc.text("$9.425", 570, 415, { align: "right" });
  doc.text("2", 85, 426); doc.text("Ayudante", 164, 426); doc.text("1,00", 285, 426); doc.text("$58.364", 324, 426); doc.text("$38.652", 360, 426); doc.text("$97.016", 419, 426); doc.text("15,00", 469, 426); doc.text("$6.468", 570, 426, { align: "right" });
  doc.text("SUBTOTAL $", 474, 437); doc.text("$15.893", 570, 437, { align: "right" });
  doc.text("TOTAL COSTO DIRECTO $", 422, 452); doc.text("$40.396", 570, 452, { align: "right" });
  doc.text("V. COSTOS INDIRECTOS", 26, 467);
  doc.text("ADMINISTRACION", 26, 478); doc.text("12%", 413, 478); doc.text("$4.848", 490, 478, { align: "right" });
  doc.text("Precio Unitario Total con IVA aproximado al peso $", 344, 500); doc.text("$65.017", 570, 500, { align: "right" });
  return new Uint8Array(doc.output("arraybuffer"));
}

test("presupuesto en PDF: columnas, descripciones partidas, continuación y totales", async () => {
  const paginas = await leerPaginas(pdfjs, ofertaPdf());
  assert.equal(paginas.length, 3);
  const tp = tablaPresupuesto(paginas);
  assert.deepEqual(tp.paginas, [1, 2]);                       // la página de APU no es del presupuesto
  const ex = M.extraerItems(tp.matriz, M.detectarColumnas(tp.matriz));
  const porItem = Object.fromEntries(ex.items.map((it) => [it.item, it]));
  assert.deepEqual(Object.keys(porItem), ["1-6", "1-7", "1-8", "1-9"]);
  assert.equal(porItem["1-6"].desc, "Suministro e instalacion de tablero trifasico de 18 circuitos con puerta y espacio para Totalizador");
  assert.equal(porItem["1-6"].vt, 5543934);
  assert.equal(porItem["1-8"].cant, 0.317);                     // decimal con coma
  assert.equal(porItem["1-9"].und, "ML");                       // página sin encabezado
  assert.equal(ex.totalDetectado, null);                        // el total de capítulo no es el de la oferta
});

test("APU en PDF: secciones, insumos, subtotales y precio", async () => {
  const apus = leerApus(await leerPaginas(pdfjs, ofertaPdf()));
  assert.equal(apus.length, 1);
  const a = apus[0];
  assert.equal(a.item, "1-7");
  assert.match(a.desc, /interruptor enchufable/);
  assert.deepEqual(Object.keys(a.secciones), ["EQ", "MA", "MO"]);
  assert.deepEqual(a.secciones.MA[0], { d: "BREAKER ENCHUFABLE 1X20A", u: "unid", c: 1, p: 23503, r: null, dp: 0, v: 23503 });
  assert.deepEqual(a.secciones.MO.map((x) => [x.d, x.p, x.r, x.v]), [["Tecnico electricista", 141372, 15, 9425], ["Ayudante", 97016, 15, 6468]]);
  assert.deepEqual(a.sub, { EQ: 1000, MA: 23503, MO: 15893 });
  assert.equal(a.cd, 40396);
  assert.equal(a.pu, 65017);
  assert.equal(a.aiu.a.pct, 0.12);
});
