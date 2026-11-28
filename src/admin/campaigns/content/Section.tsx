import { useId, type ReactNode } from "react"
import { Button } from "@/Shadcn-Components/ui/button"

/** Uma parte do conteúdo da campanha, com título e explicação. */
export function Section({
  title,
  description,
  error,
  children,
}: {
  title: string
  description: ReactNode
  /** Erro da parte inteira (os de cada campo aparecem junto dele). */
  error?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div>
        <h2 id={id} className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {children}
    </section>
  )
}

/** Parte ainda não usada: diz o que a loja mostra sem ela e oferece adicionar. */
export function EmptyPart({ text, action, onAdd }: { text: string; action: string; onAdd: () => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border px-3 py-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button type="button" variant="outline" onClick={onAdd}>{action}</Button>
    </div>
  )
}
