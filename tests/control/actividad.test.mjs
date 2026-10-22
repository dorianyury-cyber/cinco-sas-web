// Control de contratos — bitácora y documentos adjuntos de los ítems (lógica pura).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarArchivo, tipoVisor, esUrlSegura, documentosDeItem, detalleCambio,
  filtrarActividad, personasDe, seccionesDe, armarRegistro, TAMANO_MAXIMO
} from "../../web/js/control/actividad-motor.js";

test("solo se admiten PDF, imágenes, Word y Excel de menos de 25 MB", () => {
  assert.equal(validarArchivo("acta.pdf", 1000).ok, true);
  assert.equal(validarArchivo("foto.JPG", 1000).contentType, "image/jpeg");
  assert.equal(validarArchivo("tabla.xlsx", 1000).ok, true);
  assert.equal(validarArchivo("virus.exe", 1000).ok, false);
  assert.equal(validarArchivo("sin-extension", 1000).ok, false);
  assert.equal(validarArchivo("grande.pdf", TAMANO_MAXIMO).ok, false);
  assert.equal(validarArchivo("vacio.pdf", 0).ok, false);
});

test("PDF e imágenes se ven en la página; Word y Excel se descargan", () => {
  assert.equal(tipoVisor("a.pdf"), "pdf");
  assert.equal(tipoVisor("a.png"), "imagen");
  assert.equal(tipoVisor("a.docx"), "descarga");
  assert.equal(tipoVisor("a.xls"), "descarga");
});

test("solo se aceptan enlaces http(s)", () => {
  assert.equal(esUrlSegura("https://cincosas.sharepoint.com/x"), true);
  assert.equal(esUrlSegura("javascript:alert(1)"), false);
  assert.equal(esUrlSegura("no es url"), false);
});

test("el enlace heredado se muestra como un documento más", () => {
  const docs = documentosDeItem({ documentos: [{ id: "1", nombre: "a.pdf", url: "u" }], enlace: "https://onedrive.live.com/x" });
  assert.equal(docs.length, 2);
  assert.equal(docs[1].heredado, true);
  assert.equal(docs[1].tipo, "enlace");
  assert.equal(documentosDeItem({ enlace: "" }).length, 0);
  assert.equal(documentosDeItem({}).length, 0);
});

test("detalle de un cambio muestra antes y después", () => {
  assert.equal(detalleCambio("Responsable", "", "Ana"), "Responsable: (vacío) → Ana");
});

test("filtros por persona, sección e ítem, del más reciente al más antiguo", () => {
  const regs = [
    { nombre: "Ana", por: "a@x", seccion: "Equipo", itemId: "i1", en: new Date(2026, 0, 1) },
    { nombre: "Luis", por: "l@x", seccion: "Contrato", itemId: "i2", en: new Date(2026, 0, 3) },
    { por: "a@x", seccion: "Contrato", itemId: "i1", en: new Date(2026, 0, 2) }
  ];
  assert.deepEqual(filtrarActividad(regs).map((r) => r.itemId), ["i2", "i1", "i1"]);
  assert.equal(filtrarActividad(regs, { persona: "Ana" }).length, 1);
  assert.equal(filtrarActividad(regs, { seccion: "Contrato" }).length, 2);
  assert.equal(filtrarActividad(regs, { itemId: "i1" }).length, 2);
  assert.deepEqual(personasDe(regs), ["a@x", "Ana", "Luis"]);
  assert.deepEqual(seccionesDe(regs), ["Contrato", "Equipo"]);
});

test("el registro no lleva campos indefinidos", () => {
  const r = armarRegistro({ por: "a@x", tipo: "estado", detalle: "x" });
  assert.deepEqual(Object.keys(r).sort(), ["detalle", "nombre", "por", "tipo"]);
  assert.equal(r.nombre, "a@x");
});
