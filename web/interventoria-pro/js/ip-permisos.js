// Roles y permisos de Interventoría PRO (propios, no dependen del rol del
// módulo interno). Es la misma lógica de firestore.rules (ipRol / ipPuede),
// que es la barrera real; aquí solo se decide qué mostrar.
//  - Administrador principal fijo (DUENO): siempre admin con todo; el
//    único que edita la matriz de permisos.
//  - ipConfig/roles.roles[email] = "admin" | "gestor" | "equipo". Sin
//    asignación: gestor si tenía el permiso anterior (admin del módulo
//    interno o gestionaInterventoriaPro), si no, equipo.
//  - ipConfig/permisos.{rol}.{permiso}; si no existe, PERMISOS_DEFECTO.
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const DUENO = "gerencia.cincoltda@hotmail.com";
export const ROLES = ["admin", "gestor", "equipo"];
export const ETIQUETA_ROL = { admin: "Administrador", gestor: "Gestor", equipo: "Equipo" };

// Permisos que se pueden marcar por rol (los que hace cumplir la base de
// datos llevan regla en firestore.rules; los de interfaz se indican).
export const PERMISOS = [
  { id: "verTodos", texto: "Ver todos los contratos", ayuda: "Sin este permiso, la persona solo ve los contratos donde está marcada en Equipo de interventoría." },
  { id: "registrar", texto: "Registrar y editar información en los módulos", ayuda: "Incluye subir fotos y Registro en campo. Sin este permiso solo consulta." },
  { id: "eliminarRegistros", texto: "Eliminar registros", ayuda: "Lo eliminado queda guardado en el historial." },
  { id: "crearContratos", texto: "Crear contratos y editar su información básica" },
  { id: "asignarEquipo", texto: "Asignar el equipo de cada contrato" },
  { id: "eliminarContratos", texto: "Eliminar un contrato completo" },
  { id: "verHistorial", texto: "Ver el historial de cambios" },
  { id: "generarInforme", texto: "Generar el informe mensual (PDF / Word)", interfaz: true },
  { id: "enviarAvisos", texto: "Enviar avisos por correo" },
  { id: "recibirAvisos", texto: "Recibir los avisos por correo (como gestor)" },
  { id: "cambiarRoles", texto: "Cambiar el rol de los colaboradores" }
];

const todos = (v) => Object.fromEntries(PERMISOS.map((p) => [p.id, v]));
export const PERMISOS_DEFECTO = {
  admin: todos(true),
  gestor: { ...todos(true), eliminarContratos: false, cambiarRoles: false },
  equipo: { ...todos(false), registrar: true, verHistorial: true, generarInforme: true, enviarAvisos: true }
};

// Si no se puede leer (ej. sin conexión), se usan los valores por defecto:
// la pantalla sigue funcionando y la base de datos igual hace cumplir lo real.
export async function cargarConfig(db) {
  try {
    const [r, p] = await Promise.all([getDoc(doc(db, "ipConfig", "roles")), getDoc(doc(db, "ipConfig", "permisos"))]);
    return { roles: (r.exists() && r.data().roles) || {}, permisos: p.exists() ? p.data() : null };
  } catch (err) {
    console.warn("No se pudo leer la configuración de roles y permisos:", err);
    return { roles: {}, permisos: null };
  }
}

export function rolDe(email, empleado, config) {
  if (email === DUENO) return "admin";
  const asignado = config.roles[email];
  if (asignado) return asignado;
  return empleado?.rol === "admin" || empleado?.gestionaInterventoriaPro === true ? "gestor" : "equipo";
}

export function permisosDe(rol, config) {
  const tabla = config.permisos || PERMISOS_DEFECTO;
  return { ...todos(false), ...(tabla[rol] || {}) };
}

// Permisos de quien está usando el aplicativo.
export function permisosUsuario(email, empleado, config) {
  const rol = rolDe(email, empleado, config);
  const p = email === DUENO ? todos(true) : permisosDe(rol, config);
  return { rol, esDueno: email === DUENO, ...p };
}
