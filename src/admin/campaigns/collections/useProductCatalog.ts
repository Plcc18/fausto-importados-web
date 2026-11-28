import { useEffect, useState } from "react"
import { API_URL } from "@/lib/api"
import { authFetch } from "@/lib/auth"
import { HttpError, type ErrorCode } from "@/lib/httpErrors"
import type { Product } from "@/lib/types"
import { errorScreenCode } from "@/admin/campaigns/api"

export type ProductCatalog =
  | { status: "loading" }
  | { status: "error"; code: ErrorCode }
  | { status: "ready"; products: Product[] }

async function fetchProducts(signal: AbortSignal): Promise<Product[]> {
  // autenticado: a API só informa o estoque a administradores
  const res = await authFetch(`${API_URL}/api/product`, { signal })
  if (!res.ok) throw new HttpError(res.status)
  const body = (await res.json()) as { content?: unknown } | null
  if (!Array.isArray(body?.content)) throw new Error("Resposta inesperada da lista de produtos")
  return body.content as Product[]
}

/**
 * Os produtos ativos da loja, buscados uma vez e só quando fazem falta.
 * @param needed há (ou vai haver) onde mostrá-los
 */
export function useProductCatalog(needed: boolean): { catalog: ProductCatalog; retry: () => void } {
  const [catalog, setCatalog] = useState<ProductCatalog>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  const ready = catalog.status === "ready"

  useEffect(() => {
    if (!needed || ready) return
    const controller = new AbortController()
    fetchProducts(controller.signal).then(
      (products) => { if (!controller.signal.aborted) setCatalog({ status: "ready", products }) },
      (error: unknown) => {
        if (!controller.signal.aborted) setCatalog({ status: "error", code: errorScreenCode(error) })
      },
    )
    return () => controller.abort()
  }, [needed, ready, attempt])

  const retry = () => {
    setCatalog({ status: "loading" })
    setAttempt((n) => n + 1)
  }

  return { catalog, retry }
}
