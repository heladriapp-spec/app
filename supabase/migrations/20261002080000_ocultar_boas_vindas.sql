-- Preferência da conta: não mostrar de novo o recado de boas-vindas.

alter table public.usuarios
  add column if not exists ocultar_boas_vindas boolean not null default false;
