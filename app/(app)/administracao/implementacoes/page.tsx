import { decidirEntrega } from '@/app/actions/entregas'
import { GestaoAtalhos } from '@/components/gestao-atalhos'
import { NotaOperacao } from '@/components/nota-operacao'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { carregarResolvidas } from '@/lib/entregas/carregar'
import { implantadas } from '@/lib/entregas/estado'
import { AREA_LABEL, NIVEL_LABEL, TIPO_LABEL, VISOES, visaoValida } from '@/lib/entregas/rotulos'
import { parecerDaEntrega } from '@/lib/entregas/conflitos'
import type { AcaoEntrega, EntregaResolvida, VisaoImplementacoes } from '@/lib/entregas/tipos'
import { buttonVariants } from '@/components/ui/button'
import { Rocket } from 'lucide-react'
import Link from 'next/link'

function Cartao({
  item,
  visao,
  acoes,
  bloqueado,
  motivos,
}: {
  item: EntregaResolvida
  visao: VisaoImplementacoes
  acoes: boolean
  bloqueado: boolean
  motivos: string[]
}) {
  const podeAprovar = acoes && !item.implantado && item.statusDecisao !== 'rollback' && !bloqueado
  const podePular = acoes && !item.implantado && item.statusDecisao !== 'rollback'
  const podeRollback = acoes && item.statusDecisao !== 'pedido_reversao'

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">
            <Link href={`/administracao/implementacoes/${item.id}`} className="hover:underline">
              {item.nome}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.resumo}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{TIPO_LABEL[item.tipo]}</Badge>
          <Badge variant={item.implantadoVisual ? 'secondary' : 'outline'}>{item.statusExibicao}</Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Prevista {item.versaoPrevista}
        {item.versaoEfetiva ? ` · efetiva ${item.versaoEfetiva}` : ' · sem versão efetiva'}
        {item.areas.length > 0
          ? ` · ${item.areas.map((area) => AREA_LABEL[area]).join(', ')}`
          : ''}
      </p>
      {motivos.length > 0 ? <p className="text-sm text-muted-foreground">{motivos.join(' ')}</p> : null}
      {acoes ? (
        <div className="flex flex-wrap gap-2">
          <Formulario id={item.id} visao={visao} acao="aprovar" rotulo="Aprovar para desenvolver" disabled={!podeAprovar} />
          <Formulario id={item.id} visao={visao} acao="passar_frente" rotulo="Passar à frente" disabled={!podePular} variante="outline" />
          <Formulario id={item.id} visao={visao} acao="rollback" rotulo="Rollback" disabled={!podeRollback} variante="ghost" />
        </div>
      ) : null}
    </article>
  )
}

function Formulario({
  id,
  visao,
  acao,
  rotulo,
  disabled,
  variante = 'default',
}: {
  id: string
  visao: string
  acao: AcaoEntrega
  rotulo: string
  disabled?: boolean
  variante?: 'default' | 'outline' | 'ghost'
}) {
  return (
    <form action={decidirEntrega}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visao" value={visao} />
      <input type="hidden" name="acao" value={acao} />
      <Button type="submit" size="sm" variant={variante} disabled={disabled}>
        {rotulo}
      </Button>
    </form>
  )
}

export default async function ImplementacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; erro?: string; ok?: string }>
}) {
  const params = await searchParams
  const visao = visaoValida(params.visao)
  const { resolvidas, fila, parecer } = await carregarResolvidas()
  const lista = visao === 'releases' ? fila : resolvidas.filter((item) => item.tipo === visao)
  const jaSaiu = implantadas(resolvidas)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold md:text-xl">
            <Rocket className="size-5 text-muted-foreground" />
            Implantações
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Catálogo das entregas do Heladri. Nova entrega, atualização e correção. Aprovar libera
            desenvolver esta entrega e a esteira aponta o próximo passo.
          </p>
        </div>
        <GestaoAtalhos atual="/administracao/implementacoes" />
      </div>
      <NotaOperacao />

      <nav className="flex flex-wrap gap-2" aria-label="Visões">
        {VISOES.map((item) => (
          <Link
            key={item.id}
            href={`/administracao/implementacoes?visao=${item.id}`}
            className={buttonVariants({ size: 'sm', variant: visao === item.id ? 'default' : 'outline' })}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {params.ok ? <p className="rounded-lg border px-3 py-2 text-sm">{params.ok}</p> : null}
      {params.erro ? (
        <p className="rounded-lg border px-3 py-2 text-sm text-destructive">{params.erro}</p>
      ) : null}

      {visao === 'releases' ? (
        <p className="text-sm">
          Fila: {NIVEL_LABEL[parecer.nivel]}. A ordem vigente é a que a esteira usa.
        </p>
      ) : null}

      <div className="grid gap-3">
        {lista.map((item) => {
          const conflito = parecerDaEntrega(parecer, item.id)
          return (
            <Cartao
              key={item.id}
              item={item}
              visao={visao}
              acoes={visao === 'releases'}
              bloqueado={conflito?.nivel === 'bloqueado'}
              motivos={conflito && conflito.nivel !== 'ok' ? conflito.motivos : []}
            />
          )
        })}
      </div>

      {visao === 'releases' && jaSaiu.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Já implantado</h2>
          <div className="grid gap-3">
            {jaSaiu.map((item) => (
              <Cartao key={item.id} item={item} visao={visao} acoes={false} bloqueado={false} motivos={[]} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
