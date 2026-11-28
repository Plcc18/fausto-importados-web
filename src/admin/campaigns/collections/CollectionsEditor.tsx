import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Shadcn-Components/ui/dialog"
import { ErrorView } from "@/component/errors/ErrorView"
import { CollectionProducts } from "@/admin/campaigns/collections/CollectionProducts"
import {
  MAX_COLLECTIONS,
  MAX_COLLECTION_PRODUCTS,
  uniqueSlug,
  type CollectionDraft,
} from "@/admin/campaigns/collections/collectionsDraft"
import { ProductPicker } from "@/admin/campaigns/collections/ProductPicker"
import { useProductCatalog } from "@/admin/campaigns/collections/useProductCatalog"
import { newKey } from "@/admin/campaigns/content/contentDraft"
import { EmptyPart, Section } from "@/admin/campaigns/content/Section"
import { TextField } from "@/admin/campaigns/content/TextField"

const LIST = "collections"

/** Coleções de produtos da campanha: cada uma vira uma seção da loja. */
export function CollectionsEditor({
  collections,
  savedSlugs,
  errors,
  onChange,
}: {
  collections: CollectionDraft[]
  /** Identificador que cada coleção salva tem no servidor, por id. */
  savedSlugs: ReadonlyMap<string, string>
  errors: Partial<Record<string, string>>
  onChange: (update: (current: CollectionDraft[]) => CollectionDraft[], changed: string[]) => void
}) {
  /** Chave da coleção que está recebendo produtos. */
  const [picking, setPicking] = useState<string | null>(null)
  const [removing, setRemoving] = useState<CollectionDraft | null>(null)
  const { catalog, retry } = useProductCatalog(collections.length > 0)
  const byId = useMemo(
    () => (catalog.status === "ready" ? new Map(catalog.products.map((p) => [p.id, p])) : null),
    [catalog],
  )
  const target = collections.find((c) => c.key === picking)

  const patch = (key: string, change: (item: CollectionDraft, all: CollectionDraft[]) => Partial<CollectionDraft>, changed: string[]) =>
    onChange((all) => all.map((item) => (item.key === key ? { ...item, ...change(item, all) } : item)), changed)

  // os erros são por posição: mudar a lista de coleções invalida os de todas
  const add = () =>
    onChange(
      (all) => [...all, { key: newKey(), id: null, title: "", slug: "", slugEdited: false, products: [] }],
      [LIST],
    )
  const move = (index: number, step: -1 | 1) =>
    onChange((all) => {
      const next = [...all]
      const [item] = next.splice(index, 1)
      next.splice(index + step, 0, item)
      return next
    }, [LIST])
  const remove = (key: string) => onChange((all) => all.filter((item) => item.key !== key), [LIST])

  return (
    <Section
      title="Coleções de produtos"
      description={`Cada coleção vira uma seção da loja, entre o banner e a vitrine, e pode ser aberta por um link. Até ${MAX_COLLECTIONS}, com até ${MAX_COLLECTION_PRODUCTS} produtos cada. Os preços dos produtos não mudam.`}
      error={errors[LIST]}
    >
      {collections.length === 0 ? (
        <EmptyPart text="Sem coleções, a loja mostra só a vitrine." action="Adicionar coleção" onAdd={add} />
      ) : (
        <>
          {catalog.status === "loading" && (
            <p role="status" className="text-sm text-muted-foreground">Carregando os produtos...</p>
          )}
          {catalog.status === "error" && <ErrorView code={catalog.code} layout="embedded" onRetry={retry} />}
          <div className="space-y-4">
            {collections.map((collection, index) => {
              const number = index + 1
              const path = `${LIST}[${index}]`
              const saved = collection.id ? savedSlugs.get(collection.id) : undefined
              const renamed = !!saved && saved !== collection.slug.trim()
              return (
                <fieldset key={collection.key} data-testid={`collection-${number}`} className="space-y-3 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-medium">Coleção {number}</legend>
                  <div className="grid items-start gap-3 sm:grid-cols-2">
                    <TextField
                      label={`Título da coleção ${number}`}
                      value={collection.title}
                      placeholder="Ex.: Ofertas Black Friday"
                      error={errors[`${path}.title`]}
                      hint="Aparece sobre os produtos. Até 60 caracteres."
                      onChange={(title) =>
                        patch(
                          collection.key,
                          (item, all) => ({
                            title,
                            ...(!item.slugEdited && {
                              slug: uniqueSlug(title, all.filter((c) => c.key !== item.key).map((c) => c.slug)),
                            }),
                          }),
                          [`${path}.title`, `${path}.slug`],
                        )
                      }
                    />
                    <TextField
                      label={`Identificador do link da coleção ${number}`}
                      value={collection.slug}
                      error={errors[`${path}.slug`]}
                      hint={collection.slug ? `Link: /?colecao=${collection.slug}` : "Preenchido a partir do título."}
                      onChange={(slug) => patch(collection.key, () => ({ slug, slugEdited: true }), [`${path}.slug`])}
                    />
                  </div>
                  {renamed && (
                    <p role="status" className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">
                      Os links para /?colecao={saved} deixam de abrir esta coleção. Atualize a faixa, os botões e as imagens
                      que usam esse endereço.
                    </p>
                  )}

                  {errors[`${path}.products`] && <p className="text-sm text-destructive">{errors[`${path}.products`]}</p>}
                  {collection.products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Coleção sem produtos não aparece na loja.</p>
                  ) : (
                    <CollectionProducts
                      ids={collection.products}
                      byId={byId}
                      errors={errors}
                      path={`${path}.products`}
                      onChange={(products) => patch(collection.key, () => ({ products }), [`${path}.products`])}
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!byId || collection.products.length >= MAX_COLLECTION_PRODUCTS}
                      aria-label={`Adicionar produtos à coleção ${number}`}
                      onClick={() => setPicking(collection.key)}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar produtos
                    </Button>
                    <span className="mr-auto text-xs text-muted-foreground">
                      {collection.products.length} de {MAX_COLLECTION_PRODUCTS} produtos
                    </span>
                    <Button type="button" variant="outline" size="sm" disabled={index === 0} aria-label={`Subir coleção ${number}`} onClick={() => move(index, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> Subir
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={number === collections.length} aria-label={`Descer coleção ${number}`} onClick={() => move(index, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> Descer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Remover coleção ${number}`}
                      // uma coleção vazia e nunca salva sai sem perguntar
                      onClick={() => (collection.id || collection.products.length > 0 ? setRemoving(collection) : remove(collection.key))}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remover
                    </Button>
                  </div>
                </fieldset>
              )
            })}
          </div>
          {collections.length < MAX_COLLECTIONS && (
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar coleção
            </Button>
          )}
        </>
      )}

      {target && catalog.status === "ready" && (
        <ProductPicker
          title={target.title}
          products={catalog.products}
          current={target.products}
          onClose={() => setPicking(null)}
          onAdd={(ids) => {
            const index = collections.indexOf(target)
            patch(target.key, (item) => ({ products: [...item.products, ...ids] }), [`${LIST}[${index}].products`])
            setPicking(null)
          }}
        />
      )}

      <Dialog open={removing !== null} onOpenChange={(open) => { if (!open) setRemoving(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover a coleção?</DialogTitle>
            <DialogDescription>
              {removing?.title.trim() ? `“${removing.title.trim()}”` : "A coleção"} sai desta campanha, e os links para
              ela deixam de funcionar. Os produtos continuam na loja.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { if (removing) remove(removing.key); setRemoving(null) }}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
