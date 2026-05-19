"use client"

import { useEffect, useState } from "react"
import { Button } from "@/Shadcn-Components/ui/button"
import { Badge } from "@/Shadcn-Components/ui/badge"
import { Separator } from "@/Shadcn-Components/ui/separator"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/Shadcn-Components/ui/sheet"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/Shadcn-Components/ui/dialog"
import { Check, X, Clock, CheckCircle, XCircle, RefreshCw, Bell, Trash2 } from "lucide-react"
import { API_URL } from "@/lib/api"

interface OrderItem {
  id: string
  productName: string
  productSize: string
  quantity: number
  unitPrice: number
}

interface Order {
  id: string
  customerName: string
  customerWhatsapp: string
  paymentMethod: string
  total: number
  status: "PENDING" | "COMPLETED" | "CANCELLED"
  items: OrderItem[]
  createdAt: string
}

const paymentLabels: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão (até 12x)",
  boleto: "Boleto",
}

const statusConfig = {
  PENDING: { label: "Pendente", icon: Clock, className: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" },
  COMPLETED: { label: "Concluído", icon: CheckCircle, className: "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" },
  CANCELLED: { label: "Cancelado", icon: XCircle, className: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800" },
}

const authFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, { ...options, credentials: "include" })

interface NotificationsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange?: () => void
}

export function NotificationsPanel({ open, onOpenChange, onStatusChange }: NotificationsPanelProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "COMPLETED" | "CANCELLED">("ALL")
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: "complete" | "cancel" } | null>(null)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const url = filter === "ALL"
        ? `${API_URL}/api/orders`
        : `${API_URL}/api/orders/filter?status=${filter}`
      const res = await authFetch(url)
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Erro ao buscar pedidos:", err)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) fetchOrders()
  }, [open, filter])

  const handleComplete = async (id: string) => {
    const res = await authFetch(`${API_URL}/api/orders/${id}/complete`, { method: "POST" })
    if (res.status === 409) {
      const data = await res.json()
      alert("⚠️ " + (data.error || "Estoque insuficiente para concluir o pedido."))
      return
    }
    await fetchOrders()
    onStatusChange?.()
  }

  const handleCancel = async (id: string) => {
    await authFetch(`${API_URL}/api/orders/${id}/cancel`, { method: "POST" })
    await fetchOrders()
    onStatusChange?.()
  }

  const handleClearHistory = async () => {
    setClearing(true)
    try {
      await authFetch(`${API_URL}/api/orders/clear-history`, { method: "DELETE" })
      // Remove apenas COMPLETED e CANCELLED localmente.
      // Os valores de venda (sales-stats) são calculados pelo backend
      // independentemente — limpar o histórico visual não afeta esses números.
      setOrders((prev) => prev.filter((o) => o.status === "PENDING"))
      setClearConfirmOpen(false)
    } catch (err) {
      console.error("Erro ao limpar histórico:", err)
    } finally {
      setClearing(false)
    }
  }

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value)

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso))

  const pendingCount = orders.filter((o) => o.status === "PENDING").length

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex h-full w-full flex-col p-0 sm:max-w-lg [&>button]:hidden">

          {/* Header */}
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Pedidos
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </SheetTitle>
              <div className="flex items-center gap-1">
                <button
                  onClick={fetchOrders}
                  title="Atualizar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setClearConfirmOpen(true)}
                  title="Limpar histórico de pedidos concluídos e cancelados"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  title="Fechar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Filtros de status */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {(["ALL", "PENDING", "COMPLETED", "CANCELLED"] as const).map((s) => (
                <Button
                  key={s}
                  variant={filter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(s)}
                  className="text-xs h-7"
                >
                  {s === "ALL" ? "Todos" : statusConfig[s].label}
                </Button>
              ))}
            </div>
          </SheetHeader>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {orders.map((order) => {
                  const cfg = statusConfig[order.status]
                  const StatusIcon = cfg.icon
                  return (
                    <div key={order.id} className="rounded-xl border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{order.customerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.customerWhatsapp} · {paymentLabels[order.paymentMethod] ?? order.paymentMethod}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(order.createdAt)}</p>
                        </div>
                        <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.className}`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {item.quantity}x {item.productName} {item.productSize}ml
                            </span>
                            <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{formatPrice(order.total)}</span>
                        {order.status === "PENDING" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-950/30"
                               onClick={() => setConfirmAction({ id: order.id, type: "cancel" })}
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              variant={"outline"}
                              className="gap-1 text-green-600 border-green-200  hover:bg-green-100 hover:text-green-600 dark:border-green-800 dark:hover:bg-green-950/30"
                              onClick={() => setConfirmAction({ id: order.id, type: "complete" })}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Concluir
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmação de limpeza — com aviso explícito sobre vendas */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Limpar histórico de pedidos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Isso vai remover da lista todos os pedidos <strong className="text-foreground">concluídos</strong> e <strong className="text-foreground">cancelados</strong>.
            </p>
            <p>
              Pedidos <strong className="text-foreground">pendentes</strong> não serão removidos.
            </p>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              ✅ Os valores de <strong>vendido hoje, no mês e no ano</strong> não são afetados por esta ação. Para zerar as vendas, use o botão "Zerar todos os valores" no painel principal.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleClearHistory} disabled={clearing}>
              {clearing ? "Limpando..." : "Limpar histórico"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmAction} onOpenChange={(v) => { if (!v) setConfirmAction(null) }}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>
        {confirmAction?.type === "complete" ? "Concluir pedido" : "Cancelar pedido"}
      </DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      {confirmAction?.type === "complete"
        ? "Tem certeza que deseja concluir este pedido? O estoque será descontado."
        : "Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita."}
    </p>
    <DialogFooter>
      <Button variant="outline" onClick={() => setConfirmAction(null)}>
        Voltar
      </Button>
      <Button
        variant={confirmAction?.type === "complete" ? "default" : "destructive"}
        className={confirmAction?.type === "complete" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
        onClick={async () => {
          if (!confirmAction) return
          if (confirmAction.type === "complete") await handleComplete(confirmAction.id)
          else await handleCancel(confirmAction.id)
          setConfirmAction(null)
        }}
      >
        {confirmAction?.type === "complete" ? "Sim, concluir" : "Sim, cancelar"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
    </>
  )
}