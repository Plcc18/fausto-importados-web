/**
 * As coleções de produtos (`collections`, contrato §4.3) como o painel as edita. A ordem das listas é a ordem de
 * exibição na loja.
 */
import { SLUG, asList, asObject, asText, nullable } from "@/admin/campaigns/content/fields"

export const MAX_COLLECTIONS = 8
export const MAX_COLLECTION_PRODUCTS = 60
export const MAX_SLUG = 40

export interface CollectionDraft {
  /** Só da tela: identifica a coleção enquanto ela é editada. */
  key: string
  /** `null` = coleção nova; a API dá o id ao salvar. */
  id: string | null
  title: string
  /** Usado no link `/?colecao=<slug>`. */
  slug: string
  /** Só da tela: a pessoa escolheu o identificador, que deixa de acompanhar o título. */
  slugEdited: boolean
  /** IDs dos produtos, na ordem. */
  products: string[]
}

/** As `collections` recebidas da API → o que o editor mostra. */
export function collectionsFrom(collections: unknown): CollectionDraft[] {
  return asList(collections).map((value, index) => {
    const collection = asObject(value)
    const id = asText(collection?.id) || null
    return {
      key: id ?? `c${index}`,
      id,
      title: asText(collection?.title),
      slug: asText(collection?.slug),
      // o de uma coleção salva pode estar em links por aí: nunca muda sozinho
      slugEdited: true,
      products: asList(collection?.products).flatMap((item) => asText(asObject(item)?.productId) || []),
    }
  })
}

/** O que o editor mostra → as `collections` a enviar. Desconto é da segunda etapa: sempre `null`. */
export const collectionsInput = (collections: CollectionDraft[]) =>
  collections.map(({ id, title, slug, products }, position) => ({
    ...(id && { id }),
    title: nullable(title),
    slug: nullable(slug),
    position,
    products: products.map((productId, index) => ({ productId, position: index, discount: null })),
  }))

/** Identificador a partir de um título: `Ofertas Black Friday` → `ofertas-black-friday`. */
export const slugify = (title: string) =>
  title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/, "")

/** O identificador do título que nenhuma das outras coleções usa (`ofertas`, `ofertas-2`...). */
export function uniqueSlug(title: string, others: readonly string[]): string {
  const base = slugify(title)
  if (!base) return ""
  let slug = base
  for (let n = 2; others.includes(slug); n++) {
    const suffix = `-${n}`
    slug = `${base.slice(0, MAX_SLUG - suffix.length).replace(/-+$/, "")}${suffix}`
  }
  return slug
}

/** O que a API exige mesmo num rascunho: título e um identificador válido e único. */
export function checkCollections(collections: CollectionDraft[]): Record<string, string> {
  const errors: Record<string, string> = {}
  const seen = new Set<string>()
  collections.forEach((collection, index) => {
    const path = `collections[${index}]`
    if (!collection.title.trim()) errors[`${path}.title`] = "Dê um título à coleção."
    const slug = collection.slug.trim()
    if (!slug) errors[`${path}.slug`] = "Informe o identificador do link."
    else if (!SLUG.test(slug) || slug.length > MAX_SLUG) {
      errors[`${path}.slug`] = `Use até ${MAX_SLUG} letras minúsculas sem acento, números e hífens (ex.: ofertas-natal).`
    } else if (seen.has(slug)) errors[`${path}.slug`] = "Já existe outra coleção com este identificador."
    seen.add(slug)
  })
  return errors
}

const FIELD_NAMES: Record<string, string> = { title: "Título", slug: "Identificador", products: "Produtos" }

/** O nome de um campo das coleções (`collections[0].products[2].productId`). */
export function collectionFieldLabel(path: string): string | undefined {
  if (path === "collections") return "Coleções"
  const match = /^collections\[(\d+)\](?:\.(.+))?$/.exec(path)
  if (!match) return undefined
  const [, index, field = ""] = match
  const name = `Coleção ${Number(index) + 1}`
  const product = /^products\[(\d+)\]/.exec(field)
  if (product) return `${name} · Produto ${Number(product[1]) + 1}`
  return FIELD_NAMES[field] ? `${name} · ${FIELD_NAMES[field]}` : name
}
