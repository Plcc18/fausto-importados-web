import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react"
import { ImageUp, Loader2, Trash2, Upload } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { UPLOAD_FAILED, UploadError, checkImage, uploadImage, type ImageKind, type UploadedImage } from "@/admin/images/upload"

/**
 * Enviar, trocar e remover uma imagem, por clique ou arrastando. Serve a produtos e campanhas, quantas vezes for
 * preciso na mesma tela. Enquanto uma imagem nova sobe, ou se ela falhar, a anterior continua valendo.
 */
export function ImageUploader({
  label,
  kind,
  value,
  onChange,
  onUploadingChange,
  previewAlt,
  previewClassName = "aspect-video",
  hint,
  error,
}: {
  label: string
  kind: ImageKind
  /** URL atual; vazio = sem imagem. */
  value: string
  onChange: (image: UploadedImage | null) => void
  /** Chamado em pares: `true` ao começar um envio e `false` quando ele termina (ou o campo sai da tela). */
  onUploadingChange?: (uploading: boolean) => void
  previewAlt: string
  /** Classes da área da prévia (a proporção, principalmente). */
  previewClassName?: string
  hint?: ReactNode
  /** Erro vindo do formulário. */
  error?: string
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  /** Prévia do arquivo que está subindo. */
  const [sending, setSending] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  /** O endereço que o navegador não conseguiu mostrar. */
  const [broken, setBroken] = useState<string | null>(null)

  // A resposta chega depois: usa as funções da renderização mais recente, e não as de quando o envio começou
  const callbacks = useRef({ onChange, onUploadingChange })
  useEffect(() => {
    callbacks.current = { onChange, onUploadingChange }
  })
  const mounted = useRef(true)
  const uploading = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // Fechado no meio do envio: o resultado será ignorado, e quem acompanha precisa saber que acabou
      if (uploading.current) {
        uploading.current = false
        callbacks.current.onUploadingChange?.(false)
      }
    }
  }, [])

  const send = async (file: File) => {
    // `:disabled` cobre o formulário bloqueado, em que arrastar ainda dispararia o evento
    if (uploading.current || input.current?.matches(":disabled")) return
    const refusal = checkImage(file, kind)
    setFailure(refusal)
    if (refusal) return

    const preview = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : ""
    uploading.current = true
    setSending(preview)
    callbacks.current.onUploadingChange?.(true)
    try {
      const image = await uploadImage(file, kind)
      if (mounted.current) callbacks.current.onChange(image)
    } catch (cause) {
      if (mounted.current) setFailure(cause instanceof UploadError ? cause.message : UPLOAD_FAILED)
    } finally {
      if (preview) URL.revokeObjectURL(preview)
      if (mounted.current) {
        uploading.current = false
        setSending(null)
        callbacks.current.onUploadingChange?.(false)
      }
    }
  }

  const busy = sending !== null
  const shown = sending || value
  const open = () => input.current?.click()
  const message = failure ?? error
  const drop = {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setDragging(true) },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) void send(file)
    },
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined} className="min-w-0 space-y-2">
      <span id={`${id}-label`} className="block text-sm font-medium">{label}</span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        data-testid="image-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = "" // permite escolher o mesmo arquivo de novo
          if (file) void send(file)
        }}
      />

      {shown ? (
        <div {...drop} className="space-y-2">
          <div className={`relative overflow-hidden rounded-lg border bg-muted/40 ${dragging ? "border-primary" : "border-border"} ${previewClassName}`}>
            {broken === shown ? (
              <p className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                Não foi possível mostrar esta imagem.
              </p>
            ) : (
              <img src={shown} alt={previewAlt} className="h-full w-full object-contain" onError={() => setBroken(shown)} />
            )}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-10 w-10 animate-spin text-white/80" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={open} aria-label={`Trocar imagem: ${label}`}>
              <ImageUp className="h-3.5 w-3.5" aria-hidden="true" /> Trocar imagem
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setFailure(null); onChange(null) }} aria-label={`Remover imagem: ${label}`}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remover imagem
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          {...drop}
          onClick={open}
          aria-labelledby={`${id}-label ${id}-action`}
          className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50"}`}
        >
          <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <span id={`${id}-action`} className="font-medium">{dragging ? "Solte a imagem aqui" : "Arraste ou clique para enviar"}</span>
          <span className="text-xs text-muted-foreground">PNG, JPG ou WebP • até 5 MB</span>
        </button>
      )}

      <p role="status" className="sr-only">{busy ? "Enviando imagem..." : ""}</p>
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    </div>
  )
}
