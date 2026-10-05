// Informe mensual de Interventoría PRO en PDF, con portada oscura (navy) o
// clara. Reutiliza TAL CUAL el generador del módulo Informes del Control
// de Contratos (web/js/control/informes-pdf.js: portada a página completa,
// índice con número de página real, lista de tablas y de gráficos,
// encabezado/pie) — aquí solo se traducen los bloques neutros de
// ip-informe-contenido.js al formato de bloques que ese generador ya
// entiende. Así el PDF de Interventoría PRO se ve igual que los demás
// informes de Cinco S.A.S.

import { generarInformePDF } from "../../js/control/informes-pdf.js";
import { construirInforme, finDeMes } from "./ip-informe-contenido.js";

function escHtml(t) {
  return String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

export async function generarInformeMensualPDF({ contrato, ym, datos, elaboradoPor, cargo, portada = "oscura", radicado = "", incluir = null, fotosIncluir = null }) {
  const { titulo, bloques } = await construirInforme({ contrato, ym, datos, elaboradoPor, cargo, incluir, fotosIncluir });
  const firma = bloques.find((b) => b.tipo === "firma");

  const bloquesPdf = [];
  for (const b of bloques) {
    if (b.tipo === "titulo1" || b.tipo === "titulo2") {
      bloquesPdf.push({ tipo: b.tipo, texto: b.texto });
    } else if (b.tipo === "parrafo") {
      const html = escHtml(b.texto).replace(/\n/g, "<br>");
      bloquesPdf.push({ tipo: "parrafo", texto: b.nota ? `<i>${html}</i>` : html });
    } else if (b.tipo === "tabla") {
      bloquesPdf.push({ tipo: "tabla", titulo: b.titulo || "", filas: [b.encabezados, ...b.filas], merges: [], centrados: [], filasEncabezado: 1 });
    } else if (b.tipo === "imagen") {
      bloquesPdf.push({ tipo: "imagen", url: b.dataUrl || b.url, nombre: b.nombre || "", pieDeFoto: "", tamano: b.tamano || 100 });
    } else if (b.tipo === "fotos") {
      // Cuadrícula de 2 fotos por fila (ahorra espacio vertical).
      bloquesPdf.push({ tipo: "galeria", columnas: 2, fotos: b.fotos.map((f) => ({ url: f.url, nombre: f.observacion, pie: f.fecha })) });
    } else if (b.tipo === "firma") {
      bloquesPdf.push({ tipo: "firma", etiqueta: "Elaboró", firmantes: [{ nombre: b.nombre, cargo: `${b.cargo}\n${b.empresa}`, firmaUrl: null }] });
    }
  }

  const doc = await generarInformePDF({
    titulo,
    tipoInforme: "interventoria",
    portada: portada === "clara" ? "clara" : "oscura",
    mes: ym,
    fecha: finDeMes(ym),
    radicado,
    contratoCodigo: contrato.numero || "",
    contratoNombre: contrato.objeto || "",
    contratoCliente: contrato.contratante || "",
    contratoSupervisor: contrato.supervisor || "",
    contratoFechaInicio: contrato.fechaInicio || null,
    contratoFechaFin: contrato.fechaFin || null,
    firmaNombre: firma?.nombre || "",
    firmaCargo: firma?.cargo || "",
    // 1 cm más a la izquierda para archivar en carpeta física.
    margenEncuadernacion: 10,
    bloques: bloquesPdf
  });
  return doc;
}
