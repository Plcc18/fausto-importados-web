// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CAMPAIGN_CACHE_KEY, CAMPAIGN_VISIBILITY_MIN_INTERVAL_MS, createCampaignStore, readCampaignCache, type CampaignStore } from "./store"

const NOW = Date.parse("2026-11-27T14:00:00Z")
const HOUR = 60 * 60 * 1000
const IMAGE = "https://res.cloudinary.com/fausto/image/upload/v1/campaigns/banner.webp"

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    type: "BLACK_FRIDAY",
    startsAt: "2026-11-27T03:00:00Z",
    endsAt: "2026-11-27T16:00:00Z",
    updatedAt: "2026-11-26T18:00:00Z",
    theme: {
      dark: { background: "#0B0B0F", foreground: "#F5F1E8", primary: "#C1121F", primaryForeground: "#FFFFFF", accent: "#1F1F27" },
      light: null,
    },
    content: { topBar: null, hero: null, promoImages: [{ image: { url: IMAGE, alt: "x", width: null, height: null }, link: null }] },
    collections: [],
    ...overrides,
  }
}

/** Resposta da API com o cabeçalho `Date` no relógio (falso) atual, como o servidor mandaria. */
function apiResponse(body: unknown, { status = 200, serverDate = Date.now() } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", Date: new Date(serverDate).toUTCString() },
  })
}

const active = (overrides: Record<string, unknown> = {}) => ({
  serverTime: new Date(Date.now()).toISOString(),
  nextChangeAt: "2026-11-27T16:00:00Z",
  campaign: campaign(),
  ...overrides,
})

/** Um fetch que nunca responde, mas respeita o AbortSignal (para testar o timeout). */
const hangingFetch = (_url: string, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
  })

let fetchMock: ReturnType<typeof vi.fn>
let store: CampaignStore | null = null

function startStore(options: Parameters<typeof createCampaignStore>[0] = {}) {
  store = createCampaignStore({ retryDelaysMs: [], timeoutMs: 1_000, ...options })
  const listener = vi.fn()
  store.subscribe(listener)
  return { store, listener }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  store?.stop()
  store = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("carregamento", () => {
  it("busca a campanha e avisa quem assinou", async () => {
    fetchMock.mockResolvedValue(apiResponse(active()))
    const { store, listener } = startStore()

    expect(store.getState()).toEqual({ status: "loading", campaign: null })
    await flush()

    expect(store.getState().status).toBe("ready")
    expect(store.getState().campaign?.id).toBe("c1")
    expect(listener).toHaveBeenCalled()
  })

  it("vários componentes compartilham uma única busca", async () => {
    fetchMock.mockResolvedValue(apiResponse(active()))
    const { store } = startStore()
    store.subscribe(() => {})
    store.subscribe(() => {})
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("sem campanha ativa → tema padrão", async () => {
    fetchMock.mockResolvedValue(apiResponse(active({ campaign: null, nextChangeAt: null })))
    const { store } = startStore()
    await flush()

    expect(store.getState()).toEqual({ status: "ready", campaign: null })
  })
})

describe("falhas", () => {
  it("API fora do ar → tema padrão, sem lançar erro", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    const { store } = startStore()
    await flush()

    expect(store.getState()).toEqual({ status: "ready", campaign: null })
  })

  it("tenta de novo em falha temporária (API acordando)", async () => {
    fetchMock.mockResolvedValueOnce(apiResponse({}, { status: 503 })).mockResolvedValueOnce(apiResponse(active()))
    const { store } = startStore({ retryDelaysMs: [2_000] })
    await flush()
    expect(store.getState().status).toBe("loading")

    await vi.advanceTimersByTimeAsync(2_000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.getState().campaign?.id).toBe("c1")
  })

  it("404 não é tentado de novo", async () => {
    fetchMock.mockResolvedValue(apiResponse({}, { status: 404 }))
    const { store } = startStore({ retryDelaysMs: [2_000, 4_000] })
    await vi.advanceTimersByTimeAsync(10_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.getState()).toEqual({ status: "ready", campaign: null })
  })

  it("API que não responde é abortada no timeout", async () => {
    fetchMock.mockImplementation(hangingFetch)
    const { store } = startStore({ timeoutMs: 5_000 })
    await vi.advanceTimersByTimeAsync(4_999)
    expect(store.getState().status).toBe("loading")

    await vi.advanceTimersByTimeAsync(1)

    expect(store.getState()).toEqual({ status: "ready", campaign: null })
  })

  it("falha na atualização mantém a campanha já exibida", async () => {
    fetchMock.mockResolvedValueOnce(apiResponse(active())).mockRejectedValue(new TypeError("Failed to fetch"))
    const { store } = startStore()
    await flush()

    vi.setSystemTime(NOW + CAMPAIGN_VISIBILITY_MIN_INTERVAL_MS)
    document.dispatchEvent(new Event("visibilitychange"))
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.getState().campaign?.id).toBe("c1")
  })
})

describe("cache local", () => {
  it("guarda a resposta e a usa na próxima visita, antes de a API responder", async () => {
    fetchMock.mockResolvedValue(apiResponse(active()))
    const first = startStore()
    await flush()
    first.store.stop()

    fetchMock.mockImplementation(hangingFetch)
    const { store } = startStore({ timeoutMs: 60_000 })

    expect(store.getState()).toMatchObject({ status: "loading", campaign: { id: "c1" } })
  })

  it("entrega a campanha do cache já na primeira leitura, antes de assinar (sem piscar, T20)", async () => {
    fetchMock.mockResolvedValue(apiResponse(active()))
    const first = startStore()
    await flush()
    first.store.stop()

    store = createCampaignStore({ retryDelaysMs: [], timeoutMs: 1_000 })

    expect(store.getState()).toMatchObject({ status: "loading", campaign: { id: "c1" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("descarta campanha do cache que já terminou", () => {
    localStorage.setItem(
      CAMPAIGN_CACHE_KEY,
      JSON.stringify({ savedAt: NOW - HOUR, clockOffsetMs: 0, response: active({ campaign: campaign({ endsAt: "2026-11-27T13:00:00Z" }), nextChangeAt: null }) }),
    )

    expect(readCampaignCache(localStorage)).toBeNull()
  })

  it("descarta o cache depois do horário de mudança (outra campanha pode ter começado)", () => {
    localStorage.setItem(
      CAMPAIGN_CACHE_KEY,
      JSON.stringify({ savedAt: NOW - HOUR, clockOffsetMs: 0, response: active({ campaign: null, nextChangeAt: "2026-11-27T13:30:00Z" }) }),
    )

    expect(readCampaignCache(localStorage)).toBeNull()
  })

  it("ignora cache alterado à mão (passa pela mesma validação da API)", () => {
    const tampered = active({ campaign: campaign({ theme: { dark: { primary: "red; background: url(x)" }, light: null } }) })
    localStorage.setItem(CAMPAIGN_CACHE_KEY, JSON.stringify({ savedAt: NOW, clockOffsetMs: 0, response: tampered }))
    vi.spyOn(console, "warn").mockImplementation(() => {})

    expect(readCampaignCache(localStorage)?.response.campaign ?? null).toBeNull()
  })

  it("ignora cache corrompido ou com mais de 24 h", () => {
    localStorage.setItem(CAMPAIGN_CACHE_KEY, "{não é json")
    expect(readCampaignCache(localStorage)).toBeNull()

    localStorage.setItem(
      CAMPAIGN_CACHE_KEY,
      JSON.stringify({ savedAt: NOW - 25 * HOUR, clockOffsetMs: 0, response: active({ nextChangeAt: null, campaign: null }) }),
    )
    expect(readCampaignCache(localStorage)).toBeNull()
  })

  it("funciona sem storage (navegador que bloqueia o localStorage)", async () => {
    fetchMock.mockResolvedValue(apiResponse(active()))
    const { store } = startStore({ storage: null })
    await flush()

    expect(store.getState().campaign?.id).toBe("c1")
  })
})

describe("horários", () => {
  it("busca de novo no horário de mudança e tira do ar a campanha que terminou", async () => {
    fetchMock.mockResolvedValueOnce(apiResponse(active())).mockRejectedValue(new TypeError("Failed to fetch"))
    const { store } = startStore()
    await flush()
    expect(store.getState().campaign?.id).toBe("c1")

    // endsAt/nextChangeAt às 16h; agora são 14h. Mesmo com a API fora do ar, a campanha sai do ar no horário.
    await vi.advanceTimersByTimeAsync(2 * HOUR + 5_000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.getState().campaign).toBeNull()
  })

  it("horário de mudança que já passou não vira busca em loop", async () => {
    fetchMock.mockImplementation(async () => apiResponse(active({ campaign: null, nextChangeAt: "2026-11-27T13:00:00Z" })))
    startStore()
    await flush()

    await vi.advanceTimersByTimeAsync(CAMPAIGN_VISIBILITY_MIN_INTERVAL_MS - 1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("usa a hora do servidor, não o relógio do visitante", async () => {
    // O computador do visitante está 1 dia adiantado: pelo relógio dele, a campanha já teria terminado
    vi.setSystemTime(NOW + 24 * HOUR)
    fetchMock.mockResolvedValue(apiResponse(active({ serverTime: "2026-11-27T14:00:00Z" }), { serverDate: NOW }))
    const { store } = startStore()
    await flush()

    expect(store.getState().campaign?.id).toBe("c1")
  })

  it("campanha que ainda não começou (pelo cache) não aparece", () => {
    localStorage.setItem(
      CAMPAIGN_CACHE_KEY,
      JSON.stringify({ savedAt: NOW, clockOffsetMs: 0, response: active({ campaign: campaign({ startsAt: "2026-11-27T15:00:00Z" }) }) }),
    )

    expect(readCampaignCache(localStorage)).toBeNull()
  })
})

describe("volta para a aba", () => {
  it("atualiza ao voltar, mas não em alternâncias rápidas", async () => {
    fetchMock.mockResolvedValue(apiResponse(active()))
    startStore()
    await flush()

    document.dispatchEvent(new Event("visibilitychange"))
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(NOW + CAMPAIGN_VISIBILITY_MIN_INTERVAL_MS)
    document.dispatchEvent(new Event("visibilitychange"))
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("a mesma campanha, sem edição, não avisa os componentes de novo", async () => {
    fetchMock.mockImplementation(async () => apiResponse(active()))
    const { store, listener } = startStore()
    await flush()
    const first = store.getState().campaign
    listener.mockClear()

    vi.setSystemTime(NOW + CAMPAIGN_VISIBILITY_MIN_INTERVAL_MS)
    document.dispatchEvent(new Event("visibilitychange"))
    await flush()

    expect(store.getState().campaign).toBe(first)
    expect(listener).not.toHaveBeenCalled()
  })
})
