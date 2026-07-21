const admin = require("firebase-admin");
admin.initializeApp();

const { enviarPQR } = require("./src/pqr");

exports.enviarPQR = enviarPQR;
