"use client"

import { useState, useEffect } from "react"
import type { Product } from "@/lib/types"
import { Card, CardContent } from "@/Shadcn-Components/ui/card"
import { Button } from "@/Shadcn-Components/ui/button"
import { Badge } from "@/Shadcn-Components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/Shadcn-Components/ui/dialog"
import { Separator } from "@/Shadcn-Components/ui/separator"
import { ShoppingBag, Plus, Minus, Heart, Share2, Check } from "lucide-react"
import { toast } from "sonner"

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
  isFavorite?: boolean
  onToggleFavorite?: (id: string) => void
  onShare?: (id: string) => void
  copiedId?: string | null
  highlight?: boolean
  onHighlightAck?: () => void
}

export function ProductCard({
  product,
  onAddToCart,
  isFavorite = false,
  onToggleFavorite,
  onShare,
  copiedId,
  highlight = false,
  onHighlightAck,
}: ProductCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)

  const hasDiscount = product.originalPrice && product.originalPrice > product.price
  const isFeatured = product.featured === true
  const isOutOfStock =
    !product.inStock ||
    (product.stockQuantity !== undefined && product.stockQuantity <= 0)

  useEffect(() => {
    if (highlight) {
      setIsModalOpen(true)
      onHighlightAck?.()
    }
  }, [highlight])

  // Handle browser back button to close the modal
  useEffect(() => {
    if (!isModalOpen) return

    const stateName = `modal-${product.id}`
    window.history.pushState({ modal: stateName }, "")

    const handlePopState = () => {
      setIsModalOpen(false)
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
      if (window.history.state?.modal === stateName) {
        window.history.back()
      }
    }
  }, [isModalOpen, product.id])

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) onAddToCart(product)
    setQuantity(1)
    setIsModalOpen(false)
  }

  const categoryLabels: Record<string, string> = {
    masculino: "Masc.", feminino: "Fem.", unissex: "Unissex",
    MASCULINO: "Masc.", FEMININO: "Fem.", UNISSEX: "Unissex",
  }
  const categoryLabelsFull: Record<string, string> = {
    masculino: "Masculino", feminino: "Feminino", unissex: "Unissex",
    MASCULINO: "Masculino", FEMININO: "Feminino", UNISSEX: "Unissex",
  }

  const formattedFamilies = product.olfactiveFamily
    ? product.olfactiveFamily
        .split(",")
        .map((f) => f.trim().charAt(0).toUpperCase() + f.trim().slice(1).toLowerCase())
        .join(", ")
    : ""

  const isCopied = copiedId === product.id

  const StockBadge = () => {
    if (isOutOfStock || product.stockQuantity == null) return null
    if (product.stockQuantity <= 3)
      return <Badge variant="destructive" className="text-xs">Últimas {product.stockQuantity} un.</Badge>
    return <Badge variant="secondary" className="text-xs">{product.stockQuantity} em estoque</Badge>
  }

  return (
    <>
      <Card
        className="group cursor-pointer overflow-hidden border-0 bg-card shadow-sm transition-all duration-300 hover:shadow-lg"
        onClick={() => setIsModalOpen(true)}
      >
        {/* Imagem */}
        <div className="relative aspect-square overflow-hidden bg-white">
          <img
            src={product.image || "/placeholder.svg"}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
          />

          {hasDiscount && (
            <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">Oferta</Badge>
          )}
          {isFeatured && !hasDiscount && (
            <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">Destaque</Badge>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Badge variant="destructive">Esgotado</Badge>
            </div>
          )}

          {/* Favorito + Compartilhar — sempre visíveis, canto superior esquerdo/direito */}
          {(onToggleFavorite || onShare) && (
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              {onToggleFavorite && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(product.id) }}
                  title={isFavorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-background active:scale-95"
                >
                  <Heart
                    className={`h-3.5 w-3.5 transition-colors ${
                      isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                    }`}
                  />
                </button>
              )}
              {onShare && (
                <button
                  onClick={(e) => { e.stopPropagation(); onShare(product.id) }}
                  title="Copiar link do produto"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-background active:scale-95"
                >
                  {isCopied
                    ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                    : <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </button>
              )}
            </div>
          )}
        </div>

        {/* Corpo do card */}
        <CardContent className="flex flex-col p-3 sm:p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground truncate">{product.brand}</p>
          <h3 className="mt-1 text-sm sm:text-base font-medium text-foreground line-clamp-2 min-h-10 leading-snug">
            {product.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground truncate leading-none">
            {product.size}ml · {categoryLabels[product.category]} · {formattedFamilies}
          </p>
          <div className="mt-2 h-5 flex items-center"><StockBadge /></div>
          <div className="mt-2 h-10 flex flex-col justify-center">
            <span className="text-base sm:text-lg font-semibold text-foreground leading-tight">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </span>
            <span className={`text-xs leading-tight ${hasDiscount ? "text-muted-foreground line-through" : "invisible"}`}>
              {hasDiscount ? `R$ ${product.originalPrice?.toFixed(2).replace(".", ",")}` : "-"}
            </span>
          </div>
          <Button
            className="mt-3 w-full gap-2"
            onClick={(e) => {
              e.stopPropagation()
              onAddToCart(product)
              toast.success("Produto adicionado ao carrinho", {
                style: { backgroundColor: "#3CB371", color: "#ffffff" },
              })
            }}
            disabled={isOutOfStock}
          >
            <ShoppingBag className="h-4 w-4" />
            Adicionar
          </Button>
        </CardContent>
      </Card>

      {/* ── Modal de detalhes ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl p-0 max-h-[95vh] flex flex-col overflow-hidden">
          <DialogTitle className="sr-only">{product.name}</DialogTitle>



          {/* Conteúdo rolável */}
          <div className="flex flex-col md:flex-row overflow-y-auto">
            {/* Imagem */}
            <div className="relative bg-white md:flex-1 flex items-center justify-center min-h-64 shrink-0">
              <img
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                className="max-w-full max-h-72 md:max-h-96 object-contain p-6"
              />
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Badge variant="destructive">Esgotado</Badge>
                </div>
              )}
            </div>

            {/* Detalhes */}
            <div className="flex flex-col p-6 md:flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{categoryLabelsFull[product.category]}</Badge>
                {product.olfactiveFamily && product.olfactiveFamily.split(",").map((f) => (
                  <Badge key={f} variant="secondary">
                    {f.trim().charAt(0).toUpperCase() + f.trim().slice(1).toLowerCase()}
                  </Badge>
                ))}
                {hasDiscount && <Badge className="bg-accent text-accent-foreground">Oferta</Badge>}
              </div>

              <p className="mt-4 text-sm uppercase tracking-wider text-muted-foreground">{product.brand}</p>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">{product.name}</h2>
              <p className="text-sm text-muted-foreground">{product.size}ml</p>

              <div className="mt-2">
                {product.stockQuantity != null && !isOutOfStock && (
                  product.stockQuantity <= 3 ? (
                    <Badge variant="destructive" className="text-xs">
                      Últimas {product.stockQuantity} unidade{product.stockQuantity > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">{product.stockQuantity} em estoque</Badge>
                  )
                )}
              </div>

              <Separator className="my-4" />
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>
              <Separator className="my-4" />

              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-foreground">
                  R$ {product.price.toFixed(2).replace(".", ",")}
                </span>
                {hasDiscount && (
                  <span className="text-lg text-muted-foreground line-through">
                    R$ {product.originalPrice?.toFixed(2).replace(".", ",")}
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-md border border-input">
                  <Button variant="ghost" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const max = product.stockQuantity ?? Infinity
                      setQuantity(Math.min(quantity + 1, max))
                    }}
                    disabled={product.stockQuantity !== undefined && quantity >= product.stockQuantity}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button className="flex-1 gap-2" onClick={handleAddToCart} disabled={isOutOfStock}>
                  <ShoppingBag className="h-4 w-4" />
                  Adicionar ao Carrinho
                </Button>
              </div>

              {/* Favorito + Compartilhar no modal */}
              <div className="mt-4 flex gap-2">
                {onToggleFavorite && (
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => onToggleFavorite(product.id)}>
                    <Heart className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                    {isFavorite ? "Remover favorito" : "Salvar"}
                  </Button>
                )}
                {onShare && (
                  <Button variant="outline" className="gap-2" onClick={() => onShare(product.id)}>
                    {isCopied
                      ? <Check className="h-4 w-4 text-emerald-500" />
                      : <Share2 className="h-4 w-4" />
                    }
                    {isCopied ? "Copiado!" : "Compartilhar"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}