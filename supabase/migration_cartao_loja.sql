-- ============================================================
-- ZER01 — CARTÃO DA LOJA
-- Execute no SQL Editor do Supabase DEPOIS de migration_zer01_score.sql.
-- Não apaga nem recria clientes, vendas, parcelas ou pagamentos.
--
-- O que muda:
--   * vendas.forma_pagamento passa a aceitar 'cartao_loja'
--     (funciona como o crediário: parcelas, limite e bloqueio por atraso).
--   * A trava do banco passa a valer para 'crediario' e 'cartao_loja'.
--   * Venda no 'cartao_loja' exige que o cliente tenha um cartão ATIVO.
-- ============================================================

create or replace function public.zer01_validar_venda_crediario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite numeric(12,2);
  v_em_aberto numeric(12,2);
  v_tem_atraso boolean;
begin
  if coalesce(new.forma_pagamento, '') not in ('crediario', 'cartao_loja') then
    return new;
  end if;

  if new.cliente_id is null then
    raise exception 'Selecione um cliente para vender no crediário.';
  end if;

  -- Cartão da loja: o cliente precisa ter cartão ativo.
  if new.forma_pagamento = 'cartao_loja' and not exists (
    select 1
    from public.cartoes_clientes cc
    where cc.cliente_id = new.cliente_id
      and cc.status = 'ativo'
  ) then
    raise exception 'Este cliente não possui cartão da loja ativo.';
  end if;

  select exists (
    select 1
    from public.parcelas p
    join public.vendas v on v.id = p.venda_id
    where v.cliente_id = new.cliente_id
      and v.status <> 'cancelada'
      and p.vencimento < current_date
      and p.status <> 'paga'
      and greatest(coalesce(p.valor,0) - coalesce(p.valor_pago,0),0) > 0
  ) into v_tem_atraso;

  if v_tem_atraso then
    raise exception 'Crediário bloqueado: o cliente possui parcela vencida em aberto.';
  end if;

  select limite_aprovado
    into v_limite
  from public.cliente_score
  where cliente_id = new.cliente_id;

  if v_limite is null then
    raise exception 'Cliente sem limite aprovado. Realize uma análise de crédito no Zer01 Score.';
  end if;

  select coalesce(sum(case when p.status = 'paga' then 0 else greatest(coalesce(p.valor,0) - coalesce(p.valor_pago,0),0) end),0)
    into v_em_aberto
  from public.parcelas p
  join public.vendas v on v.id = p.venda_id
  where v.cliente_id = new.cliente_id
    and v.status <> 'cancelada';

  if v_em_aberto + coalesce(new.valor_total,0) > v_limite then
    raise exception 'Venda acima do limite disponível. Limite aprovado: R$ %, em aberto: R$ %.',
      to_char(v_limite, 'FM999G999G990D00'),
      to_char(v_em_aberto, 'FM999G999G990D00');
  end if;

  return new;
end;
$$;

-- O gatilho já existe (migration_zer01_score.sql); recriamos por segurança.
drop trigger if exists trg_zer01_validar_venda_crediario on public.vendas;
create trigger trg_zer01_validar_venda_crediario
before insert
on public.vendas
for each row execute function public.zer01_validar_venda_crediario();

-- Valores usados em vendas.forma_pagamento:
-- crediario, cartao_loja, dinheiro, pix, cartao_debito, cartao_credito, transferencia
