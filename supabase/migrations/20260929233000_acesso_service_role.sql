-- A chave secreta do servidor usa o papel service_role.
-- anon e authenticated continuam sem acesso.

revoke all on table
  public.usuarios,
  public.pedidos_acesso,
  public.logs,
  public.entrega_estados,
  public.projetos,
  public.projeto_participantes
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.usuarios,
  public.pedidos_acesso,
  public.logs,
  public.entrega_estados,
  public.projetos,
  public.projeto_participantes
to service_role;
