import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { moveGuestBasketToAccount } from "@/lib/guest-basket";
import { createClient } from "@/lib/supabase/server";

// Destino de los enlaces de los emails de Supabase (confirmar cuenta, cambiar contraseña)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get("next") ?? "/inicio";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/inicio";

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("Enlace incompleto") };

  if (error) {
    return NextResponse.redirect(new URL("/entrar?error=enlace", origin));
  }
  const { data } = await supabase.auth.getUser();
  if (data.user) await moveGuestBasketToAccount(supabase, data.user.id);
  return NextResponse.redirect(new URL(next, origin));
}
