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

test("partir la estructura en dos zonas idénticas no cambia el riesgo (los riesgos de las zonas se suman)", () => {
  const e1 = { ...base, longLinea: 300, personasZona: 40, personasTotal: 40, tipoEstructura: "hospital", provisiones: "manual" };
  const una = evaluarRayos(e1, factoresRayos(e1), "ninguno", "ninguno", "ninguna");
  const e2 = { ...e1, zonas: [{ zona: "Norte", personas: 30 }, { zona: "Sur", personas: 10 }] };
  const dos = evaluarRayos(e2, factoresRayos(e2), "ninguno", "ninguno", "ninguna");
  casi(dos.R1, una.R1, 1e-9);
  assert.equal(dos.zonas.length, 2);
  casi(dos.zonas[0].R1 / dos.zonas[1].R1, 3, 1e-9); // 30 de 40 personas frente a 10 de 40
});

test("una zona con superficie distinta (RU) cambia solo el riesgo de esa zona", () => {
  const e = { ...base, longLinea: 300, personasTotal: 40, zonas: [{ zona: "Concreto", personas: 20 }, { zona: "Alfombra", personas: 20, suelo: "grava" }] };
  const r = evaluarRayos(e, factoresRayos(e), "ninguno", "ninguno", "ninguna");
  assert.ok(r.zonas[0].c1.RU > r.zonas[1].c1.RU * 50);
  casi(r.zonas[0].c1.RB, r.zonas[1].c1.RB, 1e-9);
});

test("acometida sin pantalla como objeto de protección: Ia = 0 y P' = 1; R'2 con la Tabla 31", () => {
  const e = { ...base, longLinea: 400, lineaEnterrada: "No", trafoLinea: "No", ce: "0.5", evaluaServicio: "Sí" };
  const f = factoresRayos(e);
  const r = evaluarRayos(e, f, "ninguno", "ninguno", "ninguna");
  const l = f.lineas[0], s = r.servicios[0], PZ = 0.4; // Uw 2,5 kV sin pantalla (Tabla 20)
  casi(s.R2, f.ND * 1e-2 + f.ND * 1e-3 + l.NL * 1e-2 + l.NL * 1e-3 + Math.max(0, l.NI - l.NL) * PZ * 1e-3, 1e-9);
});

test("acometida apantallada: Ia = 25 n Uw / (Rs Kd Kp) y P' de la Tabla 25", () => {
  const e = { ...base, longLinea: 400, lineaPantalla: "1", kdLinea: "contacto", kpLinea: "ninguna", uwCable: "p1", evaluaServicio: "Sí" };
  const s = evaluarRayos(e, factoresRayos(e), "ninguno", "ninguno", "ninguna").servicios[0];
  casi(s.iaB, 25 * 1 * 15 / 1);                 // 375 kA
  assert.equal(s.PpB, 0.005);                   // escalón de 300 kA
  assert.equal(N.pDeIa(0), 1);
  assert.equal(N.pDeIa(35), 0.6);
  assert.equal(N.pDeIa(1000), 0.001);
  const sin = evaluarRayos({ ...e, lineaPantalla: "ninguna" }, factoresRayos({ ...e, lineaPantalla: "ninguna" }), "ninguno", "ninguno", "ninguna").servicios[0];
  assert.ok(s.R2 < sin.R2);
});

test("sin activar las acometidas no se calculan R'2 ni R'4", () => {
  assert.equal(evaluarRayos(base, factoresRayos(base), "ninguno", "ninguno", "ninguna").servicios.length, 0);
});
