import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";

/** Cliente con la sesión del usuario: todas las consultas pasan por RLS. */
export async function createClient() {
  // Los datos de sesión son siempre de la petición (supabase-js consulta la hora al leer
  // la sesión, algo que no se puede prerenderizar).
  await connection();
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy ya refresca la sesión.
        }
      },
    },
  });
}

/**
 * Cliente de sistema (service role): se salta RLS. Solo para el cron, los webhooks de Stripe
 * y operaciones que lo exigen (crear cuentas de tienda). Comprueba siempre el rol antes.
 */
export function createServiceClient() {
  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
