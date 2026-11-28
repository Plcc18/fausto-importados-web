import { DECORATION_TYPES, type DecorationType } from "@/lib/campaign/types"
import { DECORATION_LABELS, MAX_DECORATIONS } from "@/admin/campaigns/content/contentDraft"
import { Section } from "@/admin/campaigns/content/Section"

/** Enfeites discretos sobre a loja (T25). */
export function DecorationsEditor({
  decorations,
  errors,
  onChange,
}: {
  decorations: DecorationType[]
  errors: Partial<Record<string, string>>
  onChange: (update: (current: DecorationType[]) => DecorationType[], changed: string[]) => void
}) {
  const full = decorations.length >= MAX_DECORATIONS
  const apiError = Object.entries(errors).find(([path, message]) => message && path.startsWith("content.decorations"))?.[1]

  return (
    <Section
      title="Enfeites"
      description={`Até ${MAX_DECORATIONS}. Passam sobre a página da loja sem atrapalhar cliques e ficam parados para quem prefere menos movimento.`}
      error={apiError}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DECORATION_TYPES.map((type) => {
          const checked = decorations.includes(type)
          return (
            <label
              key={type}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-primary has-disabled:opacity-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={checked}
                disabled={!checked && full}
                onChange={(e) =>
                  onChange(
                    (current) => (e.target.checked ? [...current, type] : current.filter((other) => other !== type)),
                    ["content.decorations"],
                  )
                }
              />
              {DECORATION_LABELS[type]}
            </label>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground" role="status">{decorations.length} de {MAX_DECORATIONS} escolhidos.</p>
    </Section>
  )
}
