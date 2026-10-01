'use client'

export async function baixarPlanilha(
  form: HTMLFormElement,
  opcoes?: { concluir?: boolean },
): Promise<string | null> {
  const dados = new FormData(form)
  if (opcoes?.concluir) dados.set('concluir', '1')
  const id = String(dados.get('id') ?? '')
  const resposta = await fetch(`/api/projetos/${id}/planilha`, {
    method: 'POST',
    body: dados,
  })
  if (!resposta.ok) return (await resposta.text()) || 'Não foi possível baixar a planilha.'
  const blob = await resposta.blob()
  const nome = nomeDoCabecalho(resposta.headers.get('Content-Disposition'))
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.click()
  URL.revokeObjectURL(url)
  return null
}

function nomeDoCabecalho(bruto: string | null) {
  if (!bruto) return 'planilha.xlsx'
  const estrela = /filename\*=UTF-8''([^;]+)/i.exec(bruto)
  if (estrela?.[1]) return decodeURIComponent(estrela[1])
  const simples = /filename="([^"]+)"/.exec(bruto)
  return simples?.[1] || 'planilha.xlsx'
}
