// Equipo de interventoría: en una sola matriz, quién del personal de Cinco
// S.A.S. está asignado a cada contrato (filas = colaboradores activos de
// "empleados", columnas = contratos). El gestor marca o desmarca casillas y
// guarda todo junto; cada contrato que cambia actualiza su lista
// "miembros" y deja su entrada en el historial (quién entra / quién sale).
// El resto del equipo la ve en modo consulta, solo con sus contratos.
import { collection, getDocs, doc, writeBatch, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, iniciarPagina, pintarEncabezado, esc, imgModulo, mostrarAlerta, limpiarAlerta, errorAmigable, hoyISO } from "./ip-core.js";
import { anotarEnLote } from "./ip-historial.js";
import { mostrarLibro, mostrarTabla } from "./ip-visor.js";

const INACTIVOS = ["Terminado", "Liquidado"];
const RESUMEN_ROL = {
  admin: "Administrador: todo lo del gestor, más eliminar contratos y cambiar roles. Se asigna en Empleados del módulo interno.",
  gestor: "Gestor: ve todos los contratos, los crea y edita, asigna equipos, elimina registros y recibe los avisos por correo.",
  equipo: "Equipo: ve y registra información solo en los contratos donde está marcado; no elimina registros ni edita el contrato.",
  inactivo: "No está activo en Empleados: no puede ingresar."
};

const ctx = await iniciarPagina({ requiereContrato: false });
if (ctx) iniciar(ctx);

async function iniciar({ user, perfil, esGestor, contratos }) {
  pintarEncabezado(`${imgModulo("equipo", "ip-h1-foto")} Equipo de interventoría`, null);
  const matrizEl = document.getElementById("eqMatriz");
  const alerta = document.getElementById("eqAlerta");
  const buscarEl = document.getElementById("eqBuscar");
  const soloActivosEl = document.getElementById("eqSoloActivos");
  const soloAsignadosEl = document.getElementById("eqSoloAsignados");
  const barra = document.getElementById("eqGuardarBarra");
  if (!esGestor) {
    document.getElementById("eqDescripcion").textContent = "Quién está asignado a cada uno de tus contratos. Solo el gestor de Interventoría PRO puede cambiar las asignaciones.";
  }

  const snap = await getDocs(collection(db, "empleados"));
  const empleados = snap.docs.map((d) => ({ email: d.id, ...d.data() }))
    .filter((e) => e.estado === "activo")
    .sort((a, b) => String(a.nombre || a.email).localeCompare(String(b.nombre || b.email), "es"));
  // Roles de Interventoría PRO (ver ROLES abajo). El de administrador viene
  // del rol "admin" en Empleados y no se cambia aquí; gestor = casilla
  // gestionaInterventoriaPro de Empleados, que solo el administrador puede
  // cambiar (firestore.rules: empleados solo los edita esAdmin()).
  const rolDe = (e) => (e.inactivo ? "inactivo" : e.rol === "admin" ? "admin" : e.gestionaInterventoriaPro === true ? "gestor" : "equipo");
  const puedeCambiarRoles = perfil.rol === "admin";

  // Asignaciones: original (lo guardado) y actual (con los cambios sin guardar).
  const original = new Map(contratos.map((c) => [c.id, new Set(c.miembros || [])]));
  const actual = new Map([...original].map(([id, s]) => [id, new Set(s)]));
  // Correos asignados que ya no están activos en Empleados (no se pierden).
  const emailsActivos = new Set(empleados.map((e) => e.email));
  const huerfanos = [...new Set(contratos.flatMap((c) => c.miembros || []))].filter((m) => !emailsActivos.has(m));
  const filasBase = [...empleados, ...huerfanos.map((m) => ({ email: m, nombre: m, cargo: "No está activo en Empleados", inactivo: true }))];

  const contratosVisibles = () => contratos.filter((c) => !soloActivosEl.checked || !INACTIVOS.includes(c.estado));
  const asignado = (c, email) => actual.get(c.id).has(email);
  const cambios = () => contratos.map((c) => {
    const antes = original.get(c.id), ahora = actual.get(c.id);
    return { c, entran: [...ahora].filter((m) => !antes.has(m)), salen: [...antes].filter((m) => !ahora.has(m)) };
  }).filter((x) => x.entran.length || x.salen.length);

  // ---------------------------------------------------------- roles
  const ETIQUETA_ROL = { admin: "Administrador", gestor: "Gestor", equipo: "Equipo", inactivo: "Inactivo" };
  function celdaRol(e) {
    const rol = rolDe(e);
    if (rol === "admin" || rol === "inactivo" || !puedeCambiarRoles) {
      return `<span class="ip-rol ip-rol-${rol}" title="${esc(RESUMEN_ROL[rol] || "")}">${ETIQUETA_ROL[rol]}</span>`;
    }
    // Solo el administrador: dos botones, el activo resaltado.
    return `<div class="ip-rol-selector" role="group" aria-label="Rol de ${esc(e.nombre || e.email)}">
      ${["equipo", "gestor"].map((r) => `<button type="button" class="${rol === r ? "activo" : ""}" data-rol="${r}" data-email="${esc(e.email)}" title="${esc(RESUMEN_ROL[r])}">${ETIQUETA_ROL[r]}</button>`).join("")}
    </div>`;
  }
  async function cambiarRol(email, nuevo) {
    const e = empleados.find((x) => x.email === email);
    if (!e || rolDe(e) === nuevo) return;
    const texto = nuevo === "gestor"
      ? `¿Hacer a ${e.nombre || email} GESTOR de Interventoría PRO?\n\nPodrá ver TODOS los contratos, crearlos y editarlos, asignar equipos y eliminar registros.`
      : `¿Quitarle a ${e.nombre || email} el rol de gestor?\n\nQuedará como EQUIPO: solo verá y registrará información en los contratos donde esté marcado.`;
    if (!confirm(texto)) return;
    limpiarAlerta(alerta);
    try {
      await updateDoc(doc(db, "empleados", email), { gestionaInterventoriaPro: nuevo === "gestor" });
      e.gestionaInterventoriaPro = nuevo === "gestor";
      mostrarAlerta(alerta, `${e.nombre || email} ahora es ${ETIQUETA_ROL[nuevo].toLowerCase()} de Interventoría PRO.`, "success");
      pintar();
    } catch (err) {
      mostrarAlerta(alerta, `No se pudo cambiar el rol: ${errorAmigable(err)}`);
    }
  }
  document.getElementById("eqRolesBtn").addEventListener("click", () => {
    const si = "✅ Sí", no = "—";
    mostrarTabla({
      titulo: "Roles y permisos de Interventoría PRO",
      nota: `${puedeCambiarRoles ? "Como administrador, cambias el rol con los botones Equipo / Gestor de cada colaborador." : "El rol lo asigna el administrador."} Para que alguien aparezca aquí debe estar activo en Empleados del módulo interno de Cinco S.A.S.`,
      columnas: ["Qué puede hacer", "Administrador", "Gestor", "Equipo del contrato"],
      filas: [
        ["Ver contratos", "Todos", "Todos", "Solo donde está marcado"],
        ["Registrar y editar información en los módulos", si, si, "Solo en sus contratos"],
        ["Tomar y subir fotos, Registro en campo", si, si, "Solo en sus contratos"],
        ["Generar el informe mensual (PDF / Word)", si, si, "Solo de sus contratos"],
        ["Enviar avisos por correo al gestor", si, si, "Solo de sus contratos"],
        ["Ver el historial de cambios", si, si, "Solo de sus contratos"],
        ["Crear contratos y editar su información básica", si, si, no],
        ["Asignar el equipo de cada contrato", si, si, no],
        ["Eliminar registros (queda en el historial)", si, si, no],
        ["Recibir los avisos por correo como gestor", si, si, no],
        ["Eliminar un contrato completo", si, no, no],
        ["Cambiar el rol de los colaboradores", si, no, no]
      ]
    });
  });

  function pintarTarjetas() {
    const cs = contratosVisibles();
    const asignaciones = cs.reduce((s, c) => s + actual.get(c.id).size, 0);
    const conContrato = empleados.filter((e) => cs.some((c) => asignado(c, e.email))).length;
    const tile = (i, icon, valor, label) => `<div class="stat-tile icon-tile cinta cinta-${i}"><div class="icon">${icon}</div><div class="text"><div class="value">${valor}</div><div class="label">${label}</div></div></div>`;
    document.getElementById("eqTarjetas").innerHTML = `<div class="grid ip-tarjetas ip-tarjetas-4">
      ${tile(0, "👥", empleados.length, "Colaboradores activos")}
      ${tile(1, "📁", cs.length, soloActivosEl.checked ? "Contratos activos" : "Contratos")}
      ${tile(2, "🔗", asignaciones, "Asignaciones")}
      ${tile(3, "🙋", empleados.length - conContrato, "Colaboradores sin contrato")}
    </div>`;
  }

  function pintar() {
    pintarTarjetas();
    const cs = contratosVisibles();
    const t = buscarEl.value.trim().toLowerCase();
    let filas = filasBase.filter((e) => !t || `${e.nombre || ""} ${e.email} ${e.cargo || ""}`.toLowerCase().includes(t));
    if (soloAsignadosEl.checked) filas = filas.filter((e) => cs.some((c) => asignado(c, e.email)));
    document.getElementById("eqContador").textContent = `${filas.length} colaborador(es) · ${cs.length} contrato(s)`;
    if (!cs.length) {
      matrizEl.innerHTML = `<div class="card"><p class="text-muted ip-sin-margen">${esGestor ? 'No hay contratos. Créalos en <a href="contratos.html">Contratos</a>.' : "No estás asignado a ningún contrato."}</p></div>`;
      return;
    }
    matrizEl.innerHTML = `<div class="card ip-tabla-card"><div class="ip-eq-scroll"><table class="tabla-compacta ip-eq-matriz">
      <thead><tr><th class="ip-eq-persona">Colaborador</th><th class="ip-eq-rol">Rol</th>${cs.map((c) => `<th class="ip-eq-col" title="${esc(`${c.numero || ""} — ${c.contratante || ""} · ${c.objeto || ""}`)}"><span class="ip-eq-num">${esc(c.numero || "Sin número")}</span><span class="ip-eq-cte">${esc(c.contratante || "")}</span></th>`).join("")}<th class="ip-eq-total">Contratos</th></tr></thead>
      <tbody>${filas.map((e) => {
        const n = cs.filter((c) => asignado(c, e.email)).length;
        return `<tr class="${e.inactivo ? "ip-eq-inactivo" : ""}">
          <td class="ip-eq-persona"><strong>${esc(e.nombre || e.email)}</strong><br><span class="text-muted">${esc(e.cargo || "")}${e.cargo ? " · " : ""}${esc(e.email)}</span></td>
          <td class="ip-eq-rol">${celdaRol(e)}</td>
          ${cs.map((c) => {
            const cambio = asignado(c, e.email) !== original.get(c.id).has(e.email);
            return `<td class="ip-eq-celda${cambio ? " ip-eq-cambio" : ""}"><input type="checkbox" data-c="${c.id}" data-e="${esc(e.email)}" ${asignado(c, e.email) ? "checked" : ""} ${esGestor ? "" : "disabled"} aria-label="${esc(`${e.nombre || e.email} en ${c.numero || ""}`)}"></td>`;
          }).join("")}
          <td class="ip-eq-total">${n || "–"}</td></tr>`;
      }).join("")}</tbody>
      <tfoot><tr><th class="ip-eq-persona">Personas asignadas</th><th class="ip-eq-rol"></th>${cs.map((c) => `<th class="ip-eq-col">${actual.get(c.id).size}</th>`).join("")}<th></th></tr></tfoot>
    </table></div></div>`;
    matrizEl.querySelectorAll("[data-rol]").forEach((b) => b.addEventListener("click", () => cambiarRol(b.dataset.email, b.dataset.rol)));
    matrizEl.querySelectorAll("input[data-c]").forEach((chk) => chk.addEventListener("change", () => {
      const s = actual.get(chk.dataset.c);
      if (chk.checked) s.add(chk.dataset.e); else s.delete(chk.dataset.e);
      pintar();
    }));
    const pend = cambios();
    barra.classList.toggle("hidden", !pend.length);
    document.getElementById("eqPendientes").textContent = pend.length
      ? `${pend.reduce((s, x) => s + x.entran.length + x.salen.length, 0)} cambio(s) sin guardar en ${pend.length} contrato(s)`
      : "";
  }

  buscarEl.addEventListener("input", pintar);
  soloActivosEl.addEventListener("change", pintar);
  soloAsignadosEl.addEventListener("change", pintar);
  document.getElementById("eqDeshacerBtn").addEventListener("click", () => {
    original.forEach((s, id) => actual.set(id, new Set(s)));
    pintar();
  });

  const nombre = (m) => empleados.find((e) => e.email === m)?.nombre || m;
  document.getElementById("eqGuardarBtn").addEventListener("click", async () => {
    if (!esGestor) return;
    const pend = cambios();
    if (!pend.length) return;
    const resumen = pend.map((x) => `• ${x.c.numero}: ${x.entran.length ? `entran ${x.entran.map(nombre).join(", ")}` : ""}${x.entran.length && x.salen.length ? "; " : ""}${x.salen.length ? `salen ${x.salen.map(nombre).join(", ")}` : ""}`).join("\n");
    if (!confirm(`¿Guardar estos cambios en el equipo?\n\n${resumen}\n\nQuienes salen dejan de ver esos contratos. Queda constancia en el historial de cada contrato.`)) return;
    const btn = document.getElementById("eqGuardarBtn");
    btn.disabled = true;
    limpiarAlerta(alerta);
    try {
      // Un lote: el cambio de cada contrato y su entrada de historial.
      const lote = writeBatch(db);
      pend.forEach(({ c, entran, salen }) => {
        lote.update(doc(db, "ipContratos", c.id), { miembros: [...actual.get(c.id)], actualizadoEn: serverTimestamp(), actualizadoPor: user.email });
        anotarEnLote(lote, c.id, {
          user, perfil, modulo: "contrato", moduloLabel: "Equipo del contrato", registroId: c.id, accion: "contrato", resumen: `Equipo del contrato ${c.numero || ""}`,
          cambios: [{ campo: "miembros", etiqueta: "Equipo", antes: salen.length ? `Salen: ${salen.map(nombre).join(", ")}` : "—", despues: entran.length ? `Entran: ${entran.map(nombre).join(", ")}` : "—" }]
        });
      });
      await lote.commit();
      pend.forEach(({ c }) => original.set(c.id, new Set(actual.get(c.id))));
      mostrarAlerta(alerta, `Equipo actualizado en ${pend.length} contrato(s).`, "success");
      pintar();
    } catch (err) {
      mostrarAlerta(alerta, `No se pudo guardar: ${errorAmigable(err)}`);
    } finally {
      btn.disabled = false;
    }
  });
  window.addEventListener("beforeunload", (e) => { if (cambios().length) { e.preventDefault(); e.returnValue = ""; } });

  // Ver / exportar: la matriz como tabla (X = asignado).
  document.getElementById("eqExcelBtn").addEventListener("click", () => {
    const ExcelJS = window.ExcelJS;
    if (!ExcelJS) { alert("No se pudo cargar el generador de Excel."); return; }
    const cs = contratosVisibles();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Equipo");
    ws.columns = [{ header: "Colaborador", key: "n", width: 32 }, { header: "Rol", key: "rol", width: 14 }, { header: "Cargo", key: "g", width: 24 }, { header: "Correo", key: "e", width: 30 },
      ...cs.map((c) => ({ header: c.numero || "Sin número", key: c.id, width: 11 })), { header: "Contratos", key: "t", width: 10 }];
    filasBase.forEach((e) => {
      const fila = { n: e.nombre || e.email, rol: ETIQUETA_ROL[rolDe(e)], g: e.cargo || "", e: e.email, t: cs.filter((c) => asignado(c, e.email)).length };
      cs.forEach((c) => { fila[c.id] = asignado(c, e.email) ? "X" : ""; });
      ws.addRow(fila);
    });
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2732" } };
    mostrarLibro(wb, `Equipo de interventoría ${hoyISO()}.xlsx`, { titulo: "Vista previa — Equipo de interventoría", nota: "X = asignado al contrato." });
  });

  pintar();
}
