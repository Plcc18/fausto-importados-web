import { useEffect, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { ROUTES } from "@/routes"

export interface ErrorAction {
  label: string
  /** Rota interna (renderiza um <Link>) */
  to?: string
  /** Ação (renderiza um <button>) — usada por "Tentar novamente" */
  onClick?: () => void
}

export interface ErrorScreenProps {
  /** Código exibido (ex.: "403"). Vazio = sem número. Em `showcase` o número faz parte do `visual`. */
  code: string
  title: string
  description: string
  /** Elemento gráfico da página. */
  visual?: ReactNode
  primaryAction: ErrorAction
  secondaryAction?: ErrorAction
  /**
   * - showcase: composição de destaque (404) — o número é parte do visual
   * - standard: símbolo + número em dourado + texto
   * - quiet: minimalista e acolhedor (503) — logo maior, número discreto
   */
  variant?: "showcase" | "standard" | "quiet"
  /** `page` ocupa a tela toda; `embedded` vive dentro de outra página (ex.: vitrine). */
  layout?: "page" | "embedded"
}

const step = (n: number): CSSProperties => ({ animationDelay: `${n * 120}ms` })

const primaryClass =
  "group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-primary px-8 py-3 text-sm font-medium tracking-wide text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_12px_32px_-12px_var(--gold-mid)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"

const secondaryClass =
  "relative text-sm tracking-wide text-foreground/60 transition-colors duration-300 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-primary/70 after:transition-transform after:duration-300 hover:after:scale-x-100"

function ActionButton({ action, className }: { action: ErrorAction; className: string }) {
  if (action.to) {
    // `#hash` não é tratado pelo <Link> em navegação SPA; âncora comum faz o navegador rolar até ela
    return action.to.includes("#") ? (
      <a href={action.to} className={className}>{action.label}</a>
    ) : (
      <Link to={action.to} className={className}>{action.label}</Link>
    )
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  )
}

/** Título da aba + noindex enquanto uma página de erro está na tela (restaura ao sair). */
function usePageMeta(title: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const previousTitle = document.title
    document.title = title
    const robots = document.createElement("meta")
    robots.name = "robots"
    robots.content = "noindex"
    document.head.appendChild(robots)
    return () => {
      document.title = previousTitle
      robots.remove()
    }
  }, [title, enabled])
}

/**
 * Estrutura única de todas as telas de erro: o que muda entre códigos é só
 * conteúdo, elemento visual, ações e `variant`.
 */
export function ErrorScreen({
  code,
  title,
  description,
  visual,
  primaryAction,
  secondaryAction,
  variant = "standard",
  layout = "page",
}: ErrorScreenProps) {
  const isPage = layout === "page"
  usePageMeta(`${title} · Fausto Importados`, isPage)

  const Heading = isPage ? "h1" : "h3"

  const body = (
    <div className={cn("flex w-full flex-col items-center", variant === "showcase" ? "max-w-3xl" : "max-w-xl")}>
      {variant === "showcase" ? (
        <div className={cn("error-rise w-full", isPage ? "mb-8 max-w-[44rem] px-3 sm:px-0" : "mb-6 max-w-md")} style={step(1)}>
          {visual}
        </div>
      ) : (
        <>
          {variant === "standard" && visual && (
            <div className={cn("error-rise text-primary", isPage ? "mb-8 h-24 w-24" : "mb-5 h-16 w-16")} style={step(1)}>
              {visual}
            </div>
          )}
          {code && (
            <div className={cn("error-rise relative", isPage ? "mb-4" : "mb-3")} style={step(2)}>
              {/* 503: halo dourado que "respira" atrás do número — calmo, como a loja se preparando */}
              {variant === "quiet" && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "error-breathe absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-2xl",
                    isPage ? "h-24 w-72" : "h-16 w-48"
                  )}
                />
              )}
              <p
                className={cn(
                  "text-gold-metal font-light lining-nums tracking-[0.18em]",
                  isPage ? "text-6xl sm:text-7xl" : "text-4xl sm:text-5xl",
                  // brilho que desliza lentamente pelos dígitos
                  variant === "quiet" && "error-sheen"
                )}
              >
                <span className="sr-only">Erro </span>
                {code}
              </p>
            </div>
          )}
        </>
      )}

      <Heading
        className={cn(
          "error-rise font-serif font-medium tracking-tight text-foreground text-balance",
          isPage ? "text-3xl sm:text-4xl md:text-5xl" : "text-2xl sm:text-3xl"
        )}
        style={step(3)}
      >
        {title}
      </Heading>
      <p
        className={cn(
          "error-rise mt-4 max-w-md text-balance leading-relaxed text-foreground/60",
          isPage ? "text-base" : "text-sm sm:text-base"
        )}
        style={step(4)}
      >
        {description}
      </p>

      {variant === "quiet" && visual && (
        <div className="error-rise mt-8 w-full" style={step(5)}>{visual}</div>
      )}

      <div
        className={cn("error-rise flex flex-col items-center gap-5 sm:flex-row", variant === "quiet" ? "mt-8" : isPage ? "mt-10" : "mt-8")}
        style={step(6)}
      >
        <ActionButton action={primaryAction} className={primaryClass} />
        {secondaryAction && <ActionButton action={secondaryAction} className={secondaryClass} />}
      </div>
    </div>
  )

  if (!isPage) {
    // Dentro da vitrine: painel com filete dourado, nas cores do tema
    return (
      <div
        role="alert"
        className="relative isolate overflow-hidden rounded-3xl border border-primary/20 bg-card px-6 py-14 text-center text-foreground sm:py-20"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,var(--muted),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(70,70,76,0.45),transparent_70%)]"
        />
        <div className="flex justify-center">{body}</div>
      </div>
    )
  }

  return (
    <main className="relative isolate flex min-h-svh flex-col items-center overflow-hidden bg-background px-6 text-center text-foreground">
      {/* Fundo: grafite suave no topo e um respiro dourado quase imperceptível na base */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,var(--muted),transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(70,70,76,0.5),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(193,154,75,0.09),transparent_70%)]" />
        <div className="absolute inset-3 rounded-[1.75rem] border border-primary/15 sm:inset-5 sm:rounded-[2.25rem]" />
      </div>

      <header className="error-rise pt-8 sm:pt-10" style={step(0)}>
        <Link
          to={ROUTES.home}
          aria-label="Fausto Importados — voltar à loja"
          className="block transition-opacity duration-300 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <img
            src="/logoLoja.png"
            alt="Fausto Importados"
            className={cn("mx-auto w-auto object-contain drop-shadow-[0_6px_28px_rgba(193,154,75,0.18)]", variant === "quiet" ? "h-32 sm:h-40" : "h-24 sm:h-28")}
          />
        </Link>
      </header>

      <div className="flex w-full flex-1 flex-col items-center justify-center py-10">{body}</div>

      <footer className="pb-8 text-[10px] uppercase tracking-[0.35em] text-foreground/30">
        Fausto Importados
      </footer>
    </main>
  )
}
