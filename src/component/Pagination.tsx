import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"

interface PaginationProps {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
  onGoTo: (n: number) => void
  totalItems: number
  pageSize: number
}

export function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
  onGoTo,
  totalItems,
  pageSize,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  // Build page numbers with ellipsis
  const pages: (number | "...")[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push("...")
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push("...")
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <span className="text-xs text-muted-foreground">
        {from}–{to} de {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={onPrev} disabled={page === 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "ghost"}
              size="icon-sm"
              className="text-xs"
              onClick={() => onGoTo(p as number)}
            >
              {p}
            </Button>
          )
        )}
        <Button variant="ghost" size="icon-sm" onClick={onNext} disabled={page === totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}