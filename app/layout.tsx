import { AvisoAcao } from '@/components/aviso-acao'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Heladri Cenografia',
  description: 'Portal da Heladri Cenografia para preencher a planilha de licitação do SESC.',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f6f4f1',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="light">
      <body className="antialiased">
        {children}
        <AvisoAcao />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
