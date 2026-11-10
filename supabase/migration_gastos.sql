-- ============================================================
-- ZER01 — GASTOS E INVESTIMENTOS (fase 1)
-- Execute no SQL Editor do Supabase. Não altera nenhuma tabela existente.
--
--   * despesas       : despesas da loja (aluguel, luz, embalagem...)
--   * compras_lotes  : compras de peças para vender (investimento)
--   * compras_itens  : itens de cada compra, com quantidade, custo e venda
--
-- Estas tabelas guardam custos e lucro, então ficam restritas ao
-- ADMINISTRADOR também no banco (não só no menu do sistema).
-- Para incluir outro administrador, edite a lista de e-mails na
-- função zer01_is_admin() abaixo e rode este arquivo de novo.
-- ============================================================

create or replace function public.zer01_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'barbadosearrumados02@gmail.com'
  );
$$;

grant execute on function public.zer01_is_admin() to authenticated;

-- ------------------------------------------------------------
-- Despesas da loja
-- ------------------------------------------------------------
create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null check (btrim(descricao) <> ''),
  categoria text not null default 'outros',
  valor numeric(12,2) not null check (valor > 0),
  data date not null default current_date,
  status text not null default 'pago' check (status in ('pago', 'a_pagar')),
  vencimento date null,
  data_pagamento date null,
  forma_pagamento text null,
  recorrente boolean not null default false,
  observacoes text null,
  criado_em timestamptz not null default now(),
  criado_por uuid null default auth.uid() references auth.users(id) on delete set null
);

create index if not exists despesas_data_idx on public.despesas (data);
create index if not exists despesas_data_pagamento_idx on public.despesas (data_pagamento);
create index if not exists despesas_status_idx on public.despesas (status);

-- ------------------------------------------------------------
-- Compras de peças (lotes) e seus itens
-- ------------------------------------------------------------
create table if not exists public.compras_lotes (
  id uuid primary key default gen_random_uuid(),
  fornecedor text null,
  data_compra date not null default current_date,
  forma_pagamento text null,
  observacoes text null,
  criado_em timestamptz not null default now(),
  criado_por uuid null default auth.uid() references auth.users(id) on delete set null
);

create table if not exists public.compras_itens (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.compras_lotes(id) on update cascade on delete cascade,
  descricao text not null check (btrim(descricao) <> ''),
  quantidade integer not null check (quantidade > 0),
  custo_unitario numeric(12,2) not null check (custo_unitario >= 0),
  venda_unitario numeric(12,2) not null check (venda_unitario >= 0),
  criado_em timestamptz not null default now()
);

create index if not exists compras_lotes_data_idx on public.compras_lotes (data_compra);
create index if not exists compras_itens_lote_idx on public.compras_itens (lote_id);

-- ------------------------------------------------------------
-- RLS: somente administrador
-- ------------------------------------------------------------
alter table public.despesas enable row level security;
alter table public.compras_lotes enable row level security;
alter table public.compras_itens enable row level security;

do $$
declare t text;
begin
  foreach t in array array['despesas', 'compras_lotes', 'compras_itens']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_admin_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.zer01_is_admin()) with check (public.zer01_is_admin())',
        t || '_admin_all', t
      );
    end if;
  end loop;
end
$$;

-- ------------------------------------------------------------
-- Salvar compra + itens de uma vez (cria ou edita, tudo ou nada)
-- Roda com as permissões de quem chama, então a RLS acima vale.
-- ------------------------------------------------------------
create or replace function public.zer01_salvar_lote(
  p_id uuid,
  p_fornecedor text,
  p_data date,
  p_forma text,
  p_obs text,
  p_itens jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe pelo menos um item na compra.';
  end if;

  if p_id is null then
    insert into public.compras_lotes (fornecedor, data_compra, forma_pagamento, observacoes)
    values (nullif(btrim(p_fornecedor), ''), coalesce(p_data, current_date), nullif(btrim(p_forma), ''), nullif(btrim(p_obs), ''))
    returning id into v_id;
  else
    update public.compras_lotes
       set fornecedor = nullif(btrim(p_fornecedor), ''),
           data_compra = coalesce(p_data, current_date),
           forma_pagamento = nullif(btrim(p_forma), ''),
           observacoes = nullif(btrim(p_obs), '')
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Compra não encontrada.';
    end if;

    delete from public.compras_itens where lote_id = v_id;
  end if;

  insert into public.compras_itens (lote_id, descricao, quantidade, custo_unitario, venda_unitario)
  select v_id, btrim(i.descricao), i.quantidade, i.custo_unitario, i.venda_unitario
  from jsonb_to_recordset(p_itens) as i(
    descricao text,
    quantidade integer,
    custo_unitario numeric,
    venda_unitario numeric
  );

  return v_id;
end;
$$;

grant execute on function public.zer01_salvar_lote(uuid, text, date, text, text, jsonb) to authenticated;

comment on table public.despesas is 'Despesas da loja (aluguel, energia, embalagens...). Somente administrador.';
comment on table public.compras_lotes is 'Compras de peças para revenda (investimento). Somente administrador.';
comment on table public.compras_itens is 'Itens de cada compra: quantidade, custo e preço de venda unitários.';
