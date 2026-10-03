-- Grupos de acesso. O Executor continua sem diretiva.

create table if not exists public.grupos (
  id text primary key,
  nome text not null,
  diretiva text check (diretiva is null or diretiva in ('administrador', 'acesso_comum')),
  sistema boolean not null default false
);

insert into public.grupos (id, nome, diretiva, sistema)
values
  ('administradores', 'Administradores', 'administrador', true),
  ('acesso-comum', 'Acesso comum', 'acesso_comum', true),
  ('executor', 'Executor', null, true)
on conflict (id) do nothing;

alter table public.grupo_membros drop constraint if exists grupo_membros_grupo_check;

insert into public.grupo_membros (grupo, usuario_id)
select 'administradores', id
from public.usuarios
where papel = 'administrador'
on conflict do nothing;

insert into public.grupo_membros (grupo, usuario_id)
select 'acesso-comum', id
from public.usuarios
where papel is distinct from 'administrador'
on conflict do nothing;

alter table public.pedidos_acesso add column if not exists grupo_id text;
alter table public.pedidos_acesso add column if not exists login_escolhido text;

alter table public.grupos enable row level security;
revoke all on table public.grupos from public, anon, authenticated;
grant select, insert, update, delete on table public.grupos to service_role;
