import { Check, ShoppingBag, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { QuickFilter } from "./storeTypes"

interface StoreHeroProps {
  quickFilters: QuickFilter[]
  activeQuickFilterId: string | null
  onQuickFilter: (filter: QuickFilter) => void
}

/**
 * Hero da loja ("A arte da perfumaria"), com os filtros rápidos e os selos de confiança. Tem o único `h1` da
 * página. Ponto de entrada do banner da campanha (T23), que usará este hero como fallback.
 */
export function StoreHero({ quickFilters, activeQuickFilterId, onQuickFilter }: StoreHeroProps) {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-muted/50 via-muted/30 to-background px-4 py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMDA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />
      <div className="relative mx-auto max-w-4xl text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-1.5 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium tracking-wide text-muted-foreground">2026 + Elegante</span>
        </div>
        <div className="flex justify-center mb-4 mt-2">
          <img src="/logoLoja.png" alt="Fausto Importados" className="w-full max-w-70 sm:max-w-sm md:max-w-md object-contain" style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.18))' }} />
        </div>
        <h1 className="text-4xl font-light leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl text-balance">
          A arte da
          <span className="text-gold-metal relative mx-3 inline-block font-serif italic">
            perfumaria
            <svg className="absolute -bottom-2 left-0 h-3 w-full text-primary/30" viewBox="0 0 100 12" preserveAspectRatio="none">
              <path d="M0 9 Q 25 0, 50 9 T 100 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <br className="hidden sm:block" />
          ao seu alcance
        </h1>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {quickFilters.map((filter) => {
            const Icon = filter.icon
            const isActive = activeQuickFilterId === filter.id
            return (
              <button key={filter.id} onClick={() => onQuickFilter(filter)}
                className={cn('group relative flex items-center gap-2.5 overflow-hidden rounded-full border px-6 py-3 text-sm font-medium transition-all duration-300', isActive ? 'border-primary bg-primary text-primary-foreground shadow-lg' : 'border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:border-primary/40 hover:bg-background hover:shadow-md')}>
                <Icon className={cn('h-4 w-4 transition-all duration-300 group-hover:scale-110', isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground')} />
                {filter.label}
                <span className="text-xs opacity-60">{filter.description}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-muted-foreground">
          <div className="flex items-center gap-2 text-sm"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50"><Check className="h-4 w-4" /></div><span>100% Original</span></div>
          <div className="flex items-center gap-2 text-sm"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50"><ShoppingBag className="h-4 w-4" /></div><span>Envio Seguro</span></div>
          <div className="flex items-center gap-2 text-sm"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50"><Star className="h-4 w-4" /></div><span>+100 Clientes</span></div>
        </div>
      </div>
    </section>
  )
}
