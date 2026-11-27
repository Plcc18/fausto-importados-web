import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useActiveCampaign } from "@/lib/campaign/useActiveCampaign"
import { ROUTES } from "@/routes"
import type { CampaignTopBar } from "@/lib/campaign/types"

/**
 * Faixa fina no topo do cabeçalho.
 *
 * - Com campanha que tenha `topBar`: o texto (e o link, se houver) da campanha, com a cor de destaque dela,
 *   visível também no celular (T22).
 * - Sem campanha, ou com `topBar: null`: a faixa de sempre, só no computador (contrato §4.2).
 */
export function StoreTopBar() {
  // Na primeira visita (sem cache), a faixa da campanha aparece quando a API responde e, no celular, empurra a
  // página um pouco. Reservar o espaço deixaria uma faixa vazia em toda loja sem campanha; quem volta já tem o
  // cache (T17/T20) e a recebe na primeira renderização.
  const topBar = useActiveCampaign().campaign?.content.topBar ?? null
  return topBar ? <CampaignTopBarStrip topBar={topBar} /> : <DefaultTopBar />
}

function DefaultTopBar() {
  return (
    <div className="hidden border-b border-border bg-card text-accent-foreground md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs tracking-wide">
        <span className="opacity-80">Fragrâncias 100% Originais</span>
        <span className="opacity-80">Parcele em até 12x</span>
      </div>
    </div>
  )
}

function CampaignTopBarStrip({ topBar }: { topBar: CampaignTopBar }) {
  // O texto vem da API, mas o React o trata sempre como texto (nunca como HTML)
  return (
    <div className="border-b border-border bg-primary text-primary-foreground" data-testid="campaign-top-bar">
      {/* No celular, no máximo 2 linhas: a faixa fica dentro do cabeçalho fixo e não pode tomar a tela */}
      <div className="mx-auto line-clamp-2 max-w-7xl px-4 py-2 text-center text-xs font-medium tracking-wide text-balance md:line-clamp-none md:px-6">
        {topBar.link ? <TopBarLink link={topBar.link}>{topBar.text}</TopBarLink> : topBar.text}
      </div>
    </div>
  )
}

/** Páginas do site, fora a loja, abertas sem recarregar. */
const SPA_PAGES: ReadonlySet<string> = new Set(
  Object.values(ROUTES).filter((path) => path !== ROUTES.home),
)

/**
 * Para onde o link vai (o `parse.ts`, T16, só deixa passar caminho interno `/...` ou `https://`):
 * - outra página do site (`/termos`...): navega sem recarregar;
 * - a própria loja (`/?produto=...`, `/#colecao` e, a partir da T24, `/?colecao=...`) ou caminho que o servidor
 *   trata: navegação normal do navegador. A loja lê esses parâmetros ao abrir, e só mudar a URL não faria nada;
 * - externo: outra aba, sem dar à página aberta acesso a esta (`noopener`) nem dizer de onde veio.
 */
function TopBarLink({ link, children }: { link: string; children: ReactNode }) {
  // Sempre sublinhado: no celular não há "passar o mouse" para descobrir que é um link
  const className = "underline underline-offset-4 hover:opacity-90"
  const url = new URL(link, window.location.origin)
  // `/termos/` é a mesma página que `/termos` (o Vercel só conhece a forma sem a barra final)
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname
  if (link.startsWith("/") && SPA_PAGES.has(pathname)) {
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
