// APU PRO — cálculo de APU y de presupuesto con un caso inventado de números redondos, cuyos
// valores se pueden verificar a mano. Correr con: npm test (desde la raíz del repositorio).
import { test } from "node:test";
import assert from "node:assert/strict";
import { jornalMO, valorMensual } from "../../web/apu-pro/js/ap-calculos.js";
import { calcularApu, precioConAiu } from "../../web/apu-pro/js/ap-apu.js";
import { calcularPresupuesto, evaluarCantidad } from "../../web/apu-pro/js/ap-presupuesto.js";

// Salario mínimo 1.000.000, auxilio 100.000, 20 días hábiles, prestaciones 50 %.
const PAR = { anio: 2099, smmlv: 1000000, auxTransporte: 100000, diasHabiles: 20, prestacional: 0.5, auxModo: "fijo" };
const INSUMOS = new Map([
  ["MA-1", { codigo: "MA-1", tipo: "MA", precio: 10000 }],
  ["MA-3", { codigo: "MA-3", tipo: "MA", precio: 1003 }],
  ["MO-1", { codigo: "MO-1", tipo: "MO", factorSalarial: 1 }],
  ["MO-2", { codigo: "MO-2", tipo: "MO", factorSalarial: 3 }],
  ["EH-1", { codigo: "EH-1", tipo: "EH", base: "mensual", precio: 200000 }],
  ["ED-1", { codigo: "ED-1", tipo: "ED", base: "mensual", precio: 6000 }],
  ["TV-1", { codigo: "TV-1", tipo: "TV", base: "unidad", precio: 5000 }],
  ["TV-2", { codigo: "TV-2", tipo: "TV", base: "mensual", precio: 400000 }]
]);
const insumo = (c) => INSUMOS.get(c) || null;
const APU = {
  codigo: "APU-T1", nombre: "APU de prueba", unidad: "U", rendimiento: 4,
  lineas: {
    MA: [{ codigo: "MA-1", cantidad: 3, desperdicio: 0.05 }, { codigo: "MA-3", cantidad: 1 / 3 }],
    MO: [{ codigo: "MO-1", cantidad: 2 }, { codigo: "MO-2", cantidad: 1 }],
    EH: [{ codigo: "EH-1", cantidad: 1 }],
    ED: [{ codigo: "ED-1", modo: "cuadrilla" }],
    TV: [{ codigo: "TV-1", cantidad: 2 }, { codigo: "TV-2", cantidad: 1 }]
  }
};

test("jornal: salario × factor + auxilio (solo factor ≤ 2) ÷ días, más prestaciones", () => {
  assert.equal(jornalMO(1, PAR).total, 82500);               // (1.000.000 + 100.000) / 20 = 55.000 × 1,5
  assert.equal(jornalMO(3, PAR).total, 225000);              // 3.000.000 / 20 = 150.000 × 1,5 (sin auxilio)
  assert.equal(jornalMO(1.5, PAR).total, 120000);            // auxilio una vez: (1.500.000 + 100.000) / 20 × 1,5
  assert.equal(jornalMO(1.5, { ...PAR, auxModo: "porFactor" }).total, 123750); // como CSS 226: auxilio × factor
  assert.equal(jornalMO(0, PAR), null);
});

test("valor mensual: base mensual o compra con vida útil", () => {
  assert.equal(valorMensual({ precio: 200000, base: "mensual" }), 200000);
  assert.equal(valorMensual({ precio: 1200000, base: "vidaUtil", vidaUtilAnios: 2 }), 50000);
});

test("APU: cada capítulo con el método de Cinco y redondeo al peso", () => {
  const r = calcularApu(APU, { insumo, parametros: PAR });
  const total = (t) => r.capitulos[t].map((f) => f.total);
  assert.deepEqual(total("MA"), [31500, 335]);       // 10.000 × 1,05 × 3; 1.003 / 3 = 334,33 → 335 (hacia arriba)
  assert.deepEqual(total("MO"), [41250, 56250]);     // 82.500 × 2 / 4; 225.000 / 4
  assert.deepEqual(total("EH"), [2500]);             // 200.000 × (1 / 20) / 4
  assert.deepEqual(total("ED"), [225]);              // 6.000 × (3 personas / 20) / 4
  assert.deepEqual(total("TV"), [10000, 5000]);      // 5.000 × 2 (por unidad); 400.000 / 20 / 4
  assert.equal(r.costoDirecto, 31500 + 335 + 41250 + 56250 + 2500 + 225 + 10000 + 5000);
  assert.equal(r.avisos.length, 0);
  // Redondeo «normal» (página anterior de Cinco): 334,33 → 334.
  assert.equal(calcularApu(APU, { insumo, parametros: PAR, redondeo: "normal" }).capitulos.MA[1].total, 334);
  // Factor de proyección de materiales: solo afecta los materiales.
  assert.equal(calcularApu(APU, { insumo, parametros: PAR, factorMateriales: 1.1 }).capitulos.MA[0].total, 34650);
});

test("APU: avisa insumos que no están en la base", () => {
  const r = calcularApu({ ...APU, lineas: { MA: [{ codigo: "MA-99", cantidad: 1 }] } }, { insumo, parametros: PAR });
  assert.equal(r.costoDirecto, 0);
  assert.match(r.avisos.join(" "), /MA-99/);
});

test("AIU e IVA sobre la utilidad o sobre el subtotal", () => {
  const u = precioConAiu(1000000, { aiu: { a: 0.15, i: 0.05, u: 0.05 }, iva: 0.19, regimenIva: "utilidad" });
  assert.equal(u.subtotal, 1250000);
  assert.equal(Math.round(u.iva), 9500);             // 19 % de la utilidad (50.000)
  assert.equal(Math.round(u.total), 1259500);
  const t = precioConAiu(1000000, { aiu: { a: 0.15, i: 0.05, u: 0.05 }, iva: 0.19, regimenIva: "total" });
  assert.equal(Math.round(t.total), 1487500);        // 1.250.000 × 1,19
});

test("cantidades con memoria de cálculo", () => {
  assert.equal(evaluarCantidad("10*2 + 22*2 + 7"), 71);
  assert.equal(evaluarCantidad("(3+2)*4"), 20);
  assert.equal(evaluarCantidad("2x3"), 6);
  assert.equal(evaluarCantidad("1.384"), 1384);      // miles con punto
  assert.equal(evaluarCantidad("0,317"), 0.317);     // decimal con coma
  assert.equal(evaluarCantidad("abc"), null);
  assert.equal(evaluarCantidad("2*"), null);
});

test("presupuesto: sitios, subtotales, AIU e IVA", () => {
  const vu = calcularApu(APU, { insumo, parametros: PAR }).costoDirecto;
  const proyecto = {
    aiu: { a: 0.15, i: 0.05, u: 0.05 }, iva: 0.19, regimenIva: "utilidad", factorMateriales: 1, redondeo: "arriba",
    sitios: [{ id: "a", nombre: "Sitio A" }, { id: "b", nombre: "Sitio B" }],
    capitulos: [{ id: "c1", nombre: "Capítulo 1", items: [{ id: "i1", apu: APU, cantidades: { a: { expresion: "2*3" }, b: { valor: 4 } } }] }]
  };
  const c = calcularPresupuesto(proyecto, { insumo, parametros: PAR });
  const it = c.capitulos[0].items[0];
  assert.equal(it.vu, vu);
  assert.deepEqual(it.totales, { a: vu * 6, b: vu * 4 });
  assert.equal(c.costoDirecto, vu * 10);
  assert.equal(Math.round(c.total), Math.round(vu * 10 * 1.25 + vu * 10 * 0.05 * 0.19));
  assert.equal(c.avisos.length, 0);
});
