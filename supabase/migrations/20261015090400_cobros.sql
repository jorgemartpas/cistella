-- Fase 5 · Cobro de cada pedido con el peso real al entregarlo.
-- 'procesando' bloquea el pedido mientras se cobra, para que dos clics no cobren dos veces.
alter type public.payment_status add value if not exists 'procesando' after 'pendiente';

alter table public.orders add column payment_attempts integer not null default 0;
