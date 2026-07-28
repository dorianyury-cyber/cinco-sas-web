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
  { clave: "correspondencia_cruzada", nombre: "Correspondencia Cruzada", fase: "inicio" },
  { clave: "reunion_inicial", nombre: "Reunión Inicial", fase: "inicio" },
  { clave: "revision_doc_inicial", nombre: "Revisión Documentación Inicial", fase: "inicio" },
  { clave: "replanteo_obra", nombre: "Replanteo de Obra", fase: "ejecucion" },
  { clave: "socializacion_obra", nombre: "Socialización de Obra", fase: "ejecucion" },
  { clave: "documentacion_periodica", nombre: "Documentación Periódica", fase: "ejecucion" },
  { clave: "revision_materiales", nombre: "Revisión de Materiales", fase: "ejecucion" },
  { clave: "realizacion_inventarios", nombre: "Realización de Inventarios", fase: "ejecucion" },
  { clave: "reuniones_avance", nombre: "Reuniones de Avance de Obra", fase: "ejecucion" },
  { clave: "visita_obra", nombre: "Visita de Obra", fase: "ejecucion" },
  { clave: "realizacion_informes", nombre: "Realización de Informes", fase: "cierre" },
  { clave: "recibo_satisfaccion", nombre: "Recibo a Satisfacción", fase: "cierre" },
  { clave: "liquidacion_final", nombre: "Liquidación Final", fase: "cierre" }
];

// Borrador inicial para Consultoría — no hay checklist real documentado
// todavía, se arma por analogía con el de Obra. Ajustar con casos reales
// en cuanto se tengan.
export const ACTIVIDADES_CONSULTORIA = [
  { clave: "asignacion_recursos", nombre: "Asignación de Recursos", fase: "inicio" },
  { clave: "reunion_inicial", nombre: "Reunión Inicial", fase: "inicio" },
  { clave: "revision_doc_inicial", nombre: "Revisión Documentación Inicial", fase: "inicio" },
  { clave: "correspondencia_cruzada", nombre: "Correspondencia Cruzada", fase: "inicio" },
  { clave: "recopilacion_analisis", nombre: "Recopilación y Análisis de Información", fase: "ejecucion" },
  { clave: "elaboracion_estudios", nombre: "Elaboración de Estudios/Informes Técnicos", fase: "ejecucion" },
  { clave: "mesas_trabajo", nombre: "Mesas de Trabajo y Seguimiento", fase: "ejecucion" },
  { clave: "informe_final", nombre: "Informe Final", fase: "cierre" },
  { clave: "recibo_satisfaccion", nombre: "Recibo a Satisfacción", fase: "cierre" },
  { clave: "liquidacion_final", nombre: "Liquidación Final", fase: "cierre" }
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

export function plantillaActividades(tipo) {
  return tipo === "consultoria" ? ACTIVIDADES_CONSULTORIA : ACTIVIDADES_OBRA;
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
