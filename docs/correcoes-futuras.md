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

Os itens C01 a C09 vieram do `/code-review` de 27/11/2026, no PR #35; os itens C10 a C14, do `/code-review` da T27 (27/11/2026, PR #36); os itens C16 a C21, do `/code-review` da T28 (27/11/2026, PR #38). Salvo onde está dito "confirmado", ainda não foram reproduzidos: confira antes de corrigir.

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
  - *Corrigido:* 27/11/2026, na T27 (PR #36), que reescreveu a tela.
  - *Onde:* [Campaigns.tsx](../src/admin/campaigns/Campaigns.tsx), tratamento de erro de `countCampaigns` (entra com o PR #35).
  - *Problema:* falta de conexão, 403 e erro do servidor aparecem iguais, porque o `HttpError` é descartado. Foge da regra do `CLAUDE.md` sobre `httpErrors.ts` e as telas de `src/component/errors`.
  - *Sugestão:* classificar com `errorCodeFromError` e mostrar a tela ou mensagem correspondente. A T27 reescreve essa tela e pode já resolver.

- [x] **C10. Campanha encerrada pode continuar na tela ao voltar para a aba** · Importante
  - *Corrigido:* 27/11/2026, no PR #37: ao voltar para a aba e quando a busca falha, a validade é conferida, e a saída da campanha que ainda vale é reagendada. Coberto por testes com os timers parados; não reproduzido em um aparelho real.
  - *Onde:* [store.ts](../src/lib/campaign/store.ts), `handleVisibility` e o `catch` de `load`.
  - *Problema:* ao voltar para a aba, a loja só busca de novo, sem conferir se a campanha atual ainda vale; se a busca falhar, mantém a campanha mesmo encerrada. Contraria a garantia do `CLAUDE.md` de que a campanha em cache sai do ar no fim dela, mesmo com a API fora.
  - *Como reproduzir:* celular ou notebook que pausa os timers ao dormir, com a loja aberta; a campanha termina nesse intervalo. Ao acordar, o tema fica na tela enquanto a busca não responde e, se ela falhar, até o timer atrasado disparar.
  - *Confirmado no código (27/11/2026):* os dois trechos não conferem a validade. O cenário no aparelho não foi reproduzido.
  - *Sugestão:* ao voltar para a aba, antes das outras condições, tirar a campanha que não vale mais e reagendar, como `start()` faz; aplicar a mesma conferência quando a busca falhar.

- [x] **C11. Confirmação de "Desativar" promete que a loja atualiza em 1 minuto** · Menor
  - *Corrigido:* 27/11/2026, no PR #36: o texto diz que páginas já abertas só mudam ao recarregar ou voltar para a aba.
  - *Onde:* [actions.ts](../src/admin/campaigns/actions.ts), texto de `disable`.
  - *Problema:* quem está com a loja aberta e visível continua vendo a campanha: o [store.ts](../src/lib/campaign/store.ts) só busca de novo ao entrar na loja, ao voltar para a aba, no horário de mudança ou no fim da campanha. O 1 minuto vale para quem abre ou volta à loja.
  - *Como reproduzir:* desativar uma campanha no ar com a loja aberta em outra janela e esperar mais de 1 minuto.
  - *Confirmado no código (27/11/2026):* não há conferência periódica.
  - *Sugestão:* dizer no texto que páginas abertas só mudam ao recarregar ou voltar à aba, ou conferir periodicamente enquanto houver campanha na tela.

- [ ] **C12. Duplicar de novo pode avisar sucesso sem criar a cópia** · Menor
  - *Onde:* [Campaigns.tsx](../src/admin/campaigns/Campaigns.tsx), `run`, com [idempotency.ts](../src/lib/idempotency.ts).
  - *Problema:* depois de uma falha de rede, a `Idempotency-Key` da campanha é mantida até uma duplicação dar certo ou outra campanha ser duplicada. Se a primeira tentativa foi concluída no servidor, repetir mais tarde recebe a resposta guardada.
  - *Como reproduzir:* a API duplica A, mas a resposta se perde; a pessoa vê a cópia, exclui e duplica A de novo: aparece o aviso de sucesso e nenhum rascunho novo.
  - *Confirmado no código (27/11/2026).*
  - *Sugestão:* descartar a chave quando outra ação rodar ou quando a lista recarregada mostrar que a primeira tentativa deu certo, mantendo-a para a repetição imediata.

- [ ] **C13. Voltar à loja pode cancelar a busca recém-iniciada** · Menor
  - *Onde:* [store.ts](../src/lib/campaign/store.ts), `start` e `scheduleChange`.
  - *Problema:* com a resposta vencida, `start()` arma o timer de reserva de 30 s e chama `load()`. Se a busca ainda estiver em andamento aos 30 s, o timer chama `load()` de novo e cancela a anterior.
  - *Como reproduzir:* ir ao painel, deixar passar o horário de mudança e voltar à loja com a API acordando (cerca de 1 minuto).
  - *Confirmado no código (27/11/2026).*
  - *Sugestão:* não armar o timer de reserva quando `start()` vai buscar, ou o timer não chamar `load()` com uma busca em andamento.

- [ ] **C14. Link externo digitado errado derruba a campanha inteira na loja** · Menor
  - *Onde:* [parse.ts](../src/lib/campaign/parse.ts), `isSafeLink`; na API, `CampaignContentValidator.hasPlainHost`.
  - *Problema:* a API aceita endereços que o `new URL` do navegador recusa, e um link recusado descarta a campanha toda (aviso só em desenvolvimento). O painel mostra a campanha no ar, e a loja usa o tema padrão.
  - *Como reproduzir:* publicar uma faixa ou botão com `https://loja.com:abc/x` ou `https://loja.com:99999`.
  - *Confirmado no código (27/11/2026):* a API confere só o servidor e o `usuario@`. Não foi executado de ponta a ponta.
  - *Sugestão:* apertar a validação na API (o melhor lugar para o aviso aparecer ao salvar), ou descartar na loja só o link ou botão inválido.

- [ ] **C15. Alterações não salvas do formulário de campanha podem se perder sem aviso** · Menor
  - *Origem:* limitação percebida ao fazer a T28 (27/11/2026).
  - *Onde:* [Campaigns.tsx](../src/admin/campaigns/Campaigns.tsx) e `RequireAdmin` em [App.tsx](../src/App.tsx).
  - *Problema:* o aviso cobre cancelar, o voltar do navegador dentro da área de campanhas e fechar ou recarregar a aba. Não cobre a sessão que cai (a tela vai para o login) nem o voltar para outra tela do app quando o formulário foi aberto direto pelo endereço.
  - *Como reproduzir:* editar um campo e encerrar a sessão em outra aba.
  - *Confirmado no código (27/11/2026):* o bloqueio depende de a tela de campanhas continuar montada.
  - *Sugestão:* guardar o preenchimento no `sessionStorage` e oferecer a recuperação, ou migrar para o roteador de dados do React Router, que bloqueia qualquer navegação.

- [x] **C16. Campanha pode ser salva ou publicada depois de "Cancelar" ou "Descartar"** · Importante
  - *Corrigido:* 28/11/2026, no PR #39: enquanto salva ou publica, "Cancelar" e a seta ficam bloqueados e o voltar do navegador é segurado, sem oferecer descarte; se o formulário for fechado por outro caminho, não publica, e o resultado vira aviso. Coberto por testes e conferido no Chrome com API simulada.
  - *Onde:* [CampaignEditor.tsx](../src/admin/campaigns/CampaignEditor.tsx), `persist`, `publish` e o botão "Cancelar".
  - *Problema:* "Cancelar" e a seta continuam ativos durante o salvamento. Depois de descartar, `publish` ainda chama a publicação, sem pedir 2FA se houver uma confirmação recente, e uma recusa se perde. Se a resposta chega com o diálogo de descarte aberto, uma campanha nova pode levar a pessoa de volta ao formulário.
  - *Como reproduzir:* clicar em "Publicar", confirmar e clicar em "Cancelar" e "Descartar" enquanto salva: a campanha vai ao ar.
  - *Confirmado no código (27/11/2026):* não há conferência antes de publicar. O teste existente cobre só o salvamento.
  - *Sugestão:* impedir a saída enquanto salva ou publica, ou não publicar com o formulário fechado e avisar o resultado, atualizando a lista.

- [x] **C17. Prioridade inválida é salva como 0** · Importante
  - *Corrigido:* 28/11/2026, no PR #39: prioridade vazia, que é o que o navegador entrega para "50e", é recusada. Reproduzido e conferido no Chrome.
  - *Onde:* [CampaignEditor.tsx](../src/admin/campaigns/CampaignEditor.tsx), `check`; [form.ts](../src/admin/campaigns/form.ts), `checkValues` e `buildInput`.
  - *Problema:* a caixa numérica devolve vazio para textos como "50e", a conferência de `validity.badInput` cobre só as datas, e vazio vira 0. A campanha pode perder a vez para outra na loja, inclusive numa edição publicada com 2FA.
  - *Como reproduzir:* numa campanha com prioridade 50, digitar "e" depois do número e salvar.
  - *Confirmado no código (27/11/2026).* Não reproduzido no navegador.
  - *Sugestão:* conferir `validity.badInput` também no campo de prioridade.

- [ ] **C18. Celulares e telas densas podem baixar a imagem da campanha no tamanho original** · Menor
  - *Onde:* [image.ts](../src/lib/campaign/image.ts), `cloudinarySrcSet`.
  - *Problema:* a largura real entra sempre no `srcset`, mesmo muito acima da maior largura pedida.
  - *Como reproduzir:* imagem de celular com 4000 px e larguras até 1080, num celular com densidade 3: o navegador escolhe a de 4000.
  - *Confirmado no código (27/11/2026).*
  - *Sugestão:* acrescentar a largura real só quando for menor que a maior largura da lista.

- [ ] **C19. Desistir do 2FA ao publicar diz "salvo" e "nada foi alterado"** · Menor
  - *Onde:* [CampaignEditor.tsx](../src/admin/campaigns/CampaignEditor.tsx), `publish`, com `SENSITIVE_NOT_DONE`.
  - *Problema:* o aviso junta "O rascunho foi salvo..." com "Nada foi alterado."
  - *Como reproduzir:* editar um rascunho, clicar em "Publicar" e cancelar o pedido do código.
  - *Confirmado no código (27/11/2026).*
  - *Sugestão:* quando houve salvamento, usar a mensagem sem a última frase.

- [ ] **C20. Endereço de campanha malformado mostra erro de conexão** · Menor
  - *Onde:* [CampaignEditor.tsx](../src/admin/campaigns/CampaignEditor.tsx), carregamento do detalhe.
  - *Problema:* só o 404 vira "Essa campanha não existe mais". Um `?editar=` que não é UUID deve receber 400 da API, mostrado como falha de conexão, e "Tentar novamente" repete o erro.
  - *Como reproduzir:* abrir `/admin/campanhas?editar=abc`.
  - *Confirmado no código (27/11/2026):* a API não trata o erro de tipo do identificador. O status 400 não foi conferido com a API rodando.
  - *Sugestão:* tratar o 400 dessa leitura como o 404, depois de conferir o status.

- [ ] **C21. Ações sensíveis de campanha não enviam `Idempotency-Key`** · Menor
  - *Onde:* [api.ts](../src/admin/campaigns/api.ts), `publishCampaign` e `runCampaignAction`.
  - *Problema:* o `CLAUDE.md` pede a chave nos POSTs sensíveis, mas o contrato e a API só a exigem ao criar e duplicar. Hoje nada é recusado.
  - *Confirmado no código (27/11/2026):* a API não lê a chave em publicar, ativar, reativar e arquivar.
  - *Sugestão:* enviar a chave, ou ajustar a regra do `CLAUDE.md` ao contrato.

