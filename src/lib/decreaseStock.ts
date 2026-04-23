import type { CartItem } from "@/lib/types"

/**
 * Chama o backend para decrementar o estoque de cada item do carrinho.
 * Deve ser chamado APÓS o usuário clicar em "Enviar pedido via WhatsApp"
 * e a mensagem for aberta com sucesso.
 *
 * Uso no Cart.tsx:
 *   import { decreaseStockForCart } from "@/lib/decreaseStock"
 *   ...
 *   await decreaseStockForCart(cartItems)
 *   window.open(whatsappUrl, "_blank")
 */
export async function decreaseStockForCart(items: CartItem[]): Promise<void> {
  const payload = items.map((item) => ({
    productId: item.product.id,
    quantity: item.quantity,
  }))

  const response = await fetch("http://localhost:8080/api/product/decrease-stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error("Erro ao atualizar estoque:", text)
    // Não bloqueia o pedido — o WhatsApp abre mesmo assim.
    // O admin pode ajustar o estoque manualmente se necessário.
  }
}