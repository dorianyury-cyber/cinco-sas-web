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

// NTC 2050 Tabla 310.15(B)(16): capacidad de corriente (A) de no más de 3
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

// NTC 2050 240.4(D): protección máxima de conductores pequeños.
export const LIMITE_PEQUENOS = { Cu: { "14": 15, "12": 20, "10": 30 }, Al: { "12": 15, "10": 25 } };

// NTC 2050 Tabla 310.15(B)(16), factores de corrección por temperatura ambiente
// (base 30 °C). [hasta °C, f60, f75, f90]; null = no se permite.
export const FACTOR_TEMPERATURA = [
  [25, 1.08, 1.05, 1.04], [30, 1.0, 1.0, 1.0], [35, 0.91, 0.94, 0.96], [40, 0.82, 0.88, 0.91],
  [45, 0.71, 0.82, 0.87], [50, 0.58, 0.75, 0.82], [55, 0.41, 0.67, 0.76], [60, null, 0.58, 0.71],
  [70, null, 0.33, 0.58], [80, null, null, 0.41]
];

// NTC 2050 310.15(B)(3)(a): más de 3 conductores portadores en canalización.
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

// NTC 2050 240.6(A): corrientes nominales normalizadas de interruptores y fusibles (A).
// NTC 2050 Tabla 250.122: conductor de puesta a tierra de equipos (cobre)
// según la corriente de la protección contra sobrecorriente (A → calibre).
export const TIERRA_EQUIPOS = [[15, "14"], [20, "12"], [60, "10"], [100, "8"], [200, "6"], [300, "4"], [400, "3"], [500, "2"], [600, "1"], [800, "1/0"], [1000, "2/0"], [1200, "3/0"], [1600, "4/0"], [2000, "250"], [2500, "350"], [3000, "400"], [4000, "500"], [5000, "700"], [6000, "800"]];

// IEEE 1547-2018, categoría II: ajustes de referencia de las protecciones
// de interconexión (los definitivos los fija el operador de red).
export const AJUSTES_IEEE1547 = [
  ["Sobretensión OV2 (59)", "1,20 p.u.", "0,16 s"], ["Sobretensión OV1 (59)", "1,10 p.u.", "2,0 s"],
  ["Subtensión UV1 (27)", "0,70 p.u.", "10,0 s"], ["Subtensión UV2 (27)", "0,45 p.u.", "0,16 s"],
  ["Sobrefrecuencia OF2 (81O)", "62,0 Hz", "0,16 s"], ["Sobrefrecuencia OF1 (81O)", "61,2 Hz", "300 s"],
  ["Subfrecuencia UF1 (81U)", "58,5 Hz", "300 s"], ["Subfrecuencia UF2 (81U)", "56,5 Hz", "0,16 s"]
];

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

// Curvas de tiempo inverso: t = TMS × (k / ((I/Is)^α − 1) + B). IEC 60255-151 (B = 0) e
// IEEE C37.112-2018 (TD en lugar de TMS). "PUNTOS" = curva digitada (fusibles, interruptores).
export const CURVAS_IEC = {
  SI: { nombre: "IEC normalmente inversa", k: 0.14, a: 0.02, b: 0 },
  VI: { nombre: "IEC muy inversa", k: 13.5, a: 1, b: 0 },
  EI: { nombre: "IEC extremadamente inversa", k: 80, a: 2, b: 0 },
  LTI: { nombre: "IEC inversa de tiempo largo", k: 120, a: 1, b: 0 },
  MI: { nombre: "IEEE moderadamente inversa (U1)", k: 0.0515, a: 0.02, b: 0.114 },
  IVI: { nombre: "IEEE muy inversa (U2)", k: 19.61, a: 2, b: 0.491 },
  IEI: { nombre: "IEEE extremadamente inversa (U3)", k: 28.2, a: 2, b: 0.1217 },
  DT: { nombre: "Tiempo definido", k: 0, a: 0, b: 0 },
  PUNTOS: { nombre: "Curva por puntos (fusible o interruptor del fabricante)", k: 0, a: 0, b: 0 }
};
// Puntos "I:t; I:t" (A:s) de una curva digitada, ordenados por corriente.
export function puntosCurva(texto) {
  return String(texto || "").split(/[;\n]+/).map((p) => p.split(/[:=]/).map((x) => parseFloat(String(x).trim().replace(",", ".")))).filter(([i, t]) => i > 0 && t > 0).sort((p, q) => p[0] - q[0]);
}

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
// ---------------------------------------------------------------- iluminación interior (RETILAP)
// RETILAP 2024 (Anexo General de la Res. 40150 de 2024, con las modificaciones de las Res. 40318 de 2025 y 40286 de 2026), Libro 3, Tabla 3.2.2.6.a: Em (lx), Uo, Ra, UGRL y Em,z (lx)
// por tipo de área, y categoría de la Tabla 3.2.5.a (límite de VEEI en W/m² por 100 lx).
export const RETILAP_VEEI = {
  admin: { nombre: "Administrativa en general", limite: 3.0 },
  comun: { nombre: "Zonas comunes (pasillos, escaleras, baños públicos)", limite: 4.0 },
  archivo: { nombre: "Almacenes, archivos, salas técnicas y cocinas", limite: 4.0 },
  otro: { nombre: "Recintos interiores no descritos", limite: 4.0 },
  reunion: { nombre: "Salas de reuniones y conferencias", limite: 8.0 }
};
export const RETILAP_AREAS = {
  oficina: { nombre: "Oficinas: escritura, lectura, procesamiento de datos", ref: "26.2", em: 500, uo: 0.6, ra: 80, ugr: 19, ez: 150, veei: "admin", oficina: true },
  copiado: { nombre: "Oficinas: área de copiado e impresión", ref: "26.1", em: 300, uo: 0.4, ra: 80, ugr: 19, ez: 100, veei: "admin", oficina: true },
  cad: { nombre: "Oficinas: estaciones de trabajo CAD", ref: "26.4", em: 500, uo: 0.6, ra: 80, ugr: 19, ez: 150, veei: "admin", oficina: true },
  dibujo: { nombre: "Oficinas: dibujo técnico", ref: "26.3", em: 750, uo: 0.7, ra: 80, ugr: 16, ez: 150, veei: "admin", oficina: true },
  reuniones: { nombre: "Salas de conferencias y reuniones", ref: "26.5.1", em: 500, uo: 0.6, ra: 80, ugr: 19, ez: 150, veei: "reunion", oficina: true, antipanico: true },
  recepcion: { nombre: "Recepción", ref: "26.6", em: 300, uo: 0.6, ra: 80, ugr: 22, ez: 100, veei: "admin" },
  archivo: { nombre: "Área de archivo", ref: "26.7", em: 200, uo: 0.4, ra: 80, ugr: 25, ez: 75, veei: "archivo" },
  corredor: { nombre: "Corredores y zonas de circulación", ref: "1.1", em: 100, uo: 0.4, ra: 40, ugr: 28, ez: 50, veei: "comun", corredor: true },
  escalera: { nombre: "Escaleras", ref: "1.2", em: 100, uo: 0.4, ra: 40, ugr: 25, ez: 50, veei: "comun", corredor: true },
  rampa: { nombre: "Rampas", ref: "1.5", em: 150, uo: 0.4, ra: 40, ugr: 25, ez: 50, veei: "comun" },
  banos: { nombre: "Baños, vestidores, lavabos e inodoros", ref: "2.4", em: 200, uo: 0.4, ra: 80, ugr: 25, ez: 75, veei: "comun", emergencia: true },
  comedor: { nombre: "Comedores y zonas de descanso", ref: "2.1", em: 200, uo: 0.4, ra: 80, ugr: 22, ez: 75, veei: "otro", antipanico: true },
  descanso: { nombre: "Salas de descanso", ref: "2.2", em: 100, uo: 0.4, ra: 80, ugr: 22, ez: 50, veei: "otro", antipanico: true },
  cocina: { nombre: "Cocina", ref: "29.2", em: 500, uo: 0.6, ra: 80, ugr: 22, ez: 100, veei: "archivo" },
  tecnica: { nombre: "Salas de planta y de operación de maquinaria", ref: "3.1", em: 200, uo: 0.4, ra: 80, ugr: 25, ez: 50, veei: "archivo" }
};
// RETILAP 3.2.4.4, Tabla 3.2.4.5.a y 3.2.4.7: iluminancia mínima de emergencia (lx) y
// relación Emax/Emin máxima (1:40).
export const RETILAP_EMERGENCIA = {
  ruta: { nombre: "Ruta de evacuación (eje central)", eh: 1, ref: "3.2.4.4" },
  rampa: { nombre: "Rampa en la ruta de evacuación (énfasis)", eh: 5, ref: "Tabla 3.2.4.5.a" },
  escalera: { nombre: "Escalera en la ruta de evacuación (énfasis)", eh: 5, ref: "Tabla 3.2.4.5.a" },
  puerta: { nombre: "Puerta de salida (énfasis)", eh: 5, ref: "Tabla 3.2.4.5.a" },
  cambio: { nombre: "Cambio de dirección, intersección o cambio de nivel (énfasis)", eh: 5, ref: "Tabla 3.2.4.5.a" },
  cuarto: { nombre: "Cuarto eléctrico (énfasis)", eh: 5, ev: 15, ref: "Tabla 3.2.4.5.a" },
  equipo: { nombre: "Equipo de seguridad: extintor, gabinete, primeros auxilios (vertical)", ev: 5, ref: "Tabla 3.2.4.5.a" },
  antipanico: { nombre: "Área antipánico (piso, sin borde de 0,5 m)", eh: 0.5, ref: "3.2.4.7" },
  altoRiesgo: { nombre: "Área de trabajo de alto riesgo", eh: 15, ref: "3.2.4.8" }
};
// RETILAP 3.2.1.1: reflectancias de referencia cuando no se conocen las reales.
export const RETILAP_REFLECTANCIA = { techo: [70, 90], paredes: [50, 80], piso: [20, 60] };

// RETIE 2024 (mod. Res. 40284 de 2026), Libro 3, art. 3.12.1 literal g, Tabla 3.12.1.a:
// máxima tensión de contacto (V rms) sin capa superficial, según el tiempo de despeje (s).
// [tiempo, público en general (IEC 60479-1), ocupacional (IEEE 80, 50 kg)]; la última fila
// es «mayor a 2 s». Entre filas se toma la del tiempo inmediatamente mayor (conservador).
export const RETIE_CONTACTO = [[0.05, 345, 518], [0.1, 320, 366], [0.15, 300, 299], [0.2, 270, 259], [0.3, 200, 211], [0.4, 130, 183], [0.5, 80, 164], [0.7, 70, 138], [1, 55, 116], [Infinity, 50, 82]];
export function retieContactoMax(tf, acceso) {
  const f = RETIE_CONTACTO.find((r) => tf <= r[0] + 1e-9) || RETIE_CONTACTO.at(-1);
  return { v: acceso === "ocupacional" ? f[2] : f[1], fila: f[0] === Infinity ? "mayor a 1 s (fila «mayor a 2 s»)" : f[0] < 1 ? `${Math.round(f[0] * 1000)} ms` : "1 s" };
}

// RETIE 2024, Libro 3, Tabla 3.12.3.a: valores de REFERENCIA (Parágrafo 1: vale el valor del
// diseño si se garantizan las tensiones de paso, contacto y transferidas).
export const RETIE_RESISTENCIA_SPT = {
  subAT: { nombre: "Subestaciones de alta y extra alta tensión", max: 1 },
  subMT: { nombre: "Subestaciones de media tensión", max: 10 },
  rayos: { nombre: "Protección contra rayos", max: 10 },
  estructuras: { nombre: "Estructuras y torrecillas metálicas de líneas o redes con cable de guarda", max: 20 },
  neutroBT: { nombre: "Punto neutro de acometida en baja tensión", max: 25 },
  sensibles: { nombre: "Redes para equipos electrónicos o sensibles", max: 10 }
};

// ---------------------------------------------------------------- rayos (IEC 62305-2 / NTC 4552-2)

// ---------------------------------------------------------------- riesgo por rayos (NTC 4552-1, -2 y -3)
// Cada tabla es { clave: { nombre, v } } para poder armar las listas de la pantalla; v es el valor que usa el cálculo.

// NTC 4552-2 Tabla 15: probabilidad de daño físico PB según el nivel de protección del SIPRA.
export const PB_SIPRA = {
  ninguno: { nombre: "Sin SIPRA", v: 1 }, IV: { nombre: "SIPRA nivel IV", v: 0.2 }, III: { nombre: "SIPRA nivel III", v: 0.1 },
  II: { nombre: "SIPRA nivel II", v: 0.05 }, I: { nombre: "SIPRA nivel I", v: 0.02 },
  I_concreto: { nombre: "SIPRA nivel I con el acero de refuerzo como bajantes", v: 0.01 },
  I_metalico: { nombre: "Techo metálico o captación completa del techo, con el acero de refuerzo como bajantes", v: 0.001 }
};
// NTC 4552-2 Tabla 16: PDPS (sistema coordinado de DPS según el nivel de protección para el que se diseñó).
export const PEB_DPS = {
  ninguno: { nombre: "Sin sistema coordinado de DPS", v: 1 }, "III-IV": { nombre: "DPS nivel III-IV", v: 0.03 },
  II: { nombre: "DPS nivel II", v: 0.02 }, I: { nombre: "DPS nivel I", v: 0.01 }
};
// NTC 4552-2 Tabla 14: PA según las medidas contra tensiones de paso y contacto (se multiplican si hay varias).
export const PTA_MEDIDAS = {
  ninguna: { nombre: "Sin medidas de protección", v: 1 }, avisos: { nombre: "Avisos de advertencia", v: 0.1 },
  aislamiento: { nombre: "Aislamiento eléctrico de las bajantes expuestas (3 mm de polietileno)", v: 0.01 },
  equipotencial: { nombre: "Equipotencialización efectiva del suelo", v: 0.01 },
  avisos_aislamiento: { nombre: "Avisos y aislamiento de las bajantes", v: 0.001 },
  avisos_equipotencial: { nombre: "Avisos y equipotencialización del suelo", v: 0.001 },
  aislamiento_equipotencial: { nombre: "Aislamiento de las bajantes y equipotencialización del suelo", v: 0.0001 },
  barreras: { nombre: "Restricciones físicas o bajantes naturales (acero de refuerzo)", v: 0 }
};
// NTC 4552-2 Tabla 10: factor de localización Cd.
export const CD_UBICACION = { rodeada_altos: { nombre: "Rodeada de objetos o árboles más altos", v: 0.25 }, rodeada_iguales: { nombre: "Rodeada de objetos de igual o menor altura", v: 0.5 }, aislada: { nombre: "Aislada, sin objetos cercanos", v: 1 }, cima: { nombre: "Aislada en la cima de una colina", v: 2 } };
// NTC 4552-2 Tabla 13: factor ambiental Ce.
export const CE_AMBIENTE = { rural: { nombre: "Rural (1)", v: 1 }, suburbano: { nombre: "Suburbano, edificaciones de menos de 10 m (0,5)", v: 0.5 }, urbano: { nombre: "Urbano, edificaciones de 10 a 20 m (0,1)", v: 0.1 }, urbano_altos: { nombre: "Urbano con edificaciones de más de 20 m (0)", v: 0 } };
// NTC 4552-2 Tabla 27: factores ra y ru según la superficie.
export const RT_SUELO = { agricola: { nombre: "Agricultura o concreto", v: 1e-2 }, marmol: { nombre: "Mármol o cerámica", v: 1e-3 }, grava: { nombre: "Gravilla o tapete", v: 1e-4 }, asfalto: { nombre: "Asfalto, madera o linóleo", v: 1e-5 } };
// NTC 4552-2 Tabla 29: factor rf según el riesgo de incendio.
export const RF_INCENDIO = { explosion: { nombre: "Riesgo de explosión", v: 1 }, alto: { nombre: "Riesgo de incendio alto", v: 0.1 }, ordinario: { nombre: "Riesgo de incendio ordinario", v: 0.01 }, bajo: { nombre: "Riesgo de incendio bajo", v: 0.001 }, ninguno: { nombre: "Sin riesgo de incendio", v: 0 } };
// NTC 4552-2 Tabla 28: factor rp según las provisiones contra incendio.
export const RP_PROVISIONES = { ninguna: { nombre: "Sin provisiones", v: 1 }, manual: { nombre: "Extintores, alarma manual, hidrantes, compartimientos o rutas de evacuación", v: 0.5 }, automatica: { nombre: "Extinción o alarma automática (protegida contra sobretensiones; bomberos en menos de 10 min)", v: 0.2 } };
// NTC 4552-2 Tabla 30: factor hz.
export const HZ_PANICO = { ninguno: { nombre: "Sin peligro especial", v: 1 }, bajo: { nombre: "Pánico bajo (dos pisos y hasta 100 personas)", v: 2 }, medio: { nombre: "Pánico medio (100 a 1000 personas)", v: 5 }, evacuacion: { nombre: "Evacuación difícil (personas inmovilizadas)", v: 5 }, alto: { nombre: "Pánico alto (más de 1000 personas)", v: 10 }, ambiente: { nombre: "Peligro para el ambiente que lo rodea", v: 20 }, contaminacion: { nombre: "Contaminación del ambiente", v: 50 } };
// NTC 4552-2 Tabla 26: Lf típico para L1. «otro» no figura en la norma: se adopta el valor de industrial y comercial.
export const LF_TIPO = { hospital: { nombre: "Hospitales, hoteles, edificios civiles", v: 0.1 }, industrial: { nombre: "Industrial, comercial, escuelas", v: 0.05 }, publico: { nombre: "Entretenimiento público, iglesias, museos", v: 0.002 }, otro: { nombre: "Otro (la norma no da valor: se adopta 5 × 10⁻²)", v: 0.05 } };
// NTC 4552-2 Tabla 26: Lo típico para L1 (solo estructuras con riesgo de explosión u hospitales).
export const CRITICIDAD = { ninguna: { nombre: "Ninguna (R1 sin sistemas internos)", v: 0 }, hospital: { nombre: "Hospital u otra estructura donde la falla de sistemas internos pone en peligro la vida", v: 1e-3 }, explosion: { nombre: "Estructura con riesgo de explosión", v: 1e-1 } };
// NTC 4552-2 Tabla 31: pérdida de servicio público (L2), { Lf, Lo }.
export const SERVICIO_PUBLICO = { ninguno: { nombre: "No presta servicio público", v: null }, gas_agua: { nombre: "Gas o acueducto (Lf 10⁻¹; Lo 10⁻²)", v: { lf: 1e-1, lo: 1e-2 } }, energia_tlc: { nombre: "TV, telecomunicaciones o suministro de potencia (Lf 10⁻²; Lo 10⁻³)", v: { lf: 1e-2, lo: 1e-3 } } };
// NTC 4552-2 Tabla 32: pérdida económica (L4), { Lf, Lo }.
export const TIPO_ECONOMICO = {
  hospital: { nombre: "Hospital", v: { lf: 0.5, lo: 1e-2 } }, industria: { nombre: "Industria", v: { lf: 0.5, lo: 1e-2 } },
  museo_agro: { nombre: "Museo o uso agrícola", v: { lf: 0.5, lo: 1e-3 } }, hotel_oficina: { nombre: "Hotel, oficinas o banco", v: { lf: 0.2, lo: 1e-2 } },
  escuela_comercial: { nombre: "Escuela, iglesia o centro comercial", v: { lf: 0.2, lo: 1e-3 } }, otro: { nombre: "Otros", v: { lf: 0.1, lo: 1e-4 } }
};
// NTC 4552-2 Tabla 17: KS3 según el cableado interno.
export const KS3_CABLEADO = {
  sinPantalla_lazos: { nombre: "Sin pantalla, sin precaución para evitar lazos", v: 1 }, sinPantalla_grandes: { nombre: "Sin pantalla, evitando grandes lazos", v: 0.2 },
  sinPantalla_lazos_pequenos: { nombre: "Sin pantalla, evitando lazos (mismo cable)", v: 0.02 }, pantalla_20: { nombre: "Cable apantallado, 5 < Rs ≤ 20 Ω/km", v: 0.001 },
  pantalla_5: { nombre: "Cable apantallado, 1 < Rs ≤ 5 Ω/km", v: 0.0002 }, pantalla_1: { nombre: "Cable apantallado, Rs ≤ 1 Ω/km", v: 0.0001 }
};
// NTC 4552-2 Tabla 18: PMS en función de KMS ([KMS, PMS]; se toma el escalón de KMS inmediatamente superior).
export const PMS_TABLA = [[0.0130, 0.0001], [0.014, 0.001], [0.015, 0.003], [0.016, 0.005], [0.021, 0.01], [0.035, 0.1], [0.07, 0.5], [0.15, 0.9], [0.4, 1]];
// Tensión soportable al impulso Uw del equipo (kV) y resistencia de la pantalla de la línea.
export const UW_EQUIPO = { "1.5": { nombre: "1,5 kV (electrónico)", v: 1.5 }, "2.5": { nombre: "2,5 kV (aparato eléctrico de usuario)", v: 2.5 }, "4": { nombre: "4 kV", v: 4 }, "6": { nombre: "6 kV (aparato eléctrico de red)", v: 6 } };
export const PANTALLA_LINEA = { ninguna: { nombre: "Sin pantalla", v: "ninguna" }, "20": { nombre: "Apantallada, 5 < Rs ≤ 20 Ω/km", v: "20" }, "5": { nombre: "Apantallada, 1 < Rs ≤ 5 Ω/km", v: "5" }, "1": { nombre: "Apantallada, Rs ≤ 1 Ω/km", v: "1" } };
// NTC 4552-2 Tabla 19 (PLD, descargas sobre la línea) por Uw: [sin pantalla, 5<Rs≤20, 1<Rs≤5, Rs≤1].
export const PLD_TABLA = { "1.5": [1, 1, 0.8, 0.4], "2.5": [1, 0.95, 0.6, 0.2], "4": [1, 0.9, 0.3, 0.04], "6": [1, 0.8, 0.1, 0.02] };
// NTC 4552-2 Tabla 20 (PL1, descargas cercanas a la línea) por Uw: [sin pantalla, 5<Rs≤20, 1<Rs≤5, Rs≤1].
// La norma impresa trae 1 y 0,2 para 6 kV en «sin pantalla» y «5 < Rs ≤ 20», que rompen la secuencia decreciente
// (erratas); se usan 0,1 y 0,02 de la IEC 62305-2.
export const PLI_TABLA = { "1.5": [1, 0.15, 0.04, 0.02], "2.5": [0.4, 0.06, 0.02, 0.008], "4": [0.2, 0.03, 0.008, 0.004], "6": [0.1, 0.02, 0.004, 0.002] };
// NTC 4552-2 Tablas 21 y 22 (corriente de falla Ia de la pantalla de una línea, ecuaciones 13 y 14) y Tabla 23 (Uw del cable).
export const KD_LINEA = { contacto: { nombre: "Pantalla en contacto con el suelo (1)", v: 1 }, sinContacto: { nombre: "Pantalla sin contacto con el suelo (0,4)", v: 0.4 } };
export const KP_LINEA = {
  ninguna: { nombre: "Sin medidas adicionales (1)", v: 1 }, un_cable: { nombre: "Un cable apantallado adicional, 30 cm sobre la línea (0,6)", v: 0.6 },
  dos_cables: { nombre: "Dos cables apantallados adicionales, simétricos (0,4)", v: 0.4 }, ducto: { nombre: "Ducto de cables de baja resistividad protegido contra rayo (0,1)", v: 0.1 },
  cable_rayo: { nombre: "Cable especial protegido contra rayos, con pantalla continua en el suelo (0,02)", v: 0.02 }, tubo_acero: { nombre: "Cables apantallados adicionales en tubo de acero (0,01)", v: 0.01 }
};
export const UW_CABLE = {
  tlc_papel: { nombre: "Telecomunicaciones aislado en papel (1,5 kV)", v: 1.5 }, tlc_pvc: { nombre: "Telecomunicaciones aislado en PVC (5 kV)", v: 5 },
  p1: { nombre: "Potencia Un ≤ 1 kV (15 kV)", v: 15 }, p3: { nombre: "Potencia 3 kV (45 kV)", v: 45 }, p6: { nombre: "Potencia 6 kV (60 kV)", v: 60 },
  p10: { nombre: "Potencia 10 kV (75 kV)", v: 75 }, p15: { nombre: "Potencia 15 kV (95 kV)", v: 95 }, p20: { nombre: "Potencia 20 kV (125 kV)", v: 125 }
};
// NTC 4552-2 Tabla 25: P'B, P'C, P'V y P'W según la corriente de falla Ia (kA); se toma el escalón de Ia inmediatamente inferior.
export const P_IA_TABLA = [[0, 1], [3, 0.99], [5, 0.95], [10, 0.9], [20, 0.8], [30, 0.6], [40, 0.4], [50, 0.3], [60, 0.2], [80, 0.1], [100, 0.05], [150, 0.02], [200, 0.01], [300, 0.005], [400, 0.002], [600, 0.001]];
export const pDeIa = (ia) => { let p = 1; for (const [k, v] of P_IA_TABLA) if (ia >= k) p = v; return p; };
export const RIESGO_TOLERABLE_R1 = 1e-5;
// NTC 4552-2 Tabla 7: riesgo tolerable RT (1/año).
export const RIESGO_TOLERABLE = { R1: 1e-5, R2: 1e-3, R3: 1e-3 };
// NTC 4552-1 Tablas 3 a 5 y NTC 4552-3 Tablas 2, 3 y 6 (clase del SIPRA = nivel de protección).
export const NIVELES_SIPRA = {
  I: { esfera: 20, malla: "5 × 5", mallaM: 5, iMax: 200, iMin: 3, prob: 0.99, bajantes: 10, ki: 0.08 },
  II: { esfera: 30, malla: "10 × 10", mallaM: 10, iMax: 150, iMin: 5, prob: 0.97, bajantes: 10, ki: 0.06 },
  III: { esfera: 45, malla: "15 × 15", mallaM: 15, iMax: 100, iMin: 10, prob: 0.91, bajantes: 15, ki: 0.04 },
  IV: { esfera: 60, malla: "20 × 20", mallaM: 20, iMax: 100, iMin: 16, prob: 0.84, bajantes: 20, ki: 0.04 }
};
// NTC 4552-3 Figura 6: longitud mínima l1 (m) de cada electrodo según la resistividad del suelo ρ (Ω·m).
export const L1_ELECTRODO = (nivel, rho) => {
  const r = Math.min(3000, Math.max(0, rho));
  if (nivel === "I") return r <= 500 ? 5 : 5 + 0.03 * (r - 500);
  if (nivel === "II") return r <= 800 ? 5 : 5 + (45 / 2200) * (r - 800);
  return 5;
};
// NTC 4552-3 Tabla 13: km. Tabla 5: sección mínima del captador y de las bajantes en cobre (mm²).
export const KM_AISLAMIENTO = { aire: { nombre: "Aire", v: 1 }, concreto: { nombre: "Concreto", v: 0.5 } };
export const SECCION_MIN_CAPTACION_CU = 50;

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

// RETIE 2024 (Res. 40117 de 2024, modificada por la Res. 40284 de 2026), Libro 3:
// Tabla 3.10.1.a (zonas con construcciones) y Tabla 3.10.2.a (lugares y situaciones), en m.
// Tensión nominal entre fases (kV): "13.2" = 13,8/13,2/11,4/7,6; "34.5" = 44/34,5/33;
// "66" = 66/57,5; "115" = 115/110; "230" = 230/220. null = la tabla no da valor para
// esa tensión (no se permite o no aplica): el diseñador digita la distancia exigida.
// Las claves a, b, d y e se conservan por compatibilidad con los proyectos guardados;
// el nombre lleva la letra que usa el RETIE 2024.
export const RETIE_DISTANCIAS = {
  tensiones: ["<1", "13.2", "34.5", "66", "115", "230", "500"],
  textoTension: { "<1": "< 1 kV", "13.2": "13,8/13,2/11,4/7,6 kV", "34.5": "44/34,5/33 kV", "66": "66/57,5 kV", "115": "115/110 kV", "230": "230/220 kV", "500": "500 kV" },
  // Nota 2 del art. 3.10: sobre 57,5 kV, +3 % por cada 300 m sobre 1000 m de altitud.
  altitud: { desdeKV: 57.5, base: 1000, paso: 300, incremento: 0.03 },
  tipos: {
    a: { nombre: "«a» vertical sobre techos y proyecciones (muy difícil acceso, con control absoluto)", tabla: "Tabla 3.10.1.a", v: { "<1": 0.45, "13.2": 3.8, "34.5": 3.8, "66": null, "115": null, "230": null, "500": null } },
    b: { nombre: "«b» horizontal a muros, balcones, salientes y ventanas", tabla: "Tabla 3.10.1.a", v: { "<1": 1.7, "13.2": 2.3, "34.5": 2.3, "66": 2.5, "115": null, "230": null, "500": null } },
    d: { nombre: "«c» vertical sobre o debajo de balcones o techos de fácil acceso", tabla: "Tabla 3.10.1.a", v: { "<1": 3.5, "13.2": 4.1, "34.5": 4.1, "66": null, "115": null, "230": null, "500": null } },
    e: { nombre: "«d» al suelo en cruces con carreteras, calles y zonas de tráfico vehicular o peatonal", tabla: "Tabla 3.10.2.a", v: { "<1": 5.0, "13.2": 5.6, "34.5": 5.6, "66": 5.8, "115": 6.1, "230": 8.5, "500": 11.5 } },
    acom: { nombre: "Acometida aérea de baja tensión que atraviesa vías vehiculares", tabla: "Título 26 literal a", v: { "<1": 5.5, "13.2": null, "34.5": null, "66": null, "115": null, "230": null, "500": null } },
    bta: { nombre: "Cruce de líneas aéreas de baja tensión en grandes avenidas", tabla: "Tabla 3.10.2.a", v: { "<1": 5.6, "13.2": null, "34.5": null, "66": null, "115": null, "230": null, "500": null } },
    d1: { nombre: "«d1» al suelo desde líneas que recorren avenidas, carreteras y calles", tabla: "Tabla 3.10.2.a", v: { "<1": 5.0, "13.2": 5.6, "34.5": 5.6, "66": 5.8, "115": 6.1, "230": 8.0, "500": 11.5 } },
    bosque: { nombre: "«d» al suelo en bosques de arbustos, cultivos, pastos y huertos (con control de altura)", tabla: "Tabla 3.10.2.a", v: { "<1": 5.0, "13.2": 5.6, "34.5": 5.6, "66": 5.8, "115": 6.1, "230": 6.8, "500": 8.6 } },
    ee: { nombre: "«e» bosques y huertos sin control de crecimiento, maquinaria alta o ferrocarril sin electrificar", tabla: "Tabla 3.10.2.a", v: { "<1": 7.5, "13.2": 8.1, "34.5": 8.1, "66": 8.3, "115": 8.6, "230": 9.3, "500": 11.1 } },
    f: { nombre: "«f» vertical a alimentadores de ferrocarriles electrificados, teleféricos, tranvías y trolebuses", tabla: "Tabla 3.10.2.a", v: { "<1": 1.2, "13.2": 1.8, "34.5": 1.8, "66": 2.0, "115": 2.3, "230": 3.0, "500": 4.8 } },
    g1: { nombre: "«g» sobre el nivel máximo del agua, ríos navegables (embarcaciones de 2 m a 7 m)", tabla: "Tabla 3.10.2.a", v: { "<1": 9.6, "13.2": 10.2, "34.5": 10.2, "66": 10.4, "115": 10.6, "230": 11.3, "500": 12.9 } },
    g2: { nombre: "«g» sobre el nivel máximo del agua, ríos no navegables por embarcaciones de más de 2 m", tabla: "Tabla 3.10.2.a", v: { "<1": 4.6, "13.2": 5.2, "34.5": 5.2, "66": 5.4, "115": 5.6, "230": 6.3, "500": 7.9 } },
    dep: { nombre: "Vertical al piso sobre campos deportivos abiertos sin infraestructura", tabla: "Tabla 3.10.2.a", v: { "<1": 12, "13.2": 12, "34.5": 12, "66": 12, "115": 12, "230": 12.8, "500": 14.6 } },
    deph: { nombre: "Horizontal a campos deportivos con graderías, casetas u otra infraestructura", tabla: "Tabla 3.10.2.a", v: { "<1": 7.0, "13.2": 7.0, "34.5": 7.0, "66": 7.0, "115": 7.0, "230": 9.3, "500": 11.1 } }
  }
};
// Factor de altitud del RETIE 2024 (Libro 3, art. 3.10, Nota 2): solo para más de 57,5 kV.
export function factorAltitudDistancia(tension, H) {
  const A = RETIE_DISTANCIAS.altitud, kv = Number(tension);
  return Number.isFinite(kv) && kv > A.desdeKV && H > A.base ? 1 + (A.incremento * (H - A.base)) / A.paso : 1;
}

// RETIE 2024, Libro 3, art. 3.19.1 literal h, Tabla 3.19.1.a: ancho mínimo de la zona de
// servidumbre de líneas de transmisión (m), centrado en el eje de la línea.
export const RETIE_SERVIDUMBRE = {
  no: { nombre: "No aplica (sin línea de transmisión)", ancho: null },
  "66": { nombre: "57,5/66 kV, torres o postes, 1 o 2 circuitos", ancho: 15 },
  "115p": { nombre: "110/115 kV, postes, 1 o 2 circuitos", ancho: 15 },
  "115t": { nombre: "110/115 kV, torres, 1 o 2 circuitos", ancho: 20 },
  "230p1": { nombre: "220/230 kV, postes, 1 circuito", ancho: 28 },
  "230p2": { nombre: "220/230 kV, postes, 2 circuitos", ancho: 30 },
  "230t1": { nombre: "220/230 kV, torres, 1 circuito", ancho: 30 },
  "230t2": { nombre: "220/230 kV, torres, 2 circuitos", ancho: 32 },
  "345a": { nombre: "345 kV, torres o postes, 1 circuito", ancho: 34 },
  "345b": { nombre: "345 kV, torres o postes, 2 circuitos", ancho: 37 },
  "500a": { nombre: "500 kV, torres o postes, 1 circuito", ancho: 60 },
  "500b": { nombre: "500 kV, torres o postes, 2 circuitos", ancho: 65 }
};

// IEC 60364-5-52 Anexo E, Tabla E.52.1 (exigida por el RETIE 2024, Libro 3, 3.3.3.6, cuando
// THDi ≥ 15 %): factor de reducción según el contenido de tercer armónico de la corriente de
// fase, y corriente sobre la que se dimensiona (fase o neutro).
export function factorArmonicosIEC(h3) {
  if (h3 <= 15) return { f: 1, base: "fase" };
  if (h3 <= 33) return { f: 0.86, base: "fase" };
  if (h3 <= 45) return { f: 0.86, base: "neutro" };
  return { f: 1, base: "neutro" };
}

// ---------------------------------------------------------------- arco eléctrico (IEEE 1584-2018)
// Tablas 1 a 5 y 7 de la IEEE 1584-2018, en el mismo formato en que las
// publica la biblioteca abierta «arcflash» (Copyright (c) 2022 Li-aung Yip,
// licencia MIT, https://github.com/LiaungYip/arcflash), que las transcribe del
// estándar y reproduce los ejemplos D.1 y D.2 de su Anexo D. Unidades: kV, kA,
// mm, ms, J/cm². Tabla 1: corriente de arco intermedia; Tabla 2: factor de
// variación; Tablas 3 a 5: energía incidente a 600, 2700 y 14 300 V;
// Tabla 7: factor de corrección por tamaño del encerramiento.
const T1584_1 = `VCB, 0.6, -0.04287, 1.035, -0.083, 0, 0, -4.783E-09, 1.962E-06, -0.000229, 0.003141, 1.092
VCB, 2.7, 0.0065, 1.001, -0.024, -1.557E-12, 4.556E-10, -4.186E-08, 8.346E-07, 5.482E-05, -0.003191, 0.9729
VCB, 14.3, 0.005795, 1.015, -0.011, -1.557E-12, 4.556E-10, -4.186E-08, 8.346E-07, 5.482E-05, -0.003191, 0.9729
VCBB, 0.6, -0.017432, 0.98, -0.05, 0, 0, -5.767E-09, 2.524E-06, -0.00034, 0.01187, 1.013
VCBB, 2.7, 0.002823, 0.995, -0.0125, 0, -9.204E-11, 2.901E-08, -3.262E-06, 0.0001569, -0.004003, 0.9825
VCBB, 14.3, 0.014827, 1.01, -0.01, 0, -9.204E-11, 2.901E-08, -3.262E-06, 0.0001569, -0.004003, 0.9825
HCB, 0.6, 0.054922, 0.988, -0.11, 0, 0, -5.382E-09, 2.316E-06, -0.000302, 0.0091, 0.9725
HCB, 2.7, 0.001011, 1.003, -0.0249, 0, 0, 4.859E-10, -1.814E-07, -9.128E-06, -0.0007, 0.9881
HCB, 14.3, 0.008693, 0.999, -0.02, 0, -5.043E-11, 2.233E-08, -3.046E-06, 0.000116, -0.001145, 0.9839
VOA, 0.6, 0.043785, 1.04, -0.18, 0, 0, -4.783E-09, 1.962E-06, -0.000229, 0.003141, 1.092
VOA, 2.7, -0.02395, 1.006, -0.0188, -1.557E-12, 4.556E-10, -4.186E-08, 8.346E-07, 5.482E-05, -0.003191, 0.9729
VOA, 14.3, 0.005371, 1.0102, -0.029, -1.557E-12, 4.556E-10, -4.186E-08, 8.346E-07, 5.482E-05, -0.003191, 0.9729
HOA, 0.6, 0.111147, 1.008, -0.24, 0, 0, -3.895E-09, 1.641E-06, -0.000197, 0.002615, 1.1
HOA, 2.7, 0.000435, 1.006, -0.038, 0, 0, 7.859E-10, -1.914E-07, -9.128E-06, -0.0007, 0.9981
HOA, 14.3, 0.000904, 0.999, -0.02, 0, 0, 7.859E-10, -1.914E-07, -9.128E-06, -0.0007, 0.9981`;
const T1584_2 = `VCB, 0, -0.0000014269, 0.000083137, -0.0019382, 0.022366, -0.12645, 0.30226
VCBB, 1.138e-06, -6.0287e-05, 0.0012758, -0.013778, 0.080217, -0.24066, 0.33524
HCB, 0, -3.097e-06, 0.00016405, -0.0033609, 0.033308, -0.16182, 0.34627
VOA, 9.5606E-07, -5.1543E-05, 0.0011161, -0.01242, 0.075125, -0.23584, 0.33696
HOA, 0, -3.1555e-06, 0.0001682, -0.0034607, 0.034124, -0.1599, 0.34629`;
const T1584_3 = `VCB, 0.753364, 0.566, 1.752636, 0, 0, -4.783E-09, 0.000001962, -0.000229, 0.003141, 1.092, 0, -1.598, 0.957
VCBB, 3.068459, 0.26, -0.098107, 0, 0, -5.767E-09, 0.000002524, -0.00034, 0.01187, 1.013, -0.06, -1.809, 1.19
HCB, 4.073745, 0.344, -0.370259, 0, 0, -5.382E-09, 0.000002316, -0.000302, 0.0091, 0.9725, 0, -2.03, 1.036
VOA, 0.679294, 0.746, 1.222636, 0, 0, -4.783E-09, 0.000001962, -0.000229, 0.003141, 1.092, 0, -1.598, 0.997
HOA, 3.470417, 0.465, -0.261863, 0, 0, -3.895E-09, 0.000001641, -0.000197, 0.002615, 1.1, 0, -1.99, 1.04`;
const T1584_4 = `VCB, 2.40021, 0.165, 0.354202, -1.557E-12, 4.556E-10, -4.186E-08, 8.346E-07, 5.482E-05, -0.003191, 0.9729, 0, -1.569, 0.9778
VCBB, 3.870592, 0.185, -0.736618, 0, -9.204E-11, 2.901E-08, -3.262E-06, 0.0001569, -0.004003, 0.9825, 0, -1.742, 1.09
HCB, 3.486391, 0.177, -0.193101, 0, 0, 4.859E-10, -1.814E-07, -9.128E-06, -0.0007, 0.9881, 0.027, -1.723, 1.055
VOA, 3.880724, 0.105, -1.906033, -1.557E-12, 4.556E-10, -4.186E-08, 8.346E-07, 5.482E-05, -0.003191, 0.9729, 0, -1.515, 1.115
HOA, 3.616266, 0.149, -0.761561, 0, 0, 7.859E-10, -1.914E-07, -9.128E-06, -0.0007, 0.9981, 0, -1.639, 1.078`;
const T1584_5 = `VCB, 3.825917, 0.11, -0.999749, -1.557E-12, 4.556E-10, -4.186E-08, 8.346E-07, 5.482E-05, -0.003191, 0.9729, 0, -1.568, 0.99
VCBB, 3.644309, 0.215, -0.585522, 0, -9.204E-11, 2.901E-08, -3.262E-06, 0.0001569, -0.004003, 0.9825, 0, -1.677, 1.06
HCB, 3.044516, 0.125, 0.245106, 0, -5.043E-11, 2.233E-08, -3.046E-06, 0.000116, -0.001145, 0.9839, 0, -1.655, 1.084
VOA, 3.405454, 0.12, -0.93245, -1.557E-12, 4.556E-10, -4.186E-08, 8.346E-07, 5.482E-05, -0.003191, 0.9729, 0, -1.534, 0.979
HOA, 2.04049, 0.177, 1.005092, 0, 0, 7.859E-10, -1.914E-07, -9.128E-06, -0.0007, 0.9981, -0.05, -1.633, 1.151`;
const T1584_7 = `Typical, VCB, -0.000302, 0.03441, 0.4325
Typical, VCBB, -0.0002976, 0.032, 0.479
Typical, HCB, -0.0001923, 0.01935, 0.6899
Shallow, VCB, 0.002222, -0.02556, 0.6222
Shallow, VCBB, -0.002778, 0.1194, -0.2778
Shallow, HCB, -0.0005556, 0.03722, 0.4778`;
const filasNum = (txt, claves) => Object.fromEntries(txt.split("\n").map((l) => { const p = l.split(",").map((x) => x.trim()); return [p.slice(0, claves).join("|"), p.slice(claves).map(Number)]; }));
export const IEEE1584 = {
  t1: filasNum(T1584_1, 2), t2: filasNum(T1584_2, 1), t3: filasNum(T1584_3, 1), t4: filasNum(T1584_4, 1), t5: filasNum(T1584_5, 1), t7: filasNum(T1584_7, 2),
  configuraciones: { VCB: "VCB — electrodos verticales en caja", VCBB: "VCBB — verticales en caja con barrera aislante", HCB: "HCB — horizontales en caja", VOA: "VOA — verticales al aire libre", HOA: "HOA — horizontales al aire libre" },
  // Tablas 8 y 10: separación entre conductores (mm), caja alto × ancho × fondo (mm) y distancia de trabajo (mm) típicos.
  equipos: {
    sw15: { nombre: "Celdas (switchgear) 15 kV", G: 152, h: 1143, w: 762, d: 762, D: 914.4 }, mcc15: { nombre: "Centro de control de motores 15 kV", G: 152, h: 914.4, w: 914.4, d: 914.4, D: 914.4 },
    sw5: { nombre: "Celdas (switchgear) 5 kV", G: 104, h: 914.4, w: 914.4, d: 914.4, D: 914.4 }, mcc5: { nombre: "Centro de control de motores 5 kV", G: 104, h: 660.4, w: 660.4, d: 660.4, D: 914.4 },
    swBT: { nombre: "Tablero general de baja tensión (switchgear)", G: 32, h: 508, w: 508, d: 508, D: 609.6 }, mccBT: { nombre: "Centro de control de motores de BT", G: 25, h: 355.6, w: 304.8, d: 250, D: 457.2 },
    panelBT: { nombre: "Panel o tablero de distribución de BT", G: 25, h: 355.6, w: 304.8, d: 250, D: 457.2 }, panelBTp: { nombre: "Panel de BT poco profundo (≤ 203 mm)", G: 25, h: 355.6, w: 304.8, d: 100, D: 457.2 },
    cajaCable: { nombre: "Caja de empalme de cables", G: 13, h: 355.6, w: 304.8, d: 250, D: 457.2 }
  }
};
// Categorías de EPP según la energía incidente (NFPA 70E, mínima calificación de arco).
export const CATEGORIAS_EPP = [[1.2, "Sin requisito de ropa resistente al arco (≤ 1,2 cal/cm²)"], [4, "Categoría 1 (4 cal/cm²)"], [8, "Categoría 2 (8 cal/cm²)"], [25, "Categoría 3 (25 cal/cm²)"], [40, "Categoría 4 (40 cal/cm²)"]];

// NTC 2050 / NEC Tablas 310.60(C)(77) a (86): capacidad de corriente (A) de cables de 2001 a 35 000 V
// enterrados, con suelo a 20 °C, resistividad térmica 90 °C·cm/W, factor de carga 100 % y la
// disposición y profundidad de la Figura 310.60. Valores de la NEC 2017 (iguales en la NTC 2050
// de 2020) tomados de las verificaciones publicadas por CalcWare (www.calcware.com), que los
// contrastan con un cálculo Neher-McGrath. Dos erratas de la tabla impresa se reemplazaron por el
// valor coherente con el cálculo: Tabla 85, Detalle 7, 350 kcmil, 2001-5000 V, 105 °C (580 → 530)
// y Tabla 84, Detalle 6, 6 AWG, 5001-35 000 V, 105 °C (95 → 87).
// Clave "tabla|detalle"; cada fila: valores para los calibres de CALIBRES_MT ("" = no aplica).
export const CALIBRES_MT = ["8","6","4","2","1","1/0","2/0","3/0","4/0","250","350","500","750","1000"];
const AMP_MT_TXT = {
  "77|1": ["64 85 110 145 170 195 220 250 290 320 385 470 585 670", "69 92 120 155 180 210 235 270 310 345 415 505 630 720", " 90 115 155 175 200 230 260 295 325 390 465 565 640", " 97 125 165 185 215 245 275 315 345 415 500 610 690"],
  "77|2": ["56 73 95 125 140 160 185 210 235 260 315 375 460 525", "60 79 100 130 150 175 195 225 255 280 335 405 495 565", " 77 99 130 145 165 185 210 240 260 310 370 440 495", " 83 105 135 155 175 200 225 255 280 330 395 475 535"],
  "77|3": ["48 62 80 105 115 135 150 170 195 210 250 300 365 410", "52 67 86 110 125 145 160 185 210 225 270 325 395 445", " 64 82 105 120 135 150 170 190 210 245 290 350 390", " 68 88 115 125 145 165 185 205 225 265 310 375 415"],
  "78|1": ["50 66 86 115 130 150 170 195 225 250 305 370 470 545", "54 71 93 125 140 160 185 210 245 270 325 400 505 590", " 70 91 120 135 155 175 200 230 250 305 370 455 525", " 75 98 130 145 165 190 215 245 270 330 400 490 565"],
  "78|2": ["44 57 74 96 110 125 145 160 185 205 245 295 370 425", "47 61 80 105 120 135 155 175 200 220 265 320 395 460", " 60 77 100 110 125 145 165 185 200 245 290 355 405", " 65 83 105 120 140 155 175 200 220 260 315 385 440"],
  "78|3": ["38 48 62 80 91 105 115 135 150 165 195 240 290 335", "41 52 67 86 98 110 125 145 165 180 210 255 315 360", " 50 64 80 90 105 115 130 150 165 195 230 280 320", " 54 69 88 99 110 125 145 160 175 210 250 305 345"],
  "79|1": ["59 78 100 135 155 175 200 230 265 290 355 430 530 600", "64 84 110 145 165 190 220 250 285 315 380 460 570 645", " 88 115 150 170 195 220 250 285 310 375 450 545 615", " 95 125 160 185 210 235 270 305 335 400 485 585 660"],
  "79|2": ["53 69 89 115 135 150 170 195 225 245 295 355 430 485", "57 74 96 125 145 165 185 210 240 265 315 380 465 520", " 75 97 125 140 160 185 205 230 255 305 360 430 485", " 81 105 135 155 175 195 220 250 270 325 385 465 515"],
  "79|3": ["46 60 77 98 110 125 145 165 185 200 240 290 350 390", "50 65 83 105 120 135 155 175 200 220 270 310 375 420", " 63 81 105 115 130 150 170 190 205 245 290 340 380", " 68 87 110 125 145 160 180 200 220 275 305 365 405"],
  "80|1": ["46 61 80 105 120 140 160 180 205 230 280 340 429 495", "50 66 86 110 130 150 170 195 220 245 310 365 460 535", " 69 89 115 135 150 170 195 220 245 295 355 440 510", " 74 96 125 145 165 185 210 240 265 315 385 475 545"],
  "80|2": ["41 54 70 90 105 120 135 155 175 190 230 280 345 400", "44 58 75 97 110 125 145 165 185 205 250 300 375 430", " 59 75 100 110 125 140 160 180 200 240 285 350 400", " 64 81 105 120 135 155 175 195 215 255 305 375 430"],
  "80|3": ["36 46 60 77 87 99 110 130 145 160 190 230 280 320", "39 50 65 83 94 105 120 140 155 170 205 245 305 345", " 49 63 80 90 105 115 130 150 160 190 230 275 315", " 53 68 86 98 110 125 140 160 170 205 245 295 335"],
  "81|9": ["110 140 180 230 260 295 335 385 435 470 570 690 845 980", "115 150 195 250 280 320 365 415 465 510 615 745 910 1055", " 130 170 210 240 275 310 355 405 440 535 650 805 930", " 140 180 225 260 295 335 380 435 475 575 700 865 1005"],
  "81|10": ["100 130 165 215 240 275 310 355 400 435 520 630 775 890", "110 140 180 230 260 295 335 380 430 470 560 680 835 960", " 120 160 195 225 255 290 330 375 410 495 600 740 855", " 130 170 210 240 275 315 355 405 440 530 645 795 920"],
  "82|9": ["85 110 140 180 205 230 265 300 340 370 445 540 665 780", "90 115 150 195 220 250 285 320 365 395 480 580 720 840", " 100 130 165 185 215 245 275 315 345 415 510 635 740", " 110 140 175 200 230 260 295 340 370 450 545 680 795"],
  "82|10": ["80 100 130 165 190 215 245 275 310 340 410 495 610 710", "85 110 140 180 200 230 260 295 335 365 440 530 665 765", " 95 125 155 175 200 225 255 290 320 385 470 580 680", " 100 130 165 190 215 245 275 315 345 415 505 625 730"],
  "83|5": ["85 105 135 180 200 230 260 295 335 365 440 530 650 730", "89 115 150 190 215 245 280 320 360 395 475 570 700 785", " 115 142 185 210 240 270 305 350 380 460 550 665 750", " 120 155 200 225 255 290 330 375 410 495 590 720 810"],
  "83|6": ["80 100 130 165 185 215 240 275 310 340 410 490 595 665", "84 105 140 180 200 230 260 295 335 365 440 525 640 715", " 105 135 170 195 220 250 280 320 350 420 500 605 675", " 115 145 185 210 235 270 305 345 375 450 535 650 730"],
  "84|5": ["65 80 105 140 155 180 205 230 260 285 345 420 520 600", "70 88 115 150 170 190 220 250 280 310 375 450 560 650", " 90 115 145 165 185 210 240 270 300 360 435 540 620", " 95 125 155 175 200 225 260 295 320 390 470 580 665"],
  "84|6": ["60 75 100 130 145 165 190 215 245 265 320 385 480 550", "66 83 110 140 155 180 205 230 260 285 345 415 515 590", " 80 105 135 150 170 195 220 250 275 330 395 485 560", " 87 115 145 165 185 210 240 270 295 355 425 525 600"],
  "85|7": ["90 120 150 195 225 255 290 330 375 410 490 590 725 825", "95 130 165 205 240 270 310 360 405 445 530 635 780 885", " 115 150 190 215 245 275 315 360 390 470 565 685 770", " 120 160 205 230 260 295 340 385 410 505 605 740 830"],
  "85|8": ["85 110 140 180 205 235 265 300 340 370 445 535 650 740", "90 115 150 195 220 250 285 320 365 395 480 575 700 795", " 105 140 175 200 225 255 290 325 355 425 510 615 690", " 115 150 190 215 240 275 315 350 380 455 545 660 745"],
  "86|7": ["70 90 120 155 175 200 225 255 290 320 385 465 580 670", "75 100 130 165 190 210 240 275 310 350 420 500 625 725", " 90 115 145 165 190 215 245 280 305 370 445 550 635", " 95 125 155 175 205 230 265 305 325 400 480 590 680"],
  "86|8": ["65 85 110 140 160 180 205 235 265 290 350 420 520 600", "70 95 120 150 170 195 220 250 285 310 375 455 560 645", " 85 105 135 155 175 200 225 255 280 355 405 485 565", " 90 115 145 170 190 215 245 275 300 360 435 525 605"],
};
const filaNum = (t) => t.split(" ").map((x) => (x === "" ? null : Number(x)));
// AMPACIDAD_MT["77|1"] = { "5": { 90: [...], 105: [...] }, "35": { 90: [...], 105: [...] } }
export const AMPACIDAD_MT = Object.fromEntries(Object.entries(AMP_MT_TXT).map(([k, [a, b, c, e]]) => [k, { 5: { 90: filaNum(a), 105: filaNum(b) }, 35: { 90: filaNum(c), 105: filaNum(e) } }]));
// Instalaciones: tabla para cobre / aluminio y detalles de la Figura 310.60 por número de circuitos.
export const INSTALACIONES_MT = {
  ductoUni: { nombre: "Tres cables unipolares por ducto, banco de ductos subterráneo", cu: "77", al: "78", detalles: { 1: 1, 3: 2, 6: 3 } },
  ductoTri: { nombre: "Un cable tripolar por ducto, banco de ductos subterráneo", cu: "79", al: "80", detalles: { 1: 1, 3: 2, 6: 3 } },
  enterradoUni: { nombre: "Tres cables unipolares separados, directamente enterrados", cu: "81", al: "82", detalles: { 1: 9, 2: 10 } },
  enterradoTri: { nombre: "Cable tripolar directamente enterrado", cu: "83", al: "84", detalles: { 1: 5, 2: 6 } },
  enterradoTriplex: { nombre: "Cables unipolares en tríplex, directamente enterrados", cu: "85", al: "86", detalles: { 1: 7, 2: 8 } }
};

// ---------------------------------------------------------------- armónicos
export const ORDENES_ARMONICOS = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25];
// Espectros de corriente (% de la fundamental). Los de convertidores son los teóricos (Ih = I1/h);
// el de fuentes conmutadas es un espectro típico de computadores y debe confirmarse con medición.
export const ESPECTROS = {
  lineal: { nombre: "Lineal (sin armónicos)", h: {} },
  p6: { nombre: "Convertidor de 6 pulsos (variadores, rectificadores; teórico 1/h)", h: { 5: 20, 7: 14.29, 11: 9.09, 13: 7.69, 17: 5.88, 19: 5.26, 23: 4.35, 25: 4 } },
  p12: { nombre: "Convertidor de 12 pulsos (teórico 1/h)", h: { 11: 9.09, 13: 7.69, 23: 4.35, 25: 4 } },
  smps: { nombre: "Fuente conmutada monofásica (computadores, LED; espectro típico)", h: { 3: 81.1, 5: 60.6, 7: 37, 9: 15.7, 11: 2.4, 13: 6.3, 15: 7.9, 17: 5, 19: 0.8, 21: 2, 23: 2.6, 25: 1.6 } },
  personalizado: { nombre: "Personalizado (medición: «h:%; h:%»)", h: {} }
};
// IEEE 519-2014 Tabla 2 (120 V a 69 kV): límites de distorsión de corriente en % de IL según ISC/IL.
// Columnas: ISC/IL hasta, h < 11, 11 ≤ h < 17, 17 ≤ h < 23, 23 ≤ h < 35, 35 ≤ h ≤ 50, TDD.
export const IEEE519_CORRIENTE = [[20, 4, 2, 1.5, 0.6, 0.3, 5], [50, 7, 3.5, 2.5, 1, 0.5, 8], [100, 10, 4.5, 4, 1.5, 0.7, 12], [1000, 12, 5.5, 5, 2, 1, 15], [Infinity, 15, 7, 6, 2.5, 1.4, 20]];
// IEEE 519-2014 Tabla 1: distorsión de tensión (% individual, THD) según la tensión en el PCC.
export const IEEE519_TENSION = [[1, 5, 8], [69, 3, 5], [161, 1.5, 2.5], [Infinity, 1, 1.5]];

// ---------------------------------------------------------------- análisis de riesgos (literal a)
// RETIE 2024 (Res. 40117) Libro 1, 1.5.1.4.1, Tabla 1.5.1.4.1.a: nivel de riesgo según la
// consecuencia (1 a 5) y la probabilidad (E a A). Filas de la consecuencia 1 a la 5; columnas E, D, C, B, A.
export const PROBABILIDADES = { E: "E — No ha ocurrido en el sector", D: "D — Ha ocurrido en el sector", C: "C — Ha ocurrido en la empresa", B: "B — Sucede varias veces al año en la empresa", A: "A — Sucede varias veces al mes en la empresa" };
export const NIVELES_RIESGO = ["Muy bajo", "Bajo", "Medio", "Alto", "Muy alto"];
export const MATRIZ_RIESGO = [
  ["Muy bajo", "Bajo", "Bajo", "Bajo", "Medio"],
  ["Bajo", "Bajo", "Medio", "Medio", "Medio"],
  ["Bajo", "Medio", "Medio", "Medio", "Alto"],
  ["Medio", "Medio", "Medio", "Alto", "Alto"],
  ["Medio", "Alto", "Alto", "Alto", "Muy alto"]
];
// Descripción de cada consecuencia por clase (personas, económicas, ambientales, imagen).
export const CONSECUENCIAS = {
  personas: ["Molestia funcional (afecta el rendimiento laboral)", "Lesión menor (sin incapacidad)", "Incapacidad temporal (> 1 día)", "Incapacidad parcial permanente", "Una o más muertes"],
  economicas: ["Daños leves; no interrupción", "Daños importantes; interrupción breve", "Daños severos; interrupción temporal", "Daños mayores; salida de subestación", "Daño grave en infraestructura; interrupción regional"],
  ambientales: ["Sin efecto", "Efecto menor", "Contaminación localizada", "Contaminación mayor", "Contaminación irreparable"],
  imagen: ["Interna", "Local", "Regional", "Nacional", "Internacional"]
};
// Tabla 1.5.1.4.1.b: decisiones y acciones por nivel de riesgo.
export const DECISIONES_RIESGO = {
  "Muy alto": "Inadmisible para trabajar: eliminar las fuentes potenciales, hacer reingeniería o minimizarlo y volver a valorarlo en grupo hasta reducirlo. Requiere permiso especial de trabajo (ATS aprobado por la alta dirección y PES).",
  Alto: "Minimizarlo: buscar alternativas de menor riesgo, demostrar cómo se controla, aislar con barreras o distancia y usar EPP. Requiere permiso especial de trabajo (ATS y PT aprobados por el jefe del área).",
  Medio: "Aceptarlo aplicando los sistemas de control (minimizar, aislar, EPP, procedimientos, protocolos y listas de verificación). Requiere permiso de trabajo.",
  Bajo: "Asumirlo con control administrativo rutinario, siguiendo los procedimientos establecidos y usando EPP. No requiere permiso especial de trabajo.",
  "Muy bajo": "Vigilar posibles cambios. No afecta la secuencia de las actividades."
};
export const FACTORES_RIESGO = ["Arco eléctrico", "Ausencia de electricidad", "Contacto directo", "Contacto indirecto", "Cortocircuito", "Electricidad estática", "Equipo defectuoso", "Rayos", "Sobrecarga", "Tensión de contacto", "Tensión de paso", "Tensiones transferidas", "Sobretensiones", "Incendio o explosión de origen eléctrico", "Otro"];
export const nivelRiesgo = (consecuencia, probabilidad) => {
  const c = Math.min(5, Math.max(1, Math.round(Number(consecuencia) || 1))), p = ["E", "D", "C", "B", "A"].indexOf(String(probabilidad || "E").toUpperCase());
  return MATRIZ_RIESGO[c - 1][Math.max(0, p)];
};
