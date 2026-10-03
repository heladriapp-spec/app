-- O grupo Executor é da aplicação. A marca na conta entra aqui e sai.

create table if not exists public.grupo_membros (
  grupo text not null check (grupo = 'executor'),
  usuario_id text not null references public.usuarios (id) on delete cascade,
  primary key (grupo, usuario_id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'executor'
  ) then
    insert into public.grupo_membros (grupo, usuario_id)
    select 'executor', id
    from public.usuarios
    where executor = true
    on conflict do nothing;
  end if;
end $$;

alter table public.usuarios drop column if exists executor;

alter table public.grupo_membros enable row level security;
revoke all on table public.grupo_membros from public, anon, authenticated;
grant select, insert, update, delete on table public.grupo_membros to service_role;
