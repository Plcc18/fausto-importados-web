/**
 * Elementos gráficos das páginas de erro. Todos são SVG inline (sem requisições
 * extras), herdam a cor via `currentColor` (dourado) e animam apenas
 * transform/opacity.
 */

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

/** 404: frasco de perfume com o rótulo oval e um sopro de névoa — "esta fragrância não está por aqui". */
export function BottleVisual({ className }: { className?: string }) {
  return (
    <svg {...svgBase} className={className}>
      <g fill="currentColor" stroke="none">
        <circle cx="48" cy="9" r="1.8" className="error-mist" style={{ animationDelay: "0s" }} />
        <circle cx="41" cy="5" r="1.3" className="error-mist" style={{ animationDelay: "1.6s" }} />
        <circle cx="56" cy="6" r="1.5" className="error-mist" style={{ animationDelay: "3s" }} />
      </g>
      <rect x="38" y="14" width="20" height="14" rx="3" />
      <rect x="43" y="28" width="10" height="7" />
      <rect x="25" y="35" width="46" height="50" rx="13" fill="currentColor" fillOpacity="0.08" />
      <ellipse cx="48" cy="61" rx="12" ry="18" />
      <path d="M32 46V74" opacity="0.4" />
    </svg>
  )
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
