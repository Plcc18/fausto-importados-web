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
}

export interface CartItem {
  product: Product
  quantity: number
}
