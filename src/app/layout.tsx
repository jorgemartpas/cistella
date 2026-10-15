import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "@fontsource-variable/open-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cistella · La compra del mercado de Alzira, a casa",
    template: "%s · Cistella",
  },
  description:
    "Fruta, verdura, carne y pescado de las tiendas de Alzira con reparto a domicilio. Planes desde 16 €/mes o pago por envío.",
  applicationName: "Cistella",
  appleWebApp: { capable: true, title: "Cistella", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111511" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
