/**
 * Cloudflare Pages Function: POST /api/contacto
 * Valida la consulta, verifica Turnstile (si está configurado) y la manda por email con la API de Brevo:
 * una copia a Dorn AI (CONTACT_TO) y una confirmación a quien escribió.
 *
 * Variables en Cloudflare Pages → Settings → Variables and Secrets:
 *   BREVO_API_KEY (secreto), CONTACT_TO, SENDER_EMAIL (remitente verificado en Brevo),
 *   TURNSTILE_SECRET_KEY (secreto, opcional pero recomendado).
 */
import { confirmationEmailHtml, isHoneypotFilled, leadEmailHtml, parseContact } from "../../src/lib/contact";

type Env = {
  BREVO_API_KEY?: string;
  CONTACT_TO?: string;
  SENDER_EMAIL?: string;
  TURNSTILE_SECRET_KEY?: string;
};

type Context = { request: Request; env: Env };

const CAL_URL = "https://cal.com/leonardo-rosendorn-66qm6v/30min";

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  const wantsJson = (request.headers.get("content-type") ?? "").includes("application/json");
  const reply = (status: number, body: Record<string, unknown>) => {
    // Sin JavaScript el navegador manda un form común: se redirige a una página en vez de mostrar JSON.
    if (!wantsJson) {
      const target = status === 200 ? "/gracias" : "/contacto?error=1";
      return Response.redirect(new URL(target, request.url).toString(), 303);
    }
    return Response.json(body, { status });
  };

  let raw: Record<string, unknown>;
  try {
    raw = wantsJson ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return reply(400, { error: "INVALID_INPUT" });
  }

  // Bot: se le responde "ok" para que no reintente, pero no se envía nada.
  if (isHoneypotFilled(raw)) return reply(200, { ok: true });

  const contact = parseContact(raw);
  if (!contact) return reply(400, { error: "INVALID_INPUT" });

  if (env.TURNSTILE_SECRET_KEY) {
    const token = String(raw["cf-turnstile-response"] ?? "");
    if (!token || !(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, request))) {
      return reply(400, { error: "CAPTCHA" });
    }
  }

  // Solo nombres de variables faltantes, nunca valores: sirve para diagnosticar sin ver los logs.
  const missing = (["BREVO_API_KEY", "CONTACT_TO", "SENDER_EMAIL"] as const).filter((k) => !env[k]);
  if (!env.BREVO_API_KEY || !env.CONTACT_TO || !env.SENDER_EMAIL) {
    console.error("contacto: faltan variables", missing);
    return reply(502, { error: "SEND_FAILED", reason: `MISSING_${missing.join("_")}` });
  }

  const sender = { name: "Dorn AI", email: env.SENDER_EMAIL };
  const lead = await sendEmail(env.BREVO_API_KEY, {
    sender,
    to: [{ email: env.CONTACT_TO }],
    replyTo: { email: contact.email, name: contact.nombre },
    subject: `Nueva consulta: ${contact.nombre}${contact.empresa ? ` (${contact.empresa})` : ""}`,
    htmlContent: leadEmailHtml(contact),
  });
  if (!lead.ok) return reply(502, { error: "SEND_FAILED", reason: lead.reason });

  // La confirmación es un extra: si falla, la consulta igual llegó.
  await sendEmail(env.BREVO_API_KEY, {
    sender,
    to: [{ email: contact.email, name: contact.nombre }],
    replyTo: { email: env.CONTACT_TO, name: "Dorn AI" },
    subject: "Recibimos tu consulta · Dorn AI",
    htmlContent: confirmationEmailHtml(contact, CAL_URL),
  });

  return reply(200, { ok: true });
}

async function sendEmail(apiKey: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true, reason: "" };
    // El código de Brevo (ej. "unauthorized") ayuda a diagnosticar; el mensaje puede traer datos y queda solo en el log.
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    console.error("Brevo", res.status, body.code, body.message);
    return { ok: false, reason: `BREVO_${res.status}_${body.code ?? "unknown"}` };
  } catch (err) {
    console.error("Brevo", err);
    return { ok: false, reason: "BREVO_NETWORK" };
  }
}

async function verifyTurnstile(token: string, secret: string, request: Request) {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
