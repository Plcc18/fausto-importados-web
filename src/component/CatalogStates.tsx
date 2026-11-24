"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/Shadcn-Components/ui/card"
import { Skeleton } from "@/Shadcn-Components/ui/skeleton"
import { ErrorView } from "@/component/errors/ErrorView"
import type { ErrorCode } from "@/lib/httpErrors"

/** Depois deste tempo sem resposta, explica que o servidor pode estar iniciando. */
const SLOW_HINT_DELAY_MS = 8_000

/**
 * Espelha a estrutura do ProductCard (imagem quadrada, marca, nome em 2 linhas,
 * detalhes, selo de estoque, preço e botão) para evitar saltos de layout.
 */
function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden border-0 bg-card shadow-sm" aria-hidden="true">
      <Skeleton className="aspect-square w-full rounded-none" />
      <CardContent className="flex flex-col p-3 sm:p-4">
        <Skeleton className="h-3 w-1/3" />
        <div className="mt-1 flex min-h-10 flex-col justify-center gap-1.5">
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <Skeleton className="mt-1 h-3 w-3/4" />
        <div className="mt-2 flex h-5 items-center">
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <div className="mt-2 flex h-10 flex-col justify-center gap-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="mt-3 h-9 w-full rounded-md" />
      </CardContent>
    </Card>
  )
}

/** Grade de skeletons com a mesma grade responsiva do catálogo + mensagem discreta. */
export function CatalogSkeleton({ count }: { count: number }) {
  const [showSlowHint, setShowSlowHint] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowSlowHint(true), SLOW_HINT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Preparando nossa seleção de fragrâncias...
        {showSlowHint && (
          <span className="mt-1 block text-xs">
            Isso pode levar alguns segundos na primeira visita.
          </span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/** Falha ao carregar o catálogo: tela de erro da marca (500/502/503/504/conexão) embutida na vitrine. */
export function CatalogError({ code, onRetry }: { code: ErrorCode; onRetry: () => void }) {
  return <ErrorView code={code} layout="embedded" onRetry={onRetry} />
}

/**
 * Aviso discreto exibido enquanto o catálogo mostrado vem do cache local,
 * para que dados salvos não sejam confundidos com dados já atualizados.
 */
export function CatalogCacheNotice({
  refreshFailed,
  onRetry,
}: {
  refreshFailed: boolean
  onRetry: () => void
}) {
  return (
    <p role="status" className="mb-4 text-center text-xs text-muted-foreground">
      {refreshFailed ? (
        <>
          Não foi possível atualizar o catálogo. Exibindo a última versão salva — preços e estoque podem estar desatualizados.{" "}
          <button type="button" onClick={onRetry} className="underline underline-offset-2 hover:text-foreground">
            Tentar novamente
          </button>
        </>
      ) : (
        "Atualizando catálogo..."
      )}
    </p>
  )
}
