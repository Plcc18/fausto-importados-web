/**
 * Rotas da aplicação (fonte única de verdade).
 *
 * ATENÇÃO: toda rota nova precisa ser adicionada também em `vercel.json`
 * (rewrites). O fallback do SPA é restrito a estas rotas para que URLs
 * inexistentes recebam HTTP 404 real. `src/routes.test.ts` falha se algo
 * ficar fora de sincronia.
 *
 * A área administrativa NÃO é secreta: a proteção real está na API (autenticação, papel, 2FA e reautenticação).
 * O front só decide o que mostrar — e carrega o código do painel sob demanda, depois de confirmar o administrador.
 */
export const ROUTES = {
  home: "/",
  terms: "/termos",
  privacy: "/privacidade",
  cookies: "/cookies",
  login: "/entrar",
  admin: "/admin",
  adminReport: "/admin/relatorio",
  adminUsers: "/admin/administradores",
  adminCampaigns: "/admin/campanhas",
} as const

/** Lê o segmento `:codigo` de `/erro/:codigo` (pré-visualização / link direto das telas de erro). */
export const ERROR_ROUTE_PATTERN = "/erro/:codigo"
export const ERROR_ROUTE_CODES = ["403", "500", "502", "503", "504", "conexao"] as const

/** Âncora da vitrine na home (destino de "Explorar fragrâncias"). */
export const COLLECTION_HASH_ROUTE = `${ROUTES.home}#colecao`

/**
 * Destino seguro para "voltar para onde eu estava" depois do login: só caminhos internos
 * (evita redirecionamento aberto via `?next=https://...` ou `//site-malicioso`).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null
  if (next === ROUTES.login || next.startsWith(`${ROUTES.login}?`)) return null
  return next
}
