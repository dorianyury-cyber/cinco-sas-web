// Plantillas de checklist para el módulo de Control de Contratos.
// Editar este archivo cuando cambie el checklist real de la operación —
// no hay UI de administración de plantillas a propósito (mantenerlo ágil).
//
// Cada ítem: { clave, nombre, fase } — "fase" solo se usa en Actividades
// (agrupa el acordeón en Inicio/Ejecución/Cierre para no mostrar todo de
// una vez); en Servicio al Cliente y Talento Humano queda en null.

export const SERVICIO_CLIENTE = [
  { clave: "solicitud_cliente", nombre: "Solicitud del cliente", fase: null },
  { clave: "terminos_referencia", nombre: "Términos de referencia de la invitación", fase: null },
  { clave: "elaboracion_oferta", nombre: "Elaboración de la oferta", fase: null },
  { clave: "facturacion_servicio", nombre: "Facturación del servicio", fase: null }
];

export const TALENTO_HUMANO = [
  { clave: "recurso_requerido", nombre: "Recurso humano requerido", fase: null },
  { clave: "contratacion_personal", nombre: "Contratación de personal (no disponible internamente)", fase: null },
  { clave: "capacitaciones", nombre: "Capacitaciones", fase: null },
  { clave: "formacion_especifica", nombre: "Formación específica", fase: null }
];

// Checklist real de Obra/Interventoría, tomado del control por carpetas que
// ya se llevaba manualmente (ej. contrato GGC 503 Brisas del Venado),
// agrupado en 3 fases para el acordeón.
export const ACTIVIDADES_OBRA = [
  { clave: "asignacion_recursos", nombre: "Asignación de Recursos", fase: "inicio" },
  { clave: "induccion_personal", nombre: "Inducción de Personal", fase: "inicio" },
  { clave: "obtencion_informacion", nombre: "Obtención de Información", fase: "inicio" },
  { clave: "rediseno_proyecto", nombre: "Rediseño del Proyecto", fase: "inicio" },
  // "Correspondencia Cruzada" no es un evento de una sola vez al inicio —
  // ocurre durante todo el contrato, así que se repite como un ítem
  // independiente en cada fase (cada fase es su propio grupo con su propio
  // contador, no hay forma de que un solo ítem "aparezca en las tres").
  { clave: "correspondencia_cruzada_inicio", nombre: "Correspondencia Cruzada", fase: "inicio" },
  { clave: "reunion_inicial", nombre: "Reunión Inicial", fase: "inicio" },
  { clave: "revision_doc_inicial", nombre: "Revisión Documentación Inicial", fase: "inicio" },
  { clave: "replanteo_obra", nombre: "Replanteo de Obra", fase: "ejecucion" },
  { clave: "socializacion_obra", nombre: "Socialización de Obra", fase: "ejecucion" },
  { clave: "documentacion_periodica", nombre: "Documentación Periódica", fase: "ejecucion" },
  // Antes solo había un ítem de informes, en Cierre — en la práctica también
  // se entregan informes periódicos durante la ejecución (igual que ya
  // distingue el checklist de Servicio: "Elaboración de Estudios/Informes
  // Técnicos" en Ejecución vs. "Informe Final" en Cierre).
  { clave: "informes_periodicos", nombre: "Informes Periódicos de Avance", fase: "ejecucion" },
  { clave: "revision_materiales", nombre: "Revisión de Materiales", fase: "ejecucion" },
  { clave: "realizacion_inventarios", nombre: "Realización de Inventarios", fase: "ejecucion" },
  { clave: "reuniones_avance", nombre: "Reuniones de Avance de Obra", fase: "ejecucion" },
  { clave: "visita_obra", nombre: "Visita de Obra", fase: "ejecucion" },
  { clave: "correspondencia_cruzada_ejecucion", nombre: "Correspondencia Cruzada", fase: "ejecucion" },
  { clave: "realizacion_informes", nombre: "Realización de Informes", fase: "cierre" },
  { clave: "recibo_satisfaccion", nombre: "Recibo a Satisfacción", fase: "cierre" },
  { clave: "liquidacion_final", nombre: "Liquidación Final", fase: "cierre" },
  { clave: "correspondencia_cruzada_cierre", nombre: "Correspondencia Cruzada", fase: "cierre" }
];

// Borrador inicial para Servicio — no hay checklist real documentado
// todavía, se arma por analogía con el de Obra. Ajustar con casos reales
// en cuanto se tengan.
export const ACTIVIDADES_SERVICIO = [
  { clave: "asignacion_recursos", nombre: "Asignación de Recursos", fase: "inicio" },
  { clave: "reunion_inicial", nombre: "Reunión Inicial", fase: "inicio" },
  { clave: "revision_doc_inicial", nombre: "Revisión Documentación Inicial", fase: "inicio" },
  { clave: "correspondencia_cruzada_inicio", nombre: "Correspondencia Cruzada", fase: "inicio" },
  { clave: "recopilacion_analisis", nombre: "Recopilación y Análisis de Información", fase: "ejecucion" },
  { clave: "elaboracion_estudios", nombre: "Elaboración de Estudios/Informes Técnicos", fase: "ejecucion" },
  { clave: "mesas_trabajo", nombre: "Mesas de Trabajo y Seguimiento", fase: "ejecucion" },
  { clave: "correspondencia_cruzada_ejecucion", nombre: "Correspondencia Cruzada", fase: "ejecucion" },
  { clave: "informe_final", nombre: "Informe Final", fase: "cierre" },
  { clave: "recibo_satisfaccion", nombre: "Recibo a Satisfacción", fase: "cierre" },
  { clave: "liquidacion_final", nombre: "Liquidación Final", fase: "cierre" },
  { clave: "correspondencia_cruzada_cierre", nombre: "Correspondencia Cruzada", fase: "cierre" }
];

export const FASES = [
  { clave: "inicio", nombre: "Fase de Inicio" },
  { clave: "ejecucion", nombre: "Fase de Ejecución" },
  { clave: "cierre", nombre: "Fase de Cierre" }
];

export const CAMPOS = [
  { clave: "servicio_cliente", nombre: "Servicio al Cliente" },
  { clave: "talento_humano", nombre: "Talento Humano" },
  { clave: "actividades", nombre: "Actividades" }
];

// Columnas editables de un ítem del checklist (fila en crearFilaItem, en
// contrato-detalle.js) — es la unidad de permiso para los roles
// "Apoyo" (camposPermitidos: cuáles puede editar) y "Empleado"
// (camposVisibles: cuáles puede ver). "Verificado por"/"Fecha de
// verificación" del panel de detalle no entran en este permiso: quedan
// reservadas a Admin/Coadministrador siempre.
export const COLUMNAS_ITEM = [
  { clave: "estado", nombre: "Estado" },
  { clave: "fecha", nombre: "Fecha" },
  { clave: "responsable", nombre: "Responsable" },
  { clave: "enlace", nombre: "Enlace" },
  { clave: "notas", nombre: "Notas" }
];

export function plantillaActividades(tipo) {
  return tipo === "servicio" ? ACTIVIDADES_SERVICIO : ACTIVIDADES_OBRA;
}

// Arma la lista plana de ítems a sembrar en contratos/{id}/items al crear
// un contrato, según su tipo.
export function itemsIniciales(tipo) {
  const items = [];
  let orden = 0;
  const agregar = (campo, lista) => {
    lista.forEach((it) => {
      items.push({ campo, orden: orden++, estado: "pendiente", responsable: "", fecha: null, enlace: "", notas: "", ...it });
    });
  };
  agregar("servicio_cliente", SERVICIO_CLIENTE);
  agregar("talento_humano", TALENTO_HUMANO);
  agregar("actividades", plantillaActividades(tipo));
  return items;
}
