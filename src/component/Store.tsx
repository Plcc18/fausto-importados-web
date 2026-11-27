'use client'

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
  Sparkles, Gift, Star, Flower2, TreePine, Citrus, Moon,
  Waves, Cherry, Cake, X, Check, ChevronDown, RotateCcw, Search,
  Heart, ArrowUpDown, ChevronLeft, ChevronRight, Leaf, Wind, Shield, Gem,
} from 'lucide-react'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/Shadcn-Components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from '@/Shadcn-Components/ui/command'
import { useCartReconciliation } from "@/lib/useCartReconciliation"
import { useDebounce } from "@/lib/useDebounce"
import { useProducts } from "@/lib/useProducts"
import { CatalogSkeleton, CatalogError, CatalogCacheNotice } from "./CatalogStates"
import { StoreHeader } from "./StoreHeader"
import { StoreHero } from "./StoreHero"
import { CampaignCollections } from "./CampaignCollections"
import { CampaignPromoImages } from "./CampaignPromoImages"
import { useSearchParams } from "react-router-dom"
import { useActiveCampaign } from "@/lib/campaign/useActiveCampaign"
import { campaignBadgeLabel, campaignProductIds, resolveCollections } from "@/lib/campaign/collections"

import type { Filters, GenderFilter, OlfativeFamily, QuickFilter, SortKey } from './storeTypes'

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
  const { products, status: productsStatus, isFromCache, refreshFailed, errorCode, retry: retryProducts } = useProducts()
  const [cart, setCart] = useState<CartItem[]>(getCart)

  // ── Campanha: coleções, selo e ?colecao= (T24) ──────────────────────────────
  // Os produtos das coleções vêm do catálogo já carregado (só os IDs vêm da campanha): nenhuma requisição a mais
  const { campaign } = useActiveCampaign()
  const [searchParams, setSearchParams] = useSearchParams()
  const collectionSlug = searchParams.get('colecao')
  const collections = useMemo(() => resolveCollections(campaign, products), [campaign, products])
  // Coleção que não existe (ou de uma campanha que já terminou) não filtra nada
  const activeCollection = useMemo(
    () => (collectionSlug ? collections.find((c) => c.slug === collectionSlug) ?? null : null),
    [collections, collectionSlug]
  )
  // Selo só nos produtos das coleções que estão de fato na tela
  const participantIds = useMemo(() => campaignProductIds(collections), [collections])
  const campaignBadge = campaign ? campaignBadgeLabel(campaign.type) : null
  // Abrir ou tirar uma coleção é uma navegação (o "voltar" a desfaz). Sem mudança, nada: "Limpar filtros" sem
  // coleção aberta não cria entradas repetidas no histórico. Um `?colecao=` que não existe (campanha que já
  // terminou) não filtra nem aparece; o "compartilhar" do produto já monta o link sem os parâmetros da vitrine.
  const setCollection = useCallback((slug: string | null) => {
    if (slug === collectionSlug) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (slug) next.set('colecao', slug)
      else next.delete('colecao')
      return next
    })
  }, [setSearchParams, collectionSlug])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [stockChangedIds, setStockChangedIds] = useState<string[]>([])
  const ackStockChanged = useCallback(() => setStockChangedIds([]), [])

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

  const [highlightProductId, setHighlightProductId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('produto')
  })
  const ackHighlight = useCallback(() => setHighlightProductId(null), [])

  // Destino de "Explorar fragrâncias" (página 404): /#colecao rola até a vitrine
  useEffect(() => {
    if (window.location.hash !== '#colecao') return
    const scrollToCollection = () => collectionRef.current?.scrollIntoView()
    scrollToCollection()
    // As imagens do hero ainda empurram o layout: repete quando tudo terminar de carregar
    if (document.readyState === 'complete') return
    window.addEventListener('load', scrollToCollection, { once: true })
    return () => window.removeEventListener('load', scrollToCollection)
  }, [])

  // Volta para a página 1 sempre que um filtro mudar (ajuste de estado durante a
  // renderização, evitando um efeito só para sincronizar estado interno)
  const [prevPageFilters, setPrevPageFilters] = useState({ debouncedSearch, filters, sortKey, showWishlist, collectionSlug })
  if (
    prevPageFilters.debouncedSearch !== debouncedSearch ||
    prevPageFilters.filters !== filters ||
    prevPageFilters.sortKey !== sortKey ||
    prevPageFilters.showWishlist !== showWishlist ||
    prevPageFilters.collectionSlug !== collectionSlug
  ) {
    setPrevPageFilters({ debouncedSearch, filters, sortKey, showWishlist, collectionSlug })
    setCurrentPage(1)
  }

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
    { value: 'aromatico', label: 'Aromático', icon: Leaf },
    { value: 'fougere', label: 'Fougère', icon: Wind },
    { value: 'chipre', label: 'Chipre', icon: Shield },
    { value: 'couro', label: 'Couro', icon: Gem },
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
    // ?colecao=: só os produtos da coleção, combinável com a busca e os demais filtros
    const collectionOrder = activeCollection ? new Map(activeCollection.products.map((p, i) => [p.id, i])) : null
    if (collectionOrder) result = result.filter((p) => collectionOrder.has(p.id))
    result = [...result]
    // Sem outra ordenação escolhida, vale a ordem definida na campanha
    if (sortKey === 'default' && collectionOrder) result.sort((a, b) => collectionOrder.get(a.id)! - collectionOrder.get(b.id)!)
    else if (sortKey === 'price_asc') result.sort((a, b) => a.price - b.price)
    else if (sortKey === 'price_desc') result.sort((a, b) => b.price - a.price)
    else if (sortKey === 'newest') result.sort((a, b) => b.id.localeCompare(a.id))
    else if (sortKey === 'best_sellers') result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    return result
  }, [products, filters, debouncedSearch, sortKey, showWishlist, favorites, activeCollection])

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

  /** "Limpar filtros" / "Remover filtros": também tira a coleção (desligar um filtro rápido não tira). */
  const clearAllFilters = useCallback(() => {
    resetFilters()
    setCollection(null)
  }, [resetFilters, setCollection])

  const handleQuickFilter = useCallback((filter: QuickFilter) => {
    if (activeQuickFilter === filter.id) { resetFilters() }
    else { setActiveQuickFilter(filter.id); setFilters((prev) => filter.apply(prev)) }
  }, [activeQuickFilter, resetFilters])

  const hasActiveFilters = useMemo(() =>
    filters.gender !== 'todos' || filters.family !== 'todos' || filters.concentration !== 'todos'
    || filters.minPrice !== '' || filters.maxPrice !== '' || filters.onSale || showWishlist || activeCollection !== null,
    [filters, showWishlist, activeCollection])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.gender !== 'todos') count++
    if (filters.family !== 'todos') count++
    if (filters.concentration !== 'todos') count++
    if (filters.minPrice !== '' || filters.maxPrice !== '') count++
    if (filters.onSale) count++
    if (showWishlist) count++
    if (activeCollection) count++
    return count
  }, [filters, showWishlist, activeCollection])

  const scrollToCollection = () => {
    collectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Rolagens automáticas não podem puxar a página de quem já começou a ler (a campanha e o catálogo podem chegar
  // até ~1 min depois, com a API acordando): depois do primeiro gesto da pessoa, só o clique dela rola
  const userInteracted = useRef(false)
  useEffect(() => {
    const mark = () => { userInteracted.current = true }
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    events.forEach((event) => window.addEventListener(event, mark, { once: true, passive: true }))
    return () => events.forEach((event) => window.removeEventListener(event, mark))
  }, [])

  // Ao abrir uma coleção, leva até a vitrine já filtrada. A do endereço de chegada pode só existir quando a
  // campanha e o catálogo chegarem: se a pessoa já mexeu na página até lá, não rola
  const activeCollectionSlug = activeCollection?.slug ?? null
  const landingCollection = useRef({ slug: collectionSlug, handled: false })
  useEffect(() => {
    if (!activeCollectionSlug) return
    const landing = landingCollection.current
    if (!landing.handled && activeCollectionSlug === landing.slug) {
      landing.handled = true
      if (userInteracted.current) return
    }
    collectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeCollectionSlug])

  // Com `/#colecao`, as seções da campanha podem aparecer acima da vitrine depois da rolagem inicial: rola de
  // novo uma vez, se a pessoa ainda não mexeu na página
  const hasCampaignSections = collections.length > 0 || (campaign?.content.promoImages.length ?? 0) > 0
  const sectionsScrollDone = useRef(false)
  useEffect(() => {
    if (!hasCampaignSections || sectionsScrollDone.current) return
    sectionsScrollDone.current = true
    if (window.location.hash === '#colecao' && !userInteracted.current) collectionRef.current?.scrollIntoView()
  }, [hasCampaignSections])

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

  // Skeleton enquanto não há dados. Com cache ainda não confirmado pela API, um
  // resultado vazio pode ser só dado velho: nunca vira "Nenhuma fragrância
  // encontrada" (essa mensagem só vale após a API responder) — fica carregando,
  // ou em erro se a atualização falhou.
  const emptyFromUnconfirmedCache = productsStatus === 'success' && isFromCache && filteredProducts.length === 0
  const showCatalogSkeleton = productsStatus === 'loading' || (emptyFromUnconfirmedCache && !refreshFailed)
  const showCatalogError = productsStatus === 'error' || (emptyFromUnconfirmedCache && refreshFailed)

  const from = (safePage - 1) * PRODUCTS_PER_PAGE + 1
  const to = Math.min(safePage * PRODUCTS_PER_PAGE, filteredProducts.length)

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader
        gender={filters.gender}
        onSale={filters.onSale}
        showWishlist={showWishlist}
        favoritesCount={favorites.length}
        cartCount={cartCount}
        onSelectGender={(g) => { setFilters((prev) => ({ ...prev, gender: g })); setActiveQuickFilter(null); scrollToCollection() }}
        onToggleSale={() => { setFilters((prev) => ({ ...prev, onSale: !prev.onSale })); setActiveQuickFilter(null); scrollToCollection() }}
        onToggleWishlist={() => { setShowWishlist((v) => !v); scrollToCollection() }}
        onOpenCart={() => setIsCartOpen(true)}
      />

      <StoreHero
        quickFilters={quickFilters}
        activeQuickFilterId={activeQuickFilter}
        onQuickFilter={(filter) => { handleQuickFilter(filter); scrollToCollection() }}
      />

      {/* Logo abaixo do banner e dos filtros rápidos: lê como continuação do banner */}
      <CampaignPromoImages promoImages={campaign?.content.promoImages ?? []} />
      <CampaignCollections
        collections={collections}
        // "Ver todos (N)" mostra exatamente a coleção: os outros filtros e a busca saem
        onShowAll={(slug) => { resetFilters(); setCollection(slug); scrollToCollection() }}
        renderProduct={(product) => (
          <ProductCard
            product={product}
            onAddToCart={handleAddToCart}
            isFavorite={favorites.includes(product.id)}
            onToggleFavorite={toggleFavorite}
            onShare={handleShare}
            copiedId={copiedId}
            campaignBadge={campaignBadge}
          />
        )}
      />

      {/* ── Products Section ── */}
      <section id="colecao" ref={collectionRef} className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col gap-8">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="text-3xl font-light tracking-tight text-foreground md:text-4xl">
                  {showWishlist ? 'Meus Favoritos' : 'Nossa Coleção'}
                </h2>
                <p className="mt-2 min-h-6 text-muted-foreground">
                  {productsStatus === 'success' && (<>
                    {filteredProducts.length} fragrância{filteredProducts.length !== 1 ? 's' : ''}{' '}
                    {showWishlist ? 'salva' : 'selecionada'}{filteredProducts.length !== 1 ? 's' : ''}
                    {totalPages > 1 && ` · página ${safePage} de ${totalPages}`}
                  </>)}
                </p>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={clearAllFilters}>
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
                className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200', showWishlist ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-foreground hover:border-primary/50')}>
                <Heart className={cn('h-3.5 w-3.5', showWishlist && 'fill-current')} />
                Favoritos
                {favorites.length > 0 && <span className="text-xs opacity-70">({favorites.length})</span>}
              </button>

              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all', sortKey !== 'default' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-foreground hover:border-primary/50')}>
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                    {sortOptions.find((s) => s.value === sortKey)?.label ?? 'Ordenar'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1.5" align="start">
                  {sortOptions.map((opt) => (
                    <button key={opt.value} onClick={() => setSortKey(opt.value)}
                      className={cn('w-full rounded-lg px-3 py-2 text-left text-sm transition-colors flex items-center gap-2', sortKey === opt.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                      {sortKey === opt.value && <Check className="h-3.5 w-3.5 shrink-0" />}
                      {opt.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all', filters.gender !== 'todos' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-foreground hover:border-primary/50')}>
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
                  <button className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all', filters.family !== 'todos' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-foreground hover:border-primary/50')}>
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
                  <button className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all', filters.minPrice !== '' || filters.maxPrice !== '' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-foreground hover:border-primary/50')}>
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
                {activeCollection && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">Coleção: {activeCollection.title}<button onClick={() => setCollection(null)} aria-label="Remover filtro de coleção" className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
                {showWishlist && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">♥ Favoritos<button onClick={() => setShowWishlist(false)} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
                {filters.gender !== 'todos' && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">{filters.gender.charAt(0).toUpperCase() + filters.gender.slice(1)}<button onClick={() => setFilters((prev) => ({ ...prev, gender: 'todos' }))} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
                {filters.family !== 'todos' && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">{familyFilters.find((f) => f.value === filters.family)?.label}<button onClick={() => setFilters((prev) => ({ ...prev, family: 'todos' }))} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
                {filters.onSale && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">Promoções<button onClick={() => setFilters((prev) => ({ ...prev, onSale: false }))} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
                {(filters.minPrice !== '' || filters.maxPrice !== '') && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">R$ {filters.minPrice || '0'} — R$ {filters.maxPrice || '∞'}<button onClick={() => setFilters((prev) => ({ ...prev, minPrice: '', maxPrice: '' }))} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button></Badge>}
              </div>
            )}
          </div>

          {/* Grid */}
          {showCatalogSkeleton ? (
            <CatalogSkeleton count={PRODUCTS_PER_PAGE} />
          ) : showCatalogError ? (
            <CatalogError code={errorCode ?? 'connection'} onRetry={retryProducts} />
          ) : paginatedProducts.length > 0 ? (
            <>
              {isFromCache && <CatalogCacheNotice refreshFailed={refreshFailed} onRetry={retryProducts} />}
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
                    onHighlightAck={ackHighlight}
                    campaignBadge={participantIds.has(product.id) ? campaignBadge : null}
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
              <Button variant="outline" className="mt-8 rounded-full bg-transparent px-6" onClick={clearAllFilters}>
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
        onStockChangedAck={ackStockChanged}
      />
    </div>
  )
}