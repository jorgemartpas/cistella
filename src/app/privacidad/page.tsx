import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Política de privacidad" };

// Texto base para el piloto. Lo marcado entre corchetes lo tiene que completar Cistella
// (y conviene que lo revise un asesor antes del lanzamiento).
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center">
        <Logo />
      </header>
      <article className="space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-2xl font-bold">Política de privacidad</h1>
        <p className="text-sm text-muted">Última actualización: octubre de 2026</p>

        <h2>Quién trata tus datos</h2>
        <p>
          [Nombre o razón social de Cistella], con NIF [NIF] y domicilio en [dirección], Alzira (Valencia). Contacto:
          [email de contacto].
        </p>

        <h2>Qué datos guardamos</h2>
        <p>Solo los necesarios para el servicio:</p>
        <ul>
          <li>Nombre y apellidos, email y teléfono.</li>
          <li>Dirección de entrega y código postal.</li>
          <li>Tu cesta, tus pedidos y el estado de tu suscripción.</li>
        </ul>
        <p>
          Los datos de tu tarjeta no pasan por Cistella: los gestiona directamente Stripe, nuestro proveedor de pagos.
        </p>

        <h2>Para qué los usamos</h2>
        <ul>
          <li>Gestionar tu suscripción y cobrar la cuota y los pedidos.</li>
          <li>Preparar y entregar tus pedidos en tu domicilio.</li>
          <li>Avisarte de cambios en tu pedido o en el servicio.</li>
        </ul>
        <p>La base legal es la ejecución del contrato de suscripción que aceptas al darte de alta.</p>

        <h2>Con quién los compartimos</h2>
        <ul>
          <li>
            <strong>Tiendas del piloto:</strong> solo ven tu nombre y lo que han de preparar. No ven tu dirección ni tu
            teléfono.
          </li>
          <li>
            <strong>Proveedores:</strong> Stripe (pagos), Supabase (base de datos y acceso) y Vercel (alojamiento de la
            web), con contratos de encargo de tratamiento.
          </li>
        </ul>

        <h2>Cuánto tiempo</h2>
        <p>
          Mientras tengas la cuenta activa. Tras la baja, guardamos los pedidos y cobros el tiempo que exige la
          normativa fiscal y mercantil, y borramos el resto.
        </p>

        <h2>Tus derechos</h2>
        <p>
          Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad de tus datos escribiendo a
          [email de contacto]. Si crees que no los tratamos bien, puedes reclamar ante la Agencia Española de Protección
          de Datos (aepd.es).
        </p>

        <h2>Cookies</h2>
        <p>Solo usamos cookies técnicas para mantener tu sesión iniciada. No usamos cookies de publicidad ni analítica.</p>
      </article>
    </div>
  );
}
