import "server-only";
import { normalizeKey, normalizeSupabaseUrl } from "@/lib/supabase/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa .env.local (ver .env.example).`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return normalizeSupabaseUrl(required("NEXT_PUBLIC_SUPABASE_URL"));
  },
  get supabaseAnonKey() {
    return normalizeKey(required("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  },
  get supabaseServiceRoleKey() {
    return normalizeKey(required("SUPABASE_SERVICE_ROLE_KEY"));
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim().replace(/\/+$/, "");
  },
  get cronSecret() {
    return process.env.CRON_SECRET?.trim() || null;
  },
  stripe: {
    get secretKey() {
      return process.env.STRIPE_SECRET_KEY ?? null;
    },
    get priceId() {
      return process.env.STRIPE_PRICE_ID ?? null;
    },
    get webhookSecret() {
      return process.env.STRIPE_WEBHOOK_SECRET ?? null;
    },
  },
};
