import { describe, expect, it } from "vitest"
import { DECORATION_TYPES } from "./types"
import { DECORATION_KINDS, createParticles } from "./decorations"

describe("createParticles", () => {
  it.each(DECORATION_TYPES)("%s: sempre as mesmas posições (nada pula entre renderizações)", (type) => {
    expect(createParticles(type)).toEqual(createParticles(type))
  })

  it("tipos diferentes não ficam empilhados nas mesmas posições", () => {
    const lefts = (type: (typeof DECORATION_TYPES)[number]) => createParticles(type).map((p) => p.left)

    expect(lefts("SNOW")).not.toEqual(lefts("CONFETTI"))
  })

  it.each(DECORATION_TYPES)("%s: poucas no computador e menos ainda no celular", (type) => {
    const particles = createParticles(type)
    const kind = DECORATION_KINDS[type]

    expect(particles).toHaveLength(kind.count)
    expect(particles.filter((p) => !p.desktopOnly)).toHaveLength(kind.mobileCount)
    expect(kind.count).toBeLessThanOrEqual(14)
  })

  it.each(DECORATION_TYPES)("%s: dentro da tela, pequenas, semitransparentes e já em movimento", (type) => {
    const [minSize, maxSize] = DECORATION_KINDS[type].size
    for (const p of createParticles(type)) {
      expect(p.left).toBeGreaterThanOrEqual(0)
      expect(p.left).toBeLessThanOrEqual(100)
      expect(p.top).toBeGreaterThanOrEqual(4)
      expect(p.top).toBeLessThanOrEqual(92)
      expect(p.size).toBeGreaterThanOrEqual(minSize)
      expect(p.size).toBeLessThanOrEqual(maxSize)
      expect(p.opacity).toBeGreaterThanOrEqual(0.35)
      expect(p.opacity).toBeLessThanOrEqual(0.7)
      // Atraso negativo: começa no meio do caminho (sem todas saírem juntas do topo)
      expect(p.delay).toBeLessThanOrEqual(0)
      expect(-p.delay).toBeLessThanOrEqual(p.duration)
    }
  })

  it.each(DECORATION_TYPES)("%s: as do celular também cobrem a largura toda", (type) => {
    const lefts = createParticles(type).filter((p) => !p.desktopOnly).map((p) => p.left)

    expect(Math.min(...lefts)).toBeLessThan(25)
    expect(Math.max(...lefts)).toBeGreaterThan(75)
  })

  it("espalha pela largura (uma partícula por faixa)", () => {
    const particles = createParticles("SNOW")
    const bands = particles.map((p, i) => Math.floor((p.left / 100) * particles.length) === i || p.left === 100)

    expect(bands.every(Boolean)).toBe(true)
  })
})
