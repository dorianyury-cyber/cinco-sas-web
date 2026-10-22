// APU PRO — actualización de precios de la base de insumos con casos inventados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { filasPlantilla, COLUMNAS_PLANTILLA, leerFilasPrecios, filasDeCotizacion, proponerDesdeFilas, propuesta, factorIPP, factorManual, proponerIPP } from "../../web/apu-pro/js/ap-precios-motor.js";
import { textoAMatriz } from "../../web/apu-pro/js/ap-revision-motor.js";

const HOY = "2026-10-21";
const INS = [
  { codigo: "MA-1", tipo: "MA", descripcion: "Cable THHN 12 AWG cobre", unidad: "m", precio: 2000, fechaPrecio: "2026-08-01", incluyeIva: true, codigosAnteriores: ["C-12"] },
  { codigo: "MA-2", tipo: "MA", descripcion: "Tubo EMT 1/2 pulgada", unidad: "m", precio: 10000, fechaPrecio: "2025-01-15", incluyeIva: true },
  { codigo: "MA-3", tipo: "MA", descripcion: "Caja metálica 40x40x20", unidad: "und", precio: 5000, fechaPrecio: "2024-03-10", incluyeIva: true },
  { codigo: "MO-1", tipo: "MO", descripcion: "Oficial", unidad: "Día", factorSalarial: 2, precio: 100, fechaPrecio: "2024-01-01" }
];
// IPP mensual de 2024-01 a 2026-09: 100 y +1 por mes (33 puntos).
const IPP = Array.from({ length: 33 }, (_, k) => ({ fecha: `${2024 + Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}-01`, valor: 100 + k }));

test("la plantilla trae una fila por insumo con el precio nuevo en blanco", () => {
  const f = filasPlantilla(INS.slice(0, 2));
  assert.equal(f[0].length, COLUMNAS_PLANTILLA.length);
  assert.deepEqual(f[0].slice(0, 3), ["MA-1", "Cable THHN 12 AWG cobre", "m"]);
  assert.equal(f[0][5], "");
});

test("lee la plantilla llena: las filas sin precio nuevo se omiten", () => {
  const m = [COLUMNAS_PLANTILLA, ["MA-1", "Cable", "m", 2000, "2026-08-01", 2300, "05/10/2026", "Casa Eléctrica", "Sí"], ["MA-2", "Tubo", "m", 10000, "2025-01-15", "", "", "", "Sí"]];
  const r = leerFilasPrecios(m);
  assert.equal(r.filas.length, 1);
  assert.equal(r.omitidas, 1);
  assert.deepEqual([r.filas[0].codigo, r.filas[0].valor, r.filas[0].fecha, r.filas[0].fuente, r.filas[0].iva], ["MA-1", 2300, "2026-10-05", "Casa Eléctrica", true]);
});

test("lee una lista de precios de un proveedor sin códigos", () => {
  const m = [["LISTA DE PRECIOS OCTUBRE"], ["Descripción", "Und", "Vr. Unitario"], ["Cable THHN 12 AWG cobre", "ML", "2.350"], ["Tubo EMT 3/4 pulgada", "ML", "14.800"]];
  const r = leerFilasPrecios(m);
  assert.equal(r.filas.length, 2);
  assert.equal(r.filas[0].valor, 2350);
  assert.equal(r.filas[0].codigo, "");
});

test("empareja por código, por código anterior y por descripción; lo dudoso queda sin marcar", () => {
  const filas = [
    { fila: 2, codigo: "MA-1", desc: "", und: "m", valor: 2100, fecha: "", fuente: "", iva: undefined },
    { fila: 3, codigo: "C-12", desc: "", und: "m", valor: 2100, fecha: "", fuente: "", iva: undefined },
    { fila: 4, codigo: "", desc: "Tubo EMT 1/2 pulgada", und: "m", valor: 10500, fecha: "", fuente: "", iva: undefined },
    { fila: 5, codigo: "", desc: "Cable de cobre THHN calibre 12 AWG", und: "m", valor: 2100, fecha: "", fuente: "", iva: undefined },
    { fila: 6, codigo: "", desc: "Transformador pedestal 300 kVA", und: "und", valor: 50000000, fecha: "", fuente: "", iva: undefined }
  ];
  const r = proponerDesdeFilas(filas, INS, { hoy: HOY });
  assert.deepEqual(r.propuestas.map((p) => [p.codigo, p.metodo]).slice(0, 3), [["MA-1", "codigo"], ["MA-1", "codigo"], ["MA-2", "descripcion"]]);
  const parecido = r.propuestas.find((p) => p.metodo === "parecido");
  assert.equal(parecido?.codigo, "MA-1");
  assert.equal(parecido.aplicar, false);
  assert.equal(r.sinPareja.length, 1);
});

test("alertas: salto de precio, IVA, unidad, fecha futura y precio inválido", () => {
  const salto = propuesta(INS[0], { valor: 2900, fecha: "2026-10-05" }, { hoy: HOY });
  assert.equal(Math.round(salto.variacion * 100), 45);
  assert.equal(salto.aplicar, false);
  assert.ok(salto.alertas.some((a) => /Variación de \+45/.test(a.texto)));
  const normal = propuesta(INS[0], { valor: 2200, fecha: "2026-10-05" }, { hoy: HOY });
  assert.equal(normal.aplicar, true);
  const sinIva = propuesta(INS[0], { valor: 1900, iva: false, fecha: "2026-10-05" }, { hoy: HOY });
  assert.equal(sinIva.valor, 2261); // 1.900 × 1,19
  assert.ok(sinIva.alertas.some((a) => /IVA/.test(a.texto)));
  assert.ok(propuesta(INS[0], { valor: 2100, und: "kg" }, { hoy: HOY }).alertas.some((a) => /Unidad distinta/.test(a.texto)));
  assert.equal(propuesta(INS[0], { valor: 2100, fecha: "2026-12-01" }, { hoy: HOY }).error, true);
  assert.equal(propuesta(INS[0], { valor: 0 }, { hoy: HOY }).error, true);
});

test("IPP: factor entre dos meses, estimación más allá de la serie y tasa manual", () => {
  const f = factorIPP(IPP, "2025-01-20", "2026-01-05"); // 112 → 124
  assert.ok(Math.abs(f.factor - 124 / 112) < 1e-9);
  assert.equal(f.extrapolado, false);
  const g = factorIPP(IPP, "2025-01-20", "2026-12-01"); // pasa del último dato (2026-09)
  assert.equal(g.extrapolado, true);
  assert.ok(g.factor > 132 / 112);
  assert.equal(factorIPP(IPP, "2023-01-01", "2026-01-01"), null); // antes de la serie
  assert.ok(Math.abs(factorManual(0.1, "2025-10-01", "2026-10-01") - 1.1) < 1e-9);
});

test("reajuste por IPP: solo precios antiguos, sin mano de obra, con la fuente marcada", () => {
  const r = proponerIPP(INS, IPP, { hasta: "2026-09-15", tipos: ["MA", "MO"], minMeses: 7, hoy: "2026-09-15" });
  assert.deepEqual(r.propuestas.map((p) => p.codigo), ["MA-2", "MA-3"]); // MA-1 es de hace 1 mes; MO se calcula con parámetros
  const p2 = r.propuestas[0];
  assert.equal(p2.valor, Math.round(10000 * (132 / 112)));
  assert.match(p2.fuente, /^Reajuste por IPP \(2025-01 a 2026-09/);
  assert.equal(p2.metodo, "ipp");
  assert.equal(r.propuestas[1].fecha, "2026-09-15");
  const manual = proponerIPP(INS, IPP, { hasta: "2026-09-15", tasaAnual: 0.05, minMeses: 7, hoy: "2026-09-15" });
  assert.match(manual.propuestas[0].fuente, /tasa anual 5,0 %|tasa anual 5.0 %/);
});

test("cotización pegada: ítems con descripción y valor unitario", () => {
  const texto = ["Item\tDescripción\tUnd\tCant\tValor unitario\tValor total", "1\tCable THHN 12 AWG cobre\tm\t100\t2.350\t235.000", "2\tTubo EMT 1/2 pulgada\tm\t50\t10.800\t540.000", "\t\t\t\tSubtotal\t775.000"].join("\n");
  const filas = filasDeCotizacion(textoAMatriz(texto));
  assert.equal(filas.length, 2);
  assert.deepEqual([filas[1].desc, filas[1].valor], ["Tubo EMT 1/2 pulgada", 10800]);
  const r = proponerDesdeFilas(filas, INS, { hoy: HOY });
  assert.equal(r.propuestas.length, 2);
});

test("la plantilla de Excel se llena y se lee de vuelta", async () => {
  const { createRequire } = await import("node:module");
  const ExcelJS = createRequire(import.meta.url)("../../web/js/vendor/exceljs.min.js");
  const { libroPlantilla } = await import("../../web/apu-pro/js/ap-precios-motor.js");
  const { hojaAMatriz } = await import("../../web/apu-pro/js/ap-revision-motor.js");
  const wb = libroPlantilla(ExcelJS, filasPlantilla(INS.slice(0, 2)));
  const ws = wb.getWorksheet("Precios");
  let h = 1;
  while (ws.getCell(h, 1).value !== "Código") h++; // la tabla empieza debajo del encabezado institucional
  const r1 = h + 1;
  ws.getCell(r1, 6).value = 2300; ws.getCell(r1, 7).value = new Date("2026-10-05T12:00:00Z"); ws.getCell(r1, 8).value = "Casa Eléctrica"; ws.getCell(r1, 9).value = "No";
  assert.deepEqual(wb.worksheets.map((x) => x.name), ["Precios", "Instrucciones"]);
  const leido = new ExcelJS.Workbook();
  await leido.xlsx.load(await wb.xlsx.writeBuffer());
  const r = leerFilasPrecios(hojaAMatriz(leido.getWorksheet("Precios")));
  assert.equal(r.filas.length, 1);
  assert.equal(r.omitidas, 1);
  assert.deepEqual([r.filas[0].codigo, r.filas[0].valor, r.filas[0].fecha, r.filas[0].fuente, r.filas[0].iva], ["MA-1", 2300, "2026-10-05", "Casa Eléctrica", false]);
});
