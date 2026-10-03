-- Versão do preenchimento guarda campos e linhas fora, não o arquivo.
-- O histórico de quem alterou continua em projeto_eventos.

alter table public.projeto_eventos drop constraint if exists projeto_eventos_tipo_check;

alter table public.projeto_eventos
  add constraint projeto_eventos_tipo_check
  check (tipo in (
    'submetido',
    'campo',
    'excluiu_item',
    'reincluiu_item',
    'participante_incluido',
    'participante_removido',
    'restaurou'
  ));

create table if not exists public.projeto_versoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id text not null references public.projetos (id) on delete cascade,
  numero integer not null check (numero > 0),
  em timestamptz not null default now(),
  ator text not null,
  estado jsonb not null,
  unique (projeto_id, numero)
);

alter table public.projeto_versoes enable row level security;

revoke all on table public.projeto_versoes from public, anon, authenticated;

grant select, insert, update, delete on table public.projeto_versoes to service_role;
