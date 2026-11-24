import { describe, expect, it } from "vitest"
import vercelConfig from "../vercel.json"
import { ERROR_ROUTE_CODES, ROUTES } from "./routes"

const { rewrites: allRewrites } = vercelConfig as { rewrites: { source: string; destination: string }[] }

// Rewrites com destino externo são proxies da API (ex.: /auth/*); os demais são rotas do SPA.
const isProxy = (r: { destination: string }) => /^https?:\/\//.test(r.destination)
const rewrites = allRewrites.filter((r) => !isProxy(r))
const proxies = allRewrites.filter(isProxy)

/** Mini-matcher dos `source` usados em vercel.json: literais e `:param(a|b|c)`. */
function matchesRewrite(source: string, pathname: string): boolean {
  const pattern = source.replace(/:\w+\(([^)]+)\)/g, "($1)")
  return new RegExp(`^${pattern}/?$`).test(pathname)
}
const rewritten = (pathname: string) => rewrites.some((r) => matchesRewrite(r.source, pathname))

describe("vercel.json × proxy de /auth", () => {
  it("só /auth/* é repassado para a API (login, refresh e logout ficam na mesma origem do front)", () => {
    expect(proxies).toHaveLength(1)
    const [proxy] = proxies
    expect(proxy.source).toBe("/auth/:path*")
    expect(proxy.destination).toMatch(/^https:\/\/.+\/auth\/:path\*$/) // HTTPS, e mantém o caminho
    // o proxy não vaza para o resto do site: o 404 real das demais URLs continua valendo
    expect(rewritten("/auth/refresh")).toBe(false)
  })
})

describe("vercel.json × rotas do app", () => {
  it("não há fallback catch-all (URLs inexistentes precisam de 404 real)", () => {
    for (const r of rewrites) {
      expect(r.source).not.toMatch(/\(\.\*\)|:path\*|\*/)
    }
    expect(rewritten("/qualquer-coisa")).toBe(false)
    expect(rewritten("/nexus-24/xyz")).toBe(false)
    expect(rewritten("/erro/999")).toBe(false)
  })

  it("toda rota pública (exceto a home, servida pelo index.html) tem rewrite para o SPA", () => {
    for (const path of Object.values(ROUTES)) {
      if (path === ROUTES.home) continue
      expect(rewritten(path), `falta rewrite para ${path}`).toBe(true)
    }
    for (const code of ERROR_ROUTE_CODES) {
      expect(rewritten(`/erro/${code}`), `falta rewrite para /erro/${code}`).toBe(true)
    }
  })

  it("todo rewrite aponta para o index.html", () => {
    for (const r of rewrites) expect(r.destination).toBe("/index.html")
  })

  it("aceita barra final nas rotas válidas", () => {
    expect(rewritten("/termos/")).toBe(true)
  })
})
