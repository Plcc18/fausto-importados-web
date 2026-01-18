import type { Product } from "./types"

export const defaultProducts: Product[] = [
  {
    id: "1",
    name: "Noir Intense",
    brand: "Essence",
    description: "Uma fragrância sofisticada com notas de âmbar, sândalo e baunilha. Perfeita para ocasiões especiais e noites memoráveis.",
    price: 289.90,
    originalPrice: 349.90,
    image: "/products/perfume-1.jpg",
    category: "masculino",
    size: "100ml",
    featured: true,
    inStock: true
  },
  {
    id: "2",
    name: "Rose Élégance",
    brand: "Lumière",
    description: "Delicadas notas de rosa, peônia e musk. Uma fragrância atemporal para mulheres que apreciam elegância.",
    price: 329.90,
    image: "/products/perfume-2.jpg",
    category: "feminino",
    size: "75ml",
    featured: true,
    inStock: true
  },
  {
    id: "3",
    name: "Ocean Breeze",
    brand: "Aqua",
    description: "Frescor do oceano com notas cítricas e marinhas. Ideal para o dia a dia e momentos de descontração.",
    price: 199.90,
    image: "/products/perfume-3.jpg",
    category: "unissex",
    size: "100ml",
    featured: false,
    inStock: true
  },
  {
    id: "4",
    name: "Velvet Night",
    brand: "Essence",
    description: "Mistério e sensualidade em cada gota. Notas de patchouli, íris e couro para uma presença marcante.",
    price: 459.90,
    originalPrice: 529.90,
    image: "/products/perfume-4.jpg",
    category: "feminino",
    size: "50ml",
    featured: true,
    inStock: true
  },
  {
    id: "5",
    name: "Citrus Gold",
    brand: "Soleil",
    description: "Explosão de energia cítrica com bergamota, limão siciliano e um toque de gengibre.",
    price: 179.90,
    image: "/products/perfume-5.jpg",
    category: "masculino",
    size: "100ml",
    featured: false,
    inStock: true
  },
  {
    id: "6",
    name: "Midnight Bloom",
    brand: "Lumière",
    description: "Flores noturnas em perfeita harmonia. Jasmim, tuberosa e ylang-ylang criam uma aura envolvente.",
    price: 399.90,
    image: "/products/perfume-6.jpg",
    category: "feminino",
    size: "75ml",
    featured: true,
    inStock: true
  }
]
