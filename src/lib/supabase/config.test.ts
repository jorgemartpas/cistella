import { describe, expect, it } from "vitest";
import { normalizeKey, normalizeSupabaseUrl } from "./config";

describe("configuración de Supabase copiada del panel", () => {
  it("quita la ruta de la API, las barras finales y los saltos de línea de la URL", () => {
    const clean = "https://abcd.supabase.co";
    expect(normalizeSupabaseUrl(clean)).toBe(clean);
    expect(normalizeSupabaseUrl("https://abcd.supabase.co/")).toBe(clean);
    expect(normalizeSupabaseUrl("https://abcd.supabase.co/rest/v1/\n")).toBe(clean);
    expect(normalizeSupabaseUrl("  https://abcd.supabase.co/rest/v1  ")).toBe(clean);
    expect(normalizeSupabaseUrl("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
  });

  it("quita espacios y saltos de línea de las claves", () => {
    expect(normalizeKey(" eyJhbGci.abc.def\n")).toBe("eyJhbGci.abc.def");
  });
});
