import { authClient } from "@/lib/auth"
import { askReauthCode } from "@/admin/reauthBridge"

export { askReauthCode }

/** `fetch` para operações sensíveis do painel (zerar vendas, gerir administradores...): reautentica por 2FA se a API pedir. */
export const sensitiveFetch = (url: string, init: RequestInit = {}) =>
  authClient.sensitiveFetch(url, init, askReauthCode)

/** Texto para quando a operação sensível não foi concluída. */
export const SENSITIVE_NOT_DONE = "A confirmação de identidade não foi concluída. Nada foi alterado."
