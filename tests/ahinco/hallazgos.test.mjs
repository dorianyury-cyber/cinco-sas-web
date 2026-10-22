// AHÍNCO — hallazgos manuales: salen después de los automáticos, con la misma numeración.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hallazgos } from "../../web/ahinco/js/rt-hallazgos.js";

const resultados = { cortocircuito: { clave: "cortocircuito", modulo: "cortocircuito", etiqueta: "", verificaciones: [{ criterio: "TGD: capacidad de interrupción", valor: "10 kA", limite: "≥ 19 kA", norma: "NTC 2050 110.9", cumple: false }, { criterio: "Otro", cumple: true }] } };
const proyecto = { modo: "verificacion", hallazgosManuales: [{ id: "a1", titulo: "Resistividad sin medición válida", valor: "2 ohm·m", limite: "Medición Wenner", norma: "RETIE 3.12", literales: "i)", detalle: "Pedir la medición." }], notasHallazgos: {} };

test("los hallazgos manuales siguen a los automáticos y continúan la numeración", () => {
  const l = hallazgos(proyecto, resultados);
  assert.deepEqual(l.map((h) => h.codigo), ["H-1", "H-2"]);
  assert.equal(l[1].manual, true);
  assert.equal(l[1].clave, null);
  assert.equal(l[1].llave, "manual|a1");
  assert.equal(l[1].nota, "Pedir la medición.");
});

test("sin hallazgos manuales todo queda como antes", () => {
  const l = hallazgos({ modo: "verificacion" }, resultados);
  assert.equal(l.length, 1);
  assert.equal(l[0].manual, undefined);
});
