import { ImageUploader } from "@/admin/images/ImageUploader"
import { uploadedDraft, type ImageDraft } from "@/admin/campaigns/content/fields"
import { TextField } from "@/admin/campaigns/content/TextField"

function sizeNote({ width, height }: ImageDraft, recommended: number) {
  if (!width || !height) return ""
  const small = width < recommended ? " Menor que o recomendado: pode ficar borrada." : ""
  return ` Enviada: ${width} × ${height} px.${small}`
}

/** Uma imagem de campanha: o envio, o tamanho que chegou e o texto alternativo. */
export function ImageSlot({
  label,
  altLabel,
  hint,
  recommendedWidth,
  previewClassName,
  image,
  path,
  errors,
  onChange,
  onUploadingChange,
}: {
  label: string
  altLabel: string
  hint: string
  recommendedWidth: number
  previewClassName: string
  image: ImageDraft | null
  /** Caminho do campo nos erros da API, como `content.hero.imageDesktop`. */
  path: string
  errors: Partial<Record<string, string>>
  /** Recebe a alteração como função, porque o envio termina depois de outras mudanças. */
  onChange: (update: (current: ImageDraft | null) => ImageDraft | null, changed: string) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  return (
    <div className="min-w-0 space-y-3">
      <ImageUploader
        label={label}
        kind="campaign"
        value={image?.url ?? ""}
        previewAlt={image?.alt || `Prévia: ${label.toLowerCase()}`}
        previewClassName={previewClassName}
        hint={`${hint}${image ? sizeNote(image, recommendedWidth) : ""}`}
        error={errors[path] ?? errors[`${path}.url`]}
        onUploadingChange={onUploadingChange}
        onChange={(uploaded) => onChange((current) => uploaded && uploadedDraft(uploaded, current?.alt ?? ""), path)}
      />
      {image && (
        <TextField
          label={altLabel}
          value={image.alt}
          error={errors[`${path}.alt`]}
          hint="Descreve a imagem para quem não a vê. Até 150 caracteres."
          onChange={(alt) => onChange((current) => current && { ...current, alt }, `${path}.alt`)}
        />
      )}
    </div>
  )
}
