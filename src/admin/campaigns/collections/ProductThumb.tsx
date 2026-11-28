/** Miniatura do produto sobre fundo branco, como na loja (as fotos têm fundo branco). */
export function ProductThumb({ src }: { src?: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
      {src && <img src={src} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />}
    </span>
  )
}
