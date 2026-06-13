'use client'

import React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { Product, CartItem } from '@/lib/types'
import { Input } from "@/Shadcn-Components/ui/input"
import {
  getCart, addToCart, updateCartQuantity, removeFromCart, clearCart, getCartCount,
} from '@/lib/store'
import { ProductCard } from './ProductCard'
import { Cart } from './Cart'
import { Button } from '@/Shadcn-Components/ui/button'
import { Badge } from '@/Shadcn-Components/ui/badge'
import { Separator } from '@/Shadcn-Components/ui/separator'
import { cn } from '@/lib/utils'
import {
  ShoppingBag, Sparkles, Gift, Star, Flower2, TreePine, Citrus, Moon,
  Waves, Cherry, Cake, X, Check, ChevronDown, RotateCcw, Menu, Search,
  Heart, ArrowUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/Shadcn-Components/ui/sheet'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/Shadcn-Components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from '@/Shadcn-Components/ui/command'
import { API_URL } from "@/lib/api"
import { ThemeToggle } from "@/component/ThemeToggle"
import { useCartReconciliation } from "@/lib/useCartReconciliation"
import { useDebounce } from "@/lib/useDebounce"

// ─── Types ────────────────────────────────────────────────────────────────────
type GenderFilter = 'todos' | 'feminino' | 'masculino' | 'unissex'
type OlfativeFamily =
  | 'todos' | 'floral' | 'amadeirado' | 'citrico'
  | 'oriental' | 'aquatico' | 'frutado' | 'gourmand'
type Concentration = 'todos' | 'edt' | 'edp' | 'parfum' | 'extrait'
type SortKey = 'default' | 'price_asc' | 'price_desc' | 'newest' | 'best_sellers'

interface Filters {
  gender: GenderFilter
  family: OlfativeFamily
  concentration: Concentration
  minPrice: string
  maxPrice: string
  onSale: boolean
}

interface QuickFilter {
  id: string
  label: string
  icon: React.ElementType
  description: string
  apply: (filters: Filters) => Filters
  isActive: (filters: Filters) => boolean
}

const PRODUCTS_PER_PAGE = 12
const FAVORITES_KEY = 'fausto_favorites'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') }
  catch { return [] }
}
function saveFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
}
function buildShareUrl(productId: string): string {
  const url = new URL(window.location.href)
  url.search = ''                          // remove filtros ativos da URL
  url.searchParams.set('produto', productId)
  return url.toString()
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function Store() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [stockChangedIds, setStockChangedIds] = useState<string[]>([])

  useCartReconciliation(cart, setCart, isCartOpen, setStockChangedIds)

  const [filters, setFilters] = useState<Filters>({
    gender: 'todos', family: 'todos', concentration: 'todos',
    minPrice: '', maxPrice: '', onSale: false,
  })
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)

  const [sortKey, setSortKey] = useState<SortKey>('default')
  const [currentPage, setCurrentPage] = useState(1)
  const [favorites, setFavorites] = useState<string[]>(getFavorites)
  const [showWishlist, setShowWishlist] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const collectionRef = useRef<HTMLDivElement | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [highlightProductId, setHighlightProductId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('produto')
  })

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${API_URL}/api/product`)
        const data = await response.json()
        setProducts(data.content)
      } catch (error) { console.error('Erro ao buscar produtos:', error) }
    }
    fetchProducts()
    setCart(getCart())
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchProducts()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => { setCurrentPage(1) }, [debouncedSearch, filters, sortKey, showWishlist])

  // ── Quick filters ────────────────────────────────────────────────────────────
  const quickFilters: QuickFilter[] = useMemo(() => [
    {
      id: 'lancamentos', label: 'Novidades', icon: Sparkles, description: 'Lançamentos recentes',
      apply: (f) => ({ ...f, gender: 'todos' as const, family: 'todos' as const }),
      isActive: () => activeQuickFilter === 'lancamentos',
    },
    {
      id: 'presentes', label: 'Presente', icon: Gift, description: 'Seleção especial',
      apply: (f) => ({ ...f, minPrice: '20', maxPrice: '100' }),
      isActive: () => activeQuickFilter === 'presentes',
    },
    {
      id: 'premium', label: 'Luxo', icon: Star, description: 'Exclusivos',
      apply: (f) => ({ ...f, minPrice: '200', maxPrice: '' }),
      isActive: () => activeQuickFilter === 'premium',
    },
  ], [activeQuickFilter])

  const familyFilters = [
    { value: 'floral', label: 'Floral', icon: Flower2 },
    { value: 'amadeirado', label: 'Amadeirado', icon: TreePine },
    { value: 'citrico', label: 'Cítrico', icon: Citrus },
    { value: 'oriental', label: 'Oriental', icon: Moon },
    { value: 'aquatico', label: 'Aquático', icon: Waves },
    { value: 'frutado', label: 'Frutado', icon: Cherry },
    { value: 'gourmand', label: 'Gourmand', icon: Cake },
  ]

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'default', label: 'Padrão' },
    { value: 'price_asc', label: 'Menor preço' },
    { value: 'price_desc', label: 'Maior preço' },
    { value: 'newest', label: 'Mais recentes' },
    { value: 'best_sellers', label: 'Mais vendidos' },
  ]

  // ── Filter + Sort + Paginate ─────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let result = products
    if (showWishlist) result = result.filter((p) => favorites.includes(p.id))
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase().trim()
      result = result.filter((p) =>
        [p.name, p.brand, p.olfactiveFamily].join(' ').toLowerCase().includes(term)
      )
    }
    if (filters.gender !== 'todos') result = result.filter((p) => p.category.toLowerCase() === filters.gender)
    if (filters.family !== 'todos') {
      result = result.filter((p) =>
        p.olfactiveFamily ? p.olfactiveFamily.toLowerCase().split(',').includes(filters.family.toLowerCase()) : false
      )
    }
    if (filters.concentration !== 'todos') result = result.filter((p) => p.concentration === filters.concentration)
    const min = filters.minPrice !== '' ? Number(filters.minPrice) : 0
    const max = filters.maxPrice !== '' ? Number(filters.maxPrice) : Infinity
    result = result.filter((p) => p.price >= min && p.price <= max)
    if (filters.onSale) result = result.filter((p) => p.originalPrice && p.originalPrice > p.price)
    result = [...result]
    if (sortKey === 'price_asc') result.sort((a, b) => a.price - b.price)
    else if (sortKey === 'price_desc') result.sort((a, b) => b.price - a.price)
    else if (sortKey === 'newest') result.sort((a, b) => b.id.localeCompare(a.id))
    else if (sortKey === 'best_sellers') result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    return result
  }, [products, filters, debouncedSearch, sortKey, showWishlist, favorites])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((safePage - 1) * PRODUCTS_PER_PAGE, safePage * PRODUCTS_PER_PAGE),
    [filteredProducts, safePage]
  )

  // ── Favoritos ────────────────────────────────────────────────────────────────
  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
      saveFavorites(next)
      return next
    })
  }, [])

  // ── Compartilhar — funciona no desktop (clipboard) e mobile (share nativo) ──
  const handleShare = useCallback(async (productId: string) => {
    const url = buildShareUrl(productId)

    // navigator.share é confiável apenas em mobile.
    // No desktop Chrome/Firefox mostra erro "Não foi possível compartilhar".
    const isMobile = /Mobi|Android|iPhone|iPad|IEMobile|Opera Mini/i.test(navigator.userAgent)

    if (isMobile && navigator.share) {
      try {
        await navigator.share({ url, title: 'Fausto Importados' })
        return
      } catch {
        // Usuário cancelou — não fazer nada
        return
      }
    }

    // Desktop: sempre copia o link direto para a área de transferência
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback para HTTP ou navegadores antigos sem clipboard API
      const input = document.createElement('input')
      input.value = url
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.focus()
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setCopiedId(productId)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  // ── Cart handlers ────────────────────────────────────────────────────────────
  const handleAddToCart = (product: Product) => { addToCart(product); setCart(getCart()) }
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    updateCartQuantity(productId, quantity); setCart(getCart())
  }
  const handleRemoveFromCart = (productId: string) => { removeFromCart(productId); setCart(getCart()) }
  const handleClearCart = () => { clearCart(); setCart([]) }
  const cartCount = getCartCount(cart)

  // ── Misc ────────────────────────────────────────────────────────────────────
  const resetFilters = useCallback(() => {
    setFilters({ gender: 'todos', family: 'todos', concentration: 'todos', minPrice: '', maxPrice: '', onSale: false })
    setActiveQuickFilter(null)
    setSearchTerm('')
    setSortKey('default')
    setShowWishlist(false)
  }, [])

  const handleQuickFilter = useCallback((filter: QuickFilter) => {
    if (activeQuickFilter === filter.id) { resetFilters() }
    else { setActiveQuickFilter(filter.id); setFilters((prev) => filter.apply(prev)) }
  }, [activeQuickFilter, resetFilters])

  const hasActiveFilters = useMemo(() =>
    filters.gender !== 'todos' || filters.family !== 'todos' || filters.concentration !== 'todos'
    || filters.minPrice !== '' || filters.maxPrice !== '' || filters.onSale || showWishlist,
    [filters, showWishlist])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.gender !== 'todos') count++
    if (filters.family !== 'todos') count++
    if (filters.concentration !== 'todos') count++
    if (filters.minPrice !== '' || filters.maxPrice !== '') count++
    if (filters.onSale) count++
    if (showWishlist) count++
    return count
  }, [filters, showWishlist])

  const scrollToCollection = () => {
    collectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const paginationPages = useMemo(() => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safePage > 3) pages.push('...')
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i)
      if (safePage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, safePage])

  const from = (safePage - 1) * PRODUCTS_PER_PAGE + 1
  const to = Math.min(safePage * PRODUCTS_PER_PAGE, filteredProducts.length)

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
        <div className="hidden border-b border-border/30 bg-foreground text-background md:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs tracking-wide">
            <span className="opacity-80">Fragrâncias 100% Originais</span>
            <span className="opacity-80">Parcele em até 12x</span>
          </div>
        </div>
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
                    {(['feminino', 'masculino', 'unissex'] as GenderFilter[]).map((g) => (
                      <button key={g} onClick={() => { setFilters((prev) => ({ ...prev, gender: g })); setActiveQuickFilter(null); scrollToCollection(); setIsMobileMenuOpen(false) }}
                        className={cn('rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors capitalize', filters.gender === g ? 'bg-foreground text-background' : 'hover:bg-muted')}>
                        {g}
                      </button>
                    ))}
                    <button onClick={() => { setFilters((prev) => ({ ...prev, onSale: !prev.onSale })); setActiveQuickFilter(null); scrollToCollection(); setIsMobileMenuOpen(false) }}
                      className={cn('rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors', filters.onSale ? 'bg-foreground text-background' : 'hover:bg-muted')}>
                      Promoções
                    </button>
                    <button onClick={() => { setShowWishlist((v) => !v); scrollToCollection(); setIsMobileMenuOpen(false) }}
                      className={cn('flex items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors', showWishlist ? 'bg-foreground text-background' : 'hover:bg-muted')}>
                      <Heart className="h-4 w-4" />
                      Favoritos
                      {favorites.length > 0 && <span className="ml-auto text-xs opacity-70">{favorites.length}</span>}
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
                {(['feminino', 'masculino', 'unissex'] as GenderFilter[]).map((g) => (
                  <button key={g} onClick={() => { setFilters((prev) => ({ ...prev, gender: g })); setActiveQuickFilter(null); scrollToCollection() }}
                    className={cn('rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 capitalize', filters.gender === g ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                    {g}
                  </button>
                ))}
                <button onClick={() => { setFilters((prev) => ({ ...prev, onSale: !prev.onSale })); setActiveQuickFilter(null); scrollToCollection() }}
                  className={cn('rounded-full px-4 py-2 text-sm font-medium transition-all duration-200', filters.onSale ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                  Promoções
                </button>
              </nav>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button onClick={() => { setShowWishlist((v) => !v); scrollToCollection() }}
                className={cn('relative flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200', showWishlist ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:border-foreground/50 hover:bg-muted')}
                title="Minha lista de favoritos">
                <Heart className={cn('h-4 w-4', showWishlist && 'fill-current')} />
                {favorites.length > 0 && <span className="text-xs">{favorites.length}</span>}
              </button>
              <button onClick={() => setIsCartOpen(true)}
                className={cn('group relative flex items-center gap-2 rounded-full border px-3 py-2 transition-all duration-300', cartCount > 0 ? 'border-foreground bg-foreground text-background shadow-lg hover:shadow-xl hover:scale-[1.02]' : 'border-border bg-transparent text-foreground hover:border-foreground/50 hover:bg-muted')}>
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

      {/* ── Hero ── */}
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
            <span className="relative mx-3 inline-block font-serif italic">
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
              const isActive = activeQuickFilter === filter.id
              return (
                <button key={filter.id} onClick={() => { handleQuickFilter(filter); scrollToCollection() }}
                  className={cn('group relative flex items-center gap-2.5 overflow-hidden rounded-full border px-6 py-3 text-sm font-medium transition-all duration-300', isActive ? 'border-foreground bg-foreground text-background shadow-lg' : 'border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:border-foreground/40 hover:bg-background hover:shadow-md')}>
                  <Icon className={cn('h-4 w-4 transition-all duration-300 group-hover:scale-110', isActive ? 'text-background' : 'text-muted-foreground group-hover:text-foreground')} />
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

      {/* ── Products Section ── */}
      <section ref={collectionRef} className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col gap-8">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="text-3xl font-light tracking-tight text-foreground md:text-4xl">
                  {showWishlist ? 'Meus Favoritos' : 'Nossa Coleção'}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {filteredProducts.length} fragrância{filteredProducts.length !== 1 ? 's' : ''}{' '}
                  {showWishlist ? 'salva' : 'selecionada'}{filteredProducts.length !== 1 ? 's' : ''}
                  {totalPages > 1 && ` · página ${safePage} de ${totalPages}`}
                </p>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={resetFilters}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Limpar filtros
                  {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>}
                </Button>
              )}
            </div>

            {/* Search + Sort + Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-48 pl-9 pr-8 rounded-2xl sm:w-64" />
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-muted-foreground" /></div>
                {searchTerm && (
                  <button type="button" onClick={() => setSearchTerm('')} className="absolute inset-y-1 right-1 flex items-center justify-center w-7 h-7 rounded-full bg-muted hover:bg-muted/80">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <button onClick={() => setShowWishlist((v) => !v)}
                className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200', showWishlist ? 'border-foreground bg-foreground text-background' : 'border-border bg-transparent text-foreground hover:border-foreground/50')}>
                <Heart className={cn('h-3.5 w-3.5', showWishlist && 'fill-current')} />
                Favoritos
                {favorites.length > 0 && <span className="text-xs opacity-70">({favorites.length})</span>}
              </button>

              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all', sortKey !== 'default' ? 'border-foreground bg-foreground text-background' : 'border-border bg-transparent text-foreground hover:border-foreground/50')}>
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                    {sortOptions.find((s) => s.value === sortKey)?.label ?? 'Ordenar'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1.5" align="start">
                  {sortOptions.map((opt) => (
                    <button key={opt.value} onClick={() => setSortKey(opt.value)}
                      className={cn('w-full rounded-lg px-3 py-2 text-left text-sm transition-colors flex items-center gap-2', sortKey === opt.value ? 'bg-foreground text-background' : 'hover:bg-muted')}>
                      {sortKey === opt.value && <Check className="h-3.5 w-3.5 shrink-0" />}
                      {opt.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all', filters.gender !== 'todos' ? 'border-foreground bg-foreground text-background' : 'border-border bg-transparent text-foreground hover:border-foreground/50')}>
                    {filters.gender === 'todos' ? 'Gênero' : filters.gender.charAt(0).toUpperCase() + filters.gender.slice(1)}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1.5" align="start">
                  <Command><CommandList><CommandGroup>
                    {[{ value: 'todos', label: 'Todos' }, { value: 'feminino', label: 'Feminino' }, { value: 'masculino', label: 'Masculino' }, { value: 'unissex', label: 'Unissex' }].map((option) => (
                      <CommandItem key={option.value} onSelect={() => { setFilters((prev) => ({ ...prev, gender: option.value as GenderFilter })); setActiveQuickFilter(null) }} className="gap-2 rounded-lg">
                        <Check className={cn('h-4 w-4', filters.gender === option.value ? 'opacity-100' : 'opacity-0')} />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup></CommandList></Command>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all', filters.family !== 'todos' ? 'border-foreground bg-foreground text-background' : 'border-border bg-transparent text-foreground hover:border-foreground/50')}>
                    {filters.family === 'todos' ? 'Família Olfativa' : familyFilters.find((f) => f.value === filters.family)?.label}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1.5" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>Nenhuma encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setFilters((prev) => ({ ...prev, family: 'todos' })); setActiveQuickFilter(null) }} className="gap-2 rounded-lg">
                          <Check className={cn('h-4 w-4', filters.family === 'todos' ? 'opacity-100' : 'opacity-0')} />
                          Todas as famílias
                        </CommandItem>
                        <CommandSeparator className="my-1" />
                        {familyFilters.map((family) => {
                          const Icon = family.icon
                          return (
                            <CommandItem key={family.value} onSelect={() => { setFilters((prev) => ({ ...prev, family: family.value as OlfativeFamily })); setActiveQuickFilter(null) }} className="gap-2 rounded-lg">
                              <Check className={cn('h-4 w-4', filters.family === family.value ? 'opacity-100' : 'opacity-0')} />
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              {family.label}
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all', filters.minPrice !== '' || filters.maxPrice !== '' ? 'border-foreground bg-foreground text-background' : 'border-border bg-transparent text-foreground hover:border-foreground/50')}>
                    {filters.minPrice === '' && filters.maxPrice === '' ? 'Preço' : `R$ ${filters.minPrice || '0'} — R$ ${filters.maxPrice || '∞'}`}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4" align="start">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Faixa de Preço</span>
                      <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setFilters((prev) => ({ ...prev, minPrice: '', maxPrice: '' })); setActiveQuickFilter(null) }}>Limpar</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Mínimo</label>
                        <input type="number" placeholder="0" value={filters.minPrice} onChange={(e) => { setFilters((prev) => ({ ...prev, minPrice: e.target.value })); setActiveQuickFilter(null) }} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                      <span className="text-muted-foreground mt-5">—</span>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Máximo</label>
                        <input type="number" placeholder="∞" value={filters.maxPrice} onChange={(e) => { setFilters((prev) => ({ ...prev, maxPrice: e.target.value })); setActiveQuickFilter(null) }} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Active Filter Tags */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                {showWishlist && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">♥ Favoritos<button onClick={() => setShowWishlist(false)} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
                {filters.gender !== 'todos' && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">{filters.gender.charAt(0).toUpperCase() + filters.gender.slice(1)}<button onClick={() => setFilters((prev) => ({ ...prev, gender: 'todos' }))} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
                {filters.family !== 'todos' && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">{familyFilters.find((f) => f.value === filters.family)?.label}<button onClick={() => setFilters((prev) => ({ ...prev, family: 'todos' }))} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
                {filters.onSale && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">Promoções<button onClick={() => setFilters((prev) => ({ ...prev, onSale: false }))} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
                {(filters.minPrice !== '' || filters.maxPrice !== '') && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">R$ {filters.minPrice || '0'} — R$ {filters.maxPrice || '∞'}<button onClick={() => setFilters((prev) => ({ ...prev, minPrice: '', maxPrice: '' }))} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
              </div>
            )}
          </div>

          {/* Grid */}
          {paginatedProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {paginatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    isFavorite={favorites.includes(product.id)}
                    onToggleFavorite={toggleFavorite}
                    onShare={handleShare}
                    copiedId={copiedId}
                    highlight={highlightProductId === product.id}
                    onHighlightAck={() => setHighlightProductId(null)}
                  />
                ))}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="mt-12 flex flex-col items-center gap-3">
                  <p className="text-xs text-muted-foreground">Exibindo {from}–{to} de {filteredProducts.length} produtos</p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setCurrentPage((p) => Math.max(p - 1, 1)); scrollToCollection() }} disabled={safePage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {paginationPages.map((p, i) =>
                      p === '...' ? (
                        <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                      ) : (
                        <Button key={p} variant={p === safePage ? 'default' : 'ghost'} size="icon" className="text-xs" onClick={() => { setCurrentPage(p as number); scrollToCollection() }}>{p}</Button>
                      )
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { setCurrentPage((p) => Math.min(p + 1, totalPages)); scrollToCollection() }} disabled={safePage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
                {showWishlist ? <Heart className="h-8 w-8 text-muted-foreground" /> : <Sparkles className="h-8 w-8 text-muted-foreground" />}
              </div>
              <h3 className="text-xl font-medium">{showWishlist ? 'Nenhum favorito ainda' : 'Nenhuma fragrância encontrada'}</h3>
              <p className="mt-2 max-w-sm text-muted-foreground">{showWishlist ? 'Clique no ♥ em qualquer produto para salvá-lo aqui.' : 'Ajuste os filtros para descobrir perfumes que combinam com você.'}</p>
              <Button variant="outline" className="mt-8 rounded-full bg-transparent px-6" onClick={resetFilters}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {showWishlist ? 'Ver todos os produtos' : 'Remover filtros'}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-linear-to-b from-background to-muted/30 px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <div className="col-span-2 lg:col-span-1">
              <a href="/"><span className="font-serif text-2xl font-medium tracking-tight">Fausto</span><span className="block text-[10px] uppercase tracking-[0.35em] text-muted-foreground mt-0.5">Importados</span></a>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">Curadoria de fragrâncias importadas 100% originais. Autenticidade garantida desde 2024.</p>
              <div className="mt-6 flex gap-3">
                <a href="https://www.instagram.com/faustoimportados/" className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted" target="_blank" rel="noopener noreferrer" title="Instagram">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                </a>
                <a href="https://wa.me/5585996375030" className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted" target="_blank" rel="noopener noreferrer" title="WhatsApp">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.52 3.48A11.75 11.75 0 0012.01 0C5.39 0 .01 5.38 0 12c0 2.11.55 4.17 1.6 5.99L0 24l6.18-1.62A11.93 11.93 0 0012.01 24c6.62 0 12-5.38 12-12 0-3.2-1.25-6.21-3.49-8.52zM12 21.82c-1.85 0-3.66-.5-5.23-1.45l-.37-.22-3.67.96.98-3.58-.24-.37A9.77 9.77 0 012.2 12C2.2 6.6 6.6 2.2 12 2.2c2.62 0 5.09 1.02 6.95 2.88A9.77 9.77 0 0121.8 12c0 5.4-4.4 9.82-9.8 9.82zm5.39-7.36c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.46-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.11 3.22 5.12 4.52.72.31 1.28.5 1.72.64.72.23 1.37.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" /></svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider">Navegue</h4>
              <nav className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
                {(['feminino', 'masculino', 'unissex'] as GenderFilter[]).map((g) => (
                  <button key={g} onClick={() => { setFilters((prev) => ({ ...prev, gender: g })); setActiveQuickFilter(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-left capitalize transition-colors hover:text-foreground">{g}</button>
                ))}
              </nav>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider">Atendimento</h4>
              <div className="mt-6 space-y-4 text-sm">
                <div><p className="font-medium">WhatsApp</p><a href="https://wa.me/5585996375030" target="_blank" className="text-muted-foreground">(85) 99637-5030</a></div>
                <div><p className="font-medium">Horário</p><p className="text-muted-foreground">Seg - Dom: 7h às 22h</p></div>
              </div>
            </div>
          </div>
          <Separator className="my-12" />
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-xs text-muted-foreground">© 2026 Fausto Importados. Todos os direitos reservados.</p>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <a href="/termos" className="transition-colors hover:text-foreground">Termos de Uso</a>
              <a href="/privacidade" className="transition-colors hover:text-foreground">Privacidade</a>
              <a href="/cookies" className="transition-colors hover:text-foreground">Cookies</a>
            </div>
          </div>
        </div>
      </footer>

      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemove={handleRemoveFromCart}
        onClear={handleClearCart}
        stockChangedIds={stockChangedIds}
        onStockChangedAck={() => setStockChangedIds([])}
      />
    </div>
  )
}