import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"

export function Cookies() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="font-serif text-lg font-medium tracking-tight">Fausto</span>
            <span className="ml-1 text-xs uppercase tracking-[0.25em] text-muted-foreground">Importados</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Política de Cookies</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: abril de 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">1. O que são Cookies?</h2>
            <p>
              Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você visita um site.
              Eles permitem que o site reconheça seu navegador e lembre informações sobre sua visita, como
              preferências e itens no carrinho.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">2. Como Utilizamos os Cookies</h2>
            <p>
              A Fausto Importados utiliza cookies para as seguintes finalidades:
            </p>
            <ul className="mt-3 space-y-2 pl-4">
              <li className="flex gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40 mt-2" />
                <span><strong className="text-foreground">Carrinho de compras:</strong> para manter os produtos adicionados ao carrinho entre sessões.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40 mt-2" />
                <span><strong className="text-foreground">Preferências:</strong> para lembrar configurações como tema e filtros de navegação.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40 mt-2" />
                <span><strong className="text-foreground">Segurança:</strong> para autenticar usuários e proteger contra acessos não autorizados.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40 mt-2" />
                <span><strong className="text-foreground">Desempenho:</strong> para entender como os visitantes utilizam o site e melhorar a experiência.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">3. Tipos de Cookies que Usamos</h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-foreground">Cookies essenciais</p>
                <p className="mt-1">
                  Necessários para o funcionamento básico do site. Sem eles, funcionalidades como o carrinho
                  de compras não funcionam corretamente. Não podem ser desativados.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Cookies de preferência</p>
                <p className="mt-1">
                  Permitem que o site lembre suas escolhas, como filtros aplicados e preferências de exibição.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Cookies de desempenho</p>
                <p className="mt-1">
                  Coletam informações anônimas sobre como os visitantes utilizam o site, ajudando-nos a
                  identificar e corrigir problemas.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">4. Como Gerenciar os Cookies</h2>
            <p>
              Você pode controlar e/ou excluir cookies nas configurações do seu navegador. A maioria dos
              navegadores permite bloquear ou excluir cookies automaticamente. Consulte as instruções do
              seu navegador para mais detalhes. Observe que desativar cookies pode afetar algumas
              funcionalidades do site, como o carrinho de compras.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">5. Cookies de Terceiros</h2>
            <p>
              Podemos utilizar serviços de terceiros, como plataformas de pagamento e armazenamento de
              imagens, que também podem definir cookies. Esses cookies são regidos pelas políticas de
              privacidade dos respectivos terceiros, sobre as quais não temos controle.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">6. Contato</h2>
            <p>
              Para dúvidas sobre o uso de cookies, entre em contato conosco pelo WhatsApp ou pelos
              canais disponíveis na página principal.
            </p>
          </section>
        </div>
      </main>

      <footer className="mt-16 border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        © 2026 Fausto Importados. Todos os direitos reservados. — Redenção, Ceará, Brasil.
      </footer>
    </div>
  )
}
