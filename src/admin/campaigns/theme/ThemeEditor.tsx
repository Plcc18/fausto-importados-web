import { useState } from "react"
import { AlertTriangle, Check } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Shadcn-Components/ui/dialog"
import { CAMPAIGN_TYPES, type CampaignType } from "@/lib/campaign/types"
import { ColorField } from "@/admin/campaigns/theme/ColorField"
import { contrastWarnings, formatRatio } from "@/admin/campaigns/theme/contrast"
import { effectiveColor, storeColor, storeGold, storePaletteDraft } from "@/admin/campaigns/theme/storePalette"
import { TEMPLATE_LABELS, templateTheme } from "@/admin/campaigns/theme/templates"
import { ThemePreview } from "@/admin/campaigns/theme/ThemePreview"
import {
  COLOR_FIELDS,
  GOLD_FIELDS,
  MODE_LABELS,
  type PaletteDraft,
  type ThemeDraft,
  type ThemeMode,
} from "@/admin/campaigns/theme/themeDraft"

const warningCount = (count: number) => (count === 1 ? "1 alerta de contraste" : `${count} alertas de contraste`)

/** Editor das cores da campanha, com modelos, miniprévia e alerta de contraste. */
export function ThemeEditor({
  theme,
  campaignType,
  errors,
  onChange,
}: {
  theme: ThemeDraft | null
  /** O tipo escolhido no formulário: é o modelo sugerido. */
  campaignType: CampaignType | ""
  errors: Partial<Record<string, string>>
  onChange: (theme: ThemeDraft | null) => void
}) {
  const [mode, setMode] = useState<ThemeMode>("dark")
  const [chosen, setChosen] = useState<CampaignType | null>(null)
  const template = chosen ?? (campaignType || "CUSTOM")
  /** Ação que descarta cores escolhidas, esperando confirmação. */
  const [confirming, setConfirming] = useState<{ title: string; text: string; button: string; run: () => void } | null>(null)

  const palette = theme?.[mode] ?? null
  const warnings = palette ? contrastWarnings(mode, palette) : []
  const modeError = errors[`theme.${mode}`]

  const setPalette = (next: PaletteDraft | null) => onChange({ dark: null, light: null, ...theme, [mode]: next })
  /** Aplica agora se não há nada a perder; senão, pergunta. */
  const replacing = (hasColors: boolean, question: NonNullable<typeof confirming>) =>
    hasColors ? setConfirming(question) : question.run()

  const applyTemplate = () =>
    replacing(theme !== null, {
      title: "Aplicar o modelo?",
      text: `As cores atuais dos dois modos serão trocadas pelas do modelo “${TEMPLATE_LABELS[template]}”.`,
      button: "Aplicar",
      run: () => onChange(templateTheme(template)),
    })

  const modeButton = (value: ThemeMode) => {
    const draft = theme?.[value]
    const count = draft ? contrastWarnings(value, draft).length : 0
    const failing = Object.keys(errors).some((path) => errors[path] && path.startsWith(`theme.${value}`))
    return (
      <Button
        type="button"
        size="sm"
        variant={mode === value ? "default" : "outline"}
        aria-pressed={mode === value}
        onClick={() => setMode(value)}
      >
        {MODE_LABELS[value]}
        {(failing || count > 0) && (
          <>
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">: {failing ? "com erros" : warningCount(count)}</span>
          </>
        )}
      </Button>
    )
  }

  return (
    <section aria-labelledby="theme-title" className="space-y-4">
      <div>
        <h2 id="theme-title" className="font-semibold">Tema</h2>
        <p className="text-xs text-muted-foreground">
          As cores da loja enquanto a campanha estiver no ar. O modo escuro é obrigatório para publicar; o claro é
          opcional.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
          Modelo
          <select
            className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm font-normal scheme-light dark:scheme-dark dark:bg-input/30 dark:[&_option]:bg-popover focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={template}
            onChange={(e) => setChosen(e.target.value as CampaignType)}
          >
            {CAMPAIGN_TYPES.map((type) => (
              <option key={type} value={type}>{TEMPLATE_LABELS[type]}</option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" onClick={applyTemplate}>Aplicar modelo</Button>
      </div>

      {!theme ? (
        <p className={`rounded-lg border border-dashed px-3 py-6 text-center text-sm ${errors["theme.dark"] ? "border-destructive text-destructive" : "border-border text-muted-foreground"}`}>
          {errors["theme.dark"] ?? "Sem tema. Escolha um modelo para começar; depois dá para mudar qualquer cor."}
        </p>
      ) : (
        <>
          <div role="group" aria-label="Modo do tema" className="flex flex-wrap gap-2">
            {modeButton("dark")}
            {modeButton("light")}
          </div>
          {/* sem `role="alert"`: o aviso junto dos botões de salvar já anuncia o problema */}
          {modeError && <p className="text-sm text-destructive">{modeError}</p>}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="order-2 min-w-0 space-y-5 lg:order-1">
              {!palette ? (
                <div className="space-y-3 rounded-lg border border-dashed border-border px-3 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {mode === "light"
                      ? "No modo claro, a loja usa o tema padrão."
                      : "O modo escuro ainda não tem cores."}
                  </p>
                  <Button type="button" variant="outline" onClick={() => setPalette(templateTheme(template)[mode])}>
                    {mode === "light" ? "Personalizar o modo claro" : "Definir as cores do modo escuro"}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {COLOR_FIELDS.map(({ key, label, hint, required }) => (
                      <ColorField
                        key={`${mode}.${key}`}
                        id={`theme-${mode}-${key}`}
                        label={label}
                        hint={hint}
                        required={required}
                        value={palette[key]}
                        // obrigatório: o que "restaurar" aplica; opcional vazio: a cor que a loja vai usar
                        fallback={required ? storeColor(mode, key) : effectiveColor(mode, palette, key)}
                        error={errors[`theme.${mode}.${key}`]}
                        onChange={(value) => setPalette({ ...palette, [key]: value })}
                      />
                    ))}
                  </div>

                  {palette.gold ? (
                    <div className="space-y-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {GOLD_FIELDS.map(({ key, label }) => (
                          <ColorField
                            key={`${mode}.gold.${key}`}
                            id={`theme-${mode}-gold-${key}`}
                            label={label}
                            required
                            value={palette.gold![key]}
                            fallback={storeGold(mode)[key]}
                            error={errors[`theme.${mode}.gold.${key}`]}
                            onChange={(value) => setPalette({ ...palette, gold: { ...palette.gold!, [key]: value } })}
                          />
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPalette({ ...palette, gold: null })}>
                        Usar o dourado da marca
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => setPalette({ ...palette, gold: storeGold(mode) })}>
                      Personalizar o dourado
                    </Button>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => replacing(true, {
                        title: "Restaurar as cores da loja?",
                        text: `As cores do ${MODE_LABELS[mode].toLowerCase()} voltam às da loja sem campanha.`,
                        button: "Restaurar",
                        run: () => setPalette(storePaletteDraft(mode)),
                      })}
                    >
                      Restaurar todas as cores deste modo
                    </Button>
                    {mode === "light" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => replacing(true, {
                          title: "Remover o modo claro?",
                          text: "As cores do modo claro são apagadas, e a loja passa a usar o tema padrão nesse modo.",
                          button: "Remover",
                          run: () => setPalette(null),
                        })}
                      >
                        Usar o padrão da loja no modo claro
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => replacing(true, {
                        title: "Remover o tema?",
                        text: "As cores dos dois modos são apagadas. Sem tema, a campanha não pode ser publicada.",
                        button: "Remover",
                        run: () => onChange(null),
                      })}
                    >
                      Remover o tema
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="order-1 min-w-0 space-y-3 lg:order-2 lg:sticky lg:top-20 lg:self-start">
              <ThemePreview mode={mode} palette={palette} />
              {!palette && <p className="text-center text-xs text-muted-foreground">Cores padrão da loja</p>}
              {palette && (
                <div aria-live="polite" className="text-xs">
                  {warnings.length === 0 ? (
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Contraste adequado neste modo.
                    </p>
                  ) : (
                    <div className="space-y-1 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
                      <p className="flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {warningCount(warnings.length)}
                      </p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {warnings.map(({ where, ratio, minimum }) => (
                          <li key={where}>{where}: {formatRatio(ratio)} (mínimo {formatRatio(minimum)})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Dialog open={confirming !== null} onOpenChange={(open) => { if (!open) setConfirming(null) }}>
        <DialogContent className="max-w-sm">
          {confirming && (
            <>
              <DialogHeader>
                <DialogTitle>{confirming.title}</DialogTitle>
                <DialogDescription>{confirming.text}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirming(null)}>Cancelar</Button>
                <Button type="button" onClick={() => { confirming.run(); setConfirming(null) }}>{confirming.button}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
