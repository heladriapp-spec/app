-- Limite de tentativas de login. O navegador não lê esta tabela.
-- A função trava a linha para duas instâncias não perderem a contagem.

create table if not exists public.tentativas_acesso (
  chave text primary key,
  falhas integer not null,
  janela_inicio timestamptz not null,
  bloqueado_ate timestamptz
);

alter table public.tentativas_acesso enable row level security;

revoke all on table public.tentativas_acesso from public, anon, authenticated;
grant select, insert, update, delete on table public.tentativas_acesso to service_role;

create or replace function public.acesso_bloqueado(p_chave text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tentativas_acesso
    where chave = p_chave
      and bloqueado_ate is not null
      and bloqueado_ate > now()
  );
$$;

create or replace function public.registrar_falha_acesso(
  p_chave text,
  p_limite integer,
  p_janela_seg integer,
  p_bloqueio_seg integer
)
returns void
language plpgsql
set search_path = public
as $$
declare
  agora timestamptz := now();
  atual public.tentativas_acesso%rowtype;
  v_falhas integer;
  v_inicio timestamptz;
begin
  if p_chave is null or length(p_chave) < 3 or length(p_chave) > 80 then
    raise exception 'chave invalida';
  end if;
  if p_limite < 1 or p_limite > 100 or p_janela_seg < 1 or p_bloqueio_seg < 1 then
    raise exception 'limite invalido';
  end if;

  insert into public.tentativas_acesso (chave, falhas, janela_inicio, bloqueado_ate)
  values (p_chave, 0, agora, null)
  on conflict (chave) do nothing;

  select * into atual
  from public.tentativas_acesso
  where chave = p_chave
  for update;

  if atual.bloqueado_ate is not null and atual.bloqueado_ate > agora then
    return;
  end if;

  if atual.janela_inicio <= agora - make_interval(secs => p_janela_seg) then
    v_falhas := 1;
    v_inicio := agora;
  else
    v_falhas := atual.falhas + 1;
    v_inicio := atual.janela_inicio;
  end if;

  update public.tentativas_acesso
  set falhas = v_falhas,
      janela_inicio = v_inicio,
      bloqueado_ate = case
        when v_falhas >= p_limite then agora + make_interval(secs => p_bloqueio_seg)
        else null
      end
  where chave = p_chave;
end;
$$;

create or replace function public.limpar_tentativa_acesso(p_chave text)
returns void
language sql
set search_path = public
as $$
  delete from public.tentativas_acesso where chave = p_chave;
$$;

revoke all on function public.acesso_bloqueado(text) from public, anon, authenticated;
revoke all on function public.registrar_falha_acesso(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.limpar_tentativa_acesso(text) from public, anon, authenticated;

grant execute on function public.acesso_bloqueado(text) to service_role;
grant execute on function public.registrar_falha_acesso(text, integer, integer, integer) to service_role;
grant execute on function public.limpar_tentativa_acesso(text) to service_role;
