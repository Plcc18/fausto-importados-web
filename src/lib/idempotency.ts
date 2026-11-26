/**
 * `Idempotency-Key`: a API não executa duas vezes uma operação repetida com a mesma chave, devolve a resposta
 * original. A chave vale para UMA ação da pessoa; uma ação nova (ou com outro conteúdo) precisa de outra chave.
 */
import { useState } from "react"

export const IDEMPOTENCY_HEADER = "Idempotency-Key"

export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  // `randomUUID` só existe em contexto seguro (https ou localhost); abrindo pelo IP da rede, não há
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function createIdempotencyKeys() {
  let current: { action: string; key: string } | null = null
  return {
    /** A mesma chave enquanto a ação for a mesma: tentar de novo depois de uma falha de rede não executa em dobro. */
    keyFor(action: string): string {
      if (current?.action !== action) current = { action, key: newIdempotencyKey() }
      return current.key
    },
    /** A ação terminou (ou o formulário foi reaberto): a próxima é outra operação. */
    reset(): void {
      current = null
    },
  }
}

/** Chaves de uma tela, preservadas entre renderizações. */
export function useIdempotencyKeys() {
  return useState(createIdempotencyKeys)[0]
}
