import { describe, expect, it } from "vitest"
import type { Product } from "@/lib/types"
import {
  checkCollections,
  collectionFieldLabel,
  collectionsFrom,
  collectionsInput,
  slugify,
  uniqueSlug,
  type CollectionDraft,
} from "./collectionsDraft"
import { NO_PICKER_FILTERS, filterProducts, type PickerFilters } from "./productFilters"

const draft = (extra: Partial<CollectionDraft> = {}): CollectionDraft => ({
  key: "k", id: null, title: "Ofertas", slug: "ofertas", slugEdited: false, products: [], ...extra,
})

describe("identificador do link", () => {
  it.each([
    ["Ofertas Black Friday", "ofertas-black-friday"],
    ["  Mais vendidos da campanha!  ", "mais-vendidos-da-campanha"],
    ["Pré-venda: Dia dos Namorados (50% OFF)", "pre-venda-dia-dos-namorados-50-off"],
    ["Coleção Çítrica", "colecao-citrica"],
    ["🎁", ""],
    ["", ""],
  ])("de %j sai %j", (title, slug) => {
    expect(slugify(title)).toBe(slug)
  })

  it("não passa de 40 caracteres nem termina em hífen", () => {
    const slug = slugify(`${"a".repeat(39)} muito comprido`)
    expect(slug).toBe("a".repeat(39))
  })

  it("não repete o de outra coleção", () => {
    expect(uniqueSlug("Ofertas", [])).toBe("ofertas")
    expect(uniqueSlug("Ofertas", ["ofertas", "ofertas-2"])).toBe("ofertas-3")
    const long = "a".repeat(40)
    expect(uniqueSlug(long, [long])).toBe(`${"a".repeat(38)}-2`)
    expect(uniqueSlug("!!", [""])).toBe("")
  })
})

describe("rascunho das coleções", () => {
  const api = [
    { id: "a", title: "Ofertas", slug: "ofertas", position: 0, products: [{ productId: "p2", position: 0, discount: null }, { productId: "p1", position: 1, discount: null }] },
    { id: "b", title: "Kits", slug: "kits", position: 1, products: [] },
  ]

  it("lê o que a API manda e devolve no mesmo formato", () => {
    const read = collectionsFrom(api)

    expect(read.map((c) => [c.key, c.slugEdited, c.products])).toEqual([["a", true, ["p2", "p1"]], ["b", true, []]])
    expect(collectionsInput(read)).toEqual(api)
  })

  it("numera pela ordem da tela, apara os textos e não inventa id", () => {
    expect(collectionsInput([draft({ title: "  ", slug: " ofertas ", products: ["p3", "p1"] })])).toEqual([{
      title: null,
      slug: "ofertas",
      position: 0,
      products: [{ productId: "p3", position: 0, discount: null }, { productId: "p1", position: 1, discount: null }],
    }])
  })

  it.each([undefined, null, "x", {}])("aceita a falta de coleções (%j)", (value) => {
    expect(collectionsFrom(value)).toEqual([])
  })

  it("exige título e um identificador válido e único", () => {
    expect(checkCollections([draft(), draft({ slug: "kits" })])).toEqual({})
    const errors = checkCollections([
      draft({ title: " " }),
      draft({ slug: "" }),
      draft({ slug: "Ofertas de Natal" }),
      draft(),
      draft({ slug: "a".repeat(41) }),
    ])
    expect(Object.keys(errors)).toEqual([
      "collections[0].title", "collections[1].slug", "collections[2].slug", "collections[3].slug", "collections[4].slug",
    ])
    expect(errors["collections[3].slug"]).toBe("Já existe outra coleção com este identificador.")
  })

  it.each([
    ["collections", "Coleções"],
    ["collections[0].title", "Coleção 1 · Título"],
    ["collections[1].slug", "Coleção 2 · Identificador"],
    ["collections[0].products", "Coleção 1 · Produtos"],
    ["collections[0].products[2].productId", "Coleção 1 · Produto 3"],
    ["collections[0].id", "Coleção 1"],
    ["theme", undefined],
  ])("dá nome ao campo %s", (path, label) => {
    expect(collectionFieldLabel(path)).toBe(label)
  })
})

describe("filtros da escolha de produtos", () => {
  const product = (id: string, extra: Partial<Product>): Product => ({
    id, name: id, brand: "Marca", description: "", price: 100, image: "", size: "100", inStock: true,
    stockQuantity: 5, concentration: "EDP", olfactiveFamily: "FLORAL", category: "feminino", ...extra,
  }) as Product
  // a API manda a categoria em maiúsculas e as famílias separadas por vírgula
  const products = [
    product("1", { name: "Âmbar Noite", brand: "Lattafa", price: 300, category: "MASCULINO" as Product["category"], olfactiveFamily: "ORIENTAL,AMADEIRADO" }),
    product("2", { name: "Brisa", brand: "Armaf", price: 150, originalPrice: 200 }),
    product("3", { name: "Cedro", brand: "Lattafa", price: 90, originalPrice: 90, stockQuantity: 0 }),
    product("4", { name: "Dália", brand: "Afnan", price: 120, inStock: false, category: "UNISSEX" as Product["category"] }),
  ]
  const ids = (filters: Partial<PickerFilters>) =>
    filterProducts(products, { ...NO_PICKER_FILTERS, ...filters }).map((p) => p.id)

  it("sem filtros, mostra todos por nome", () => {
    expect(ids({})).toEqual(["1", "2", "3", "4"])
  })

  it("busca por palavras do nome e da marca, sem diferenciar acentos nem maiúsculas", () => {
    expect(ids({ search: "ambar" })).toEqual(["1"])
    expect(ids({ search: "DALIA" })).toEqual(["4"])
    expect(ids({ search: "lattafa cedro" })).toEqual(["3"])
    expect(ids({ search: "nada" })).toEqual([])
  })

  it("filtra por gênero, família, promoção e disponibilidade, juntos", () => {
    expect(ids({ gender: "MASCULINO" })).toEqual(["1"])
    expect(ids({ gender: "FEMININO" })).toEqual(["2", "3"])
    expect(ids({ family: "AMADEIRADO" })).toEqual(["1"])
    expect(ids({ onSale: true })).toEqual(["2"])
    expect(ids({ available: true })).toEqual(["1", "2"])
    expect(ids({ gender: "FEMININO", available: true })).toEqual(["2"])
  })

  it("ordena por preço sem mexer na lista recebida", () => {
    expect(ids({ sort: "price_asc" })).toEqual(["3", "4", "2", "1"])
    expect(ids({ sort: "price_desc" })).toEqual(["1", "2", "4", "3"])
    expect(products.map((p) => p.id)).toEqual(["1", "2", "3", "4"])
  })
})
