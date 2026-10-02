# dornai.lat — web de Dorn AI

Sitio estático en [Astro](https://astro.build) + Tailwind, publicado en **Cloudflare Pages**. El formulario de contacto es una función de Cloudflare (`functions/api/contacto.ts`) que manda la consulta por email con Brevo.

## Comandos

```bash
npm install
npm run dev         # http://localhost:4321 (sin la función del formulario)
npm run preview:cf  # compila y sirve con la función en http://localhost:8788
npm run check       # tipos + tests
npm run build       # genera dist/
```

## Contenido

- Servicios: un archivo por servicio en `src/content/servicios/*.md` (el nombre del archivo es la URL `/servicios/<nombre>/`).
- Textos compartidos (pasos, preguntas frecuentes, integraciones, link de Cal.com): `src/data/site.ts`.

## Cloudflare Pages

- Build command: `npm run build` · Output: `dist` · Variable `NODE_VERSION=22`
- Variables y secretos (Settings → Variables and Secrets):
  - `BREVO_API_KEY` (secreto): clave **API** de Brevo (SMTP & API → API Keys), no la clave SMTP.
  - `CONTACT_TO`: email que recibe las consultas.
  - `SENDER_EMAIL`: remitente verificado en Brevo.
  - `TURNSTILE_SECRET_KEY` (secreto) y `PUBLIC_TURNSTILE_SITE_KEY`: Cloudflare Turnstile (anti-spam). Opcional: sin ellas el formulario usa solo el campo trampa.
- Para probar local con email real, crear `.dev.vars` (no se sube a git) con esas variables.
