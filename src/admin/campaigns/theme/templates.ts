/**
 * Modelos de partida do editor, um por tipo de campanha. São só um começo: depois de aplicados, toda cor é editável.
 * Todos passam no alerta de contraste (`templates.test.ts`).
 */
import type { CampaignType } from "@/lib/campaign/types"
import { TYPE_LABELS } from "@/admin/campaigns/labels"
import { storePaletteDraft } from "@/admin/campaigns/theme/storePalette"
import { paletteDraft, type ThemeDraft } from "@/admin/campaigns/theme/themeDraft"

type Colors = [
  background: string, foreground: string, primary: string, primaryForeground: string, accent: string,
  surface: string, mutedForeground: string, border: string, badge: string, badgeForeground: string,
]

const palette = ([background, foreground, primary, primaryForeground, accent, surface, mutedForeground, border, badge, badgeForeground]: Colors) =>
  paletteDraft({ background, foreground, primary, primaryForeground, accent, surface, mutedForeground, border, badge, badgeForeground })

const theme = (dark: Colors, light: Colors): ThemeDraft => ({ dark: palette(dark), light: palette(light) })

const SEASONAL: Record<Exclude<CampaignType, "CUSTOM">, ThemeDraft> = {
  BLACK_FRIDAY: theme(
    ["#0A0A0A", "#F5F1E8", "#C1121F", "#FFFFFF", "#1F1F24", "#141416", "#B3ADA3", "#2E2E33", "#C1121F", "#FFFFFF"],
    ["#FAF7F2", "#141416", "#A50F1A", "#FFFFFF", "#F2E9DD", "#FFFFFF", "#5E584F", "#E4D9C8", "#A50F1A", "#FFFFFF"],
  ),
  CHRISTMAS: theme(
    ["#0B1A12", "#F6F1E7", "#B3202A", "#FFFFFF", "#163024", "#10241A", "#AFC0B4", "#25452F", "#E4C568", "#1A1206"],
    ["#F8F5EC", "#13251B", "#A11D26", "#FFFFFF", "#E6EFE3", "#FFFEFA", "#4F6355", "#D6E0D2", "#1E5B3A", "#FFFFFF"],
  ),
  EASTER: theme(
    ["#17121F", "#F7F2FA", "#C9A0F5", "#1B0F29", "#2A2238", "#201A2C", "#BBB0C9", "#3A304C", "#F2C879", "#2A1A05"],
    ["#FBF7FD", "#2A1F36", "#6D3FA0", "#FFFFFF", "#F1E8F8", "#FFFFFF", "#655873", "#E4D7EE", "#8A5A12", "#FFFFFF"],
  ),
  VALENTINES_DAY: theme(
    ["#1A0A10", "#FCEEF1", "#E0486B", "#1A0A10", "#32151F", "#240F17", "#D2AEB8", "#48202D", "#F4A8B8", "#2A0B14"],
    ["#FFF5F6", "#321019", "#B01E45", "#FFFFFF", "#FBE6EA", "#FFFFFF", "#7A4B57", "#F2D3DA", "#B01E45", "#FFFFFF"],
  ),
  MOTHERS_DAY: theme(
    ["#1B0F17", "#FBEFF5", "#E38AB4", "#2A0E1C", "#33202C", "#261621", "#CDB0C0", "#48303F", "#F2C1D7", "#2A0E1C"],
    ["#FDF6F9", "#35182A", "#9C2E65", "#FFFFFF", "#F8E7F0", "#FFFFFF", "#75546A", "#EFD5E2", "#9C2E65", "#FFFFFF"],
  ),
  FATHERS_DAY: theme(
    ["#0B1320", "#EEF3FA", "#5C93D6", "#07101C", "#17263C", "#111C2E", "#A6B6CC", "#263A57", "#D9BC78", "#09090A"],
    ["#F4F7FB", "#13223A", "#1F5A9E", "#FFFFFF", "#E4ECF6", "#FFFFFF", "#4C5D77", "#D3DFEE", "#1F5A9E", "#FFFFFF"],
  ),
  CONSUMER_DAY: theme(
    ["#0A1416", "#ECF6F7", "#2FB5B0", "#04191A", "#14282C", "#0F1E21", "#A3BCBF", "#224045", "#F2B84B", "#221400"],
    ["#F3F9F9", "#10292C", "#0F6E6B", "#FFFFFF", "#E1F0F0", "#FFFFFF", "#47636A", "#CFE5E5", "#8F4E00", "#FFFFFF"],
  ),
  STORE_ANNIVERSARY: theme(
    ["#0D0B07", "#F7F0E0", "#E0B84F", "#140F04", "#231D11", "#17130C", "#BBAF93", "#3A301B", "#E0B84F", "#140F04"],
    ["#FBF7EC", "#251D0C", "#8A6414", "#FFFFFF", "#F3EBD3", "#FFFDF6", "#675B3F", "#E7DAB8", "#8A6414", "#FFFFFF"],
  ),
}

export const TEMPLATE_LABELS: Record<CampaignType, string> = { ...TYPE_LABELS, CUSTOM: "Cores da loja" }

/** Uma cópia nova a cada chamada: editar o tema não altera o modelo. */
export function templateTheme(type: CampaignType): ThemeDraft {
  return type === "CUSTOM"
    ? { dark: storePaletteDraft("dark"), light: storePaletteDraft("light") }
    : structuredClone(SEASONAL[type])
}
