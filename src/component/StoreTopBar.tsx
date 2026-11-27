/** Faixa fina no topo do cabeçalho. Ponto de entrada da faixa promocional da campanha (T22). */
export function StoreTopBar() {
  return (
    <div className="hidden border-b border-border bg-card text-accent-foreground md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs tracking-wide">
        <span className="opacity-80">Fragrâncias 100% Originais</span>
        <span className="opacity-80">Parcele em até 12x</span>
      </div>
    </div>
  )
}
