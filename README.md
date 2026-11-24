# Fausto Importados — Front-end

Loja virtual de perfumes importados com painel administrativo. O cliente navega pelo catálogo, monta o carrinho e finaliza o pedido via WhatsApp; o administrador gerencia produtos, pedidos e relatórios de vendas.

O back-end fica em outro repositório: `fausto-importados-api` (Spring Boot).

## Tecnologias

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4 + shadcn/ui (Radix UI)
- React Router 7
- Sonner (toasts) e SweetAlert2 (confirmações)
- Vercel Analytics e Speed Insights
- pnpm como gerenciador de pacotes

## Funcionalidades

- **Loja** (`/`): catálogo de produtos com busca, filtros, paginação, carrinho e envio do pedido por WhatsApp.
- **Painel admin** (`/nexus-24`): cadastro, edição e exclusão de produtos, upload de imagens, gestão de pedidos (pendentes, concluídos, cancelados) e notificações de novos pedidos.
- **Relatório de vendas** (`/nexus-24/relatorio`): estatísticas e histórico de vendas.
- **Login admin** (`/nexus-24/login`): autenticação por cookie. As rotas do painel são protegidas e consultam `/auth/me` na API.
- Tema claro/escuro e páginas de Termos, Privacidade e Cookies.

## Pré-requisitos

- Node.js 20 ou superior
- [pnpm](https://pnpm.io/)
- API rodando (por padrão em `http://localhost:8080`)

## Como rodar

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.development

# 3. Subir o servidor de desenvolvimento
pnpm dev
```

A aplicação fica disponível em `http://localhost:5173`. Essa é a origem liberada no CORS da API em desenvolvimento.

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `VITE_API_URL` | URL base da API | `http://localhost:8080` |
| `VITE_WHATSAPP_NUMBER` | Número do WhatsApp que recebe os pedidos (DDI + DDD + número, só dígitos) | definido em `Cart.tsx` |

O modelo está em [.env.example](.env.example). Os arquivos `.env.development`, `.env.production` e `.env.local` estão no `.gitignore` e não devem ser commitados.

Como o Vite embute as variáveis no build, em produção (Vercel) elas devem ser configuradas em **Settings → Environment Variables** do projeto.

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento com HMR |
| `pnpm build` | Checagem de tipos (`tsc -b`) e build de produção em `dist/` |
| `pnpm preview` | Serve o build localmente |
| `pnpm lint` | Executa o ESLint |

## Estrutura

```
src/
├── App.tsx              # Rotas e proteção das rotas admin
├── main.tsx
├── component/           # Telas e componentes (Store, Admin, Cart, SalesReport...)
├── Shadcn-Components/   # Componentes de UI (shadcn)
└── lib/                 # API, hooks, tipos e utilitários
```

## Integração com a API

As requisições usam `API_URL` definido em [src/lib/api.ts](src/lib/api.ts). As chamadas autenticadas usam `credentials: 'include'` para enviar o cookie de sessão, então a API precisa:

- liberar a origem do front no CORS com credenciais;
- em produção, usar cookies com `Secure` e `SameSite=None` (front e API em domínios diferentes).

Principais endpoints consumidos: `/auth/me`, `/api/product`, `/api/orders`, `/api/orders/report`, `/api/orders/sales-stats` e `/api/upload`.

## Deploy

O projeto é publicado na Vercel. O [vercel.json](vercel.json) redireciona todas as rotas para `index.html` (SPA).

- Branch `main`: produção.
- Branch `dev` e demais branches: geram apenas URLs de preview. Faça as alterações na `dev` e abra um PR para a `main` quando estiver pronto.
