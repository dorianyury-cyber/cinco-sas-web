// Qué hace cada opción de AHÍNCO, en una frase. Una sola fuente para el
// texto al pasar el mouse en el menú, la línea «para qué sirve» de cada
// sección del proyecto y la página «Cómo usar AHÍNCO».
export const AYUDA = {
  // Lista de proyectos
  todos: "Todos los proyectos, de diseño y de verificación.",
  diseno: "Proyectos en los que Cinco diseña y firma la memoria de cálculo.",
  verificacion: "Revisiones de interventoría al diseño de otro: generan un informe con hallazgos para el diseñador.",
  nuevo: "Crea un diseño o una verificación en blanco y lo lleva al proyecto.",
  rapido: "Un cálculo suelto sin crear proyecto (regulación, cortocircuito, puesta a tierra…). Después puede guardarlo en un proyecto.",
  importar: "Crea un proyecto nuevo desde un archivo .ahinco.json: uno exportado de AHÍNCO o una verificación preparada por fuera. No sirve para los .json del módulo Informes.",
  guia: "Qué hace cada opción de AHÍNCO y el paso a paso para diseñar o verificar.",
  acerca: "Qué calcula AHÍNCO, cómo se comprobó y hasta dónde llega cada cálculo. Léalo antes de firmar.",
  // Dentro de un proyecto
  resumen: "El estado del proyecto de un vistazo: los pasos que faltan, los hallazgos principales, el avance por literal y los cálculos.",
  datos: "Nombre, cliente, ubicación, tipo de proyecto (diseño o verificación) y quién firma. Encabezan el documento.",
  literales: "El contenido que exige el RETIE para el diseño detallado. Cada literal se cubre con cálculos, con texto escrito o se marca «No aplica» con la razón.",
  calculos: "Cada cálculo (regulación, cortocircuito, puesta a tierra, etc.) con sus datos y su verificación contra la norma. «＋ Agregar cálculo» abre el catálogo.",
  textos: "Secciones libres del informe: objeto y alcance, metodología, marco normativo adicional, aspectos conformes, concepto y limitaciones. Las vacías no salen.",
  hallazgosVerificacion: "Lo que no cumple en el diseño revisado: lo que detectan los cálculos y lo que usted agrega a mano. Sale numerado al inicio del informe.",
  hallazgosDiseno: "Criterios de los cálculos que todavía no cumplen. Corríjalos antes de entregar la memoria.",
  documentos: "Ver y descargar la memoria o el informe en PDF y Word, el Excel formulado, exportar el proyecto como .ahinco.json y, en una verificación, radicar el informe en Informes con su número RD.",
  versiones: "Copias fijas del proyecto para cada entrega o revisión: compare qué cambió y qué hallazgos se cerraron, vea la memoria de una versión o restáurela."
};
export const ayudaHallazgos = (verif) => AYUDA[verif ? "hallazgosVerificacion" : "hallazgosDiseno"];
