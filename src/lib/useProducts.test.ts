// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { Product } from "@/lib/types"
import {
  PRODUCTS_CACHE_KEY,
  PRODUCTS_CACHE_MAX_AGE_MS,
  RETRY_DELAYS_MS,
  VISIBILITY_REFRESH_MIN_INTERVAL_MS,
  fetchProductsWithRetry,
  readProductsCache,
  useProducts,
  writeProductsCache,
} from "./useProducts"

const product = (id: string, extra: Partial<Product> = {}): Product => ({
  id,
  name: `Perfume ${id}`,
  brand: "Marca",
  description: "",
  price: 100,
  image: "",
  category: "unissex",
  size: "100",
  inStock: true,
  concentration: "edp",
  olfactiveFamily: "floral",
  ...extra,
})

const okResponse = (content: unknown) =>
  ({ ok: true, status: 200, json: async () => ({ content }) }) as Response
const httpResponse = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as Response

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── fetchProductsWithRetry ───────────────────────────────────────────────────

describe("fetchProductsWithRetry", () => {
  const fast = { retryDelaysMs: [1, 1, 1] }

  it("retorna os produtos na primeira tentativa", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([product("1")]))
    const result = await fetchProductsWithRetry(new AbortController().signal, fast)
    expect(result).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("repete em erro 5xx / falha de rede até conseguir", async () => {
    fetchMock
      .mockResolvedValueOnce(httpResponse(503))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okResponse([product("1")]))
    const result = await fetchProductsWithRetry(new AbortController().signal, fast)
    expect(result).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("desiste após esgotar as tentativas (nunca infinito)", async () => {
    fetchMock.mockResolvedValue(httpResponse(502))
    await expect(fetchProductsWithRetry(new AbortController().signal, fast)).rejects.toThrow("HTTP 502")
    expect(fetchMock).toHaveBeenCalledTimes(fast.retryDelaysMs.length + 1)
  })

  it("não repete erros 4xx do cliente", async () => {
    fetchMock.mockResolvedValue(httpResponse(404))
    await expect(fetchProductsWithRetry(new AbortController().signal, fast)).rejects.toThrow("HTTP 404")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("trata resposta sem `content` como falha (e repete)", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(undefined)).mockResolvedValueOnce(okResponse([product("1")]))
    const result = await fetchProductsWithRetry(new AbortController().signal, fast)
    expect(result).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("para de repetir quando o sinal é abortado", async () => {
    fetchMock.mockResolvedValue(httpResponse(503))
    const controller = new AbortController()
    const promise = fetchProductsWithRetry(controller.signal, { retryDelaysMs: [10_000] })
    const assertion = expect(promise).rejects.toBeDefined()
    await Promise.resolve()
    controller.abort()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// ─── cache ────────────────────────────────────────────────────────────────────

describe("cache de produtos", () => {
  it("grava e lê de volta", () => {
    writeProductsCache([product("1")], 1_000)
    expect(readProductsCache(2_000)?.products).toHaveLength(1)
  })

  it("ignora cache expirado, corrompido ou vazio", () => {
    writeProductsCache([product("1")], 1_000)
    expect(readProductsCache(1_000 + PRODUCTS_CACHE_MAX_AGE_MS + 1)).toBeNull()

    localStorage.setItem(PRODUCTS_CACHE_KEY, "{not json")
    expect(readProductsCache()).toBeNull()

    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), products: [{ foo: 1 }] }))
    expect(readProductsCache()).toBeNull()

    writeProductsCache([])
    expect(readProductsCache()).toBeNull()
  })
})

// ─── useProducts ──────────────────────────────────────────────────────────────

describe("useProducts", () => {
  it("fica em loading enquanto a API não responde e depois vai para success", async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)))

    const { result } = renderHook(() => useProducts())
    expect(result.current.status).toBe("loading")
    expect(result.current.products).toEqual([])

    await act(async () => resolve(okResponse([product("1"), product("2")])))
    expect(result.current.status).toBe("success")
    expect(result.current.products).toHaveLength(2)
    expect(result.current.isFromCache).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("API responde com lista vazia → success com 0 produtos (estado vazio legítimo)", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([]))
    const { result } = renderHook(() => useProducts())
    await act(async () => {})
    expect(result.current.status).toBe("success")
    expect(result.current.products).toEqual([])
  })

  it("segue em loading durante as retentativas e só vira error ao esgotá-las; retry() recupera", async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(httpResponse(503))

    const { result } = renderHook(() => useProducts())
    await act(async () => {})
    expect(result.current.status).toBe("loading") // 1ª falha, aguardando retentativa
    expect(fetchMock).toHaveBeenCalledTimes(1)

    for (const delay of RETRY_DELAYS_MS) {
      await act(async () => { await vi.advanceTimersByTimeAsync(delay) })
    }
    expect(fetchMock).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1)
    expect(result.current.status).toBe("error")

    // nada mais é disparado sozinho
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(fetchMock).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1)

    // "Tentar novamente"
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(okResponse([product("1")]))
    act(() => result.current.retry())
    expect(result.current.status).toBe("loading")
    await act(async () => {})
    expect(result.current.status).toBe("success")
    expect(result.current.products).toHaveLength(1)
  })

  it("mostra o cache imediatamente (isFromCache) e troca pelos dados da API", async () => {
    writeProductsCache([product("old")])
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)))

    const { result } = renderHook(() => useProducts())
    expect(result.current.status).toBe("success")
    expect(result.current.isFromCache).toBe(true)
    expect(result.current.products[0].id).toBe("old")

    await act(async () => resolve(okResponse([product("new")])))
    expect(result.current.isFromCache).toBe(false)
    expect(result.current.products[0].id).toBe("new")
    expect(readProductsCache()?.products[0].id).toBe("new")
  })

  it("com cache e API fora: mantém o catálogo e sinaliza refreshFailed (sem tela de erro)", async () => {
    vi.useFakeTimers()
    writeProductsCache([product("old")])
    fetchMock.mockResolvedValue(httpResponse(500))

    const { result } = renderHook(() => useProducts())
    for (const delay of RETRY_DELAYS_MS) {
      await act(async () => { await vi.advanceTimersByTimeAsync(delay) })
    }
    expect(result.current.status).toBe("success")
    expect(result.current.isFromCache).toBe(true)
    expect(result.current.refreshFailed).toBe(true)
    expect(result.current.products[0].id).toBe("old")
  })

  it("não dispara requisição duplicada ao voltar para a aba (em andamento / recente)", async () => {
    vi.useFakeTimers()
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)))
    const { result } = renderHook(() => useProducts())

    // em andamento
    act(() => { document.dispatchEvent(new Event("visibilitychange")) })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => resolve(okResponse([product("1")])))
    expect(result.current.status).toBe("success")

    // acabou de carregar → dentro do intervalo mínimo
    act(() => { document.dispatchEvent(new Event("visibilitychange")) })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // passado o intervalo → atualiza silenciosamente, sem voltar para loading
    await act(async () => { await vi.advanceTimersByTimeAsync(VISIBILITY_REFRESH_MIN_INTERVAL_MS + 1) })
    fetchMock.mockResolvedValueOnce(okResponse([product("1"), product("2")]))
    act(() => { document.dispatchEvent(new Event("visibilitychange")) })
    expect(result.current.status).toBe("success")
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.products).toHaveLength(2)
  })
})
