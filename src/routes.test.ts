import { describe, expect, it } from "vitest"
import vercelConfig from "../vercel.json"
import { ERROR_ROUTE_CODES, ROUTES, safeNextPath } from "./routes"

const { rewrites: allRewrites, headers: headerRules } = vercelConfig as {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

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
    expect(rewritten("/admin/xyz")).toBe(false)
    expect(rewritten("/erro/999")).toBe(false)
  })

  it("toda rota (exceto a home, servida pelo index.html) tem rewrite para o SPA", () => {
    for (const path of Object.values(ROUTES)) {
      if (path === ROUTES.home) continue
      expect(rewritten(path), `falta rewrite para ${path}`).toBe(true)
    }
    for (const code of ERROR_ROUTE_CODES) {
      expect(rewritten(`/erro/${code}`), `falta rewrite para /erro/${code}`).toBe(true)
    }
  })

  it("não sobra rewrite de rota que não existe mais (o endereço antigo do painel dá 404)", () => {
    const known = new Set<string>(Object.values(ROUTES))
    for (const r of rewrites) {
      if (r.source.startsWith("/erro/")) continue
      expect(known.has(r.source), `rewrite órfão: ${r.source}`).toBe(true)
    }
    expect(rewritten("/nexus-24")).toBe(false)
    expect(rewritten("/nexus-24/login")).toBe(false)
  })

  it("todo rewrite aponta para o index.html", () => {
    for (const r of rewrites) expect(r.destination).toBe("/index.html")
  })

  it("aceita barra final nas rotas válidas", () => {
    expect(rewritten("/termos/")).toBe(true)
  })
})

describe("vercel.json × cabeçalhos de segurança", () => {
  const all = headerRules.find((rule) => rule.source === "/(.*)")?.headers ?? []
  const value = (key: string) => all.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value

  it("o site não pode ser embutido em iframe (clickjacking) e o navegador não adivinha tipos de arquivo", () => {
    expect(value("X-Frame-Options")).toBe("DENY")
    expect(value("Content-Security-Policy")).toContain("frame-ancestors 'none'")
    expect(value("X-Content-Type-Options")).toBe("nosniff")
    expect(value("Referrer-Policy")).toBeTruthy()
  })
})

describe("rotas da área administrativa", () => {
  it("usam caminhos convencionais: a proteção real está na API, não em um endereço secreto", () => {
    expect(ROUTES.admin).toBe("/admin")
    expect(ROUTES.adminReport).toBe("/admin/relatorio")
    expect(ROUTES.login).toBe("/entrar")
  })
})

describe("safeNextPath (para onde voltar depois de entrar)", () => {
  it("aceita só caminhos internos", () => {
    expect(safeNextPath("/admin")).toBe("/admin")
    expect(safeNextPath("/admin/relatorio?periodo=mes")).toBe("/admin/relatorio?periodo=mes")
    expect(safeNextPath("/")).toBe("/")
  })

  it("recusa redirecionamento para outros sites e valores esquisitos", () => {
    expect(safeNextPath("https://evil.example")).toBeNull()
    expect(safeNextPath("//evil.example")).toBeNull()
    expect(safeNextPath("/\\evil.example")).toBeNull()
    expect(safeNextPath("javascript:alert(1)")).toBeNull()
    expect(safeNextPath("")).toBeNull()
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
  })

  it("não volta para a própria tela de entrar (evita laço)", () => {
    expect(safeNextPath("/entrar")).toBeNull()
    expect(safeNextPath("/entrar?next=%2Fadmin")).toBeNull()
  })
})
