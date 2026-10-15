import type { Tone } from "@/components/ui";
import type { DeliveryDayStatus, OrderStatus, PaymentStatus, ShopOrderStatus } from "@/lib/types";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "En preparación", tone: "info" },
  preparado: { label: "Preparado", tone: "success" },
  en_reparto: { label: "En reparto", tone: "accent" },
  entregado: { label: "Entregado", tone: "success" },
  no_entregado: { label: "No entregado", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

export const SHOP_ORDER_STATUS: Record<ShopOrderStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "Por preparar", tone: "warning" },
  preparado: { label: "Preparado", tone: "success" },
  recogido: { label: "Recogido", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "Cobro pendiente", tone: "neutral" },
  procesando: { label: "Cobrando…", tone: "info" },
  pagado: { label: "Pagado", tone: "success" },
  fallido: { label: "Cobro fallido", tone: "danger" },
  sin_cobro: { label: "Sin cobro", tone: "neutral" },
};

export const DAY_STATUS: Record<DeliveryDayStatus, { label: string; tone: Tone }> = {
  abierto: { label: "Abierto", tone: "info" },
  cerrado: { label: "Pedidos generados", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

export const SKIP_REASONS: Record<string, string> = {
  no_disponible: "la tienda de turno no lo tenía",
  sin_tienda: "no había tienda para servirlo",
  producto_retirado: "ya no está a la venta",
  sin_confirmar: "no confirmó el pedido",
  saltado: "saltó este reparto (envío automático)",
  cesta_vacia: "cesta vacía",
  sin_productos: "ningún producto disponible",
  pedido_minimo: "no llegaba al pedido mínimo",
  sin_direccion: "sin dirección de entrega",
};
