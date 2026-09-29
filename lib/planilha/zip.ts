import { inflateRawSync } from 'node:zlib'

/** Lê um .xlsx (ZIP) e devolve o conteúdo de cada arquivo interno. */
export function abrirZip(buf: Buffer): Map<string, Buffer> {
  const eocd = acharFim(buf)
  const total = buf.readUInt16LE(eocd + 10)
  let cursor = buf.readUInt32LE(eocd + 16)
  const arquivos = new Map<string, Buffer>()

  for (let indice = 0; indice < total; indice++) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Pacote da planilha ilegível.')
    }
    const metodo = buf.readUInt16LE(cursor + 10)
    const tamanho = buf.readUInt32LE(cursor + 20)
    const nomeTamanho = buf.readUInt16LE(cursor + 28)
    const extraTamanho = buf.readUInt16LE(cursor + 30)
    const comentarioTamanho = buf.readUInt16LE(cursor + 32)
    const local = buf.readUInt32LE(cursor + 42)
    const nome = buf.subarray(cursor + 46, cursor + 46 + nomeTamanho).toString('utf8')
    const nomeLocal = buf.readUInt16LE(local + 26)
    const extraLocal = buf.readUInt16LE(local + 28)
    const inicio = local + 30 + nomeLocal + extraLocal
    const comprimido = buf.subarray(inicio, inicio + tamanho)
    const dados = metodo === 0 ? Buffer.from(comprimido) : inflateRawSync(comprimido)
    arquivos.set(nome, dados)
    cursor += 46 + nomeTamanho + extraTamanho + comentarioTamanho
  }

  return arquivos
}

function acharFim(buf: Buffer) {
  const minimo = Math.max(0, buf.length - 22 - 0xffff)
  for (let indice = buf.length - 22; indice >= minimo; indice--) {
    if (buf.readUInt32LE(indice) === 0x06054b50) return indice
  }
  throw new Error('Pacote da planilha ilegível.')
}
