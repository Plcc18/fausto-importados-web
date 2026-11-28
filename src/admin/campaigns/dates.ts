/**
 * Datas das campanhas no painel: sempre no horário da loja (`America/Fortaleza`), qualquer que seja o fuso do
 * computador. A API recebe e devolve instantes em UTC (contrato §1).
 */
const TIME_ZONE = "America/Fortaleza"
/** Fortaleza não tem horário de verão. */
const UTC_OFFSET = "-03:00"
const DAY_MS = 24 * 60 * 60 * 1000

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" })
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/** `27/11/2026 às 00:00`. */
export function formatDateTime(iso: string): string {
  const instant = new Date(iso)
  if (Number.isNaN(instant.getTime())) return "data inválida"
  return `${dateFormat.format(instant)} às ${timeFormat.format(instant)}`
}

/** Período de uma campanha; um rascunho pode não ter uma das datas, ou nenhuma. */
export function formatPeriod(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "Sem datas"
  return `${startsAt ? formatDateTime(startsAt) : "sem início"} até ${endsAt ? formatDateTime(endsAt) : "sem fim"}`
}

/** Meia-noite, na loja, do dia `AAAA-MM-DD` (o valor de um `<input type="date">`). */
export function startOfDay(day: string): string {
  return new Date(`${day}T00:00:00${UTC_OFFSET}`).toISOString()
}

/** Meia-noite do dia seguinte: o fim exclusivo de um intervalo que inclui o dia `day`. */
export function startOfNextDay(day: string): string {
  return new Date(Date.parse(startOfDay(day)) + DAY_MS).toISOString()
}
