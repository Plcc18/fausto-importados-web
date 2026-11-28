# Correções futuras (front-end)

Bugs conhecidos que **podem esperar** e serão corrigidos depois que tudo estiver em produção (T40 e T41 de [campanhas-sazonais-tasks.md](campanhas-sazonais-tasks.md)). A API tem a própria lista, em `docs/correcoes-futuras.md` do repositório `fausto-importados-api`.

## Regra

Vale para qualquer pessoa ou agente que mexer neste repositório.

Achou um bug (revisão, teste ou uso) que pode esperar a produção? **Registre aqui**, em vez de corrigir na hora ou misturar à task em andamento.

**Não pode esperar** (corrija antes de seguir):

- falha de segurança, ou dado ou código administrativo exposto ao público;
- perda ou corrupção de dados;
- preço, estoque ou total de pedido errados;
- quebra de algo que a loja ou o painel já fazem (catálogo, carrinho, pedido, login, cadastro de produtos);
- bug que impede o "Pronto quando" da task em andamento, ou faz teste, lint ou build falharem.

Na dúvida, pergunte a quem cuida do projeto.

## Como registrar

- Coloque o item no repositório onde está o código com problema.
- Use o próximo número (`C01`, `C02`...). Número usado não muda nem é reaproveitado.
- Cite arquivo e função, não o número da linha (ele muda).
- Ao corrigir, marque `[x]` e acrescente a data e o PR. Não apague o item.

Modelo:

```markdown
- [ ] **C00. Título curto** · Importante ou Menor
  - *Origem:* revisão, teste ou uso (data, PR).
  - *Onde:* arquivo e função.
  - *Problema:* o que acontece e para quem.
  - *Como reproduzir:* passos ou cenário.
  - *Sugestão:* caminho para corrigir.
```

## Pendências

Os itens C01 a C09 vieram do `/code-review` de 27/11/2026, no PR #35. Salvo onde está dito "confirmado", ainda não foram reproduzidos: confira antes de corrigir.

- [ ] **C01. Produto reativado pode continuar fora da coleção da campanha** · Importante
  - *Onde:* [store.ts](../src/lib/campaign/store.ts), `isSameCampaign` e `apply`.
  - *Problema:* `isSameCampaign` compara só `id` e `updatedAt`. Quando apenas os `productIds` mudam, a loja aberta mantém o objeto antigo, e o produto fica fora da coleção e sem o selo.
  - *Como reproduzir:* o cache tem os produtos A e B, com C desativado. C é reativado e a busca traz A, B e C; a tela segue com A e B.
  - *Confirmado no código (27/11/2026):* na API, desativar ou reativar um produto (`ProductService`) invalida o cache da campanha, mas não muda o `updatedAt` dela. A resposta nova é gravada no cache local, então recarregar a página resolve.
  - *Sugestão:* comparar também as coleções e os IDs, ou a campanha inteira.

- [ ] **C02. Link para a coleção já aberta não faz nada** · Importante
  - *Onde:* [Store.tsx](../src/component/Store.tsx), efeito de rolagem que depende de `activeCollectionSlug`.
  - *Problema:* botão do banner, faixa superior ou imagem de divulgação não rolam até a vitrine se a coleção já está aberta; só o "Ver todos" rola diretamente.
  - *Como reproduzir:* clicar em um botão para `/?colecao=ofertas`, subir a página e clicar de novo. O mesmo ao entrar direto por essa URL.
  - *Sugestão:* rolar a cada navegação (por exemplo, dependendo de `location.key`).

- [ ] **C03. Termos, Privacidade e Cookies podem abrir no meio ou no fim** · Importante
  - *Onde:* [CampaignLink.tsx](../src/component/CampaignLink.tsx).
  - *Problema:* a navegação usa o `Link` do React Router, e a revisão não encontrou nada no app que volte a rolagem ao topo.
  - *Como reproduzir:* rolar bastante a loja e clicar em um link de campanha para `/termos`.
  - *Sugestão:* rolar ao topo ao mudar de página, ou usar um link comum para essas páginas.

- [ ] **C04. Campanha pode não aparecer no primeiro segundo** · Importante
  - *Onde:* [store.ts](../src/lib/campaign/store.ts), `isStillValid`, `apply` e `scheduleChange`; o script de pré-pintura do [index.html](../index.html) segue o mesmo critério.
  - *Problema:* o cabeçalho `Date` não tem milissegundos, então uma campanha que a API acabou de devolver como ativa pode ser recusada. A próxima busca agendada mira só o fim ou a próxima mudança.
  - *Como reproduzir:* "Ativar agora" grava `startsAt` 12:00:00.500 e a API responde às 12:00:00.900 com `Date` 12:00:00. A campanha só aparece ao trocar de aba ou recarregar.
  - *Sugestão:* dar uma pequena margem no `startsAt` ou agendar nova conferência, mantendo o `index.html` igual.

- [ ] **C05. Link de produto compartilhado pode não abrir nada** · Importante (anterior às campanhas)
  - *Onde:* [Store.tsx](../src/component/Store.tsx), `highlight` dos cards em `paginatedProducts`.
  - *Problema:* `?produto=<id>` só abre os detalhes se o produto estiver na primeira página da vitrine. Os cards das coleções facilitam compartilhar produtos que estão fora dela.
  - *Como reproduzir:* abrir o link do 20º produto do catálogo.
  - *Sugestão:* abrir o produto a partir do catálogo completo, ou ir para a página dele.

- [ ] **C06. Cores da campanha podem deixar texto ilegível** · Menor
  - *Onde:* [theme.ts](../src/lib/campaign/theme.ts), o script do [index.html](../index.html) e a tabela do [contrato](campanhas-contrato.md) (§4.1).
  - *Problema:* `accent` troca `--accent`, `--secondary` e `--muted`, mas `--accent-foreground` e `--secondary-foreground` continuam os da loja. Afeta botões e selos secundários, destaque nos menus e a faixa superior padrão.
  - *Como reproduzir:* paleta escura com `accent` pastel claro; o botão secundário do banner fica com texto claro sobre fundo claro.
  - *Sugestão:* definir também essas cores de texto, ou exigir contraste do `accent`; a decisão muda o contrato. O alerta de contraste da T29 pode cobrir parte disso.

- [ ] **C07. Falha no horário da troca não é tentada de novo** · Menor
  - *Onde:* [store.ts](../src/lib/campaign/store.ts), `catch` de `load`.
  - *Problema:* esgotadas as retentativas, nada fica agendado, e a campanha antiga já saiu do ar. Com a aba aberta e visível, a seguinte não aparece.
  - *Como reproduzir:* a API responde 503 nas quatro tentativas no `nextChangeAt` (um deploy, por exemplo).
  - *Sugestão:* agendar nova tentativa, com limite, quando a resposta atual já não vale.

- [ ] **C08. `/#colecao` pode parar no lugar errado** · Menor
  - *Onde:* [Store.tsx](../src/component/Store.tsx), `hasCampaignSections`.
  - *Problema:* a segunda rolagem considera só coleções e imagens de divulgação, mas o banner e a faixa também mudam a altura acima do catálogo.
  - *Como reproduzir:* primeira visita (sem cache) em `/#colecao`, com campanha só com banner, em navegador que não compensa a rolagem.
  - *Sugestão:* incluir `content.hero` e `content.topBar` na condição.

- [x] **C09. Tela de campanhas mostra a mesma mensagem para qualquer erro** · Menor
  - *Corrigido:* 27/11/2026, na T27 (branch `feat/campanhas-t27-listagem`), que reescreveu a tela.
  - *Onde:* [Campaigns.tsx](../src/admin/campaigns/Campaigns.tsx), tratamento de erro de `countCampaigns` (entra com o PR #35).
  - *Problema:* falta de conexão, 403 e erro do servidor aparecem iguais, porque o `HttpError` é descartado. Foge da regra do `CLAUDE.md` sobre `httpErrors.ts` e as telas de `src/component/errors`.
  - *Sugestão:* classificar com `errorCodeFromError` e mostrar a tela ou mensagem correspondente. A T27 reescreve essa tela e pode já resolver.
