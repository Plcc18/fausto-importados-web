import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"

export function Privacidade() {
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
        <h1 className="font-serif text-3xl font-medium tracking-tight">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: abril de 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">1. Informações que Coletamos</h2>
            <p>
              Ao utilizar nosso site, podemos coletar informações como nome, endereço de e-mail, telefone,
              endereço de entrega e dados de navegação. Essas informações são utilizadas exclusivamente para
              processar pedidos e melhorar sua experiência de compra.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">2. Como Usamos suas Informações</h2>
            <p>
              As informações coletadas são utilizadas para processar e entregar seus pedidos, enviar atualizações
              sobre o status da compra, responder suas dúvidas e, com seu consentimento, enviar comunicações
              sobre promoções e novidades.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">3. Compartilhamento de Dados</h2>
            <p>
              A Fausto Importados não vende, aluga ou compartilha seus dados pessoais com terceiros para fins
              comerciais. Podemos compartilhar informações estritamente necessárias com transportadoras e
              processadores de pagamento para viabilizar a entrega e a cobrança dos pedidos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">4. Cookies</h2>
            <p>
              Utilizamos cookies para melhorar a navegação e lembrar preferências do usuário, como itens
              adicionados ao carrinho. Você pode desativar os cookies nas configurações do seu navegador,
              mas isso pode afetar algumas funcionalidades do site.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">5. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger suas informações contra acesso não
              autorizado, alteração, divulgação ou destruição. Nosso site utiliza conexão segura (HTTPS) em
              todas as páginas.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">6. Seus Direitos (LGPD)</h2>
            <p>
              Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem o direito
              de acessar, corrigir ou solicitar a exclusão dos seus dados pessoais a qualquer momento.
              Para exercer esses direitos, entre em contato conosco pelo WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">7. Alterações nesta Política</h2>
            <p>
              Esta política pode ser atualizada periodicamente. Recomendamos que você a revise regularmente.
              Alterações significativas serão comunicadas através do site ou por e-mail.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">8. Contato</h2>
            <p>
              Em caso de dúvidas sobre esta Política de Privacidade, entre em contato pelo WhatsApp ou pelos
              canais disponíveis na página principal. Estamos localizados em Redenção, Ceará, Brasil.
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
