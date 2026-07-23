"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import type { Product } from "@/lib/types"
import { Button } from "@/Shadcn-Components/ui/button"
import { Input } from "@/Shadcn-Components/ui/input"
import { Label } from "@/Shadcn-Components/ui/label"
import { Textarea } from "@/Shadcn-Components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/Shadcn-Components/ui/card"
import { Badge } from "@/Shadcn-Components/ui/badge"
import { Separator } from "@/Shadcn-Components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/Shadcn-Components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Shadcn-Components/ui/select"
import { Checkbox } from "@/Shadcn-Components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/Shadcn-Components/ui/table"
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
  Bell,
  RotateCcw,
  TrendingUp,
  FileText,
  ChevronDown,
  Search,
  LogOut,
  ArrowUpDown,
  Check
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Shadcn-Components/ui/popover"
import { emptyForm, type ProductFormData, type SmartImageUploaderProps } from "@/types"
import { NotificationsPanel } from "@/component/NotificationsPanel"
import { ThemeToggle } from "@/component/ThemeToggle"
import { Pagination } from "@/component/Pagination"
import { usePagination } from "@/lib/usePagination"
import Swal from "sweetalert2"
import { API_URL } from "@/lib/api"
import { toast } from "sonner"
import { useAdminPushNotifications } from "@/lib/useAdminPushNotifications"

const authFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, { ...options, credentials: "include" })

// ============================================================================
// SmartImageUploader
// ============================================================================
function SmartImageUploader({
  value,
  onChange,
  onLoadingChange,
  className = "",
  maxSizeMB = 6,
}: SmartImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string>(value || "")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (value && value !== preview) setPreview(value)
  }, [value])

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são permitidas")
      return
    }
    setError(null)
    setPreview(URL.createObjectURL(file))
    setIsLoading(true)
    onLoadingChange?.(true)
    try {
      const formData = new FormData()
      formData.append("image", file)
      const response = await authFetch(`${API_URL}/api/upload`, { method: "POST", body: formData })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      onChange(data.url)
    } catch (err) {
      console.error(err)
      setError("Erro ao enviar imagem")
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const removeImage = () => { setPreview(""); onChange("") }

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
              onError={(e) => { e.currentTarget.src = "/placeholder.svg?height=400&width=500&text=Erro+na+imagem" }}
            />
            {isLoading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-white/80" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <Button type="button" variant="destructive" size="icon" className="rounded-full" onClick={removeImage}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Clique ou arraste outra imagem para substituir</p>
        </div>
      ) : (
        <div
          onClick={() => document.getElementById("image-upload")?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/30"}`}
        >
          <input
            id="image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file) }}
          />
          <div className="flex flex-col items-center gap-3">
            {isLoading ? <Loader2 className="h-12 w-12 animate-spin text-primary" /> : <Upload className="h-12 w-12 text-muted-foreground" />}
            <div>
              <p className="font-medium text-lg">{isDragging ? "Solte a imagem aqui" : "Arraste ou clique para enviar"}</p>
              <p className="text-sm text-muted-foreground mt-1">PNG, JPG, WebP • Máximo {maxSizeMB}MB</p>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  )
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
  const [loading, setLoading] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [salesStats, setSalesStats] = useState({ day: 0, month: 0, year: 0 })
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [adminFilters, setAdminFilters] = useState({
    gender: "TODOS", family: "TODOS", onSale: false, minPrice: "", maxPrice: "",
  })
  type AdminSortKey = 'default' | 'price_asc' | 'price_desc' | 'name_asc' | 'stock_asc'
  const [adminSort, setAdminSort] = useState<AdminSortKey>('default')

  const [adminSearch, setAdminSearch] = useState("")

  const { pendingCount, poll: pollPending } = useAdminPushNotifications({
    onNewOrder: (count) => {
      toast("🛎️ Novo pedido recebido!", {
        description: `Você tem ${count} pedido${count > 1 ? "s" : ""} pendente${count > 1 ? "s" : ""}.`,
        duration: 8000,
        action: { label: "Ver pedidos", onClick: () => setNotificationsOpen(true) },
      })
    },
  })

  const handleLogout = async () => {
    await authFetch(`${API_URL}/auth/logout`, { method: "POST" })
    navigate("/nexus-24/login")
    setTimeout(() => {
      Swal.fire({ icon: "success", title: "Até logo!", text: "Você saiu da sua conta.", timer: 2000, showConfirmButton: false })
    }, 100)
  }

  useEffect(() => {
    fetchProducts()
    fetchSalesStats()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/product`)
      const data = await response.json()
      setProducts(data.content)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const refreshProducts = () => fetchProducts()

  const fetchSalesStats = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/orders/sales-stats`)
      const data = await res.json()
      setSalesStats(data)
    } catch { /* ignore */ }
  }

  const handleResetSales = async () => {
    await authFetch(`${API_URL}/api/orders/reset-sales`, { method: "DELETE" })
    setSalesStats({ day: 0, month: 0, year: 0 })
    setResetConfirmOpen(false)
  }

  const openCreateDialog = () => { setEditingProduct(null); setFormData(emptyForm); setIsDialogOpen(true) }

  const openEditDialog = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      brand: product.brand,
      description: product.description,
      price: product.price,
      originalPrice: product.originalPrice ?? "",
      image: product.image || "",
      category: product.category as "MASCULINO" | "FEMININO" | "UNISSEX",
      size: typeof product.size === "string" ? parseInt(product.size) : product.size,
      concentration: product.concentration || "",
      olfactiveFamily: product.olfactiveFamily || "",
      featured: product.featured || false,
      inStock: product.inStock ?? true,
      stockQuantity: product.stockQuantity ?? 0,
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.image) {
      Swal.fire({ icon: "warning", title: "Imagem obrigatória", text: "Aguarde o upload da imagem ou selecione uma imagem antes de salvar." })
      return
    }
    const productData = {
      name: formData.name, brand: formData.brand, description: formData.description,
      price: Number(formData.price),
      originalPrice: formData.originalPrice ? Number(formData.originalPrice) : null,
      category: formData.category, size: formData.size,
      olfactiveFamily: formData.olfactiveFamily || null,
      featured: formData.featured ?? false,
      inStock: formData.inStock ?? true,
      image: formData.image,
      stockQuantity: Number(formData.stockQuantity ?? 0),
    }

    try {
      if (editingProduct) {
        const form = new FormData()
        form.append("product", JSON.stringify(productData))
        const res = await authFetch(`${API_URL}/api/product/${editingProduct.id}`, { method: "PUT", body: form })
        if (res.status === 401 || res.status === 403) {
          Swal.fire({ icon: "error", title: "Acesso negado", text: "Você não está autorizado!" })
          navigate("/nexus-24/login"); return
        }
        if (!res.ok) {
          const text = await res.text()
          let message = text
          try {
            const parsed = JSON.parse(text)
            message = parsed.message || parsed.error || text
          } catch { /* ignore */ }
          Swal.fire({ icon: "error", title: "Erro ao atualizar produto", text: message || "Ocorreu um erro ao atualizar o produto." })
          return
        }
      } else {
        const res = await authFetch(`${API_URL}/api/product`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(productData),
        })
        if (res.status === 401 || res.status === 403) {
          Swal.fire({ icon: "error", title: "Acesso negado", text: "Você não está autorizado!" })
          navigate("/nexus-24/login"); return
        }
        if (!res.ok) {
          const text = await res.text()
          let message = text
          try {
            const parsed = JSON.parse(text)
            message = parsed.message || parsed.error || text
          } catch { /* ignore */ }
          Swal.fire({ icon: "error", title: "Erro ao cadastrar produto", text: message || "Ocorreu um erro ao cadastrar o produto." })
          return
        }
      }
      setIsDialogOpen(false); setFormData(emptyForm); setEditingProduct(null); refreshProducts()
      Swal.fire({ icon: "success", title: editingProduct ? "Produto atualizado" : "Produto cadastrado", text: editingProduct ? "O produto foi atualizado com sucesso." : "O produto foi cadastrado com sucesso.", timer: 2000, showConfirmButton: false })
    } catch (error: any) {
      console.error(error)
      Swal.fire({ icon: "error", title: "Erro de conexão", text: error?.message || "Não foi possível se comunicar com o servidor." })
    }
  }


  const handleDelete = async (id: string) => {
    const res = await authFetch(`${API_URL}/api/product/${id}`, { method: "DELETE" })
    if (res.status === 401 || res.status === 403) {
      Swal.fire({ icon: "error", title: "Ação negada", text: "Você não está autorizado!" })
      navigate("/nexus-24/login"); return
    }
    setDeleteConfirm(null); refreshProducts()
  }

  const stats = {
    total: products.length,
    inStock: products.reduce((sum, p) => sum + (p.stockQuantity ?? 0), 0),
    featured: products.filter((p) => p.featured).length,
    totalValue: products.reduce((sum, p) => sum + p.price * (p.stockQuantity ?? 1), 0),
  }

  const filteredAdminProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      if (adminSearch.trim()) {
        const t = adminSearch.toLowerCase()
        if (!p.name.toLowerCase().includes(t) && !p.brand.toLowerCase().includes(t)) return false
      }
      if (adminFilters.gender !== "TODOS" && p.category !== adminFilters.gender) return false
      if (adminFilters.family !== "TODOS") {
        const productFamilies = p.olfactiveFamily
          ? p.olfactiveFamily.toUpperCase().split(",").map((f) => f.trim())
          : []
        if (!productFamilies.includes(adminFilters.family)) return false
      }
      if (adminFilters.onSale && !(p.originalPrice && p.originalPrice > p.price)) return false
      const _min = adminFilters.minPrice !== "" ? Number(adminFilters.minPrice) : 0
      const _max = adminFilters.maxPrice !== "" ? Number(adminFilters.maxPrice) : Infinity
      if (p.price < _min || p.price > _max) return false
      return true
    })
    const sorted = [...filtered]
    if (adminSort === 'price_asc') sorted.sort((a, b) => a.price - b.price)
    if (adminSort === 'price_desc') sorted.sort((a, b) => b.price - a.price)
    if (adminSort === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (adminSort === 'stock_asc') sorted.sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0))
    return sorted
  }, [products, adminSearch, adminFilters, adminSort])

  const PAGE_SIZE = 10
  const { page, setPage, totalPages, paginated, next, prev, goTo } =
    usePagination(filteredAdminProducts, PAGE_SIZE)

  // Reset para página 1 sempre que filtros mudarem
  useEffect(() => { setPage(1) }, [adminSearch, adminFilters, adminSort])

  const categoryLabels = { MASCULINO: "Masculino", FEMININO: "Feminino", UNISSEX: "Unissex" }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">

          {/* Esquerda */}
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-lg">Painel Administrativo</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">Gerencie seus produtos</p>
            </div>
          </div>

          {/* Direita */}
          <div className="flex shrink-0 items-center gap-1.5">

            <ThemeToggle />

            {/* Relatório */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/nexus-24/relatorio")}
              title="Relatório de Vendas"
            >
              <FileText className="h-4 w-4" />
            </Button>

            {/* Pedidos pendentes */}
            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={() => { setNotificationsOpen(true); pollPending() }}
              title="Ver pedidos"
            >
              <Bell className="h-4 w-4" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </Button>

            {/* Novo produto */}
            <Button onClick={openCreateDialog} className="gap-1 px-2 sm:px-4">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Produto</span>
            </Button>

            {/* Sair */}
            <Button
              variant="outline"
              className="gap-1 px-2 sm:px-4"
              onClick={() => setLogoutConfirmOpen(true)}
            >
              <LogOut className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Sair</span>
            </Button>

          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Estatísticas */}
        <div className="mb-8 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Produtos</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Em Estoque</CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.inStock}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Destaques</CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.featured}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor em Estoque</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {stats.totalValue.toFixed(2).replace(".", ",")}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-green-200 bg-green-50/40 dark:border-green-900 dark:bg-green-950/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Vendido Hoje</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">R$ {salesStats.day.toFixed(2).replace(".", ",")}</div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Vendido no Mês</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">R$ {salesStats.month.toFixed(2).replace(".", ",")}</div>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50/40 dark:border-purple-900 dark:bg-purple-950/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Vendido no Ano</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">R$ {salesStats.year.toFixed(2).replace(".", ",")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resetar Vendas</CardTitle>
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Button variant="destructive" size="sm" className="w-full" onClick={() => setResetConfirmOpen(true)}>
                  Zerar todos os valores
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filtros do admin */}
        <div className="mb-6 flex flex-wrap items-center gap-2">

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome ou marca..."
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              className="rounded-full border border-border bg-transparent pl-9 pr-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring hover:border-foreground/50"
            />
            {adminSearch && (
              <button onClick={() => setAdminSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Ordenação */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${adminSort !== 'default' ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/50"}`}>
                <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                {adminSort === 'default' ? 'Ordenar' :
                  adminSort === 'price_asc' ? 'Menor preço' :
                    adminSort === 'price_desc' ? 'Maior preço' :
                      adminSort === 'name_asc' ? 'Nome A–Z' :
                        'Menor estoque'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              {([
                { value: 'default', label: 'Padrão' },
                { value: 'price_asc', label: 'Menor preço' },
                { value: 'price_desc', label: 'Maior preço' },
                { value: 'name_asc', label: 'Nome A–Z' },
                { value: 'stock_asc', label: 'Menor estoque' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAdminSort(opt.value)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${adminSort === opt.value ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  {adminSort === opt.value && <Check className="h-3.5 w-3.5 shrink-0" />}
                  {opt.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Gênero */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${adminFilters.gender !== "TODOS" ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/50"}`}>
                {adminFilters.gender === "TODOS" ? "Gênero" : adminFilters.gender.charAt(0) + adminFilters.gender.slice(1).toLowerCase()}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="start">
              {["TODOS", "FEMININO", "MASCULINO", "UNISSEX"].map((opt) => (
                <button key={opt} onClick={() => setAdminFilters((prev) => ({ ...prev, gender: opt }))}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${adminFilters.gender === opt ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                  {opt === "TODOS" ? "Todos" : opt.charAt(0) + opt.slice(1).toLowerCase()}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Família Olfativa */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${adminFilters.family !== "TODOS" ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/50"}`}>
                {adminFilters.family === "TODOS" ? "Família Olfativa" : adminFilters.family.charAt(0) + adminFilters.family.slice(1).toLowerCase()}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              {["TODOS", "FLORAL", "AMADEIRADO", "CITRICO", "ORIENTAL", "AQUATICO", "FRUTADO", "GOURMAND"].map((opt) => (
                <button key={opt} onClick={() => setAdminFilters((prev) => ({ ...prev, family: opt }))}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${adminFilters.family === opt ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                  {opt === "TODOS" ? "Todas" : opt.charAt(0) + opt.slice(1).toLowerCase()}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Preço */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${adminFilters.minPrice !== "" || adminFilters.maxPrice !== "" ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/50"}`}>
                {adminFilters.minPrice === "" && adminFilters.maxPrice === "" ? "Preço" : `R$ ${adminFilters.minPrice || "0"} — R$ ${adminFilters.maxPrice || "∞"}`}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Faixa de Preço</span>
                  <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setAdminFilters((prev) => ({ ...prev, minPrice: "", maxPrice: "" }))}>Limpar</button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Mínimo</label>
                    <input type="number" placeholder="0" value={adminFilters.minPrice} onChange={(e) => setAdminFilters((prev) => ({ ...prev, minPrice: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <span className="text-muted-foreground mt-5">—</span>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Máximo</label>
                    <input type="number" placeholder="∞" value={adminFilters.maxPrice} onChange={(e) => setAdminFilters((prev) => ({ ...prev, maxPrice: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Promoções */}
          <button
            onClick={() => setAdminFilters((prev) => ({ ...prev, onSale: !prev.onSale }))}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${adminFilters.onSale ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/50"}`}
          >
            Promoções
          </button>

          {/* Limpar todos os filtros */}
          {(adminSearch || adminFilters.gender !== "TODOS" || adminFilters.family !== "TODOS" || adminFilters.onSale || adminFilters.minPrice !== "" || adminFilters.maxPrice !== "" || adminSort !== "default") && (
            <button
              onClick={() => {
                setAdminSearch("")
                setAdminFilters({ gender: "TODOS", family: "TODOS", onSale: false, minPrice: "", maxPrice: "" })
                setAdminSort("default")
              }}
              className="flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-all hover:border-foreground/50 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Limpar
            </button>
          )}

          <span className="ml-auto text-xs text-muted-foreground">
            {filteredAdminProducts.length} de {products.length} produto{products.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tabela de Produtos */}
        <Card>
          <CardHeader><CardTitle>Produtos</CardTitle></CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Imagem</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Qtd.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-sm text-muted-foreground">Carregando produtos...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <span className="text-muted-foreground">Nenhum produto encontrado</span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="relative h-12 w-12 overflow-hidden rounded-md bg-white  flex items-center justify-center">
                            <img src={product.image || "/placeholder.svg"} alt={product.name} className="max-h-full max-w-full object-contain" onError={(e) => { e.currentTarget.src = "/placeholder.svg" }} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">{product.brand} | {product.size}ml</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{categoryLabels[product.category as keyof typeof categoryLabels]}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">R$ {product.price.toFixed(2).replace(".", ",")}</p>
                            {product.originalPrice && (
                              <p className="text-sm text-muted-foreground line-through">R$ {product.originalPrice.toFixed(2).replace(".", ",")}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium tabular-nums ${(product.stockQuantity ?? 0) === 0 ? "text-destructive" : (product.stockQuantity ?? 0) <= 3 ? "text-yellow-600" : ""}`}>
                            {product.stockQuantity ?? 0} un.
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={product.inStock ? "success" : "destructive"}>{product.inStock ? "Disponível" : "Esgotado"}</Badge>
                            {product.featured && <Badge variant="default">Destaque</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(product.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-4">
              {paginated.map((product) => (
                <Card key={product.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white dark:bg-muted/20 flex items-center justify-center">
                      <img src={product.image || "/placeholder.svg"} alt={product.name} className="max-h-full max-w-full object-contain" onError={(e) => { e.currentTarget.src = "/placeholder.svg" }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.brand} • {product.size}</p>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={product.inStock ? "success" : "destructive"}>{product.inStock ? "Disponível" : "Esgotado"}</Badge>
                        {product.featured && <Badge variant="default">Destaque</Badge>}
                        <span className={`text-xs font-medium tabular-nums ${(product.stockQuantity ?? 0) === 0 ? "text-destructive" : (product.stockQuantity ?? 0) <= 3 ? "text-yellow-600" : "text-muted-foreground"}`}>
                          {product.stockQuantity ?? 0} un.
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex flex-col">
                          <p className="font-medium">R$ {product.price.toFixed(2).replace(".", ",")}</p>
                          {product.originalPrice && <p className="text-sm text-muted-foreground line-through">R$ {product.originalPrice.toFixed(2).replace(".", ",")}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteConfirm(product.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {products.length === 0 && (
              <div className="py-12 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">Nenhum produto cadastrado</p>
                <p className="mt-1 text-sm text-muted-foreground">Adicione seu primeiro produto para começar</p>
                <Button onClick={openCreateDialog} className="mt-4 gap-2"><Plus className="h-4 w-4" />Adicionar Produto</Button>
              </div>
            )}
          </CardContent>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={prev}
            onNext={next}
            onGoTo={goTo}
            totalItems={filteredAdminProducts.length}
            pageSize={PAGE_SIZE}
          />
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
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Perfume</Label>
                    <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Creed Aventus" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input id="brand" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} placeholder="Ex: Creed, Dior, Chanel..." required />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={formData.category} onValueChange={(value: "MASCULINO" | "FEMININO" | "UNISSEX") => setFormData({ ...formData, category: value })}>
                      <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FEMININO">Feminino</SelectItem>
                        <SelectItem value="MASCULINO">Masculino</SelectItem>
                        <SelectItem value="UNISSEX">Unissex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 mt-4 col-span-3">
                    <Label>Família Olfativa (Selecione uma ou mais)</Label>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-lg border p-4 bg-muted/20">
                      {[
                        { value: "FLORAL", label: "Floral" },
                        { value: "AMADEIRADO", label: "Amadeirado" },
                        { value: "CITRICO", label: "Cítrico" },
                        { value: "ORIENTAL", label: "Oriental" },
                        { value: "AQUATICO", label: "Aquático" },
                        { value: "FRUTADO", label: "Frutado" },
                        { value: "GOURMAND", label: "Gourmand" },
                      ].map((family) => {
                        const isChecked = formData.olfactiveFamily
                          ? formData.olfactiveFamily.split(",").map((f) => f.trim().toUpperCase()).includes(family.value)
                          : false
                        return (
                          <div key={family.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`family-${family.value}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const currentList = formData.olfactiveFamily
                                  ? formData.olfactiveFamily.split(",").map((f) => f.trim().toUpperCase()).filter(Boolean)
                                  : []
                                let newList: string[]
                                if (checked) {
                                  newList = [...currentList, family.value]
                                } else {
                                  newList = currentList.filter((f) => f !== family.value)
                                }
                                setFormData({ ...formData, olfactiveFamily: newList.join(",") })
                              }}
                            />
                            <Label htmlFor={`family-${family.value}`} className="text-sm font-normal cursor-pointer">
                              {family.label}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Notas olfativas, inspiração, ocasião de uso..." rows={4} required />
                  </div>
                  <div className="grid gap-6 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="price">Preço (R$)</Label>
                      <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => { const value = e.target.value; if (/^\d*\.?\d*$/.test(value)) setFormData({ ...formData, price: value === "" ? "" : Number(value) }) }} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="originalPrice">Preço Original (R$)</Label>
                      <Input id="originalPrice" type="number" step="0.01" value={formData.originalPrice} onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value === "" ? "" : Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="size">Tamanho (ml)</Label>
                      <Input id="size" type="number" value={formData.size} onChange={(e) => { const value = e.target.value; setFormData((prev) => ({ ...prev, size: value === "" ? "" : Number(value) as number })) }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stockQuantity">Quantidade em estoque</Label>
                    <Input id="stockQuantity" type="number" min={0} value={formData.stockQuantity ?? 0} onChange={(e) => { const value = e.target.value; setFormData((prev) => ({ ...prev, stockQuantity: value === "" ? 0 : Number(value) })) }} required />
                    <p className="text-xs text-muted-foreground">Marcado como esgotado automaticamente quando chegar a 0.</p>
                  </div>
                  <SmartImageUploader value={formData.image || ""} onChange={(newImage) => setFormData((prev) => ({ ...prev, image: newImage }))} onLoadingChange={setImageUploading} maxSizeMB={8} />
                </div>

                <Separator />

                <div className="flex flex-col gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="inStock" checked={formData.inStock} onCheckedChange={(checked) => setFormData({ ...formData, inStock: !!checked })} />
                    <Label htmlFor="inStock" className="cursor-pointer">Disponível em estoque</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="featured" checked={formData.featured} onCheckedChange={(checked) => setFormData({ ...formData, featured: !!checked })} />
                    <Label htmlFor="featured" className="cursor-pointer">Produto em destaque / Recomendado</Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={imageUploading}>
                {imageUploading ? "Enviando imagem..." : editingProduct ? "Salvar Alterações" : "Criar Produto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <NotificationsPanel
        open={notificationsOpen}
        onOpenChange={(v) => {
          setNotificationsOpen(v)
          if (!v) { pollPending(); fetchSalesStats(); }
        }}
        onStatusChange={() => pollPending()}
      />

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Zerar valores de venda</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Isso vai zerar os valores de vendido hoje, no mês e no ano. Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleResetSales}>Sim, zerar tudo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Sair da conta</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Tem certeza que deseja sair da sua conta?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleLogout}>Sim, sair</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}