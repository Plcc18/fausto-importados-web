import Swal from "sweetalert2"
import { authClient, type ReauthPromptReason } from "@/lib/auth"

/**
 * Pede ao administrador o código do autenticador (ou de recuperação) para confirmar uma operação sensível.
 * Devolve `null` se ele desistir.
 */
export async function askReauthCode(reason: ReauthPromptReason): Promise<string | null> {
  if (reason === "locked") {
    await Swal.fire({
      icon: "warning",
      title: "Muitas tentativas",
      text: "Aguarde alguns minutos antes de tentar novamente.",
    })
    return null
  }

  const result = await Swal.fire({
    title: "Confirme sua identidade",
    text:
      reason === "invalid"
        ? "Código inválido. Digite o código atual do seu aplicativo autenticador."
        : "Esta ação é sensível. Digite o código do seu aplicativo autenticador (ou um código de recuperação).",
    input: "text",
    inputAttributes: { autocomplete: "one-time-code", inputmode: "numeric", maxlength: "24" },
    showCancelButton: true,
    confirmButtonText: "Confirmar",
    cancelButtonText: "Cancelar",
    inputValidator: (value) => (value?.trim() ? undefined : "Informe o código"),
  })
  return result.isConfirmed ? String(result.value).trim() : null
}

/** `fetch` para operações sensíveis do painel (zerar vendas, limpar histórico...): reautentica por 2FA se a API pedir. */
export const sensitiveFetch = (url: string, init: RequestInit = {}) =>
  authClient.sensitiveFetch(url, init, askReauthCode)

/** Texto para quando a operação sensível não foi concluída. */
export const SENSITIVE_NOT_DONE = "A confirmação de identidade não foi concluída. Nada foi alterado."
