import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff, ShieldCheck } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { Input } from "@/Shadcn-Components/ui/input"
import { Label } from "@/Shadcn-Components/ui/label"
import { ThemeToggle } from "@/component/ThemeToggle"
import { authClient, type MfaSetupInfo } from "@/lib/auth"
import { ROUTES, safeNextPath } from "@/routes"

type Step =
  | { name: "credentials" }
  | { name: "mfa"; challenge: string }
  | { name: "setup"; challenge: string; passwordChangeRequired: boolean }
  | { name: "recovery"; codes: string[] }

const MIN_PASSWORD_LENGTH = 12

const waitText = (seconds: number) => {
  const minutes = Math.ceil(seconds / 60)
  return minutes <= 1 ? "1 minuto" : `${minutes} minutos`
}

/**
 * Entrar na conta. Mesma tela para todos; para administradores ela segue com o código do autenticador (2FA) e,
 * no primeiro acesso, com o cadastro do autenticador (QR code) e os códigos de recuperação.
 * Nenhuma mensagem diz se foi o e-mail ou a senha que errou.
 */
export function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [step, setStep] = useState<Step>({ name: "credentials" })
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState("")
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("")
  const [setupInfo, setSetupInfo] = useState<MfaSetupInfo | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [savedCodes, setSavedCodes] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const challenge = step.name === "mfa" || step.name === "setup" ? step.challenge : null

  /** Sessão aberta: descobre quem é e vai para onde a pessoa queria (ou para o painel / a loja). */
  const finish = async () => {
    const result = await authClient.loadProfile(true)
    const next = safeNextPath(params.get("next"))
    const fallback = result.kind === "ok" && result.profile.role === "ADMIN" ? ROUTES.admin : ROUTES.home
    navigate(next ?? fallback, { replace: true })
  }

  const backToCredentials = (message: string | null) => {
    setStep({ name: "credentials" })
    setCode("")
    setPassword("")
    setSetupInfo(null)
    setQrDataUrl(null)
    setError(message)
  }

  // Cadastro do 2FA: pede o segredo ao entrar no passo e desenha o QR code aqui no navegador
  // (o segredo nunca vai a um serviço externo). Se o QR falhar, a chave manual continua na tela.
  const setupChallenge = step.name === "setup" ? step.challenge : null
  useEffect(() => {
    if (!setupChallenge) return
    let cancelled = false
    void (async () => {
      const result = await authClient.beginMfaSetup(setupChallenge).catch(() => ({ kind: "error" as const }))
      if (cancelled) return
      if (result.kind === "ok") {
        setSetupInfo(result.info)
        try {
          const { default: QRCode } = await import("qrcode")
          const url = await QRCode.toDataURL(result.info.otpauthUri, { width: 220, margin: 1 })
          if (!cancelled) setQrDataUrl(url)
        } catch {
          /* sem QR: usa a chave manual */
        }
      } else if (result.kind === "challenge-expired") {
        backToCredentials("O tempo para continuar expirou. Entre novamente.")
      } else if (result.kind === "locked") {
        backToCredentials(`Muitas tentativas. Tente novamente em ${waitText(result.retryAfterSeconds)}.`)
      } else {
        setError("Não foi possível iniciar o cadastro do autenticador. Tente novamente.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setupChallenge])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      setError("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  const submitCredentials = (e: React.FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const result = await authClient.login(email.trim(), password)
      switch (result.kind) {
        case "authenticated":
          return finish()
        case "mfa-required":
          setCode("")
          return setStep({ name: "mfa", challenge: result.challenge })
        case "mfa-setup":
          setCode("")
          return setStep({ name: "setup", challenge: result.challenge, passwordChangeRequired: result.passwordChangeRequired })
        case "locked":
          return setError(`Muitas tentativas. Tente novamente em ${waitText(result.retryAfterSeconds)}.`)
        default:
          setPassword("")
          return setError("E-mail ou senha incorretos.")
      }
    })
  }

  const submitMfa = (e: React.FormEvent) => {
    e.preventDefault()
    if (step.name !== "mfa") return
    void run(async () => {
      const result = await authClient.verifyMfa(step.challenge, code.trim())
      switch (result.kind) {
        case "authenticated":
          return finish()
        case "challenge-expired":
          return backToCredentials("O tempo para informar o código expirou. Entre novamente.")
        case "locked":
          return setError(`Muitas tentativas. Tente novamente em ${waitText(result.retryAfterSeconds)}.`)
        default:
          setCode("")
          return setError("Código inválido. Confira o aplicativo e tente novamente.")
      }
    })
  }

  const submitSetup = (e: React.FormEvent) => {
    e.preventDefault()
    if (step.name !== "setup") return
    if (step.passwordChangeRequired) {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return setError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      }
      if (newPassword !== newPasswordConfirm) return setError("As senhas não conferem.")
    }
    void run(async () => {
      const result = await authClient.confirmMfaSetup(
        step.challenge,
        code.trim(),
        step.passwordChangeRequired ? newPassword : undefined,
      )
      switch (result.kind) {
        case "authenticated":
          setNewPassword("")
          setNewPasswordConfirm("")
          return setStep({ name: "recovery", codes: result.recoveryCodes })
        case "weak-password":
          return setError(result.message)
        case "challenge-expired":
          return backToCredentials("O tempo para concluir o cadastro expirou. Entre novamente.")
        case "locked":
          return setError(`Muitas tentativas. Tente novamente em ${waitText(result.retryAfterSeconds)}.`)
        case "invalid-code":
          setCode("")
          return setError("Código inválido. Confira o aplicativo e tente novamente.")
        default:
          return setError("Não foi possível concluir o cadastro. Tente novamente.")
      }
    })
  }

  const copyCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const title =
    step.name === "mfa" ? "Verificação em duas etapas"
      : step.name === "setup" ? "Proteja sua conta"
        : step.name === "recovery" ? "Guarde seus códigos de recuperação"
          : "Entrar"
  const subtitle =
    step.name === "mfa" ? "Digite o código de 6 dígitos do seu aplicativo autenticador."
      : step.name === "setup" ? "Cadastre um aplicativo autenticador para concluir o acesso."
        : step.name === "recovery" ? "Cada código vale uma vez e só aparece agora."
          : "Acesse sua conta."

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-serif text-3xl font-medium tracking-tight">Fausto</span>
          <span className="block text-[10px] uppercase tracking-[0.35em] text-muted-foreground mt-0.5">Importados</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-lg font-semibold mb-1 flex items-center gap-2">
            {step.name !== "credentials" && <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden />}
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>

          {error && (
            <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {step.name === "credentials" && (
            <form onSubmit={submitCredentials} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" required />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={busy}>
                {busy ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          )}

          {step.name === "mfa" && (
            <form onSubmit={submitMfa} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">{useRecoveryCode ? "Código de recuperação" : "Código do autenticador"}</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus
                  autoComplete="one-time-code" inputMode={useRecoveryCode ? "text" : "numeric"}
                  placeholder={useRecoveryCode ? "XXXX-XXXX-XXXX-XXXX" : "000000"}
                  maxLength={useRecoveryCode ? 24 : 6} className="tracking-widest" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Verificando..." : "Verificar"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => { setUseRecoveryCode((v) => !v); setCode(""); setError(null) }}>
                  {useRecoveryCode ? "Usar o código do aplicativo" : "Usar um código de recuperação"}
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => backToCredentials(null)}>
                  Voltar
                </button>
              </div>
            </form>
          )}

          {step.name === "setup" && (
            <form onSubmit={submitSetup} className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Abra um aplicativo autenticador (Google Authenticator, Authy, 1Password...).</li>
                <li>Escaneie o QR code ou digite a chave abaixo.</li>
                <li>Informe o código de 6 dígitos que o aplicativo mostrar.</li>
              </ol>

              <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-3">
                {qrDataUrl
                  ? <img src={qrDataUrl} alt="QR code para o aplicativo autenticador" width={220} height={220} />
                  : <div className="flex h-[220px] w-[220px] items-center justify-center text-xs text-muted-foreground" aria-busy="true">
                    {setupInfo ? "Use a chave abaixo" : "Gerando..."}
                  </div>}
                {setupInfo && (
                  <div className="w-full text-center">
                    <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Chave manual</span>
                    <code data-testid="manual-key" className="block break-all text-sm font-mono select-all">
                      {setupInfo.secret.replace(/(.{4})/g, "$1 ").trim()}
                    </code>
                  </div>
                )}
              </div>

              {step.passwordChangeRequired && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Sua senha atual é temporária. Escolha uma nova (mínimo de {MIN_PASSWORD_LENGTH} caracteres).
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <Input id="new-password" type="password" autoComplete="new-password" value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password-confirm">Repita a nova senha</Label>
                    <Input id="new-password-confirm" type="password" autoComplete="new-password" value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)} required />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="setup-code">Código do autenticador</Label>
                <Input id="setup-code" value={code} onChange={(e) => setCode(e.target.value)} required
                  autoComplete="one-time-code" inputMode="numeric" placeholder="000000" maxLength={6} className="tracking-widest" />
              </div>
              <Button type="submit" className="w-full" disabled={busy || !setupInfo}>
                {busy ? "Confirmando..." : "Confirmar e entrar"}
              </Button>
            </form>
          )}

          {step.name === "recovery" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se você perder o aparelho, cada código abaixo permite entrar uma vez. Guarde-os em um lugar seguro
                (gerenciador de senhas ou impresso). Eles não serão mostrados de novo.
              </p>
              <ul data-testid="recovery-codes" className="grid grid-cols-1 gap-1 rounded-lg border border-border p-3 font-mono text-sm">
                {step.codes.map((c) => <li key={c} className="select-all">{c}</li>)}
              </ul>
              <Button type="button" variant="outline" className="w-full" onClick={() => void copyCodes(step.codes)}>
                {copied ? "Copiado!" : "Copiar códigos"}
              </Button>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={savedCodes} onChange={(e) => setSavedCodes(e.target.checked)} className="mt-1" />
                <span>Guardei meus códigos de recuperação</span>
              </label>
              <Button type="button" className="w-full" disabled={!savedCodes || busy}
                onClick={() => void run(finish)}>
                Continuar
              </Button>
            </div>
          )}
        </div>

        {challenge === null && (
          <p className="text-center text-xs text-muted-foreground mt-6">
            <a href={ROUTES.home} className="hover:text-foreground transition-colors">← Voltar para a loja</a>
          </p>
        )}
      </div>
    </div>
  )
}
