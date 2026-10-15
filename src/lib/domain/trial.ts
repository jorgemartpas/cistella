import { hasMonthlyFee, type DeliveryFrequency } from "./subscription";

/**
 * Prueba gratis de los planes con cuota: no se cobra la cuota durante las 2 primeras semanas
 * o hasta que se preparan los 2 primeros pedidos, lo que llegue antes. Una vez por cliente.
 */
export const FREE_TRIAL = { days: 14, orders: 2 } as const;

/** ¿Empieza con prueba gratis? Solo los planes con cuota y si nunca la ha usado. */
export function trialEligible(plan: DeliveryFrequency, trialStartedAt: string | null | undefined): boolean {
  return hasMonthlyFee(plan) && !trialStartedAt;
}

/** ¿Ya ha gastado la prueba con sus pedidos? (cuenta cada pedido preparado, aunque no estuviera en casa) */
export function trialUsedUp(ordersInTrial: number): boolean {
  return ordersInTrial >= FREE_TRIAL.orders;
}

export type TrialState = {
  /** Cuándo termina por tiempo (ISO) */
  endsAt: string;
  daysLeft: number;
  ordersLeft: number;
};

/** La prueba en curso: cuántos días y pedidos le quedan. null si no está de prueba. */
export function trialState(trialEndsAt: string | null | undefined, ordersInTrial: number, now: Date): TrialState | null {
  if (!trialEndsAt) return null;
  const msLeft = new Date(trialEndsAt).getTime() - now.getTime();
  if (msLeft <= 0 || trialUsedUp(ordersInTrial)) return null;
  return {
    endsAt: trialEndsAt,
    daysLeft: Math.ceil(msLeft / 86_400_000),
    ordersLeft: FREE_TRIAL.orders - ordersInTrial,
  };
}
