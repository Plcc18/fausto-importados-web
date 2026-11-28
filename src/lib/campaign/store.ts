/**
 * Carregamento da campanha ativa (T17): um único ponto de busca, compartilhado por todos os componentes.
 *
 * - Começa a buscar no primeiro uso, em paralelo ao catálogo (nunca espera por ele nem o atrasa).
 * - Cache no `localStorage`: quem volta à loja vê a campanha na hora; uma campanha que já terminou é descartada.
 * - Busca de novo ao voltar para a aba e no próximo horário de mudança (`nextChangeAt`).
 * - Timeout e retentativas (a API no Render pode levar ~1 min para acordar). Se tudo falhar, a loja segue com o
 *   que tinha (a campanha do cache, enquanto valer) ou com o tema padrão. Nenhuma falha aqui vira tela de erro.
 *
 * Os horários são comparados com a hora do servidor, não com o relógio do visitante, que pode estar errado.
 */
import { RequestTimeoutError } from "@/lib/httpErrors"
import { isRetryableError } from "@/lib/useProducts"
import { fetchActiveCampaign } from "./client"
import { parseActiveCampaignResponse } from "./parse"
import type { ActiveCampaignResponse, PublicCampaign } from "./types"

// ─── Configuração ─────────────────────────────────────────────────────────────

/** Chave versionada: se o formato do cache mudar, basta incrementar a versão. */
export const CAMPAIGN_CACHE_KEY = "fausto_campaign_cache_v1"
/** Cache mais velho que isso é descartado, mesmo sem horário de mudança previsto. */
export const CAMPAIGN_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
/** Mesmo esquema do catálogo: 3 retentativas, nunca infinitas. */
export const CAMPAIGN_RETRY_DELAYS_MS = [2_000, 4_000, 8_000]
export const CAMPAIGN_REQUEST_TIMEOUT_MS = 60_000
/** Evita refazer a busca a cada alternância de aba em sequência rápida. */
export const CAMPAIGN_VISIBILITY_MIN_INTERVAL_MS = 30_000
/** Folga depois do horário de mudança: o cabeçalho `Date` só tem precisão de segundos. */
export const CAMPAIGN_CHANGE_MARGIN_MS = 2_000
/** O `setTimeout` do navegador não aceita esperas maiores que ~24,8 dias (dispararia na hora). */
const MAX_TIMER_MS = 2_147_483_647

// ─── Estado exposto ───────────────────────────────────────────────────────────

/**
 * - `loading`: a API ainda não respondeu (a campanha pode vir do cache enquanto isso);
 * - `ready`: a API respondeu ou todas as tentativas falharam. Daqui em diante, só atualizações silenciosas.
 */
export type CampaignStatus = "loading" | "ready"

export interface CampaignState {
  status: CampaignStatus
  /** `null` → tema padrão. */
  campaign: PublicCampaign | null
}

// ─── Cache (localStorage) ─────────────────────────────────────────────────────

interface CacheEntry {
  /** Quando foi salvo, no relógio local. */
  savedAt: number
  /** Diferença entre o relógio do servidor e o local, medida quando a resposta chegou. */
  clockOffsetMs: number
  response: ActiveCampaignResponse
}

/** Até quando uma resposta vale (hora do servidor, em ms): fim da campanha ou próxima mudança, o que vier antes. */
function validUntil(response: ActiveCampaignResponse): number {
  const limits = [response.nextChangeAt, response.campaign?.endsAt]
    .filter((value): value is string => typeof value === "string")
    .map((value) => Date.parse(value))
  return limits.length > 0 ? Math.min(...limits) : Number.POSITIVE_INFINITY
}

/** A resposta ainda vale neste instante (hora do servidor)? */
function isStillValid(response: ActiveCampaignResponse, serverNow: number): boolean {
  if (serverNow >= validUntil(response)) return false
  const startsAt = response.campaign ? Date.parse(response.campaign.startsAt) : Number.NEGATIVE_INFINITY
  return serverNow >= startsAt
}

export function readCampaignCache(storage: Storage | null, now = Date.now()): CacheEntry | null {
  try {
    const raw = storage?.getItem(CAMPAIGN_CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as Partial<CacheEntry> | null
    if (!entry || typeof entry.savedAt !== "number" || typeof entry.clockOffsetMs !== "number") return null
    if (!Number.isFinite(entry.savedAt) || !Number.isFinite(entry.clockOffsetMs)) return null
    if (now - entry.savedAt > CAMPAIGN_CACHE_MAX_AGE_MS || entry.savedAt > now + 60_000) return null
    // O localStorage pode ter sido alterado à mão (ou por uma versão antiga): passa pela mesma validação da API
    const response = parseActiveCampaignResponse(entry.response)
    if (!response || !isStillValid(response, now + entry.clockOffsetMs)) return null
    return { savedAt: entry.savedAt, clockOffsetMs: entry.clockOffsetMs, response }
  } catch {
    return null
  }
}

export function writeCampaignCache(storage: Storage | null, entry: CacheEntry): void {
  try {
    storage?.setItem(CAMPAIGN_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // Quota excedida ou storage bloqueado: o cache é só uma otimização.
  }
}

// ─── Requisição com timeout e retentativas ────────────────────────────────────

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"))
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

async function fetchOnce(signal: AbortSignal, timeoutMs: number): Promise<ActiveCampaignResponse> {
  // Controller próprio por tentativa: o timeout aborta só esta tentativa; `signal` aborta tudo.
  const attempt = new AbortController()
  let timedOut = false
  const onParentAbort = () => attempt.abort()
  signal.addEventListener("abort", onParentAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    attempt.abort()
  }, timeoutMs)
  try {
    return await fetchActiveCampaign(attempt.signal)
  } catch (error) {
    if (timedOut && !signal.aborted) throw new RequestTimeoutError()
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", onParentAbort)
  }
}

/** `keepTrying`: consultado antes de cada nova tentativa (ex.: a pessoa saiu da loja → para de tentar). */
async function fetchWithRetry(signal: AbortSignal, retryDelaysMs: number[], timeoutMs: number, keepTrying: () => boolean) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOnce(signal, timeoutMs)
    } catch (error) {
      // 404 e outros 4xx não melhoram tentando de novo; rede, timeout e 5xx sim
      if (signal.aborted || attempt >= retryDelaysMs.length || !isRetryableError(error) || !keepTrying()) throw error
      await sleep(retryDelaysMs[attempt], signal)
      // A pessoa pode ter saído da loja durante a espera
      if (!keepTrying()) throw error
    }
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

function isSameCampaign(a: PublicCampaign | null, b: PublicCampaign | null): boolean {
  if (a === null || b === null) return a === b
  return a.id === b.id && a.updatedAt === b.updatedAt
}

export interface CampaignStoreOptions {
  retryDelaysMs?: number[]
  timeoutMs?: number
  /** `null` desliga o cache (ex.: navegador que bloqueia o storage). */
  storage?: Storage | null
}

export interface CampaignStore {
  getState(): CampaignState
  /**
   * Assina as mudanças. A primeira assinatura inicia o carregamento; quando a última é cancelada, a busca e os
   * timers param (o estado fica guardado para a próxima). Devolve a função para cancelar.
   */
  subscribe(listener: () => void): () => void
  /** Para tudo (requisição, timers e eventos) e volta ao estado inicial. Usado nos testes. */
  stop(): void
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

export function createCampaignStore({
  retryDelaysMs = CAMPAIGN_RETRY_DELAYS_MS,
  timeoutMs = CAMPAIGN_REQUEST_TIMEOUT_MS,
  storage = defaultStorage(),
}: CampaignStoreOptions = {}): CampaignStore {
  const listeners = new Set<() => void>()
  let started = false
  let state: CampaignState = { status: "loading", campaign: null }
  /** A última resposta em uso (da API ou do cache) e o relógio do servidor medido com ela. */
  let current: { response: ActiveCampaignResponse; clockOffsetMs: number } | null = null
  let abort: AbortController | null = null
  let lastFinishedAt = 0
  /** Última busca que deu certo: só ela conta para "busquei há pouco, não precisa de novo" ao voltar à loja. */
  let lastSuccessAt = 0
  let changeTimer: ReturnType<typeof setTimeout> | null = null

  const serverNow = () => Date.now() + (current?.clockOffsetMs ?? 0)
  /** A resposta em uso deixou de valer neste instante? */
  const isExpired = () => current !== null && !isStillValid(current.response, serverNow())

  function setState(next: CampaignState) {
    // Mesma campanha e mesmo status: não avisa ninguém (evita re-renderizar a loja à toa)
    if (next.status === state.status && next.campaign === state.campaign) return
    state = next
    listeners.forEach((listener) => listener())
  }

  /** Usa uma resposta, descartando a campanha se ela já não valer agora, e agenda a próxima mudança. */
  function apply(response: ActiveCampaignResponse, clockOffsetMs: number, status: CampaignStatus) {
    current = { response, clockOffsetMs }
    const campaign = isStillValid(response, serverNow()) ? response.campaign : null
    // A mesma campanha, sem edição desde a última vez, mantém o mesmo objeto: quem usa não re-renderiza
    setState({ status, campaign: isSameCampaign(campaign, state.campaign) ? state.campaign : campaign })
    scheduleChange()
  }

  function scheduleChange() {
    if (changeTimer) clearTimeout(changeTimer)
    changeTimer = null
    // Sem assinantes (pausado), nada fica agendado; `start()` agenda de novo ao voltar
    if (!started || !current) return
    const until = validUntil(current.response)
    if (!Number.isFinite(until)) return
    const remaining = until - serverNow()
    // Horário que já passou (só aconteceria com a API fora do contrato): espera um pouco, em vez de buscar em loop
    const delay = remaining > 0 ? remaining + CAMPAIGN_CHANGE_MARGIN_MS : CAMPAIGN_VISIBILITY_MIN_INTERVAL_MS
    // Espera longa demais para um timer: confere de novo no limite, sem disparar antes da hora
    if (delay > MAX_TIMER_MS) {
      changeTimer = setTimeout(scheduleChange, MAX_TIMER_MS)
      return
    }
    changeTimer = setTimeout(() => {
      changeTimer = null
      if (!current) return
      // Mesmo que a API não responda, a campanha que terminou sai do ar no horário
      if (!isStillValid(current.response, serverNow())) setState({ ...state, campaign: null })
      void load()
    }, delay)
  }

  async function load() {
    abort?.abort()
    const controller = new AbortController()
    abort = controller
    try {
      const response = await fetchWithRetry(controller.signal, retryDelaysMs, timeoutMs, () => started)
      if (controller.signal.aborted) return
      const clockOffsetMs = Date.parse(response.serverTime) - Date.now()
      writeCampaignCache(storage, { savedAt: Date.now(), clockOffsetMs, response })
      lastSuccessAt = Date.now()
      apply(response, clockOffsetMs, "ready")
    } catch (error) {
      if (controller.signal.aborted) return
      // A última busca falhou: ao voltar à loja, vale tentar de novo, mesmo que uma anterior tenha dado certo
      lastSuccessAt = 0
      // A loja segue com o que já tem (cache ainda válido ou tema padrão); nada de tela de erro. Se ninguém
      // assina mais (a pessoa saiu da loja e as tentativas pararam de propósito), não é falha para avisar.
      if (started) console.warn("Campanha indisponível; mantendo o tema atual:", error)
      // Mesmo com a API fora, a campanha que terminou durante a busca não fica
      setState({ status: "ready", campaign: isExpired() ? null : state.campaign })
    } finally {
      if (abort === controller) {
        abort = null
        lastFinishedAt = Date.now()
      }
    }
  }

  function handleVisibility() {
    if (document.visibilityState !== "visible") return
    // Um aparelho que dormiu pode ter parado os timers. Antes de qualquer busca: a campanha que terminou sai na
    // hora; a que ainda vale tem a saída reagendada pelo tempo que de fato resta.
    if (isExpired()) setState({ ...state, campaign: null })
    else scheduleChange()
    if (abort || Date.now() - lastFinishedAt < CAMPAIGN_VISIBILITY_MIN_INTERVAL_MS) return
    void load()
  }

  /**
   * Lê o cache na primeira consulta ao estado, antes da primeira renderização (T20). Assim o React já nasce com a
   * campanha que o script do `index.html` aplicou, e não remove o tema para reaplicá-lo logo depois (o "pisca").
   */
  let initialized = false
  function init() {
    if (initialized) return
    initialized = true
    const cached = readCampaignCache(storage)
    if (!cached) return
    current = { response: cached.response, clockOffsetMs: cached.clockOffsetMs }
    state = { status: "loading", campaign: cached.response.campaign }
  }

  /** Começa (ou retoma) a busca e as atualizações. Chamado quando aparece o primeiro assinante. */
  function start() {
    started = true
    init()
    // Enquanto ninguém assinava, o horário de mudança pode ter passado: a campanha que terminou sai na hora
    const expired = isExpired()
    if (expired) setState({ ...state, campaign: null })
    scheduleChange()
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", handleVisibility)
    // Uma busca que começou antes de sair continua valendo: não recomeça (a API pode estar acordando)
    if (abort) return
    // Ao voltar logo depois de uma busca que deu certo, reaproveita a resposta (mesmo intervalo da troca de aba)
    const recentlySucceeded = lastSuccessAt > 0 && Date.now() - lastSuccessAt < CAMPAIGN_VISIBILITY_MIN_INTERVAL_MS
    if (expired || !recentlySucceeded) void load()
  }

  /**
   * Para o timer e o evento da aba, mas guarda o estado. Chamado quando o último assinante sai (ex.: o admin foi
   * da loja para o painel), para o painel não ficar consultando a campanha. A tentativa já em andamento termina
   * (e o resultado fica guardado: quem volta logo não espera a API acordar de novo), mas nenhuma outra começa.
   */
  function pause() {
    started = false
    if (changeTimer) clearTimeout(changeTimer)
    changeTimer = null
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", handleVisibility)
  }

  return {
    getState() {
      init()
      // Pausado (sem assinantes), ninguém tirou do ar a campanha que terminou: quem lê agora já recebe o tema
      // padrão, sem piscar. Com assinantes, quem tira é o timer do horário de mudança, que avisa todos.
      if (!started && state.campaign && current && !isStillValid(current.response, serverNow())) {
        state = { ...state, campaign: null }
      }
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      if (!started) start()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) pause()
      }
    },
    stop() {
      pause()
      abort?.abort()
      abort = null
      listeners.clear()
      // Volta ao estado inicial (usado nos testes, para um não depender do anterior)
      state = { status: "loading", campaign: null }
      current = null
      initialized = false
      lastFinishedAt = 0
      lastSuccessAt = 0
    },
  }
}
