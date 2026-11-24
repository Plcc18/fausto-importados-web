import { useId } from "react"

/**
 * Elementos gráficos das páginas de erro. Todos são SVG inline (sem requisições
 * extras), herdam a cor via `currentColor` (dourado) e animam apenas
 * transform/opacity.
 */

const MIST = [
  { cx: 95, cy: 38, r: 2.6, delay: "0s" },
  { cx: 80, cy: 28, r: 1.8, delay: "1.4s" },
  { cx: 111, cy: 30, r: 2.1, delay: "2.6s" },
  { cx: 94, cy: 14, r: 1.4, delay: "3.6s" },
]

/** Um "4" em estilo didone: haste grossa, diagonal e travessa finas, serifa na base. */
function Four({ x, gold }: { x: number; gold: string }) {
  return (
    <g transform={`translate(${x} 70)`} stroke={`url(#${gold})`} fill="none">
      <path d="M140 4V300" strokeWidth="30" />
      <path d="M137 4L10 214" strokeWidth="9" strokeLinecap="round" />
      <path d="M2 214H200" strokeWidth="9" strokeLinecap="round" />
      <path d="M106 300H174" strokeWidth="8" strokeLinecap="round" />
    </g>
  )
}

/** 404: "4" + frasco de perfume no lugar do "0" + "4", em acabamento dourado. */
export function PerfumeBottle404({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "")
  const gold = `gold-${uid}`
  const glass = `glass-${uid}`
  const floor = `floor-${uid}`

  return (
    <svg
      viewBox="0 0 700 392"
      className={className}
      role="img"
      aria-label="404"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gold} gradientUnits="userSpaceOnUse" x1="0" y1="70" x2="0" y2="372">
          <stop offset="0" style={{ stopColor: "var(--gold-hi)" }} />
          <stop offset="0.4" style={{ stopColor: "var(--gold-mid)" }} />
          <stop offset="0.75" style={{ stopColor: "var(--gold-lo)" }} />
          <stop offset="1" style={{ stopColor: "var(--gold-deep)" }} />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--glass-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--glass-b)" }} />
        </linearGradient>
        <linearGradient id={floor} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--gold-mid)", stopOpacity: 0 }} />
          <stop offset="0.5" style={{ stopColor: "var(--gold-mid)", stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: "var(--gold-mid)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      <Four x={0} gold={gold} />

      {/* Frasco (o "0") */}
      <g transform="translate(255 70)">
        <g style={{ fill: "var(--gold-hi)" }}>
          {MIST.map((m, i) => (
            <circle key={i} cx={m.cx} cy={m.cy - 34} r={m.r} className="error-mist" style={{ animationDelay: m.delay }} />
          ))}
        </g>
        <rect x="64" y="0" width="62" height="46" rx="9" fill="#0d0d0f" stroke={`url(#${gold})`} strokeWidth="3" />
        <path d="M76 12V34M88 12V34M100 12V34M112 12V34" style={{ stroke: "var(--gold-mid)" }} strokeOpacity="0.28" strokeWidth="1.5" />
        <rect x="72" y="46" width="46" height="9" rx="3" fill="#0d0d0f" stroke={`url(#${gold})`} strokeWidth="2.5" />
        <rect x="78" y="55" width="34" height="26" fill="#0d0d0f" stroke={`url(#${gold})`} strokeWidth="2.5" />
        <rect x="4" y="82" width="182" height="218" rx="38" fill={`url(#${glass})`} stroke={`url(#${gold})`} strokeWidth="3.5" />
        {/* contraforma do "0": o rótulo oval do frasco */}
        <ellipse cx="95" cy="194" rx="50" ry="76" style={{ fill: "var(--gold-mid)" }} fillOpacity="0.05" stroke={`url(#${gold})`} strokeWidth="5" />
        <path d="M27 120V262" style={{ stroke: "var(--glass-shine)" }} strokeOpacity="0.16" strokeWidth="3" strokeLinecap="round" />
        <path d="M160 238V266" style={{ stroke: "var(--glass-shine)" }} strokeOpacity="0.1" strokeWidth="3" strokeLinecap="round" />
      </g>

      <Four x={490} gold={gold} />

      <rect x="0" y="378" width="700" height="1.5" fill={`url(#${floor})`} />
    </svg>
  )
}

const svgBase = {
  viewBox: "0 0 96 96",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  xmlns: "http://www.w3.org/2000/svg",
}

/** 403: selo com fechadura — "área reservada". */
export function SealVisual({ className }: { className?: string }) {
  return (
    <svg {...svgBase} className={className}>
      <circle cx="48" cy="48" r="40" />
      <circle cx="48" cy="48" r="34" strokeDasharray="1 4" opacity="0.6" />
      <circle cx="48" cy="42" r="7" />
      <path d="M45.5 48.5L43.5 66H52.5L50.5 48.5" fill="currentColor" fillOpacity="0.15" />
    </svg>
  )
}

/** 500: gota de essência com ondulações. */
export function DropVisual({ className }: { className?: string }) {
  return (
    <svg {...svgBase} viewBox="0 0 96 110" className={className}>
      <path d="M48 12C48 12 25 42 25 58a23 23 0 0 0 46 0C71 42 48 12 48 12Z" fill="currentColor" fillOpacity="0.1" />
      <path d="M38 60a10 10 0 0 0 8 10" opacity="0.7" />
      {[0, 1.2, 2.4].map((d) => (
        <ellipse key={d} cx="48" cy="94" rx="24" ry="5" className="error-ripple" style={{ animationDelay: `${d}s` }} />
      ))}
    </svg>
  )
}

function Vial({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="6" y="22" width="12" height="9" rx="2" />
      <rect x="9" y="31" width="6" height="6" />
      <rect x="0" y="37" width="24" height="38" rx="7" fill="currentColor" fillOpacity="0.08" />
    </g>
  )
}

/** 502: dois frascos ligados por um fio que se refaz. */
export function LinkedVialsVisual({ className }: { className?: string }) {
  return (
    <svg {...svgBase} className={className}>
      <Vial x={6} />
      <Vial x={66} />
      <path d="M34 58H62" strokeDasharray="4 8" className="error-dash" />
    </svg>
  )
}

/** 504: anel com um trecho em rotação — tempo de espera. */
export function TimeRingVisual({ className }: { className?: string }) {
  return (
    <svg {...svgBase} className={className}>
      <circle cx="48" cy="48" r="38" opacity="0.3" />
      {/* Círculo completo (caixa = relógio) com só um trecho visível: gira em torno do centro certo */}
      <circle cx="48" cy="48" r="38" strokeWidth="2" strokeDasharray="60 179" className="error-spin" />
      <path d="M48 48V28M48 48L62 56" />
      <circle cx="48" cy="48" r="2" fill="currentColor" />
    </svg>
  )
}

/** Falha de comunicação: frasco fechado, com uma órbita tracejada à procura de conexão. */
export function OrbitBottleVisual({ className }: { className?: string }) {
  return (
    <svg {...svgBase} className={className}>
      <circle cx="48" cy="48" r="40" strokeDasharray="2 7" opacity="0.7" className="error-spin" />
      <rect x="42" y="25" width="12" height="9" rx="2" />
      <rect x="45" y="34" width="6" height="6" />
      <rect x="35" y="40" width="26" height="32" rx="8" fill="currentColor" fillOpacity="0.08" />
      <ellipse cx="48" cy="57" rx="6" ry="11" opacity="0.6" />
    </svg>
  )
}

/** 503: discreto — um fio de luz que desliza, como a loja se preparando. */
export function QuietVisual({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="relative mx-auto h-px w-40 overflow-hidden bg-primary/25">
        <div className="error-slide absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-primary to-transparent" />
      </div>
    </div>
  )
}
