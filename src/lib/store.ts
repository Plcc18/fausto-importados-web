"use client"

import type { Product, CartItem } from "./types"
import { defaultProducts } from "./products-data"

const PRODUCTS_KEY = "perfumaria_products"
const CART_KEY = "perfumaria_cart"

// ============================
// Utils
// ============================

function safeJSONParse<T>(data: string | null, fallback: T): T {
  try {
    return data ? JSON.parse(data) : fallback
  } catch {
    return fallback
  }
}

// ============================
// PRODUCTS
// ============================

export function getProducts(): Product[] {
  if (typeof window === "undefined") return defaultProducts

  const stored = localStorage.getItem(PRODUCTS_KEY)
  return safeJSONParse<Product[]>(stored, defaultProducts)
}

export function saveProducts(products: Product[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))
}

export function addProduct(product: Omit<Product, "id">): Product {
  const products = getProducts()

  const newProduct: Product = {
    ...product,
    id: crypto.randomUUID(), 
  }

  const updated = [...products, newProduct]
  saveProducts(updated)

  return newProduct
}

export function updateProduct(id: string, updates: Partial<Product>): void {
  const products = getProducts()

  const updated = products.map((p) =>
    p.id === id ? { ...p, ...updates } : p
  )

  saveProducts(updated)
}

export function deleteProduct(id: string): void {
  const products = getProducts()

  const filtered = products.filter((p) => p.id !== id)

  saveProducts(filtered)
}

// ============================
// CART
// ============================

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return []

  const stored = localStorage.getItem(CART_KEY)
  return safeJSONParse<CartItem[]>(stored, [])
}

export function saveCart(cart: CartItem[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

export function addToCart(product: Product): void {
  const cart = getCart()

  const existing = cart.find((item) => item.product.id === product.id)

  let updatedCart: CartItem[]

  if (existing) {
    updatedCart = cart.map((item) =>
      item.product.id === product.id
        ? { ...item, quantity: item.quantity + 1 }
        : item
    )
  } else {
    updatedCart = [...cart, { product, quantity: 1 }]
  }

  saveCart(updatedCart)
}

export function removeFromCart(productId: string): void {
  const cart = getCart()

  const filtered = cart.filter((item) => item.product.id !== productId)

  saveCart(filtered)
}

export function updateCartQuantity(productId: string, quantity: number): void {
  const cart = getCart()

  let updatedCart: CartItem[]

  if (quantity <= 0) {
    updatedCart = cart.filter((item) => item.product.id !== productId)
  } else {
    updatedCart = cart.map((item) =>
      item.product.id === productId
        ? { ...item, quantity }
        : item
    )
  }

  saveCart(updatedCart)
}

export function clearCart(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(CART_KEY)
}

export function getCartTotal(cart: CartItem[]): number {
  return cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  )
}

export function getCartCount(cart: CartItem[]): number {
  return cart.reduce((count, item) => count + item.quantity, 0)
}