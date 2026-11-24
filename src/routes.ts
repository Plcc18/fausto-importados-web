/**
 * Rotas públicas da aplicação (fonte única de verdade).
 *
 * ATENÇÃO: toda rota nova precisa ser adicionada também em `vercel.json`
 * (rewrites). O fallback do SPA é restrito a estas rotas para que URLs
 * inexistentes recebam HTTP 404 real. `src/routes.test.ts` falha se algo
 * ficar fora de sincronia.
 */
export const ROUTES = {
  home: "/",
  terms: "/termos",
  privacy: "/privacidade",
  cookies: "/cookies",
  admin: "/nexus-24",
  adminLogin: "/nexus-24/login",
  adminReport: "/nexus-24/relatorio",
} as const

/** Lê o segmento `:codigo` de `/erro/:codigo` (pré-visualização / link direto das telas de erro). */
export const ERROR_ROUTE_PATTERN = "/erro/:codigo"
export const ERROR_ROUTE_CODES = ["403", "500", "502", "503", "504", "conexao"] as const

/** Âncora da vitrine na home (destino de "Explorar fragrâncias"). */
export const COLLECTION_HASH_ROUTE = `${ROUTES.home}#colecao`
