'use client'

import React from "react"

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Product, CartItem } from '@/lib/types'
import {
  getProducts,
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
} from '@/lib/store'
import { ProductCard } from './ProductCard'
import { Cart } from './Cart'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  ShoppingBag,
  Sparkles,
  Gift,
  Star,
  Flower2,
  TreePine,
  Citrus,
  Moon,
  Waves,
  Cherry,
  Cake,
  X,
  Check,
  ChevronDown,
  RotateCcw,
  Menu,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Slider } from '@/components/ui/slider'

type GenderFilter = 'todos' | 'feminino' | 'masculino' | 'unissex'
type OlfativeFamily =
  | 'todos'
  | 'floral'
  | 'amadeirado'
  | 'citrico'
  | 'oriental'
  | 'aquatico'
  | 'frutado'
  | 'gourmand'
type Concentration = 'todos' | 'edt' | 'edp' | 'parfum' | 'extrait'

interface Filters {
  gender: GenderFilter
  family: OlfativeFamily
  concentration: Concentration
  priceRange: [number, number]
}

interface QuickFilter {
  id: string
  label: string
  icon: React.ElementType
  description: string
  apply: (filters: Filters) => Filters
  isActive: (filters: Filters) => boolean
}

const MAX_PRICE = 2500

export function Store() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    gender: 'todos',
    family: 'todos',
    concentration: 'todos',
    priceRange: [0, MAX_PRICE],
  })
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null)

  useEffect(() => {
    setProducts(getProducts())
    setCart(getCart())
  }, [])

  const quickFilters: QuickFilter[] = useMemo(
    () => [
      {
        id: 'lancamentos',
        label: 'Novidades',
        icon: Sparkles,
        description: 'Lançamentos recentes',
        apply: (f) => ({ ...f, gender: 'todos' as const, family: 'todos' as const }),
        isActive: () => activeQuickFilter === 'lancamentos',
      },
      {
        id: 'presentes',
        label: 'Presente',
        icon: Gift,
        description: 'Seleção especial',
        apply: (f) => ({ ...f, priceRange: [200, 800] as [number, number] }),
        isActive: () => activeQuickFilter === 'presentes',
      },
      {
        id: 'premium',
        label: 'Luxo',
        icon: Star,
        description: 'Exclusivos',
        apply: (f) => ({
          ...f,
          priceRange: [1000, MAX_PRICE] as [number, number],
        }),
        isActive: () => activeQuickFilter === 'premium',
      },
    ],
    [activeQuickFilter]
  )

  const familyFilters = [
    { value: 'floral', label: 'Floral', icon: Flower2 },
    { value: 'amadeirado', label: 'Amadeirado', icon: TreePine },
    { value: 'citrico', label: 'Cítrico', icon: Citrus },
    { value: 'oriental', label: 'Oriental', icon: Moon },
    { value: 'aquatico', label: 'Aquático', icon: Waves },
    { value: 'frutado', label: 'Frutado', icon: Cherry },
    { value: 'gourmand', label: 'Gourmand', icon: Cake },
  ]

  const concentrationOptions = [
    { value: 'todos', label: 'Todas' },
    { value: 'edt', label: 'EDT', description: 'Eau de Toilette' },
    { value: 'edp', label: 'EDP', description: 'Eau de Parfum' },
    { value: 'parfum', label: 'Parfum', description: 'Alta concentração' },
    { value: 'extrait', label: 'Extrait', description: 'Máxima concentração' },
  ]

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.inStock)

    if (filters.gender !== 'todos') {
      result = result.filter((p) => p.category === filters.gender)
    }

    if (filters.family !== 'todos') {
      result = result.filter((p: Product) => p.olfactiveFamily === filters.family)
    }

    if (filters.concentration !== 'todos') {
      result = result.filter((p: Product) => p.concentration === filters.concentration)
    }

    const [min, max] = filters.priceRange
    result = result.filter((p) => p.price >= min && p.price <= max)

    return result
  }, [products, filters])

  const handleAddToCart = (product: Product) => {
    addToCart(product)
    setCart(getCart())
  }

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    updateCartQuantity(productId, quantity)
    setCart(getCart())
  }

  const handleRemoveFromCart = (productId: string) => {
    removeFromCart(productId)
    setCart(getCart())
  }

  const handleClearCart = () => {
    clearCart()
    setCart([])
  }

  const cartCount = getCartCount(cart)

  const resetFilters = useCallback(() => {
    setFilters({
      gender: 'todos',
      family: 'todos',
      concentration: 'todos',
      priceRange: [0, MAX_PRICE],
    })
    setActiveQuickFilter(null)
  }, [])

  const handleQuickFilter = useCallback(
    (filter: QuickFilter) => {
      if (activeQuickFilter === filter.id) {
        resetFilters()
      } else {
        setActiveQuickFilter(filter.id)
        setFilters((prev) => filter.apply(prev))
      }
    },
    [activeQuickFilter, resetFilters]
  )

  const hasActiveFilters = useMemo(() => {
    return (
      filters.gender !== 'todos' ||
      filters.family !== 'todos' ||
      filters.concentration !== 'todos' ||
      filters.priceRange[0] !== 0 ||
      filters.priceRange[1] !== MAX_PRICE
    )
  }, [filters])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.gender !== 'todos') count++
    if (filters.family !== 'todos') count++
    if (filters.concentration !== 'todos') count++
    if (filters.priceRange[0] !== 0 || filters.priceRange[1] !== MAX_PRICE) count++
    return count
  }, [filters])

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sophisticated Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        {/* Top Bar */}
        <div className="hidden border-b border-border/30 bg-foreground text-background md:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs tracking-wide">
            <span className="opacity-80">Fragrâncias 100% Originais</span>
            <span className="font-medium">Frete Grátis acima de R$ 300</span>
            <span className="opacity-80">Parcele em até 12x</span>
          </div>
        </div>

        {/* Main Header */}
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex h-16 items-center justify-between gap-4 md:h-20">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-0">
                <div className="flex flex-col">
                  <div className="border-b border-border p-6">
                    <h2 className="font-serif text-xl tracking-tight">Fausto</h2>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Importados</p>
                  </div>
                  <nav className="flex flex-col p-4">
                    <button
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, gender: 'feminino' }))
                        setActiveQuickFilter(null)
                      }}
                      className={cn(
                        'rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors',
                        filters.gender === 'feminino'
                          ? 'bg-foreground text-background'
                          : 'hover:bg-muted'
                      )}
                    >
                      Feminino
                    </button>
                    <button
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, gender: 'masculino' }))
                        setActiveQuickFilter(null)
                      }}
                      className={cn(
                        'rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors',
                        filters.gender === 'masculino'
                          ? 'bg-foreground text-background'
                          : 'hover:bg-muted'
                      )}
                    >
                      Masculino
                    </button>
                    <button
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, gender: 'unissex' }))
                        setActiveQuickFilter(null)
                      }}
                      className={cn(
                        'rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors',
                        filters.gender === 'unissex'
                          ? 'bg-foreground text-background'
                          : 'hover:bg-muted'
                      )}
                    >
                      Unissex
                    </button>

                    <button
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, priceRange: [0, 500] as [number, number] }))
                        setActiveQuickFilter(null)
                      }}
                      className="rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted"
                    >
                      Promoções
                    </button>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <div className="flex items-center gap-8">
              <a href="/" className="group flex flex-col items-center transition-opacity hover:opacity-80 md:items-start">
                <span className="font-serif text-2xl font-medium tracking-tight md:text-3xl">Fausto</span>
                <span className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground md:text-xs md:tracking-[0.4em]">
                  Importados
                </span>
              </a>

              {/* Desktop Navigation */}
              <nav className="hidden items-center gap-1 lg:flex">
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, gender: 'feminino' }))
                    setActiveQuickFilter(null)
                  }}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                    filters.gender === 'feminino'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  Feminino
                </button>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, gender: 'masculino' }))
                    setActiveQuickFilter(null)
                  }}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                    filters.gender === 'masculino'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  Masculino
                </button>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, gender: 'unissex' }))
                    setActiveQuickFilter(null)
                  }}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                    filters.gender === 'unissex'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  Unissex
                </button>
              </nav>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCartOpen(true)}
                className={cn(
                  'group relative flex items-center gap-2 rounded-full border px-3 py-2 transition-all duration-300',
                  cartCount > 0
                    ? 'border-foreground bg-foreground text-background shadow-lg hover:shadow-xl hover:scale-[1.02]'
                    : 'border-border bg-transparent text-foreground hover:border-foreground/50 hover:bg-muted'
                )}
              >
                <div className="relative">
                  <ShoppingBag className={cn(
                    'h-[18px] w-[18px] transition-transform duration-300',
                    cartCount > 0 ? 'group-hover:scale-110' : ''
                  )} />
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
                    <span className="hidden text-xs opacity-80 sm:block">
                      {cartCount === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                ) : (
                  <span className="hidden text-sm font-medium sm:block">Carrinho</span>
                )}
                
                {cartCount > 0 && (
                  <div className="hidden items-center gap-1 border-l border-background/30 pl-2 md:flex">
                    <span className="text-xs font-medium opacity-90">Ver</span>
                    <svg 
                      className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-muted/50 via-muted/30 to-background px-4 py-24 md:py-36">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMDA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium tracking-wide text-muted-foreground">
              2026 + Elegante
            </span>
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
          <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Curadoria exclusiva de fragrâncias importadas das maisons mais prestigiadas do mundo.
            Autenticidade certificada em cada frasco.
          </p>

          {/* Quick Filters as Hero CTAs */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {quickFilters.map((filter) => {
              const Icon = filter.icon
              const isActive = activeQuickFilter === filter.id
              return (
                <button
                  key={filter.id}
                  onClick={() => handleQuickFilter(filter)}
                  className={cn(
                    'group relative flex items-center gap-2.5 overflow-hidden rounded-full border px-6 py-3 text-sm font-medium transition-all duration-300',
                    isActive
                      ? 'border-foreground bg-foreground text-background shadow-lg'
                      : 'border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:border-foreground/40 hover:bg-background hover:shadow-md'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-all duration-300 group-hover:scale-110',
                      isActive ? 'text-background' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  {filter.label}
                  <span className="text-xs opacity-60">
                    {filter.description}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Trust Badges */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-muted-foreground">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                <Check className="h-4 w-4" />
              </div>
              <span>100% Original</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <span>Envio Seguro</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                <Star className="h-4 w-4" />
              </div>
              <span>+100 Clientes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          {/* Section Header with Filters */}
          <div className="mb-12 flex flex-col gap-8">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="text-3xl font-light tracking-tight text-foreground md:text-4xl">
                  Nossa Coleção
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {filteredProducts.length} fragrância{filteredProducts.length !== 1 ? 's' : ''}{' '}
                  selecionada{filteredProducts.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Reset Filter Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  onClick={resetFilters}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Limpar filtros
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              )}
            </div>

            {/* Elegant Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Gender Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all',
                      filters.gender !== 'todos'
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-transparent text-foreground hover:border-foreground/50'
                    )}
                  >
                    {filters.gender === 'todos'
                      ? 'Gênero'
                      : filters.gender.charAt(0).toUpperCase() + filters.gender.slice(1)}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1.5" align="start">
                  <Command>
                    <CommandList>
                      <CommandGroup>
                        {[
                          { value: 'todos', label: 'Todos' },
                          { value: 'feminino', label: 'Feminino' },
                          { value: 'masculino', label: 'Masculino' },
                          { value: 'unissex', label: 'Unissex' },
                        ].map((option) => (
                          <CommandItem
                            key={option.value}
                            onSelect={() => {
                              setFilters((prev) => ({
                                ...prev,
                                gender: option.value as GenderFilter,
                              }))
                              setActiveQuickFilter(null)
                            }}
                            className="gap-2 rounded-lg"
                          >
                            <Check
                              className={cn(
                                'h-4 w-4',
                                filters.gender === option.value ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Family Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all',
                      filters.family !== 'todos'
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-transparent text-foreground hover:border-foreground/50'
                    )}
                  >
                    {filters.family === 'todos'
                      ? 'Família Olfativa'
                      : familyFilters.find((f) => f.value === filters.family)?.label}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1.5" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>Nenhuma encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setFilters((prev) => ({ ...prev, family: 'todos' }))
                            setActiveQuickFilter(null)
                          }}
                          className="gap-2 rounded-lg"
                        >
                          <Check
                            className={cn(
                              'h-4 w-4',
                              filters.family === 'todos' ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          Todas as famílias
                        </CommandItem>
                        <CommandSeparator className="my-1" />
                        {familyFilters.map((family) => {
                          const Icon = family.icon
                          return (
                            <CommandItem
                              key={family.value}
                              onSelect={() => {
                                setFilters((prev) => ({
                                  ...prev,
                                  family: family.value as OlfativeFamily,
                                }))
                                setActiveQuickFilter(null)
                              }}
                              className="gap-2 rounded-lg"
                            >
                              <Check
                                className={cn(
                                  'h-4 w-4',
                                  filters.family === family.value ? 'opacity-100' : 'opacity-0'
                                )}
                              />
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

              {/* Concentration Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all',
                      filters.concentration !== 'todos'
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-transparent text-foreground hover:border-foreground/50'
                    )}
                  >
                    {filters.concentration === 'todos'
                      ? 'Concentração'
                      : concentrationOptions.find((c) => c.value === filters.concentration)?.label}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1.5" align="start">
                  <Command>
                    <CommandList>
                      <CommandGroup>
                        {concentrationOptions.map((option) => (
                          <CommandItem
                            key={option.value}
                            onSelect={() => {
                              setFilters((prev) => ({
                                ...prev,
                                concentration: option.value as Concentration,
                              }))
                              setActiveQuickFilter(null)
                            }}
                            className="gap-2 rounded-lg"
                          >
                            <Check
                              className={cn(
                                'h-4 w-4',
                                filters.concentration === option.value ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              {option.description && (
                                <span className="text-xs text-muted-foreground">
                                  {option.description}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Price Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all',
                      filters.priceRange[0] !== 0 || filters.priceRange[1] !== MAX_PRICE
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-transparent text-foreground hover:border-foreground/50'
                    )}
                  >
                    {filters.priceRange[0] === 0 && filters.priceRange[1] === MAX_PRICE
                      ? 'Preço'
                      : `${formatPrice(filters.priceRange[0])} - ${formatPrice(filters.priceRange[1])}`}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="start">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Faixa de Preço</span>
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setFilters((prev) => ({ ...prev, priceRange: [0, MAX_PRICE] }))
                          setActiveQuickFilter(null)
                        }}
                      >
                        Resetar
                      </button>
                    </div>
                    <Slider
                      value={filters.priceRange}
                      min={0}
                      max={MAX_PRICE}
                      step={50}
                      onValueChange={(value) => {
                        setFilters((prev) => ({
                          ...prev,
                          priceRange: value as [number, number],
                        }))
                        setActiveQuickFilter(null)
                      }}
                      className="py-4"
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className="rounded-lg bg-muted px-3 py-1.5 font-medium">
                        {formatPrice(filters.priceRange[0])}
                      </span>
                      <span className="text-muted-foreground">até</span>
                      <span className="rounded-lg bg-muted px-3 py-1.5 font-medium">
                        {formatPrice(filters.priceRange[1])}
                      </span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Active Filter Tags */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                {filters.gender !== 'todos' && (
                  <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">
                    {filters.gender.charAt(0).toUpperCase() + filters.gender.slice(1)}
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, gender: 'todos' }))}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.family !== 'todos' && (
                  <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">
                    {familyFilters.find((f) => f.value === filters.family)?.label}
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, family: 'todos' }))}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.concentration !== 'todos' && (
                  <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">
                    {concentrationOptions.find((c) => c.value === filters.concentration)?.label}
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, concentration: 'todos' }))}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {(filters.priceRange[0] !== 0 || filters.priceRange[1] !== MAX_PRICE) && (
                  <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">
                    {formatPrice(filters.priceRange[0])} - {formatPrice(filters.priceRange[1])}
                    <button
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, priceRange: [0, MAX_PRICE] }))
                      }
                      className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Products Grid */}
          {filteredProducts.length > 0 ? (
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium">Nenhuma fragrância encontrada</h3>
              <p className="mt-2 max-w-sm text-muted-foreground">
                Ajuste os filtros para descobrir perfumes que combinam com você.
              </p>
              <Button
                variant="outline"
                className="mt-8 rounded-full bg-transparent px-6"
                onClick={resetFilters}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Remover filtros
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-gradient-to-b from-background to-muted/30 px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-4 lg:gap-8">
            {/* Brand */}
            <div className="lg:col-span-1">
              <a href="/" className="inline-block">
                <span className="font-serif text-2xl font-medium tracking-tight">Fausto</span>
                <span className="block text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                  Importados
                </span>
              </a>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Curadoria de fragrâncias importadas 100% originais. Autenticidade garantida desde 2018.
              </p>
              <div className="mt-6 flex gap-3">
                <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" /></svg>
                </a>
                <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider">
                Navegue
              </h4>
              <nav className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, gender: 'feminino' }))
                    setActiveQuickFilter(null)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="text-left transition-colors hover:text-foreground"
                >
                  Feminino
                </button>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, gender: 'masculino' }))
                    setActiveQuickFilter(null)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="text-left transition-colors hover:text-foreground"
                >
                  Masculino
                </button>
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, gender: 'unissex' }))
                    setActiveQuickFilter(null)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="text-left transition-colors hover:text-foreground"
                >
                  Unissex
                </button>
              </nav>
            </div>
            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider">
                Atendimento
              </h4>
              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <p className="font-medium">WhatsApp</p>
                  <p className="text-muted-foreground">(11) 99999-9999</p>
                </div>
                <div>
                  <p className="font-medium">Horário</p>
                  <p className="text-muted-foreground">Seg - Sex: 9h às 18h</p>
                  <p className="text-muted-foreground">Sábado: 9h às 13h</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 p-5 border border-emerald-200/50">
              <p className="font-bold text-emerald-700 dark:text-emerald-300 text-[15px]">
                🎁 Frete Grátis na compra acima de R$ 300!
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Todo Brasil • Envio com rastreio + Embalagem segura
              </p>
              <p className="mt-1 text-xs italic text-emerald-600/80 dark:text-emerald-400/80">
                Faltam pouco pro seu frete sair de graça! 😏
              </p>
            </div>
          </div>


          <Separator className="my-12" />

          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-xs text-muted-foreground">
              © 2026 Fausto Importados. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <a href="#" className="transition-colors hover:text-foreground">Termos de Uso</a>
              <a href="#" className="transition-colors hover:text-foreground">Privacidade</a>
              <a href="#" className="transition-colors hover:text-foreground">Cookies</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemove={handleRemoveFromCart}
        onClear={handleClearCart}
      />
    </div>
  )
}
