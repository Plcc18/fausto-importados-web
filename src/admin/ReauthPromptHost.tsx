import { useState, useSyncExternalStore } from "react"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { Input } from "@/Shadcn-Components/ui/input"
import { Label } from "@/Shadcn-Components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Shadcn-Components/ui/dialog"
import { currentRequest, settle, subscribe, type PromptRequest } from "@/admin/reauthBridge"

function Prompt({ request }: { request: PromptRequest }) {
  const [code, setCode] = useState("")

  if (request.reason === "locked") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Muitas tentativas</DialogTitle>
          <DialogDescription>Aguarde alguns minutos antes de tentar novamente.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => settle(null)}>Entendi</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) settle(code.trim())
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden />
          Confirme sua identidade
        </DialogTitle>
        <DialogDescription>
          Esta ação é sensível. Digite o código do seu aplicativo autenticador (ou um código de recuperação).
        </DialogDescription>
      </DialogHeader>

      {request.reason === "invalid" && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Código inválido. Digite o código atual do aplicativo (ele troca a cada 30 segundos).
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="reauth-code">Código</Label>
        <Input
          id="reauth-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={24}
          className="tracking-widest"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => settle(null)}>Cancelar</Button>
        <Button type="submit" disabled={!code.trim()}>Confirmar</Button>
      </DialogFooter>
    </form>
  )
}

/** Monte UMA vez nas telas de administração. Mostra o pedido de código quando uma operação sensível precisar. */
export function ReauthPromptHost() {
  const request = useSyncExternalStore(subscribe, currentRequest, () => null)
  if (!request) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) settle(null) }}>
      <DialogContent className="max-w-sm">
        <Prompt key={request.id} request={request} />
      </DialogContent>
    </Dialog>
  )
}
