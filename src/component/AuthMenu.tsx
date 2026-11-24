import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { LayoutDashboard, LogOut, User } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/Shadcn-Components/ui/popover"
import { authClient, hasSessionHint, useAuthProfile, useAuthStatus } from "@/lib/auth"
import { ROUTES } from "@/routes"
import { cn } from "@/lib/utils"

const pill =
  "flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/50 hover:bg-muted"

/**
 * Menu de conta no cabeçalho da loja, só para quem TEM sessão:
 *  - sem sessão: nada é mostrado (não há cadastro de clientes, então não há botão "Entrar" para o público;
 *    quem administra entra direto em /entrar) e nenhuma requisição é feita para quem nunca entrou neste navegador;
 *  - cliente: menu da conta com "Sair";
 *  - administrador: o mesmo menu + "Painel".
 *
 * Quem já entrou antes vê um esqueleto de largura fixa enquanto a sessão é recuperada, em vez de o menu surgir
 * de repente e deslocar o cabeçalho. O botão "Painel" só existe depois de a API confirmar que a pessoa é administradora — e a API
 * continua sendo quem de fato decide (esconder o botão não é segurança).
 */
export function AuthMenu() {
  const status = useAuthStatus()
  const profile = useAuthProfile()
  const [restoring, setRestoring] = useState(() => hasSessionHint() && authClient.getProfile() === null)
  const [open, setOpen] = useState(false)

  // Há dica de sessão neste navegador: recupera a sessão (refresh pelo cookie + /auth/me).
  useEffect(() => {
    if (!hasSessionHint() || authClient.getProfile()) {
      setRestoring(false)
      return
    }
    let cancelled = false
    void authClient.restoreSession().finally(() => {
      if (!cancelled) setRestoring(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Entrou nesta aba (ou em outra) e ainda não sabemos quem é: consulta.
  useEffect(() => {
    if (status === "authenticated" && !profile) void authClient.loadProfile()
  }, [status, profile])

  const pending = !profile && status !== "anonymous" && (status === "authenticated" || restoring)

  if (profile) {
    const name = profile.email.split("@")[0] || "Minha conta"
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={pill} aria-label="Minha conta" title={profile.email}>
            <User className="h-4 w-4" />
            <span className="hidden max-w-[7rem] truncate sm:block">{name}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium" data-testid="account-email">{profile.email}</p>
            <p className="text-xs text-muted-foreground">{profile.role === "ADMIN" ? "Administrador" : "Cliente"}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          {profile.role === "ADMIN" && (
            <Link
              to={ROUTES.admin}
              onClick={() => setOpen(false)}
              // a pessoa já foi confirmada como administradora: pode pré-carregar o código do painel
              onMouseEnter={() => void import("@/admin/Admin")}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted")}
            >
              <LayoutDashboard className="h-4 w-4" />
              Painel
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void authClient.logout()
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </PopoverContent>
      </Popover>
    )
  }

  if (pending) {
    // largura fixa: o cabeçalho não "pula" quando a conta aparece
    return <span aria-busy="true" aria-label="Carregando conta" className="h-9 w-9 animate-pulse rounded-full bg-muted sm:w-24" />
  }

  return null // sem sessão: o cabeçalho não mostra nada de conta
}
