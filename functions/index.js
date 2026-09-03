const admin = require("firebase-admin");
admin.initializeApp();

const { enviarPQR } = require("./src/pqr");
const { recibirStaffConecta } = require("./src/recibirStaffConecta");
const { emitirRadicadoInformeGestion } = require("./src/radicadoInformeGestionConecta");

exports.enviarPQR = enviarPQR;
exports.recibirStaffConecta = recibirStaffConecta;
exports.emitirRadicadoInformeGestion = emitirRadicadoInformeGestion;
