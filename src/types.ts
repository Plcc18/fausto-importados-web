export type ProductFormData = {
  name: string
  brand: string
  description: string
  price: number | ""
  originalPrice?: number | ""
  image: string
  category: "MASCULINO" | "FEMININO" | "UNISSEX"
  size: number | string
  concentration?: string
  olfactiveFamily?: string
  featured: boolean
  inStock: boolean
}

export const emptyForm: ProductFormData = {
  name: "",
  brand: "",
  description: "",
  price: "",
  originalPrice: "",
  image: "",
  category: "FEMININO",
  size: 100,
  concentration: "",
  olfactiveFamily: "",
  featured: false,
  inStock: true,
}

export type SmartImageUploaderProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  maxSizeMB?: number
  onLoadingChange?: (loading: boolean) => void
}