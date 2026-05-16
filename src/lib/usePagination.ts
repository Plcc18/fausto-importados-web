import { useState, useMemo } from "react"

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  // Reset to page 1 whenever items change (e.g. filter applied)
  const safePage = Math.min(page, totalPages)

  const paginated = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  )

  return {
    page: safePage,
    setPage,
    totalPages,
    paginated,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
    next: () => setPage((p) => Math.min(p + 1, totalPages)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
    goTo: (n: number) => setPage(Math.max(1, Math.min(n, totalPages))),
  }
}