/**
 * Dica local de que "há (ou houve) uma sessão neste navegador".
 *
 * NÃO é credencial nem controle de segurança — a API revalida tudo a cada requisição. Serve só para a interface:
 * quem nunca entrou vê "Entrar" na hora, sem nenhuma requisição; quem já entrou vê um esqueleto enquanto o app
 * recupera a sessão pelo cookie de refresh (em vez de piscar "Entrar" e depois trocar). Guarda apenas "1".
 */
const KEY = "fausto:session-hint"

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false // armazenamento bloqueado (janela privada etc.): sem dica, só perde o esqueleto
  }
}

export function setSessionHint(): void {
  try {
    localStorage.setItem(KEY, "1")
  } catch {
    /* sem armazenamento: tudo continua funcionando */
  }
}

export function clearSessionHint(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* idem */
  }
}
