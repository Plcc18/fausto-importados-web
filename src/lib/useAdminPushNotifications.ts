import { useEffect, useRef, useCallback, useState } from "react"
import { API_URL } from "@/lib/api"

const authFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, { ...options, credentials: "include" })

const MUTED_KEY = "admin_notifications_muted"

interface UseAdminPushNotificationsOptions {
  intervalMs?: number
  onNewOrder?: (count: number) => void
}

interface UseAdminPushNotificationsReturn {
  pendingCount: number
  /** Permissão concedida pelo navegador (não muda com o toggle) */
  permission: NotificationPermission
  /** Se o admin silenciou manualmente as notificações */
  muted: boolean
  /** Solicita permissão ao browser (só precisa ser chamado uma vez) */
  requestPermission: () => Promise<void>
  /** Liga/desliga notificações sem precisar acessar configurações do navegador */
  toggleMute: () => void
  poll: () => Promise<void>
}

/**
 * Polling de pedidos pendentes + Web Notifications com toggle de silenciar.
 *
 * Fluxo:
 * 1. Na primeira vez, o admin clica em "Ativar notificações" → requestPermission()
 *    abre o popup do browser. Aceitar uma vez é suficiente para sempre.
 * 2. Depois disso, o botão vira um toggle liga/desliga (toggleMute).
 *    O estado é salvo no localStorage e persiste entre sessões.
 * 3. Mesmo silenciado, o chime de áudio ainda toca quando há novos pedidos.
 *    Só a notificação push do sistema fica bloqueada.
 */
export function useAdminPushNotifications({
  intervalMs = 15_000,
  onNewOrder,
}: UseAdminPushNotificationsOptions = {}): UseAdminPushNotificationsReturn {
  const [pendingCount, setPendingCount] = useState(0)
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  )
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(MUTED_KEY) === "true" }
    catch { return false }
  })

  const lastCountRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  // Ref espelhando muted para uso dentro de callbacks sem re-criar
  const mutedRef = useRef(muted)
  useEffect(() => { mutedRef.current = muted }, [muted])

  // Sincroniza permissão quando o usuário volta para a aba
  useEffect(() => {
    const sync = () => {
      if (typeof Notification !== "undefined") setPermission(Notification.permission)
    }
    document.addEventListener("visibilitychange", sync)
    window.addEventListener("focus", sync)
    return () => {
      document.removeEventListener("visibilitychange", sync)
      window.removeEventListener("focus", sync)
    }
  }, [])

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === "suspended") ctx.resume()
      const notes = [659.25, 830.61]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = "sine"
        osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.2
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.2, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
        osc.start(t)
        osc.stop(t + 0.65)
      })
    } catch { /* AudioContext bloqueado */ }
  }, [])

  const sendPushNotification = useCallback((count: number) => {
    // Não envia se silenciado pelo toggle
    if (mutedRef.current) return
    if (typeof Notification === "undefined") return
    if (Notification.permission !== "granted") return
    try {
      const n = new Notification("🛎️ Novo pedido recebido!", {
        body: `Você tem ${count} pedido${count > 1 ? "s" : ""} pendente${count > 1 ? "s" : ""}.`,
        icon: "/favicon.ico",
        tag: "new-order",
        //renotify: true,
      })
      n.onclick = () => { window.focus(); n.close() }
    } catch { /* bloqueado */ }
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/orders/filter?status=PENDING`)
      if (!res.ok) return
      const data = await res.json()
      const count: number = Array.isArray(data) ? data.length : 0
      if (lastCountRef.current !== null && count > lastCountRef.current) {
        playChime()
        sendPushNotification(count)
        onNewOrder?.(count)
      }
      lastCountRef.current = count
      setPendingCount(count)
    } catch { /* erro de rede */ }
  }, [playChime, sendPushNotification, onNewOrder])

  // Unlock AudioContext na primeira interação do usuário
  useEffect(() => {
    const unlock = () => {
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
        if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume()
      } catch { /* ignore */ }
      document.removeEventListener("click", unlock)
    }
    document.addEventListener("click", unlock)
    return () => document.removeEventListener("click", unlock)
  }, [])

  // Polling com pausa quando aba em segundo plano
  useEffect(() => {
    poll()
    const id = setInterval(poll, intervalMs)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") poll()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [poll, intervalMs])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return
    if (Notification.permission === "denied") {
      setPermission("denied")
      return
    }
    const result = await Notification.requestPermission()
    setPermission(result)
    // Ao conceder permissão pela primeira vez, garante que não está mutado
    if (result === "granted") {
      setMuted(false)
      localStorage.setItem(MUTED_KEY, "false")
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localStorage.setItem(MUTED_KEY, String(next))
      return next
    })
  }, [])

  return { pendingCount, permission, muted, requestPermission, toggleMute, poll }
}