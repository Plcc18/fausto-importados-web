/** Busca, filtros e ordenação da escolha de produtos. A lista inteira já está carregada: tudo é feito no painel. */
import type { Product } from "@/lib/types"

export const GENDERS = { FEMININO: "Feminino", MASCULINO: "Masculino", UNISSEX: "Unissex" } as const

export const FAMILIES: Record<string, string> = {
  FLORAL: "Floral", AMADEIRADO: "Amadeirado", CITRICO: "Cítrico", ORIENTAL: "Oriental", AQUATICO: "Aquático",
  FRUTADO: "Frutado", GOURMAND: "Gourmand", AROMATICO: "Aromático", FOUGERE: "Fougère", CHIPRE: "Chipre", COURO: "Couro",
}

export const SORTS = { name: "Nome (A–Z)", price_asc: "Menor preço", price_desc: "Maior preço" } as const

export interface PickerFilters {
  search: string
  gender: keyof typeof GENDERS | ""
  family: string
  onSale: boolean
  available: boolean
  sort: keyof typeof SORTS
}

export const NO_PICKER_FILTERS: PickerFilters = {
  search: "", gender: "", family: "", onSale: false, available: false, sort: "name",
}

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

export const isOnSale = (product: Product) => !!product.originalPrice && product.originalPrice > product.price
export const isAvailable = (product: Product) => product.inStock && (product.stockQuantity ?? 1) > 0

export function filterProducts(products: readonly Product[], filters: PickerFilters): Product[] {
  // cada palavra precisa aparecer no nome ou na marca, sem diferenciar acentos
  const words = plain(filters.search).split(/\s+/).filter(Boolean)
  const found = products.filter((product) => {
    const text = plain(`${product.name} ${product.brand}`)
    if (!words.every((word) => text.includes(word))) return false
    // a API devolve a categoria em maiúsculas, embora o tipo diga o contrário
    if (filters.gender && String(product.category).toUpperCase() !== filters.gender) return false
    if (filters.family) {
      const families = (product.olfactiveFamily ?? "").toUpperCase().split(",").map((f) => f.trim())
      if (!families.includes(filters.family)) return false
    }
    if (filters.onSale && !isOnSale(product)) return false
    return !filters.available || isAvailable(product)
  })
  return found.sort((a, b) => {
    if (filters.sort === "price_asc") return a.price - b.price
    if (filters.sort === "price_desc") return b.price - a.price
    return a.name.localeCompare(b.name, "pt-BR")
  })
}

export const formatPrice = (price: number) => price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
