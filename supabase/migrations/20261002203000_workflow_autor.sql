-- Três status do fluxo. Rascunho, sem planilha e em preenchimento eram a mesma fase.
-- A marca de executor nasce desligada. A fila ainda não usa essa coluna.

alter table public.projetos drop constraint if exists projetos_status_check;

update public.projetos
set status = 'em_edicao'
where status in ('rascunho', 'sem_planilha', 'em_preenchimento');

alter table public.projetos
  add constraint projetos_status_check
  check (status in ('em_edicao', 'em_execucao', 'concluido'));

alter table public.projetos
  add column if not exists responsavel_id text references public.usuarios (id) on delete set null,
  add column if not exists responsavel_em timestamptz,
  add column if not exists submetido_em timestamptz,
  add column if not exists previa_liberada boolean not null default false;

create index if not exists projetos_status_responsavel
  on public.projetos (status, responsavel_id);

alter table public.usuarios
  add column if not exists executor boolean not null default false;

create table if not exists public.projeto_eventos (
  id uuid primary key default gen_random_uuid(),
  projeto_id text not null references public.projetos (id) on delete cascade,
  em timestamptz not null default now(),
  tipo text not null check (tipo in ('submetido')),
  ator text not null,
  detalhe jsonb not null default '{}'::jsonb
);

alter table public.projeto_eventos enable row level security;
revoke all on table public.projeto_eventos from public, anon, authenticated;
grant select, insert, update, delete on table public.projeto_eventos to service_role;
