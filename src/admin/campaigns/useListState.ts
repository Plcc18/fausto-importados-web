import { useCallback, useState } from "react"
import { useDebounce } from "@/lib/useDebounce"
import { NO_FILTERS, listQuery, periodError } from "@/admin/campaigns/listQuery"

/**
 * Filtros e página da listagem. Fica acima da lista para continuar valendo quando a pessoa abre o formulário e volta.
 */
export function useListState() {
  const [filters, setFilters] = useState(NO_FILTERS)
  const settled = useDebounce(filters) // não consulta a cada tecla
  const invalidPeriod = periodError(settled)
  /** Filtros na forma da API; `null` = período inválido, nada a consultar. */
  const query = invalidPeriod ? null : listQuery(settled)

  // A página vale para os filtros em que foi escolhida: mudou o filtro, volta à primeira
  const [paging, setPaging] = useState({ query, page: 0 })
  if (paging.query !== query) setPaging({ query, page: 0 }) // ajuste durante a renderização, sem efeito extra
  const page = paging.query === query ? paging.page : 0
  const setPage = useCallback((next: number) => setPaging({ query, page: next }), [query])

  return {
    filters,
    setFilters,
    settled,
    invalidPeriod,
    query,
    /** A partir de 0. */
    page,
    setPage,
  }
}

export type ListState = ReturnType<typeof useListState>
