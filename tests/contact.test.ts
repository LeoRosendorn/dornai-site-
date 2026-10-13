import { describe, expect, it } from "vitest";
import {
  confirmationEmailHtml,
  filledTooFast,
  isHoneypotFilled,
  leadEmailHtml,
  parseContact,
  spamReason,
} from "../src/lib/contact";

const valid = {
  nombre: "Ana Pérez",
  email: "Ana@Empresa.com ",
  empresa: "Empresa SA",
  servicio: "agentes-ia",
  mensaje: "Recibimos 200 consultas por WhatsApp por día.",
};

describe("parseContact", () => {
  it("acepta una consulta válida y normaliza el email", () => {
    expect(parseContact(valid)).toEqual({ ...valid, email: "ana@empresa.com" });
  });

  it("acepta empresa y servicio vacíos", () => {
    expect(parseContact({ ...valid, empresa: "", servicio: "" })).not.toBeNull();
  });

  it.each([
    ["nombre corto", { nombre: "A" }],
    ["email inválido", { email: "ana@empresa" }],
    ["mensaje corto", { mensaje: "Hola" }],
    ["mensaje largo", { mensaje: "x".repeat(2001) }],
    ["servicio inexistente", { servicio: "testing-qa" }],
    ["tipos raros", { nombre: 123 }],
  ])("rechaza %s", (_name, patch) => {
    expect(parseContact({ ...valid, ...patch })).toBeNull();
  });
});

describe("emails", () => {
  it("escapa HTML en los datos del contacto", () => {
    const c = parseContact({ ...valid, nombre: "<script>x</script> Ana" })!;
    expect(leadEmailHtml(c)).not.toContain("<script>");
    expect(confirmationEmailHtml(c, "https://cal.com/x")).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("detecta el campo trampa", () => {
    expect(isHoneypotFilled({ sitio_web: "http://spam" })).toBe(true);
    expect(isHoneypotFilled({})).toBe(false);
  });
});

describe("spamReason", () => {
  const spam = (patch: Record<string, string>) => spamReason(parseContact({ ...valid, ...patch })!);

  it("deja pasar consultas reales", () => {
    expect(spam({})).toBeNull();
    expect(spam({ mensaje: "Somos una clínica, nuestra web es https://clinica.com.ar y queremos un bot." })).toBeNull();
    expect(spam({ nombre: "José Núñez", empresa: "Ñandú S.R.L." })).toBeNull();
  });

  it("bloquea el spam ruso que llegó por el formulario", () => {
    expect(
      spam({
        nombre: "раскрутка сайта",
        empresa: "Apple",
        mensaje:
          'Продвижение сайтов — это комплекс действий.\n<a href="http://prodvizhenie-saytov-moskva.ru/nastroika-yandex-direkt/">http://prodvizhenie-saytov-moskva.ru/nastroika-yandex-direkt/</a>\nБл&#1',
      }),
    ).not.toBeNull();
    expect(
      spam({
        nombre: "prodvizhenie-saytov-moskva.ru",
        empresa: "FBI",
        mensaje: "Продвижение веб-ресурсов — это комплекс действий, направленных на улучшение рейтинга.",
      }),
    ).not.toBeNull();
  });

  it.each([
    ["HTML en el mensaje", { mensaje: 'Mirá <a href="http://x.com">esto</a> por favor' }, "MARKUP"],
    ["dominio en el nombre", { nombre: "mejor-seo.com" }, "URL_IN_NAME"],
    ["varios links", { mensaje: "Ver https://a.com y https://b.com ahora" }, "MANY_URLS"],
    ["cirílico", { mensaje: "Здравствуйте, предлагаем услуги" }, "FOREIGN_SCRIPT"],
    ["palabras de spam", { mensaje: "We offer cheap SEO backlinks for your site" }, "SPAM_WORDS"],
  ])("detecta %s", (_name, patch, reason) => {
    expect(spam(patch)).toBe(reason);
  });
});

describe("filledTooFast", () => {
  it("marca envíos en menos de 4 segundos o con valores inventados", () => {
    expect(filledTooFast({ ts: "800" })).toBe(true);
    expect(filledTooFast({ ts: "abc" })).toBe(true);
    expect(filledTooFast({ ts: "25000" })).toBe(false);
    expect(filledTooFast({})).toBe(false);
  });
});

describe("confirmación", () => {
  it("no repite el mensaje (evita usarnos para mandar spam a terceros)", () => {
    const c = parseContact({ ...valid, mensaje: "Visitá http://spam.example/oferta ya mismo" })!;
    expect(confirmationEmailHtml(c, "https://cal.com/x")).not.toContain("spam.example");
  });
});
