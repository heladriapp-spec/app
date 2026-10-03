-- A trilha do projeto: quem enviou, assumiu, devolveu e concluiu.
-- Não guarda cópia do formulário.

alter table public.projeto_eventos drop constraint if exists projeto_eventos_tipo_check;

alter table public.projeto_eventos
  add constraint projeto_eventos_tipo_check
  check (tipo in (
    'submetido',
    'assumido',
    'devolvido',
    'concluido',
    'campo',
    'excluiu_item',
    'reincluiu_item',
    'participante_incluido',
    'participante_removido',
    'restaurou'
  ));
