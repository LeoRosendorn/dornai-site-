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

/** Confirmación automática para quien escribió. */
export function confirmationEmailHtml(c: ContactInput, calUrl: string) {
  const firstName = escapeHtml(c.nombre.split(/\s+/)[0]);
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0b1f17;line-height:1.6">
<p>Hola ${firstName},</p>
<p>Recibimos tu consulta y te respondemos dentro de las 24 hs hábiles.</p>
<p>Si querés avanzar más rápido, podés agendar un diagnóstico gratuito de 30 minutos: <a href="${calUrl}">${calUrl}</a></p>
<p style="margin-top:20px;color:#5b6b63;font-size:13px">Tu mensaje:<br><span style="white-space:pre-wrap">${escapeHtml(c.mensaje)}</span></p>
<p>— Dorn AI · dornai.lat</p>
</div>`;
}
