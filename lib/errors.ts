// Mensajes de error para la interfaz, por código estable de la API. Explican
// qué pasó y qué hacer, sin detalles internos.
const MESSAGES: Record<string, string> = {
  unauthenticated: "Tu sesión venció. Iniciá sesión de nuevo.",
  forbidden: "No tenés permiso para hacer esto en este workspace.",
  not_found: "No encontramos lo que buscabas, o ya no tenés acceso.",
  invalid_input: "Revisá los datos ingresados.",
  last_owner: "El workspace necesita al menos un Dueño. Asigná otro Dueño antes de hacer este cambio.",
  already_member: "Esa persona ya es integrante del workspace.",
  invitation_used: "Esta invitación ya fue usada.",
  invitation_expired: "Esta invitación venció. Pedile a un Dueño del workspace que te invite de nuevo.",
  invitation_revoked: "Esta invitación fue anulada. Pedile a un Dueño del workspace una nueva.",
  ai_not_configured: "El asistente de IA no está activado en este servidor.",
  ai_credits_exhausted: "Este workspace usó todo el presupuesto de IA del mes. El resto de Mova sigue funcionando.",
  ai_failed: "El servicio de IA no respondió. Probá de nuevo en unos minutos.",
  nothing_to_fix: "No hay sugerencias para corregir con Mova en la versión guardada.",
  ai_unavailable: "La IA no está activada en este servidor. Usá la sugerencia automática, que no tiene costo.",
  ai_auth: "La clave de IA no es válida o no tiene permisos. Revisá ANTHROPIC_API_KEY en el servidor.",
  ai_no_credits: "La cuenta del proveedor de IA no tiene crédito. Cargá saldo en la consola de Anthropic.",
  ai_rejected: "El proveedor de IA rechazó el pedido. El detalle quedó en el registro del servidor.",
  ai_rate_limited: "El proveedor de IA recibió demasiados pedidos. Probá de nuevo en un minuto.",
  ai_invalid_output: "La IA devolvió una propuesta que no se pudo usar. Probá de nuevo.",
  brand_identity_required: "Completá primero la sección Identidad: el asistente la necesita como contexto.",
  content_locked: "Esta pieza ya no se puede editar en su estado actual.",
  invalid_transition: "La pieza no puede pasar a ese estado desde el actual.",
  schedule_locked: "La fecha de una pieza publicada o archivada no se cambia desde el calendario.",
  invalid_range: "El rango de fechas no es válido.",
  review_blocked: "La pieza tiene puntos para corregir (en rojo) o imágenes sin texto. Corregilos y guardá una versión nueva.",
  version_changed: "La pieza cambió mientras la revisabas. Mirá la versión nueva antes de decidir.",
  already_approved: "Esta versión ya está aprobada.",
  brand_incomplete: "Completá las siete secciones necesarias de la marca: Mova las usa para escribir.",
  generation_limit: "Esta pieza llegó al tope de 5 propuestas de Mova. Editala a mano o creá una pieza nueva.",
  internal_error: "Algo falló de nuestro lado. Probá de nuevo en unos minutos.",
  // Imágenes generadas con IA (modo premium)
  images_not_configured: "La generación de imágenes con IA no está activada en este servidor (falta GEMINI_API_KEY). Podés seguir en modo estándar, sin costo.",
  images_budget_exhausted: "Este workspace llegó al límite mensual de imágenes con IA. Un Dueño puede subirlo en Uso de IA, o seguí en modo estándar.",
  images_auth: "La clave del proveedor de imágenes no es válida o no tiene permisos. Revisá GEMINI_API_KEY en el servidor.",
  images_no_credits: "La cuenta del proveedor de imágenes no tiene facturación o cuota disponible. Revisala en Google AI Studio.",
  images_rejected: "El proveedor rechazó la imagen (por ejemplo, por sus reglas de contenido). Probá con otra dirección o usá el modo estándar.",
  images_rate_limited: "El proveedor de imágenes recibió demasiados pedidos. Probá de nuevo en un minuto.",
  images_failed: "El proveedor de imágenes no respondió. No se cobró la imagen. Probá de nuevo o volvé al modo estándar.",
  estimate_changed: "El costo estimado cambió. Revisalo y confirmá de nuevo.",
  generation_in_progress: "Esa imagen ya se está generando.",
  request_used: "Ese pedido ya se usó. Confirmá de nuevo para generar otra imagen.",
  visual_mode_standard: "Activá «Generación visual con IA» en esta pieza para generar imágenes.",
  layout_not_allowed: "Esa composición no se usa en esta posición.",
  art_not_found: "La versión usa una imagen generada que no existe en esta pieza.",
  focus_required: "Escribí y guardá el foco de la semana: Mova arma la estrategia a partir de él.",
  week_past: "Esa semana ya pasó.",
  strategy_approved: "La estrategia de esta semana ya se aprobó y sus piezas se están generando.",
  strategy_not_proposed: "No hay una propuesta pendiente para esta semana. Pedí una nueva.",
  invalid_permalink: "Pegá el enlace de la publicación de Instagram (instagram.com/p/… o /reel/…).",
  publication_in_future: "La fecha de publicación no puede ser futura.",
  already_published: "Esta pieza ya tiene su publicación registrada.",
  not_approved: "Solo se registra como publicada una pieza con su versión actual aprobada.",
  permalink_used: "Ese enlace ya está registrado en otra pieza.",
  invalid_capture_date: "La fecha de la medición tiene que ser posterior a la publicación.",
  no_metrics: "Cargá al menos un dato.",
  apify_not_configured: "La lectura de métricas públicas no está activada en este servidor (falta APIFY_TOKEN). Podés cargarlas a mano.",
  apify_no_data: "Apify no encontró esa publicación (puede ser privada o el enlace estar mal). Revisá el enlace.",
  apify_auth: "El token de Apify no es válido. Revisá APIFY_TOKEN en el servidor.",
  apify_failed: "Apify no respondió. Probá de nuevo en unos minutos o cargá las métricas a mano.",
  upload_too_large: "La imagen pesa más de 8 MB.",
  upload_not_image: "El archivo tiene que ser una imagen PNG, JPG o WebP.",
  upload_wrong_ratio: "La imagen no tiene la proporción de esta pieza: 4:5 (1080×1350) en el feed, 9:16 (1080×1920) en Stories y Reels.",
  upload_too_small: "La imagen es chica para Instagram: usá al menos 1080 px de ancho.",
  too_many_references: "La marca ya tiene 12 referencias. Quitá alguna para sumar otra.",
  art_missing: "No se encontró una imagen generada de la pieza. Elegí otra o generala de nuevo.",
};

export function errorMessage(code: unknown): string {
  return (typeof code === "string" && MESSAGES[code]) || MESSAGES.internal_error!;
}

// Llamada a nuestra API desde el navegador. Devuelve los datos o un mensaje
// listo para mostrar.
export async function apiRequest<T = Record<string, unknown>>(
  url: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; message: string; code: string }> {
  try {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, code: String(data.error ?? "internal_error"), message: errorMessage(data.error) };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, code: "network", message: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo." };
  }
}
