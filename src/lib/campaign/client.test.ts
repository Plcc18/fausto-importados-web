import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HttpError } from "@/lib/httpErrors"
import { API_URL } from "@/lib/api"
import { InvalidCampaignResponseError, fetchActiveCampaign } from "./client"

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("fetchActiveCampaign", () => {
  it("consulta a rota pública da campanha", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: null, campaign: null }))

    await fetchActiveCampaign()

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/campaigns/active`, expect.any(Object))
  })

  it("sem campanha ativa → campaign null", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: null, campaign: null }))

    await expect(fetchActiveCampaign()).resolves.toEqual({
      serverTime: "2026-11-27T14:00:00Z",
      nextChangeAt: null,
      campaign: null,
    })
  })

  it("campanha malformada → campaign null (tema padrão), sem erro", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: null, campaign: { id: "x", type: "?" } }),
    )

    const response = await fetchActiveCampaign()

    expect(response.campaign).toBeNull()
  })

  it("erro HTTP → HttpError com o status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503))

    await expect(fetchActiveCampaign()).rejects.toEqual(new HttpError(503))
  })

  it("corpo que não é JSON (ex.: página do Render acordando) → InvalidCampaignResponseError", async () => {
    fetchMock.mockResolvedValue(new Response("<html>acordando</html>", { status: 200 }))

    await expect(fetchActiveCampaign()).rejects.toBeInstanceOf(InvalidCampaignResponseError)
  })

  it("envelope fora do formato → InvalidCampaignResponseError", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ campaign: null }))

    await expect(fetchActiveCampaign()).rejects.toBeInstanceOf(InvalidCampaignResponseError)
  })

  it("sempre revalida com a API (cache no-cache)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: null, campaign: null }))

    await fetchActiveCampaign()

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-cache" })
  })

  it("usa o cabeçalho Date como hora do servidor (corpo pode ser o antigo, depois de um 304)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: null, campaign: null }, 200, {
        Date: "Fri, 27 Nov 2026 14:05:30 GMT",
      }),
    )

    const response = await fetchActiveCampaign()

    expect(response.serverTime).toBe("2026-11-27T14:05:30.000Z")
  })

  it("sem cabeçalho Date (ou inválido), mantém o serverTime do corpo", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: null, campaign: null }, 200, { Date: "ontem" }),
    )

    const response = await fetchActiveCampaign()

    expect(response.serverTime).toBe("2026-11-27T14:00:00Z")
  })

  it("repassa o AbortSignal para o fetch", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ serverTime: "2026-11-27T14:00:00Z", nextChangeAt: null, campaign: null }))
    const controller = new AbortController()

    await fetchActiveCampaign(controller.signal)

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal })
  })
})
