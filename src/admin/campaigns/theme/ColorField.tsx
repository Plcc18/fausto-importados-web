import { RotateCcw } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { Input } from "@/Shadcn-Components/ui/input"
import { HEX_COLOR } from "@/admin/campaigns/theme/themeDraft"

/** Uma cor: seletor do navegador, o código `#RRGGBB` e a volta ao padrão. */
export function ColorField({
  id,
  label,
  hint,
  value,
  fallback,
  required,
  error,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: string
  /** A cor da loja para este campo: o que "restaurar" aplica num obrigatório e o que vale num opcional vazio. */
  fallback: string
  required: boolean
  error?: string
  onChange: (value: string) => void
}) {
  const restored = required ? fallback : ""
  const note = error ?? hint
  // o seletor do navegador só aceita `#rrggbb`; sem um valor assim, mostra a cor da loja (ou cinza)
  const shown = HEX_COLOR.test(value) ? value : HEX_COLOR.test(fallback) ? fallback : "#808080"

  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {!required && <span className="text-xs font-normal text-muted-foreground">{" "}(opcional)</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label}: abrir o seletor`}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
          value={shown.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <Input
          id={id}
          className="font-mono"
          placeholder={required ? "#RRGGBB" : "Padrão da loja"}
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          aria-invalid={!!error}
          aria-describedby={note ? `${id}-note` : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          // a cor já vale na prévia: Enter aqui não deve salvar a campanha (que pode estar publicada)
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Restaurar padrão"
          aria-label={`Restaurar padrão: ${label}`}
          disabled={value.toLowerCase() === restored.toLowerCase()}
          onClick={() => onChange(restored)}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {note && (
        <p id={`${id}-note`} className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>{note}</p>
      )}
    </div>
  )
}
