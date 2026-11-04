-- ============================================================
-- ZER01 SCORE — MIGRAÇÃO
-- Execute no SQL Editor do Supabase DEPOIS do schema.sql atual.
-- Não apaga nem recria clientes, vendas, parcelas ou pagamentos.
-- ============================================================

create table if not exists public.score_configuracoes (
  id integer primary key default 1 check (id = 1),
  limite_base numeric(12,2) not null default 300 check (limite_base >= 0),
  peso_pontualidade numeric(5,2) not null default 40,
  peso_atrasos numeric(5,2) not null default 25,
  peso_recente numeric(5,2) not null default 15,
  peso_tempo_cliente numeric(5,2) not null default 10,
  peso_valor_pago numeric(5,2) not null default 10,
  minimo_parcelas_historico integer not null default 3,
  atualizado_em timestamptz not null default now()
);

insert into public.score_configuracoes (id, limite_base)
values (1, 300)
on conflict (id) do nothing;

create table if not exists public.cliente_score (
  cliente_id uuid primary key references public.clientes(id) on update cascade on delete cascade,
  pontuacao integer null check (pontuacao between 0 and 1000),
  classificacao text not null default 'sem_classificacao',
  limite_sugerido numeric(12,2) not null default 0,
  limite_aprovado numeric(12,2) null check (limite_aprovado is null or limite_aprovado >= 0),
  status_analise text not null default 'pendente',
  parcelas_quitadas integer not null default 0,
  parcelas_em_atraso integer not null default 0,
  saldo_em_aberto numeric(12,2) not null default 0,
  ultima_analise_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid null references auth.users(id) on delete set null
);

create table if not exists public.cliente_score_historico (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on update cascade on delete cascade,
  pontuacao integer null,
  classificacao text not null,
  limite_sugerido numeric(12,2) not null default 0,
  componentes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  criado_por uuid null references auth.users(id) on delete set null
);

create table if not exists public.analises_credito (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on update cascade on delete cascade,
  pontuacao integer null,
  limite_recomendado numeric(12,2) not null default 0,
  limite_aprovado numeric(12,2) not null check (limite_aprovado >= 0),
  decisao text not null check (decisao in ('aprovado','negado','revisao')),
  motivo text null,
  usuario_id uuid null references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.cartoes_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on update cascade on delete cascade,
  codigo text not null unique,
  status text not null default 'ativo' check (status in ('ativo','bloqueado','cancelado')),
  tipo text not null default 'fisico_digital' check (tipo in ('fisico','digital','fisico_digital')),
  emitido_em timestamptz not null default now(),
  bloqueado_em timestamptz null
);

create unique index if not exists cartoes_clientes_um_ativo_por_cliente
on public.cartoes_clientes(cliente_id) where status = 'ativo';

create index if not exists cliente_score_classificacao_idx on public.cliente_score(classificacao);
create index if not exists cliente_score_historico_cliente_data_idx on public.cliente_score_historico(cliente_id, criado_em desc);
create index if not exists analises_credito_cliente_data_idx on public.analises_credito(cliente_id, criado_em desc);
create index if not exists cartoes_clientes_codigo_idx on public.cartoes_clientes(codigo);

alter table public.score_configuracoes enable row level security;
alter table public.cliente_score enable row level security;
alter table public.cliente_score_historico enable row level security;
alter table public.analises_credito enable row level security;
alter table public.cartoes_clientes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['score_configuracoes','cliente_score','cliente_score_historico','analises_credito','cartoes_clientes']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=t and policyname=t || '_authenticated_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        t || '_authenticated_all', t
      );
    end if;
  end loop;
end $$;

-- Trava real no banco: nenhuma venda a prazo passa se houver parcela vencida,
-- se não houver limite aprovado ou se ultrapassar o limite disponível.
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
  if coalesce(new.forma_pagamento, '') <> 'crediario' then
    return new;
  end if;

  if new.cliente_id is null then
    raise exception 'Selecione um cliente para vender no crediário.';
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

drop trigger if exists trg_zer01_validar_venda_crediario on public.vendas;
create trigger trg_zer01_validar_venda_crediario
before insert
on public.vendas
for each row execute function public.zer01_validar_venda_crediario();

comment on table public.cliente_score is 'Pontuação e limite interno de crédito Zer01; score nulo significa histórico insuficiente.';
comment on table public.cartoes_clientes is 'Cartões físicos e digitais vinculados ao cliente por código único; não armazena dados financeiros no código.';
