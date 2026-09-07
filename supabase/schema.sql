-- ============================================================
-- SISTEMA ZER01
-- Schema completo para Supabase / PostgreSQL
-- Execute este arquivo no SQL Editor do Supabase.
-- ============================================================

-- Extensão para geração de UUIDs.
create extension if not exists pgcrypto;

-- ============================================================
-- TABELA: clientes
-- CPF/CNPJ, telefone, endereço e observações são opcionais.
-- ============================================================
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf_cnpj text null,
  telefone text null,
  endereco text null,
  observacoes text null,
  criado_em timestamptz not null default now()
);

-- ============================================================
-- TABELA: vendas
-- Não há produto, estoque, valor de entrada ou valor restante.
-- ============================================================
create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  descricao text null,
  valor_total numeric(12, 2) not null default 0,
  quantidade_parcelas integer not null default 1,
  data_venda date not null default current_date,
  status text not null default 'aberta',
  vendedor uuid null,
  observacoes text null,
  criado_em timestamptz not null default now(),

  constraint vendas_cliente_id_fkey
    foreign key (cliente_id)
    references public.clientes(id)
    on update cascade
    on delete cascade,

  constraint vendas_vendedor_fkey
    foreign key (vendedor)
    references auth.users(id)
    on update cascade
    on delete set null,

  constraint vendas_valor_total_check
    check (valor_total >= 0),

  constraint vendas_quantidade_parcelas_check
    check (quantidade_parcelas >= 1),

  constraint vendas_status_check
    check (status in ('aberta', 'cancelada', 'finalizada'))
);

-- ============================================================
-- TABELA: parcelas
-- Uma venda pode possuir várias parcelas.
-- ============================================================
create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null,
  numero integer not null,
  valor numeric(12, 2) not null default 0,
  vencimento date not null,
  status text not null default 'pendente',
  data_pagamento date null,
  valor_pago numeric(12, 2) null,
  pix_txid text null,
  pix_copia_cola text null,
  pix_qrcode text null,
  criado_em timestamptz not null default now(),

  constraint parcelas_venda_id_fkey
    foreign key (venda_id)
    references public.vendas(id)
    on update cascade
    on delete cascade,

  constraint parcelas_numero_check
    check (numero >= 1),

  constraint parcelas_valor_check
    check (valor >= 0),

  constraint parcelas_valor_pago_check
    check (valor_pago is null or valor_pago >= 0),

  constraint parcelas_status_check
    check (status in ('pendente', 'atrasada', 'paga')),

  constraint parcelas_venda_numero_unique
    unique (venda_id, numero)
);

-- ============================================================
-- TABELA: pagamentos
-- Histórico de pagamentos. Registros não devem ser apagados.
-- ============================================================
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null,
  valor numeric(12, 2) not null default 0,
  data_pagamento date not null default current_date,
  forma_pagamento text not null default 'outros',
  id_transacao text null,
  txid text null,
  status text not null default 'confirmado',
  criado_em timestamptz not null default now(),

  constraint pagamentos_parcela_id_fkey
    foreign key (parcela_id)
    references public.parcelas(id)
    on update cascade
    on delete cascade,

  constraint pagamentos_valor_check
    check (valor > 0),

  constraint pagamentos_forma_check
    check (forma_pagamento in ('pix', 'dinheiro', 'cartao', 'outros'))
);

-- ============================================================
-- MIGRAÇÃO DE INSTALAÇÕES EXISTENTES
-- Garante CASCADE mesmo se as tabelas já tiverem sido criadas
-- com a versão anterior do schema.
-- ============================================================
alter table public.pagamentos drop constraint if exists pagamentos_parcela_id_fkey;
alter table public.pagamentos add constraint pagamentos_parcela_id_fkey foreign key (parcela_id) references public.parcelas(id) on update cascade on delete cascade;
alter table public.parcelas drop constraint if exists parcelas_venda_id_fkey;
alter table public.parcelas add constraint parcelas_venda_id_fkey foreign key (venda_id) references public.vendas(id) on update cascade on delete cascade;
alter table public.vendas drop constraint if exists vendas_cliente_id_fkey;
alter table public.vendas add constraint vendas_cliente_id_fkey foreign key (cliente_id) references public.clientes(id) on update cascade on delete cascade;

-- ============================================================
-- ÍNDICES PARA BUSCA E RELATÓRIOS
-- ============================================================
create index if not exists clientes_nome_idx
  on public.clientes using gin (to_tsvector('simple', nome));

create index if not exists clientes_cpf_cnpj_idx
  on public.clientes (cpf_cnpj);

create index if not exists clientes_telefone_idx
  on public.clientes (telefone);

create index if not exists vendas_cliente_id_idx
  on public.vendas (cliente_id);

create index if not exists vendas_data_venda_idx
  on public.vendas (data_venda);

create index if not exists vendas_status_idx
  on public.vendas (status);

create index if not exists parcelas_venda_id_idx
  on public.parcelas (venda_id);

create index if not exists parcelas_vencimento_idx
  on public.parcelas (vencimento);

create index if not exists parcelas_status_idx
  on public.parcelas (status);

create index if not exists pagamentos_parcela_id_idx
  on public.pagamentos (parcela_id);

create index if not exists pagamentos_data_pagamento_idx
  on public.pagamentos (data_pagamento);

create index if not exists pagamentos_txid_idx
  on public.pagamentos (txid);

-- ============================================================
-- RLS: habilitar segurança por linha
-- ============================================================
alter table public.clientes enable row level security;
alter table public.vendas enable row level security;
alter table public.parcelas enable row level security;
alter table public.pagamentos enable row level security;

-- ============================================================
-- POLÍTICAS RLS
-- Inicialmente, qualquer usuário autenticado pode acessar os dados.
-- O controle ADMIN/VENDEDOR poderá ser refinado futuramente.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clientes'
      and policyname = 'clientes_authenticated_all'
  ) then
    create policy clientes_authenticated_all
      on public.clientes
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vendas'
      and policyname = 'vendas_authenticated_all'
  ) then
    create policy vendas_authenticated_all
      on public.vendas
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'parcelas'
      and policyname = 'parcelas_authenticated_all'
  ) then
    create policy parcelas_authenticated_all
      on public.parcelas
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pagamentos'
      and policyname = 'pagamentos_authenticated_all'
  ) then
    create policy pagamentos_authenticated_all
      on public.pagamentos
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

-- ============================================================
-- VIEW OPCIONAL: parcelas com status calculado automaticamente
-- Use esta view para relatórios e contas a receber.
-- Uma parcela paga permanece paga; as demais ficam atrasadas
-- quando o vencimento já passou.
-- ============================================================
create or replace view public.parcelas_com_status as
select
  p.id,
  p.venda_id,
  v.cliente_id,
  p.numero,
  p.valor,
  p.vencimento,
  case
    when p.status = 'paga' then 'paga'
    when v.status = 'cancelada' then 'pendente'
    when p.vencimento < current_date then 'atrasada'
    else 'pendente'
  end as status_calculado,
  p.status as status_salvo,
  p.data_pagamento,
  p.valor_pago,
  p.pix_txid,
  p.pix_copia_cola,
  p.pix_qrcode,
  p.criado_em
from public.parcelas p
join public.vendas v on v.id = p.venda_id;

-- ============================================================
-- OBSERVAÇÕES DE SEGURANÇA
-- ============================================================
-- 1. A chave service_role nunca deve ser colocada no frontend.
-- 2. No frontend, utilize somente a chave anon/publishable.
-- 3. Crie usuários em Authentication > Users no painel do Supabase.
-- 4. As políticas acima permitem acesso somente a usuários autenticados.
-- 5. A interface solicita confirmação antes de excluir.
-- 6. Excluir um cliente remove vendas, parcelas e pagamentos relacionados.
-- 7. Excluir uma venda remove parcelas e pagamentos relacionados.
-- 8. Excluir uma parcela não remove a venda inteira.

