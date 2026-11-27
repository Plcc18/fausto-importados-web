import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useActiveCampaign } from "@/lib/campaign/useActiveCampaign"
import { applyCampaignTheme, isCampaignThemeRoute } from "@/lib/campaign/theme"

/** Aplica o tema da campanha ativa enquanto estiver montado; ao desmontar, a loja volta ao tema padrão. */
function ActiveCampaignTheme() {
  const { campaign } = useActiveCampaign()
  const theme = campaign?.theme ?? null

  useEffect(() => {
    applyCampaignTheme(theme)
  }, [theme])

  useEffect(() => () => applyCampaignTheme(null), [])

  return null
}

/**
 * Liga o tema de campanha só nas páginas públicas (T02). Fora delas o componente acima nem é montado: o tema
 * sai e, no painel, a campanha nem é buscada.
 */
export function CampaignThemeHost() {
  const { pathname } = useLocation()
  return isCampaignThemeRoute(pathname) ? <ActiveCampaignTheme /> : null
}
