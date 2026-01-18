"use client"

import type { Product, CartItem } from "./types"
import { defaultProducts } from "./products-data"

const PRODUCTS_KEY = "perfumaria_products"
const CART_KEY = "perfumaria_cart"

export function getProducts(): Product[] {
  if (typeof window === "undefined") return defaultProducts
  
  const stored = localStorage.getItem(PRODUCTS_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  return defaultProducts
}

export function saveProducts(products: Product[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))
}

export function addProduct(product: Omit<Product, "id">): Product {
  const products = getProducts()
  const newProduct: Product = {
    ...product,
    id: Date.now().toString()
  }
  products.push(newProduct)
  saveProducts(products)
  return newProduct
}

export function updateProduct(id: string, updates: Partial<Product>): void {
  const products = getProducts()
  const index = products.findIndex(p => p.id === id)
  if (index !== -1) {
    products[index] = { ...products[index], ...updates }
    saveProducts(products)
  }
}

export function deleteProduct(id: string): void {
  const products = getProducts()
  const filtered = products.filter(p => p.id !== id)
  saveProducts(filtered)
}

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return []
  
  const stored = localStorage.getItem(CART_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  return []
}

export function saveCart(cart: CartItem[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

export function addToCart(product: Product): void {
  const cart = getCart()
  const existingIndex = cart.findIndex(item => item.product.id === product.id)
  
  if (existingIndex !== -1) {
    cart[existingIndex].quantity += 1
  } else {
    cart.push({ product, quantity: 1 })
  }
  
  saveCart(cart)
}

export function removeFromCart(productId: string): void {
  const cart = getCart()
  const filtered = cart.filter(item => item.product.id !== productId)
  saveCart(filtered)
}

export function updateCartQuantity(productId: string, quantity: number): void {
  const cart = getCart()
  const index = cart.findIndex(item => item.product.id === productId)
  
  if (index !== -1) {
    if (quantity <= 0) {
      cart.splice(index, 1)
    } else {
      cart[index].quantity = quantity
    }
    saveCart(cart)
  }
}

export function clearCart(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(CART_KEY)
}

export function getCartTotal(cart: CartItem[]): number {
  return cart.reduce((total, item) => total + item.product.price * item.quantity, 0)
}

export function getCartCount(cart: CartItem[]): number {
  return cart.reduce((count, item) => count + item.quantity, 0)
}
