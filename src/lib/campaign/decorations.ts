/**
 * Enfeites das campanhas (T25): de cada tipo, quantas partículas, como se mexem e onde ficam.
 *
 * As posições são "sorteadas" por um gerador pseudoaleatório com semente fixa por tipo: a mesma campanha desenha
 * os enfeites sempre nos mesmos lugares (nada pula a cada renderização, e os testes veem sempre o mesmo).
 */
import { DECORATION_TYPES, type DecorationType } from "./types"

export type DecorationMotion = "fall" | "sway" | "rise" | "twinkle"

interface DecorationKind {
  motion: DecorationMotion
  /** Partículas no computador; no celular, `mobileCount` delas, alternadas (espalhadas pela largura toda). */
  count: number
  mobileCount: number
  /** Tamanho em px, duração da volta em s. */
  size: readonly [number, number]
  duration: readonly [number, number]
}

/** Poucas, pequenas e lentas: enfeite, não distração. */
export const DECORATION_KINDS: Record<DecorationType, DecorationKind> = {
  SNOW: { motion: "fall", count: 14, mobileCount: 7, size: [8, 16], duration: [14, 26] },
  CONFETTI: { motion: "fall", count: 14, mobileCount: 7, size: [8, 12], duration: [12, 20] },
  RIBBONS: { motion: "sway", count: 8, mobileCount: 4, size: [16, 24], duration: [16, 24] },
  HEARTS: { motion: "rise", count: 10, mobileCount: 5, size: [12, 20], duration: [16, 26] },
  SPARKLES: { motion: "twinkle", count: 12, mobileCount: 6, size: [10, 18], duration: [3, 6] },
  STARS: { motion: "twinkle", count: 10, mobileCount: 5, size: [10, 16], duration: [4, 7] },
}

export interface Particle {
  /** Posição horizontal e de repouso (a de quem prefere menos movimento), em %. */
  left: number
  top: number
  size: number
  duration: number
  /** Negativo: a animação já começa no meio, sem todos saírem juntos do topo. */
  delay: number
  /** Desvio lateral durante o caminho (vw) e giro (graus). */
  drift: number
  spin: number
  opacity: number
  /** Só no computador (no celular aparecem menos). */
  desktopOnly: boolean
  /** Para tipos com mais de uma cor (confete). */
  variant: number
}

/** Mulberry32: gerador pseudoaleatório pequeno e rápido; a mesma semente dá sempre a mesma sequência. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits))

export function createParticles(type: DecorationType): Particle[] {
  const kind = DECORATION_KINDS[type]
  const random = seededRandom(DECORATION_TYPES.indexOf(type) + 1)
  const between = ([min, max]: readonly [number, number]) => min + random() * (max - min)
  // No celular fica uma a cada `step`: como as posições seguem a ordem da largura, as que ficam cobrem a tela
  // inteira (as primeiras da lista estariam todas do lado esquerdo)
  const step = Math.max(1, Math.round(kind.count / kind.mobileCount))

  return Array.from({ length: kind.count }, (_, index) => {
    // Espalha pela largura em faixas, com um pouco de sorte dentro de cada uma (evita amontoar)
    const left = round(((index + random()) / kind.count) * 100)
    const duration = round(between(kind.duration), 1)
    return {
      left,
      top: round(between([4, 92])),
      size: Math.round(between(kind.size)),
      duration,
      delay: -round(random() * duration, 1),
      drift: round(between([-6, 6])),
      spin: Math.round(between([-360, 360])),
      opacity: round(between([0.35, 0.7])),
      desktopOnly: index % step !== 0,
      variant: Math.floor(random() * 3),
    }
  })
}
