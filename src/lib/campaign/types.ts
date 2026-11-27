/**
 * Tipos das campanhas sazonais, como a loja os recebe de `GET /api/campaigns/active`.
 * Fonte: `docs/campanhas-contrato.md`. Mudou lá, muda aqui (e em `parse.ts`, que confere tudo em tempo de execução).
 */

// ─── Enums ────────────────────────────────────────────────────────────────────
// O projeto não usa `enum` do TypeScript (`erasableSyntaxOnly`). No lugar, cada lista é um array `as const`
// e o tipo é derivado dele: assim a mesma lista serve para o TypeScript e para a validação em `parse.ts`.

export const CAMPAIGN_TYPES = [
  "BLACK_FRIDAY",
  "CHRISTMAS",
  "EASTER",
  "VALENTINES_DAY",
  "MOTHERS_DAY",
  "FATHERS_DAY",
  "CONSUMER_DAY",
  "STORE_ANNIVERSARY",
  "CUSTOM",
] as const
export type CampaignType = (typeof CAMPAIGN_TYPES)[number]

export const DECORATION_TYPES = ["SNOW", "SPARKLES", "HEARTS", "RIBBONS", "CONFETTI", "STARS"] as const
export type DecorationType = (typeof DECORATION_TYPES)[number]

export const BUTTON_STYLES = ["PRIMARY", "SECONDARY"] as const
export type ButtonStyle = (typeof BUTTON_STYLES)[number]

// ─── Tipos básicos (contrato §3) ──────────────────────────────────────────────

/** Cor `#RRGGBB`. É só `string` para o TypeScript; o formato é conferido em `parse.ts`. */
export type Color = string

/** Caminho interno (`/...`, nunca `//...`) ou endereço `https://`. Conferido em `parse.ts`. */
export type Link = string

/** Data ISO-8601 em UTC, como a API envia (ex.: `"2026-11-28T03:00:00Z"`). */
export type IsoDateTime = string

export interface CampaignImage {
  /** Só do Cloudinary do projeto (`https://res.cloudinary.com/<cloud>/image/upload/...`). */
  url: string
  alt: string
  /** Dimensões reais, para reservar espaço antes de a imagem carregar; `null` quando a API não souber. */
  width: number | null
  height: number | null
}

// ─── Tema (contrato §4.1) ─────────────────────────────────────────────────────

export interface GoldPalette {
  hi: Color
  mid: Color
  lo: Color
  deep: Color
}

/** Uma paleta (modo escuro ou claro). Campo `null` = usar o valor padrão da loja. */
export interface ThemePalette {
  background: Color
  foreground: Color
  primary: Color
  primaryForeground: Color
  accent: Color
  surface: Color | null
  mutedForeground: Color | null
  border: Color | null
  badge: Color | null
  badgeForeground: Color | null
  /** `null` mantém o dourado da marca. */
  gold: GoldPalette | null
}

export interface CampaignTheme {
  /** Obrigatória (decisão T02). */
  dark: ThemePalette
  /** `null` → no modo claro a loja usa o tema claro padrão. */
  light: ThemePalette | null
}

// ─── Conteúdo (contrato §4.2) ─────────────────────────────────────────────────

export interface CampaignTopBar {
  text: string
  link: Link | null
}

export interface CampaignButton {
  label: string
  link: Link
  style: ButtonStyle
}

export interface CampaignHero {
  title: string
  subtitle: string | null
  imageDesktop: CampaignImage
  /** `null` → usa a imagem de desktop também no celular. */
  imageMobile: CampaignImage | null
  buttons: CampaignButton[]
}

export interface CampaignPromoImage {
  image: CampaignImage
  link: Link | null
}

export interface CampaignContent {
  /** `null` → mantém a faixa atual da loja. */
  topBar: CampaignTopBar | null
  /** `null` → mantém o hero atual. */
  hero: CampaignHero | null
  promoImages: CampaignPromoImage[]
  decorations: DecorationType[]
}

// ─── Resposta pública (contrato §5.4 e §7.1) ──────────────────────────────────

export interface PublicCollection {
  title: string
  /** Usado no link `/?colecao=<slug>`. */
  slug: string
  position: number
  /** Já na ordem certa e sem produtos desativados. A loja cruza com o catálogo carregado. */
  productIds: string[]
}

export interface PublicCampaign {
  id: string
  type: CampaignType
  startsAt: IsoDateTime
  endsAt: IsoDateTime
  updatedAt: IsoDateTime
  theme: CampaignTheme
  content: CampaignContent
  collections: PublicCollection[]
}

/** Corpo de `GET /api/campaigns/active`. */
export interface ActiveCampaignResponse {
  /** Hora do servidor, para não depender do relógio do visitante (T17). */
  serverTime: IsoDateTime
  /** Próximo instante em que a resposta muda sozinha; `null` se nada estiver previsto. */
  nextChangeAt: IsoDateTime | null
  /** `null` → nenhuma campanha ativa: tema padrão. */
  campaign: PublicCampaign | null
}
