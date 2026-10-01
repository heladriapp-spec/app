-- Planilha de origem e planilha gerada ficam no banco, amarradas ao projeto.
-- Rascunho e concluído passam a ser status do projeto.

do $$
declare
  nome text;
begin
  select con.conname into nome
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'projetos'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%sem_planilha%';
  if nome is not null then
    execute format('alter table public.projetos drop constraint %I', nome);
  end if;
end $$;

alter table public.projetos drop constraint if exists projetos_status_check;

alter table public.projetos
  add constraint projetos_status_check
  check (status in ('rascunho', 'sem_planilha', 'em_preenchimento', 'concluido'));

alter table public.projetos
  add column if not exists arquivo_gerado_nome text,
  add column if not exists concluido_em timestamptz,
  add column if not exists concluido_por text;

create table if not exists public.projeto_arquivos (
  projeto_id text not null references public.projetos (id) on delete cascade,
  papel text not null check (papel in ('origem', 'gerado')),
  nome text not null,
  conteudo bytea not null,
  gravado_em timestamptz not null default now(),
  gravado_por text not null,
  primary key (projeto_id, papel)
);

alter table public.projeto_arquivos enable row level security;

revoke all on table public.projeto_arquivos from public, anon, authenticated;
grant select, insert, update, delete on table public.projeto_arquivos to service_role;
