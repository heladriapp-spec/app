-- Links de uso único: confirmação de acesso e senha nova.
-- O navegador não lê esta tabela. O servidor grava o hash, nunca o link cru.

create table if not exists public.links_acesso (
  id text primary key,
  tipo text not null check (tipo in ('confirmacao', 'senha')),
  email text not null,
  pedido_id text,
  usuario_id text,
  token_hash text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz
);

alter table public.links_acesso enable row level security;

revoke all on table public.links_acesso from public, anon, authenticated;
grant select, insert, update, delete on table public.links_acesso to service_role;
