import { deflateRawSync, inflateRawSync } from 'node:zlib'

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

/** Remonta o .xlsx. O Excel recalcula as fórmulas ao abrir. */
export function fecharZip(arquivos: Map<string, Buffer>): Buffer {
  const locais: Buffer[] = []
  const centrais: Buffer[] = []
  let offset = 0
  const agora = new Date()
  const tempo = dosTempo(agora)
  const data = dosData(agora)

  for (const [nome, dados] of arquivos) {
    const nomeBuf = Buffer.from(nome, 'utf8')
    const comprimido = deflateRawSync(dados)
    const crc = crc32(dados)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(tempo, 10)
    local.writeUInt16LE(data, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comprimido.length, 18)
    local.writeUInt32LE(dados.length, 22)
    local.writeUInt16LE(nomeBuf.length, 26)
    locais.push(local, nomeBuf, comprimido)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(tempo, 12)
    central.writeUInt16LE(data, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(comprimido.length, 20)
    central.writeUInt32LE(dados.length, 24)
    central.writeUInt16LE(nomeBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    centrais.push(central, nomeBuf)
    offset += 30 + nomeBuf.length + comprimido.length
  }

  const centralBuf = Buffer.concat(centrais)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(arquivos.size, 8)
  eocd.writeUInt16LE(arquivos.size, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locais, centralBuf, eocd])
}

function crc32(buf: Buffer) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (~crc) >>> 0
}

function dosTempo(data: Date) {
  return (data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2)
}

function dosData(data: Date) {
  return ((data.getFullYear() - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate()
}

function acharFim(buf: Buffer) {
  const minimo = Math.max(0, buf.length - 22 - 0xffff)
  for (let indice = buf.length - 22; indice >= minimo; indice--) {
    if (buf.readUInt32LE(indice) === 0x06054b50) return indice
  }
  throw new Error('Pacote da planilha ilegível.')
}
