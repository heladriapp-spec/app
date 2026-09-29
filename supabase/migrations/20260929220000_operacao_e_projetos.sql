-- Operação e projetos no Supabase Cloud.
-- O servidor fala com estas tabelas pela chave secreta. O navegador não lê o banco.
-- RLS ligado e sem política: a chave anônima não vê linha nenhuma.

create table if not exists public.usuarios (
  id text primary key,
  nome text not null,
  email text,
  celular text,
  login text not null unique,
  senha_hash text not null,
  papel text not null check (papel in ('administrador', 'comum')),
  ativo boolean not null default true,
  origem text not null check (origem in ('instalacao', 'pedido'))
);

create unique index if not exists usuarios_email_unico
  on public.usuarios (email)
  where email is not null;

create table if not exists public.pedidos_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  celular text not null,
  criado_em timestamptz not null default now(),
  situacao text not null check (situacao in ('pendente', 'aprovado', 'rejeitado')),
  decidido_em timestamptz,
  decidido_por text
);

create unique index if not exists pedidos_acesso_email_pendente
  on public.pedidos_acesso (email)
  where situacao = 'pendente';

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  em timestamptz not null default now(),
  nivel text not null check (nivel in ('info', 'alerta', 'erro')),
  evento text not null,
  ator text,
  mensagem text not null,
  detalhe jsonb not null default '{}'::jsonb
);

create table if not exists public.entrega_estados (
  entrega_id text primary key,
  status text not null check (status in ('aguardando', 'aprovado', 'rollback', 'adiado', 'pedido_reversao')),
  posicao integer,
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.projetos (
  id text primary key,
  nome text not null,
  data date not null,
  criado_em timestamptz not null default now(),
  criado_por text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text not null,
  arquivo_nome text,
  arquivo_caminho text,
  capa jsonb,
  status text not null check (status in ('sem_planilha', 'em_preenchimento')),
  lancamentos jsonb not null default '{}'::jsonb
);

create table if not exists public.projeto_participantes (
  projeto_id text not null references public.projetos (id) on delete cascade,
  usuario_id text not null references public.usuarios (id) on delete cascade,
  primary key (projeto_id, usuario_id)
);

alter table public.usuarios enable row level security;
alter table public.pedidos_acesso enable row level security;
alter table public.logs enable row level security;
alter table public.entrega_estados enable row level security;
alter table public.projetos enable row level security;
alter table public.projeto_participantes enable row level security;

revoke all on table public.usuarios from anon, authenticated;
revoke all on table public.pedidos_acesso from anon, authenticated;
revoke all on table public.logs from anon, authenticated;
revoke all on table public.entrega_estados from anon, authenticated;
revoke all on table public.projetos from anon, authenticated;
revoke all on table public.projeto_participantes from anon, authenticated;

insert into public.usuarios (
  id, nome, email, celular, login, senha_hash, papel, ativo, origem
) values
  (
    'instalacao-adm',
    'Administrador',
    null,
    null,
    'adm',
    '17670fe9ccc44e2e01b61b6186107a9a:dcd1b0dfb0c19dd5347903b98e9332754b3214b375630efd17de243e3156a886',
    'administrador',
    true,
    'instalacao'
  ),
  (
    'instalacao-convidado',
    'Convidado',
    null,
    null,
    'convidado',
    '841042ffbb0479a21bff905fe5a69f93:88d430784e686438569ab1ca3d042497de23696a3b76427ec8431431e520edf4',
    'comum',
    true,
    'instalacao'
  )
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('planilhas', 'planilhas', false)
on conflict (id) do nothing;
