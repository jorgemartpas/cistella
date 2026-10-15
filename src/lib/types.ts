// Tipos de las filas de Supabase que usa la app (ver supabase/migrations).
import type { ProductUnit } from "@/lib/domain/money";
import type { ProductCategory, ShopType } from "@/lib/domain/orders";
import type { DeliveryFrequency, SubscriptionStatus } from "@/lib/domain/subscription";

export type UserRole = "cliente" | "tienda" | "admin";

export type Profile = {
  id: string;
  role: UserRole;
  email: string | null;
  full_name: string;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  shop_id: string | null;
  accepted_privacy_at: string | null;
  created_at: string;
};

export type Shop = {
  id: string;
  name: string;
  type: ShopType;
  active: boolean;
  commission_pct: number;
  rotation_order: number;
  phone: string | null;
  address: string | null;
};

export type Product = {
  id: string;
  shop_id: string | null;
  category: ProductCategory;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  unit: ProductUnit;
  active: boolean;
  created_at: string;
};

export type Settings = {
  price_dos_por_semana_cents: number;
  price_semanal_cents: number;
  price_quincenal_cents: number;
  delivery_fee_cents: number;
  allowed_postal_codes: string[];
  min_order_cents: number;
  default_commission_pct: number;
  weeks_ahead: number;
};

export type Subscription = {
  id: string;
  customer_id: string;
  status: SubscriptionStatus;
  frequency: DeliveryFrequency;
  delivery_weekday: number;
  anchor_date: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type DeliveryScheduleRow = {
  weekday: number;
  active: boolean;
  cutoff_days_before: number;
  cutoff_time: string;
};

export type DeliveryDayStatus = "abierto" | "cerrado" | "cancelado";

export type DeliveryDay = {
  id: string;
  date: string;
  cutoff_at: string;
  fruteria_id: string | null;
  pescaderia_id: string | null;
  status: DeliveryDayStatus;
  orders_generated_at: string | null;
  generation_report: GenerationReport | null;
  notes: string | null;
};

export type GenerationReport = {
  orders: number;
  skippedCustomers: { customerId: string; name: string; reason: string; totalCents?: number }[];
};

export type OrderStatus = "pendiente" | "preparado" | "en_reparto" | "entregado" | "no_entregado" | "cancelado";
export type ShopOrderStatus = "pendiente" | "preparado" | "recogido";
export type PaymentStatus = "pendiente" | "procesando" | "pagado" | "fallido" | "sin_cobro";

export type Order = {
  id: string;
  customer_id: string | null;
  delivery_day_id: string;
  status: OrderStatus;
  customer_name: string;
  phone: string | null;
  address: string;
  postal_code: string | null;
  estimated_total_cents: number;
  final_total_cents: number | null;
  /** Gastos de envío (plan de pago por envío) */
  delivery_fee_cents: number;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  payment_error: string | null;
  payment_attempts: number;
  skipped_items: { productId: string; productName: string; reason: string }[];
  delivered_at: string | null;
  created_at: string;
};

export type ShopOrder = {
  id: string;
  order_id: string;
  shop_id: string;
  delivery_day_id: string;
  customer_label: string;
  status: ShopOrderStatus;
  prepared_at: string | null;
  picked_up_at: string | null;
};

export type OrderItem = {
  id: string;
  shop_order_id: string;
  product_id: string | null;
  product_name: string;
  unit: ProductUnit;
  quantity_ordered: number;
  quantity_actual: number | null;
  unit_price_cents: number;
};

/** Resultado de un Server Action de formulario */
export type ActionState = { error?: string; ok?: string } | undefined;

/** Lista de productos o cesta completa guardada por el cliente */
export type SavedList = {
  id: string;
  customer_id: string;
  kind: "lista" | "cesta";
  name: string;
  /** Envío automático con esta cesta */
  auto_delivery: boolean;
  created_at: string;
  updated_at: string;
};

export type SavedListItem = { list_id: string; product_id: string; quantity: number | null };
