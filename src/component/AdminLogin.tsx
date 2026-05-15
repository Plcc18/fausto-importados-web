import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/Shadcn-Components/ui/button"
import { Input } from "@/Shadcn-Components/ui/input"
import { Label } from "@/Shadcn-Components/ui/label"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import Swal from "sweetalert2"
import { API_URL } from "@/lib/api"
import { ThemeToggle } from "@/component/ThemeToggle"

export function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // credentials: "include" para o browser salvar o cookie
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        Swal.fire({
          icon: "error",
          title: "Negado",
          text: "Credenciais inválidas. Tente novamente!",
          timer: 2000,
          showConfirmButton: false,
        })
        return
      }

      // O token agora vem como cookie HttpOnly — não há body para ler.
      // O browser salva o cookie automaticamente e o envia em toda requisição.

      Swal.fire({
        icon: "success",
        title: "Login",
        text: "Bem vindo, ADM!",
        timer: 2000,
        showConfirmButton: false,
      })

      navigate("/nexus-24")
    } catch (err: any) {
      toast.error(err.message || "Email ou senha incorretos. Tente novamente!", {
        style: { backgroundColor: "#FF6347", color: "#ffffff" },
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="font-serif text-3xl font-medium tracking-tight">Fausto</span>
          <span className="block text-[10px] uppercase tracking-[0.35em] text-muted-foreground mt-0.5">
            Importados · Painel Admin
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-lg font-semibold mb-1">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Esta área é exclusiva para administradores.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <a href="/" className="hover:text-foreground transition-colors">
            ← Voltar para a loja
          </a>
        </p>
      </div>
    </div>
  )
}