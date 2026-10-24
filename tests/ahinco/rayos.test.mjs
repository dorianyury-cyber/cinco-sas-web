// AHÍNCO — riesgo por rayos con la NTC 4552-2: valores de las tablas y de las ecuaciones calculados a mano.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CALCULOS, factoresRayos, evaluarRayos, pmsDeKms } from "../../web/ahinco/js/rt-calculos.js";
import * as N from "../../web/ahinco/js/rt-normas.js";

const casi = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} no es ${b}`);
const base = { largo: 30, ancho: 20, alto: 10, ng: 5, ubicacion: "aislada", longLinea: 0, equipoSensible: "Sí", uw: "2.5", suelo: "agricola", incendio: "ordinario", provisiones: "ninguna", panico: "ninguno", tipoEstructura: "otro", sipra: "ninguno", dps: "ninguno", medidas: "ninguna" };

test("área efectiva y descargas sobre la estructura (ecuaciones 5 y 6)", () => {
  const f = factoresRayos(base);
  casi(f.Ad, 30 * 20 + 6 * 10 * 50 + 9 * Math.PI * 100);
  casi(f.ND, 5 * f.Ad * 1e-6);
});

test("la densidad de descargas sale de los días tormentosos si no se digita (ecuación 4)", () => {
  const f = factoresRayos({ ...base, ng: "", nc: 100 });
  casi(f.DDT, 0.0017 * Math.pow(100, 1.56));
  assert.equal(factoresRayos({ ...base, ng: 3, nc: 100 }).DDT, 3);
});

test("área y descargas sobre una línea aérea y una subterránea (Tabla 12 y ecuación 9)", () => {
  const aerea = factoresRayos({ ...base, longLinea: 500, hLinea: 6, trafoLinea: "No" }).lineas[0];
  casi(aerea.Al, (500 - 3 * (0 + 10)) * 6 * 6);
  casi(aerea.Ai, 1000 * 500);
  casi(aerea.NL, 5 * aerea.Al * 1 * 1e-6);
  const sub = factoresRayos({ ...base, longLinea: 400, lineaEnterrada: "Sí", rhoLinea: 400, trafoLinea: "Sí" }).lineas[0];
  casi(sub.Al, (400 - 30) * Math.sqrt(400));
  casi(sub.Ai, 25 * 400 * Math.sqrt(400));
  casi(sub.NL, 5 * sub.Al * 1 * 0.2 * 1e-6);
});

test("PMS escalonado y KMS (Tabla 18, ecuación 12)", () => {
  assert.equal(pmsDeKms(0.5), 1);
  assert.equal(pmsDeKms(0.4), 1);
  assert.equal(pmsDeKms(0.1), 0.9);
  assert.equal(pmsDeKms(0.02), 0.01);
  assert.equal(pmsDeKms(0.0001), 0.0001);
});

test("un SIPRA nivel I reduce PB de 1 a 0,02 y el riesgo de daño físico en esa proporción", () => {
  const f = factoresRayos(base);
  const sin = evaluarRayos(base, f, "ninguno", "ninguno", "ninguna");
  const con = evaluarRayos(base, f, "I", "ninguno", "ninguna");
  casi(con.c1.RB / sin.c1.RB, 0.02);
});

test("R1 solo suma los componentes de sistemas internos en hospitales o con riesgo de explosión", () => {
  const f = factoresRayos(base), fc = factoresRayos({ ...base, criticidad: "hospital" });
  const a = evaluarRayos(base, f, "ninguno", "ninguno", "ninguna"), b = evaluarRayos({ ...base, criticidad: "hospital" }, fc, "ninguno", "ninguno", "ninguna");
  casi(a.R1, a.c1.RA + a.c1.RB + a.c1.RU + a.c1.RV);
  assert.ok(b.R1 > a.R1);
});

test("R2 y R3 solo existen si la estructura presta servicio público o es patrimonio cultural", () => {
  const f = factoresRayos(base);
  assert.equal(evaluarRayos(base, f, "ninguno", "ninguno", "ninguna").R2, null);
  const e2 = { ...base, servicioPublico: "gas_agua", patrimonio: "Sí" };
  const r = evaluarRayos(e2, factoresRayos(e2), "ninguno", "ninguno", "ninguna");
  assert.ok(r.R2 > 0 && r.R3 > 0);
  casi(r.R3, r.c3.RB + r.c3.RV);
});

test("el módulo recomienda la combinación mínima de SIPRA y DPS cuando R1 supera el tolerable", () => {
  const e = { ...base, ng: 12, longLinea: 300, tipoEstructura: "hospital", personasFuera: "Sí" };
  const r = CALCULOS.rayos(e);
  assert.match(r.conclusion, /superan el tolerable/);
  assert.match(r.conclusion, /Con SIPRA nivel/);
  const ok = CALCULOS.rayos({ ...e, sipra: "I", dps: "I" });
  assert.ok(ok.verificaciones.every((v) => v.cumple));
});

test("diseño del SIPRA: esfera, bajantes, electrodo y distancia de separación (NTC 4552-3)", () => {
  assert.equal(N.NIVELES_SIPRA.II.esfera, 30);
  assert.equal(N.L1_ELECTRODO("I", 500), 5);
  casi(N.L1_ELECTRODO("I", 1000), 20);
  casi(N.L1_ELECTRODO("I", 2000), 50);
  casi(N.L1_ELECTRODO("II", 1500), 5 + (45 / 2200) * 700);
  assert.equal(N.L1_ELECTRODO("III", 2500), 5);
  const r = CALCULOS.rayos({ ...base, sipra: "III", rhoSuelo: 100, longBajante: 10, bajantesAnillos: "No" });
  const t = r.tablas.find((x) => /Diseño del SIPRA/.test(x.titulo));
  assert.ok(t.filas.some((f) => /S > 0,40 m/.test(f[1])));       // ki 0,04 × kc 1 / km 1 × 10 m
  assert.ok(t.filas.some((f) => /7 bajantes/.test(f[1])));     // perímetro 100 m / 15 m
});

test("pérdidas L1 típicas de la Tabla 26 y de la Tabla 27", () => {
  const f = factoresRayos({ ...base, tipoEstructura: "hospital", suelo: "marmol", incendio: "alto", provisiones: "manual" });
  casi(f.perdidas.L1.LB, 0.5 * 0.1 * 1 * 0.1);
  casi(f.perdidas.L1.LA, 1e-3 * 1e-2);
  assert.equal(N.LF_TIPO.publico.v, 0.002);
});
