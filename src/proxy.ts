import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicConfig } from "@/lib/supabase/config";

// Rutas que exigen sesión. El rol concreto se comprueba en cada página (src/lib/auth.ts).
const PROTECTED = [
  "/inicio",
  "/portada",
  "/bienvenida",
  "/cesta",
  "/categorias",
  "/buscar",
  "/listas",
  "/pedidos",
  "/cuenta",
  "/ayuda",
  "/tienda",
  "/admin",
];

/** Refresca la sesión de Supabase en cada navegación y manda a /entrar si falta. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = supabasePublicConfig();
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!isLoggedIn && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    url.searchParams.set("volver", path);
    return NextResponse.redirect(url);
  }

  // La portada de un cliente con sesión es su tienda (la URL sigue siendo "/")
  if (isLoggedIn && path === "/") {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data!.claims.sub).maybeSingle();
    if (profile?.role === "cliente") {
      const rewrite = NextResponse.rewrite(new URL("/portada", request.url), { request });
      for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie);
      return rewrite;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
