import { useSyncExternalStore, type CSSProperties } from "react"
import { buttonVariants } from "@/Shadcn-Components/ui/button-variants"
import {
  DEFAULT_DESKTOP_RATIO,
  DEFAULT_MOBILE_RATIO,
  DESKTOP_WIDTHS,
  MOBILE_WIDTHS,
  aspectRatio,
  cloudinarySrcSet,
  cloudinaryUrl,
} from "@/lib/campaign/image"
import type { CampaignHero } from "@/lib/campaign/types"
import { CampaignLink } from "./CampaignLink"

/**
 * Onde vale a imagem de celular: o complemento exato do ponto de quebra `md` do Tailwind (`min-width: 48rem`).
 * Em `rem`, a troca de imagem e a de layout acontecem juntas mesmo com a fonte do navegador aumentada, e não
 * sobra nenhuma largura (nem fracionada, com zoom) em que nenhuma das duas vale.
 */
export const MOBILE_MEDIA = "not all and (min-width: 48rem)"

/** Limite do contrato (§4.2); a API já confere, aqui é só defesa. */
const MAX_BUTTONS = 2

function subscribeToMobile(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {}
  const query = window.matchMedia(MOBILE_MEDIA)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function isMobileNow() {
  return typeof window.matchMedia === "function" && window.matchMedia(MOBILE_MEDIA).matches
}

interface CampaignBannerProps {
  hero: CampaignHero
  /** A imagem não carregou: quem usa o banner volta ao hero de sempre. */
  onImageError: () => void
}

/**
 * Banner principal da campanha (T23). Imagem de celular e de computador por `<picture>`, otimizadas pelo
 * Cloudinary. O título é o único `h1` da página.
 *
 * Layout: a área da imagem tem uma "régua" com a proporção da imagem, que reserva o espaço antes de ela chegar
 * (sem pulo). No celular o texto vem abaixo; no computador fica na mesma célula da grade, sobre a imagem, com um
 * degradê escuro por baixo. Se o texto for mais alto que a proporção, a célula cresce e a imagem a cobre inteira:
 * o texto nunca sai de cima dela.
 */
export function CampaignBanner({ hero, onImageError }: CampaignBannerProps) {
  const desktop = hero.imageDesktop
  const mobile = hero.imageMobile
  // `<source>` não tem `alt`: o texto alternativo acompanha a imagem que está de fato na tela
  const isMobile = useSyncExternalStore(subscribeToMobile, isMobileNow, () => false)
  const alt = mobile && isMobile ? mobile.alt : desktop.alt
  // Chave estável (reordenar no painel não troca o foco de um botão pelo outro); repetidos ganham um sufixo
  const seen = new Map<string, number>()
  const buttons = hero.buttons.slice(0, MAX_BUTTONS).map((button) => {
    const base = `${button.label}|${button.link}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return { button, key: count === 0 ? base : `${base}|${count}` }
  })
  const ratios = {
    "--banner-ratio-mobile": mobile ? aspectRatio(mobile, DEFAULT_MOBILE_RATIO) : aspectRatio(desktop, DEFAULT_DESKTOP_RATIO),
    "--banner-ratio-desktop": aspectRatio(desktop, DEFAULT_DESKTOP_RATIO),
  } as CSSProperties

  return (
    <section className="grid" style={ratios} data-testid="campaign-banner">
      <div className="relative col-start-1 row-start-1 overflow-hidden bg-muted">
        <div aria-hidden data-testid="banner-ratio" className="aspect-(--banner-ratio-mobile) md:aspect-(--banner-ratio-desktop)" />
        <picture>
          {mobile && (
            <source
              media={MOBILE_MEDIA}
              srcSet={cloudinarySrcSet(mobile, MOBILE_WIDTHS)}
              sizes="100vw"
              width={mobile.width ?? undefined}
              height={mobile.height ?? undefined}
            />
          )}
          <img
            src={cloudinaryUrl(desktop.url, 1920)}
            srcSet={cloudinarySrcSet(desktop, DESKTOP_WIDTHS)}
            sizes="100vw"
            alt={alt}
            width={desktop.width ?? undefined}
            height={desktop.height ?? undefined}
            // É o maior elemento do topo da página: carrega antes do resto
            fetchPriority="high"
            decoding="async"
            onError={onImageError}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-linear-to-t from-black/75 via-black/25 to-transparent md:block" />
      </div>

      {/* No computador, um degradê escuro também atrás do texto: legível mesmo se o texto crescer sobre uma parte clara */}
      <div className="relative col-start-1 row-start-2 px-4 pt-8 text-center md:row-start-1 md:self-end md:bg-linear-to-t md:from-black/80 md:via-black/50 md:to-transparent md:px-6 md:pb-12 md:pt-24 md:text-white">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-light leading-tight tracking-tight text-balance sm:text-4xl md:text-5xl lg:text-6xl">
            {hero.title}
          </h1>
          {hero.subtitle && (
            <p className="mt-4 text-base text-balance text-muted-foreground md:text-lg md:text-white/85">{hero.subtitle}</p>
          )}
          {buttons.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {buttons.map(({ button, key }) => (
                <CampaignLink
                  key={key}
                  link={button.link}
                  className={buttonVariants({ variant: button.style === "PRIMARY" ? "default" : "secondary", size: "lg" })}
                >
                  {button.label}
                </CampaignLink>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
