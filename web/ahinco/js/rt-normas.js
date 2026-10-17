// Tablas normativas de AHÍNCO (memorias de cálculo eléctricas).
//
// Cada tabla indica su fuente. Son datos de referencia de uso común en
// Colombia (NTC 2050 = NEC; IEEE 80; IEC 60071/60909/60255/62305; RETIE).
// Los valores marcados con `verificar: true` deben confrontarse con la
// edición vigente del documento antes de firmar una memoria: el aplicativo
// los muestra con esa advertencia.

// ---------------------------------------------------------------- conductores de baja tensión (THHN/THWN-2, 600 V)

export const CALIBRES = ["14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0", "250", "300", "350", "400", "500", "600", "750", "1000"];
export const etiquetaCalibre = (c) => (/^\d{3,4}$/.test(c) ? `${c} kcmil` : `${c} AWG`);

// Sección nominal (mm²).
export const SECCION_MM2 = {
  "14": 2.08, "12": 3.31, "10": 5.26, "8": 8.37, "6": 13.3, "4": 21.15, "3": 26.67, "2": 33.62, "1": 42.41,
  "1/0": 53.49, "2/0": 67.43, "3/0": 85.01, "4/0": 107.2, "250": 126.7, "300": 152, "350": 177.3,
  "400": 202.7, "500": 253.4, "600": 304, "750": 380, "1000": 506.7
};

// NTC 2050 Tabla 310-16: capacidad de corriente (A) de no más de 3
// conductores portadores en canalización, temperatura ambiente 30 °C.
// Columnas: 60 °C, 75 °C, 90 °C.
export const AMPACIDAD = {
  Cu: {
    "14": [20, 20, 25], "12": [25, 25, 30], "10": [30, 35, 40], "8": [40, 50, 55], "6": [55, 65, 75],
    "4": [70, 85, 95], "3": [85, 100, 110], "2": [95, 115, 130], "1": [110, 130, 150],
    "1/0": [125, 150, 170], "2/0": [145, 175, 195], "3/0": [165, 200, 225], "4/0": [195, 230, 260],
    "250": [215, 255, 290], "300": [240, 285, 320], "350": [260, 310, 350], "400": [280, 335, 380],
    "500": [320, 380, 430], "600": [355, 420, 475], "750": [400, 475, 535], "1000": [455, 545, 615]
  },
  Al: {
    "12": [20, 20, 25], "10": [25, 30, 35], "8": [30, 40, 45], "6": [40, 50, 60],
    "4": [55, 65, 75], "3": [65, 75, 85], "2": [75, 90, 100], "1": [85, 100, 115],
    "1/0": [100, 120, 135], "2/0": [115, 135, 150], "3/0": [130, 155, 175], "4/0": [150, 180, 205],
    "250": [170, 205, 230], "300": [190, 230, 255], "350": [210, 250, 280], "400": [225, 270, 305],
    "500": [260, 310, 350], "600": [285, 340, 385], "750": [320, 385, 435], "1000": [375, 445, 500]
  }
};
export const COLUMNA_TEMP = { 60: 0, 75: 1, 90: 2 };

// NTC 2050 240-4(d): protección máxima de conductores pequeños.
export const LIMITE_PEQUENOS = { Cu: { "14": 15, "12": 20, "10": 30 }, Al: { "12": 15, "10": 25 } };

// NTC 2050 Tabla 310-16, factores de corrección por temperatura ambiente
// (base 30 °C). [hasta °C, f60, f75, f90]; null = no se permite.
export const FACTOR_TEMPERATURA = [
  [25, 1.08, 1.05, 1.04], [30, 1.0, 1.0, 1.0], [35, 0.91, 0.94, 0.96], [40, 0.82, 0.88, 0.91],
  [45, 0.71, 0.82, 0.87], [50, 0.58, 0.75, 0.82], [55, 0.41, 0.67, 0.76], [60, null, 0.58, 0.71],
  [70, null, 0.33, 0.58], [80, null, null, 0.41]
];

// NTC 2050 310-15(b)(2)(a): más de 3 conductores portadores en canalización.
export const FACTOR_AGRUPAMIENTO = [[3, 1.0], [6, 0.8], [9, 0.7], [20, 0.5], [30, 0.45], [40, 0.4], [Infinity, 0.35]];

// NTC 2050 Cap. 9 Tabla 9: resistencia CA a 75 °C y reactancia (Ω/km) para
// cables de 600 V trifásicos, 60 Hz, en tubería. [XL PVC/Al, XL acero, R Cu PVC, R Cu acero, R Al PVC]
export const TABLA9 = {
  "14": [0.190, 0.240, 10.2, 10.2, null], "12": [0.177, 0.223, 6.6, 6.6, 10.5], "10": [0.164, 0.207, 3.9, 3.9, 6.6],
  "8": [0.171, 0.213, 2.56, 2.56, 4.3], "6": [0.167, 0.210, 1.61, 1.61, 2.66], "4": [0.157, 0.197, 1.02, 1.02, 1.67],
  "3": [0.154, 0.194, 0.82, 0.82, 1.31], "2": [0.148, 0.187, 0.62, 0.66, 1.05], "1": [0.151, 0.187, 0.49, 0.52, 0.82],
  "1/0": [0.144, 0.180, 0.39, 0.39, 0.66], "2/0": [0.141, 0.177, 0.33, 0.33, 0.52], "3/0": [0.138, 0.171, 0.253, 0.259, 0.43],
  "4/0": [0.135, 0.167, 0.203, 0.207, 0.33], "250": [0.135, 0.171, 0.171, 0.177, 0.279], "300": [0.135, 0.167, 0.144, 0.148, 0.233],
  "350": [0.131, 0.164, 0.125, 0.128, 0.200], "400": [0.131, 0.161, 0.108, 0.115, 0.177], "500": [0.128, 0.157, 0.089, 0.095, 0.141],
  "600": [0.128, 0.157, 0.075, 0.082, 0.118], "750": [0.125, 0.157, 0.062, 0.069, 0.095], "1000": [0.121, 0.151, 0.049, 0.059, 0.075]
};

// NTC 2050 Cap. 9 Tabla 5: área aproximada de conductores THHN/THWN (mm²).
export const AREA_THHN = {
  "14": 6.258, "12": 8.581, "10": 13.61, "8": 23.61, "6": 32.71, "4": 53.16, "3": 62.77, "2": 74.71, "1": 100.8,
  "1/0": 119.7, "2/0": 143.4, "3/0": 172.8, "4/0": 208.8, "250": 256.1, "300": 297.3, "350": 338.2, "400": 378.3,
  "500": 456.3, "600": 559.7, "750": 677.2, "1000": 869.5
};

// NTC 2050 Cap. 9 Tabla 4: área interna total (100 %) de tuberías (mm²).
// Listas ordenadas [tamaño comercial, área]: un objeto reordenaría las
// claves numéricas ("1", "2"...) antes que "1/2" y "3/4".
export const TUBERIAS = {
  EMT: { nombre: "Tubería metálica eléctrica (EMT)", areas: [["1/2", 196], ["3/4", 343], ["1", 556], ["1-1/4", 968], ["1-1/2", 1314], ["2", 2165], ["2-1/2", 3783], ["3", 5701], ["3-1/2", 7451], ["4", 9521]] },
  IMC: { nombre: "Tubería metálica intermedia (IMC)", areas: [["1/2", 222], ["3/4", 377], ["1", 620], ["1-1/4", 1064], ["1-1/2", 1432], ["2", 2341], ["2-1/2", 3308], ["3", 5115], ["3-1/2", 6822], ["4", 8725]] },
  PVC40: { nombre: "Tubería PVC rígida Schedule 40", areas: [["1/2", 184], ["3/4", 327], ["1", 535], ["1-1/4", 935], ["1-1/2", 1282], ["2", 2124], ["2-1/2", 3029], ["3", 4693], ["3-1/2", 6277], ["4", 8091], ["5", 12748], ["6", 18433]] }
};
// NTC 2050 Cap. 9 Tabla 1: porcentaje máximo de llenado.
export const LLENADO_MAX = (n) => (n <= 1 ? 53 : n === 2 ? 31 : 40);

// NTC 2050 240-6: corrientes nominales normalizadas de interruptores y fusibles (A).
export const PROTECCIONES_NORMALIZADAS = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000];

// ---------------------------------------------------------------- conductores aéreos (media y alta tensión)

// Valores típicos de catálogo (ACSR, ASTM B232). R a 75 °C en CA. Para la
// memoria definitiva usar la ficha del fabricante.
export const CONDUCTORES_AEREOS = {
  raven: { nombre: "ACSR 1/0 AWG Raven (6/1)", area: 62.4, diametro: 10.11, peso: 0.216, rotura: 1940, E: 79000, alfa: 19.1e-6, R75: 0.696, gmr: 1.36 },
  quail: { nombre: "ACSR 2/0 AWG Quail (6/1)", area: 78.6, diametro: 11.35, peso: 0.273, rotura: 2400, E: 79000, alfa: 19.1e-6, R75: 0.554, gmr: 1.56 },
  pigeon: { nombre: "ACSR 3/0 AWG Pigeon (6/1)", area: 99.2, diametro: 12.75, peso: 0.344, rotura: 3000, E: 79000, alfa: 19.1e-6, R75: 0.439, gmr: 1.83 },
  penguin: { nombre: "ACSR 4/0 AWG Penguin (6/1)", area: 125.1, diametro: 14.31, peso: 0.433, rotura: 3780, E: 79000, alfa: 19.1e-6, R75: 0.348, gmr: 2.48 },
  partridge: { nombre: "ACSR 266,8 kcmil Partridge (26/7)", area: 157.2, diametro: 16.31, peso: 0.546, rotura: 5100, E: 74000, alfa: 18.9e-6, R75: 0.258, gmr: 6.62 },
  linnet: { nombre: "ACSR 336,4 kcmil Linnet (26/7)", area: 198.3, diametro: 18.29, peso: 0.688, rotura: 6400, E: 74000, alfa: 18.9e-6, R75: 0.205, gmr: 7.42 },
  hawk: { nombre: "ACSR 477 kcmil Hawk (26/7)", area: 280.8, diametro: 21.79, peso: 0.975, rotura: 8820, E: 74000, alfa: 18.9e-6, R75: 0.144, gmr: 8.84 },
  drake: { nombre: "ACSR 795 kcmil Drake (26/7)", area: 468.5, diametro: 28.14, peso: 1.628, rotura: 14300, E: 74000, alfa: 18.9e-6, R75: 0.0872, gmr: 11.4 }
};

// ---------------------------------------------------------------- transformadores

// Potencias normalizadas (kVA). NTC 818 (monofásicos) y NTC 819 (trifásicos).
export const TRAFOS_MONOFASICOS = [5, 10, 15, 25, 37.5, 50, 75, 100, 167];
export const TRAFOS_TRIFASICOS = [15, 30, 45, 75, 112.5, 150, 225, 300, 400, 500, 630, 750, 800, 1000, 1250, 1600, 2000, 2500];
// Impedancia de cortocircuito típica (%) para el cálculo cuando aún no hay placa.
export function impedanciaTipica(kva) {
  if (kva <= 75) return 3.0;
  if (kva <= 150) return 3.5;
  if (kva <= 800) return 4.0;
  return 5.0;
}
// Fusibles de expulsión tipo K (A).
export const FUSIBLES_K = [1, 2, 3, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 65, 80, 100, 140, 200];

// ---------------------------------------------------------------- protecciones (IEC 60255-151)

export const CURVAS_IEC = {
  SI: { nombre: "IEC normalmente inversa", k: 0.14, a: 0.02 },
  VI: { nombre: "IEC muy inversa", k: 13.5, a: 1 },
  EI: { nombre: "IEC extremadamente inversa", k: 80, a: 2 },
  LTI: { nombre: "IEC inversa de tiempo largo", k: 120, a: 1 },
  DT: { nombre: "Tiempo definido", k: 0, a: 0 }
};

// ---------------------------------------------------------------- puesta a tierra (IEEE 80-2013)

// IEEE 80-2013 Tabla 1: constantes de materiales.
export const MATERIALES_SPT = {
  cuRecocido: { nombre: "Cobre recocido (100 %)", ar: 0.00393, K0: 234, Tm: 1083, rr: 1.72, TCAP: 3.42 },
  cuDuro: { nombre: "Cobre duro comercial (97 %)", ar: 0.00381, K0: 242, Tm: 1084, rr: 1.78, TCAP: 3.42 },
  cuSoldado40: { nombre: "Acero recubierto de cobre (40 %)", ar: 0.00378, K0: 245, Tm: 1084, rr: 4.4, TCAP: 3.85 },
  cuSoldado30: { nombre: "Acero recubierto de cobre (30 %)", ar: 0.00378, K0: 245, Tm: 1084, rr: 5.86, TCAP: 3.85 },
  aceroGalv: { nombre: "Acero galvanizado", ar: 0.0032, K0: 293, Tm: 419, rr: 20.1, TCAP: 3.93 }
};
// Diámetro de conductores de cobre desnudo cableado (mm).
export const DIAMETRO_COBRE_DESNUDO = { "2": 7.42, "1/0": 9.35, "2/0": 10.52, "3/0": 11.79, "4/0": 13.26, "250": 14.6, "300": 16.0, "350": 17.3, "500": 20.6 };

// RETIE: valores de referencia de resistencia de puesta a tierra (Ω).
export const RETIE_RESISTENCIA_SPT = {
  subAT: { nombre: "Subestaciones de alta y extra alta tensión", max: 1 },
  subMT: { nombre: "Subestaciones de media tensión", max: 10 },
  rayos: { nombre: "Protección contra rayos", max: 10 },
  estructuras: { nombre: "Estructuras y torrecillas metálicas de líneas o redes con cable de guarda", max: 20 },
  neutroBT: { nombre: "Punto neutro de acometida en baja tensión", max: 25 },
  sensibles: { nombre: "Redes para equipos electrónicos o sensibles", max: 10 }
};

// ---------------------------------------------------------------- rayos (IEC 62305-2 / NTC 4552-2)

export const PB_SIPRA = { ninguno: { nombre: "Sin SIPRA", v: 1 }, IV: { nombre: "SIPRA nivel IV", v: 0.2 }, III: { nombre: "SIPRA nivel III", v: 0.1 }, II: { nombre: "SIPRA nivel II", v: 0.05 }, I: { nombre: "SIPRA nivel I", v: 0.02 } };
export const PEB_DPS = { ninguno: { nombre: "Sin DPS coordinados", v: 1 }, "III-IV": { nombre: "DPS nivel III-IV", v: 0.05 }, II: { nombre: "DPS nivel II", v: 0.02 }, I: { nombre: "DPS nivel I", v: 0.01 } };
export const PTA_MEDIDAS = { ninguna: { nombre: "Sin medidas de protección", v: 1 }, avisos: { nombre: "Avisos de advertencia", v: 0.1 }, aislamiento: { nombre: "Aislamiento eléctrico de bajantes", v: 0.01 }, equipotencial: { nombre: "Equipotencialización efectiva del suelo", v: 0.01 }, barreras: { nombre: "Barreras físicas", v: 0 } };
export const CD_UBICACION = { rodeada_altos: { nombre: "Rodeada de objetos más altos", v: 0.25 }, rodeada_iguales: { nombre: "Rodeada de objetos de igual o menor altura", v: 0.5 }, aislada: { nombre: "Aislada, sin objetos cercanos", v: 1 }, cima: { nombre: "Aislada en cima de colina", v: 2 } };
export const RT_SUELO = { agricola: { nombre: "Agrícola o concreto", v: 1e-2 }, marmol: { nombre: "Mármol o cerámica", v: 1e-3 }, grava: { nombre: "Grava, alfombra o tapete", v: 1e-4 }, asfalto: { nombre: "Asfalto, linóleo o madera", v: 1e-5 } };
export const RF_INCENDIO = { explosion: { nombre: "Riesgo de explosión", v: 1 }, alto: { nombre: "Riesgo de incendio alto", v: 0.1 }, ordinario: { nombre: "Riesgo de incendio ordinario", v: 0.01 }, bajo: { nombre: "Riesgo de incendio bajo", v: 0.001 }, ninguno: { nombre: "Sin riesgo de incendio", v: 0 } };
export const RP_PROVISIONES = { ninguna: { nombre: "Sin provisiones", v: 1 }, manual: { nombre: "Extintores o alarma manual", v: 0.5 }, automatica: { nombre: "Extinción o alarma automática", v: 0.2 } };
export const HZ_PANICO = { ninguno: { nombre: "Sin peligro especial", v: 1 }, bajo: { nombre: "Pánico bajo (≤ 2 pisos, < 100 personas)", v: 2 }, medio: { nombre: "Pánico medio (100 a 1000 personas)", v: 5 }, evacuacion: { nombre: "Evacuación difícil", v: 5 }, alto: { nombre: "Pánico alto (> 1000 personas)", v: 10 } };
export const LF_TIPO = { hospital: { nombre: "Hospital, hotel, escuela, edificio civil", v: 0.1 }, publico: { nombre: "Entretenimiento público, iglesia, museo", v: 0.05 }, industrial: { nombre: "Industrial o comercial", v: 0.02 }, otro: { nombre: "Otros", v: 0.01 } };
export const RIESGO_TOLERABLE_R1 = 1e-5;
// Radio de la esfera rodante (m) y tamaño de malla (m) por nivel de protección.
export const NIVELES_SIPRA = { I: { esfera: 20, malla: "5 × 5" }, II: { esfera: 30, malla: "10 × 10" }, III: { esfera: 45, malla: "15 × 15" }, IV: { esfera: 60, malla: "20 × 20" } };

// ---------------------------------------------------------------- aislamiento (IEC 60071-1)

// Niveles normalizados de aislamiento (rango I): Um (kV) → tensiones de
// soportabilidad al impulso tipo rayo, LIWV (kV pico).
export const NIVELES_AISLAMIENTO = {
  "7.2": [40, 60], "12": [60, 75, 95], "17.5": [75, 95], "24": [95, 125, 145], "36": [145, 170],
  "52": [250], "72.5": [325], "123": [450, 550], "145": [450, 550, 650], "170": [550, 650, 750], "245": [650, 750, 850, 950, 1050]
};
// IEC 60071-1 Anexo A, Tabla A.1: distancia mínima en aire fase-tierra (mm)
// para configuración punta-estructura según LIWV (kV).
export const DISTANCIA_AIRE_BIL = [
  [20, 60], [40, 60], [60, 90], [75, 120], [95, 160], [125, 220], [145, 270], [170, 320], [250, 480],
  [325, 630], [450, 900], [550, 1100], [650, 1300], [750, 1500], [850, 1700], [950, 1900], [1050, 2100]
];

// ---------------------------------------------------------------- distancias de seguridad (RETIE)

// RETIE, distancias mínimas de seguridad en zonas con construcciones (m).
// Tensión nominal entre fases (kV). Verificar contra la tabla del RETIE vigente;
// null = valor no cargado: el usuario debe digitar la distancia exigida.
export const RETIE_DISTANCIAS = {
  verificar: true,
  tensiones: ["<1", "13.2", "34.5", "66", "115", "230"],
  tipos: {
    a: { nombre: "Vertical sobre techos y proyecciones (zonas de muy difícil acceso)", v: { "<1": 0.45, "13.2": 3.8, "34.5": 3.8, "66": null, "115": null, "230": null } },
    b: { nombre: "Horizontal a muros, proyecciones y ventanas", v: { "<1": 1.7, "13.2": 2.3, "34.5": 2.3, "66": null, "115": null, "230": null } },
    d: { nombre: "Vertical sobre o debajo de balcones y techos de fácil acceso", v: { "<1": 3.5, "13.2": 4.1, "34.5": 4.1, "66": null, "115": null, "230": null } },
    e: { nombre: "Vertical a carreteras, calles y zonas de tránsito vehicular", v: { "<1": 5.0, "13.2": 5.6, "34.5": 5.6, "66": 5.8, "115": 6.1, "230": 6.8 } }
  }
};
