export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold tracking-tight text-primary-foreground shadow-sm">
        H
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight">Heladri</p>
        {compacta ? null : <p className="text-xs text-muted-foreground">Planilha do SESC</p>}
      </div>
    </div>
  )
}
