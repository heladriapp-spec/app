import {
  configurarUsuario,
  criarUsuario,
  decidirPedido,
  enviarLinkDeSenha,
  excluirUsuario,
  reenviarNotificacao,
} from '@/app/actions/usuarios'
import { usuarioDaSessao } from '@/lib/auth/guard'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { GestaoAtalhos } from '@/components/gestao-atalhos'
import { NotaOperacao } from '@/components/nota-operacao'
import { Recado } from '@/components/recado'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dataHoraBR } from '@/lib/formato'
import { listarAtoresComLogin, listarPedidos, listarUsuariosPublicos } from '@/lib/operacao/store'
import { Shield } from 'lucide-react'

export default async function AdministracaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; excluir?: string }>
}) {
  const { erro, ok, excluir } = await searchParams
  const sessao = await usuarioDaSessao()
  const [usuarios, pedidos, quemEntrou] = await Promise.all([
    listarUsuariosPublicos(),
    listarPedidos(),
    listarAtoresComLogin(),
  ])
  const adminsAtivos = usuarios.filter((item) => item.papel === 'administrador' && item.ativo)
  const pendentes = pedidos.filter((item) => item.situacao === 'pendente')
  const historico = pedidos.filter((item) => item.situacao !== 'pendente')
  const aguardandoAcesso = pedidos
    .filter((item) => item.situacao === 'aprovado')
    .map((pedido) => {
      const usuario =
        usuarios.find(
          (item) => item.email != null && item.email.toLowerCase() === pedido.email.toLowerCase(),
        ) ?? null
      return {
        pedido,
        usuario,
        entrou: usuario != null && quemEntrou.has(usuario.login),
      }
    })
    .filter((item) => !item.entrou)

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo="Administração" icone={Shield} acoes={<GestaoAtalhos atual="/administracao" />}>
        <NotaOperacao />
      </CabecalhoPagina>

      {ok ? <Recado tom="ok">{ok}</Recado> : null}
      {erro ? <Recado tom="erro">{erro}</Recado> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Pedidos de acesso</h2>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido pendente.</p>
        ) : (
          <ul className="grid gap-3">
            {pendentes.map((pedido) => (
              <li key={pedido.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="font-medium">{pedido.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {pedido.email} · {pedido.celular} · {dataHoraBR(pedido.criadoEm)}
                </p>
                <div className="mt-2 flex gap-2">
                  <form action={decidirPedido}>
                    <input type="hidden" name="id" value={pedido.id} />
                    <input type="hidden" name="acao" value="aprovar" />
                    <Button type="submit" size="sm">
                      Aprovar
                    </Button>
                  </form>
                  <form action={decidirPedido}>
                    <input type="hidden" name="id" value={pedido.id} />
                    <input type="hidden" name="acao" value="rejeitar" />
                    <Button type="submit" size="sm" variant="outline">
                      Rejeitar
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Aprovar envia o link para a pessoa definir a própria senha. O e-mail do pedido é o
          login. Rejeitar não envia e-mail.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Aguardando primeiro acesso</h2>
        {aguardandoAcesso.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguém aprovado está sem o primeiro acesso.
          </p>
        ) : (
          <ul className="grid gap-3">
            {aguardandoAcesso.map(({ pedido, usuario }) => (
              <li key={pedido.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="font-medium">{pedido.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {pedido.email}
                  {pedido.decididoEm ? ` · aprovado em ${dataHoraBR(pedido.decididoEm)}` : ''}
                  {pedido.decididoPor ? ` por ${pedido.decididoPor}` : ''}
                </p>
                <p className="mt-1 text-sm">
                  {usuario
                    ? `Conta ${usuario.login} criada, ainda sem entrar.`
                    : 'Aguardando a confirmação do e-mail. A conta nasce nesse link.'}
                </p>
                {usuario ? null : (
                  <form action={reenviarNotificacao} className="mt-2">
                    <input type="hidden" name="id" value={pedido.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Reenviar notificação
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Reenviar manda outro link e invalida o anterior. Sem remetente configurado, nada sai e
          a mensagem não fica retida.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Convidar</h2>
        <form action={criarUsuario} className="grid max-w-xl gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor="novo-primeiro">Primeiro nome</Label>
            <Input id="novo-primeiro" name="primeiroNome" required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="novo-sobrenome">Sobrenome</Label>
            <Input id="novo-sobrenome" name="sobrenome" required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="novo-email">E-mail</Label>
            <Input id="novo-email" name="email" type="email" autoComplete="off" required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="novo-celular">Celular</Label>
            <Input id="novo-celular" name="celular" required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="novo-papel">Papel</Label>
            <select
              id="novo-papel"
              name="papel"
              defaultValue="comum"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="comum">Usuário comum</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit">Enviar convite</Button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground">
          O e-mail vira o login. A pessoa define a senha no link. Você não escolhe essa senha.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Usuários</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Login</th>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">E-mail</th>
                <th className="px-3 py-2 font-medium">Celular</th>
                <th className="px-3 py-2 font-medium">Papel</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => {
                const unico =
                  adminsAtivos.length === 1 && usuario.id === adminsAtivos[0]?.id
                return (
                  <tr key={usuario.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{usuario.login}</td>
                    <td className="px-3 py-2">{usuario.nome}</td>
                    <td className="px-3 py-2">{usuario.email ?? '—'}</td>
                    <td className="px-3 py-2">{usuario.celular ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap items-center gap-2">
                        {usuario.papel === 'administrador' ? 'Administrador' : 'Usuário comum'}
                        {usuario.noGrupoExecutor ? <Badge>Executor</Badge> : null}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={usuario.situacao === 'ativa' ? 'secondary' : 'destructive'}>
                        {usuario.situacao === 'ativa'
                          ? 'Ativa'
                          : usuario.situacao === 'bloqueada'
                            ? 'Bloqueada'
                            : 'Desativada'}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {usuario.ultimoAcessoEm
                          ? `Último acesso ${dataHoraBR(usuario.ultimoAcessoEm)}`
                          : 'Sem acesso registrado'}
                      </p>
                      <details className="mt-2" open={excluir === usuario.id ? true : undefined}>
                        <summary className="cursor-pointer text-xs underline">Configurar</summary>
                        <form action={configurarUsuario} className="mt-2 grid max-w-xs gap-2">
                          <input type="hidden" name="id" value={usuario.id} />
                          <Label htmlFor={`nome-${usuario.id}`}>Primeiro nome</Label>
                          <Input
                            id={`nome-${usuario.id}`}
                            name="primeiroNome"
                            defaultValue={usuario.primeiroNome}
                          />
                          <Label htmlFor={`sobrenome-${usuario.id}`}>Sobrenome</Label>
                          <Input
                            id={`sobrenome-${usuario.id}`}
                            name="sobrenome"
                            defaultValue={usuario.sobrenome}
                          />
                          <Label htmlFor={`cel-${usuario.id}`}>Celular</Label>
                          <Input
                            id={`cel-${usuario.id}`}
                            name="celular"
                            defaultValue={usuario.celular ?? ''}
                          />
                          <Label htmlFor={`papel-${usuario.id}`}>Papel</Label>
                          <select
                            id={`papel-${usuario.id}`}
                            name="papel"
                            defaultValue={usuario.papel}
                            disabled={unico}
                            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                          >
                            <option value="administrador">Administrador</option>
                            <option value="comum">Usuário comum</option>
                          </select>
                          {unico ? <input type="hidden" name="papel" value="administrador" /> : null}
                          <Label htmlFor={`situacao-${usuario.id}`}>Situação</Label>
                          <select
                            id={`situacao-${usuario.id}`}
                            name="situacao"
                            defaultValue={usuario.situacao}
                            disabled={unico}
                            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                          >
                            <option value="ativa">Ativa</option>
                            <option value="bloqueada">Bloqueada</option>
                            <option value="desativada">Desativada</option>
                          </select>
                          {unico ? <input type="hidden" name="situacao" value="ativa" /> : null}
                          <label className="flex items-center gap-2 text-sm" htmlFor={`grupo-${usuario.id}`}>
                            <input
                              id={`grupo-${usuario.id}`}
                              type="checkbox"
                              name="grupoExecutor"
                              value="sim"
                              defaultChecked={usuario.noGrupoExecutor}
                            />
                            Grupo Executor
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Inclui a conta no grupo Executor. O grupo é da aplicação. Quem está nele vê a fila e pode assumir. Não escolhe o responsável de um projeto.
                          </p>
                          <Button type="submit" size="sm">
                            Gravar
                          </Button>
                        </form>
                        {usuario.email ? (
                          <form action={enviarLinkDeSenha} className="mt-3">
                            <input type="hidden" name="id" value={usuario.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Enviar link de senha
                            </Button>
                          </form>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Esta conta não tem e-mail. A senha dela não é definida por aqui.
                          </p>
                        )}
                        {sessao?.id === usuario.id ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Esta é a conta em que você está. Outro administrador pode excluí-la.
                          </p>
                        ) : unico ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            O único administrador ativo não pode ser excluído.
                          </p>
                        ) : excluir === usuario.id ? (
                          <form action={excluirUsuario} className="mt-3 grid gap-2">
                            <input type="hidden" name="id" value={usuario.id} />
                            <p className="text-xs">
                              Excluir {usuario.login}? A pessoa deixa de entrar. O histórico permanece.
                            </p>
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" variant="destructive">
                                Excluir
                              </Button>
                              <a href="/administracao" className="text-xs underline">
                                Cancelar
                              </a>
                            </div>
                          </form>
                        ) : (
                          <a
                            href={`/administracao?excluir=${usuario.id}`}
                            className="mt-3 inline-block text-xs text-destructive underline"
                          >
                            Excluir usuário
                          </a>
                        )}
                      </details>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {historico.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Histórico de pedidos</h2>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {historico.map((pedido) => (
              <li key={pedido.id}>
                {pedido.nome} · {pedido.email} ·{' '}
                {pedido.situacao === 'aprovado' ? 'aprovado' : 'rejeitado'}
                {pedido.decididoPor ? ` por ${pedido.decididoPor}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
