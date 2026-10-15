import { TRIAL_COPY } from "@/lib/plans";
import { ButtonLink } from "../ui";

/** Gancho de la prueba gratis en la portada: para visitantes y clientes que aún no tienen plan. */
export function TrialBanner({ isGuest }: { isGuest: boolean }) {
  return (
    <section
      aria-labelledby="prueba-gratis"
      className="card-surface mb-8 flex flex-col gap-4 border-2 border-primary/25 p-5 sm:flex-row sm:items-center sm:p-6"
    >
      <span
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-3xl"
        aria-hidden
      >
        🎁
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="prueba-gratis" className="text-xl font-extrabold tracking-tight">
          {TRIAL_COPY.title}
        </h2>
        <p className="mt-1 text-[15px]">{TRIAL_COPY.rule}</p>
        <p className="mt-0.5 text-sm text-muted">
          {isGuest
            ? "Llena tu cesta sin compromiso: la cuenta y el plan se piden al confirmar tu primer pedido. "
            : ""}
          {TRIAL_COPY.after}
        </p>
      </div>
      <ButtonLink href={isGuest ? "/categorias" : "/bienvenida"} className="shrink-0 sm:px-6">
        {isGuest ? "Empezar a comprar" : "Empezar la prueba"}
      </ButtonLink>
    </section>
  );
}
