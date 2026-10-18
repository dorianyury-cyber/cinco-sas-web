// Definición de los módulos de cálculo de AHÍNCO: campos del formulario,
// valores de ejemplo, normas y objeto de cada memoria. El cálculo vive en
// rt-calculos.js (mismo id).
import { opcionesConductor, SISTEMAS_BT } from "./rt-calculos.js";
import * as N from "./rt-normas.js";

const op = (obj) => Object.entries(obj).map(([valor, v]) => ({ valor, texto: v.nombre ?? v }));
const lista = (arr) => arr.map((v) => ({ valor: String(v), texto: String(v) }));
const CALIBRES_OP = N.CALIBRES.map((c) => ({ valor: c, texto: N.etiquetaCalibre(c) }));
const SI_NO = lista(["Sí", "No"]);

export const AREAS = {
  bt: { nombre: "Baja tensión", desc: "Cargas, conductores, protecciones, regulación y canalizaciones", clase: "rt-area-bt" },
  mt: { nombre: "Media tensión", desc: "Transformadores, cortocircuito y coordinación de protecciones", clase: "rt-area-mt" },
  spt: { nombre: "Puesta a tierra y rayos", desc: "Malla de puesta a tierra y análisis de riesgo por rayos", clase: "rt-area-spt" },
  at: { nombre: "Alta tensión", desc: "Coordinación de aislamiento, distancias de seguridad y cálculo mecánico", clase: "rt-area-at" },
  fv: { nombre: "Generación solar fotovoltaica (AGPE / GD)", desc: "Arreglo e inversor, producción y balance energético, conductores DC/AC y conexión a la red según la CREG 174 de 2021", clase: "rt-area-fv" }
};

export const MODULOS = {
  cargas: {
    area: "bt", icono: "📋", titulo: "Cuadro de cargas y demanda",
    objeto: "Determinar la carga instalada, la demanda máxima, el balance de fases y la corriente de diseño del alimentador.",
    normas: ["RETIE — análisis y cuadros de cargas", "NTC 2050 Sección 220 (cálculo de circuitos ramales y alimentadores)", "NTC 2050 430-24 (alimentadores de motores)"],
    campos: [
      { key: "sistema", label: "Sistema", tipo: "select", opciones: op(SISTEMAS_BT), def: "3F208" },
      { key: "desbalanceMax", label: "Desbalance máximo admisible", tipo: "numero", unidad: "%", def: 10 },
      { key: "circuitos", label: "Circuitos", tipo: "tabla", columnas: [
        { key: "circuito", label: "Circ.", tipo: "texto", ancho: 6 }, { key: "descripcion", label: "Descripción", tipo: "texto", ancho: 22 },
        { key: "tipo", label: "Tipo", tipo: "select", opciones: lista(["Alumbrado", "Tomas", "Fuerza", "Motor", "Especial"]), ancho: 11 },
        { key: "cantidad", label: "Cant.", tipo: "numero", ancho: 7 }, { key: "potencia", label: "P unit. (W)", tipo: "numero", ancho: 10 },
        { key: "fp", label: "fp", tipo: "numero", ancho: 7 }, { key: "fd", label: "FD (%)", tipo: "numero", ancho: 8 },
        { key: "fases", label: "Fases", tipo: "select", opciones: lista(["A", "B", "C", "AB", "BC", "CA", "ABC"]), ancho: 8 }
      ], nueva: { tipo: "Tomas", cantidad: 1, potencia: 180, fp: 0.9, fd: 100, fases: "A" }, def: [
        { circuito: "1", descripcion: "Alumbrado oficinas", tipo: "Alumbrado", cantidad: 24, potencia: 36, fp: 0.95, fd: 100, fases: "A" },
        { circuito: "2", descripcion: "Tomas generales", tipo: "Tomas", cantidad: 12, potencia: 180, fp: 0.9, fd: 50, fases: "B" },
        { circuito: "3", descripcion: "Tomas reguladas", tipo: "Tomas", cantidad: 10, potencia: 180, fp: 0.9, fd: 70, fases: "C" },
        { circuito: "4", descripcion: "Aire acondicionado", tipo: "Fuerza", cantidad: 2, potencia: 3500, fp: 0.85, fd: 100, fases: "AB" },
        { circuito: "5", descripcion: "Motobomba 5 HP", tipo: "Motor", cantidad: 1, potencia: 3730, fp: 0.85, fd: 100, fases: "ABC" }
      ] }
    ]
  },
  conductores: {
    area: "bt", icono: "🔌", titulo: "Selección de conductores y protecciones",
    objeto: "Seleccionar el calibre de los conductores y la protección de sobrecorriente de cada circuito, coordinando capacidad de corriente, temperatura de terminales y capacidad de interrupción.",
    normas: ["RETIE — cálculo y coordinación de protecciones", "NTC 2050 Tabla 310-16 y 310-15 (capacidad de corriente y factores de ajuste)", "NTC 2050 110-14(c), 210-19, 215-2, 240-3, 240-4, 240-6"],
    campos: [
      { key: "circuitos", label: "Circuitos", tipo: "tabla", columnas: [
        { key: "circuito", label: "Circ.", tipo: "texto", ancho: 6 }, { key: "descripcion", label: "Descripción", tipo: "texto", ancho: 18 },
        { key: "corriente", label: "I carga (A)", tipo: "numero", ancho: 8 }, { key: "continua", label: "Continua", tipo: "select", opciones: SI_NO, ancho: 7 },
        { key: "material", label: "Mat.", tipo: "select", opciones: lista(["Cu", "Al"]), ancho: 6 }, { key: "tAisl", label: "T aisl. (°C)", tipo: "select", opciones: lista([60, 75, 90]), ancho: 7 },
        { key: "tTerm", label: "T term. (°C)", tipo: "select", opciones: lista([60, 75]), ancho: 7 }, { key: "portadores", label: "Portadores", tipo: "numero", ancho: 7 },
        { key: "tAmb", label: "T amb. (°C)", tipo: "numero", ancho: 7 }, { key: "icc", label: "Icc (kA)", tipo: "numero", ancho: 7 }, { key: "icu", label: "Icu (kA)", tipo: "numero", ancho: 7 }
      ], nueva: { continua: "Sí", material: "Cu", tAisl: 90, tTerm: 75, portadores: 3, tAmb: 30 }, def: [
        { circuito: "AL", descripcion: "Alimentador tablero general", corriente: 120, continua: "Sí", material: "Cu", tAisl: 90, tTerm: 75, portadores: 3, tAmb: 32, icc: 10, icu: 25 },
        { circuito: "1", descripcion: "Alumbrado", corriente: 8, continua: "Sí", material: "Cu", tAisl: 90, tTerm: 60, portadores: 6, tAmb: 32, icc: 5, icu: 10 },
        { circuito: "4", descripcion: "Aire acondicionado", corriente: 17, continua: "Sí", material: "Cu", tAisl: 90, tTerm: 75, portadores: 3, tAmb: 32, icc: 5, icu: 10 }
      ] }
    ]
  },
  regulacion: {
    area: "bt", icono: "📉", titulo: "Regulación de tensión y pérdidas",
    objeto: "Verificar la caída de tensión por tramo y acumulada, y calcular las pérdidas de potencia en los conductores (aplica a baja y media tensión).",
    normas: ["RETIE — cálculos de regulación y pérdidas de energía", "NTC 2050 210-19(a) NPN 4 y 215-2(b) NPN 2", "NTC 2050 Cap. 9 Tabla 9 (resistencia y reactancia)"],
    campos: [
      { key: "sistema", label: "Sistema", tipo: "select", opciones: [{ valor: "3F", texto: "Trifásico" }, { valor: "1F", texto: "Monofásico" }], def: "3F" },
      { key: "tension", label: "Tensión nominal (línea-línea en trifásico)", tipo: "numero", unidad: "V", def: 208 },
      { key: "fp", label: "Factor de potencia", tipo: "numero", def: 0.9 },
      { key: "limiteParcial", label: "Regulación máxima por tramo", tipo: "numero", unidad: "%", def: 3 },
      { key: "limiteTotal", label: "Regulación máxima acumulada", tipo: "numero", unidad: "%", def: 5 },
      { key: "tramos", label: "Tramos (el tramo continúa donde termina otro: «Desde» = «Hasta» del anterior)", tipo: "tabla", columnas: [
        { key: "tramo", label: "Tramo", tipo: "texto", ancho: 6 }, { key: "desde", label: "Desde", tipo: "texto", ancho: 8 }, { key: "hasta", label: "Hasta", tipo: "texto", ancho: 8 },
        { key: "longitud", label: "L (m)", tipo: "numero", ancho: 7 }, { key: "carga", label: "S (kVA)", tipo: "numero", ancho: 7 },
        { key: "conductor", label: "Conductor", tipo: "select", opciones: opcionesConductor(), ancho: 22 }, { key: "paralelos", label: "Paral.", tipo: "numero", ancho: 6 },
        { key: "canalizacion", label: "Canalización", tipo: "select", opciones: [{ valor: "PVC", texto: "PVC o aluminio" }, { valor: "acero", texto: "Acero" }, { valor: "aereo", texto: "Aérea" }], ancho: 10 },
        { key: "dmg", label: "DMG (mm, aérea)", tipo: "numero", ancho: 8 }
      ], nueva: { conductor: "Cu:4/0", paralelos: 1, canalizacion: "PVC" }, def: [
        { tramo: "T1", desde: "Transformador", hasta: "TG", longitud: 25, carga: 112.5, conductor: "Cu:350", paralelos: 1, canalizacion: "PVC" },
        { tramo: "T2", desde: "TG", hasta: "TD-1", longitud: 40, carga: 30, conductor: "Cu:2", paralelos: 1, canalizacion: "PVC" },
        { tramo: "T3", desde: "TD-1", hasta: "Carga final", longitud: 30, carga: 4, conductor: "Cu:10", paralelos: 1, canalizacion: "PVC" }
      ] }
    ]
  },
  canalizaciones: {
    area: "bt", icono: "🧯", titulo: "Canalizaciones (llenado de ductos)",
    objeto: "Dimensionar las canalizaciones para que el área ocupada por los conductores no supere el porcentaje de llenado permitido.",
    normas: ["RETIE — cálculo de canalizaciones", "NTC 2050 Cap. 9 Tablas 1, 4 y 5"],
    campos: [
      { key: "conductores", label: "Conductores por ducto (filas con el mismo ducto se suman)", tipo: "tabla", columnas: [
        { key: "ducto", label: "Ducto", tipo: "texto", ancho: 12 }, { key: "tipo", label: "Tipo de tubería", tipo: "select", opciones: op(N.TUBERIAS), ancho: 22 },
        { key: "tamano", label: "Tamaño adoptado (opcional)", tipo: "select", opciones: [{ valor: "", texto: "Automático" }, ...lista(["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "2-1/2", "3", "3-1/2", "4", "5", "6"])], ancho: 12 },
        { key: "calibre", label: "Calibre", tipo: "select", opciones: CALIBRES_OP, ancho: 12 }, { key: "cantidad", label: "Cantidad", tipo: "numero", ancho: 8 }
      ], nueva: { tipo: "PVC40", calibre: "12", cantidad: 3 }, def: [
        { ducto: "Acometida", tipo: "PVC40", calibre: "350", cantidad: 3 }, { ducto: "Acometida", tipo: "PVC40", calibre: "1/0", cantidad: 1 },
        { ducto: "TG-TD1", tipo: "EMT", calibre: "2", cantidad: 4 }, { ducto: "TG-TD1", tipo: "EMT", calibre: "8", cantidad: 1 }
      ] }
    ]
  },
  transformador: {
    area: "mt", icono: "🔋", titulo: "Dimensionamiento del transformador",
    objeto: "Seleccionar la potencia normalizada del transformador, su cargabilidad, corrientes nominales, cortocircuito en bornes y protecciones primaria y secundaria.",
    normas: ["RETIE — cálculo de transformadores", "NTC 818 / NTC 819 (potencias normalizadas)", "NTC 2050 450-3 (protección de transformadores)"],
    campos: [
      { key: "demanda", label: "Demanda máxima (si se deja vacía, se toma del cuadro de cargas)", tipo: "numero", unidad: "kVA", def: "" },
      { key: "crecimiento", label: "Reserva por crecimiento", tipo: "numero", unidad: "%", def: 20 },
      { key: "tipo", label: "Tipo", tipo: "select", opciones: [{ valor: "trifasico", texto: "Trifásico" }, { valor: "monofasico", texto: "Monofásico" }], def: "trifasico" },
      { key: "vPrimario", label: "Tensión primaria", tipo: "numero", unidad: "kV", def: 13.2 },
      { key: "vSecundario", label: "Tensión secundaria (línea-línea)", tipo: "numero", unidad: "V", def: 208 },
      { key: "impedancia", label: "Impedancia de placa (vacío = típica)", tipo: "numero", unidad: "%", def: "" },
      { key: "potenciaAdoptada", label: "Potencia adoptada (vacío = automática)", tipo: "numero", unidad: "kVA", def: "" },
      { key: "cargaMax", label: "Cargabilidad máxima admisible", tipo: "numero", unidad: "%", def: 80 }
    ]
  },
  cortocircuito: {
    area: "mt", icono: "⚡", titulo: "Cortocircuito (IEC 60909)",
    objeto: "Calcular las corrientes de cortocircuito trifásica, monofásica y pico en las barras del sistema, para especificar la capacidad de interrupción de los equipos.",
    normas: ["RETIE — análisis de cortocircuito y falla a tierra", "IEC 60909-0 (cálculo de corrientes de cortocircuito)", "NTC 2050 110-9"],
    campos: [
      { key: "uMT", label: "Tensión nominal de la red", tipo: "numero", unidad: "kV", def: 13.2 },
      { key: "sk", label: "Potencia de cortocircuito de la red S\"kQ (operador de red)", tipo: "numero", unidad: "MVA", def: 150 },
      { key: "rxRed", label: "Relación R/X de la red", tipo: "numero", def: 0.1 },
      { key: "snTrafo", label: "Potencia del transformador (vacío = módulo Transformador)", tipo: "numero", unidad: "kVA", def: "" },
      { key: "uk", label: "Impedancia ukr (vacío = módulo Transformador)", tipo: "numero", unidad: "%", def: "" },
      { key: "pkTrafo", label: "Pérdidas en el cobre PkrT (vacío = 1,2 % de Sn)", tipo: "numero", unidad: "kW", def: "" },
      { key: "uBT", label: "Tensión del secundario, línea-línea (vacío = módulo Transformador)", tipo: "numero", unidad: "V", def: "" },
      { key: "x0Tierra", label: "X0 del transformador zig-zag del secundario (solo si el secundario es delta)", tipo: "numero", unidad: "Ω", def: "" },
      { key: "z0Trafo", label: "Impedancia de secuencia cero del transformador (fabricante; vacío = igual a ukr)", tipo: "numero", unidad: "%", def: "" },
      { key: "factorC", label: "Factor de tensión c", tipo: "select", opciones: [{ valor: "1.05", texto: "1,05 (BT, tolerancia +6 %)" }, { valor: "1.1", texto: "1,10 (BT +10 % o media/alta tensión)" }], def: "1.05" },
      { key: "icuBornes", label: "Capacidad de interrupción en la barra del secundario", tipo: "numero", unidad: "kA", def: 25 },
      { key: "cables", label: "Cables desde los bornes del transformador (en orden)", tipo: "tabla", columnas: [
        { key: "barra", label: "Barra al final del cable", tipo: "texto", ancho: 16 }, { key: "longitud", label: "L (m)", tipo: "numero", ancho: 8 },
        { key: "conductor", label: "Conductor", tipo: "select", opciones: opcionesConductor().filter((o) => !o.valor.startsWith("aereo")), ancho: 20 },
        { key: "paralelos", label: "Paral.", tipo: "numero", ancho: 7 }, { key: "canalizacion", label: "Canalización", tipo: "select", opciones: [{ valor: "PVC", texto: "PVC o aluminio" }, { valor: "acero", texto: "Acero" }], ancho: 12 },
        { key: "icu", label: "Icu (kA)", tipo: "numero", ancho: 7 }, { key: "r0", label: "R0 (Ω/km, opc.)", tipo: "numero", ancho: 7 }, { key: "x0", label: "X0 (Ω/km, opc.)", tipo: "numero", ancho: 7 }
      ], nueva: { conductor: "Cu:2", paralelos: 1, canalizacion: "PVC" }, def: [
        { barra: "Tablero general TG", longitud: 25, conductor: "Cu:350", paralelos: 1, canalizacion: "PVC", icu: 25 },
        { barra: "Tablero TD-1", longitud: 40, conductor: "Cu:2", paralelos: 1, canalizacion: "PVC", icu: 10 }
      ] },
      { key: "motores", label: "Grupos de motores que aportan al cortocircuito (opcional)", tipo: "tabla", columnas: [
        { key: "barra", label: "Barra (nombre exacto)", tipo: "texto", ancho: 30 }, { key: "potencia", label: "Potencia total (kW)", tipo: "numero", ancho: 16 },
        { key: "tipo", label: "Tipo", tipo: "select", opciones: [{ valor: "BT", texto: "Grupo de BT" }, { valor: "MT", texto: "Motor de MT" }], ancho: 18 },
        { key: "ilr", label: "ILR / IrM", tipo: "numero", ancho: 12 }, { key: "fpEta", label: "η × cos φ", tipo: "numero", ancho: 12 }
      ], nueva: { tipo: "BT", ilr: 5, fpEta: 0.8 }, def: [] },
      { key: "generacion", label: "Generación con inversores que aporta al cortocircuito (opcional; por ejemplo, solar)", tipo: "tabla", columnas: [
        { key: "barra", label: "Barra (nombre exacto)", tipo: "texto", ancho: 40 }, { key: "potencia", label: "Potencia (kVA)", tipo: "numero", ancho: 25 }, { key: "factor", label: "Aporte (× In)", tipo: "numero", ancho: 25 }
      ], nueva: { factor: 1.2 }, def: [] }
    ]
  },
  coordinacion: {
    area: "mt", icono: "⏱️", titulo: "Coordinación de protecciones",
    objeto: "Verificar la selectividad entre protecciones de sobrecorriente con curvas de tiempo inverso, con margen de coordinación entre la protección principal y su respaldo.",
    normas: ["RETIE — cálculo y coordinación de protecciones", "IEC 60255-151 (curvas de tiempo inverso)", "IEEE 242 (Buff Book) — márgenes de coordinación"],
    campos: [
      { key: "cti", label: "Margen de coordinación (CTI)", tipo: "numero", unidad: "s", def: 0.3 },
      { key: "tensionRef", label: "Tensión a la que están referidas las corrientes (la usa el arco eléctrico)", tipo: "numero", unidad: "kV", def: "" },
      { key: "iInrush", label: "Corriente de energización del transformador (opcional, ≈ 8–12 In)", tipo: "numero", unidad: "A", def: "" },
      { key: "protecciones", label: "Protecciones (de aguas abajo hacia aguas arriba, referidas a la misma tensión; curva por puntos: «I:t; I:t» en A y s, curva de despeje total del fabricante)", tipo: "tabla", columnas: [
        { key: "nombre", label: "Protección", tipo: "texto", ancho: 14 }, { key: "tipo", label: "Tipo", tipo: "select", opciones: lista(["Fase", "Tierra (51N)"]), ancho: 10 }, { key: "curva", label: "Curva", tipo: "select", opciones: op(N.CURVAS_IEC), ancho: 16 },
        { key: "pickup", label: "I arranque (A)", tipo: "numero", ancho: 8 }, { key: "tms", label: "TMS / TD / t (s)", tipo: "numero", ancho: 7 },
        { key: "inst", label: "I inst. (A)", tipo: "numero", ancho: 8 }, { key: "tinst", label: "t inst. (s)", tipo: "numero", ancho: 7 },
        { key: "puntos", label: "Curva por puntos I:t", tipo: "texto", ancho: 20 }
      ], nueva: { tipo: "Fase", curva: "SI", tms: 0.1 }, def: [
        { nombre: "Fusible del ramal 40K", tipo: "Fase", curva: "PUNTOS", puntos: "80:300; 95:60; 125:12; 190:3; 320:0.8; 640:0.15; 1300:0.04; 2600:0.016" },
        { nombre: "Relé del alimentador", tipo: "Fase", curva: "SI", pickup: 200, tms: 0.1, inst: 3000, tinst: 0.05 },
        { nombre: "Relé de la subestación", tipo: "Fase", curva: "SI", pickup: 400, tms: 0.25, inst: "", tinst: "" },
        { nombre: "51N del alimentador", tipo: "Tierra (51N)", curva: "IVI", pickup: 40, tms: 2, inst: "", tinst: "" },
        { nombre: "51N de la subestación", tipo: "Tierra (51N)", curva: "IVI", pickup: 80, tms: 3, inst: "", tinst: "" }
      ] },
      { key: "fallas", label: "Corrientes de falla a verificar", tipo: "tabla", columnas: [
        { key: "punto", label: "Punto de falla", tipo: "texto", ancho: 30 }, { key: "tipo", label: "Falla", tipo: "select", opciones: lista(["Trifásica", "A tierra"]), ancho: 12 }, { key: "corriente", label: "I (A)", tipo: "numero", ancho: 10 }, { key: "desde", label: "Protección más cercana (vacío = la primera)", tipo: "texto", ancho: 22 }
      ], nueva: {}, def: [{ punto: "Falla en el ramal", tipo: "Trifásica", corriente: 800, desde: "Fusible del ramal 40K" }, { punto: "Falla al final del alimentador", tipo: "Trifásica", corriente: 1500, desde: "Relé del alimentador" }, { punto: "Falla en la salida del alimentador", tipo: "Trifásica", corriente: 2800, desde: "Relé del alimentador" }, { punto: "Falla a tierra en el ramal", tipo: "A tierra", corriente: 600, desde: "Fusible del ramal 40K" }] }
    ]
  },
  malla: {
    area: "spt", icono: "🌐", titulo: "Malla de puesta a tierra (IEEE 80)",
    objeto: "Diseñar la malla de puesta a tierra para que las tensiones de paso y de contacto sean menores que las tolerables por el cuerpo humano, y verificar su resistencia y la sección del conductor.",
    normas: ["RETIE — cálculo del sistema de puesta a tierra y valores de referencia de resistencia", "IEEE 80-2013 (seguridad en puesta a tierra de subestaciones; §13.4 y Anexo E: suelo no uniforme; §15 y Anexo C: división de corriente)", "IEEE 81-2012 / NTC 4552 (medición de resistividad e interpretación en dos capas)"],
    campos: [
      { key: "tipoInstalacion", label: "Tipo de instalación (valor de referencia RETIE)", tipo: "select", opciones: op(N.RETIE_RESISTENCIA_SPT), def: "subMT" },
      { key: "modeloSuelo", label: "Modelo del suelo", tipo: "select", opciones: [{ valor: "uniforme", texto: "Uniforme (resistividad digitada)" }, { valor: "dosCapas", texto: "Dos capas a partir de mediciones Wenner (IEEE 81)" }], def: "uniforme" },
      { key: "rho", label: "Resistividad del suelo ρ (suelo uniforme)", tipo: "numero", unidad: "Ω·m", def: 100, soloSi: { modeloSuelo: "uniforme" } },
      { key: "mediciones", label: "Mediciones Wenner (separación a y resistividad aparente ρa = 2π a R)", tipo: "tabla", soloSi: { modeloSuelo: "dosCapas" }, columnas: [
        { key: "a", label: "Separación a (m)", tipo: "numero", ancho: 42 }, { key: "rhoA", label: "ρa medida (Ω·m)", tipo: "numero", ancho: 42 }
      ], nueva: {}, def: [{ a: 0.3, rhoA: 300 }, { a: 0.9, rhoA: 299.7 }, { a: 1.5, rhoA: 298.5 }, { a: 3, rhoA: 289.9 }, { a: 4.5, rhoA: 272.6 }, { a: 6.1, rhoA: 248.7 }, { a: 9.1, rhoA: 203.6 }, { a: 15.2, rhoA: 144.2 }, { a: 21.3, rhoA: 120.4 }, { a: 27.4, rhoA: 110.2 }, { a: 33.5, rhoA: 107.3 }, { a: 39.6, rhoA: 104.5 }, { a: 45.7, rhoA: 103.4 }] },
      { key: "rhoS", label: "Resistividad de la capa superficial ρs (0 = sin capa)", tipo: "numero", unidad: "Ω·m", def: 3000 },
      { key: "hs", label: "Espesor de la capa superficial", tipo: "numero", unidad: "m", def: 0.1 },
      { key: "ifalla", label: "Corriente de falla a tierra 3I0", tipo: "numero", unidad: "A", def: 3000 },
      { key: "sfModo", label: "Factor de división de corriente Sf", tipo: "select", opciones: [{ valor: "digitado", texto: "Digitado" }, { valor: "calculado", texto: "Calculado con cables de guarda y neutros (Endrenyi, IEEE 80)" }], def: "digitado" },
      { key: "sf", label: "Sf digitado", tipo: "numero", unidad: "%", def: 60, soloSi: { sfModo: "digitado" } },
      { key: "nLineas", label: "Líneas con cable de guarda conectado a la malla", tipo: "numero", def: 1, soloSi: { sfModo: "calculado" } },
      { key: "zsLineaR", label: "Cable de guarda: resistencia propia por vano (con retorno por tierra)", tipo: "numero", unidad: "Ω", def: 1.24, soloSi: { sfModo: "calculado" } },
      { key: "zsLineaX", label: "Cable de guarda: reactancia propia por vano", tipo: "numero", unidad: "Ω", def: 0.55, soloSi: { sfModo: "calculado" } },
      { key: "rtg", label: "Resistencia de puesta a tierra de cada torre", tipo: "numero", unidad: "Ω", def: 10, soloSi: { sfModo: "calculado" } },
      { key: "nAlim", label: "Alimentadores con neutro conectado a la malla", tipo: "numero", def: 1, soloSi: { sfModo: "calculado" } },
      { key: "zsAlimR", label: "Neutro: resistencia propia por vano", tipo: "numero", unidad: "Ω", def: 0.11, soloSi: { sfModo: "calculado" } },
      { key: "zsAlimX", label: "Neutro: reactancia propia por vano", tipo: "numero", unidad: "Ω", def: 0.11, soloSi: { sfModo: "calculado" } },
      { key: "rdg", label: "Resistencia de puesta a tierra de cada poste del alimentador", tipo: "numero", unidad: "Ω", def: 25, soloSi: { sfModo: "calculado" } },
      { key: "xr", label: "Relación X/R en el punto de falla", tipo: "numero", def: 10 },
      { key: "tf", label: "Duración de la falla (tensiones tolerables)", tipo: "numero", unidad: "s", def: 0.5 },
      { key: "tc", label: "Duración de la falla (dimensionamiento del conductor)", tipo: "numero", unidad: "s", def: 1 },
      { key: "lx", label: "Largo de la malla", tipo: "numero", unidad: "m", def: 20 },
      { key: "ly", label: "Ancho de la malla", tipo: "numero", unidad: "m", def: 15 },
      { key: "d", label: "Espaciamiento entre conductores", tipo: "numero", unidad: "m", def: 3 },
      { key: "h", label: "Profundidad de enterramiento", tipo: "numero", unidad: "m", def: 0.5 },
      { key: "calibre", label: "Calibre del conductor", tipo: "select", opciones: Object.keys(N.DIAMETRO_COBRE_DESNUDO).map((c) => ({ valor: c, texto: N.etiquetaCalibre(c) })), def: "2/0" },
      { key: "material", label: "Material del conductor", tipo: "select", opciones: op(N.MATERIALES_SPT), def: "cuDuro" },
      { key: "ta", label: "Temperatura ambiente", tipo: "numero", unidad: "°C", def: 40 },
      { key: "varillas", label: "Número de varillas", tipo: "numero", def: 8 },
      { key: "lVarilla", label: "Longitud de cada varilla", tipo: "numero", unidad: "m", def: 2.4 },
      { key: "varillasPerimetro", label: "Varillas en el perímetro", tipo: "select", opciones: SI_NO, def: "Sí" },
      { key: "peso", label: "Peso de la persona (criterio)", tipo: "select", opciones: [{ valor: "50", texto: "50 kg (acceso público)" }, { valor: "70", texto: "70 kg (personal calificado)" }], def: "50" }
    ]
  },
  rayos: {
    area: "spt", icono: "🌩️", titulo: "Análisis de riesgo por rayos",
    objeto: "Evaluar el riesgo de pérdida de vidas humanas (R1) por descargas atmosféricas y definir el nivel del sistema de protección contra rayos y de los DPS necesarios para que el riesgo sea tolerable.",
    normas: ["RETIE — análisis de riesgo por rayos y protección contra rayos", "NTC 4552-1/-2/-3 (protección contra descargas eléctricas atmosféricas)", "IEC 62305-2 (gestión del riesgo)"],
    campos: [
      { key: "largo", label: "Largo de la estructura", tipo: "numero", unidad: "m", def: 30 },
      { key: "ancho", label: "Ancho de la estructura", tipo: "numero", unidad: "m", def: 15 },
      { key: "alto", label: "Altura de la estructura", tipo: "numero", unidad: "m", def: 9 },
      { key: "ng", label: "Densidad de descargas a tierra NG (mapa NTC 4552-1)", tipo: "numero", unidad: "descargas/km²·año", def: 8 },
      { key: "ubicacion", label: "Ubicación relativa", tipo: "select", opciones: op(N.CD_UBICACION), def: "rodeada_iguales" },
      { key: "longLinea", label: "Longitud de la línea de servicio", tipo: "numero", unidad: "m", def: 500 },
      { key: "lineaEnterrada", label: "Línea de servicio enterrada", tipo: "select", opciones: SI_NO, def: "No" },
      { key: "ce", label: "Factor ambiental de la línea CE", tipo: "select", opciones: [{ valor: "1", texto: "Rural (1)" }, { valor: "0.5", texto: "Suburbano (0,5)" }, { valor: "0.1", texto: "Urbano (0,1)" }, { valor: "0.01", texto: "Urbano con edificios altos (0,01)" }], def: "0.5" },
      { key: "trafoLinea", label: "Transformador AT/BT en la línea", tipo: "select", opciones: SI_NO, def: "Sí" },
      { key: "tipoEstructura", label: "Tipo de estructura", tipo: "select", opciones: op(N.LF_TIPO), def: "otro" },
      { key: "personasZona", label: "Personas en la zona", tipo: "numero", def: 20 },
      { key: "personasTotal", label: "Personas en toda la estructura", tipo: "numero", def: 20 },
      { key: "horas", label: "Horas por año de presencia", tipo: "numero", unidad: "h", def: 2920 },
      { key: "suelo", label: "Tipo de superficie", tipo: "select", opciones: op(N.RT_SUELO), def: "agricola" },
      { key: "incendio", label: "Riesgo de incendio", tipo: "select", opciones: op(N.RF_INCENDIO), def: "ordinario" },
      { key: "provisiones", label: "Provisiones contra incendio", tipo: "select", opciones: op(N.RP_PROVISIONES), def: "manual" },
      { key: "panico", label: "Peligro especial", tipo: "select", opciones: op(N.HZ_PANICO), def: "ninguno" },
      { key: "sipra", label: "Sistema de protección externo (SIPRA) adoptado", tipo: "select", opciones: op(N.PB_SIPRA), def: "III" },
      { key: "dps", label: "DPS coordinados adoptados", tipo: "select", opciones: op(N.PEB_DPS), def: "II" },
      { key: "medidas", label: "Medidas contra tensiones de paso y contacto", tipo: "select", opciones: op(N.PTA_MEDIDAS), def: "avisos" }
    ]
  },
  aislamiento: {
    area: "at", icono: "🛡️", titulo: "Coordinación de aislamiento y DPS",
    objeto: "Seleccionar el descargador de sobretensiones (DPS) y verificar el margen de protección del aislamiento de los equipos frente a sobretensiones temporales y de impulso tipo rayo, corregido por altitud.",
    normas: ["RETIE — análisis de coordinación de aislamiento", "IEC 60071-1 y 60071-2 (coordinación de aislamiento)", "IEC 60099-4 / 60099-5 (descargadores)", "IEEE C62.22"],
    campos: [
      { key: "um", label: "Tensión máxima del equipo Um", tipo: "select", opciones: lista(Object.keys(N.NIVELES_AISLAMIENTO)), def: "36" },
      { key: "us", label: "Tensión máxima de operación del sistema Us (vacío = Um)", tipo: "numero", unidad: "kV", def: "" },
      { key: "puestaTierra", label: "Puesta a tierra del neutro", tipo: "select", opciones: [{ valor: "solido", texto: "Sólida (k = 1,3)" }, { valor: "efectiva", texto: "Efectiva (k = 1,4)" }, { valor: "aislado", texto: "Aislado o no efectiva (k = 1,73)" }], def: "efectiva" },
      { key: "altitud", label: "Altitud del sitio (vacío = la del proyecto)", tipo: "numero", unidad: "m", def: "" },
      { key: "bil", label: "BIL del equipo protegido", tipo: "numero", unidad: "kV", def: 170 },
      { key: "ur", label: "DPS: tensión asignada Ur", tipo: "numero", unidad: "kV", def: 30 },
      { key: "uc", label: "DPS: tensión de operación continua Uc", tipo: "numero", unidad: "kV", def: 24.4 },
      { key: "ures", label: "DPS: tensión residual a 10 kA (8/20 µs)", tipo: "numero", unidad: "kV", def: 79 },
      { key: "capTov", label: "Capacidad TOV del DPS (p.u. de Ur, a la duración de la falla)", tipo: "numero", def: 1.1 },
      { key: "distancia", label: "Separación entre DPS y equipo", tipo: "numero", unidad: "m", def: 3 },
      { key: "pendiente", label: "Pendiente de la onda incidente", tipo: "numero", unidad: "kV/µs", def: 500 }
    ]
  },
  distancias: {
    area: "at", icono: "📏", titulo: "Distancias de seguridad",
    objeto: "Verificar que las distancias de diseño de las partes energizadas cumplan las distancias mínimas de seguridad del RETIE.",
    normas: ["RETIE — distancias de seguridad (distancias mínimas en zonas con construcciones y vías)"],
    campos: [
      { key: "altitud", label: "Altitud del sitio (vacío = la del proyecto)", tipo: "numero", unidad: "m", def: "" },
      { key: "puntos", label: "Puntos a verificar", tipo: "tabla", columnas: [
        { key: "punto", label: "Punto", tipo: "texto", ancho: 18 }, { key: "tension", label: "Tensión (kV)", tipo: "select", opciones: N.RETIE_DISTANCIAS.tensiones.map((t) => ({ valor: t, texto: t === "<1" ? "< 1 kV" : `${t} kV` })), ancho: 9 },
        { key: "tipo", label: "Tipo de distancia", tipo: "select", opciones: op(N.RETIE_DISTANCIAS.tipos), ancho: 32 },
        { key: "diseno", label: "Diseño (m)", tipo: "numero", ancho: 9 }, { key: "exigida", label: "Exigida (m, opcional)", tipo: "numero", ancho: 10 }
      ], nueva: { tension: "13.2", tipo: "e" }, def: [
        { punto: "Cruce de vía principal", tension: "13.2", tipo: "e", diseno: 6.2 },
        { punto: "Fachada de vivienda", tension: "13.2", tipo: "b", diseno: 2.5 },
        { punto: "Acometida BT sobre andén", tension: "<1", tipo: "e", diseno: 5.2 }
      ] }
    ]
  },
  mecanico: {
    area: "at", icono: "🏗️", titulo: "Cálculo mecánico de conductores",
    objeto: "Calcular las tensiones mecánicas y las flechas del conductor en las hipótesis de temperatura y viento, mediante la ecuación de cambio de estado, y verificar los límites de tensión y la distancia al suelo.",
    normas: ["RETIE — cálculo mecánico de estructuras y distancias de seguridad", "Criterios CIGRÉ (tensión de cada día, EDS)", "Ecuación de cambio de estado (método parabólico)"],
    campos: [
      { key: "conductor", label: "Conductor", tipo: "select", opciones: [...op(N.CONDUCTORES_AEREOS), { valor: "personalizado", texto: "Personalizado (digitar datos)" }], def: "linnet" },
      { key: "area", label: "Área (personalizado)", tipo: "numero", unidad: "mm²", def: "", soloSi: { conductor: "personalizado" } },
      { key: "diametro", label: "Diámetro (personalizado)", tipo: "numero", unidad: "mm", def: "", soloSi: { conductor: "personalizado" } },
      { key: "peso", label: "Peso (personalizado)", tipo: "numero", unidad: "kg/m", def: "", soloSi: { conductor: "personalizado" } },
      { key: "rotura", label: "Carga de rotura (personalizado)", tipo: "numero", unidad: "kgf", def: "", soloSi: { conductor: "personalizado" } },
      { key: "modulo", label: "Módulo de elasticidad (personalizado)", tipo: "numero", unidad: "N/mm²", def: "", soloSi: { conductor: "personalizado" } },
      { key: "alfa", label: "Coeficiente de dilatación (personalizado)", tipo: "numero", unidad: "1/°C", def: "", soloSi: { conductor: "personalizado" } },
      { key: "vano", label: "Vano de diseño", tipo: "numero", unidad: "m", def: 150 },
      { key: "eds", label: "Tensión de cada día (EDS)", tipo: "numero", unidad: "% rotura", def: 18 },
      { key: "edsMax", label: "EDS máxima admisible", tipo: "numero", unidad: "%", def: 22 },
      { key: "alturaAmarre", label: "Altura de amarre del conductor (opcional)", tipo: "numero", unidad: "m", def: 11 },
      { key: "distanciaMin", label: "Distancia mínima al suelo exigida (opcional)", tipo: "numero", unidad: "m", def: 5.6 },
      { key: "hipotesis", label: "Hipótesis de cálculo (la que contiene «EDS» es la condición inicial)", tipo: "tabla", columnas: [
        { key: "nombre", label: "Hipótesis", tipo: "texto", ancho: 24 }, { key: "temperatura", label: "Temperatura (°C)", tipo: "numero", ancho: 12 }, { key: "viento", label: "Presión de viento (Pa)", tipo: "numero", ancho: 14 }
      ], nueva: { temperatura: 25, viento: 0 }, def: [
        { nombre: "Temperatura mínima", temperatura: 10, viento: 0 }, { nombre: "EDS (temperatura media)", temperatura: 25, viento: 0 },
        { nombre: "Viento máximo", temperatura: 15, viento: 390 }, { nombre: "Temperatura máxima (flecha máxima)", temperatura: 75, viento: 0 }
      ] }
    ]
  },
  trafoPotencia: {
    area: "at", icono: "🏭", titulo: "Transformador de potencia",
    objeto: "Verificar las corrientes nominales por etapa de refrigeración y toma, el cortocircuito pasante con la impedancia de la red, y la coherencia de los transformadores de corriente y de los equipos en serie con cada devanado.",
    normas: ["RETIE — cálculo de transformadores", "IEC 60076-1 / -5 / -7 (transformadores de potencia, cortocircuito y cargabilidad)", "IEC 61869-2 (transformadores de corriente)", "IEC 62271-1 (equipos de maniobra)"],
    campos: [
      { key: "sOnan", label: "Potencia ONAN", tipo: "numero", unidad: "MVA", def: 40 },
      { key: "sOnaf", label: "Potencia ONAF", tipo: "numero", unidad: "MVA", def: 50 },
      { key: "uAT", label: "Tensión AT", tipo: "numero", unidad: "kV", def: 115 },
      { key: "uMT", label: "Tensión MT", tipo: "numero", unidad: "kV", def: 34.5 },
      { key: "tapRango", label: "Rango de tomas (±)", tipo: "numero", unidad: "%", def: 12.5 },
      { key: "uk", label: "Impedancia de cortocircuito uk", tipo: "numero", unidad: "%", def: 9.5 },
      { key: "ukBase", label: "Potencia base de uk", tipo: "select", opciones: [{ valor: "ONAN", texto: "ONAN" }, { valor: "ONAF", texto: "ONAF" }], def: "ONAN" },
      { key: "ikRed", label: "Cortocircuito de la red en la barra AT Ik\"", tipo: "numero", unidad: "kA", def: 40 },
      { key: "factorC", label: "Factor de tensión c", tipo: "numero", def: 1.1 },
      { key: "ikSoporta", label: "Soportabilidad al cortocircuito especificada, lado AT (opcional)", tipo: "numero", unidad: "kA", def: "" },
      { key: "tSoporta", label: "Duración de la soportabilidad", tipo: "numero", unidad: "s", def: 2 },
      { key: "demanda", label: "Demanda proyectada (opcional)", tipo: "numero", unidad: "MVA", def: "" },
      { key: "crecimiento", label: "Crecimiento sobre la demanda", tipo: "numero", unidad: "%", def: 0 },
      { key: "cargaMax", label: "Cargabilidad máxima admisible (ONAF)", tipo: "numero", unidad: "%", def: 100 },
      { key: "tcs", label: "Transformadores de corriente", tipo: "tabla", columnas: [
        { key: "nombre", label: "TC", tipo: "texto", ancho: 16 }, { key: "lado", label: "Lado", tipo: "select", opciones: lista(["AT", "MT"]), ancho: 7 },
        { key: "funcion", label: "Función", tipo: "select", opciones: lista(["Protección", "Medida"]), ancho: 11 },
        { key: "primaria", label: "Ipn (A)", tipo: "numero", ancho: 8 }, { key: "alf", label: "ALF (5P20 = 20)", tipo: "numero", ancho: 9 }
      ], nueva: { lado: "MT", funcion: "Protección", alf: 20 }, def: [
        { nombre: "TC bahía AT", lado: "AT", funcion: "Protección", primaria: 400, alf: 20 },
        { nombre: "TC celda MT", lado: "MT", funcion: "Protección", primaria: 1000, alf: 20 }
      ] },
      { key: "equipos", label: "Equipos en serie con el transformador", tipo: "tabla", columnas: [
        { key: "equipo", label: "Equipo", tipo: "texto", ancho: 22 }, { key: "lado", label: "Lado", tipo: "select", opciones: lista(["AT", "MT"]), ancho: 7 },
        { key: "inom", label: "In (A)", tipo: "numero", ancho: 8 }, { key: "icc", label: "Ik (kA)", tipo: "numero", ancho: 8 }
      ], nueva: { lado: "MT" }, def: [
        { equipo: "Interruptor bahía AT", lado: "AT", inom: 1600, icc: 40 },
        { equipo: "Celda de llegada MT", lado: "MT", inom: 1250, icc: 31.5 }
      ] }
    ]
  },
  cableMT: {
    area: "mt", icono: "🧵", titulo: "Cables de media tensión",
    objeto: "Verificar la capacidad de corriente, la soportabilidad al cortocircuito y la caída de tensión de los cables de media tensión, y su coherencia con la celda o protección de cada circuito.",
    normas: ["RETIE — especificación de conductores (literal k)", "IEC 60502-2 / NTC 2050 Sección 310 (cables de más de 2 kV)", "IEC 60949 (cortocircuito admisible, método adiabático)"],
    campos: [
      { key: "tension", label: "Tensión nominal (vacío = MT del transformador de potencia)", tipo: "numero", unidad: "kV", def: "" },
      { key: "fp", label: "Factor de potencia", tipo: "numero", def: 0.9 },
      { key: "dvMax", label: "Caída de tensión máxima", tipo: "numero", unidad: "%", def: 3 },
      { key: "instalacion", label: "Instalación (NTC 2050 Tablas 310.60(C)(77) a (86))", tipo: "select", opciones: op(N.INSTALACIONES_MT), def: "ductoUni" },
      { key: "nCircuitos", label: "Circuitos en el banco o la zanja", tipo: "select", opciones: lista([1, 2, 3, 6]), def: "1" },
      { key: "tempConductor", label: "Temperatura del conductor (MV-90 o MV-105)", tipo: "select", opciones: [{ valor: "90", texto: "90 °C (MV-90, XLPE)" }, { valor: "105", texto: "105 °C (MV-105, EPR)" }], def: "90" },
      { key: "tempSuelo", label: "Temperatura del suelo", tipo: "numero", unidad: "°C", def: 20 },
      { key: "profundidadExtra", label: "Profundidad adicional a la de la Figura 310.60", tipo: "numero", unidad: "m", def: 0 },
      { key: "circuitos", label: "Circuitos (ampacidad base vacía = tabla NTC 2050; Ik vacío = cortocircuito de la barra)", tipo: "tabla", columnas: [
        { key: "circuito", label: "Circuito", tipo: "texto", ancho: 12 }, { key: "material", label: "Mat.", tipo: "select", opciones: lista(["Al", "Cu"]), ancho: 8 },
        { key: "calibre", label: "Calibre", tipo: "select", opciones: CALIBRES_OP, ancho: 11 }, { key: "aislamiento", label: "Aisl.", tipo: "select", opciones: lista(["XLPE", "EPR", "PVC"]), ancho: 9 },
        { key: "ampacidad", label: "Ampacidad fabricante (A, opc.)", tipo: "numero", ancho: 8 }, { key: "factor", label: "Factor adic.", tipo: "numero", ancho: 6 },
        { key: "corriente", label: "I diseño (A)", tipo: "numero", ancho: 7 }, { key: "longitud", label: "L (m)", tipo: "numero", ancho: 6 },
        { key: "r", label: "R (Ω/km, opc.)", tipo: "numero", ancho: 6 }, { key: "x", label: "X (Ω/km)", tipo: "numero", ancho: 6 },
        { key: "icc", label: "Ik (kA)", tipo: "numero", ancho: 6 }, { key: "tDespeje", label: "t despeje (s)", tipo: "numero", ancho: 6 },
        { key: "inCelda", label: "In celda (A)", tipo: "numero", ancho: 6 }
      ], nueva: { material: "Al", calibre: "750", aislamiento: "XLPE", factor: 1, x: 0.13, tDespeje: 0.5 }, def: [
        { circuito: "Circuito 1", material: "Al", calibre: "750", aislamiento: "XLPE", ampacidad: "", factor: 1, corriente: 300, longitud: 300, x: 0.13, tDespeje: 0.5, inCelda: 630 }
      ] }
    ]
  },
  arcoElectrico: {
    area: "mt", icono: "🔥", titulo: "Arco eléctrico (IEEE 1584-2018)", literalPrincipal: "e",
    objeto: "Calcular la corriente de arco, la energía incidente y la frontera de arco en los puntos de trabajo energizado, y definir la categoría de equipo de protección personal (EPP) requerida.",
    normas: ["RETIE — análisis de riesgo por arco eléctrico", "IEEE 1584-2018 (cálculo de riesgo por arco eléctrico)", "NFPA 70E (categorías de EPP y frontera de arco)"],
    campos: [
      { key: "eppDisponible", label: "Calificación de arco del EPP disponible para el trabajo", tipo: "numero", unidad: "cal/cm²", def: 8 },
      { key: "tApertura", label: "Tiempo de apertura del interruptor (se suma al del relé de la coordinación)", tipo: "numero", unidad: "ms", def: 50 },
      { key: "puntos", label: "Puntos de trabajo (vacíos = valores típicos del equipo; Ibf vacía = la barra del cortocircuito con el mismo nombre; tiempos vacíos = curva de la protección de la coordinación con el nombre indicado)", tipo: "tabla", columnas: [
        { key: "punto", label: "Punto", tipo: "texto", ancho: 12 }, { key: "equipo", label: "Equipo", tipo: "select", opciones: op(N.IEEE1584.equipos), ancho: 14 },
        { key: "configuracion", label: "Electrodos", tipo: "select", opciones: Object.keys(N.IEEE1584.configuraciones).map((k) => ({ valor: k, texto: k })), ancho: 10 },
        { key: "tension", label: "Voc (kV)", tipo: "numero", ancho: 7 }, { key: "ibf", label: "Ibf (kA)", tipo: "numero", ancho: 7 },
        { key: "proteccion", label: "Protección (coordinación)", tipo: "texto", ancho: 12 }, { key: "tiempo", label: "t a Iarc (ms)", tipo: "numero", ancho: 6 }, { key: "tiempoMin", label: "t a Iarc red. (ms)", tipo: "numero", ancho: 6 },
        { key: "gap", label: "G (mm)", tipo: "numero", ancho: 5 }, { key: "distancia", label: "D trabajo (mm)", tipo: "numero", ancho: 6 },
        { key: "alto", label: "Alto (mm)", tipo: "numero", ancho: 5 }, { key: "ancho", label: "Ancho (mm)", tipo: "numero", ancho: 5 }, { key: "fondo", label: "Fondo (mm)", tipo: "numero", ancho: 5 }
      ], nueva: { equipo: "swBT", configuracion: "VCB", tension: 0.48 }, def: [
        { punto: "Celdas de 13,2 kV", equipo: "sw15", configuracion: "VCB", tension: 13.2, ibf: 6, tiempo: 250, tiempoMin: 300 },
        { punto: "Tablero general BT", equipo: "swBT", configuracion: "VCB", tension: 0.48, ibf: 25, tiempo: 50, tiempoMin: 120 },
        { punto: "Tablero de distribución", equipo: "panelBT", configuracion: "VCB", tension: 0.208, ibf: 8, tiempo: 25, tiempoMin: 25 }
      ] }
    ]
  },
  apantallamiento: {
    area: "spt", icono: "⛳", titulo: "Apantallamiento (esfera rodante)",
    objeto: "Verificar que los equipos y barrajes de la subestación queden dentro de la zona protegida por mástiles y cables de guarda, con el método de la esfera rodante o el modelo electrogeométrico.",
    normas: ["RETIE — protección contra rayos", "NTC 4552-3 / IEC 62305-3 (esfera rodante)", "IEEE 998 (apantallamiento de subestaciones, modelo electrogeométrico)"],
    campos: [
      { key: "metodo", label: "Método", tipo: "select", opciones: [{ valor: "ieee998", texto: "Modelo electrogeométrico IEEE 998" }, { valor: "nivel", texto: "Esfera rodante por nivel de protección (NTC 4552)" }], def: "ieee998" },
      { key: "bil", label: "BIL de los equipos protegidos", tipo: "numero", unidad: "kV", def: 550, soloSi: { metodo: "ieee998" } },
      { key: "zs", label: "Impedancia de onda del barraje Zs", tipo: "numero", unidad: "Ω", def: 350, soloSi: { metodo: "ieee998" } },
      { key: "captador", label: "Tipo de captador", tipo: "select", opciones: [{ valor: "mastil", texto: "Mástil (k = 1,2)" }, { valor: "cable", texto: "Cable de guarda (k = 1)" }], def: "mastil", soloSi: { metodo: "ieee998" } },
      { key: "nivel", label: "Nivel de protección", tipo: "select", opciones: lista(["I", "II", "III", "IV"]), def: "I", soloSi: { metodo: "nivel" } },
      { key: "elementos", label: "Elementos a proteger", tipo: "tabla", columnas: [
        { key: "elemento", label: "Elemento", tipo: "texto", ancho: 22 }, { key: "captador", label: "Captador", tipo: "texto", ancho: 16 },
        { key: "hCaptador", label: "Altura captador (m)", tipo: "numero", ancho: 10 }, { key: "hElemento", label: "Altura elemento (m)", tipo: "numero", ancho: 10 },
        { key: "distancia", label: "Distancia horizontal (m)", tipo: "numero", ancho: 10 }
      ], nueva: {}, def: [
        { elemento: "Pórtico de llegada de línea", captador: "Mástil 1", hCaptador: 20, hElemento: 12, distancia: 6 },
        { elemento: "Transformador de potencia", captador: "Mástil 2", hCaptador: 18, hElemento: 6, distancia: 10 }
      ] }
    ]
  },
  fvArreglo: {
    area: "fv", icono: "☀️", titulo: "Arreglo fotovoltaico e inversor", literalPrincipal: "x",
    objeto: "Definir cuántos módulos van en serie y en paralelo para que, con las temperaturas extremas del sitio, las tensiones y corrientes del arreglo queden dentro de los límites del inversor y del módulo, y verificar la relación DC/AC, el DPS de corriente continua y la necesidad de fusibles de string.",
    normas: ["RETIE — instalaciones de generación con fuentes no convencionales", "NTC 2050 Sección 690 (sistemas solares fotovoltaicos)", "IEC 62548 (diseño de arreglos fotovoltaicos)", "IEC 61215 / IEC 61730 (módulos)", "IEC 61643-31 (DPS de corriente continua)"],
    campos: [
      { key: "pmod", label: "Módulo: potencia máxima Pmax (STC)", tipo: "numero", unidad: "W", def: 550 },
      { key: "voc", label: "Módulo: tensión de circuito abierto Voc", tipo: "numero", unidad: "V", def: 49.9 },
      { key: "vmp", label: "Módulo: tensión de máxima potencia Vmp", tipo: "numero", unidad: "V", def: 41.96 },
      { key: "isc", label: "Módulo: corriente de cortocircuito Isc", tipo: "numero", unidad: "A", def: 14 },
      { key: "imp", label: "Módulo: corriente de máxima potencia Imp", tipo: "numero", unidad: "A", def: 13.11 },
      { key: "bVoc", label: "Módulo: coeficiente de temperatura de Voc", tipo: "numero", unidad: "%/°C", def: -0.27 },
      { key: "bVmp", label: "Módulo: coeficiente de temperatura de Vmp", tipo: "numero", unidad: "%/°C", def: -0.35 },
      { key: "gPmax", label: "Módulo: coeficiente de temperatura de Pmax", tipo: "numero", unidad: "%/°C", def: -0.35 },
      { key: "noct", label: "Módulo: NOCT (temperatura nominal de operación)", tipo: "numero", unidad: "°C", def: 45 },
      { key: "vmaxMod", label: "Módulo: tensión máxima del sistema", tipo: "numero", unidad: "V", def: 1500 },
      { key: "fusibleMax", label: "Módulo: fusible máximo en serie", tipo: "numero", unidad: "A", def: 25 },
      { key: "pac", label: "Inversor: potencia nominal AC", tipo: "numero", unidad: "kW", def: 100 },
      { key: "vac", label: "Inversor: tensión AC (línea-línea en trifásico)", tipo: "numero", unidad: "V", def: 480 },
      { key: "fases", label: "Inversor: fases", tipo: "select", opciones: [{ valor: "3", texto: "Trifásico" }, { valor: "1", texto: "Monofásico" }], def: "3" },
      { key: "vdcMax", label: "Inversor: tensión DC máxima de entrada", tipo: "numero", unidad: "V", def: 1100 },
      { key: "vmpptMin", label: "Inversor: tensión MPPT mínima a plena carga", tipo: "numero", unidad: "V", def: 550 },
      { key: "vmpptMax", label: "Inversor: tensión MPPT máxima", tipo: "numero", unidad: "V", def: 850 },
      { key: "idcMax", label: "Inversor: corriente máxima de entrada por MPPT", tipo: "numero", unidad: "A", def: 32 },
      { key: "iscMax", label: "Inversor: corriente de cortocircuito máxima por MPPT", tipo: "numero", unidad: "A", def: 40 },
      { key: "nMppt", label: "Inversor: número de entradas MPPT", tipo: "numero", def: 10 },
      { key: "ns", label: "Configuración: módulos en serie por string", tipo: "numero", def: 18 },
      { key: "np", label: "Configuración: strings en paralelo por MPPT", tipo: "numero", def: 2 },
      { key: "mpptUsados", label: "Configuración: entradas MPPT utilizadas", tipo: "numero", def: 6 },
      { key: "tmin", label: "Sitio: temperatura ambiente mínima histórica", tipo: "numero", unidad: "°C", def: 15 },
      { key: "tmax", label: "Sitio: temperatura ambiente máxima de diseño", tipo: "numero", unidad: "°C", def: 40 },
      { key: "ilrMin", label: "Relación DC/AC mínima aceptada", tipo: "numero", def: 0.9 },
      { key: "ilrMax", label: "Relación DC/AC máxima aceptada", tipo: "numero", def: 1.35 },
      { key: "ucpv", label: "DPS DC: tensión máxima de operación continua Ucpv (opcional)", tipo: "numero", unidad: "V", def: 1000 }
    ]
  },
  fvProduccion: {
    area: "fv", icono: "📈", titulo: "Producción y balance energético", literalPrincipal: "x",
    objeto: "Estimar la energía que produce el sistema fotovoltaico a partir del recurso solar del sitio y de las pérdidas (rendimiento global PR), su evolución en la vida útil y el balance con el consumo del usuario: autoconsumo, excedentes, permuta e importaciones según la CREG 174 de 2021.",
    normas: ["Ley 1715 de 2014 y Ley 2099 de 2021 (fuentes no convencionales de energía)", "CREG 174 de 2021 (autogeneración a pequeña escala y generación distribuida)", "IEC 61724-1 (desempeño de sistemas fotovoltaicos)", "Atlas de Radiación Solar del IDEAM"],
    campos: [
      { key: "pdc", label: "Potencia pico (vacío = la del arreglo)", tipo: "numero", unidad: "kWp", def: "" },
      { key: "hsp", label: "Horas sol pico promedio anual (IDEAM / NASA POWER) en el plano del arreglo", tipo: "numero", unidad: "h/día", def: 5 },
      { key: "tambSol", label: "Temperatura ambiente media en horas de sol", tipo: "numero", unidad: "°C", def: 30 },
      { key: "gMedia", label: "Irradiancia media en horas de sol", tipo: "numero", unidad: "W/m²", def: 800 },
      { key: "gPmax", label: "Coeficiente de temperatura de Pmax (vacío = el del arreglo)", tipo: "numero", unidad: "%/°C", def: "" },
      { key: "noct", label: "NOCT (vacío = el del arreglo)", tipo: "numero", unidad: "°C", def: "" },
      { key: "pSuciedad", label: "Pérdida por suciedad", tipo: "numero", unidad: "%", def: 3 },
      { key: "pSombra", label: "Pérdida por sombreado", tipo: "numero", unidad: "%", def: 0 },
      { key: "pMismatch", label: "Pérdida por dispersión entre módulos (mismatch)", tipo: "numero", unidad: "%", def: 2 },
      { key: "pCableDC", label: "Pérdida en cableado DC", tipo: "numero", unidad: "%", def: 1.5 },
      { key: "efInversor", label: "Eficiencia europea del inversor", tipo: "numero", unidad: "%", def: 98 },
      { key: "pCableAC", label: "Pérdida en cableado AC", tipo: "numero", unidad: "%", def: 1 },
      { key: "pDisp", label: "Pérdida por indisponibilidad", tipo: "numero", unidad: "%", def: 1 },
      { key: "degradacion", label: "Degradación anual de los módulos", tipo: "numero", unidad: "%/año", def: 0.5 },
      { key: "anios", label: "Vida útil de análisis", tipo: "numero", unidad: "años", def: 25 },
      { key: "consumo", label: "Consumo anual del usuario (0 = sin balance)", tipo: "numero", unidad: "kWh/año", def: 220000 },
      { key: "simultaneidad", label: "Fracción de la generación consumida en el momento (simultaneidad)", tipo: "numero", unidad: "%", def: 75 },
      { key: "tarifa", label: "Tarifa de energía del usuario (CU)", tipo: "numero", unidad: "$/kWh", def: 850 },
      { key: "comercializacion", label: "Componente de comercialización de la tarifa", tipo: "numero", unidad: "$/kWh", def: 90 },
      { key: "bolsa", label: "Precio de bolsa de referencia para excedentes vendidos", tipo: "numero", unidad: "$/kWh", def: 300 }
    ]
  },
  fvConductores: {
    area: "fv", icono: "🔆", titulo: "Conductores y protecciones del sistema FV", literalPrincipal: "k",
    objeto: "Seleccionar los conductores y las protecciones de los circuitos de corriente continua (strings y agrupados) y de corriente alterna (salida del inversor) con los factores del 125 % de la NTC 2050 Sección 690, la corrección por temperatura, la temperatura de terminales, el conductor de puesta a tierra de equipos y la caída de tensión.",
    normas: ["RETIE — instalaciones de generación con fuentes no convencionales", "NTC 2050 690-8, 690-9 y 690-31 (circuitos fotovoltaicos)", "NTC 2050 Tabla 310-16 y Tabla 250-122", "IEC 62548 (diseño de arreglos fotovoltaicos)"],
    campos: [
      { key: "dvMax", label: "Caída de tensión máxima por circuito", tipo: "numero", unidad: "%", def: 1.5 },
      { key: "dvTotalMax", label: "Caída de tensión máxima total (DC más AC)", tipo: "numero", unidad: "%", def: 3 },
      { key: "circuitos", label: "Circuitos (I base vacía = la del arreglo: Isc del string, Np × Isc del agrupado o In del inversor)", tipo: "tabla", columnas: [
        { key: "tramo", label: "Circuito", tipo: "texto", ancho: 14 }, { key: "tipo", label: "Tipo", tipo: "select", opciones: lista(["DC string", "DC agrupado", "AC"]), ancho: 11 },
        { key: "material", label: "Mat.", tipo: "select", opciones: lista(["Cu", "Al"]), ancho: 6 }, { key: "calibre", label: "Calibre", tipo: "select", opciones: CALIBRES_OP, ancho: 10 },
        { key: "corriente", label: "I base (A)", tipo: "numero", ancho: 7 }, { key: "tAmb", label: "T amb. (°C)", tipo: "numero", ancho: 7 },
        { key: "adicional", label: "+ °C por sol", tipo: "numero", ancho: 7 }, { key: "portadores", label: "Portad.", tipo: "numero", ancho: 6 },
        { key: "longitud", label: "L (m)", tipo: "numero", ancho: 7 }, { key: "tension", label: "V (vacío = arreglo)", tipo: "numero", ancho: 8 },
        { key: "proteccion", label: "Protección (A, opc.)", tipo: "numero", ancho: 8 }
      ], nueva: { tipo: "DC string", material: "Cu", calibre: "10", tAmb: 35, adicional: 0, portadores: 2 }, def: [
        { tramo: "String típico", tipo: "DC string", material: "Cu", calibre: "10", corriente: "", tAmb: 35, adicional: 17, portadores: 2, longitud: 40, tension: "", proteccion: "" },
        { tramo: "Salida del inversor", tipo: "AC", material: "Cu", calibre: "3/0", corriente: "", tAmb: 35, adicional: 0, portadores: 3, longitud: 30, tension: "", proteccion: "" }
      ] }
    ]
  },
  fvConexion: {
    area: "fv", icono: "🔌", titulo: "Conexión a la red (CREG 174 de 2021)", literalPrincipal: "x",
    objeto: "Clasificar el sistema como autogenerador a pequeña escala (AGPE) o generador distribuido (GD) con su procedimiento de conexión, y verificar la capacidad disponible del circuito, la elevación de tensión en el punto de conexión por la inyección, el aporte del inversor al cortocircuito, la protección anti-isla y la medición bidireccional.",
    normas: ["CREG 174 de 2021 (conexión de AGPE y GD)", "Ley 1715 de 2014 y Ley 2099 de 2021", "RETIE — instalaciones de generación con fuentes no convencionales", "IEEE 1547-2018 (interconexión de recursos distribuidos)", "IEC 62116 / UL 1741 (anti-isla)", "NTC 1340 (tensiones normalizadas)"],
    campos: [
      { key: "tipo", label: "Tipo de generador", tipo: "select", opciones: [{ valor: "AGPE", texto: "AGPE — autogenerador a pequeña escala (con consumo propio)" }, { valor: "GD", texto: "GD — generador distribuido (sin consumo propio)" }], def: "AGPE" },
      { key: "pac", label: "Potencia nominal AC (vacío = la del inversor)", tipo: "numero", unidad: "kW", def: "" },
      { key: "tension", label: "Tensión del punto de conexión (vacío = la del inversor)", tipo: "numero", unidad: "kV", def: "" },
      { key: "sk", label: "Potencia de cortocircuito en el punto de conexión (operador de red)", tipo: "numero", unidad: "MVA", def: 12 },
      { key: "rxRed", label: "Relación R/X de la red en el punto de conexión", tipo: "numero", def: 0.5 },
      { key: "demandaMin", label: "Demanda mínima del usuario en horas de sol", tipo: "numero", unidad: "kW", def: 20 },
      { key: "fp", label: "Factor de potencia de la inyección", tipo: "numero", def: 1 },
      { key: "dvMax", label: "Elevación de tensión máxima admitida", tipo: "numero", unidad: "%", def: 2 },
      { key: "capacidadDisponible", label: "Capacidad disponible publicada por el operador de red (0 = sin dato)", tipo: "numero", unidad: "kW", def: 0 },
      { key: "icu", label: "Capacidad de interrupción de los equipos en el punto de conexión (0 = sin dato)", tipo: "numero", unidad: "kA", def: 25 },
      { key: "aporte", label: "Aporte del inversor al cortocircuito (veces In)", tipo: "numero", def: 1.2 },
      { key: "antiIsla", label: "Inversor con anti-isla certificada (IEC 62116 / UL 1741)", tipo: "select", opciones: SI_NO, def: "Sí" },
      { key: "medidor", label: "Medidor bidireccional en la frontera", tipo: "select", opciones: SI_NO, def: "Sí" }
    ]
  }
};

// Valores por defecto (ejemplo) de un módulo.
export function entradasPorDefecto(id) {
  const m = MODULOS[id];
  const e = {};
  m.campos.forEach((c) => { e[c.key] = Array.isArray(c.def) ? c.def.map((f) => ({ ...f })) : c.def ?? ""; });
  return e;
}

// Normas generales que encabezan toda memoria.
export const NORMAS_GENERALES = [
  ["RETIE", "Reglamento Técnico de Instalaciones Eléctricas (Ministerio de Minas y Energía), versión vigente"],
  ["NTC 2050", "Código Eléctrico Colombiano"],
  ["IEEE 80-2013", "Guide for Safety in AC Substation Grounding"],
  ["IEC 60909-0", "Short-circuit currents in three-phase a.c. systems"],
  ["IEC 60255-151", "Measuring relays and protection equipment — overcurrent protection"],
  ["IEC 62305-2 / NTC 4552", "Protección contra descargas eléctricas atmosféricas — gestión del riesgo"],
  ["IEC 60071-1/-2", "Coordinación de aislamiento"],
  ["NTC 818 / NTC 819", "Transformadores monofásicos y trifásicos de distribución"],
  ["IEC 60076", "Transformadores de potencia"],
  ["IEC 60502-2 / IEC 60949", "Cables de media tensión y cortocircuito admisible"],
  ["IEEE 998", "Direct Lightning Stroke Shielding of Substations"],
  ["Ley 1715 de 2014 / Ley 2099 de 2021", "Integración de las fuentes no convencionales de energía"],
  ["CREG 174 de 2021", "Autogeneración a pequeña escala y generación distribuida"],
  ["NTC 2050 Sección 690 / IEC 62548", "Sistemas y arreglos solares fotovoltaicos"],
  ["IEEE 1547-2018", "Interconexión de recursos energéticos distribuidos"]
];
