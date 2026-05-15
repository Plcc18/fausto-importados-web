"use client"

import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/Shadcn-Components/ui/button"
import { Input } from "@/Shadcn-Components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/Shadcn-Components/ui/card"
import { Badge } from "@/Shadcn-Components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/Shadcn-Components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/Shadcn-Components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Shadcn-Components/ui/popover"
import { ArrowLeft, Download, Search, Trash2, TrendingUp, Package, X, RefreshCw, ChevronDown } from "lucide-react"
import { API_URL } from "@/lib/api"
import { ThemeToggle } from "@/component/ThemeToggle"

const authFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, { ...options, credentials: "include" })

interface OrderItem {
  id: string
  productId: string
  productName: string
  productSize: string
  productCategory: string
  productFamily: string
  onSale: boolean
  quantity: number
  unitPrice: number
}

interface Order {
  id: string
  total: number
  status: string
  items: OrderItem[]
  createdAt: string
}

interface ProductSummary {
  key: string
  productName: string
  productSize: string
  productCategory: string
  productFamily: string
  onSale: boolean
  totalQuantity: number
  unitPrice: number
  totalRevenue: number
}

type Period = "all" | "day" | "month" | "year"

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const periodLabel: Record<Period, string> = {
  all: "Total",
  day: "Hoje",
  month: "Este Mês",
  year: "Este Ano",
}

function filterByPeriod(orders: Order[], period: Period): Order[] {
  if (period === "all") return orders
  const now = new Date()
  return orders.filter((o) => {
    const d = new Date(o.createdAt)
    if (period === "day") return d.toDateString() === now.toDateString()
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (period === "year") return d.getFullYear() === now.getFullYear()
    return true
  })
}

export function SalesReport() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [period, setPeriod] = useState<Period>("all")

  // Filters
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("TODOS")
  const [family, setFamily] = useState("TODOS")
  const [onSale, setOnSale] = useState(false)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/orders/report`)
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [])

  const handleReset = async () => {
    setResetting(true)
    try {
      await authFetch(`${API_URL}/api/orders/reset-report`, { method: "DELETE" })
      setOrders([])
      setResetConfirmOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setResetting(false)
    }
  }

  // Filter by period first
  const periodOrders = useMemo(() => filterByPeriod(orders, period), [orders, period])

  // Then aggregate
  const summaries = useMemo<ProductSummary[]>(() => {
    const map = new Map<string, ProductSummary>()
    for (const order of periodOrders) {
      for (const item of order.items) {
        const key = item.productId + "|" + item.productSize
        const existing = map.get(key)
        if (existing) {
          existing.totalQuantity += item.quantity
          existing.totalRevenue += item.unitPrice * item.quantity
        } else {
          map.set(key, {
            key,
            productName: item.productName,
            productSize: item.productSize,
            productCategory: item.productCategory ?? "",
            productFamily: item.productFamily ?? "",
            onSale: item.onSale ?? false,
            totalQuantity: item.quantity,
            unitPrice: item.unitPrice,
            totalRevenue: item.unitPrice * item.quantity,
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [periodOrders])

  // Apply search/filter
  const filtered = useMemo(() => summaries.filter((s) => {
    if (search.trim() && !s.productName.toLowerCase().includes(search.toLowerCase())) return false
    if (category !== "TODOS" && s.productCategory !== category) return false
    if (family !== "TODOS" && s.productFamily !== family) return false
    if (onSale && !s.onSale) return false
    const min = minPrice !== "" ? Number(minPrice) : 0
    const max = maxPrice !== "" ? Number(maxPrice) : Infinity
    if (s.unitPrice < min || s.unitPrice > max) return false
    return true
  }), [summaries, search, category, family, onSale, minPrice, maxPrice])

  const totalRevenue = filtered.reduce((s, p) => s + p.totalRevenue, 0)
  const totalUnits = filtered.reduce((s, p) => s + p.totalQuantity, 0)
  const hasFilters = search || category !== "TODOS" || family !== "TODOS" || onSale || minPrice || maxPrice

  const clearFilters = () => {
    setSearch("")
    setCategory("TODOS")
    setFamily("TODOS")
    setOnSale(false)
    setMinPrice("")
    setMaxPrice("")
  }

  const handleDownloadPDF = () => {
    const now = new Date()
    const dateStr = now.toLocaleDateString("pt-BR")
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    const periodStr = periodLabel[period]

    const rows = filtered.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"}">
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">${p.productName}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;">${p.productSize}ml</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;">${p.totalQuantity}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(p.unitPrice)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${fmt(p.totalRevenue)}</td>
      </tr>`).join("")

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Relatório de Vendas — ${periodStr} — Fausto Importados</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,serif;color:#111;background:#fff;padding:48px}
.header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:36px;padding-bottom:20px;border-bottom:3px solid #111}
.brand{font-size:30px;font-weight:700;letter-spacing:-1px}
.brand small{display:block;font-size:10px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:#777;margin-top:4px}
.period{display:inline-block;margin-top:6px;font-size:11px;text-transform:uppercase;letter-spacing:2px;background:#111;color:#fff;padding:3px 10px;border-radius:20px}
.meta{text-align:right;font-size:12px;color:#777}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:36px}
.stat{background:#f5f5f5;border-radius:8px;padding:16px 20px}
.stat-label{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:8px}
.stat-value{font-size:24px;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:13px}
thead tr{background:#111;color:#fff}
thead th{padding:12px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600}
tfoot tr{background:#111;color:#fff}
tfoot td{padding:14px;font-weight:700;font-size:14px}
.footer{margin-top:36px;text-align:center;font-size:11px;color:#aaa;padding-top:16px;border-top:1px solid #e5e7eb}
</style></head><body>
<div class="header">
  <div class="brand">Fausto Importados<small>Relatório de Vendas</small><span class="period">${periodStr}</span></div>
  <div class="meta">Gerado em ${dateStr} às ${timeStr}</div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-label">Perfumes Vendidos</div><div class="stat-value">${filtered.length}</div></div>
  <div class="stat"><div class="stat-label">Unidades Totais</div><div class="stat-value">${totalUnits}</div></div>
  <div class="stat"><div class="stat-label">Receita Total</div><div class="stat-value">${fmt(totalRevenue)}</div></div>
</div>
<table>
  <thead><tr>
    <th>Perfume</th>
    <th style="text-align:center">Tamanho</th>
    <th style="text-align:center">Qtd. Vendida</th>
    <th style="text-align:right">Preço Unit.</th>
    <th style="text-align:right">Total</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td colspan="2">TOTAL — ${periodStr.toUpperCase()}</td>
    <td style="text-align:center">${totalUnits} un.</td>
    <td></td>
    <td style="text-align:right">${fmt(totalRevenue)}</td>
  </tr></tfoot>
</table>
<div class="footer">Fausto Importados · Relatório gerado automaticamente em ${dateStr}</div>
</body></html>`

    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/nexus-24")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-sm font-semibold sm:text-base">Relatório de Vendas</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Fausto Importados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            < ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setResetConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Zerar relatório</span>
            </Button>
            <Button size="sm" className="gap-2" onClick={handleDownloadPDF} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Baixar PDF — {periodLabel[period]}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Period tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {(["all", "day", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                period === p
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-transparent text-foreground hover:border-foreground/50"
              }`}
            >
              {periodLabel[p]}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Perfumes Vendidos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filtered.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{totalUnits} unidades no total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Concluídos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{periodOrders.length}</div>
              <p className="text-xs text-muted-foreground mt-1">no período selecionado</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/40 dark:border-green-900 dark:bg-green-950/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita — {periodLabel[period]}</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmt(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">com os filtros aplicados</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters — same style as Store */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar perfume..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full border border-border bg-transparent pl-9 pr-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring hover:border-foreground/50"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
                category !== "TODOS" ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/50"
              }`}>
                {category === "TODOS" ? "Gênero" : category.charAt(0) + category.slice(1).toLowerCase()}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="start">
              {["TODOS", "FEMININO", "MASCULINO", "UNISSEX"].map((opt) => (
                <button key={opt} onClick={() => setCategory(opt)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${category === opt ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                  {opt === "TODOS" ? "Todos" : opt.charAt(0) + opt.slice(1).toLowerCase()}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Family */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
                family !== "TODOS" ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/50"
              }`}>
                {family === "TODOS" ? "Família Olfativa" : family.charAt(0) + family.slice(1).toLowerCase()}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              {["TODOS","FLORAL","AMADEIRADO","CITRICO","ORIENTAL","AQUATICO","FRUTADO","GOURMAND"].map((opt) => (
                <button key={opt} onClick={() => setFamily(opt)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${family === opt ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                  {opt === "TODOS" ? "Todas" : opt.charAt(0) + opt.slice(1).toLowerCase()}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Price */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
                minPrice || maxPrice ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/50"
              }`}>
                {!minPrice && !maxPrice ? "Preço" : `R$ ${minPrice || "0"} — R$ ${maxPrice || "∞"}`}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Faixa de Preço</span>
                  <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setMinPrice(""); setMaxPrice("") }}>Limpar</button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Mínimo</label>
                    <Input type="number" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="rounded-lg" />
                  </div>
                  <span className="text-muted-foreground mt-5">—</span>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Máximo</label>
                    <Input type="number" placeholder="∞" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="rounded-lg" />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Promotions */}
          <button
            onClick={() => setOnSale((v) => !v)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
              onSale ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/50"
            }`}
          >
            Promoções
          </button>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-all hover:border-foreground/50 hover:text-foreground">
              <X className="h-3.5 w-3.5" /> Limpar
            </button>
          )}

          <Button variant="ghost" size="icon" onClick={fetchOrders} className="ml-auto">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <span className="text-xs text-muted-foreground">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Active filter badges */}
        {hasFilters && (
          <div className="mb-4 flex flex-wrap gap-2">
            {search && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">
              "{search}" <button onClick={() => setSearch("")} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button>
            </Badge>}
            {category !== "TODOS" && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">
              {category.charAt(0) + category.slice(1).toLowerCase()} <button onClick={() => setCategory("TODOS")} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button>
            </Badge>}
            {family !== "TODOS" && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">
              {family.charAt(0) + family.slice(1).toLowerCase()} <button onClick={() => setFamily("TODOS")} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button>
            </Badge>}
            {onSale && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">
              Promoções <button onClick={() => setOnSale(false)} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button>
            </Badge>}
            {(minPrice || maxPrice) && <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5">
              R$ {minPrice || "0"} — R$ {maxPrice || "∞"} <button onClick={() => { setMinPrice(""); setMaxPrice("") }} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-3 w-3" /></button>
            </Badge>}
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="font-medium">Nenhuma venda encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasFilters ? "Ajuste os filtros" : "Confirme pedidos no painel para ver o relatório"}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Perfume</TableHead>
                        <TableHead className="text-center">Tamanho</TableHead>
                        <TableHead className="text-center">Qtd. Vendida</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => (
                        <TableRow key={p.key}>
                          <TableCell className="font-medium">{p.productName}</TableCell>
                          <TableCell className="text-center"><Badge variant="outline">{p.productSize}ml</Badge></TableCell>
                          <TableCell className="text-center font-mono tabular-nums">{p.totalQuantity}</TableCell>
                          <TableCell className="text-right">{fmt(p.unitPrice)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(p.totalRevenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3">
                    <span className="text-sm font-semibold">{totalUnits} unidades · {filtered.length} produto{filtered.length !== 1 ? "s" : ""}</span>
                    <span className="text-lg font-bold">{fmt(totalRevenue)}</span>
                  </div>
                </div>
                <div className="md:hidden divide-y">
                  {filtered.map((p) => (
                    <div key={p.key} className="p-4 space-y-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{p.productName}</p>
                          <p className="text-xs text-muted-foreground">{p.productSize}ml · {p.totalQuantity} un. vendidas</p>
                        </div>
                        <span className="font-bold">{fmt(p.totalRevenue)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{fmt(p.unitPrice)} / un.</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-4 bg-muted/30 font-semibold">
                    <span>Total ({totalUnits} un.)</span>
                    <span>{fmt(totalRevenue)}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Zerar relatório de vendas</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Isso vai apagar permanentemente todo o histórico de vendas do relatório. Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting ? "Zerando..." : "Sim, zerar tudo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}