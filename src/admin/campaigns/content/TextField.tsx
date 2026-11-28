import { useId, type ReactNode } from "react"
import { Input } from "@/Shadcn-Components/ui/input"
import { Label } from "@/Shadcn-Components/ui/label"
import type { LinkSuggestion } from "@/admin/campaigns/content/fields"

/** Caixa de texto com rótulo, dica e erro junto dela. */
export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  placeholder,
  suggestions,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  error?: string
  placeholder?: string
  /** Destinos sugeridos numa caixa de link. */
  suggestions?: readonly LinkSuggestion[]
}) {
  const id = useId()
  const note = error ?? hint
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        autoComplete="off"
        placeholder={placeholder}
        list={suggestions && `${id}-list`}
        aria-invalid={!!error}
        aria-describedby={note ? `${id}-note` : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {suggestions && (
        <datalist id={`${id}-list`}>
          {suggestions.map((suggestion) => (
            <option key={suggestion.value} value={suggestion.value}>{suggestion.label}</option>
          ))}
        </datalist>
      )}
      {note && <p id={`${id}-note`} className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>{note}</p>}
    </div>
  )
}

/** Caixa de link: caminho da loja ou endereço `https://`. */
export function LinkField({
  optional = false,
  ...props
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  suggestions: readonly LinkSuggestion[]
  optional?: boolean
}) {
  return (
    <TextField
      {...props}
      placeholder="/?colecao=ofertas ou https://..."
      hint={`${optional ? "Opcional. " : ""}Caminho da loja (começa com /) ou endereço https://.`}
    />
  )
}
