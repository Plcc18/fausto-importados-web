import { useState } from "react"
import { Heart, Menu, ShoppingBag } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/Shadcn-Components/ui/sheet"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/component/ThemeToggle"
import { AuthMenu } from "@/component/AuthMenu"
import { StoreTopBar } from "./StoreTopBar"
import type { GenderFilter } from "./storeTypes"

const GENDERS: GenderFilter[] = ["feminino", "masculino", "unissex"]

interface StoreHeaderProps {
  gender: GenderFilter
  onSale: boolean
  showWishlist: boolean
  favoritesCount: number
  cartCount: number
  /** O cabeçalho só avisa o clique; a loja decide o que filtrar e se rola a página até a vitrine. */
  onSelectGender: (gender: GenderFilter) => void
  onToggleSale: () => void
  onToggleWishlist: () => void
  onOpenCart: () => void
}

/**
 * Cabeçalho fixo da loja: faixa superior, menu (com a versão de celular), marca, atalhos de filtro, tema, conta,
 * favoritos e carrinho. Não guarda os filtros: recebe o que mostrar e avisa a loja pelos callbacks.
 */
export function StoreHeader({
  gender,
  onSale,
  showWishlist,
  favoritesCount,
  cartCount,
  onSelectGender,
  onToggleSale,
  onToggleWishlist,
  onOpenCart,
}: StoreHeaderProps) {
  // Só o cabeçalho usa: o menu do celular fecha depois de qualquer escolha
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
      <StoreTopBar />
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex h-16 items-center justify-between gap-4 md:h-20">
          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-75 p-0">
              <SheetHeader className="sr-only"><SheetTitle>Menu de navegação</SheetTitle></SheetHeader>
              <div className="flex flex-col">
                <div className="border-b border-border p-6">
                  <span className="font-serif text-xl font-medium tracking-tight">Fausto</span>
                  <span className="block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Importados</span>
                </div>
                <nav className="flex flex-col p-4">
                  {GENDERS.map((g) => (
                    <button key={g} onClick={() => { onSelectGender(g); setIsMobileMenuOpen(false) }}
                      className={cn('rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors capitalize', gender === g ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                      {g}
                    </button>
                  ))}
                  <button onClick={() => { onToggleSale(); setIsMobileMenuOpen(false) }}
                    className={cn('rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors', onSale ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                    Promoções
                  </button>
                  <button onClick={() => { onToggleWishlist(); setIsMobileMenuOpen(false) }}
                    className={cn('flex items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors', showWishlist ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                    <Heart className="h-4 w-4" />
                    Favoritos
                    {favoritesCount > 0 && <span className="ml-auto text-xs opacity-70">{favoritesCount}</span>}
                  </button>
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          {/* Brand + Nav */}
          <div className="flex items-center gap-8">
            <a href="/" className="group flex flex-col items-center transition-opacity hover:opacity-80 md:items-start">
              <span className="font-serif text-xl font-medium tracking-tight">Fausto</span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Importados</span>
            </a>
            <nav className="hidden items-center gap-1 lg:flex">
              {GENDERS.map((g) => (
                <button key={g} onClick={() => onSelectGender(g)}
                  className={cn('rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 capitalize', gender === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                  {g}
                </button>
              ))}
              <button onClick={onToggleSale}
                className={cn('rounded-full px-4 py-2 text-sm font-medium transition-all duration-200', onSale ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                Promoções
              </button>
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AuthMenu />
            <button onClick={onToggleWishlist}
              className={cn('relative flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200', showWishlist ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:border-primary/50 hover:bg-muted')}
              title="Minha lista de favoritos">
              <Heart className={cn('h-4 w-4', showWishlist && 'fill-current')} />
              {favoritesCount > 0 && <span className="text-xs">{favoritesCount}</span>}
            </button>
            <button onClick={onOpenCart}
              className={cn('group relative flex items-center gap-2 rounded-full border px-3 py-2 transition-all duration-300', cartCount > 0 ? 'border-primary bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-[1.02]' : 'border-border bg-transparent text-foreground hover:border-primary/50 hover:bg-muted')}>
              <div className="relative">
                <ShoppingBag className={cn('h-4.5 w-4.5 transition-transform duration-300', cartCount > 0 ? 'group-hover:scale-110' : '')} />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-background/50 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-background" />
                  </span>
                )}
              </div>
              {cartCount > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{cartCount}</span>
                  <span className="hidden text-xs opacity-80 sm:block">{cartCount === 1 ? 'item' : 'itens'}</span>
                </div>
              ) : (
                <span className="hidden text-sm font-medium sm:block">Carrinho</span>
              )}
              {cartCount > 0 && (
                <div className="hidden items-center gap-1 border-l border-background/30 pl-2 md:flex">
                  <span className="text-xs font-medium opacity-90">Ver</span>
                  <svg className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
