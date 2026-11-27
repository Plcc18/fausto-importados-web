import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ROUTES } from "@/routes"

/** Páginas do site, fora a loja, abertas sem recarregar. */
const SPA_PAGES: ReadonlySet<string> = new Set(
  Object.values(ROUTES).filter((path) => path !== ROUTES.home),
)

/**
 * Link vindo de uma campanha (faixa da T22, botões do banner da T23). O `parse.ts` (T16) só deixa passar caminho
 * interno `/...` ou `https://`. Para onde vai:
 * - outra página do site (`/termos`...): navega sem recarregar;
 * - uma coleção da loja (`/?colecao=...`, T24): também sem recarregar, porque a loja reage a esse parâmetro;
 * - o resto da própria loja (`/?produto=...`, `/#colecao`) ou caminho que o servidor trata: navegação normal do
 *   navegador. A loja lê esses parâmetros só ao abrir, e só mudar a URL não faria nada;
 * - externo: outra aba, sem dar à página aberta acesso a esta (`noopener`) nem dizer de onde veio.
 */
export function CampaignLink({ link, className, children }: { link: string; className?: string; children: ReactNode }) {
  const url = new URL(link, window.location.origin)
  // `/termos/` é a mesma página que `/termos` (o Vercel só conhece a forma sem a barra final)
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname
  const isCollectionLink =
    pathname === ROUTES.home && url.hash === "" && url.searchParams.has("colecao")
    && [...url.searchParams.keys()].every((key) => key === "colecao")
  if (link.startsWith("/") && (SPA_PAGES.has(pathname) || isCollectionLink)) {
    return (
      <Link to={pathname + url.search + url.hash} className={className}>
        {children}
      </Link>
    )
  }
  if (link.startsWith("/")) {
    return (
      <a href={link} className={className}>
        {children}
      </a>
    )
  }
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={className}>
      {children}{" "}
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  )
}
