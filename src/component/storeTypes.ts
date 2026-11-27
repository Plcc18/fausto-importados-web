/** Tipos dos filtros da loja, compartilhados entre o `Store.tsx` e as partes dele (cabeçalho, hero). */
import type React from "react"

export type GenderFilter = 'todos' | 'feminino' | 'masculino' | 'unissex'
export type OlfativeFamily =
  | 'todos' | 'floral' | 'amadeirado' | 'citrico'
  | 'oriental' | 'aquatico' | 'frutado' | 'gourmand'
  | 'aromatico' | 'fougere' | 'chipre' | 'couro'
export type Concentration = 'todos' | 'edt' | 'edp' | 'parfum' | 'extrait'
export type SortKey = 'default' | 'price_asc' | 'price_desc' | 'newest' | 'best_sellers'

export interface Filters {
  gender: GenderFilter
  family: OlfativeFamily
  concentration: Concentration
  minPrice: string
  maxPrice: string
  onSale: boolean
}

export interface QuickFilter {
  id: string
  label: string
  icon: React.ElementType
  description: string
  apply: (filters: Filters) => Filters
  isActive: (filters: Filters) => boolean
}
