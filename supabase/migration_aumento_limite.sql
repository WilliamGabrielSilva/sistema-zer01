-- ============================================================
-- ZER01 — AUMENTO DE LIMITE NO ATO DA VENDA
-- Execute no SQL Editor do Supabase DEPOIS de migration_cartao_loja.sql.
-- Não apaga nem recria clientes, vendas, parcelas ou pagamentos.
--
-- Duas modalidades:
--   * PERMANENTE : soma o valor ao limite aprovado do cliente
--                  (cliente_score.limite_aprovado) e registra a decisão
--                  em analises_credito, como uma aprovação manual.
--   * TEMPORÁRIO : vale por cima do limite aprovado enquanto o cliente
--                  não pagar o valor do aumento. Cada real pago em
--                  qualquer parcela do cliente abate 1 real do aumento;
--                  quando zera (ou quando a dívida volta a caber no
--                  limite original) o limite volta ao original.
--
-- Limite efetivo = limite_aprovado + aumentos temporários ativos.
-- ============================================================

create table if not exists public.aumentos_limite (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on update cascade on delete cascade,
  venda_id uuid null references public.vendas(id) on update cascade on delete set null,
  tipo text not null check (tipo in ('permanente','temporario')),
  valor numeric(12,2) not null check (valor > 0),
  -- Temporário: quanto do aumento ainda está valendo. Permanente: sempre 0.
  valor_restante numeric(12,2) not null default 0 check (valor_restante >= 0),
  limite_base_anterior numeric(12,2) not null,
  limite_base_novo numeric(12,2) not null,
  limite_efetivo_novo numeric(12,2) not null,
  status text not null default 'ativo' check (status in ('ativo','encerrado','desfeito')),
  motivo text null,
  usuario_id uuid null references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  encerrado_em timestamptz null
);

create index if not exists aumentos_limite_cliente_status_idx
  on public.aumentos_limite (cliente_id, status, tipo);
create index if not exists aumentos_limite_venda_idx
  on public.aumentos_limite (venda_id);

alter table public.aumentos_limite enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'aumentos_limite'
      and policyname = 'aumentos_limite_authenticated_all'
  ) then
    create policy aumentos_limite_authenticated_all
      on public.aumentos_limite
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

comment on table public.aumentos_limite is 'Aumentos de limite concedidos no ato da venda (permanentes e temporários), com histórico.';

-- ------------------------------------------------------------
-- Funções auxiliares
-- ------------------------------------------------------------

create or replace function public.zer01_saldo_em_aberto(p_cliente_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case when p.status = 'paga' then 0
         else greatest(coalesce(p.valor,0) - coalesce(p.valor_pago,0),0) end
  ),0)
  from public.parcelas p
  join public.vendas v on v.id = p.venda_id
  where v.cliente_id = p_cliente_id
    and v.status <> 'cancelada';
$$;

create or replace function public.zer01_limite_temporario(p_cliente_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(valor_restante),0)
  from public.aumentos_limite
  where cliente_id = p_cliente_id
    and tipo = 'temporario'
    and status = 'ativo';
$$;

-- ------------------------------------------------------------
-- Conceder aumento (permanente ou temporário) — atômico
-- ------------------------------------------------------------

create or replace function public.zer01_conceder_aumento_limite(
  p_cliente_id uuid,
  p_tipo text,
  p_valor numeric,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score public.cliente_score%rowtype;
  v_valor numeric(12,2);
  v_base numeric(12,2);
  v_base_novo numeric(12,2);
  v_temp numeric(12,2);
  v_id uuid;
begin
  if p_cliente_id is null then
    raise exception 'Cliente não informado.';
  end if;
  if coalesce(p_tipo, '') not in ('permanente', 'temporario') then
    raise exception 'Tipo de aumento inválido.';
  end if;

  v_valor := round(coalesce(p_valor, 0), 2);
  if v_valor <= 0 then
    raise exception 'Informe um valor de aumento maior que zero.';
  end if;

  select * into v_score
  from public.cliente_score
  where cliente_id = p_cliente_id
  for update;

  if not found or v_score.limite_aprovado is null then
    raise exception 'Cliente sem limite aprovado. Realize uma análise de crédito no Zer01 Score.';
  end if;

  if v_score.status_analise = 'negado' then
    raise exception 'Crédito negado para este cliente. Revise a decisão no Zer01 Score antes de aumentar o limite.';
  end if;

  if exists (
    select 1
    from public.parcelas p
    join public.vendas v on v.id = p.venda_id
    where v.cliente_id = p_cliente_id
      and v.status <> 'cancelada'
      and p.vencimento < current_date
      and p.status <> 'paga'
      and greatest(coalesce(p.valor,0) - coalesce(p.valor_pago,0),0) > 0
  ) then
    raise exception 'Aumento negado: o cliente possui parcela vencida em aberto.';
  end if;

  v_base := v_score.limite_aprovado;
  v_temp := public.zer01_limite_temporario(p_cliente_id);

  if p_tipo = 'permanente' then
    v_base_novo := v_base + v_valor;

    update public.cliente_score
       set limite_aprovado = v_base_novo,
           status_analise = 'aprovado',
           atualizado_em = now(),
           atualizado_por = auth.uid()
     where cliente_id = p_cliente_id;

    insert into public.analises_credito
      (cliente_id, pontuacao, limite_recomendado, limite_aprovado, decisao, motivo, usuario_id)
    values
      (p_cliente_id, v_score.pontuacao, coalesce(v_score.limite_sugerido, 0), v_base_novo, 'aprovado',
       'Aumento permanente no ato da venda (+R$ ' || to_char(v_valor, 'FM999G999G990D00') || ')'
         || coalesce(': ' || nullif(btrim(p_motivo), ''), ''),
       auth.uid());

    insert into public.aumentos_limite
      (cliente_id, tipo, valor, valor_restante, limite_base_anterior, limite_base_novo,
       limite_efetivo_novo, motivo, usuario_id)
    values
      (p_cliente_id, 'permanente', v_valor, 0, v_base, v_base_novo,
       v_base_novo + v_temp, nullif(btrim(p_motivo), ''), auth.uid())
    returning id into v_id;

    v_base := v_base_novo;
  else
    insert into public.aumentos_limite
      (cliente_id, tipo, valor, valor_restante, limite_base_anterior, limite_base_novo,
       limite_efetivo_novo, motivo, usuario_id)
    values
      (p_cliente_id, 'temporario', v_valor, v_valor, v_base, v_base,
       v_base + v_temp + v_valor, nullif(btrim(p_motivo), ''), auth.uid())
    returning id into v_id;

    v_temp := v_temp + v_valor;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'tipo', p_tipo,
    'valor', v_valor,
    'limite_base', v_base,
    'limite_temporario', v_temp,
    'limite_efetivo', v_base + v_temp
  );
end;
$$;

-- ------------------------------------------------------------
-- Desfazer um aumento que não chegou a ser usado numa venda
-- (ex.: a venda falhou depois do aumento ter sido aplicado)
-- ------------------------------------------------------------

create or replace function public.zer01_desfazer_aumento_limite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec public.aumentos_limite%rowtype;
  v_score public.cliente_score%rowtype;
begin
  select * into v_rec
  from public.aumentos_limite
  where id = p_id
  for update;

  if not found then
    raise exception 'Aumento de limite não encontrado.';
  end if;
  if v_rec.status <> 'ativo' or v_rec.venda_id is not null then
    raise exception 'Este aumento já foi usado em uma venda e não pode ser desfeito.';
  end if;

  if v_rec.tipo = 'permanente' then
    select * into v_score
    from public.cliente_score
    where cliente_id = v_rec.cliente_id
    for update;

    -- Só restaura se ninguém mexeu no limite nesse meio tempo.
    if found and v_score.limite_aprovado = v_rec.limite_base_novo then
      update public.cliente_score
         set limite_aprovado = v_rec.limite_base_anterior,
             atualizado_em = now(),
             atualizado_por = auth.uid()
       where cliente_id = v_rec.cliente_id;

      insert into public.analises_credito
        (cliente_id, pontuacao, limite_recomendado, limite_aprovado, decisao, motivo, usuario_id)
      values
        (v_rec.cliente_id, v_score.pontuacao, coalesce(v_score.limite_sugerido, 0),
         v_rec.limite_base_anterior, 'aprovado',
         'Aumento permanente desfeito (venda não concluída)', auth.uid());
    end if;
  end if;

  update public.aumentos_limite
     set status = 'desfeito', valor_restante = 0, encerrado_em = now()
   where id = p_id;
end;
$$;

grant execute on function public.zer01_conceder_aumento_limite(uuid, text, numeric, text) to authenticated;
grant execute on function public.zer01_desfazer_aumento_limite(uuid) to authenticated;
grant execute on function public.zer01_saldo_em_aberto(uuid) to authenticated;
grant execute on function public.zer01_limite_temporario(uuid) to authenticated;

-- ------------------------------------------------------------
-- Trava da venda a prazo: agora usa o LIMITE EFETIVO
-- (limite aprovado + aumentos temporários ativos).
-- ------------------------------------------------------------

create or replace function public.zer01_validar_venda_crediario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base numeric(12,2);
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
    into v_base
  from public.cliente_score
  where cliente_id = new.cliente_id;

  if v_base is null then
    raise exception 'Cliente sem limite aprovado. Realize uma análise de crédito no Zer01 Score.';
  end if;

  v_limite := v_base + public.zer01_limite_temporario(new.cliente_id);
  v_em_aberto := public.zer01_saldo_em_aberto(new.cliente_id);

  if v_em_aberto + coalesce(new.valor_total,0) > v_limite then
    raise exception 'Venda acima do limite disponível. Limite: R$ %, em aberto: R$ %.',
      to_char(v_limite, 'FM999G999G990D00'),
      to_char(v_em_aberto, 'FM999G999G990D00');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_zer01_validar_venda_crediario on public.vendas;
create trigger trg_zer01_validar_venda_crediario
before insert
on public.vendas
for each row execute function public.zer01_validar_venda_crediario();

-- ------------------------------------------------------------
-- Pagamento de parcela abate o aumento temporário
-- (vale para qualquer tela que registre pagamento: atualiza parcelas.valor_pago)
-- ------------------------------------------------------------

create or replace function public.zer01_abater_aumento_temporario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid;
  v_pago_novo numeric(12,2);
  v_pago_antigo numeric(12,2);
  v_delta numeric(12,2);
  v_abater numeric(12,2);
  v_base numeric(12,2);
  r record;
begin
  v_pago_novo := case when new.status = 'paga' and new.valor_pago is null
                      then coalesce(new.valor,0) else coalesce(new.valor_pago,0) end;
  v_pago_antigo := case when old.status = 'paga' and old.valor_pago is null
                        then coalesce(old.valor,0) else coalesce(old.valor_pago,0) end;
  v_delta := v_pago_novo - v_pago_antigo;

  -- Estorno (valor pago diminuiu) não devolve o aumento.
  if v_delta <= 0 then
    return new;
  end if;

  select v.cliente_id into v_cliente
  from public.vendas v
  where v.id = new.venda_id;

  if v_cliente is null then
    return new;
  end if;

  for r in
    select id, valor_restante
    from public.aumentos_limite
    where cliente_id = v_cliente
      and tipo = 'temporario'
      and status = 'ativo'
    order by criado_em
    for update
  loop
    exit when v_delta <= 0;
    v_abater := least(r.valor_restante, v_delta);
    v_delta := v_delta - v_abater;

    update public.aumentos_limite
       set valor_restante = valor_restante - v_abater,
           status = case when valor_restante - v_abater <= 0.004 then 'encerrado' else status end,
           encerrado_em = case when valor_restante - v_abater <= 0.004 then now() else encerrado_em end
     where id = r.id;
  end loop;

  -- Se a dívida já cabe no limite original, o que sobrou do aumento não tem mais uso.
  select limite_aprovado into v_base
  from public.cliente_score
  where cliente_id = v_cliente;

  if v_base is not null and public.zer01_saldo_em_aberto(v_cliente) <= v_base + 0.005 then
    update public.aumentos_limite
       set valor_restante = 0, status = 'encerrado', encerrado_em = now()
     where cliente_id = v_cliente
       and tipo = 'temporario'
       and status = 'ativo';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_zer01_abater_aumento_temporario on public.parcelas;
create trigger trg_zer01_abater_aumento_temporario
after update of valor_pago, status
on public.parcelas
for each row execute function public.zer01_abater_aumento_temporario();

-- ------------------------------------------------------------
-- Venda cancelada ou excluída encerra o aumento temporário dela
-- ------------------------------------------------------------

create or replace function public.zer01_encerrar_aumento_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encerrar boolean := false;
begin
  if tg_op = 'DELETE' then
    v_encerrar := true;
  elsif new.status = 'cancelada' and old.status is distinct from 'cancelada' then
    v_encerrar := true;
  end if;

  if v_encerrar then
    update public.aumentos_limite
       set valor_restante = 0, status = 'encerrado', encerrado_em = now()
     where venda_id = old.id
       and tipo = 'temporario'
       and status = 'ativo';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_zer01_encerrar_aumento_venda on public.vendas;
create trigger trg_zer01_encerrar_aumento_venda
before delete or update of status
on public.vendas
for each row execute function public.zer01_encerrar_aumento_venda();
