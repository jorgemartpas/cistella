// Lectura tolerante de la configuración de Supabase: al copiar los datos del panel es fácil
// arrastrar espacios, saltos de línea o la ruta de la API (…supabase.co/rest/v1/).
// Sin "server-only" porque también lo usa el proxy.

export function normalizeSupabaseUrl(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage)\/v1$/, "")
    .replace(/\/+$/, "");
}

export function normalizeKey(value: string): string {
  return value.replace(/\s+/g, "");
}

export function supabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisa las variables de entorno.");
  }
  return { url: normalizeSupabaseUrl(url), anonKey: normalizeKey(anonKey) };
}
