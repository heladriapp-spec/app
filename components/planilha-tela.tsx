import { salvarPreenchimento } from '@/app/actions/projetos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LinhaPlanilha } from '@/lib/planilha/ler'
import { formatarNumeroBR, lerNumeroBR } from '@/lib/planilha/numeros'
import { lancamentoDaLinha } from '@/lib/projetos/store'
import type { Projeto } from '@/lib/projetos/tipos'

function conta(quantidade: string, material: string, maoDeObra: string) {
  const qtde = lerNumeroBR(quantidade)
  const mat = lerNumeroBR(material)
  const mao = lerNumeroBR(maoDeObra)
  const unitario = mat != null || mao != null ? (mat ?? 0) + (mao ?? 0) : null
  const totalMaterial = qtde != null && mat != null ? qtde * mat : null
  const totalMao = qtde != null && mao != null ? qtde * mao : null
  const total =
    totalMaterial != null || totalMao != null ? (totalMaterial ?? 0) + (totalMao ?? 0) : null
  return { unitario, totalMaterial, totalMao, total }
}

function texto(valor: number | null) {
  return valor == null ? '—' : formatarNumeroBR(valor)
}

export function PlanilhaTela({ projeto, linhas }: { projeto: Projeto; linhas: LinhaPlanilha[] }) {
  const itens = linhas.filter((linha) => !linha.grupo)
  const somas = itens.reduce(
    (acc, linha) => {
      const valores = lancamentoDaLinha(projeto, linha.linha, linha)
      const totais = conta(valores.quantidade, valores.material, valores.maoDeObra)
      acc.material += totais.totalMaterial ?? 0
      acc.mao += totais.totalMao ?? 0
      return acc
    },
    { material: 0, mao: 0 },
  )

  return (
    <form action={salvarPreenchimento} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={projeto.id} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 font-medium">Item</th>
              <th className="px-2 py-2 font-medium">Código</th>
              <th className="px-2 py-2 font-medium">Descrição</th>
              <th className="px-2 py-2 font-medium">Un.</th>
              <th className="px-2 py-2 font-medium">Qtd.</th>
              <th className="px-2 py-2 font-medium">Material</th>
              <th className="px-2 py-2 font-medium">Mão de obra</th>
              <th className="px-2 py-2 font-medium">Total unit.</th>
              <th className="px-2 py-2 font-medium">Total material</th>
              <th className="px-2 py-2 font-medium">Total mão de obra</th>
              <th className="px-2 py-2 font-medium">Total da linha</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              if (linha.grupo) {
                return (
                  <tr key={linha.linha} className="border-t bg-muted/40">
                    <td className="px-2 py-2 font-medium" colSpan={11}>
                      {linha.codigo} · {linha.descricao}
                    </td>
                  </tr>
                )
              }
              const valores = lancamentoDaLinha(projeto, linha.linha, linha)
              const totais = conta(valores.quantidade, valores.material, valores.maoDeObra)
              const chave = String(linha.linha)
              return (
                <tr key={linha.linha} className="border-t">
                  <td className="px-2 py-1.5 tabular-nums">{linha.item}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{linha.codigo}</td>
                  <td className="max-w-md px-2 py-1.5">{linha.descricao}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{linha.unidade}</td>
                  <td className="px-2 py-1.5">
                    <Input
                      name={`qtde:${chave}`}
                      defaultValue={valores.quantidade}
                      inputMode="decimal"
                      aria-label={`Quantidade ${linha.codigo}`}
                      className="w-20 text-right"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      name={`material:${chave}`}
                      defaultValue={valores.material}
                      inputMode="decimal"
                      aria-label={`Material ${linha.codigo}`}
                      className="w-24 text-right"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      name={`mao:${chave}`}
                      defaultValue={valores.maoDeObra}
                      inputMode="decimal"
                      aria-label={`Mão de obra ${linha.codigo}`}
                      className="w-24 text-right"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{texto(totais.unitario)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{texto(totais.totalMaterial)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{texto(totais.totalMao)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{texto(totais.total)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td className="px-2 py-2" colSpan={8}>
                Total da tela
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{formatarNumeroBR(somas.material)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatarNumeroBR(somas.mao)}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatarNumeroBR(somas.material + somas.mao)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Preço vazio continua vazio. Zero digitado fica zero. Os totais repetem a conta da planilha
          e não substituem a fórmula do arquivo.
        </p>
        <Button type="submit">Salvar preenchimento</Button>
      </div>
    </form>
  )
}
