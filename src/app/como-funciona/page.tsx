import type { Metadata } from "next";
import { Landing } from "@/components/landing";

export const metadata: Metadata = {
  title: "Cómo funciona y precios",
  description: "Cómo funciona Cistella, los planes y sus precios, y preguntas frecuentes.",
};

export default function HowItWorksPage() {
  return <Landing />;
}
