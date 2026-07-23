'use client'

import { useState, useEffect } from 'react'
import type { CartItem } from '@/lib/types'
import { getCartTotal } from '@/lib/store'
import { Button } from '@/Shadcn-Components/ui/button'
import { ScrollArea } from '@/Shadcn-Components/ui/scroll-area'
import { Separator } from '@/Shadcn-Components/ui/separator'
import { X, Minus, Plus, Trash2, ShoppingBag, Package, AlertTriangle } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/Shadcn-Components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/Shadcn-Components/ui/dialog'
import { Input } from '@/Shadcn-Components/ui/input'
import { Label } from '@/Shadcn-Components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/Shadcn-Components/ui/radio-group'
import Swal from 'sweetalert2'
import { API_URL } from "@/lib/api"

// ─── Props ────────────────────────────────────────────────────────────────────
interface CartProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
  /** IDs de produtos cujo estoque foi reduzido na última reconciliação */
  stockChangedIds?: string[]
  /** Chamado quando o usuário dispensa o aviso de estoque */
  onStockChangedAck?: () => void
}

interface CheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  onCloseCart: () => void
  onClear: () => void
}

// ─── Máscara de telefone brasileiro ──────────────────────────────────────────
function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function isPhoneValid(masked: string): boolean {
  const digits = masked.replace(/\D/g, '')
  return digits.length === 10 || digits.length === 11
}

// ─── Modal de Checkout ────────────────────────────────────────────────────────
function CheckoutModal({ open, onOpenChange, items, onCloseCart, onClear }: CheckoutModalProps) {
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [payment, setPayment] = useState<'pix' | 'cartao' | 'boleto'>('pix')
  const [isSending, setIsSending] = useState(false)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)

  const total = getCartTotal(items)
  const phoneValid = isPhoneValid(whatsapp)

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(value)

  const whatsappBusinessNumber = import.meta.env.VITE_WHATSAPP_NUMBER ?? '5585996375030'

  const generateOrderMessage = () => {
    const itemsList = items
      .map((item) => `• ${item.quantity}x ${item.product.name} ${item.product.size}ml - ${formatPrice(item.product.price * item.quantity)}`)
      .join('\n')
    const paymentText = { pix: 'Pix', cartao: 'Cartão (até 12x)', boleto: 'Boleto' }[payment]
    return (
      `*NOVO PEDIDO - FAUSTO IMPORTADOS*\n\n` +
      `Nome: ${name.trim()}\n` +
      `WhatsApp: ${whatsapp.trim()}\n` +
      `Forma de pagamento: ${paymentText}\n\n` +
      `*ITENS DO PEDIDO:*\n${itemsList}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Total: ${formatPrice(total)}*\n\n` +
      `Aguardo confirmação e dados para pagamento!\n` +
      `Qualquer dúvida é só chamar! `
    )
  }

  const handleSendOrder = async () => {
    if (!name.trim() || !whatsapp.trim()) { alert('Por favor, preencha seu nome e número de WhatsApp'); return }
    if (!phoneValid) { alert('Por favor, insira um número de WhatsApp válido com DDD.'); return }
    setIsSending(true)
    try {
      await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          customerWhatsapp: whatsapp.replace(/\D/g, ''),
          paymentMethod: payment,
          total,
          items: items.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            productSize: item.product.size,
            productCategory: item.product.category?.toUpperCase() ?? '',
            productFamily: item.product.olfactiveFamily?.toUpperCase() ?? '',
            onSale: !!(item.product.originalPrice && item.product.originalPrice > item.product.price),
            quantity: item.quantity,
            unitPrice: item.product.price,
          })),
        }),
      })
    } catch (err) { console.error('Erro ao salvar pedido:', err) }

    const message = encodeURIComponent(generateOrderMessage())
    window.open(`https://wa.me/${whatsappBusinessNumber}?text=${message}`, '_blank')
    setIsSending(false)
    onOpenChange(false)
    onCloseCart()
    onClear()
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && (name.trim() || whatsapp.trim())) {
      setCloseConfirmOpen(true)
    } else {
      onOpenChange(next)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b">
            <DialogTitle className="text-xl">Finalizar seu Pedido</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6 py-5 overflow-y-auto">
            <div className="space-y-4 grid grid-cols-1 sm:grid-cols-2">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-4">
                  <div className="h-20 w-16 rounded-md overflow-hidden bg-white shrink-0">
                    <img src={item.product.image || '/placeholder.svg'} alt={item.product.name} className="h-full w-full object-contain p-2" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-tight">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">{item.product.size}ml</p>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      <span>{item.quantity}x</span>
                      <span className="font-medium">{formatPrice(item.product.price * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-6" />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span className="text-emerald-600 font-medium">A combinar via WhatsApp</span></div>
              <Separator className="my-4" />
              <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{formatPrice(total)}</span></div>
            </div>
            <Separator className="my-6" />
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input id="nome" placeholder="Digite seu nome completo" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="whatsapp">
                    WhatsApp
                    {whatsapp.length > 0 && !phoneValid && <span className="ml-2 text-xs text-destructive">Número inválido</span>}
                    {phoneValid && <span className="ml-2 text-xs text-emerald-600">✓ Válido</span>}
                  </Label>
                  <Input id="whatsapp" placeholder="(85) 99999-9999" value={whatsapp} inputMode="numeric" onChange={(e) => setWhatsapp(maskPhone(e.target.value))} />
                </div>
              </div>
              <div className="grid gap-3">
                <Label>Forma de pagamento preferida</Label>
                <RadioGroup value={payment} onValueChange={(value) => setPayment(value as typeof payment)} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:border-primary/60 transition-colors">
                    <RadioGroupItem value="pix" id="r1" /><Label htmlFor="r1" className="flex-1 cursor-pointer font-medium">Pix (mais rápido e recomendado)</Label>
                  </div>
                  <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:border-primary/60 transition-colors">
                    <RadioGroupItem value="cartao" id="r2" /><Label htmlFor="r2" className="flex-1 cursor-pointer font-medium">Cartão de crédito (até 12x)</Label>
                  </div>
                  <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:border-primary/60 transition-colors">
                    <RadioGroupItem value="boleto" id="r3" /><Label htmlFor="r3" className="flex-1 cursor-pointer font-medium">Boleto bancário</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 py-5 border-t bg-background/95">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Voltar</Button>
            <Button onClick={handleSendOrder} className="min-w-55" disabled={!name.trim() || !whatsapp.trim() || !phoneValid || isSending}>
              {isSending ? 'Enviando...' : 'Enviar Pedido pelo WhatsApp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Cancelar pedido?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Você ainda não enviou o pedido pelo WhatsApp. Se fechar agora, o pedido não chegará até nós.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirmOpen(false)}>Continuar pedido</Button>
            <Button variant="destructive" onClick={() => { setCloseConfirmOpen(false); onOpenChange(false) }}>Sim, cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Cart Principal ───────────────────────────────────────────────────────────
export function Cart({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemove,
  onClear,
  stockChangedIds = [],
  onStockChangedAck,
}: CartProps) {
  const total = getCartTotal(items)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  useEffect(() => {
    if (!isOpen && stockChangedIds.length > 0) onStockChangedAck?.()
  }, [isOpen])

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(value)

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="flex h-full w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-6 py-5">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-lg font-medium">
                <ShoppingBag className="h-5 w-5" />
                Seu Carrinho
                {items.length > 0 && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                    {items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
              </SheetTitle>
              <button onClick={onClose} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
          </SheetHeader>

          {stockChangedIds.length > 0 && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Disponibilidade atualizada</p>
                <p className="text-xs mt-0.5">
                  {stockChangedIds.length === 1
                    ? 'Um produto no seu carrinho teve a quantidade ajustada por falta de estoque.'
                    : `${stockChangedIds.length} produtos foram ajustados por falta de estoque.`}
                </p>
              </div>
              <button onClick={onStockChangedAck} className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-yellow-200 dark:hover:bg-yellow-800">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium">Carrinho vazio</h3>
                <p className="mt-1 text-sm text-muted-foreground">Adicione fragrâncias para começar suas compras</p>
              </div>
              <Button onClick={onClose} className="mt-4 rounded-full">Explorar Fragrâncias</Button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 flex flex-col">
                <ScrollArea className="h-full px-6">
                  <div className="space-y-4 py-4">
                    {items.map((item) => {
                      const wasChanged = stockChangedIds.includes(item.product.id)
                      const isOutOfStock = (item.product.stockQuantity ?? 1) <= 0 || !item.product.inStock
                      return (
                        <div key={item.product.id} className={`flex gap-4 rounded-xl p-3 transition-colors ${wasChanged ? 'bg-yellow-50/60 border border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800' : 'bg-muted/30 hover:bg-muted/50'}`}>
                          <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-white">
                            <img src={item.product.image || '/placeholder.svg'} alt={item.product.name} className="h-full w-full object-contain p-3" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
                            {isOutOfStock && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/75 text-[10px] font-semibold text-destructive">Esgotado</div>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.product.brand}</span>
                                <h4 className="text-sm font-medium">{item.product.name}</h4>
                                <p className="text-xs text-muted-foreground">{item.product.size}ml</p>
                                {wasChanged && (
                                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Quantidade ajustada
                                  </p>
                                )}
                              </div>
                              <button onClick={() => onRemove(item.product.id)} className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-auto flex items-center justify-between pt-2">
                              <div className="flex items-center rounded-full border border-border">
                                <button onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                <button
                                  onClick={() => { const max = item.product.stockQuantity ?? Infinity; if (item.quantity < max) onUpdateQuantity(item.product.id, item.quantity + 1) }}
                                  disabled={item.product.stockQuantity !== undefined && item.quantity >= item.product.stockQuantity}
                                  className="flex h-7 w-7 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <span className="font-semibold">{formatPrice(item.product.price * item.quantity)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div className="border-t border-border p-6">
                <div className="mb-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-lg">Total</span>
                    <span className="text-2xl font-semibold">{formatPrice(total)}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <Button className="w-full gap-2 rounded-full" size="lg" onClick={() => setIsCheckoutOpen(true)}>
                    <Package className="h-5 w-5" />
                    Finalizar Compra
                  </Button>
                  <div className="w-full">
                    <Button variant="outline" className="w-full gap-2" onClick={() => setClearConfirmOpen(true)}>
                      <Trash2 className="h-4 w-4" />
                      Limpar Carrinho
                    </Button>
                    <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
                      <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle>Limpar carrinho</DialogTitle></DialogHeader>
                        <p className="text-muted-foreground">Tem certeza que deseja remover todos os itens do carrinho?</p>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>Cancelar</Button>
                          <Button variant="destructive" onClick={() => {
                            onClear(); setClearConfirmOpen(false); onClose()
                            Swal.fire({ icon: 'success', title: 'Carrinho limpo', text: 'Todos os itens foram removidos do seu carrinho.', timer: 2000, showConfirmButton: false })
                          }}>Limpar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutModal open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen} items={items} onCloseCart={onClose} onClear={onClear} />
    </>
  )
}