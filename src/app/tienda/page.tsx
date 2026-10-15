import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import { requireRole } from "@/lib/auth";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const profile = await requireRole("cliente", "tienda", "admin");
  return <p>Hola, {profile.full_name}</p>;
}
