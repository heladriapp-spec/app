import { MarcaBlocos } from '@/components/marca-blocos'

export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <MarcaBlocos
        className={
          compacta
            ? 'h-9 w-auto shrink-0 text-primary'
            : 'h-16 w-auto shrink-0 text-primary'
        }
      />
      <img
        src="/marca/heladri.png"
        alt="Heladri cenografia"
        width={358}
        height={164}
        className={compacta ? 'h-10 w-auto' : 'h-16 w-auto'}
      />
    </div>
  )
}
