import { useEffect, useRef, useCallback } from "react"
import { API_URL } from "@/lib/api"

const authFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, { ...options, credentials: "include" })

/**
 * Polls /api/orders/filter?status=PENDING every `intervalMs` ms.
 * Fires onNewOrder(count) when the pending count increases.
 * Plays a subtle chime if the browser allows audio.
 */
export function useNewOrderPolling({
  enabled = true,
  intervalMs = 15_000,
  onNewOrder,
}: {
  enabled?: boolean
  intervalMs?: number
  onNewOrder: (count: number) => void
}) {
  const lastCountRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current

      // Two-note chime: E5 then G#5
      const notes = [659.25, 830.61]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = "sine"
        osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.18
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
        osc.start(t)
        osc.stop(t + 0.55)
      })
    } catch {
      // AudioContext blocked — silent fallback
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const poll = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/orders/filter?status=PENDING`)
        if (!res.ok) return
        const data = await res.json()
        const count: number = Array.isArray(data) ? data.length : 0

        if (lastCountRef.current !== null && count > lastCountRef.current) {
          playChime()
          onNewOrder(count)
        }
        lastCountRef.current = count
      } catch {
        // network error — ignore silently
      }
    }

    // First poll immediately
    poll()
    const id = setInterval(poll, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs, onNewOrder, playChime])
}