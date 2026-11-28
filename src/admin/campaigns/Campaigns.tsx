import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Megaphone } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { Card, CardContent } from "@/Shadcn-Components/ui/card"
import { ThemeToggle } from "@/component/ThemeToggle"
import { countCampaigns } from "@/admin/campaigns/api"
import { ROUTES } from "@/routes"

type State = { status: "loading" } | { status: "error" } | { status: "ready"; total: number }

const summary = (total: number) =>
  total === 0 ? "Nenhuma campanha cadastrada." : total === 1 ? "1 campanha cadastrada." : `${total} campanhas cadastradas.`

/** Área de campanhas sazonais do painel. Só abre para administradores (`RequireAdmin`, em `App.tsx`). */
export function Campaigns() {
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    countCampaigns().then(
      (total) => { if (!cancelled) setState({ status: "ready", total }) },
      () => { if (!cancelled) setState({ status: "error" }) },
    )
    return () => { cancelled = true }
  }, [attempt])

  const retry = () => {
    setState({ status: "loading" })
    setAttempt((n) => n + 1)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(ROUTES.admin)} aria-label="Voltar ao painel">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-lg">Campanhas</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">Campanhas sazonais da loja</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            {state.status === "loading" && (
              <p className="text-sm text-muted-foreground" aria-busy="true">Carregando campanhas...</p>
            )}
            {state.status === "error" && (
              <p className="text-sm" role="alert">
                Não foi possível carregar as campanhas.{" "}
                <button type="button" className="underline" onClick={retry}>Tentar novamente</button>
              </p>
            )}
            {state.status === "ready" && (
              <>
                <Megaphone className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <p className="mt-4 text-lg font-medium">{summary(state.total)}</p>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
