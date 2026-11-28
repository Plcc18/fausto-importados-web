/** Envio de imagens ao Cloudinary pela API (`docs/campanhas-contrato.md` §7.4). Só o painel usa. */
import { API_URL } from "@/lib/api"
import { authFetch } from "@/lib/auth"

/** Limite da API para qualquer imagem. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** `product`: o upload de produtos, de sempre. `campaign`: imagens de campanha, em pasta própria. */
export type ImageKind = "product" | "campaign"

const ENDPOINTS: Record<ImageKind, { path: string; field: string }> = {
  product: { path: "/api/upload", field: "image" },
  campaign: { path: "/api/upload?folder=campaigns", field: "file" },
}

const CAMPAIGN_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export interface UploadedImage {
  url: string
  /** Dimensões reais; só o upload de campanha as informa. */
  width: number | null
  height: number | null
}

/** Falha com uma mensagem que pode ser mostrada à pessoa. */
export class UploadError extends Error {}

const TOO_LARGE = "A imagem passa de 5 MB."
export const UPLOAD_FAILED = "Não foi possível enviar a imagem. Tente novamente."

/** O que dá para recusar antes de enviar (arquivos muito grandes podem derrubar a conexão sem resposta). */
export function checkImage(file: File, kind: ImageKind): string | null {
  if (kind === "campaign" && !CAMPAIGN_TYPES.has(file.type)) return "Use uma imagem JPEG, PNG ou WebP."
  if (!file.type.startsWith("image/")) return "Apenas imagens são permitidas."
  if (file.size === 0) return "O arquivo está vazio."
  return file.size > MAX_IMAGE_BYTES ? TOO_LARGE : null
}

interface ApiProblem {
  code?: string
  message?: string
  fields?: { field?: string; message?: string }[]
}

async function explain(res: Response): Promise<string> {
  if (res.status === 413) return TOO_LARGE
  const body = (await res.json().catch(() => null)) as ApiProblem | null
  if (body?.code === "validation_failed") return body.fields?.find((f) => f.field === "file")?.message ?? UPLOAD_FAILED
  if (body?.code === "upload_failed") return "O serviço de imagens não recebeu o arquivo. Tente novamente."
  return UPLOAD_FAILED
}

const dimension = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null)

export async function uploadImage(file: File, kind: ImageKind): Promise<UploadedImage> {
  const { path, field } = ENDPOINTS[kind]
  const form = new FormData()
  form.append(field, file)
  const res = await authFetch(`${API_URL}${path}`, { method: "POST", body: form })
  if (!res.ok) throw new UploadError(await explain(res))
  const body = (await res.json()) as { url?: unknown; width?: unknown; height?: unknown } | null
  if (typeof body?.url !== "string" || !body.url) throw new UploadError(UPLOAD_FAILED)
  return { url: body.url, width: dimension(body.width), height: dimension(body.height) }
}
