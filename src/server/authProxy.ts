/**
 * Proxy de /auth/* para a API (roda como função de borda da Vercel; ver `api/auth.ts`).
 *
 * Por que existe: o cookie de refresh é SameSite=Strict e a Vercel e o Render são sites diferentes, então o front
 * chama /auth/* na própria origem e a Vercel repassa à API. Só que um rewrite simples NÃO entrega o IP do visitante
 * à API: ela só enxerga o endereço de saída da Vercel, o mesmo para todos os usuários, e o limite de tentativas por
 * IP passa a valer para todo mundo junto. Aqui a função lê o IP real (a Vercel o preenche e sobrescreve o que o
 * cliente mandar) e o repassa em `X-Client-IP`, junto com `X-Proxy-Secret`. A API só acredita no IP quando o segredo
 * confere, e (com PROXY_REQUIRE_FOR_AUTH=true) responde 404 em /auth/* a quem não o trouxer.
 *
 * Sem PROXY_SHARED_SECRET a função repassa sem os dois cabeçalhos (a API sem o segredo configurado os ignoraria),
 * o que permite subir o front antes de ligar o segredo na API.
 */

export interface ProxyEnv {
  /** Origem da API, sem barra final. Padrão: a API de produção. */
  API_ORIGIN?: string
  PROXY_SHARED_SECRET?: string
}

export const DEFAULT_API_ORIGIN = "https://fausto-importados-api.onrender.com"

/** Tempo máximo esperando a API. A borda da Vercel exige a primeira resposta em 25 s. */
export const UPSTREAM_TIMEOUT_MS = 24_000

/** Cabeçalhos da requisição que não passam adiante: específicos da conexão, de proxy ou nossos (nunca do cliente). */
const DROP_REQUEST = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "upgrade",
  "content-length",
  "proxy-authorization",
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
  "x-client-ip",
  "x-proxy-secret",
])

/** O corpo já vem decodificado do fetch: estes cabeçalhos da resposta ficariam inconsistentes. */
const DROP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"])

type Fetcher = (input: string, init: RequestInit) => Promise<Response>

/**
 * Caminho de /auth/* e query a repassar à API.
 *
 * O rewrite do vercel.json manda `/auth/:path*` para `/api/auth?path=:path*` (um catch-all em arquivo, `[...path].ts`,
 * não casa rotas com mais de um segmento, como /auth/mfa/setup). Então o caminho vem no parâmetro `path`; como
 * garantia, se ele faltar, vale o próprio endereço (`/auth/...` ou `/api/auth/...`). O parâmetro `path` é nosso e não
 * segue para a API. O destino final ainda é conferido em {@link handleAuthProxy}.
 */
export function authTarget(requestUrl: string): { path: string; search: string } | null {
  const url = new URL(requestUrl)
  const forwarded = new URLSearchParams(url.search)
  const given = forwarded.getAll("path")
  forwarded.delete("path")
  const search = forwarded.size ? `?${forwarded.toString()}` : ""

  if (given.length > 0) {
    const sub = given[given.length - 1].replace(/^\/+/, "")
    return sub ? { path: `/auth/${sub}`, search } : null
  }
  const match = /^(?:\/api)?(\/auth\/.+)$/.exec(url.pathname)
  return match ? { path: match[1], search } : null
}

/** IP do visitante preenchido pela Vercel. Sem ele, nada é enviado (nunca se confia em X-Forwarded-For). */
function visitorIp(headers: Headers): string | null {
  const value = headers.get("x-vercel-forwarded-for") ?? headers.get("x-real-ip")
  const first = value?.split(",")[0]?.trim()
  return first ? first : null
}

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { "content-type": "application/json" } })

export async function handleAuthProxy(
  request: Request,
  env: ProxyEnv,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<Response> {
  const wanted = authTarget(request.url)
  if (!wanted) return json(404, "Not found")

  const origin = new URL(env.API_ORIGIN?.trim() || DEFAULT_API_ORIGIN)
  const target = new URL(wanted.path + wanted.search, origin)
  // Defesa em profundidade: o destino é sempre a API configurada, em /auth/
  if (target.origin !== origin.origin || !target.pathname.startsWith("/auth/")) return json(404, "Not found")

  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const name = key.toLowerCase()
    if (!DROP_REQUEST.has(name) && !name.startsWith("x-vercel-")) headers.append(key, value)
  })
  const secret = env.PROXY_SHARED_SECRET?.trim()
  if (secret) {
    headers.set("x-proxy-secret", secret)
    const ip = visitorIp(request.headers)
    if (ip) headers.set("x-client-ip", ip)
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    ...(hasBody ? { body: request.body, duplex: "half" as const } : {}),
  }

  let upstream: Response
  try {
    upstream = await fetcher(target.toString(), init)
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError"
    return json(timedOut ? 504 : 502, timedOut ? "Gateway timeout" : "Bad gateway")
  }

  const out = new Headers()
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase()
    if (name !== "set-cookie" && !DROP_RESPONSE.has(name)) out.append(key, value)
  })
  // Cada Set-Cookie separado: juntá-los numa linha quebra o parse no navegador
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie)

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out })
}
