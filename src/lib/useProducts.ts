import { useCallback, useEffect, useRef, useState } from "react"
import type { Product } from "@/lib/types"
import { API_URL } from "@/lib/api"

// ─── Configuração ─────────────────────────────────────────────────────────────

/** Chave versionada: se o formato do cache mudar, basta incrementar a versão. */
export const PRODUCTS_CACHE_KEY = "fausto_products_cache_v1"
/** Cache mais velho que isso é descartado (preço/estoque já não são confiáveis). */
export const PRODUCTS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
/**
 * Intervalo entre novas tentativas automáticas. O tamanho do array é o número
 * máximo de retentativas (3 → até 4 requisições no total, nunca infinito).
 */
export const RETRY_DELAYS_MS = [2_000, 4_000, 8_000]
/** Um cold start do Render pode levar ~1 min; passou disso, a tentativa é abortada. */
export const REQUEST_TIMEOUT_MS = 60_000
/** Evita refazer a busca a cada alternância de aba em sequência rápida. */
export const VISIBILITY_REFRESH_MIN_INTERVAL_MS = 30_000

// ─── Estado exposto ao componente ─────────────────────────────────────────────

/**
 * - loading: ainda não há nenhum dado para mostrar (buscando / servidor acordando / retentando)
 * - success: há dados — vindos da API ou do cache local (ver `isFromCache`)
 * - error:   todas as tentativas falharam e não há dados para mostrar
 */
export type ProductsStatus = "loading" | "success" | "error"

export interface ProductsState {
  status: ProductsStatus
  products: Product[]
  /** Os dados exibidos vêm do cache local e ainda NÃO foram confirmados pela API nesta sessão. */
  isFromCache: boolean
  /** Estava exibindo cache e a atualização falhou (dados podem estar desatualizados). */
  refreshFailed: boolean
}

// ─── Cache (localStorage) ─────────────────────────────────────────────────────

interface CacheEntry {
  savedAt: number
  products: Product[]
}

function isProductLike(p: unknown): p is Product {
  if (typeof p !== "object" || p === null) return false
  const o = p as Record<string, unknown>
  return typeof o.id === "string" && typeof o.name === "string" && typeof o.price === "number"
}

export function readProductsCache(now = Date.now()): CacheEntry | null {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CacheEntry> | null
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(parsed.products) ||
      parsed.products.length === 0 ||
      !parsed.products.every(isProductLike)
    ) return null
    if (now - parsed.savedAt > PRODUCTS_CACHE_MAX_AGE_MS || parsed.savedAt > now + 60_000) return null
    return { savedAt: parsed.savedAt, products: parsed.products }
  } catch {
    return null
  }
}

export function writeProductsCache(products: Product[], now = Date.now()): void {
  try {
    const entry: CacheEntry = { savedAt: now, products }
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // Quota excedida / storage bloqueado: o cache é só uma otimização.
  }
}

// ─── Requisição com retentativas ──────────────────────────────────────────────

export class HttpError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.name = "HttpError"
    this.status = status
  }
}

/** Falhas temporárias valem retentativa; erros 4xx do cliente (exceto 408/429) não. */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status >= 500 || error.status === 408 || error.status === 429
  }
  // Rede fora, timeout, resposta que não é JSON/sem `content` (ex.: página de "acordando" do Render)
  return true
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"))
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

async function fetchProductsOnce(signal: AbortSignal, timeoutMs: number): Promise<Product[]> {
  // Controller próprio por tentativa: o timeout aborta só esta tentativa,
  // enquanto `signal` (do chamador) aborta tudo.
  const attempt = new AbortController()
  const onParentAbort = () => attempt.abort()
  signal.addEventListener("abort", onParentAbort, { once: true })
  const timer = setTimeout(() => attempt.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_URL}/api/product`, { signal: attempt.signal })
    if (!response.ok) throw new HttpError(response.status)
    const data = (await response.json()) as { content?: unknown }
    if (!data || !Array.isArray(data.content)) throw new Error("Resposta inesperada da API")
    return data.content as Product[]
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", onParentAbort)
  }
}

export interface FetchOptions {
  retryDelaysMs?: number[]
  timeoutMs?: number
}

/**
 * Busca os produtos. Em falha temporária, tenta de novo com intervalo
 * progressivo (RETRY_DELAYS_MS) e desiste ao esgotar a lista.
 * Se `signal` for abortado, lança AbortError e para imediatamente.
 */
export async function fetchProductsWithRetry(
  signal: AbortSignal,
  { retryDelaysMs = RETRY_DELAYS_MS, timeoutMs = REQUEST_TIMEOUT_MS }: FetchOptions = {}
): Promise<Product[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchProductsOnce(signal, timeoutMs)
    } catch (error) {
      if (signal.aborted) throw error
      if (attempt >= retryDelaysMs.length || !isRetryableError(error)) throw error
      await sleep(retryDelaysMs[attempt], signal)
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function getInitialState(): ProductsState {
  const cached = readProductsCache()
  return cached
    ? { status: "success", products: cached.products, isFromCache: true, refreshFailed: false }
    : { status: "loading", products: [], isFromCache: false, refreshFailed: false }
}

/**
 * Carrega o catálogo de produtos distinguindo loading / erro / sucesso.
 *
 * Estratégia de cache: stale-while-revalidate. Se houver cache válido no
 * localStorage, ele é exibido imediatamente (`isFromCache: true`) enquanto a
 * API é consultada; a resposta da API sempre substitui o cache.
 */
export function useProducts() {
  const [state, setState] = useState<ProductsState>(getInitialState)

  const abortRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)
  const lastFinishedRef = useRef(0)
  // Já existe algo para mostrar (API ou cache)? Decide entre "erro" e "manter o catálogo".
  const hasDataRef = useRef(state.status === "success")

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    inFlightRef.current = true

    try {
      const products = await fetchProductsWithRetry(controller.signal)
      if (controller.signal.aborted) return
      writeProductsCache(products)
      hasDataRef.current = true
      setState({ status: "success", products, isFromCache: false, refreshFailed: false })
    } catch (error) {
      if (controller.signal.aborted) return
      console.error("Erro ao buscar produtos:", error)
      if (hasDataRef.current) {
        // Já há dados na tela: não derruba o catálogo. Só sinaliza se eram do cache.
        setState((prev) => ({ ...prev, refreshFailed: prev.isFromCache }))
      } else {
        setState({ status: "error", products: [], isFromCache: false, refreshFailed: false })
      }
    } finally {
      if (abortRef.current === controller) {
        inFlightRef.current = false
        lastFinishedRef.current = Date.now()
      }
    }
  }, [])

  // Busca inicial + atualização silenciosa ao voltar para a aba
  useEffect(() => {
    void load()

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return
      if (inFlightRef.current) return
      // Sem dados (carregando ou em erro) só o fluxo normal / botão "Tentar novamente" busca
      if (!hasDataRef.current) return
      if (Date.now() - lastFinishedRef.current < VISIBILITY_REFRESH_MIN_INTERVAL_MS) return
      void load()
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      abortRef.current?.abort()
      inFlightRef.current = false
    }
  }, [load])

  /** Nova tentativa manual (botão "Tentar novamente"), sem recarregar a página. */
  const retry = useCallback(() => {
    if (inFlightRef.current) return
    setState((prev) =>
      prev.status === "error"
        ? { ...prev, status: "loading" }
        : { ...prev, refreshFailed: false }
    )
    void load()
  }, [load])

  return { ...state, retry }
}
