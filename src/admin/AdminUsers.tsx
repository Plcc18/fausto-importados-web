import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Copy, KeyRound, Trash2, UserCheck, UserPlus, UserX } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { Input } from "@/Shadcn-Components/ui/input"
import { Label } from "@/Shadcn-Components/ui/label"
import { Badge } from "@/Shadcn-Components/ui/badge"
import { Card, CardContent } from "@/Shadcn-Components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Shadcn-Components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Shadcn-Components/ui/table"
import { ThemeToggle } from "@/component/ThemeToggle"
import { API_URL } from "@/lib/api"
import { authFetch, useAuthProfile } from "@/lib/auth"
import { ROUTES } from "@/routes"
import { SENSITIVE_NOT_DONE, sensitiveFetch } from "@/admin/sensitive"

interface Account {
  id: string
  email: string
  role: "ADMIN" | "USER"
  active: boolean
  mfaEnabled: boolean
}

/** Senha temporária mostrada UMA vez (conta criada ou redefinida). */
/** Pedido de confirmação aberto; `resolve(true)` = a pessoa confirmou. */
interface Confirmation {
  title: string
  text: string
  button: string
  destructive: boolean
  resolve: (confirmed: boolean) => void
}

interface IssuedCredentials {
  kind: "created" | "reset"
  email: string
  temporaryPassword: string
  enrollmentExpiresAt: string | null
}

const JSON_HEADERS = { "Content-Type": "application/json" }

/** As mensagens da API são fixas em inglês: traduz as que o usuário pode ver. */
function explain(status: number, message: string | undefined): string {
  const text = message ?? ""
  if (/already registered/i.test(text)) return "Já existe uma conta com esse e-mail."
  if (/last active administrator/i.test(text)) return "Não é possível remover nem desativar o último administrador ativo."
  if (/deactivate your own/i.test(text)) return "Você não pode desativar a própria conta."
  if (/delete your own/i.test(text)) return "Você não pode excluir a própria conta."
  if (/reset your own/i.test(text)) return "Você não pode redefinir as próprias credenciais. Troque sua senha ou use um código de recuperação."
  if (/Email is (invalid|mandatory)/i.test(text)) return "Informe um e-mail válido."
  if (status === 403) return SENSITIVE_NOT_DONE
  if (status === 404) return "Essa conta não existe mais. Atualize a lista."
  if (status === 429) return "Muitas tentativas. Aguarde alguns minutos."
  return "Não foi possível concluir a operação. Tente novamente."
}

async function apiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null
  return explain(res.status, body?.message)
}

const formatDeadline = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null

/**
 * Gestão de administradores: cada pessoa tem a PRÓPRIA conta (e o próprio autenticador). Criar, desativar,
 * redefinir e excluir pedem um código 2FA recente (diálogo de confirmação). A senha temporária de uma conta nova
 * aparece só uma vez. Quem decide o que é permitido é a API; esta tela só traduz as respostas.
 */
export function AdminUsers() {
  const navigate = useNavigate()
  const me = useAuthProfile()

  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [credentials, setCredentials] = useState<IssuedCredentials | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/user`)
      if (!res.ok) throw new Error(String(res.status))
      const list = (await res.json()) as Account[]
      setAccounts([...list].sort((a, b) => a.email.localeCompare(b.email)))
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const isMe = useMemo(() => {
    const mine = me?.email.toLowerCase()
    return (account: Account) => !!mine && account.email.toLowerCase() === mine
  }, [me])

  const activeAdmins = accounts?.filter((a) => a.role === "ADMIN" && a.active).length ?? 0

  const askConfirmation = (details: Omit<Confirmation, "resolve" | "destructive"> & { destructive?: boolean }) =>
    new Promise<boolean>((resolve) => setConfirmation({ destructive: false, ...details, resolve }))

  const answerConfirmation = (confirmed: boolean) => {
    confirmation?.resolve(confirmed)
    setConfirmation(null)
  }

  /** Pede confirmação (diálogo do site), roda a operação sensível e atualiza a lista. */
  const act = async (
    account: Account,
    confirm: { title: string; text: string; button: string; destructive?: boolean },
    request: () => Promise<Response>,
    onOk?: (res: Response) => Promise<void>,
  ) => {
    if (!(await askConfirmation(confirm))) return

    setBusyId(account.id)
    setNotice(null)
    try {
      const res = await request()
      if (!res.ok) {
        setNotice({ tone: "error", text: await apiError(res) })
        return
      }
      await onOk?.(res)
      await load()
    } catch {
      setNotice({ tone: "error", text: "Não foi possível conectar ao servidor. Tente novamente." })
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = (account: Account) =>
    act(
      account,
      account.active
        ? { title: "Desativar conta?", text: `${account.email} perde o acesso agora e todas as sessões abertas são encerradas.`, button: "Desativar", destructive: true }
        : { title: "Reativar conta?", text: `${account.email} poderá entrar de novo.`, button: "Reativar" },
      () =>
        sensitiveFetch(`${API_URL}/api/user/${account.id}/active`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ active: !account.active }),
        }),
      async () => setNotice({ tone: "ok", text: account.active ? "Conta desativada." : "Conta reativada." }),
    )

  const resetCredentials = (account: Account) =>
    act(
      account,
      {
        title: "Redefinir credenciais?",
        text: `Gera uma nova senha temporária para ${account.email}, apaga o autenticador e os códigos de recuperação e encerra as sessões. A pessoa precisará cadastrar o 2FA de novo.`,
        button: "Redefinir",
        destructive: true,
      },
      () => sensitiveFetch(`${API_URL}/api/user/${account.id}/reset-credentials`, { method: "POST" }),
      async (res) => {
        const body = (await res.json()) as { temporaryPassword: string; enrollmentExpiresAt: string | null }
        setCopied(false)
        setCredentials({ kind: "reset", email: account.email, ...body })
      },
    )

  const remove = (account: Account) =>
    act(
      account,
      {
        title: "Excluir conta?",
        text: `${account.email} será removida definitivamente. Para só bloquear o acesso, prefira desativar.`,
        button: "Excluir",
        destructive: true,
      },
      () => sensitiveFetch(`${API_URL}/api/user/${account.id}`, { method: "DELETE" }),
      async () => setNotice({ tone: "ok", text: "Conta excluída." }),
    )

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setFormError(null)
    try {
      const res = await sensitiveFetch(`${API_URL}/api/user`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        setFormError(await apiError(res))
        return
      }
      const body = (await res.json()) as { email: string; temporaryPassword: string; enrollmentExpiresAt: string | null }
      setCreateOpen(false)
      setEmail("")
      setCopied(false)
      setCredentials({ kind: "created", ...body })
      await load()
    } catch {
      setFormError("Não foi possível conectar ao servidor. Tente novamente.")
    } finally {
      setCreating(false)
    }
  }

  const copyPassword = async () => {
    if (!credentials) return
    try {
      await navigator.clipboard.writeText(credentials.temporaryPassword)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(ROUTES.admin)} aria-label="Voltar ao painel">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-lg">Administradores</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">Cada pessoa com a própria conta e o próprio autenticador</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <Button className="gap-1 px-2 sm:px-4" onClick={() => { setFormError(null); setCreateOpen(true) }}>
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo administrador</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {notice && (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={
              notice.tone === "error"
                ? "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                : "rounded-lg border border-border bg-muted px-3 py-2 text-sm"
            }
          >
            {notice.text}
          </p>
        )}

        <Card>
          <CardContent className="p-0">
            {loadFailed && (
              <div className="p-6 text-center text-sm" role="alert">
                Não foi possível carregar as contas.{" "}
                <button className="underline" onClick={() => void load()}>Tentar novamente</button>
              </div>
            )}
            {!loadFailed && accounts === null && <p className="p-6 text-sm text-muted-foreground" aria-busy="true">Carregando...</p>}

            {accounts && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>2FA</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => {
                      const self = isMe(account)
                      const lastActive = account.role === "ADMIN" && account.active && activeAdmins <= 1
                      const busy = busyId === account.id
                      return (
                        <TableRow key={account.id} data-testid={`account-${account.email}`}>
                          <TableCell className="max-w-[16rem] truncate font-medium">
                            {account.email}
                            {self && <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.active ? "secondary" : "outline"}>{account.active ? "Ativo" : "Desativado"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.mfaEnabled ? "secondary" : "outline"}>
                              {account.mfaEnabled ? "Configurado" : "Aguardando cadastro"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline" size="icon" disabled={busy || self || (account.active && lastActive)}
                                title={account.active ? "Desativar" : "Reativar"}
                                aria-label={`${account.active ? "Desativar" : "Reativar"} ${account.email}`}
                                onClick={() => void toggleActive(account)}
                              >
                                {account.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="outline" size="icon" disabled={busy || self || account.role !== "ADMIN"}
                                title="Redefinir credenciais" aria-label={`Redefinir credenciais de ${account.email}`}
                                onClick={() => void resetCredentials(account)}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline" size="icon" disabled={busy || self || lastActive}
                                title="Excluir" aria-label={`Excluir ${account.email}`}
                                onClick={() => void remove(account)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Ações sensíveis pedem um código do seu autenticador. Você não pode desativar, excluir ou redefinir a própria conta,
          e o último administrador ativo é sempre protegido. Quem sai da equipe: desative a conta no mesmo dia.
        </p>
      </main>

      {/* Confirmação de ação (substitui o popup do SweetAlert2: diálogo do próprio site) */}
      <Dialog open={confirmation !== null} onOpenChange={(open) => { if (!open) answerConfirmation(false) }}>
        <DialogContent className="max-w-sm">
          {confirmation && (
            <>
              <DialogHeader>
                <DialogTitle>{confirmation.title}</DialogTitle>
                <DialogDescription>{confirmation.text}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => answerConfirmation(false)}>Cancelar</Button>
                <Button type="button" variant={confirmation.destructive ? "destructive" : "default"} onClick={() => answerConfirmation(true)}>
                  {confirmation.button}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Novo administrador */}
      <Dialog open={createOpen} onOpenChange={(open) => !creating && setCreateOpen(open)}>
        <DialogContent className="max-w-sm">
          <form onSubmit={create} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Novo administrador</DialogTitle>
              <DialogDescription>Só o e-mail. A senha temporária é gerada e mostrada uma vez.</DialogDescription>
            </DialogHeader>
            {formError && (
              <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-admin-email" className="sr-only">E-mail</Label>
              <Input id="new-admin-email" type="email" placeholder="E-mail da pessoa" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating || !email.trim()}>{creating ? "Criando..." : "Criar conta"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Senha temporária: aparece uma única vez e é descartada ao fechar */}
      <Dialog open={credentials !== null} onOpenChange={(open) => { if (!open) { setCredentials(null); setCopied(false) } }}>
        <DialogContent className="max-w-md">
          {credentials && (
            <>
              <DialogHeader>
                <DialogTitle>{credentials.kind === "created" ? "Conta criada" : "Credenciais redefinidas"}</DialogTitle>
                <DialogDescription>
                  Entregue a senha abaixo a <strong>{credentials.email}</strong> por um canal seguro. Ela <strong>não será mostrada de novo</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <code data-testid="temporary-password" className="min-w-0 flex-1 break-all font-mono text-base select-all">
                    {credentials.temporaryPassword}
                  </code>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => void copyPassword()}>
                    <Copy className="h-4 w-4" />
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>A pessoa abre <strong>/entrar</strong> e entra com o e-mail e esta senha.</li>
                  <li>Cadastra o autenticador (QR code) e escolhe a senha definitiva.</li>
                  <li>Guarda os códigos de recuperação.</li>
                </ol>
                {formatDeadline(credentials.enrollmentExpiresAt) && (
                  <p className="text-sm">Prazo para concluir: <strong>{formatDeadline(credentials.enrollmentExpiresAt)}</strong>. Depois disso é preciso redefinir de novo.</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => { setCredentials(null); setCopied(false) }}>Já entreguei a senha</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
