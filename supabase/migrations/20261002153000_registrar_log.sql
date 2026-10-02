-- INSERT pontual de log e teto temporário de 300 registros.
-- O código antigo não chama esta função. Deixá-la criada não muda o comportamento dele.
-- Para reverter: drop function if exists public.registrar_log(uuid, timestamptz, text, text, text, text, jsonb);
-- O expurgo dos registros além de 300 acontece na chamada, não neste arquivo.
-- Esse teto é temporário. A retenção definitiva fica para uma etapa posterior.

create or replace function public.registrar_log(
  p_id uuid,
  p_em timestamptz,
  p_nivel text,
  p_evento text,
  p_ator text,
  p_mensagem text,
  p_detalhe jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_id is null or p_em is null then
    raise exception 'log incompleto';
  end if;
  if p_nivel not in ('info', 'alerta', 'erro') then
    raise exception 'nivel invalido';
  end if;
  if p_evento is null or length(p_evento) < 1 or length(p_evento) > 80 then
    raise exception 'evento invalido';
  end if;
  if p_mensagem is null or length(p_mensagem) < 1 or length(p_mensagem) > 2000 then
    raise exception 'mensagem invalida';
  end if;
  if p_ator is not null and length(p_ator) > 64 then
    raise exception 'ator invalido';
  end if;
  if p_detalhe is null or jsonb_typeof(p_detalhe) <> 'object' then
    raise exception 'detalhe invalido';
  end if;

  perform pg_advisory_xact_lock(214748300);

  insert into public.logs (id, em, nivel, evento, ator, mensagem, detalhe)
  values (p_id, p_em, p_nivel, p_evento, p_ator, p_mensagem, p_detalhe);

  -- Mais novos primeiro. O que ficar depois dos 300 é o mais antigo e sai.
  delete from public.logs
  where id in (
    select id
    from public.logs
    order by em desc, id desc
    offset 300
  );
end;
$$;

revoke all on function public.registrar_log(uuid, timestamptz, text, text, text, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.registrar_log(uuid, timestamptz, text, text, text, text, jsonb)
  to service_role;
