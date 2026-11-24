import type { ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { ErrorCode } from "@/lib/httpErrors"
import { COLLECTION_HASH_ROUTE, ROUTES } from "@/routes"
import { ErrorScreen, type ErrorAction, type ErrorScreenProps } from "./ErrorScreen"
import {
  BottleVisual, DropVisual, LinkedVialsVisual, OrbitBottleVisual,
  QuietVisual, SealVisual, TimeRingVisual,
} from "./ErrorVisuals"

interface ErrorDefinition {
  /** Número exibido ("" = sem número, p.ex. falha que não é resposta HTTP). */
  code: string
  title: string
  description: string
  visual: ReactNode
  variant: NonNullable<ErrorScreenProps["variant"]>
  /** `home` = link para a loja; `retry` = repete a operação que falhou. */
  primary: "home" | "retry"
  secondary?: "explore" | "home"
}

const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  "404": {
    code: "404",
    title: "Esta fragrância não está por aqui.",
    description: "Parece que o caminho que você procurava não existe ou foi descontinuado.",
    visual: <BottleVisual className="h-full w-full" />,
    variant: "standard",
    primary: "home",
    secondary: "explore",
  },
  "403": {
    code: "403",
    title: "Esta área é reservada.",
    description: "Você não tem permissão para acessar este conteúdo.",
    visual: <SealVisual className="h-full w-full" />,
    variant: "standard",
    primary: "home",
  },
  "500": {
    code: "500",
    title: "Algo não saiu como esperado.",
    description: "Estamos trabalhando para restabelecer tudo. Tente novamente em instantes.",
    visual: <DropVisual className="h-full w-full" />,
    variant: "standard",
    primary: "retry",
    secondary: "home",
  },
  "502": {
    code: "502",
    title: "Estamos reorganizando nossa conexão.",
    description: "Nosso serviço encontrou uma dificuldade temporária ao se comunicar com outro servidor.",
    visual: <LinkedVialsVisual className="h-full w-full" />,
    variant: "standard",
    primary: "retry",
    secondary: "home",
  },
  "503": {
    code: "503",
    title: "Estamos preparando tudo para você.",
    description: "Nosso catálogo está temporariamente indisponível. Aguarde alguns instantes e tente novamente.",
    visual: <QuietVisual />,
    variant: "quiet",
    primary: "retry",
    secondary: "home",
  },
  "504": {
    code: "504",
    title: "Essa conexão está demorando mais que o esperado.",
    description: "Não conseguimos concluir sua solicitação a tempo. Por favor, tente novamente.",
    visual: <TimeRingVisual className="h-full w-full" />,
    variant: "standard",
    primary: "retry",
    secondary: "home",
  },
  connection: {
    // Estado de comunicação do frontend: não é uma resposta HTTP, então não há número
    code: "",
    title: "Não conseguimos acessar nossas fragrâncias.",
    description: "Estamos com dificuldades para estabelecer uma conexão com nosso catálogo.",
    visual: <OrbitBottleVisual className="h-full w-full" />,
    variant: "standard",
    primary: "retry",
    secondary: "home",
  },
}

export interface ErrorViewProps {
  code: ErrorCode
  layout?: "page" | "embedded"
  /** Repete a operação que falhou. Sem ele, "Tentar novamente" volta à loja (que refaz o carregamento). */
  onRetry?: () => void
}

/** Tela de erro para um código: monta o `ErrorScreen` com o conteúdo, visual e ações certos. */
export function ErrorView({ code, layout = "page", onRetry }: ErrorViewProps) {
  const navigate = useNavigate()
  const def = ERROR_DEFINITIONS[code]
  const isPage = layout === "page"

  const retry = onRetry ?? (() => navigate(ROUTES.home))
  const primaryAction: ErrorAction =
    def.primary === "home"
      ? { label: "Voltar à loja", to: ROUTES.home }
      : { label: "Tentar novamente", onClick: retry }

  // Em modo embutido já estamos na loja: sem link secundário
  const secondaryAction: ErrorAction | undefined =
    def.secondary === "explore"
      ? { label: "Explorar fragrâncias", to: COLLECTION_HASH_ROUTE }
      : def.secondary === "home" && isPage
        ? { label: "Voltar à loja", to: ROUTES.home }
        : undefined

  return (
    <ErrorScreen
      code={def.code}
      title={def.title}
      description={def.description}
      visual={def.visual}
      variant={def.variant}
      layout={layout}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
    />
  )
}

/** Rota catch-all: qualquer URL que o roteador não reconhece. */
export function NotFoundPage() {
  return <ErrorView code="404" />
}

const CODE_PARAM_TO_ERROR: Record<string, ErrorCode> = {
  "403": "403", "500": "500", "502": "502", "503": "503", "504": "504", conexao: "connection",
}

/** `/erro/:codigo` — link direto / pré-visualização de cada tela. Código inválido → 404. */
export function ErrorRoutePage() {
  const { codigo = "" } = useParams()
  const code = CODE_PARAM_TO_ERROR[codigo]
  return code ? <ErrorView code={code} /> : <NotFoundPage />
}
