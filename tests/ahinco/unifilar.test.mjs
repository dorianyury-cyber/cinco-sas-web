// AHÍNCO — diagrama unifilar con varios cálculos de cortocircuito (uno por tablero) y una
// acometida principal entre el transformador y el tablero general. Caso inventado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CALCULOS } from "../../web/ahinco/js/rt-calculos.js";
import { entradasPorDefecto } from "../../web/ahinco/js/rt-modulos.js";
import { svgUnifilar } from "../../web/ahinco/js/rt-grafico.js";

const proyecto = { nombre: "Prueba", altitud: 500, tempAmbiente: 30, modo: "diseno", literales: {} };
const cable = (barra, longitud, icu) => ({ barra, longitud, conductor: "Cu:250", paralelos: 2, canalizacion: "PVC", icu });
const circuito = (circuito, descripcion, icu) => ({ circuito, descripcion, corriente: 100, continua: "Sí", material: "Cu", tAisl: 90, tTerm: 75, portadores: 3, tAmb: 30, icc: 10, icu });

function armar() {
  const ctx = {};
  const correr = (m, entradas) => {
    const r = CALCULOS[m](entradas, proyecto, ctx);
    if (r.salidas && !ctx[m]) ctx[m] = r.salidas;
    if (r.salidas) (ctx[`${m}Todos`] ||= []).push(r.salidas);
    return r;
  };
  correr("transformador", entradasPorDefecto("transformador"));
  correr("conductores", { circuitos: [circuito("AP", "Acometida principal, por juego", 25), circuito("G1", "Acometida gabinete 1, por juego (1 de 2)", 50), circuito("G2", "Acometida gabinete 2, por juego (1 de 2)", 36), circuito("AC", "Área común", 35)] });
  const base = entradasPorDefecto("cortocircuito");
  correr("cortocircuito", { ...base, cables: [cable("Tablero general TGD", 20, 50), cable("Gabinete de medidores 2", 96, 10)] });
  correr("cortocircuito", { ...base, cables: [cable("Tablero general TGD", 20, 50), cable("Gabinete de medidores 1", 20, 10)] });
  return correr("unifilar", { ...entradasPorDefecto("unifilar"), barraCircuitos: "" });
}

test("las barras de todos los cortocircuitos aparecen, ordenadas, bajo el tablero general", () => {
  const g = armar().grafico;
  assert.deepEqual(g.barras.map((b) => b.nombre), ["Bornes BT del transformador", "Tablero general TGD", "Gabinete de medidores 1", "Gabinete de medidores 2"]);
});

test("la acometida principal no es una salida y cada gabinete se une a su alimentador", () => {
  const g = armar().grafico;
  assert.deepEqual(g.circuitos.map((c) => c.nombre), ["AC"]);
  assert.deepEqual(g.barras.slice(2).map((b) => b.alim?.icu), [50, 36]);
});

test("el dibujo incluye el cable y el Icu de cada gabinete", () => {
  const svg = svgUnifilar(armar().grafico);
  assert.match(svg, /Icu 50 kA/);
  assert.match(svg, /Icu 36 kA/);
  assert.match(svg, /96 m/);
});
