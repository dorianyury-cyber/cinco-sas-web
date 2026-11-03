// Página «Cómo usar AHÍNCO»: paso a paso de cada camino (en el HTML) y
// qué hace cada opción del menú (textos de rt-ayuda.js).
import { iniciarPagina, esc } from "./rt-core.js";
import { menuInicio } from "./rt-shell.js";
import { AYUDA } from "./rt-ayuda.js";

const GRUPOS = [
  ["En la lista de proyectos", [["📁 Todos", "todos"], ["📐 Diseño", "diseno"], ["🔎 Verificación", "verificacion"], ["＋ Nuevo proyecto", "nuevo"], ["⚡ Cálculo rápido", "rapido"], ["⬆ Cargar archivo .ahinco.json", "importar"], ["ℹ Alcance y validación", "acerca"]]],
  ["Dentro de un proyecto", [["◎ Resumen", "resumen"], ["🗂 Datos del proyecto", "datos"], ["📋 Literales a) a x)", "literales"], ["Cálculos y ＋ Agregar cálculo", "calculos"], ["🔎 Hallazgos (verificación)", "hallazgosVerificacion"], ["🛠 Pendientes por corregir (diseño)", "hallazgosDiseno"], ["📄 Documentos", "documentos"], ["🕓 Versiones", "versiones"]]]
];

const ctx = await iniciarPagina();
if (ctx) {
  menuInicio(ctx, { activo: "guia" });
  document.getElementById("opciones").innerHTML = GRUPOS.map(([titulo, items]) => `
    <h3 class="rt-guia-grupo">${esc(titulo)}</h3>
    <dl class="rt-guia-opciones">${items.map(([nombre, k]) => `<dt>${esc(nombre)}</dt><dd>${esc(AYUDA[k])}</dd>`).join("")}</dl>`).join("");
}
