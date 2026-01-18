"use client"

import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import type { Product } from "@/lib/types"
import { getProducts, updateProduct, deleteProduct, addProduct } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Package,
  DollarSign,
  Tag,
  Upload,
  X,
  Loader2,
} from "lucide-react"

// ============================================================================
// Componente SmartImageUploader
// ============================================================================
interface SmartImageUploaderProps {
  value: string
  onChange: (newValue: string) => void
  className?: string
  maxSizeMB?: number
}

function SmartImageUploader({
  value,
  onChange,
  className = "",
  maxSizeMB = 6,
}: SmartImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string>(value || "")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (value && value !== preview) {
      setPreview(value)
    }
  }, [value])

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são permitidas (JPG, PNG, WebP)")
      return
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Tamanho máximo permitido: ${maxSizeMB}MB`)
      return
    }

    setError(null)
    setIsLoading(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setPreview(result)
      onChange(result)
      setIsLoading(false)
    }
    reader.onerror = () => {
      setError("Erro ao processar a imagem")
      setIsLoading(false)
    }

    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const removeImage = () => {
    setPreview("")
    onChange("")
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>Imagem do produto</Label>

      {preview ? (
        <div className="relative group rounded-lg overflow-hidden border bg-muted/40">
          <div className="relative aspect-4/3 sm:aspect-5/4 bg-black/5">
            <img
              src={preview}
              alt="Pré-visualização do produto"
              className="object-contain w-full h-full transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.src =
                  "/placeholder.svg?height=400&width=500&text=Erro+na+imagem"
              }}
            />

            {isLoading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-white/80" />
              </div>
            )}

            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="rounded-full"
                onClick={removeImage}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Clique ou arraste outra imagem para substituir
          </p>
        </div>
      ) : (
        <div
          onClick={() => document.getElementById("image-upload")?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          className={`
            border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
            ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/30"}
          `}
        >
          <input
            id="image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex flex-col items-center gap-3">
            {isLoading ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground" />
            )}

            <div>
              <p className="font-medium text-lg">
                {isDragging ? "Solte a imagem aqui" : "Arraste ou clique para enviar"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                PNG, JPG, WebP • Máximo {maxSizeMB}MB
              </p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  )
}

// ============================================================================
// Tipos e valores iniciais
// ============================================================================
type ProductFormData = {
  name: string
  brand: string
  description: string
  price: string
  originalPrice: string
  image: string
  category: "masculino" | "feminino" | "unissex"
  size: string
  concentration?: string
  olfactiveFamily?: string
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
  concentration: "",
  olfactiveFamily: "",
  featured: false,
  inStock: true,
}

// ============================================================================
// Componente Principal - Admin
// ============================================================================
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
      image: product.image || "",
      category: product.category,
      size: product.size,
      concentration: product.concentration || "",
      olfactiveFamily: product.olfactiveFamily || "",
      featured: product.featured || false,
      inStock: product.inStock ?? true,
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
      image: formData.image || "/products/perfume-default.jpg",
      category: formData.category,
      size: formData.size,
      concentration: formData.concentration || "",
      olfactiveFamily: formData.olfactiveFamily || "",
      featured: formData.featured,
      inStock: formData.inStock,
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
    inStock: products.filter((p) => p.inStock).length,
    featured: products.filter((p) => p.featured).length,
    totalValue: products.reduce((sum, p) => sum + p.price, 0),
  }

  const categoryLabels = {
    masculino: "Masculino",
    feminino: "Feminino",
    unissex: "Unissex",
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
        {/* Estatísticas */}
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

        {/* Tabela de Produtos */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Imagem</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
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
                        <Badge variant="outline">{categoryLabels[product.category]}</Badge>
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
                            {product.inStock ? "Disponível" : "Esgotado"}
                          </Badge>
                          {product.featured && <Badge variant="outline">Destaque</Badge>}
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
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
                <p className="mt-4 text-lg font-medium">Nenhum produto cadastrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adicione seu primeiro produto para começar
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

      {/* Dialog de criação/edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="max-h-[70vh] overflow-y-auto pr-4 -mr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              <div className="space-y-6 py-4">
                {/* Nome + Marca */}
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Perfume</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Creed Aventus"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="Ex: Creed, Dior, Chanel..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                    
                      value={formData.category}
                      onValueChange={(value: "masculino" | "feminino" | "unissex") =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="unissex">Unissex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-6 ">
                  

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Notas olfativas, inspiração, ocasião de uso..."
                    rows={4}
                    required
                  />
                </div>

                {/* Preço + Preço original + Tamanho */}
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço (R$)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="originalPrice">Preço Original (R$)</Label>
                    <Input
                      id="originalPrice"
                      type="number"
                      step="0.01"
                      value={formData.originalPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, originalPrice: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="size">Tamanho</Label>
                    <Input
                      id="size"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      placeholder="100ml, 50ml, 200ml..."
                      required
                    />
                  </div>
                </div>

                {/* Upload de imagem - componente inteligente */}
                <SmartImageUploader
                  value={formData.image}
                  onChange={(newImage) => setFormData((prev) => ({ ...prev, image: newImage }))}
                  maxSizeMB={8}
                />

                {/* Categoria + outros campos opcionais */}
                
                  {/* Aqui você pode adicionar concentração e família olfativa se desejar */}
                </div>

                <Separator />

                {/* Checkboxes */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="inStock"
                      checked={formData.inStock}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, inStock: !!checked })
                      }
                    />
                    <Label htmlFor="inStock" className="cursor-pointer">
                      Disponível em estoque
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="featured"
                      checked={formData.featured}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, featured: !!checked })
                      }
                    />
                    <Label htmlFor="featured" className="cursor-pointer">
                      Produto em destaque / Recomendado
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingProduct ? "Salvar Alterações" : "Criar Produto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
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