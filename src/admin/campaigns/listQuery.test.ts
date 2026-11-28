import { describe, expect, it } from "vitest"
import { formatDateTime, formatPeriod, startOfDay, startOfNextDay } from "./dates"
import { NO_FILTERS, hasFilters, listQuery, pageQuery, periodError, type ListFilters } from "./listQuery"

const filters = (patch: Partial<ListFilters>) => ({ ...NO_FILTERS, ...patch })
const params = (patch: Partial<ListFilters>) => Object.fromEntries(new URLSearchParams(listQuery(filters(patch))))

describe("datas no horário de Fortaleza", () => {
  it("mostra o horário da loja, qualquer que seja o fuso do computador", () => {
    expect(formatDateTime("2026-11-27T03:00:00Z")).toBe("27/11/2026 às 00:00")
    // 01:30 em UTC ainda é o dia anterior na loja
    expect(formatDateTime("2027-01-01T01:30:00Z")).toBe("31/12/2026 às 22:30")
    expect(formatDateTime("isto não é data")).toBe("data inválida")
  })

  it("descreve o período, inclusive o de um rascunho incompleto", () => {
    expect(formatPeriod("2026-11-27T03:00:00Z", "2026-12-01T03:00:00Z")).toBe("27/11/2026 às 00:00 até 01/12/2026 às 00:00")
    expect(formatPeriod(null, null)).toBe("Sem datas")
    expect(formatPeriod("2026-11-27T03:00:00Z", null)).toBe("27/11/2026 às 00:00 até sem fim")
    expect(formatPeriod(null, "2026-12-01T03:00:00Z")).toBe("sem início até 01/12/2026 às 00:00")
  })

  it("um dia escolhido começa à meia-noite da loja, e o intervalo inclui o último dia", () => {
    expect(startOfDay("2026-11-27")).toBe("2026-11-27T03:00:00.000Z")
    expect(startOfNextDay("2026-11-30")).toBe("2026-12-01T03:00:00.000Z")
    expect(startOfNextDay("2026-12-31")).toBe("2027-01-01T03:00:00.000Z")
  })
})

describe("filtros da listagem", () => {
  it("sem filtro, não envia parâmetro nenhum além da página", () => {
    expect(listQuery(NO_FILTERS)).toBe("")
    expect(pageQuery("", 0)).toBe("page=0&size=20")
    expect(hasFilters(NO_FILTERS)).toBe(false)
  })

  it.each(["DRAFT", "DISABLED", "ARCHIVED"] as const)("a situação %s vai como status", (situation) => {
    expect(params({ situation })).toEqual({ status: situation })
  })

  it.each(["SCHEDULED", "ACTIVE", "EXPIRED"] as const)("a situação %s vai como phase", (situation) => {
    expect(params({ situation })).toEqual({ phase: situation })
  })

  it("combina tipo, período e busca (sem espaços nas pontas)", () => {
    expect(params({ type: "CHRISTMAS", from: "2026-12-01", to: "2026-12-25", q: "  natal " })).toEqual({
      type: "CHRISTMAS",
      from: "2026-12-01T03:00:00.000Z",
      to: "2026-12-26T03:00:00.000Z",
      q: "natal",
    })
    expect(params({ q: "   " })).toEqual({})
  })

  it("aceita um período aberto ou de um dia só e recusa o que a API recusaria", () => {
    expect(periodError(filters({ from: "2026-12-01" }))).toBeNull()
    expect(periodError(filters({ to: "2026-12-01" }))).toBeNull()
    expect(periodError(filters({ from: "2026-12-01", to: "2026-12-01" }))).toBeNull()
    expect(periodError(filters({ from: "2026-12-02", to: "2026-12-01" }))).toMatch(/igual ou posterior/)
    // ano pela metade, enquanto se digita
    expect(periodError(filters({ from: "0202-12-01" }))).toMatch(/entre os anos 2000 e 2099/)
    expect(periodError(filters({ to: "2100-01-01" }))).toMatch(/entre os anos 2000 e 2099/)
  })
})
