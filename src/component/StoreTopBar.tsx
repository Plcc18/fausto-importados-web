import { useActiveCampaign } from "@/lib/campaign/useActiveCampaign"
import { CampaignLink } from "./CampaignLink"
import type { CampaignTopBar } from "@/lib/campaign/types"

/**
 * Faixa fina no topo do cabeçalho.
 *
 * - Com campanha que tenha `topBar`: o texto (e o link, se houver) da campanha, com a cor de destaque dela,
 *   visível também no celular (T22).
 * - Sem campanha, ou com `topBar: null`: a faixa de sempre, só no computador (contrato §4.2).
 */
export function StoreTopBar() {
  // Na primeira visita (sem cache), a faixa da campanha aparece quando a API responde e, no celular, empurra a
  // página um pouco. Reservar o espaço deixaria uma faixa vazia em toda loja sem campanha; quem volta já tem o
  // cache (T17/T20) e a recebe na primeira renderização.
  const topBar = useActiveCampaign().campaign?.content.topBar ?? null
  return topBar ? <CampaignTopBarStrip topBar={topBar} /> : <DefaultTopBar />
}

function DefaultTopBar() {
  return (
    <div className="hidden border-b border-border bg-card text-accent-foreground md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs tracking-wide">
        <span className="opacity-80">Fragrâncias 100% Originais</span>
        <span className="opacity-80">Parcele em até 12x</span>
      </div>
    </div>
  )
}

function CampaignTopBarStrip({ topBar }: { topBar: CampaignTopBar }) {
  // O texto vem da API, mas o React o trata sempre como texto (nunca como HTML)
  return (
    <div className="border-b border-border bg-primary text-primary-foreground" data-testid="campaign-top-bar">
      {/* No celular, no máximo 2 linhas: a faixa fica dentro do cabeçalho fixo e não pode tomar a tela */}
      <div className="mx-auto line-clamp-2 max-w-7xl px-4 py-2 text-center text-xs font-medium tracking-wide text-balance md:line-clamp-none md:px-6">
        {topBar.link ? (
          // Sempre sublinhado: no celular não há "passar o mouse" para descobrir que é um link
          <CampaignLink link={topBar.link} className="underline underline-offset-4 hover:opacity-90">
            {topBar.text}
          </CampaignLink>
        ) : (
          topBar.text
        )}
      </div>
    </div>
  )
}
