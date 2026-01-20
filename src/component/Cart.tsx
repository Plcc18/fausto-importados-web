'use client'

import { useState } from 'react'
import type { CartItem } from '@/lib/types'
import { getCartTotal } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { X, Minus, Plus, Trash2, ShoppingBag, Package, Truck } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

// Componente Modal de Checkout
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

interface CartProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
}

// ---------------------
// Modal de Finalização de Pedido
// ---------------------
interface CheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  onCloseCart: () => void
}

function CheckoutModal({ open, onOpenChange, items }: CheckoutModalProps) {
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [payment, setPayment] = useState<'pix' | 'cartao' | 'boleto'>('pix')

  const total = getCartTotal(items)

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value)

  const whatsappBusinessNumber = '5585997621031' // Exemplo: 55 + DDD + número

  const generateOrderMessage = () => {
    const itemsList = items
      .map(
        (item) =>
          `• ${item.quantity}x ${item.product.name} (${item.product.size || '—'}) - ${formatPrice(
            item.product.price * item.quantity
          )}`
      )
      .join('\n')

    const paymentText = {
      pix: '💠 Pix',
      cartao: '💳 Cartão (até 12x)',
      boleto: '📄 Boleto',
    }[payment]

    return (
      `*NOVO PEDIDO - FAUSTO IMPORTADOS*\n\n` +
      `👤 Nome: ${name.trim()}\n` +
      `📱 WhatsApp: ${whatsapp.trim()}\n` +
      `💳 Forma de pagamento: ${paymentText}\n\n` +
      `*🛍️ ITENS DO PEDIDO:*\n${itemsList}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *Total: ${formatPrice(total)}*\n\n` +
      `Aguardo confirmação e dados para pagamento! 🙏\n` +
      `Qualquer dúvida é só chamar! ✨`
    )
  }

  const handleSendOrder = () => {
    if (!name.trim() || !whatsapp.trim()) {
      alert('Por favor, preencha seu nome e número de WhatsApp')
      return
    }

    const message = encodeURIComponent(generateOrderMessage())
    const whatsappUrl = `https://wa.me/${whatsappBusinessNumber}?text=${message}`

    window.open(whatsappUrl, '_blank')

    // Opcional: você pode limpar o carrinho depois do envio
    // onClear()
    // onCloseCart()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0 ">
        <DialogHeader className="px-6 py-5 border-b">
          <DialogTitle className="text-xl">Finalizar seu Pedido</DialogTitle>
        </DialogHeader>


        {/* Resumo dos itens e dados do cliente */}
        <ScrollArea className="flex-1 px-6 sm py-5 overflow-y-auto">
          <div className="space-y-4 grid grid-cols-1 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.product.id} className="flex gap-4">
                <div className="h-20 w-16 rounded-md overflow-hidden bg-muted shrink-0">
                  <img
                    src={item.product.image || '/placeholder.svg'}
                    alt={item.product.name}
                    className="h-full w-full object-contain p-2"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg'
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium leading-tight">{item.product.name}</p>
                  <p className="text-sm text-muted-foreground">{item.product.size}</p>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frete</span>
              <span className="text-emerald-600 font-medium">A combinar via WhatsApp</span>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Dados do cliente + pagamento */}
          <div className="space-y-5">
            <div className='grid grid-cols-1 gap-2'>
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  placeholder="Digite seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="(DDD) 9xxxx-xxxx"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <Label>Forma de pagamento preferida</Label>
              <RadioGroup
                value={payment}
                onValueChange={(value) => setPayment(value as typeof payment)}
                className="grid grid-cols-1 sm:grid-cols-3  gap-2"
              >
                <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:border-primary/60 transition-colors">
                  <RadioGroupItem value="pix" id="r1" />
                  <Label htmlFor="r1" className="flex-1 cursor-pointer font-medium">
                    Pix (mais rápido e recomendado)
                  </Label>
                </div>

                <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:border-primary/60 transition-colors">
                  <RadioGroupItem value="cartao" id="r2" />
                  <Label htmlFor="r2" className="flex-1 cursor-pointer font-medium">
                    Cartão de crédito (até 12x)
                  </Label>
                </div>

                <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:border-primary/60 transition-colors">
                  <RadioGroupItem value="boleto" id="r3" />
                  <Label htmlFor="r3" className="flex-1 cursor-pointer font-medium">
                    Boleto bancário
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </ScrollArea>


        <DialogFooter className="px-6 py-5 border-t bg-background/95">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            onClick={handleSendOrder}
            className="min-w-55 "
            disabled={!name.trim() || !whatsapp.trim()}
          >
            Enviar Pedido pelo WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------
// Componente Principal Cart
// ---------------------
export function Cart({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemove,
  onClear,
}: CartProps) {
  const total = getCartTotal(items)
  const freeShippingThreshold = 300
  const remainingForFreeShipping = freeShippingThreshold - total

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value)

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
              <button
                onClick={onClose}
                className='rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
              >
                <X className='h-5 w-5' />
              </button>
            </div>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium">Carrinho vazio</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adicione fragrâncias para começar suas compras
                </p>
              </div>
              <Button onClick={onClose} className="mt-4 rounded-full">
                Explorar Fragrâncias
              </Button>
            </div>
          ) : (
            <>
              {/* Free Shipping Progress */}
              {remainingForFreeShipping > 0 && (
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Faltam <strong>{formatPrice(remainingForFreeShipping)}</strong> para frete grátis
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground transition-all duration-500"
                      style={{
                        width: `${Math.min((total / freeShippingThreshold) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {remainingForFreeShipping <= 0 && (
                <div className="border-b border-border bg-emerald-50 px-6 py-4 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                    <Truck className="h-4 w-4" />
                    <span className="font-medium">Parabéns! Você ganhou frete grátis!</span>
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 flex flex-col">
                <ScrollArea className="h-full px-6">
                  <div className="space-y-4 py-4">
                    {items.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex gap-4 rounded-xl bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <img
                            src={item.product.image || '/placeholder.svg'}
                            alt={item.product.name}
                            className="h-full w-full object-contain p-3"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg'
                            }}
                          />
                        </div>

                        <div className="flex flex-1 flex-col">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {item.product.brand}
                              </span>
                              <h4 className="text-sm font-medium">{item.product.name}</h4>
                              <p className="text-xs text-muted-foreground">{item.product.size}</p>
                            </div>
                            <button
                              onClick={() => onRemove(item.product.id)}
                              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-auto flex items-center justify-between pt-2">
                            <div className="flex items-center rounded-full border border-border">
                              <button
                                onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                              <button
                                onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="font-semibold">
                              {formatPrice(item.product.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              {/* Footer */}
              <div className="border-t border-border p-6">
                <div className="mb-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Frete</span>
                    <span className={remainingForFreeShipping <= 0 ? 'text-emerald-600' : ''}>
                      {remainingForFreeShipping <= 0 ? 'Grátis' : 'A combinar'}
                    </span>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-lg">Total</span>
                    <span className="text-2xl font-semibold">{formatPrice(total)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    className="w-full gap-2 rounded-full"
                    size="lg"
                    onClick={() => setIsCheckoutOpen(true)}
                  >
                    <Package className="h-5 w-5" />
                    Finalizar Compra
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={onClear}
                  >
                    <Trash2 className="h-4 w-4" />
                    Limpar Carrinho
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal de Checkout */}
      <CheckoutModal
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        items={items}
        onCloseCart={onClose}
      />
    </>
  )
}