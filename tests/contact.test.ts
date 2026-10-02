import { describe, expect, it } from "vitest";
import { confirmationEmailHtml, isHoneypotFilled, leadEmailHtml, parseContact } from "../src/lib/contact";

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
