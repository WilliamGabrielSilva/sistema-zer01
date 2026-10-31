-- Migração Zer01: suporte a vendas à vista sem cliente.
-- Execute no SQL Editor do Supabase antes de usar a versão atualizada.

alter table public.vendas
  alter column cliente_id drop not null;

alter table public.vendas
  add column if not exists forma_pagamento text not null default 'crediario';

-- Mantém o histórico de vendas caso um cliente seja removido.
alter table public.vendas
  drop constraint if exists vendas_cliente_id_fkey;

alter table public.vendas
  add constraint vendas_cliente_id_fkey
  foreign key (cliente_id)
  references public.clientes(id)
  on update cascade
  on delete set null;

-- Valores usados em vendas.forma_pagamento:
-- crediario, dinheiro, pix, cartao_debito, cartao_credito, transferencia
