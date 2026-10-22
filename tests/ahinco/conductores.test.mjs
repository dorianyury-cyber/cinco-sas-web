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
