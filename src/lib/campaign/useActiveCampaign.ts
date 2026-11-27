import { useSyncExternalStore } from "react"
import { createCampaignStore, type CampaignState } from "./store"

/** Uma instância para a aplicação inteira: todos os componentes compartilham a mesma busca e a mesma resposta. */
export const activeCampaignStore = createCampaignStore()

const SERVER_STATE: CampaignState = { status: "loading", campaign: null }

/**
 * A campanha ativa e o status do carregamento. `campaign: null` → tema padrão.
 * O primeiro componente que usar o hook inicia a busca; os demais só leem o resultado.
 */
export function useActiveCampaign(): CampaignState {
  return useSyncExternalStore(activeCampaignStore.subscribe, activeCampaignStore.getState, () => SERVER_STATE)
}
