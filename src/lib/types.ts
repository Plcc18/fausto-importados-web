export interface Product {
  concentration: string
  olfactiveFamily: string
  id: string
  name: string
  brand: string
  description: string
  price: number
  originalPrice?: number
  image: string
  category: "masculino" | "feminino" | "unissex"
  size: string
  featured?: boolean
  inStock: boolean
  stockQuantity?: number
  /** Enviada de volta ao editar; a API só a informa a administradores. */
  version?: number
}

export interface CartItem {
  product: Product
  quantity: number
}