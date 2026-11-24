"use client"

import { useEffect, useState } from "react"
import { CloudOff, RotateCcw } from "lucide-react"
import { Card, CardContent } from "@/Shadcn-Components/ui/card"
import { Button } from "@/Shadcn-Components/ui/button"
import { Skeleton } from "@/Shadcn-Components/ui/skeleton"

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

/** Mesmo layout do estado vazio do catálogo, para manter a identidade visual. */
export function CatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
        <CloudOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-medium">Não foi possível carregar as fragrâncias</h3>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Estamos com dificuldades para acessar nosso catálogo. Tente novamente em instantes.
      </p>
      <Button variant="outline" className="mt-8 rounded-full bg-transparent px-6" onClick={onRetry}>
        <RotateCcw className="mr-2 h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  )
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
