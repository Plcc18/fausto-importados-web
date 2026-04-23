"use client"

import { useState } from "react"
import type { Product } from "@/lib/types"
import { Card, CardContent } from "@/Shadcn-Components/ui/card"
import { Button } from "@/Shadcn-Components/ui/button"
import { Badge } from "@/Shadcn-Components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/Shadcn-Components/ui/dialog"
import { Separator } from "@/Shadcn-Components/ui/separator"
import { ShoppingBag, Plus, Minus } from "lucide-react"
import { toast } from "sonner"

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const hasDiscount = product.originalPrice && product.originalPrice > product.price
  const isFeatured = product.featured === true

  // Considera esgotado se inStock for false OU se stockQuantity for 0
  const isOutOfStock = !product.inStock || (product.stockQuantity !== undefined && product.stockQuantity <= 0)

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      onAddToCart(product)
    }
    setQuantity(1)
    setIsModalOpen(false)
  }

  const categoryLabels: Record<string, string> = {
    masculino: "Masculino",
    feminino: "Feminino",
    unissex: "Unissex",
    MASCULINO: "Masculino",
    FEMININO: "Feminino",
    UNISSEX: "Unissex",
  }

  // Badge de estoque exibido nos cards e no modal
  const StockBadge = () => {
    if (isOutOfStock) return null
    if (product.stockQuantity === undefined || product.stockQuantity === null) return null

    if (product.stockQuantity <= 3) {
      return (
        <Badge variant="destructive" className="text-xs">
          Últimas {product.stockQuantity} unidade{product.stockQuantity > 1 ? "s" : ""}
        </Badge>
      )
    }

    return (
      <Badge variant="secondary" className="text-xs">
        {product.stockQuantity} em estoque
      </Badge>
    )
  }

  return (
    <>
      <Card
        className="group cursor-pointer overflow-hidden border-0 bg-card shadow-sm transition-all duration-300 hover:shadow-lg"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={product.image || "/placeholder.svg"}
            alt={product.name}
            className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
          />
          {hasDiscount && (
            <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">
              Oferta
            </Badge>
          )}
          {isFeatured && (
            <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
              Destaque
            </Badge>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Badge variant="destructive">Esgotado</Badge>
            </div>
          )}
        </div>
        <CardContent className="p-4 flex flex-col">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {product.brand}
          </p>
          <h3 className="mt-1 text-lg font-medium text-foreground">
            {product.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {product.size}ml | {categoryLabels[product.category]} | {product.olfactiveFamily.charAt(0).toUpperCase() + product.olfactiveFamily.slice(1).toLowerCase()}
          </p>

          {/* Badge de estoque no card */}
          <div className="mt-2">
            <StockBadge />
          </div>

          <div className="mt-3 min-h-11 flex flex-col justify-center">
            <span className="text-lg font-semibold text-foreground">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </span>
            {hasDiscount ? (
              <span className="text-sm text-muted-foreground line-through">
                R$ {product.originalPrice?.toFixed(2).replace(".", ",")}
              </span>
            ) : (
              <span className="text-sm invisible">placeholder</span>
            )}
          </div>

          <Button
            className="mt-4 w-full gap-2"
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl p-0 h-[95vh] md:h-auto overflow-y-auto">
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <div className="flex flex-col md:flex-row">
            <div className="relative bg-muted md:flex-1 flex items-center justify-center min-h-75">
              <img
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                className="max-w-full max-h-full object-contain p-6"
              />
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Badge variant="destructive">Esgotado</Badge>
                </div>
              )}
            </div>
            <div className="flex flex-col p-6 md:flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{categoryLabels[product.category]}</Badge>
                <Badge variant="secondary">
                  {product.olfactiveFamily.charAt(0).toUpperCase() + product.olfactiveFamily.slice(1).toLowerCase()}
                </Badge>
                {hasDiscount && (
                  <Badge className="bg-accent text-accent-foreground">Oferta</Badge>
                )}
              </div>
              <p className="mt-4 text-sm uppercase tracking-wider text-muted-foreground">
                {product.brand}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">
                {product.name}
              </h2>
              <p className="text-sm text-muted-foreground">{product.size}ml</p>

              {/* Badge de estoque no modal */}
              <div className="mt-2">
                <StockBadge />
              </div>

              <Separator className="my-4" />
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      // Não deixa adicionar mais do que tem em estoque
                      const max = product.stockQuantity ?? Infinity
                      setQuantity(Math.min(quantity + 1, max))
                    }}
                    disabled={
                      product.stockQuantity !== undefined &&
                      quantity >= product.stockQuantity
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Adicionar ao Carrinho
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}