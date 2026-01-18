"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import type { Product } from "@/lib/types"
import { getProducts, saveProducts, addProduct, updateProduct, deleteProduct } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Plus, Pencil, Trash2, Package, DollarSign, Tag, X } from "lucide-react"

type ProductFormData = {
  name: string
  brand: string
  description: string
  price: string
  originalPrice: string
  image: string
  category: "masculino" | "feminino" | "unissex"
  size: string
  featured: boolean
  inStock: boolean
}

const emptyForm: ProductFormData = {
  name: "",
  brand: "",
  description: "",
  price: "",
  originalPrice: "",
  image: "",
  category: "feminino",
  size: "100ml",
  featured: false,
  inStock: true
}

export function Admin() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState<ProductFormData>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    setProducts(getProducts())
  }, [])

  const refreshProducts = () => {
    setProducts(getProducts())
  }

  const openCreateDialog = () => {
    setEditingProduct(null)
    setFormData(emptyForm)
    setIsDialogOpen(true)
  }

  const openEditDialog = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      brand: product.brand,
      description: product.description,
      price: product.price.toString(),
      originalPrice: product.originalPrice?.toString() || "",
      image: product.image,
      category: product.category,
      size: product.size,
      featured: product.featured || false,
      inStock: product.inStock
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const productData = {
      name: formData.name,
      brand: formData.brand,
      description: formData.description,
      price: parseFloat(formData.price) || 0,
      originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
      image: formData.image || "/products/perfume-1.jpg",
      category: formData.category,
      size: formData.size,
      featured: formData.featured,
      inStock: formData.inStock
    }

    if (editingProduct) {
      updateProduct(editingProduct.id, productData)
    } else {
      addProduct(productData)
    }

    setIsDialogOpen(false)
    setFormData(emptyForm)
    setEditingProduct(null)
    refreshProducts()
  }

  const handleDelete = (id: string) => {
    deleteProduct(id)
    setDeleteConfirm(null)
    refreshProducts()
  }

  const stats = {
    total: products.length,
    inStock: products.filter(p => p.inStock).length,
    featured: products.filter(p => p.featured).length,
    totalValue: products.reduce((sum, p) => sum + p.price, 0)
  }

  const categoryLabels = {
    masculino: "Masculino",
    feminino: "Feminino",
    unissex: "Unissex"
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4">

            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div>
              <h1 className="text-lg font-semibold">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground">Gerencie seus produtos</p>
            </div>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Produtos
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em Estoque
              </CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inStock}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Destaques
              </CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.featured}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {stats.totalValue.toFixed(2).replace(".", ",")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Imagem</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preco</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="relative h-12 w-12 overflow-hidden rounded-md bg-muted">
                          <img
                            src={product.image || "/placeholder.svg"}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.brand} | {product.size}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categoryLabels[product.category]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            R$ {product.price.toFixed(2).replace(".", ",")}
                          </p>
                          {product.originalPrice && (
                            <p className="text-sm text-muted-foreground line-through">
                              R$ {product.originalPrice.toFixed(2).replace(".", ",")}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={product.inStock ? "default" : "secondary"}>
                            {product.inStock ? "Disponivel" : "Esgotado"}
                          </Badge>
                          {product.featured && (
                            <Badge variant="outline">Destaque</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {products.length === 0 && (
              <div className="py-12 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">Nenhum produto</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adicione seu primeiro produto para comecar
                </p>
                <Button onClick={openCreateDialog} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Produto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Product Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome do perfume"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="Marca"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descricao</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descricao do produto"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="price">Preco (R$)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="originalPrice">Preco Original (R$)</Label>
                    <Input
                      id="originalPrice"
                      type="number"
                      step="0.01"
                      value={formData.originalPrice}
                      onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image">URL da Imagem</Label>
                  <Input
                    id="image"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="/products/perfume-1.jpg"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: "masculino" | "feminino" | "unissex") =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="unissex">Unissex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="size">Tamanho</Label>
                    <Input
                      id="size"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      placeholder="100ml"
                      required
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="inStock"
                      checked={formData.inStock}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, inStock: checked as boolean })
                      }
                    />
                    <Label htmlFor="inStock" className="cursor-pointer">
                      Disponivel em estoque
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="featured"
                      checked={formData.featured}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, featured: checked as boolean })
                      }
                    />
                    <Label htmlFor="featured" className="cursor-pointer">
                      Produto em destaque
                    </Label>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingProduct ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusao</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir este produto? Esta acao nao pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
