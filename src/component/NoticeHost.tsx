import { useEffect, useSyncExternalStore } from "react"
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/Shadcn-Components/ui/dialog"
import { cn } from "@/lib/utils"
import { currentNotice, dismissNotice, subscribeNotice, type Notice, type NoticeIcon } from "@/lib/notice"

const ICONS: Record<NoticeIcon, { Icon: LucideIcon; tone: string; label: string }> = {
  success: { Icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-500", label: "Sucesso" },
  error: { Icon: XCircle, tone: "bg-destructive/10 text-destructive", label: "Erro" },
  warning: { Icon: AlertTriangle, tone: "bg-amber-500/10 text-amber-500", label: "Atenção" },
  info: { Icon: Info, tone: "bg-sky-500/10 text-sky-500", label: "Informação" },
}

function NoticeBody({ notice }: { notice: Notice }) {
  const { Icon, tone, label } = ICONS[notice.icon]

  // Avisos com tempo fecham sozinhos (como o antigo popup de "Até logo!")
  useEffect(() => {
    if (!notice.timer) return
    const timeout = setTimeout(() => dismissNotice(notice.id), notice.timer)
    return () => clearTimeout(timeout)
  }, [notice])

  return (
    <>
      <DialogHeader className="items-center gap-3 text-center sm:text-center">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-full", tone)} role="img" aria-label={label}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <DialogTitle className="text-center">{notice.title}</DialogTitle>
        {notice.text && <DialogDescription className="text-center">{notice.text}</DialogDescription>}
      </DialogHeader>
      {!notice.timer && (
        <Button type="button" className="w-full" onClick={() => dismissNotice(notice.id)}>
          OK
        </Button>
      )}
    </>
  )
}

/** Mostra os avisos de `notify()`. Montado uma vez, na raiz do app. */
export function NoticeHost() {
  const notice = useSyncExternalStore(subscribeNotice, currentNotice, () => null)
  if (!notice) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) dismissNotice(notice.id) }}>
      <DialogContent className="max-w-sm" showCloseButton={false}>
        <NoticeBody key={notice.id} notice={notice} />
      </DialogContent>
    </Dialog>
  )
}
