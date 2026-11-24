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
- **Painel admin** (`/admin`): cadastro, edição e exclusão de produtos, upload de imagens, gestão de pedidos (pendentes, concluídos, cancelados) e notificações de novos pedidos.
- **Relatório de vendas** (`/admin/relatorio`): estatísticas e histórico de vendas.
- **Entrar** (`/entrar`): login único. Administradores seguem para o código do autenticador (2FA) e, no primeiro acesso, cadastram o autenticador (QR code) e recebem códigos de recuperação. Access token de curta duração (só em memória) + refresh token em cookie `HttpOnly`, com sessão deslizante. Veja [Autenticação](#autenticação).
- **Cabeçalho da loja**: visitantes não veem botão de conta (não há cadastro de clientes; quem administra acessa `/entrar` direto). Quem está logado vê o menu da conta com "Sair", e administradores também veem "Painel".
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
├── App.tsx              # Rotas e guarda de administrador (RequireAdmin)
├── main.tsx
├── admin/               # Painel (Admin, SalesReport, notificações) — carregado sob demanda, só para administradores
├── component/           # Telas públicas e componentes (Store, Login, AuthMenu, Cart...)
├── Shadcn-Components/   # Componentes de UI (shadcn)
└── lib/                 # API, hooks, tipos e utilitários
```

## Integração com a API

As requisições usam `API_URL` definido em [src/lib/api.ts](src/lib/api.ts). As chamadas autenticadas passam por `authFetch` ([src/lib/auth](src/lib/auth)), que envia `Authorization: Bearer`. A API precisa liberar a origem do front no CORS com credenciais (`FRONTEND_URL`).

Principais endpoints consumidos: `/auth/*`, `/api/product`, `/api/orders`, `/api/orders/report`, `/api/orders/sales-stats` e `/api/upload`.

## Autenticação

Access token + refresh token com sessão deslizante (a API está em `fausto-importados-api`).

- **Access token** (JWT, ~15 min): guardado **só em memória** (nunca em `localStorage`/`sessionStorage`). Ao recarregar a página ele some e o app o recupera pelo cookie de refresh.
- **Refresh token**: cookie `HttpOnly` gerido pelo browser; o JS nunca o vê.
- **Renovação**: proativa ~1 min antes de expirar e também ao receber 401. É *single-flight*: se várias requisições tomam 401 juntas, só **uma** chamada de refresh acontece; as outras esperam e são refeitas.
- **Inatividade**: sem interação por `VITE_IDLE_TIMEOUT_MS` (padrão 7 dias) o token deixa de ser renovado, inclusive pelos polls automáticos do painel.
- **Abas**: `BroadcastChannel` propaga token, atividade e logout; `navigator.locks` evita dois refreshes simultâneos entre abas.
- **Logout**: revoga a sessão no servidor e em todas as abas. O diálogo de sair também oferece "Sair de todos os dispositivos".

### Administradores: 2FA, reautenticação e acesso ao painel

- **2FA (TOTP) obrigatório** para administradores. Login em passos: senha → código do aplicativo autenticador → sessão. No primeiro acesso a tela mostra o QR code (desenhado no navegador com a biblioteca `qrcode`; o segredo nunca vai a serviço externo) e a chave manual, pede a senha nova (contas criadas por outro admin começam com senha temporária) e exibe 10 **códigos de recuperação** uma única vez.
- **Reautenticação**: operações sensíveis (zerar vendas/relatório, limpar histórico) pedem um código 2FA recente. O app abre um diálogo, a API devolve uma prova de 5 minutos presa à sessão, e a operação é refeita com ela.
- **Quem vê o quê**: o papel (`ADMIN`/`USER`) vem de `/auth/me`. Usuário comum em `/admin` recebe a página 403; sem sessão vai para `/entrar?next=...`. O botão "Painel" só aparece para administradores.
- **Código do painel sob demanda**: `Admin` e `SalesReport` são chunks separados (`React.lazy`) e só são baixados **depois** de a API confirmar o administrador; visitantes e clientes nunca recebem esse código. O build não gera source maps. (`src/build.test.ts` confere isso num build real.)
- **A proteção real está na API.** A rota `/admin` é convencional e não é secreta: esconder o botão ou o chunk é só interface; cada endpoint valida autenticação, papel, 2FA e reautenticação no servidor, e registra tudo na auditoria. Não há `robots.txt` nem sitemap.
- Headers de segurança (`vercel.json`): `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`.

### Por que as rotas `/auth/*` passam pelo proxy da Vercel

O cookie de refresh é `SameSite=Strict`, e o front (`*.vercel.app`) e a API (`*.onrender.com`) são **sites diferentes**: o browser não enviaria o cookie. A solução sem domínio próprio é o `rewrite` `/auth/:path*` do [vercel.json](vercel.json): o browser fala com `/auth/*` na própria origem do front e a Vercel repassa para o Render, e o cookie fica no domínio do front. As demais rotas (`/api/*`) vão direto ao Render, autenticadas por Bearer.

Para configurar a produção:

1. No [vercel.json](vercel.json), troque `https://SUA-API.onrender.com` pela URL real da API no Render.
2. Na Vercel, defina `VITE_AUTH_SAME_ORIGIN=true` (além de `VITE_API_URL`).
3. No Render, defina `FRONTEND_URL` com a URL do front na Vercel (ex.: `https://seu-app.vercel.app`). Aceita várias origens separadas por vírgula; as URLs de preview da Vercel só conseguem renovar a sessão se estiverem na lista.
4. Remova `JWT_EXPIRATION` do Render (não é mais usado).

Em desenvolvimento nada disso é necessário: `localhost:5173` e `localhost:8080` são o mesmo *site*.

## Deploy

O projeto é publicado na Vercel. O [vercel.json](vercel.json) redireciona as rotas do app para `index.html` (SPA) e faz o proxy de `/auth/*` para a API.

- Branch `main`: produção.
- Branch `dev` e demais branches: geram apenas URLs de preview. Faça as alterações na `dev` e abra um PR para a `main` quando estiver pronto.
