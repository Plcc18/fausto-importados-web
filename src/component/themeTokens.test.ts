/**
 * Proteção da T19: os componentes da loja usam os tokens de cor (`bg-primary`, `text-foreground`, `--gold-*`...),
 * que a campanha consegue trocar (T18). Uma cor escrita direto no código fica fixa e "fura" o tema da campanha.
 *
 * Este teste falha quando aparece uma cor fixa nova. Se ela tiver um significado próprio que a campanha não deve
 * mudar (sucesso, aviso...), entra na lista de exceções abaixo, com o motivo.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const COMPONENTS_DIR = join(process.cwd(), "src", "component")

/** Telas fora do alcance do tema (decisão T02): ficam sempre com as cores padrão. */
const OUT_OF_THEME = new Set(["Login.tsx"])

/** Cores com significado, permitidas em qualquer componente da loja. */
const SEMANTIC_FAMILIES: Record<string, string> = {
  white: "fundo atrás das fotos dos perfumes (as imagens têm fundo branco)",
  black: "escurecimento atrás de janelas",
  emerald: "sucesso / confirmado",
  yellow: "aviso",
  amber: "aviso",
  sky: "informação",
}

/** Exceções de um arquivo só. */
const FILE_EXCEPTIONS: Record<string, { families?: string[]; raw?: string[]; reason: string }> = {
  "ProductCard.tsx": { families: ["red"], raw: ["#3CB371", "#ffffff"], reason: "coração de favorito e toast de sucesso" },
  "Store.tsx": { raw: ["rgba(0,0,0,0.18)"], reason: "sombra neutra do logo" },
}

/** `text-gold-metal` não é cor fixa: o degradê usa os tokens `--gold-*` (ver `index.css`). */
const COLOR_UTILITY =
  /\b(?:bg|text|border|from|via|to|ring|fill|stroke|outline|decoration|shadow|divide|placeholder|caret)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|gold|graphite|offwhite)(?![\w-]*-(?:foreground|metal))\b/g
const RAW_COLOR = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/g

function publicComponentFiles(): string[] {
  return readdirSync(COMPONENTS_DIR).filter(
    (name) => name.endsWith(".tsx") && !name.includes(".test.") && !OUT_OF_THEME.has(name),
  )
}

/** Cores fixas de um arquivo que não estão nas exceções. */
function unexpectedColors(file: string): string[] {
  const source = readFileSync(join(COMPONENTS_DIR, file), "utf-8")
  const exceptions = FILE_EXCEPTIONS[file]
  const allowedFamilies = new Set([...Object.keys(SEMANTIC_FAMILIES), ...(exceptions?.families ?? [])])
  const allowedRaw = new Set(exceptions?.raw ?? [])

  const found: string[] = []
  for (const match of source.matchAll(COLOR_UTILITY)) {
    if (!allowedFamilies.has(match[1])) found.push(match[0])
  }
  for (const match of source.matchAll(RAW_COLOR)) {
    if (!allowedRaw.has(match[0].replace(/\s+/g, ""))) found.push(match[0])
  }
  return found
}

describe("componentes da loja usam os tokens de cor", () => {
  it("encontra os componentes", () => {
    expect(publicComponentFiles()).toEqual(expect.arrayContaining(["Store.tsx", "ProductCard.tsx", "Cart.tsx"]))
  })

  it.each(publicComponentFiles())("%s não tem cor fixa fora das exceções", (file) => {
    expect(unexpectedColors(file)).toEqual([])
  })

  it("as etiquetas \"Oferta\" usam o token da campanha", () => {
    const source = readFileSync(join(COMPONENTS_DIR, "ProductCard.tsx"), "utf-8")
    const offers = [...source.matchAll(/<Badge className="([^"]*)">Oferta<\/Badge>/g)].map((m) => m[1])

    expect(offers).toHaveLength(2)
    for (const classes of offers) expect(classes).toContain("bg-campaign-badge text-campaign-badge-foreground")
  })

  it("o token tem valor padrão (sem campanha, a etiqueta segue o destaque da paleta)", () => {
    const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf-8")

    expect(css).toContain("--campaign-badge: var(--primary);")
    expect(css).toContain("--campaign-badge-foreground: var(--primary-foreground);")
    expect(css).toContain("--color-campaign-badge: var(--campaign-badge);")
  })
})
