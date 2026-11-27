import { useMemo, type CSSProperties, type ReactNode } from "react"
import { createParticles, DECORATION_KINDS, type Particle } from "@/lib/campaign/decorations"
import type { DecorationType } from "@/lib/campaign/types"

/** Formas em SVG (o mesmo em qualquer aparelho, ao contrário de emojis), na cor do texto: os tokens da campanha. */
const SHAPES: Record<DecorationType, ReactNode> = {
  SNOW: (
    <path
      d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  ),
  SPARKLES: <path d="M12 1c1 7 4 10 11 11-7 1-10 4-11 11-1-7-4-10-11-11 7-1 10-4 11-11z" fill="currentColor" />,
  HEARTS: (
    <path
      d="M12 21s-7.6-4.6-9.7-9.3C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.7 0 5.7 3.9 4.3 7.2C19.6 16.4 12 21 12 21z"
      fill="currentColor"
    />
  ),
  RIBBONS: (
    <path
      // Dentro da área do desenho (2 a 22), para as pontas arredondadas do traço não serem cortadas
      d="M7 2c7 3-5 5 2 10s-5 5 2 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  ),
  CONFETTI: <rect x="8" y="3" width="8" height="18" rx="1.5" fill="currentColor" />,
  STARS: <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.2 5.8 20.9l1.6-7L2 9.2l7.1-.6z" fill="currentColor" />,
}

/** Cores pelos tokens: acompanham o tema da campanha e os modos claro e escuro. */
const COLORS: Record<DecorationType, readonly string[]> = {
  // No claro, um cinza visível (branco sumiria no fundo claro); no escuro, branco
  SNOW: ["text-muted-foreground dark:text-white/80"],
  SPARKLES: ["text-(--gold-hi)"],
  HEARTS: ["text-primary"],
  RIBBONS: ["text-primary"],
  CONFETTI: ["text-primary", "text-(--gold-mid)", "text-campaign-badge"],
  STARS: ["text-(--gold-mid)"],
}

function ParticleShape({ type, particle }: { type: DecorationType; particle: Particle }) {
  const colors = COLORS[type]
  const style = {
    left: `${particle.left}%`,
    width: particle.size,
    height: particle.size,
    opacity: particle.opacity,
    "--decor-top": `${particle.top}%`,
    "--decor-duration": `${particle.duration}s`,
    "--decor-delay": `${particle.delay}s`,
    "--decor-drift": `${particle.drift}vw`,
    "--decor-spin": `${particle.spin}deg`,
    "--decor-opacity": particle.opacity,
  } as CSSProperties
  return (
    <svg
      viewBox="0 0 24 24"
      focusable="false"
      style={style}
      className={[
        "campaign-decor",
        `campaign-decor-${DECORATION_KINDS[type].motion}`,
        colors[particle.variant % colors.length],
        particle.desktopOnly ? "hidden md:block" : "block",
      ].join(" ")}
      data-decoration={type}
    >
      {SHAPES[type]}
    </svg>
  )
}

/**
 * Enfeites da campanha (T25), por cima da loja e abaixo do cabeçalho. A camada nunca recebe cliques
 * (`pointer-events-none`), leitores de tela a ignoram (`aria-hidden`), some na impressão e, com "reduzir
 * movimento", os enfeites ficam parados (`index.css`). Sem enfeites ligados, não desenha nada.
 */
export function CampaignDecorations({ decorations }: { decorations: readonly DecorationType[] }) {
  // A lista vem nova a cada resposta da API; o que importa é quais tipos estão ligados (a "chave" deles)
  const key = decorations.join("|")
  const layers = useMemo(
    () => (key ? (key.split("|") as DecorationType[]) : []).map((type) => ({ type, particles: createParticles(type) })),
    [key],
  )
  if (layers.length === 0) return null

  return (
    <div
      aria-hidden="true"
      data-testid="campaign-decorations"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden print:hidden"
    >
      {layers.map(({ type, particles }) =>
        particles.map((particle, index) => <ParticleShape key={`${type}-${index}`} type={type} particle={particle} />),
      )}
    </div>
  )
}
