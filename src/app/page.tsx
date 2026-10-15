import { Landing } from "@/components/landing";

// Visitantes y clientes ven aquí la tienda (el proxy reescribe "/" a /portada);
// las tiendas y el equipo, la página informativa
export default function Home() {
  return <Landing />;
}
