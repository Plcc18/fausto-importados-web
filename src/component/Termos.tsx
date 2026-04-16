import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/Shadcn-Components/ui/button"

export function Termos() {
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
        <h1 className="font-serif text-3xl font-medium tracking-tight">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: abril de 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar o site da Fausto Importados, você concorda com os presentes Termos de Uso.
              Caso não concorde com alguma das condições aqui descritas, recomendamos que não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">2. Sobre a Loja</h2>
            <p>
              A Fausto Importados é uma loja especializada em fragrâncias importadas 100% originais, sediada em
              Redenção, Ceará, Brasil. Nosso compromisso é oferecer produtos autênticos com atendimento de qualidade.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">3. Produtos e Preços</h2>
            <p>
              Todos os produtos exibidos estão sujeitos à disponibilidade de estoque. Os preços podem ser alterados
              sem aviso prévio. Nos comprometemos a manter as informações dos produtos atualizadas, mas não nos
              responsabilizamos por eventuais erros tipográficos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">4. Pedidos e Pagamento</h2>
            <p>
              Ao realizar um pedido, você declara que as informações fornecidas são verdadeiras e completas.
              A confirmação do pedido está sujeita à aprovação do pagamento e à disponibilidade do produto em estoque.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">5. Entrega</h2>
            <p>
              Os prazos de entrega são estimados e podem variar de acordo com a localidade e a transportadora.
              A Fausto Importados não se responsabiliza por atrasos causados por fatores externos, como greves,
              desastres naturais ou problemas nos Correios.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">6. Trocas e Devoluções</h2>
            <p>
              Em conformidade com o Código de Defesa do Consumidor (Lei nº 8.078/90), o cliente tem o direito de
              solicitar a troca ou devolução do produto em até 7 dias corridos após o recebimento, desde que o
              produto esteja lacrado e em perfeitas condições.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">7. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo deste site — incluindo textos, imagens, logotipos e layout — é de propriedade da
              Fausto Importados ou licenciado por terceiros. É proibida a reprodução sem autorização expressa.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">8. Contato</h2>
            <p>
              Para dúvidas sobre estes termos, entre em contato conosco pelo WhatsApp ou pelos demais canais
              disponíveis na página principal.
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
