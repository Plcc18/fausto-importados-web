import { Component, type ErrorInfo, type ReactNode } from "react"
import { applyCampaignTheme } from "@/lib/campaign/theme"
import { ErrorView } from "./ErrorView"

interface Props {
  children: ReactNode
  /** Quando muda (ex.: a rota), o erro anterior é descartado e a árvore é renderizada de novo. */
  resetKey?: string
}

interface State {
  hasError: boolean
}

/**
 * Rede de segurança: se algum componente lançar um erro de renderização, o
 * usuário vê a tela 500 da marca em vez de uma página em branco. Detalhes
 * técnicos vão só para o console, nunca para a interface.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro de renderização:", error, info.componentStack)
    // Telas de erro ficam sempre no tema padrão (T02). Se a página quebrar já na primeira renderização, quem
    // aplicaria e removeria o tema nem chega a montar, e o tema do script do index.html (T20) ficaria na tela.
    applyCampaignTheme(null)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  private reset = () => this.setState({ hasError: false })

  render() {
    if (this.state.hasError) return <ErrorView code="500" onRetry={this.reset} />
    return this.props.children
  }
}
