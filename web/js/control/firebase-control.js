// Init compartido de Firebase para el módulo protegido de Control de
// Contratos (web/control/*.html) — mismo patrón que web/js/pqr.js.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { firebaseConfig } from "../firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Perfil en la colección "empleados" (id = email, ver firestore.rules) del
// usuario autenticado — null si nadie lo ha registrado todavía ahí (cuenta
// de Firebase Auth creada pero sin perfil, o el primer admin antes del
// alta manual inicial). Se usa para decidir qué puede ver/editar cada
// quien: rol "admin" vs solo los contratos donde está en el "equipo".
export async function obtenerPerfil(email) {
  const snap = await getDoc(doc(db, "empleados", email));
  return snap.exists() ? snap.data() : null;
}

// Guardia de acceso compartida por las páginas protegidas: si no hay sesión
// redirige a login.html, si la hay invoca el callback con el usuario.
export function requireAuth(onUser) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    onUser(user);
  });
}
