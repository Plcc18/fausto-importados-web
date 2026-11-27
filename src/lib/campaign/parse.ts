/**
 * Validação da resposta de `GET /api/campaigns/active` antes de qualquer uso.
 *
 * O TypeScript só confere o nosso código; o JSON que chega da rede pode ter qualquer formato. Aqui cada campo é
 * conferido e copiado para um objeto novo (o que estiver fora do contrato fica para trás). Na dúvida, a campanha
 * é descartada: sem campanha, a loja usa o tema padrão, que é sempre um resultado seguro.
 *
 * Os campos que vão parar em CSS (cores), em `href` (links) e em `src` (imagens) são conferidos com rigor,
 * porque um valor malicioso ali viraria um ataque. Tamanhos de texto não são conferidos: o React já escapa o
 * texto, e um limite um pouco diferente do da API não deve derrubar uma campanha válida.
 */
import {
  BUTTON_STYLES,
  CAMPAIGN_TYPES,
  DECORATION_TYPES,
  type ActiveCampaignResponse,
  type CampaignButton,
  type CampaignContent,
  type CampaignHero,
  type CampaignImage,
  type CampaignPromoImage,
  type CampaignTheme,
  type CampaignTopBar,
  type Color,
  type GoldPalette,
  type IsoDateTime,
  type Link,
  type PublicCampaign,
  type PublicCollection,
  type ThemePalette,
} from "./types"

/** Valor fora do contrato. `path` diz onde (ex.: `campaign.theme.dark.primary`), para facilitar a depuração. */
export class InvalidCampaignDataError extends Error {
  readonly path: string

  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`)
    this.name = "InvalidCampaignDataError"
    this.path = path
  }
}

function fail(path: string, reason: string): never {
  throw new InvalidCampaignDataError(path, reason)
}

// ─── Leitores básicos ─────────────────────────────────────────────────────────
// Cada um recebe um valor desconhecido e devolve o valor com o tipo certo, ou lança o erro acima.

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readObject(value: unknown, path: string): JsonObject {
  if (!isObject(value)) fail(path, "esperava um objeto")
  return value
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(path, "esperava um texto")
  return value
}

function readNullable<T>(value: unknown, path: string, read: (value: unknown, path: string) => T): T | null {
  return value === null || value === undefined ? null : read(value, path)
}

function readArray<T>(value: unknown, path: string, read: (item: unknown, path: string) => T): T[] {
  if (!Array.isArray(value)) fail(path, "esperava uma lista")
  return value.map((item, index) => read(item, `${path}[${index}]`))
}

function readOneOf<const T extends readonly string[]>(options: T, value: unknown, path: string): T[number] {
  // `options` é uma lista de valores exatos ("SNOW" | ...); para perguntar se um texto qualquer está nela,
  // o TypeScript precisa vê-la como lista de textos.
  const allowed: readonly string[] = options
  if (typeof value !== "string" || !allowed.includes(value)) fail(path, `valor fora da lista: ${String(value)}`)
  return value as T[number]
}

function readPositiveIntOrNull(value: unknown, path: string): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) fail(path, "esperava um inteiro positivo")
  return value
}

function readNonNegativeInt(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) fail(path, "esperava um inteiro")
  return value
}

/** ISO-8601 com fuso (`Z` ou `±hh:mm`): sem fuso, cada navegador interpretaria num horário diferente. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

function readDateTime(value: unknown, path: string): IsoDateTime {
  if (typeof value !== "string" || !ISO_DATE_TIME.test(value) || Number.isNaN(Date.parse(value))) {
    fail(path, "esperava uma data ISO-8601 com fuso")
  }
  return value
}

// ─── Cores, links e imagens (contrato §3) ─────────────────────────────────────

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export function isColor(value: unknown): value is Color {
  return typeof value === "string" && HEX_COLOR.test(value)
}

function readColor(value: unknown, path: string): Color {
  if (!isColor(value)) fail(path, "esperava uma cor #RRGGBB")
  return value
}

/** Espaços, caracteres de controle e invisíveis (como o espaço de largura zero), além de `\`, `<` e `>`. */
const FORBIDDEN_IN_LINK = /[\s\p{Cc}\p{Cf}\\<>]/u
const MAX_LINK_LENGTH = 300

/** Regra do contrato: caminho interno (`/...`, nunca `//...`) ou `https://` com servidor e sem `usuario@`. */
export function isSafeLink(value: unknown): value is Link {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LINK_LENGTH) return false
  if (FORBIDDEN_IN_LINK.test(value)) return false
  if (value.startsWith("/")) return !value.startsWith("//")
  if (!value.startsWith("https://")) return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname !== "" && url.username === "" && url.password === ""
  } catch {
    return false
  }
}

function readLink(value: unknown, path: string): Link {
  if (!isSafeLink(value)) fail(path, "link fora das regras do contrato")
  return value
}

const MAX_IMAGE_URL_LENGTH = 500
/** `/<cloud>/image/upload/...`: só arquivos enviados ao Cloudinary (o `/image/fetch/` buscaria qualquer site). */
const CLOUDINARY_UPLOAD_PATH = /^\/[A-Za-z0-9_-]+\/image\/upload\//

export function isCloudinaryImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_IMAGE_URL_LENGTH || value.includes("..")) return false
  if (FORBIDDEN_IN_LINK.test(value)) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      CLOUDINARY_UPLOAD_PATH.test(url.pathname)
    )
  } catch {
    return false
  }
}

function readImage(value: unknown, path: string): CampaignImage {
  const image = readObject(value, path)
  if (!isCloudinaryImageUrl(image.url)) fail(`${path}.url`, "imagem fora do Cloudinary do projeto")
  return {
    url: image.url,
    alt: readString(image.alt, `${path}.alt`),
    width: readPositiveIntOrNull(image.width, `${path}.width`),
    height: readPositiveIntOrNull(image.height, `${path}.height`),
  }
}

// ─── Tema (contrato §4.1) ─────────────────────────────────────────────────────

function readGold(value: unknown, path: string): GoldPalette {
  const gold = readObject(value, path)
  return {
    hi: readColor(gold.hi, `${path}.hi`),
    mid: readColor(gold.mid, `${path}.mid`),
    lo: readColor(gold.lo, `${path}.lo`),
    deep: readColor(gold.deep, `${path}.deep`),
  }
}

function readPalette(value: unknown, path: string): ThemePalette {
  const palette = readObject(value, path)
  const optionalColor = (key: string) => readNullable(palette[key], `${path}.${key}`, readColor)
  return {
    background: readColor(palette.background, `${path}.background`),
    foreground: readColor(palette.foreground, `${path}.foreground`),
    primary: readColor(palette.primary, `${path}.primary`),
    primaryForeground: readColor(palette.primaryForeground, `${path}.primaryForeground`),
    accent: readColor(palette.accent, `${path}.accent`),
    surface: optionalColor("surface"),
    mutedForeground: optionalColor("mutedForeground"),
    border: optionalColor("border"),
    badge: optionalColor("badge"),
    badgeForeground: optionalColor("badgeForeground"),
    gold: readNullable(palette.gold, `${path}.gold`, readGold),
  }
}

function readTheme(value: unknown, path: string): CampaignTheme {
  const theme = readObject(value, path)
  return {
    dark: readPalette(theme.dark, `${path}.dark`),
    light: readNullable(theme.light, `${path}.light`, readPalette),
  }
}

// ─── Conteúdo (contrato §4.2) ─────────────────────────────────────────────────

function readTopBar(value: unknown, path: string): CampaignTopBar {
  const topBar = readObject(value, path)
  return {
    text: readString(topBar.text, `${path}.text`),
    link: readNullable(topBar.link, `${path}.link`, readLink),
  }
}

function readButton(value: unknown, path: string): CampaignButton {
  const button = readObject(value, path)
  return {
    label: readString(button.label, `${path}.label`),
    link: readLink(button.link, `${path}.link`),
    style: readOneOf(BUTTON_STYLES, button.style, `${path}.style`),
  }
}

function readHero(value: unknown, path: string): CampaignHero {
  const hero = readObject(value, path)
  return {
    title: readString(hero.title, `${path}.title`),
    subtitle: readNullable(hero.subtitle, `${path}.subtitle`, readString),
    imageDesktop: readImage(hero.imageDesktop, `${path}.imageDesktop`),
    imageMobile: readNullable(hero.imageMobile, `${path}.imageMobile`, readImage),
    buttons: readArray(hero.buttons ?? [], `${path}.buttons`, readButton),
  }
}

function readPromoImage(value: unknown, path: string): CampaignPromoImage {
  const promo = readObject(value, path)
  return {
    image: readImage(promo.image, `${path}.image`),
    link: readNullable(promo.link, `${path}.link`, readLink),
  }
}

function readContent(value: unknown, path: string): CampaignContent {
  // A API pode mandar `content: null` (campanha só com tema): vira conteúdo vazio, e a loja mantém o que já tem
  if (value === null || value === undefined) return { topBar: null, hero: null, promoImages: [], decorations: [] }
  const content = readObject(value, path)
  const decorations = readArray(content.decorations ?? [], `${path}.decorations`, (item, itemPath) =>
    readOneOf(DECORATION_TYPES, item, itemPath),
  )
  return {
    topBar: readNullable(content.topBar, `${path}.topBar`, readTopBar),
    hero: readNullable(content.hero, `${path}.hero`, readHero),
    promoImages: readArray(content.promoImages ?? [], `${path}.promoImages`, readPromoImage),
    // Repetição não quebra nada; só não desenha a mesma decoração duas vezes
    decorations: [...new Set(decorations)],
  }
}

// ─── Coleções e campanha (contrato §5.4) ──────────────────────────────────────

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

function readCollection(value: unknown, path: string): PublicCollection {
  const collection = readObject(value, path)
  const slug = readString(collection.slug, `${path}.slug`)
  if (!SLUG.test(slug)) fail(`${path}.slug`, "identificador inválido")
  return {
    title: readString(collection.title, `${path}.title`),
    slug,
    position: readNonNegativeInt(collection.position, `${path}.position`),
    productIds: readArray(collection.productIds, `${path}.productIds`, readString),
  }
}

function readCampaign(value: unknown, path: string): PublicCampaign {
  const campaign = readObject(value, path)
  return {
    id: readString(campaign.id, `${path}.id`),
    type: readOneOf(CAMPAIGN_TYPES, campaign.type, `${path}.type`),
    startsAt: readDateTime(campaign.startsAt, `${path}.startsAt`),
    endsAt: readDateTime(campaign.endsAt, `${path}.endsAt`),
    updatedAt: readDateTime(campaign.updatedAt, `${path}.updatedAt`),
    theme: readTheme(campaign.theme, `${path}.theme`),
    content: readContent(campaign.content, `${path}.content`),
    collections: readArray(campaign.collections ?? [], `${path}.collections`, readCollection).sort(
      (a, b) => a.position - b.position,
    ),
  }
}

// ─── Entrada pública ──────────────────────────────────────────────────────────

function warnInDev(error: unknown): void {
  if (import.meta.env.DEV) console.warn("[campanha] resposta ignorada:", error)
}

/**
 * Confere uma campanha. Qualquer problema → `null` (tema padrão), nunca uma exceção:
 * uma campanha mal configurada não pode quebrar a loja.
 */
export function parsePublicCampaign(value: unknown): PublicCampaign | null {
  if (value === null || value === undefined) return null
  try {
    return readCampaign(value, "campaign")
  } catch (error) {
    if (!(error instanceof InvalidCampaignDataError)) throw error
    warnInDev(error)
    return null
  }
}

/**
 * Confere o corpo de `GET /api/campaigns/active`.
 *
 * - O envelope (`serverTime`, `nextChangeAt`) fora do formato → `null`: a resposta inteira não é confiável.
 * - Só a `campaign` fora do formato → resposta com `campaign: null`: tema padrão, mas mantendo os horários,
 *   para a loja saber quando consultar de novo.
 */
export function parseActiveCampaignResponse(value: unknown): ActiveCampaignResponse | null {
  try {
    const body = readObject(value, "resposta")
    return {
      serverTime: readDateTime(body.serverTime, "serverTime"),
      nextChangeAt: readNullable(body.nextChangeAt, "nextChangeAt", readDateTime),
      campaign: parsePublicCampaign(body.campaign),
    }
  } catch (error) {
    if (!(error instanceof InvalidCampaignDataError)) throw error
    warnInDev(error)
    return null
  }
}
