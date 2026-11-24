import { describe, expect, it } from "vitest"
import { HttpError, RequestTimeoutError, errorCodeFromError, errorCodeFromStatus } from "./httpErrors"

describe("errorCodeFromStatus", () => {
  it.each([
    [403, "403"], [404, "404"], [500, "500"], [501, "500"], [502, "502"],
    [503, "503"], [504, "504"], [599, "500"], [408, "504"], [429, "503"], [400, "connection"], [401, "connection"],
  ])("%i → %s", (status, code) => {
    expect(errorCodeFromStatus(status)).toBe(code)
  })
})

describe("errorCodeFromError", () => {
  it("5xx vira a tela correspondente", () => {
    expect(errorCodeFromError(new HttpError(502))).toBe("502")
    expect(errorCodeFromError(new HttpError(503))).toBe("503")
    expect(errorCodeFromError(new HttpError(500))).toBe("500")
  })
  it("timeout real vira 504", () => {
    expect(errorCodeFromError(new RequestTimeoutError())).toBe("504")
  })
  it("falha de conexão / resposta inválida vira 'connection'", () => {
    expect(errorCodeFromError(new TypeError("Failed to fetch"))).toBe("connection")
    expect(errorCodeFromError(new SyntaxError("Unexpected token <"))).toBe("connection")
  })
  it("4xx de uma chamada de API não vira tela de página (403/404)", () => {
    expect(errorCodeFromError(new HttpError(403))).toBe("connection")
    expect(errorCodeFromError(new HttpError(404))).toBe("connection")
  })
})
