import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cistella · La compra de Alzira, a casa",
    short_name: "Cistella",
    description: "Fruta, verdura, carne y pescado de las tiendas de Alzira con reparto periódico a domicilio.",
    lang: "es",
    dir: "ltr",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f5",
    theme_color: "#12843f",
    categories: ["food", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mi cesta", url: "/cesta", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Mis pedidos", url: "/pedidos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
