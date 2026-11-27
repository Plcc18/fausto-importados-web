# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

Front-end da loja de perfumes Fausto Importados (React 19, TypeScript, Vite 7, Tailwind 4, shadcn/Radix, React Router 7), com loja pública e painel administrativo. A API é outro repositório, em `c:\projects\java\fausto-importados-api` (Spring Boot). Textos da interface, comentários e testes são em português.

## Comandos

```bash
pnpm install
pnpm dev                              # http://localhost:5173 (origem liberada no CORS da API)
pnpm build                            # tsc -b + vite build
pnpm lint
pnpm test                             # vitest run
pnpm test src/routes.test.ts          # um arquivo
pnpm test -t "parte do nome do teste" # por nome
```

A API local é esperada em `http://localhost:8080`. Variáveis de ambiente: ver `.env.example` (copiar para `.env.development`).

Branches: trabalhar na `dev` (gera preview na Vercel) e abrir PR para `main` (produção).

## Arquitetura

### Rotas
`src/routes.ts` é a fonte única das rotas. O fallback de SPA no `vercel.json` é restrito a elas (URL inexistente precisa dar 404 real). Rota nova exige: `ROUTES`, rewrite no `vercel.json` e `<Route>` em `App.tsx`. `src/routes.test.ts` falha se ficarem fora de sincronia.

### Painel administrativo
- Telas do painel e de login são carregadas com `React.lazy`; o chunk do painel só é baixado depois que `RequireAdmin` confirma o papel `ADMIN` na API. Código ou chamadas exclusivas do painel não podem ser importados pelo bundle público. `src/build.test.ts` faz um build real e procura marcadores (`ADMIN_ONLY_MARKERS`): endpoint administrativo novo entra nessa lista.
- A proteção real está na API; o front só decide o que mostrar.
- Sem source maps, `robots.txt` ou sitemap (também verificado pelo teste de build).

### API e autenticação
- Rotas públicas usam `fetch` com `API_URL` (`src/lib/api.ts`). Rotas autenticadas usam `authFetch` (`src/lib/auth`), que renova o token em 401. Operações que a API protege com reautenticação 2FA usam `sensitiveFetch` (`src/admin/sensitive.ts`), atendido pelo `ReauthPromptHost`.
- O access token fica só em memória; o refresh token é um cookie `HttpOnly` `SameSite=Strict`. Por isso, em produção, `/auth/*` passa pela mesma origem: rewrite → função de borda `api/auth.ts` → `src/server/authProxy.ts`, que repassa o IP do visitante e o segredo do proxy. `/api/*` vai direto para o Render com Bearer. Não crie `api/auth/` nem outro proxy sem rever `routes.test.ts` (o README explica o motivo).
- Edições do painel enviam a `version` lida da API (409 `version_conflict` → atualizar a lista, nunca sobrescrever). POSTs sensíveis enviam `Idempotency-Key` (`src/lib/idempotency.ts`); rota nova desse tipo também deve enviar. Em produção a API exige os dois (`REQUIRE_VERSION` / `REQUIRE_IDEMPOTENCY_KEY` ligadas): sem eles a chamada é recusada.

### Catálogo, carrinho e pedidos
- `useProducts` faz stale-while-revalidate com cache em `localStorage`, retentativas e timeout longo (a API no Render pode levar cerca de 1 minuto para acordar). Falha de atualização não pode derrubar o catálogo já exibido.
- Filtros, ordenação e paginação da loja são feitos no cliente sobre a lista completa de `/api/product`.
- A API devolve `category` em maiúsculas, embora `src/lib/types.ts` declare minúsculas; compare normalizando.
- O carrinho vive em `localStorage` (`src/lib/store.ts`) e é reconciliado com a API por `useCartReconciliation`. O pedido é enviado a `/api/orders` e finalizado pelo WhatsApp; a API recalcula preços e total.
- As funções de produto em `src/lib/store.ts`, `products-data.ts` e `decreaseStock.ts` são resquícios: produtos reais vêm da API.

### Interface
- Paleta da marca em CSS Variables no `src/index.css` (`:root` claro, `.dark` escuro, tokens `--gold-*`). O tema claro/escuro é aplicado antes do primeiro paint por um script em `index.html`, que precisa seguir o mesmo critério de `useTheme`.
- Componentes shadcn ficam em `src/Shadcn-Components/ui`. O `components.json` ainda aponta para `@/components/ui`: ao adicionar um componente pela CLI, mova o arquivo e ajuste os imports.
- Avisos em diálogo usam `notify()` (`src/lib/notice.ts`); toasts usam Sonner. SweetAlert2 foi removido e o teste de build impede a volta (o README ainda o cita).
- `notice.ts` e `reauthBridge.ts` guardam estado em `globalThis` de propósito (módulos duplicados no hot reload).
- Falhas de comunicação são classificadas por `src/lib/httpErrors.ts` e exibidas pelas telas de `src/component/errors`.

## Testes
O ambiente padrão do Vitest é Node. Testes de DOM declaram `// @vitest-environment jsdom` na primeira linha e chamam `cleanup()` manualmente.

## TypeScript
`verbatimModuleSyntax` (use `import type`) e `erasableSyntaxOnly` (sem `enum`, `namespace` ou propriedades declaradas no construtor). Alias `@/` aponta para `src/`.

## Campanhas sazonais
- Tasks em `docs/campanhas-sazonais-tasks.md`. Faça uma por vez e marque `[x]` só quando atender ao "Pronto quando".
- Ativar, encerrar ou editar uma campanha nunca altera os preços cadastrados dos produtos.
- Sem campanha ativa, ou se a consulta falhar e não houver campanha ainda válida no cache local (`src/lib/campaign/store.ts`), a loja usa o tema padrão. Uma campanha em cache sai do ar no fim dela mesmo com a API fora.
