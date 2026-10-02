-- Conta: nomes, situação, último acesso e geração da sessão.
-- O login das contas novas é o e-mail. Contas já criadas mantêm o login.

alter table public.usuarios
  add column if not exists primeiro_nome text,
  add column if not exists sobrenome text,
  add column if not exists situacao text,
  add column if not exists ultimo_acesso_em timestamptz,
  add column if not exists sessao_geracao integer not null default 0;

update public.usuarios
set
  primeiro_nome = coalesce(nullif(primeiro_nome, ''), split_part(nome, ' ', 1)),
  sobrenome = coalesce(
    sobrenome,
    nullif(btrim(substring(nome from position(' ' in nome) + 1)), '')
  ),
  situacao = coalesce(situacao, case when ativo then 'ativa' else 'desativada' end)
where primeiro_nome is null or situacao is null or primeiro_nome = '';

alter table public.usuarios drop constraint if exists usuarios_situacao_check;
alter table public.usuarios
  add constraint usuarios_situacao_check
  check (situacao in ('ativa', 'bloqueada', 'desativada'));

alter table public.pedidos_acesso
  add column if not exists primeiro_nome text,
  add column if not exists sobrenome text,
  add column if not exists papel text;

update public.pedidos_acesso
set
  primeiro_nome = coalesce(nullif(primeiro_nome, ''), split_part(nome, ' ', 1)),
  sobrenome = coalesce(
    sobrenome,
    nullif(btrim(substring(nome from position(' ' in nome) + 1)), '')
  ),
  papel = coalesce(papel, 'comum')
where primeiro_nome is null or papel is null or primeiro_nome = '';

alter table public.pedidos_acesso drop constraint if exists pedidos_acesso_papel_check;
alter table public.pedidos_acesso
  add constraint pedidos_acesso_papel_check
  check (papel is null or papel in ('administrador', 'comum'));
