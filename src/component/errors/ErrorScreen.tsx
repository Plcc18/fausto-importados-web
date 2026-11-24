import { useEffect, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { ThemeToggle } from "@/component/ThemeToggle"
import { cn } from "@/lib/utils"
import { ROUTES } from "@/routes"

export interface ErrorAction {
  label: string
  /** Rota interna (renderiza um <Link>) */
  to?: string
  /** Ação (renderiza um <button>) — usada por "Tentar novamente" */
  onClick?: () => void
  icon?: LucideIcon
  /** Gira o ícone no hover (ex.: "Tentar novamente") */
  spinIconOnHover?: boolean
}

export interface ErrorScreenProps {
  /** Código exibido (ex.: "403"). Vazio = falha que não é resposta HTTP. Em `showcase` o número faz parte do `visual`. */
  code: string
  title: string
  /** Palavra do título destacada em serif itálico com sublinhado ondulado (assinatura do hero da loja). */
  accent?: string
  description: string
  /** Elemento gráfico da página. */
  visual?: ReactNode
  primaryAction: ErrorAction
  secondaryAction?: ErrorAction
  /**
   * - showcase: composição de destaque (404) — o número é parte do visual
   * - standard: símbolo em círculo + selo do código + texto
   * - quiet: minimalista e acolhedor (503) — logo maior, sem símbolo
   */
  variant?: "showcase" | "standard" | "quiet"
  /** `page` ocupa a tela toda; `embedded` vive dentro de outra página (ex.: vitrine). */
  layout?: "page" | "embedded"
}

const step = (n: number): CSSProperties => ({ animationDelay: `${n * 120}ms` })

function ActionButton({ action, primary }: { action: ErrorAction; primary: boolean }) {
  const Icon = action.icon
  const content = (
    <>
      {Icon && (
        <Icon
          className={cn(
            "transition-transform duration-500",
            action.spinIconOnHover && "group-hover:-rotate-180"
          )}
        />
      )}
      {action.label}
    </>
  )
  // Mesmo padrão dos botões da loja: pílula; principal = foreground, secundário = contorno
  const className = cn(
    "group rounded-full px-6 transition-all duration-300 hover:scale-[1.02]",
    primary ? "hover:shadow-lg" : "bg-transparent"
  )
  const variant = primary ? "default" : "outline"

  if (action.to) {
    // `#hash` não é tratado pelo <Link> em navegação SPA; âncora comum faz o navegador rolar até ela
    return (
      <Button asChild variant={variant} className={className}>
        {action.to.includes("#") ? <a href={action.to}>{content}</a> : <Link to={action.to}>{content}</Link>}
      </Button>
    )
  }
  return (
    <Button type="button" variant={variant} className={className} onClick={action.onClick}>
      {content}
    </Button>
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

/** Selo em pílula (mesmo desenho do selo "2026 + Elegante" do hero), com o código do erro. */
function CodePill({ code, className }: { code: string; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-1.5 backdrop-blur-sm",
        className
      )}
    >
      <span className="h-2 w-2 rounded-full bg-gold-500" />
      <span className="text-xs font-medium tracking-wide text-muted-foreground">
        {code ? `Erro ${code}` : "Falha de conexão"}
      </span>
    </div>
  )
}

/** Título com a palavra de destaque em serif itálico + sublinhado ondulado, como no hero da loja. */
function Title({ text, accent }: { text: string; accent?: string }) {
  const index = accent ? text.indexOf(accent) : -1
  if (!accent || index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <span className="relative inline-block font-serif italic">
        {accent}
        <svg
          aria-hidden="true"
          className="absolute -bottom-2 left-0 h-3 w-full text-primary/30"
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
        >
          <path d="M0 9 Q 25 0, 50 9 T 100 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
      {text.slice(index + accent.length)}
    </>
  )
}

/**
 * Estrutura única de todas as telas de erro: o que muda entre códigos é só
 * conteúdo, elemento visual, ações e `variant`. Usa os tokens e componentes da
 * loja (tema claro/escuro, shadcn Button, header/footer equivalentes).
 */
export function ErrorScreen({
  code,
  title,
  accent,
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
  const actions = (
    <div
      className={cn("error-rise flex flex-col items-center gap-3 sm:flex-row", isPage ? "mt-8" : "mt-8")}
      style={step(6)}
    >
      <ActionButton action={primaryAction} primary />
      {secondaryAction && <ActionButton action={secondaryAction} primary={false} />}
    </div>
  )

  // ── Embutido na vitrine: mesmo desenho do estado vazio da loja ──
  if (!isPage) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center py-24 text-center">
        {variant !== "quiet" && visual && (
          <div className="error-rise mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50" style={step(1)}>
            <div className="h-11 w-11 text-muted-foreground">{visual}</div>
          </div>
        )}
        <CodePill code={code} className="error-rise mb-4" />
        <Heading className="error-rise text-xl font-medium" style={step(3)}>{title}</Heading>
        <p className="error-rise mt-2 max-w-sm text-muted-foreground" style={step(4)}>{description}</p>
        {variant === "quiet" && visual && <div className="error-rise mt-6 w-full" style={step(5)}>{visual}</div>}
        {actions}
      </div>
    )
  }

  const body = (
    <div className={cn("relative flex w-full flex-col items-center", variant === "showcase" ? "max-w-3xl" : "max-w-2xl")}>
      <div className={cn("error-rise", variant === "showcase" ? "mb-3" : "mb-6")} style={step(0)}>
        <img
          src="/logoLoja.png"
          alt="Fausto Importados"
          className={cn(
            "mx-auto w-full object-contain",
            variant === "quiet" ? "max-w-60 sm:max-w-xs" : variant === "showcase" ? "max-w-28 sm:max-w-32" : "max-w-36 sm:max-w-44"
          )}
          style={{ filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.18))" }}
        />
      </div>

      {variant === "showcase" && (
        <div className="error-rise mb-6 w-full max-w-[30rem]" style={step(1)}>{visual}</div>
      )}

      {variant === "standard" && visual && (
        <div
          className="error-rise mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-border/50 bg-muted/50"
          style={step(1)}
        >
          <div className="h-14 w-14 text-foreground/70">{visual}</div>
        </div>
      )}

      {variant !== "showcase" && <CodePill code={code} className="error-rise mb-6" />}

      <Heading
        className="error-rise text-balance text-3xl font-light leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-5xl"
        style={step(3)}
      >
        <Title text={title} accent={accent} />
      </Heading>
      <p className="error-rise mt-5 max-w-md text-balance leading-relaxed text-muted-foreground" style={step(4)}>
        {description}
      </p>

      {variant === "quiet" && visual && <div className="error-rise mt-8 w-full" style={step(5)}>{visual}</div>}

      {actions}
    </div>
  )

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* Header equivalente ao da loja: barra de anúncio + marca + tema */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
        <div className="hidden border-b border-border/30 bg-foreground text-background md:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs tracking-wide">
            <span className="opacity-80">Fragrâncias 100% Originais</span>
            <span className="opacity-80">Parcele em até 12x</span>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex h-16 items-center justify-between gap-4 md:h-20">
            <Link to={ROUTES.home} className="group flex flex-col items-start transition-opacity hover:opacity-80">
              <span className="font-serif text-xl font-medium tracking-tight">Fausto</span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Importados</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mesmo fundo do hero da loja */}
      <main className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden bg-linear-to-b from-muted/50 via-muted/30 to-background px-4 py-10 text-center md:py-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        {body}
      </main>

      <footer className="border-t border-border px-4 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 md:flex-row">
          <p className="text-xs text-muted-foreground">© 2026 Fausto Importados. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link to={ROUTES.terms} className="transition-colors hover:text-foreground">Termos de Uso</Link>
            <Link to={ROUTES.privacy} className="transition-colors hover:text-foreground">Privacidade</Link>
            <Link to={ROUTES.cookies} className="transition-colors hover:text-foreground">Cookies</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
