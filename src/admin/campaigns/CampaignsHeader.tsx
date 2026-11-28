import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { ThemeToggle } from "@/component/ThemeToggle"

/** Cabeçalho das telas de campanhas: voltar, título e ações. */
export function CampaignsHeader({
  title,
  backLabel,
  onBack,
  backDisabled,
  children,
}: {
  title: string
  backLabel: string
  onBack: () => void
  backDisabled?: boolean
  children?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={onBack} disabled={backDisabled} aria-label={backLabel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-lg">{title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">Datas no horário de Fortaleza</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          {children}
        </div>
      </div>
    </header>
  )
}
