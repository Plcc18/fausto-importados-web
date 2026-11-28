/**
 * As cores da loja sem campanha, para a miniprévia e o "restaurar padrão". O painel não pode ler estas variáveis da
 * própria página (ela está só num dos modos), por isso são repetidas aqui; `storePalette.test.ts` falha se ficarem
 * diferentes de `src/index.css`.
 */
import { paletteToCssVariables } from "@/lib/campaign/theme"
import type { ThemePalette } from "@/lib/campaign/types"
import {
  COLOR_FIELDS,
  paletteDraft,
  themeInput,
  type ColorKey,
  type PaletteDraft,
  type ThemeMode,
} from "@/admin/campaigns/theme/themeDraft"

/** Só as variáveis que a campanha troca, mais as cores de texto que a loja mantém sobre a cor secundária. */
export const STORE_VARIABLES: Record<ThemeMode, Record<string, string>> = {
  dark: {
    "--background": "#09090a",
    "--foreground": "#f4efe6",
    "--card": "#121214",
    "--card-foreground": "#f4efe6",
    "--popover": "#121214",
    "--popover-foreground": "#f4efe6",
    "--primary": "#d9bc78",
    "--primary-foreground": "#09090a",
    "--secondary": "#1c1c1f",
    "--secondary-foreground": "#f4efe6",
    "--muted": "#1c1c1f",
    "--muted-foreground": "#a8a398",
    "--accent": "#1c1c1f",
    "--accent-foreground": "#f1e2b8",
    "--border": "rgb(217 188 120 / 0.14)",
    "--input": "rgb(244 239 230 / 0.14)",
    "--ring": "#d9bc78",
    "--gold-hi": "#f1e2b8",
    "--gold-mid": "#d9bc78",
    "--gold-lo": "#c19a4b",
    "--gold-deep": "#8a6a2c",
  },
  light: {
    "--background": "#f7f3ea",
    "--foreground": "#121214",
    "--card": "#fffdf8",
    "--card-foreground": "#121214",
    "--popover": "#fffdf8",
    "--popover-foreground": "#121214",
    "--primary": "#c19a4b",
    "--primary-foreground": "#09090a",
    "--secondary": "#efe8d8",
    "--secondary-foreground": "#121214",
    "--muted": "#efe8d8",
    "--muted-foreground": "#6b665c",
    "--accent": "#efe8d8",
    "--accent-foreground": "#6b4f1c",
    "--border": "#e3dac6",
    "--input": "#d9cfb8",
    "--ring": "#c19a4b",
    "--gold-hi": "#c9a24f",
    "--gold-mid": "#c19a4b",
    "--gold-lo": "#a37f35",
    "--gold-deep": "#7a5c20",
  },
}

/** A principal variável que cada campo controla. */
const FIELD_VARIABLE: Record<ColorKey, string> = {
  background: "--background",
  foreground: "--foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  accent: "--accent",
  surface: "--card",
  mutedForeground: "--muted-foreground",
  border: "--border",
  badge: "--campaign-badge",
  badgeForeground: "--campaign-badge-foreground",
}

/** A cor que a loja usaria num campo com esta paleta. As etiquetas sem cor própria seguem o destaque. */
export const effectiveColor = (mode: ThemeMode, draft: PaletteDraft | null, key: ColorKey) =>
  previewVariables(mode, draft)[FIELD_VARIABLE[key]]

/** A cor da loja sem campanha para um campo. */
export const storeColor = (mode: ThemeMode, key: ColorKey) => effectiveColor(mode, null, key)

export const storeGold = (mode: ThemeMode) => ({
  hi: STORE_VARIABLES[mode]["--gold-hi"],
  mid: STORE_VARIABLES[mode]["--gold-mid"],
  lo: STORE_VARIABLES[mode]["--gold-lo"],
  deep: STORE_VARIABLES[mode]["--gold-deep"],
})

/** A paleta da loja no formato do editor: os obrigatórios preenchidos e o resto no padrão. */
export const storePaletteDraft = (mode: ThemeMode): PaletteDraft =>
  paletteDraft(Object.fromEntries(COLOR_FIELDS.filter((f) => f.required).map(({ key }) => [key, storeColor(mode, key)])))

/**
 * Todas as variáveis que a loja teria com esta paleta: o padrão, com a campanha por cima (a mesma regra de
 * `lib/campaign/theme.ts`). Cor pela metade é ignorada.
 */
export function previewVariables(mode: ThemeMode, draft: PaletteDraft | null): Record<string, string> {
  const palette = draft && (themeInput({ dark: draft, light: null })!.dark as ThemePalette)
  const variables: Record<string, string> = {
    ...STORE_VARIABLES[mode],
    ...(palette && paletteToCssVariables(palette)),
  }
  variables["--campaign-badge"] ??= variables["--primary"]
  variables["--campaign-badge-foreground"] ??= variables["--primary-foreground"]
  return variables
}
