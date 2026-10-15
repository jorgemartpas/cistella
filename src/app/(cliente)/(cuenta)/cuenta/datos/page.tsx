import { redirect } from "next/navigation";

// Datos personales es ahora la portada de «Mi cuenta»
export default function OldPersonalDataPage() {
  redirect("/cuenta");
}
