import fs from "fs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/**
 * Gera `dist/404.html` como cópia do `index.html`.
 *
 * Na Vercel, URLs que não casam com nenhum arquivo nem rewrite recebem o
 * `404.html` com status HTTP 404 *real*. Como é o mesmo shell do app, o React
 * Router renderiza a página 404 personalizada (rota "*") — sem soft-404 (200)
 * para URLs inexistentes e sem tela em branco.
 */
function notFoundShell(): Plugin {
  let outDir = "dist"
  return {
    name: "not-found-shell",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const index = path.resolve(outDir, "index.html")
      if (fs.existsSync(index)) fs.copyFileSync(index, path.resolve(outDir, "404.html"))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), notFoundShell()],
  build: {
    // Sem source maps em produção: o código-fonte original (inclusive o do painel) não fica servido ao público.
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
