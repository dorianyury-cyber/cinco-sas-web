// AHÍNCO — conductores: el calibre y la protección que trae el diseño se comparan con la carga y
// con la ampacidad corregida (NTC 2050 310.15 y 240.4). Casos inventados con la tabla 310.15(B)(16).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CALCULOS } from "../../web/ahinco/js/rt-calculos.js";

const circuito = (extra) => ({ circuito: "X", descripcion: "Prueba", corriente: 90, continua: "No", material: "Cu", tAisl: 75, tTerm: 75, portadores: 3, tAmb: 30, icc: "", icu: "", ...extra });
const verif = (c) => CALCULOS.conductores({ circuitos: [c] }, { tempAmbiente: 30 }).verificaciones;

test("protección de 160 A sobre 2 AWG de cobre a 75 °C (115 A) no cumple el 240.4", () => {
  const v = verif(circuito({ dis: "Cu:2", protDis: 160 }));
  const p = v.find((x) => /protección del diseño/.test(x.criterio));
  assert.equal(p.cumple, false);
  assert.match(p.limite, /≤ 125 A/); // el valor normalizado inmediato superior a 115 A
});

test("protección de 110 A sobre 2 AWG sí cumple, y el conductor soporta 90 A", () => {
  const v = verif(circuito({ dis: "Cu:2", protDis: 110 }));
  assert.equal(v.find((x) => /protección del diseño/.test(x.criterio)).cumple, true);
  assert.equal(v.find((x) => /soporta la carga/.test(x.criterio)).cumple, true);
});

test("un conductor del diseño de menor capacidad que la carga continua no cumple", () => {
  const v = verif(circuito({ corriente: 100, continua: "Sí", dis: "Cu:2" })); // 125 A requeridos frente a 115 A
  assert.equal(v.find((x) => /soporta la carga/.test(x.criterio)).cumple, false);
});

test("sin conductor del diseño no se agregan verificaciones de diseño", () => {
  assert.equal(verif(circuito({})).some((x) => /del diseño/.test(x.criterio)), false);
});

test("con conductor del diseño, la tabla y la salida adoptan el del diseño y muestran el mínimo aparte", () => {
  const r = CALCULOS.conductores({ circuitos: [circuito({ corriente: 41.2, tAisl: 90, dis: "Cu:2", protDis: 110 })] }, { tempAmbiente: 30 });
  const fila = r.tablas[0].filas[0], enc = r.tablas[0].encabezados;
  assert.equal(fila[enc.indexOf("Conductor adoptado")], "2 AWG");
  assert.equal(fila[enc.indexOf("Mínimo requerido")], "Cu 8 AWG");
  assert.equal(fila[enc.indexOf("Protección")], "110 A");
  assert.match(fila[enc.indexOf("Aislamiento")], /THHN/);
  assert.equal(r.salidas.circuitos[0].calibre, "2");   // lo que lee el unifilar
  assert.equal(r.salidas.circuitos[0].In, 110);
  assert.equal(r.salidas.circuitos[0].calibreMinimo, "8");
});

test("sin conductor del diseño se adopta el mínimo calculado", () => {
  const r = CALCULOS.conductores({ circuitos: [circuito({ corriente: 41.2, tAisl: 90 })] }, { tempAmbiente: 30 });
  assert.equal(r.salidas.circuitos[0].calibre, "8");
  assert.equal(r.salidas.circuitos[0].calibreMinimo, "8");
});
