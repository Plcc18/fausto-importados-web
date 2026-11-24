import { useEffect, useState } from "react"

type Theme = "light" | "dark"

const STORAGE_KEY = "theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "dark" || stored === "light" ? stored : null
  } catch {
    return null
  }
}

function getSystemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

/**
 * Tema da loja: escolha salva do usuário > tema do sistema.
 * Enquanto o usuário não escolher, acompanha o sistema (inclusive se ele mudar
 * com a página aberta). A escolha só é gravada quando ele usa o botão de tema.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light"
    return getStoredTheme() ?? getSystemTheme()
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const onChange = () => {
      if (!getStoredTheme()) setTheme(media.matches ? "dark" : "light")
    }
    // Outra aba mudou a escolha do usuário: acompanha para não ficar dessincronizado
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setTheme(getStoredTheme() ?? getSystemTheme())
    }
    media.addEventListener("change", onChange)
    window.addEventListener("storage", onStorage)
    return () => {
      media.removeEventListener("change", onChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const toggle = () =>
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark"
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // storage indisponível: o tema vale só nesta sessão
      }
      return next
    })

  return { theme, toggle }
}
