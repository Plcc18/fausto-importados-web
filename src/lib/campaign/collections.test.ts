import { describe, expect, it } from "vitest"
import type { Product } from "@/lib/types"
import { CAMPAIGN_TYPES, type PublicCampaign } from "./types"
import { campaignBadgeLabel, campaignProductIds, resolveCollections } from "./collections"

const product = (id: string) => ({ id, name: `Perfume ${id}`, price: 100 }) as Product

function campaign(collections: PublicCampaign["collections"]): PublicCampaign {
  return { id: "c1", type: "BLACK_FRIDAY", collections } as unknown as PublicCampaign
}

describe("resolveCollections", () => {
  const catalog = [product("p1"), product("p2"), product("p3")]

  it("cruza os IDs com o catálogo, na ordem da campanha", () => {
    const result = resolveCollections(
      campaign([{ title: "Ofertas", slug: "ofertas", position: 0, productIds: ["p3", "p1"] }]),
      catalog,
    )

    expect(result).toEqual([{ title: "Ofertas", slug: "ofertas", products: [catalog[2], catalog[0]] }])
  })

  it("produto fora do catálogo fica de fora; coleção sem nenhum some", () => {
    const result = resolveCollections(
      campaign([
        { title: "Ofertas", slug: "ofertas", position: 0, productIds: ["p2", "sumiu"] },
        { title: "Vazia", slug: "vazia", position: 1, productIds: [] },
        { title: "Só ausentes", slug: "ausentes", position: 2, productIds: ["x", "y"] },
      ]),
      catalog,
    )

    expect(result.map((c) => [c.slug, c.products.map((p) => p.id)])).toEqual([["ofertas", ["p2"]]])
  })

  it("slug repetido: vale a primeira coleção", () => {
    const result = resolveCollections(
      campaign([
        { title: "Ofertas", slug: "ofertas", position: 0, productIds: ["p1"] },
        { title: "Ofertas de novo", slug: "ofertas", position: 1, productIds: ["p2"] },
      ]),
      catalog,
    )

    expect(result.map((c) => c.title)).toEqual(["Ofertas"])
  })

  it("sem campanha ou com catálogo ainda vazio: nenhuma seção", () => {
    expect(resolveCollections(null, catalog)).toEqual([])
    expect(resolveCollections(campaign([{ title: "Ofertas", slug: "ofertas", position: 0, productIds: ["p1"] }]), [])).toEqual([])
  })
})

describe("campaignProductIds", () => {
  const catalog = [product("p1"), product("p2"), product("p3"), product("p7")]

  it("junta os produtos das coleções que estão na tela", () => {
    const collections = resolveCollections(
      campaign([
        { title: "A", slug: "a", position: 0, productIds: ["p1", "p2"] },
        { title: "B", slug: "b", position: 1, productIds: ["p2", "p3", "fora-do-catalogo"] },
      ]),
      catalog,
    )

    expect([...campaignProductIds(collections)].sort()).toEqual(["p1", "p2", "p3"])
  })

  it("produto de uma coleção descartada (slug repetido) não ganha selo", () => {
    const collections = resolveCollections(
      campaign([
        { title: "A", slug: "a", position: 0, productIds: ["p1"] },
        { title: "A de novo", slug: "a", position: 1, productIds: ["p7"] },
      ]),
      catalog,
    )

    expect(campaignProductIds(collections).has("p7")).toBe(false)
  })

  it("sem coleções, nenhum", () => {
    expect(campaignProductIds([]).size).toBe(0)
  })
})

describe("campaignBadgeLabel", () => {
  it.each(CAMPAIGN_TYPES)("tem um texto para %s", (type) => {
    expect(campaignBadgeLabel(type).length).toBeGreaterThan(0)
  })

  it("Black Friday e Natal", () => {
    expect(campaignBadgeLabel("BLACK_FRIDAY")).toBe("Black Friday")
    expect(campaignBadgeLabel("CHRISTMAS")).toBe("Natal")
  })
})
