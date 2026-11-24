import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { build } from "vite"

/**
 * Faz o build de produção de verdade e confere o que seria publicado:
 *  - o código do painel fica FORA do bundle público (chunk separado, não referenciado pelo index.html);
 *  - não há source maps (o código-fonte original não é servido);
 *  - nada de robots.txt/sitemap listando rotas.
 *
 * Lento (alguns segundos): é o único teste que roda o Vite de verdade.
 */

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "fausto-build-"))

/** Chamadas da API que só o painel faz: se aparecerem no bundle principal, o painel vazou para o público. */
const ADMIN_ONLY_MARKERS = [
  "/api/orders/reset-sales",
  "/api/orders/reset-report",
  "/api/orders/clear-history",
  "/api/orders/sales-stats",
  "/reset-credentials", // gestão de administradores
  "Confirme sua identidade", // diálogo de reautenticação
]

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  )

let files: string[] = []
let indexHtml = ""
let entryFile = ""
let entry = ""
const read = (file: string) => fs.readFileSync(file, "utf8")

beforeAll(async () => {
  await build({
    configFile: path.resolve(__dirname, "../vite.config.ts"),
    root: path.resolve(__dirname, ".."),
    logLevel: "silent",
    build: { outDir, emptyOutDir: true },
  })
  files = walk(outDir)
  indexHtml = read(path.join(outDir, "index.html"))
  const entryName = /<script[^>]+src="\/?(assets\/[^"]+\.js)"/.exec(indexHtml)?.[1] ?? ""
  entryFile = path.join(outDir, entryName)
  entry = read(entryFile)
}, 240_000)

afterAll(() => {
  fs.rmSync(outDir, { recursive: true, force: true })
})

describe("build de produção", () => {
  it("o index.html carrega um bundle de entrada", () => {
    expect(entryFile).toMatch(/assets[\\/].+\.js$/)
    expect(entry.length).toBeGreaterThan(10_000)
  })

  it("o painel administrativo está em chunk(s) SEPARADO(S) do bundle público", () => {
    const jsFiles = files.filter((f) => f.endsWith(".js"))
    const chunksWithAdminApi = jsFiles.filter((f) => ADMIN_ONLY_MARKERS.some((m) => read(f).includes(m)))

    expect(jsFiles.length).toBeGreaterThan(1)
    expect(chunksWithAdminApi.length).toBeGreaterThan(0) // o código do painel existe...
    expect(chunksWithAdminApi).not.toContain(entryFile)   // ...mas não no bundle de entrada
  })

  it("o bundle público não contém as chamadas exclusivas do painel", () => {
    for (const marker of ADMIN_ONLY_MARKERS) {
      expect(entry, `"${marker}" vazou para o bundle público`).not.toContain(marker)
    }
  })

  it("o index.html não pré-carrega o chunk do painel nem o da tela de login", () => {
    const adminChunks = files
      .filter((f) => f.endsWith(".js") && f !== entryFile)
      .filter((f) => ADMIN_ONLY_MARKERS.some((m) => read(f).includes(m)))
      .map((f) => path.basename(f))

    expect(adminChunks.length).toBeGreaterThan(0)
    for (const chunk of adminChunks) {
      expect(indexHtml, `${chunk} não pode ser referenciado pelo index.html`).not.toContain(chunk)
    }
  })

  it("a biblioteca de QR code vai junto da tela de login, fora do bundle público", () => {
    // a UI do cadastro do 2FA só existe no chunk da tela de login
    expect(entry).not.toContain("Chave manual")
    expect(files.filter((f) => f.endsWith(".js")).some((f) => read(f).includes("Chave manual"))).toBe(true)
  })

  it("não publica source maps", () => {
    expect(files.filter((f) => f.endsWith(".map"))).toEqual([])
    for (const js of files.filter((f) => f.endsWith(".js"))) {
      expect(read(js), `${path.basename(js)} aponta para um source map`).not.toMatch(/sourceMappingURL=/)
    }
  })

  it("não publica robots.txt nem sitemap", () => {
    const names = files.map((f) => path.basename(f).toLowerCase())
    expect(names).not.toContain("robots.txt")
    expect(names.some((n) => n.startsWith("sitemap"))).toBe(false)
  })

  it("mantém o 404.html (shell do app) para URLs inexistentes", () => {
    expect(fs.existsSync(path.join(outDir, "404.html"))).toBe(true)
  })
})
