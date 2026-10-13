/** Validación y armado de emails del formulario de contacto (sin dependencias: corre en Cloudflare y en los tests). */

export const SERVICE_SLUGS = [
  "agentes-ia",
  "agentes-de-voz",
  "asistente-conocimiento",
  "automatizacion-procesos",
  "estrategia-capacitacion",
  "operacion-mensual",
] as const;

export type ContactInput = {
  nombre: string;
  email: string;
  empresa: string;
  servicio: string;
  mensaje: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Devuelve los datos limpios o null si algo no cumple. */
export function parseContact(raw: Record<string, unknown>): ContactInput | null {
  const input = {
    nombre: text(raw.nombre),
    email: text(raw.email).toLowerCase(),
    empresa: text(raw.empresa),
    servicio: text(raw.servicio),
    mensaje: text(raw.mensaje),
  };
  if (input.nombre.length < 2 || input.nombre.length > 120) return null;
  if (!EMAIL_RE.test(input.email) || input.email.length > 200) return null;
  if (input.empresa.length > 120) return null;
  if (input.mensaje.length < 10 || input.mensaje.length > 2000) return null;
  if (input.servicio && !(SERVICE_SLUGS as readonly string[]).includes(input.servicio)) return null;
  return input;
}

/** Un bot completó el campo oculto. */
export function isHoneypotFilled(raw: Record<string, unknown>) {
  return text(raw.sitio_web).length > 0;
}

const URL_SRC = String.raw`(https?:\/\/|www\.|\b[a-z0-9-]+\.(ru|su|xyz|top|click|online|site|shop|biz|info)\b)`;
const URL_RE = new RegExp(URL_SRC, "i");
const URL_ALL_RE = new RegExp(URL_SRC, "gi");
const DOMAIN_RE = /\b[a-z0-9-]+\.(com|net|org|ru|io|co|lat|ar|mx|info|biz|xyz|top|site|online)\b/i;
const MARKUP_RE = /<\s*\/?\s*[a-z][^>]*>|\[\/?url|\[\/?link|&#\d+;?|&#x[0-9a-f]+;?/i;
// Cirílico, CJK, árabe, etc.: el sitio es en español y apunta a Latinoamérica.
const FOREIGN_SCRIPT_RE = /[Ѐ-ӿ؀-ۿ぀-ヿ一-鿿가-힯]/g;
const SPAM_WORDS_RE = /\b(seo|backlinks?|casino|viagra|crypto|bitcoin|forex|loan|porn|xxx|rank(ing)? your|first page of google)\b/i;

/**
 * Señales típicas del spam automático (ej. "раскрутка сайта" con <a href> a un .ru).
 * Devuelve el motivo para loguearlo, o null si parece una consulta real.
 * Es conservador: un cliente puede pegar el link de su web en el mensaje, pero no HTML ni varios links.
 */
export function spamReason(c: ContactInput): string | null {
  if (MARKUP_RE.test(c.nombre) || MARKUP_RE.test(c.empresa) || MARKUP_RE.test(c.mensaje)) return "MARKUP";
  if (URL_RE.test(c.nombre) || DOMAIN_RE.test(c.nombre)) return "URL_IN_NAME";
  if (URL_RE.test(c.empresa)) return "URL_IN_COMPANY";
  if ((c.mensaje.match(URL_ALL_RE) ?? []).length > 1) return "MANY_URLS";
  const all = `${c.nombre} ${c.empresa} ${c.mensaje}`;
  const foreign = (all.match(FOREIGN_SCRIPT_RE) ?? []).length;
  if (foreign >= 3) return "FOREIGN_SCRIPT";
  if (SPAM_WORDS_RE.test(all)) return "SPAM_WORDS";
  return null;
}

/** Los formularios completados en menos de esto los llena un script, no una persona. */
export const MIN_FILL_MS = 4000;

/** true si el tiempo de completado (ms, lo pone el JS de la página) es imposible para una persona. */
export function filledTooFast(raw: Record<string, unknown>) {
  const value = text(raw.ts);
  if (!value) return false; // sin JS: lo resuelven Turnstile y el filtro de contenido
  const elapsed = Number(value);
  return !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Email para Dorn AI con la consulta. */
export function leadEmailHtml(c: ContactInput) {
  const rows = [
    ["Nombre", c.nombre],
    ["Email", c.email],
    ["Empresa", c.empresa || "—"],
    ["Servicio", c.servicio || "Diagnóstico / no está seguro"],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5b6b63">${k}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0b1f17">
<h2 style="margin:0 0 12px">Nueva consulta desde dornai.lat</h2>
<table>${rows}</table>
<p style="margin:16px 0 4px;color:#5b6b63">Mensaje</p>
<p style="white-space:pre-wrap;margin:0">${escapeHtml(c.mensaje)}</p>
<p style="margin-top:20px;color:#5b6b63;font-size:13px">Respondé este email para contestarle directamente.</p>
</div>`;
}

/**
 * Confirmación automática para quien escribió.
 * No repite el mensaje: si lo hiciera, cualquiera podría poner el email de un tercero
 * y usar a Dorn AI para mandarle sus links (relay de spam que arruina la reputación del remitente).
 */
export function confirmationEmailHtml(c: ContactInput, calUrl: string) {
  const firstName = escapeHtml(c.nombre.split(/\s+/)[0].slice(0, 40));
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0b1f17;line-height:1.6">
<p>Hola ${firstName},</p>
<p>Recibimos tu consulta y te respondemos dentro de las 24 hs hábiles.</p>
<p>Si querés avanzar más rápido, podés agendar un diagnóstico gratuito de 30 minutos: <a href="${calUrl}">${calUrl}</a></p>
<p style="margin-top:20px;color:#5b6b63;font-size:13px">Si no enviaste esta consulta, ignorá este email.</p>
<p>— Dorn AI · dornai.lat</p>
</div>`;
}
