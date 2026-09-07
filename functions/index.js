const admin = require("firebase-admin");
admin.initializeApp();

const { enviarPQR } = require("./src/pqr");
const { recibirStaffConecta } = require("./src/recibirStaffConecta");
const { emitirRadicadoInformeGestion } = require("./src/radicadoInformeGestionConecta");
const { iniciarSesionConConecta } = require("./src/iniciarSesionConConecta");

exports.enviarPQR = enviarPQR;
exports.recibirStaffConecta = recibirStaffConecta;
exports.emitirRadicadoInformeGestion = emitirRadicadoInformeGestion;
exports.iniciarSesionConConecta = iniciarSesionConConecta;
