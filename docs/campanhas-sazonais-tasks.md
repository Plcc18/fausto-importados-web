# Campanhas Sazonais: Tasks de implementação

**Como marcar:** troque `[ ]` por `[x]` quando a task atender ao "Pronto quando".

**Repositórios:** `API` = `fausto-importados-api` (Spring Boot + PostgreSQL) · `WEB` = `fausto-importados-web` (React + Vite)

**Ordem:** siga a numeração. Cada fase depende das anteriores.

---

## Fase 0: Preparação

- [x] **T01. Fechar o trabalho pendente e definir as branches** · `API` `WEB`
  - `feat/admin-security` da API (com as migrations `V8` e `V9`) concluída e integrada à `dev` e à `main`.
  - Branches: uma por task, criada a partir da `dev` (ex.: `feat/campanhas-t04-migration`), com PR para a `dev`. Sem branch longa de campanhas.
  - *Pronto quando:* os dois repositórios estão sem pendências, com testes passando antes de qualquer mudança.
  - *Resultado (26/11/2026):* API com 256 testes passando, inclusive os de PostgreSQL real (nenhum pulado); WEB com 235 testes, lint limpo.

- [x] **T02. Tomar as decisões de produto e arquitetura**
  - [x] Descontos: a campanha só destaca produtos (recomendado na primeira versão) ou também aplica preço promocional (habilita T42 e T43)?
    - **Decidido:** terá preço promocional, em duas etapas. A primeira versão só destaca produtos; T42 e T43 entram na segunda etapa. O contrato (T03) já reserva os campos de desconto, para a segunda etapa só acrescentar; as colunas no banco entram numa migration da própria T42.
  - [x] Tema claro/escuro: paleta escura obrigatória e clara opcional (recomendado) ou uma paleta única?
    - **Decidido:** paleta escura obrigatória e clara opcional.
  - [x] Alcance do tema: só páginas públicas, mantendo painel, login e telas de erro no padrão (recomendado)?
    - **Decidido:** só páginas públicas.
  - [x] Conflitos: bloquear períodos sobrepostos com a mesma prioridade; com prioridades diferentes, vence a maior (recomendado).
    - **Decidido:** conforme a recomendação.
  - [x] Status: gravar só rascunho, publicada, desativada e arquivada; calcular "agendada", "ativa" e "expirada" pelas datas, sem cron (recomendado).
    - **Decidido:** conforme a recomendação.
  - [x] Prévia: abrir a loja real em nova aba com `/?previa=<id>`, só para admin (recomendado; o site hoje bloqueia iframe).
    - **Decidido:** conforme a recomendação. O código da prévia só é carregado depois de confirmar o admin, para não entrar no bundle público (`build.test.ts`).
  - [x] Segurança: publicar ou excluir campanha exige nova confirmação 2FA?
    - **Decidido:** exige 2FA toda ação que coloca, muda ou tira conteúdo do ar de forma definitiva: publicar, ativar agora, reativar, editar campanha publicada, excluir e arquivar.
    - Sem 2FA: criar e editar rascunho, duplicar, prévia e desativar. Desativar fica livre por ser o "botão de emergência" para tirar do ar uma campanha errada.
  - *Pronto quando:* todas as respostas estão registradas neste arquivo.

- [x] **T03. Definir o contrato da API**
  - Descrever o JSON de `theme`, `content`, coleções, resposta pública e endpoints administrativos, com limites de cada campo.
  - Tipos de evento: Black Friday, Natal, Páscoa, Namorados, Mães, Pais, Consumidor, Aniversário da loja e Personalizada.
  - Reservar os campos de desconto da segunda etapa (T42 e T43), sempre `null` na primeira versão (outro valor é recusado com `discount_not_supported`).
  - Indicar quais ações exigem 2FA, conforme T02.
  - *Pronto quando:* backend e frontend podem ser desenvolvidos a partir do mesmo documento.
  - *Resultado:* contrato em [`campanhas-contrato.md`](campanhas-contrato.md).

---

## Fase 1: Banco de dados e domínio

- [x] **T04. Criar a migration das campanhas** · `API`
  - Próxima versão do Flyway: `V10` (`V8` e `V9` já estão na `dev`).
  - `campaigns`: id, nome, descrição, tipo, status, início e fim (`TIMESTAMPTZ`), prioridade, `theme` e `content` (JSONB), versão, criação, atualização e autor.
  - `campaign_collections`: campanha, título, identificador para link, ordem.
  - `campaign_collection_products`: coleção, produto (FK), ordem.
  - Índices e constraints (fim depois do início, status e tipo válidos). Imagens guardadas só como URL.
  - *Pronto quando:* a migration roda em Postgres real sobre uma base existente.
  - *Resultado (27/11/2026):* `V10__create_campaigns.sql` testada em PostgreSQL 16 sobre uma base na V9 com dados (`CampaignMigrationTest`); API com 266 testes passando, nenhum pulado. Nome, tipo, datas e tema só são obrigatórios no banco para campanha publicada (contrato §6).

- [x] **T05. Criar entidades, enums e repositórios** · `API`
  - Lock otimista (`@Version`), seguindo o padrão de produtos.
  - Consultas sem N+1 para campanha com coleções e produtos.
  - *Pronto quando:* a validação de schema do Hibernate passa e os testes em H2 continuam funcionando.
  - *Resultado (27/11/2026):* entidades validadas contra o schema do Flyway em PostgreSQL 16 e testadas em H2; API com 284 testes passando, nenhum pulado. Toda alteração, mesmo só em produtos, precisa chamar `Campaign.registerChange` para a `version` subir (vale para T09 a T11).

- [x] **T06. Validar tema e conteúdo no backend** · `API`
  - Cores apenas em formato hexadecimal.
  - Links apenas internos ou `https` (bloquear `javascript:`, `//` e afins).
  - Textos puros, sem HTML, com tamanho máximo.
  - Imagens apenas do Cloudinary do projeto.
  - Elementos decorativos escolhidos em um catálogo fechado, sem CSS ou script livre.
  - *Pronto quando:* entradas inválidas retornam 400 com mensagem clara, cobertas por teste.
  - *Resultado (27/11/2026):* `CampaignContentValidator` e erro `validation_failed` com `fields`, testados com um controller de teste; API com 378 testes passando, nenhum pulado. As rotas reais (T09) precisam chamar o validador e gravar a cópia que ele devolve. Dados gerais (nome, descrição, datas, prioridade) ficam para a T09, coleções para a T11 e os requisitos de publicação para a T10. Regras detalhadas no contrato.

---

## Fase 2: Regras e endpoints

- [x] **T07. Resolver a campanha ativa no servidor** · `API`
  - Usar o `Clock` injetado; exibição e entrada de datas em `America/Fortaleza`.
  - Antes do início: agendada. No período: ativa. Depois: expirada. Sem ativa: tema padrão.
  - Aplicar a regra de prioridade com desempate previsível e calcular o próximo horário de mudança.
  - *Pronto quando:* testes com relógio controlado cobrem os limites exatos de início e fim.
  - *Resultado (27/11/2026):* `ActiveCampaignService` e `Campaign.phaseAt`, com os limites testados em H2 e PostgreSQL 16; API com 398 testes passando, nenhum pulado. A API calcula com instantes em UTC; a exibição e a entrada em `America/Fortaleza` ficam no painel (contrato §1, T28). Ainda sem rota: o endpoint público é a T12.

- [x] **T08. Impedir campanhas conflitantes** · `API`
  - Validar ao publicar, reativar e editar uma campanha publicada.
  - Garantir a regra mesmo com requisições simultâneas (lock ou constraint no Postgres).
  - A mensagem de erro informa qual campanha conflita.
  - *Pronto quando:* um teste concorrente não consegue publicar duas campanhas conflitantes.
  - *Resultado (27/11/2026):* `CampaignConflictGuard` (lock de transação) e constraint de exclusão na migration `V11`; teste com 8 publicações simultâneas em PostgreSQL 16; API com 426 testes passando, nenhum pulado. As rotas de publicar, reativar e editar ainda não existem: a T09 e a T10 precisam chamar `ensureNoConflict` dentro de `Transactions.run`, antes de gravar.

- [x] **T09. Criar os endpoints administrativos** · `API`
  - `/api/admin/campaigns`: listar (filtros por status, tipo e período, com paginação), detalhar, criar rascunho e editar.
  - Restritos a `ADMIN`, com controle de versão e `Idempotency-Key` na criação.
  - *Pronto quando:* anônimos e não administradores não têm acesso a nenhuma rota.
  - *Resultado (27/11/2026):* listar, detalhar, criar e editar, com 2FA e conferência de conflito na edição de publicada; anônimo recebe 401 e não administrador 404; API com 474 testes passando, nenhum pulado. `collections` com itens é recusada até a T11 (a resposta já as devolve). `CampaignPublishRequirements` já existe, para a T10 reutilizar. A auditoria registra só a criação e a edição; o antes e depois fica para a T14.

- [x] **T10. Criar as ações sobre campanhas** · `API`
  - Publicar, ativar agora, desativar, reativar, duplicar (cópia como rascunho, sem datas) e excluir ou arquivar.
  - Exigir os campos mínimos para publicar; rascunho pode ficar incompleto.
  - *Pronto quando:* cada transição válida e inválida tem teste.
  - *Resultado (27/11/2026):* as sete rotas, com a tabela de transições em `CampaignAction` e as 42 combinações de situação e ação testadas; publicar, ativar, reativar, arquivar e excluir exigem 2FA; API com 565 testes passando, nenhum pulado. A auditoria registra cada ação com nome, status e versão; o antes e depois fica para a T14. `duplicate` exige `Idempotency-Key` (o painel precisa enviar, T27).

- [x] **T11. Gerenciar coleções e produtos participantes** · `API`
  - Criar, editar, ordenar e remover coleções; associar e ordenar produtos.
  - Rejeitar produto inexistente ou duplicado; produto desativado não aparece na loja.
  - *Pronto quando:* alterar uma campanha não modifica nenhum dado dos produtos.
  - *Resultado (27/11/2026):* coleções gravadas ao criar e editar, e desconto recusado com `discount_not_supported`; API com 591 testes passando, nenhum pulado. Um teste compara as linhas dos produtos antes e depois de todas as operações de campanha. `CampaignCatalog.publicCollections` já omite os desativados: a T12 deve usá-lo. `registerChange` passou a sempre avançar `updatedAt`, para uma mudança só nas coleções subir a `version`.

- [x] **T12. Criar o endpoint público e o de prévia** · `API`
  - `GET /api/campaigns/active`, liberado no `SecurityConfig`: só dados públicos, IDs dos produtos, horário do servidor e próxima mudança.
  - Resposta explícita quando não há campanha ativa. Rascunhos e agendadas nunca vazam.
  - `GET /api/admin/campaigns/{id}/preview`: mesmo formato, para qualquer status, só `ADMIN`.
  - *Pronto quando:* os testes de acesso e de conteúdo exposto passam.
  - *Resultado (27/11/2026):* as duas rotas, com testes de acesso e do conjunto exato de campos expostos; API com 618 testes passando, nenhum pulado. De uma campanha agendada só sai o horário da próxima mudança (`nextChangeAt`, contrato §7.1). A rota pública ainda não tem cache nem `ETag` e responde com o `no-store` padrão: é a T13.

- [x] **T13. Adicionar cache à campanha ativa** · `API`
  - Cache em memória invalidado após cada alteração confirmada, respeitando início e fim.
  - `ETag` e `Cache-Control` curto na rota pública (substituindo o `no-store` padrão do Spring Security).
  - Conferir o limite de requisições para visitantes anônimos.
  - *Pronto quando:* uma edição aparece na loja dentro do prazo definido e acessos repetidos não consultam o banco.
  - *Resultado (27/11/2026):* `ActiveCampaignCache` (60 s, invalidado por alterações de campanha e de produto ativo), `ETag`, `304` e `max-age` de até 60 s. A rota ganhou limite próprio em memória (`RATE_LIMIT_PUBLIC_READ`, 120/min por IP): antes dividia os 60/min anônimos com o catálogo e, sem Redis, gravava no banco a cada visita. API com 628 testes passando; os de Redis não rodaram e, com o Docker parado, os de banco usaram um PostgreSQL 18 temporário. O front deve usar o cabeçalho `Date` como hora do servidor (contrato §7.1, T16 e T17).

- [x] **T14. Registrar o histórico de alterações** · `API`
  - Novas ações de campanha em `AuditAction`, com o antes e depois via auditoria existente.
  - Endpoint do histórico por campanha.
  - *Pronto quando:* toda operação administrativa registra quem, o quê e quando.
  - *Resultado (27/11/2026):* antes e depois em todas as operações (`CampaignAuditDiff`) e `GET /api/admin/campaigns/{id}/history` (contrato §7.5). Um teste falha se surgir rota de escrita de campanha sem registro. Detalhes grandes deixaram de ser cortados no meio (JSON inválido); o limite passou a 16.000 caracteres. API com 642 testes passando; os de Redis não rodaram e, com o Docker parado, os de banco usaram um PostgreSQL 18 temporário. O histórico segue a retenção da auditoria (1 ano por padrão; citar nas limitações da T41).

- [x] **T15. Preparar o upload de banners** · `API`
  - Configurar o limite de multipart (não há configuração no projeto; o padrão do Spring é 1 MB).
  - Validar tipo real (JPEG, PNG, WebP) e tamanho; recusar SVG.
  - Pasta própria no Cloudinary e erros claros, sem quebrar o upload de produtos.
  - *Pronto quando:* um banner grande dentro do limite sobe e um arquivo inválido é recusado.
  - *Resultado (27/11/2026):* `POST /api/upload?folder=campaigns` com limite de 5 MB e tipo conferido pelo conteúdo; API com 665 testes passando (Cloudinary simulado; os de Redis não rodaram e, com o Docker parado, os de banco usaram um PostgreSQL 18 temporário). **Falta conferir contra o Cloudinary real** (pasta, `width` e `height`), o mais tardar na T39. O upload de produtos não mudou, exceto o limite, que passou de 1 MB para 5 MB; o painel ainda anuncia 8 MB (corrigir na T30).

---

## Fase 3: Tema dinâmico na loja

- [x] **T16. Criar os tipos e o cliente da campanha** · `WEB`
  - Tipos conforme T03 e validação da resposta antes do uso.
  - *Pronto quando:* uma resposta malformada resulta no tema padrão, sem erro na tela.
  - *Resultado (27/11/2026):* `src/lib/campaign/` com os tipos (`types.ts`), a validação (`parse.ts`) e o cliente (`client.ts`). A validação monta um objeto novo só com os campos do contrato e confere cores, links e imagens do Cloudinary; campanha malformada vira `campaign: null` (tema padrão) e só gera aviso no console em desenvolvimento. `content: null` vira conteúdo vazio. O cliente faz uma única tentativa com `cache: "no-cache"` e usa o cabeçalho `Date` como `serverTime` (contrato §7.1); retentativas, cache local e timeout ficam na T17. Front com 304 testes passando.

- [ ] **T17. Criar o carregamento da campanha ativa** · `WEB`
  - Um único ponto de busca, compartilhado entre os componentes, paralelo ao catálogo.
  - Cache local com validade, descartando campanha expirada.
  - Atualizar ao voltar para a aba e no próximo horário de mudança.
  - Timeout e fallback para falha, 404 ou API demorando a acordar.
  - *Pronto quando:* a loja funciona normalmente com a rota de campanhas fora do ar.

- [ ] **T18. Criar o sistema central de temas** · `WEB`
  - Um único módulo converte `theme` em CSS Variables (modos claro e escuro).
  - Cobrir fundo principal e secundário, destaque, botões, textos e etiquetas promocionais, incluindo os tokens dourados.
  - Remover o tema ao encerrar a campanha ou ao entrar em área fora do alcance definido.
  - *Pronto quando:* trocar de campanha muda o visual sem condicionais por campanha nos componentes.

- [ ] **T19. Ajustar os componentes para usar os tokens** · `WEB`
  - Substituir cores fixas relevantes e criar o token das etiquetas ("Oferta" e selo de campanha).
  - Manter logo, coroa e tipografia da marca.
  - *Pronto quando:* sem campanha, o visual é igual ao atual.

- [ ] **T20. Evitar a troca visível de tema no carregamento** · `WEB`
  - Aplicar o tema em cache antes da primeira renderização (script no `index.html`), checando a validade.
  - *Pronto quando:* recarregar durante uma campanha não pisca o tema padrão.

---

## Fase 4: Conteúdo da campanha na loja

- [ ] **T21. Separar cabeçalho e hero do `Store.tsx`** · `WEB`
  - Refatoração sem mudança visual, preparando os pontos de conteúdo dinâmico.
  - *Pronto quando:* a loja se comporta como antes e os testes passam.

- [ ] **T22. Implementar a faixa promocional superior** · `WEB`
  - Texto e link configuráveis, visível também no celular; sem campanha, permanece a faixa atual.
  - *Pronto quando:* a faixa funciona nos dois tamanhos de tela.

- [ ] **T23. Implementar o banner principal** · `WEB`
  - Imagens separadas para desktop e celular, título, subtítulo, botões e links.
  - Imagens otimizadas, com texto alternativo e espaço reservado para não deslocar o layout.
  - Hero atual como fallback, inclusive se a imagem falhar; um único `h1`.
  - *Pronto quando:* o banner se adapta aos dois tamanhos sem cortar o conteúdo.

- [ ] **T24. Implementar coleções e seções especiais** · `WEB`
  - Exibir coleções e imagens de divulgação, cruzando os IDs com o catálogo já carregado.
  - Permitir link direto para uma coleção (por exemplo, `?colecao=ofertas`).
  - Selo nos produtos participantes. Ocultar seções vazias.
  - *Pronto quando:* não há requisição por produto e busca, filtros e carrinho continuam funcionando.

- [ ] **T25. Criar os elementos decorativos** · `WEB`
  - Catálogo discreto (neve, brilhos, corações, fitas etc.), ativado pelo painel.
  - Não bloquear cliques, ignorar em leitores de tela e respeitar redução de movimento.
  - *Pronto quando:* é possível ligar e desligar cada elemento sem prejudicar o uso.

---

## Fase 5: Painel administrativo

- [ ] **T26. Criar a área de campanhas** · `WEB`
  - Rota `/admin/campanhas` com `RequireAdmin`, carregamento sob demanda e acesso pelo painel atual.
  - Atualizar `routes.ts`, `vercel.json`, `routes.test.ts` e os marcadores de `build.test.ts`.
  - *Pronto quando:* a rota abre direto pela URL e o código dela não vai no bundle público.

- [ ] **T27. Criar a listagem e o histórico geral** · `WEB`
  - Status, tipo, período, prioridade, busca e filtros, incluindo expiradas.
  - Ações: criar, editar, duplicar, ativar, desativar, excluir ou arquivar, com confirmação.
  - *Pronto quando:* todas as ações funcionam com estados de carregamento, vazio e erro.

- [ ] **T28. Criar o formulário de dados e agendamento** · `WEB`
  - Nome, descrição, tipo, prioridade, início e fim no horário de Fortaleza.
  - Salvar rascunho, publicar, avisar sobre alterações não salvas, conflitos e edição concorrente.
  - *Pronto quando:* as datas aparecem corretamente mesmo com o computador em outro fuso.

- [ ] **T29. Criar o editor de tema** · `WEB`
  - Seletor para todas as cores, restaurar padrão e miniprévia ao vivo.
  - Modelos iniciais editáveis (Black Friday, Natal, Páscoa, Namorados etc.).
  - Alertar sobre contraste insuficiente.
  - *Pronto quando:* é possível montar um tema completo sem tocar em código.

- [ ] **T30. Criar o upload de imagens e banners** · `WEB`
  - Transformar o `SmartImageUploader` em componente reutilizável (hoje usa um ID fixo).
  - Desktop e celular, dimensões recomendadas, texto alternativo, substituição e remoção.
  - *Pronto quando:* produtos e campanhas usam o mesmo componente sem conflito.

- [ ] **T31. Criar o editor de conteúdo** · `WEB`
  - Faixa superior, banner, textos, botões, links, seções especiais, imagens de divulgação e decorações.
  - Validação junto ao campo.
  - *Pronto quando:* todo conteúdo exibido na loja é editável pelo painel.

- [ ] **T32. Criar o seletor de produtos e coleções** · `WEB`
  - Buscar, filtrar, selecionar vários, ordenar e organizar em coleções.
  - *Pronto quando:* é possível montar coleções como "Ofertas Black Friday" e "Mais vendidos da campanha".

- [ ] **T33. Criar a prévia antes de publicar** · `WEB`
  - Seguir a decisão de T02, com aviso de "modo prévia" e botão de sair.
  - Funcionar com rascunho, em desktop e celular, sem alterar o cache público.
  - *Pronto quando:* o admin vê a campanha completa e os visitantes continuam vendo a versão atual.

- [ ] **T34. Exibir o histórico de alterações** · `WEB`
  - Linha do tempo por campanha com autor, data, ação e mudanças.
  - *Pronto quando:* as alterações feitas no painel aparecem no histórico.

---

## Fase 6: Preços e promoções

- [ ] **T35. Proteger as regras de preço** · `API` `WEB`
  - Garantir por teste que ativar, encerrar ou editar campanha nunca altera `price` ou `originalPrice`.
  - Validar no backend que o preço original, quando informado, é maior que o preço (conferindo antes os dados existentes).
  - Manter o selo "Oferta" e o filtro "Promoções" funcionando.
  - *Pronto quando:* preços exibidos, carrinho e total do pedido continuam consistentes.

> As tasks T42 e T43 (preço promocional por campanha) foram aprovadas em T02 como segunda etapa. Elas ficam no fim para não alterar a numeração.

---

## Fase 7: Testes e qualidade

- [ ] **T36. Completar os testes do backend** · `API`
  - Regras de data, prioridade, conflito, validação, permissões, cache, auditoria e migration em Postgres.
  - *Pronto quando:* toda a suíte passa, sem testes de migration pulados.

- [ ] **T37. Completar os testes do frontend** · `WEB`
  - Tema, fallback, expiração, links seguros, formulários, rotas e build.
  - *Pronto quando:* `pnpm test`, `pnpm lint` e `pnpm build` passam.

- [ ] **T38. Revisar responsividade, acessibilidade, desempenho e SEO** · `WEB`
  - Celular, tablet e desktop; modos claro e escuro; teclado e contraste.
  - Comparar o carregamento do catálogo antes e depois; conferir títulos e textos alternativos.
  - *Pronto quando:* não há regressão em relação à loja atual.

- [ ] **T39. Validar os critérios de aceitação de ponta a ponta**
  - [ ] Criar campanha sem modificar código
  - [ ] Personalizar o tema pelo painel
  - [ ] Fazer upload de banners
  - [ ] Agendar uma campanha
  - [ ] Ativar e encerrar automaticamente
  - [ ] Voltar ao tema padrão após o encerramento
  - [ ] Visualizar a prévia antes de publicar
  - [ ] Selecionar produtos participantes
  - [ ] Manter o catálogo funcionando, inclusive com falha nas campanhas
  - [ ] Proteger as operações administrativas
  - [ ] Funcionar em celular e desktop
  - *Pronto quando:* todos os itens foram testados com API e site rodando juntos.

---

## Fase 8: Publicação e entrega

- [ ] **T40. Publicar em produção** · `API` `WEB`
  - Backup do banco, preflight, deploy da API (Render) e conferência da migration.
  - Testar o preview da Vercel e só então levar para a `main`.
  - Registrar como reverter.
  - *Pronto quando:* uma campanha de teste é agendada, ativada e encerrada em produção.

- [ ] **T41. Documentar a entrega** · `API` `WEB`
  - Arquivos criados e modificados, arquitetura e modelagem do banco.
  - Guia para criar, agendar, visualizar e alterar temas.
  - Resultado dos testes e limitações (atraso do cache, imagens órfãs no Cloudinary, prévia ao compartilhar links em redes sociais, demora da API para acordar).
  - Atualizar os READMEs.
  - *Pronto quando:* outra pessoa consegue criar uma campanha seguindo apenas o guia.

---

## Segunda etapa: preço promocional por campanha

*Aprovado em T02. Execute depois da primeira versão publicada (T40 e T41), com testes próprios e nova publicação.*

- [ ] **T42. Calcular o preço promocional no servidor** · `API`
  - Desconto por produto ou coleção, sem alterar o preço cadastrado, válido só no período ativo.
  - Mesma regra no catálogo e na criação do pedido, com limites e sem acumular descontos indevidamente.
  - *Pronto quando:* testes mostram o preço voltando ao normal no encerramento e o pedido ignorando valores enviados pelo cliente.

- [ ] **T43. Exibir e configurar o preço promocional** · `WEB`
  - Campos no painel; preço correto em cards, carrinho e mensagem do WhatsApp.
  - Cache de produtos e carrinho não podem manter preço de campanha encerrada.
  - *Pronto quando:* o valor visto pelo cliente é igual ao gravado no pedido.
