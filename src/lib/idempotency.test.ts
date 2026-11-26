import { afterEach, describe, expect, it, vi } from "vitest"
import { createIdempotencyKeys, newIdempotencyKey } from "./idempotency"

/** A API aceita de 16 a 100 caracteres: letras, números, . _ : - */
const ACCEPTED = /^[A-Za-z0-9._:-]{16,100}$/

afterEach(() => vi.unstubAllGlobals())

describe("chaves de idempotência", () => {
  it("são aceitas pela API e não se repetem", () => {
    const keys = Array.from({ length: 50 }, newIdempotencyKey)

    keys.forEach((key) => expect(key).toMatch(ACCEPTED))
    expect(new Set(keys).size).toBe(50)
  })

  it("funcionam sem randomUUID (página aberta por http em outro endereço)", () => {
    const original = globalThis.crypto
    vi.stubGlobal("crypto", { getRandomValues: original.getRandomValues.bind(original) })

    expect(newIdempotencyKey()).toMatch(ACCEPTED)
  })

  it("repetem a chave enquanto a ação for a mesma, e trocam quando ela muda ou termina", () => {
    const keys = createIdempotencyKeys()
    const first = keys.keyFor("complete:1")

    expect(keys.keyFor("complete:1")).toBe(first)
    expect(keys.keyFor("complete:2")).not.toBe(first)

    const second = keys.keyFor("complete:2")
    keys.reset()
    expect(keys.keyFor("complete:2")).not.toBe(second)
  })
})
