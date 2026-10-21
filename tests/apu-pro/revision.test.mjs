// APU PRO — revisión de ofertas: una oferta inventada con un error sembrado por cada
// verificación; cada una debe detectarlo y no debe haber falsos hallazgos en lo que está bien.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../../web/apu-pro/js/ap-revision-motor.js";

// ---------- presupuesto (como lo entrega un oferente: encabezados, capítulos, totales)
const MATRIZ = [
  ["PRESUPUESTO DE OBRA"],
  [],
  ["ITEM", "DESCRIPCIÓN", "UND", "CANT.", "VR. UNITARIO", "VR. TOTAL"],
  ["1", "INSTALACIONES INTERNAS", "", "", "", ""],
  ["1.1", "Suministro e instalación de salida de iluminación", "UN", "10", "$ 100.000", "$ 1.000.000"],
  ["1.2", "Suministro e instalación de salida de tomacorriente", "UN", "10", "$ 90.000", "$ 900.000"],
  ["1.3", "Suministro e instalación de salida de interruptor", "UN", "10", "$ 80.000", "$ 800.000"],
  ["1.4", "Suministro e instalación de salida de datos", "UN", "10", "$ 70.000", "$ 700.000"],
  ["1.5", "Suministro e instalación de salida de emergencia", "UN", "10", "$ 60.000", "$ 600.000"],
  ["1.6", "Suministro e instalación de caja metálica 5800", "UN", "50", "$ 25.000", "$ 1.250.000"],
  ["1.7", "Suministro e instalación de caja metálica 5800", "UN", "20", "$ 25.000", "$ 500.000"],          // repetido en el capítulo
  ["1.8", "Suministro e instalación de tubería EMT 1/2\"", "ML", "100", "$ 12.000", "$ 1.250.000"],        // aritmética: debía ser 1.200.000
  ["", "SUBTOTAL CAPÍTULO 1", "", "", "", "$ 7.000.000"],
  ["2", "OBRAS COMPLEMENTARIAS", "", "", "", ""],
  ["2.1", "Regata en muro para tubería eléctrica", "ML", "40", "$ 50.000", "$ 2.000.000"],
  ["2.2", "Suministro de tablero de distribución", "UN", "1", "$ 900.000", "$ 900.000"],
  ["2.3", "Pruebas y puesta en servicio", "GL", "1", "$ 1.500.000", "$ 1.500.000"],
  ["", "TOTAL COSTO DIRECTO", "", "", "", "$ 11.400.000"],
  ["", "VALOR TOTAL DE LA OFERTA", "", "", "", "$ 15.000.000"]
];

// ---------- APU del oferente
const MO = [{ d: "Técnico electricista", c: 1, p: 150000, r: 10, v: 15000 }, { d: "Ayudante", c: 1, p: 100000, r: 10, v: 10000 }];
const salida = (item, desc, extra) => ({
  item, desc, und: "UN", secciones: {
    MA: [{ d: "CAJA METALICA 5800", u: "und", c: 1, p: 3000, dp: 0, v: 3000 }, { d: "TUBO EMT 1/2\"", u: "m", c: 2, p: extra, dp: 0, v: 2 * extra }],
    MO
  }, sub: {}, aiu: {}
});
const APUS = [
  salida("1.1", "Suministro e instalación de salida de iluminación", 7000),
  salida("1.2", "Suministro e instalación de salida de tomacorriente", 7000),
  salida("1.3", "Suministro e instalación de salida de interruptor", 7000),
  salida("1.4", "Suministro e instalación de salida de datos", 7500),    // mismo tubo, otro precio
  salida("1.5", "Suministro e instalación de salida de emergencia", 7000),
  { item: "1.6", desc: "Suministro e instalación de caja metálica 5800", und: "UN", secciones: { MA: [{ d: "CAJA METALICA 5800", u: "und", c: 1, p: 3000, v: 3000 }, { d: "CHAZO", u: "und", c: 2, p: 200, v: 400 }], MO }, sub: {}, aiu: {} },
  { item: "1.7", desc: "Suministro e instalación de caja metálica 5800", und: "UN", secciones: { MA: [{ d: "CAJA METALICA 5800", u: "und", c: 1, p: 3000, v: 3000 }], MO }, sub: {}, aiu: {} },
  { item: "1.8", desc: "Suministro e instalación de tubería EMT 1/2\"", und: "ML", secciones: { MA: [{ d: "TUBO EMT 1/2\"", u: "m", c: 1, p: 7000, v: 7000 }], MO }, sub: {}, aiu: {} },
  { item: "2.1", desc: "Regata en muro para tubería eléctrica", und: "ML", secciones: { MA: [{ d: "FILTRO PARA ASPIRADORA INDUSTRIAL", u: "und", c: 0.2, p: 150000, v: 30000 }], MO }, sub: {}, aiu: {} },
  { item: "2.2", desc: "Suministro de tablero de distribución", und: "UN", secciones: { MO }, sub: {}, aiu: {} },       // suministro sin materiales
  { item: "2.3", desc: "Pruebas y puesta en servicio", und: "GL", secciones: { MA: [{ d: "Equipo de pruebas completo", u: "Gl", c: 1, p: 500000, v: 500000 }], MO }, sub: {}, aiu: {} },
  { item: "9.9", desc: "APU que no está en el presupuesto", und: "UN", secciones: { MO }, sub: {}, aiu: {} }
];
// Costo directo de cada APU = suma de sus líneas.
for (const a of APUS) a.cd = Object.values(a.secciones).flat().reduce((s, x) => s + x.v, 0);

function revisionDePrueba(extra = {}) {
  const ex = M.extraerItems(MATRIZ, M.detectarColumnas(MATRIZ));
  return { base: "cd", aiu: { a: 0.15, i: 0.05, u: 0.05 }, iva: 0.19, regimenIva: "total", totalDeclarado: ex.totalDetectado, ...ex, ...extra };
}
const porClave = (res) => Object.fromEntries(res.verificaciones.map((v) => [v.clave, v]));

test("números como los escribe un oferente", () => {
  assert.equal(M.aNumero("$ 1.234.567"), 1234567);
  assert.equal(M.aNumero("1.234.567,89"), 1234567.89);
  assert.equal(M.aNumero("3,5"), 3.5);
  assert.equal(M.aNumero("0,317"), 0.317);
  assert.equal(M.aNumero("1.500"), 1500);
  assert.equal(M.aNumero("15%"), 0.15);
  assert.equal(M.aNumero("(2.000)"), -2000);
  assert.equal(M.aNumero("abc"), null);
});

test("lectura de la tabla: encabezados, capítulos, ítems y total declarado", () => {
  const d = M.detectarColumnas(MATRIZ);
  assert.equal(d.fila, 2);
  assert.deepEqual(d.columnas, { item: 0, desc: 1, und: 2, cant: 3, vu: 4, vt: 5 });
  const ex = M.extraerItems(MATRIZ, d);
  assert.equal(ex.items.length, 11);
  assert.deepEqual(ex.capitulos.map((c) => c.nombre), ["INSTALACIONES INTERNAS", "OBRAS COMPLEMENTARIAS"]);
  assert.equal(ex.totalDetectado, 15000000);   // el total de la oferta, no el costo directo
  assert.equal(ex.items.find((i) => i.item === "2.1").cap, "2");
});

test("verificaciones del presupuesto", () => {
  const res = M.revisar(revisionDePrueba());
  const v = porClave(res);
  assert.equal(v.aritmetica.estado, "hallazgo");
  assert.equal(Math.round(v.aritmetica.impacto / res.F.aFinal), 50000);            // 1.250.000 − 1.200.000
  assert.equal(v.repetidos.estado, "hallazgo");
  assert.match(v.repetidos.texto, /1\.6, 1\.7/);
  assert.equal(v.globales.estado, "hallazgo");
  assert.equal(v.iva.estado, "hallazgo");
  assert.equal(Math.round(v.iva.impacto), Math.round(res.comp.cd * 0.19 * 1.2));    // IVA × costo directo × (1 + A + I)
  assert.equal(v.aiu.estado, "ok");
  assert.equal(v.incompletos.estado, "ok");
  // Total: 11.400.000 de costo directo × 1,25 × 1,19 = 16.957.500, distinto del declarado (15.000.000).
  assert.equal(Math.round(res.total), 16957500);
  assert.equal(v.total.estado, "hallazgo");
});

test("la base mal registrada se avisa sin convertirse en hallazgo", () => {
  const ex = M.extraerItems(MATRIZ, M.detectarColumnas(MATRIZ));
  const suma = ex.items.reduce((s, it) => s + it.vt, 0);
  const res = M.revisar(revisionDePrueba({ totalDeclarado: suma, base: "cd" }));   // el total ya es la suma: «precio final»
  assert.equal(res.baseSugerida, "final");
  assert.equal(porClave(res).total.estado, "info");
});

test("verificaciones de los APU del oferente", () => {
  const rev = revisionDePrueba();
  const res = M.revisar(rev, { apus: APUS });
  const v = porClave(res);
  assert.equal(v.apuSinItem.estado, "hallazgo");                                  // 9.9
  assert.equal(v.apuSinMateriales.estado, "hallazgo");
  assert.match(v.apuSinMateriales.texto, /2\.2/);
  assert.equal(v.insumoPrecios.estado, "hallazgo");                               // tubo a 7.000 y a 7.500
  assert.equal(v.accesoriosDobles.estado, "hallazgo");                            // caja en 5 salidas y aparte
  assert.match(v.accesoriosDobles.texto, /CAJA METALICA 5800/);
  assert.equal(v.consumibles.estado, "hallazgo");                                 // filtro: 30.000 de 55.000
  assert.equal(v.obraCivil.estado, "hallazgo");                                   // regata con electricistas
  assert.equal(v.globalesApu.estado, "hallazgo");                                 // equipo de pruebas $500.000
  assert.equal(v.direccion, undefined);                                           // no hay personal de dirección
  assert.equal(v.jornales.estado, "ok");
  const ins = res.apus.insumos.find((e) => e.d === "CAJA METALICA 5800");
  assert.equal(ins.q, 10 * 5 + 50 + 20);                                          // 5 salidas × 10 + 70 cajas aparte
});

test("datos de la oferta deducidos de los APU", () => {
  const ex = M.extraerItems(MATRIZ, M.detectarColumnas(MATRIZ));
  const apus = ex.items.map((it) => ({ item: it.item, desc: it.desc, secciones: {}, sub: {}, cd: it.vu / 1.4875, sai: it.vu / 1.19, pu: it.vu, aiu: { a: { pct: 0.15 }, i: { pct: 0.05 }, u: { pct: 0.05 } }, iva: { pct: 0.19 } }));
  const d = M.datosDesdeApus(ex.items, apus);
  assert.equal(d.base, "final");
  assert.deepEqual(d.aiu, { a: 0.15, i: 0.05, u: 0.05 });
  assert.equal(d.iva, 0.19);
});

test("sugerencias: medidas y material deben coincidir", () => {
  const indice = M.indiceApus([
    { codigo: "A", nombre: "Tubo EMT de 1/2 pulgada", unidad: "m" },
    { codigo: "B", nombre: "Tubo EMT de 1 1/2 pulgada", unidad: "m" },
    { codigo: "C", nombre: "Tubo PVC 1/2", unidad: "m" },
    { codigo: "D", nombre: "Cable de cobre aislado No. 12 AWG THHN", unidad: "m" }
  ]);
  assert.equal(M.sugerirApus({ desc: "TUBO EMT 1/2\"", und: "m" }, indice, 1)[0].codigo, "A");
  const cable = M.sugerirApus({ desc: "CABLE DE COBRE AISLADO NO. 12 LSHF", und: "m" }, indice, 1)[0];
  assert.ok(!cable || cable.puntaje < 0.7, "un cable LSHF no debe confirmarse contra uno THHN");
});

test("hallazgos numerados, informe RD sin caracteres que rompan el PDF y Excel", async () => {
  const rev = revisionDePrueba({ codigo: "RV-T", nombre: "Oferta de prueba", oferente: "Oferente S.A.S.", hallazgos: [{ id: "m1", sev: "Mayor", tema: "Alcance", titulo: "Hallazgo del revisor", hallazgo: "Texto", items: "1.1", impacto: 1000, accion: "Acción" }] });
  const res = M.revisar(rev, { apus: APUS });
  const h = M.hallazgosRevision(rev, res).filter((x) => x.incluir);
  assert.ok(h.every((x) => /^(H|OB)-\d\d$/.test(x.numero)));
  assert.ok(h.some((x) => x.titulo === "Hallazgo del revisor"));
  const inf = M.informeRD(rev, res, M.hallazgosRevision(rev, res), { firmaNombre: "Prueba" });
  assert.equal(inf.tipoInforme, "revisionDisenos");
  assert.equal(JSON.stringify(inf).match(/[≤≥≈→←Ω✓✔✕✖⚠√−]|[\u{1F000}-\u{1FFFF}]/u), null);
  const { createRequire } = await import("node:module");
  const ExcelJS = createRequire(import.meta.url)("../../web/js/vendor/exceljs.min.js");
  const wb = M.libroRevision(ExcelJS, rev, res, M.hallazgosRevision(rev, res), {});
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Resumen", "Hallazgos", "Ítems", "APU oferente", "Insumos"]);
  assert.ok((await wb.xlsx.writeBuffer()).byteLength > 5000);
});

test("hallazgos que comparten ítems se marcan y el total no los suma dos veces", () => {
  const rev = revisionDePrueba({ hallazgos: [{ id: "m1", sev: "Mayor", tema: "Precios", titulo: "Caja cara", hallazgo: "La caja 5800 se cobra a más del doble del mercado.", items: "1.6, 1.7", impacto: 900000, accion: "Ajustar." }] });
  const res = M.revisar(rev, { apus: APUS });
  const h = M.hallazgosRevision(rev, res).filter((x) => x.incluir);
  const caja = h.find((x) => x.titulo === "Caja cara");
  const repetidos = h.find((x) => x.clave === "repetidos");          // 1.6 y 1.7 repetidos en el capítulo
  assert.ok(caja.superpone.includes(repetidos.numero));
  assert.ok(repetidos.superpone.includes(caja.numero));
  const t = M.totalSinDuplicar(h);
  const sumaTodo = h.filter((x) => x.impacto > 0).reduce((s, x) => s + x.impacto, 0);
  assert.ok(t.total <= sumaTodo);
  assert.ok(t.sumados.every((a) => !t.sumados.some((b) => (a.superpone || []).includes(b.numero))), "ningún par sumado se superpone");
  const inf = M.informeRD(rev, res, M.hallazgosRevision(rev, res), {});
  assert.match(JSON.stringify(inf), /Total estimado sin duplicar/);
});
