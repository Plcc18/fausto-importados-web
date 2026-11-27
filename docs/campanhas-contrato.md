# Campanhas Sazonais: contrato da API

> **Status:** aprovado (T03, 26/11/2026). Documento único para `fausto-importados-api` e `fausto-importados-web`.
> Decisões de produto em `campanhas-sazonais-tasks.md` (T02). Mudou aqui, muda nos dois repositórios.

## 1. Convenções gerais

Seguem o que a API já faz hoje.

| Tema | Regra |
|---|---|
| Nomes | JSON em `camelCase`. Valores de enum em MAIÚSCULAS (como `category` dos produtos). |
| IDs | UUID em texto. |
| Datas | ISO-8601 com fuso, sempre em UTC na resposta: `"2026-11-28T03:00:00Z"`. O banco guarda `TIMESTAMPTZ`. O painel mostra e recebe datas no horário de `America/Fortaleza` (UTC−03:00, sem horário de verão) e converte. |
| Textos | Texto puro. A API rejeita `<` e `>` em qualquer campo de texto (sem HTML). Nos textos de `content`, rejeita também quebras de linha e caracteres de controle. Tamanhos contados em caracteres, depois de remover espaços das pontas (um emoji conta como um). |
| Normalização | A API grava sem espaços nas pontas; texto vazio vira `null` e lista ausente em `content` vira `[]`. Propriedades fora do contrato são ignoradas. |
| Ausência | Campo opcional sem valor vem como `null` (não é omitido), para o front tratar um caso só. |
| Paginação | `PagedModel` do Spring, igual a `/api/admin/audit`: `{ "content": [...], "page": { "size", "number", "totalElements", "totalPages" } }`. `page` começa em 0; `size` padrão 20, máximo 100. |
| Edição concorrente | Toda escrita sobre uma campanha existente envia a `version` lida. Diferente da atual → `409 version_conflict`; ausente → `428 version_required`. |
| Repetição | `POST` que cria algo (criar, duplicar) exige `Idempotency-Key`. Mesma chave → mesma resposta, sem criar de novo. No front: `src/lib/idempotency.ts`. |
| 2FA | Ações marcadas com 🔐 exigem o header `X-Reauth` (prova de `POST /auth/reauth`, vale 5 min). Sem ele → `403 reauth_required`. No front: `sensitiveFetch`. |
| Acesso | Tudo em `/api/admin/**` é só `ADMIN`. `/api/campaigns/active` é público. |

### Formato de erro

O mesmo de hoje (`GlobalExceptionHandler`), com um campo novo, `fields`, só nos erros de validação:

```json
{
  "timestamp": "2026-11-27T14:03:11Z",
  "code": "validation_failed",
  "error": "Há campos inválidos.",
  "message": "Há campos inválidos.",
  "fields": [
    { "field": "theme.dark.primary", "message": "Use uma cor no formato #RRGGBB." },
    { "field": "collections[0].slug", "message": "Já existe outra coleção com este identificador." }
  ]
}
```

`field` usa o caminho do JSON (com `[índice]` em listas), para o painel mostrar a mensagem junto do campo certo (T31). As regras de campo vêm todas juntas; já um valor com tipo errado ou fora de um enum interrompe a leitura, e `fields` traz só o primeiro.

| `code` | Status | Quando |
|---|---|---|
| `validation_failed` | 400 | Algum campo inválido (ver `fields`). |
| `invalid_data` | 400 | O corpo não é um JSON válido. |
| `discount_not_supported` | 400 | Desconto enviado antes da segunda etapa (ver §4.5). |
| `not_found` | 404 | Campanha inexistente (ou arquivada, nas rotas que não as aceitam). |
| `version_required` | 428 | Faltou `version`. |
| `version_conflict` | 409 | Outra pessoa alterou a campanha. O painel recarrega; nunca sobrescreve. |
| `invalid_transition` | 409 | Ação não permitida no estado atual (ex.: publicar uma arquivada). |
| `campaign_conflict` | 409 | Período sobreposto com outra campanha publicada de mesma prioridade. Traz `conflictingCampaign: { id, name, startsAt, endsAt }`. |
| `publish_requirements` | 422 | Faltam campos obrigatórios para publicar (ver §6). Usa `fields`. |
| `reauth_required` | 403 | Ação 🔐 sem `X-Reauth` válido. |
| `idempotency_key_required` | 400 | `POST` de criação sem `Idempotency-Key`. |
| `idempotency_key_reused` | 422 | Mesma `Idempotency-Key` com outro corpo. O front gera uma chave nova por ação (`createIdempotencyKeys`). |

## 2. Enums

**`CampaignType`**: `BLACK_FRIDAY`, `CHRISTMAS` (Natal), `EASTER` (Páscoa), `VALENTINES_DAY` (Namorados), `MOTHERS_DAY`, `FATHERS_DAY`, `CONSUMER_DAY` (Dia do Consumidor), `STORE_ANNIVERSARY`, `CUSTOM`.

**`CampaignStatus`**: o que o admin decidiu; é o único estado gravado no banco.
`DRAFT` · `PUBLISHED` · `DISABLED` · `ARCHIVED`

**`CampaignPhase`**: calculada pela API a cada leitura, só para `PUBLISHED` (nas demais vem `null`):
`SCHEDULED` (antes do início) · `ACTIVE` (dentro do período) · `EXPIRED` (depois do fim)

O início é inclusivo e o fim é exclusivo: ativa quando `startsAt <= agora < endsAt`.

**`DecorationType`**: catálogo fechado (T25), sem CSS ou script livre:
`SNOW`, `SPARKLES`, `HEARTS`, `RIBBONS`, `CONFETTI`, `STARS`

**`ButtonStyle`**: `PRIMARY`, `SECONDARY`

## 3. Tipos básicos

### `Color`
Texto `#RRGGBB` (6 dígitos hexadecimais, sem transparência). Regex: `^#[0-9A-Fa-f]{6}$`.

### `Link`
Texto de até 300 caracteres, de um destes tipos:
- caminho interno: começa com `/` e não com `//` (ex.: `/?colecao=ofertas`, `/#colecao`);
- endereço externo: começa com `https://`.

Qualquer outra coisa é rejeitada (`javascript:`, `data:`, `http://`, `//site.com`, espaços, quebras de linha). Também são rejeitados `\`, `<`, `>`, caracteres invisíveis e endereço `https://` sem servidor ou com `usuario@`.

### `Image`
```json
{ "url": "https://res.cloudinary.com/<cloud>/image/upload/v1/campaigns/banner.webp", "alt": "Frascos com laço vermelho", "width": 1920, "height": 640 }
```
| Campo | Regra |
|---|---|
| `url` | Obrigatório, até 500 caracteres. Só arquivos enviados ao Cloudinary do projeto: `https://res.cloudinary.com/<CLOUDINARY_NAME>/image/upload/` (`/image/fetch/` é recusado, assim como `..` no caminho). |
| `alt` | Obrigatório, 1 a 150 caracteres. |
| `width`, `height` | Inteiros > 0, ou `null`. Usados para reservar espaço e não deslocar o layout (T23). O upload de banners (T15) passa a devolvê-los. |

## 4. Objetos da campanha

### 4.1 `theme`
```json
{
  "dark": {
    "background": "#0B0B0F",
    "foreground": "#F5F1E8",
    "primary": "#C1121F",
    "primaryForeground": "#FFFFFF",
    "accent": "#1F1F27",
    "surface": null,
    "mutedForeground": null,
    "border": null,
    "badge": "#C1121F",
    "badgeForeground": "#FFFFFF",
    "gold": null
  },
  "light": null
}
```
- `dark` é obrigatório; `light` é opcional (`null` → a loja usa o tema claro padrão no modo claro). Decisão T02.
- Em cada paleta, **obrigatórios**: `background`, `foreground`, `primary`, `primaryForeground`, `accent`. **Opcionais** (`null` → valor padrão da loja): `surface`, `mutedForeground`, `border`, `badge`, `badgeForeground`, `gold`.
- `gold`: `null` mantém o dourado da marca; se informado, `{ "hi", "mid", "lo", "deep" }`, todos `Color`.

Correspondência com as CSS Variables de `src/index.css` (aplicadas pelo módulo da T18):

| Campo | Variáveis |
|---|---|
| `background` | `--background` |
| `foreground` | `--foreground`, `--card-foreground`, `--popover-foreground` |
| `surface` | `--card`, `--popover` |
| `primary` / `primaryForeground` | `--primary` / `--primary-foreground`, `--ring` |
| `accent` | `--accent`, `--secondary`, `--muted` |
| `mutedForeground` | `--muted-foreground` |
| `border` | `--border`, `--input` |
| `badge` / `badgeForeground` | `--campaign-badge` / `--campaign-badge-foreground` (tokens novos, T19) |
| `gold.*` | `--gold-hi`, `--gold-mid`, `--gold-lo`, `--gold-deep` |

### 4.2 `content`
```json
{
  "topBar": { "text": "Black Friday: até 40% em perfumes selecionados", "link": "/?colecao=ofertas" },
  "hero": {
    "title": "Black Friday Fausto",
    "subtitle": "Os importados mais desejados com condições especiais.",
    "imageDesktop": { "url": "...", "alt": "...", "width": 1920, "height": 640 },
    "imageMobile": null,
    "buttons": [
      { "label": "Ver ofertas", "link": "/?colecao=ofertas", "style": "PRIMARY" }
    ]
  },
  "promoImages": [
    { "image": { "url": "...", "alt": "...", "width": 800, "height": 800 }, "link": "/?colecao=mais-vendidos" }
  ],
  "decorations": ["SPARKLES"]
}
```
| Campo | Regra |
|---|---|
| `topBar` | `null` → mantém a faixa atual da loja. `text`: 1 a 120. `link`: `Link` ou `null`. |
| `hero` | `null` → mantém o hero atual. `title`: 1 a 80 (vira o único `h1`). `subtitle`: até 160 ou `null`. `imageDesktop`: `Image` obrigatória. `imageMobile`: `Image` ou `null` (usa a desktop). `buttons`: 0 a 2. |
| `buttons[]` | `label`: 1 a 30. `link`: `Link`. `style`: `ButtonStyle`. |
| `promoImages` | 0 a 6 itens. `link`: `Link` ou `null`. |
| `decorations` | 0 a 3 valores de `DecorationType`, sem repetição. |

### 4.3 `collections`
```json
[
  {
    "id": "8c1d…",
    "title": "Ofertas Black Friday",
    "slug": "ofertas",
    "position": 0,
    "products": [
      { "productId": "3f2a…", "position": 0, "discount": null },
      { "productId": "9b7e…", "position": 1, "discount": null }
    ]
  }
]
```
| Campo | Regra |
|---|---|
| lista | 0 a 8 coleções. |
| `id` | Gerado pela API. Ao salvar, coleção sem `id` é nova; coleção existente que não vier na lista é removida. |
| `title` | 1 a 60. |
| `slug` | Identificador do link `/?colecao=<slug>`. 1 a 40, regex `^[a-z0-9]+(-[a-z0-9]+)*$`, único dentro da campanha. |
| `position` | Ordem de exibição, 0 em diante. A API renumera em sequência ao salvar. |
| `products` | 0 a 60 itens. `productId` precisa existir e não pode repetir na mesma coleção. Produto desativado é aceito, mas a resposta pública o omite. |
| `discount` | Reservado para a segunda etapa (§4.5). Na primeira versão, sempre `null`. |

Produtos aparecem só como ID: a loja cruza com o catálogo que já carregou (T24), sem requisição por produto.

### 4.4 Dados gerais
| Campo | Regra |
|---|---|
| `name` | 3 a 80. Interno (painel); não vai para a resposta pública. |
| `description` | Até 500 ou `null`. Interno. |
| `type` | `CampaignType`. |
| `priority` | Inteiro de 0 a 100. Padrão 0. Maior vence (T02). |
| `startsAt`, `endsAt` | Datas (§1). `endsAt` > `startsAt`; duração máxima de 120 dias. Podem ser `null` em rascunho. |

### 4.5 Desconto (reservado: segunda etapa, T42/T43)
```json
{ "type": "PERCENT", "value": 20 }
```
- `type`: `PERCENT` (`value` inteiro de 1 a 90) ou `FIXED` (`value` em reais, com 2 casas, maior que zero e menor que o preço).
- Vale por produto (`collections[].products[].discount`). Desconto por coleção inteira e as regras de acúmulo ficam para a T42.
- **Primeira versão:** a API recusa qualquer `discount` diferente de `null` com `400 discount_not_supported`. Recusar em vez de ignorar evita que o admin ache que o desconto foi aplicado.
- O preço promocional nunca altera `price` nem `originalPrice` do produto; na segunda etapa a resposta pública ganha o preço calculado pela API.

## 5. Representações

### 5.1 `CampaignInput`: corpo de criar e editar
```json
{
  "name": "Black Friday 2026",
  "description": null,
  "type": "BLACK_FRIDAY",
  "priority": 10,
  "startsAt": "2026-11-27T03:00:00Z",
  "endsAt": "2026-12-01T03:00:00Z",
  "theme": { "dark": { … }, "light": null },
  "content": { … },
  "collections": [ … ],
  "version": 3
}
```
- A edição substitui o documento inteiro (campos, tema, conteúdo e coleções) numa única operação. Assim uma `version` protege tudo e não existe meio-salvamento.
- `version` não vai na criação.
- Rascunho aceita campos incompletos (§6), mas os que vierem precisam ser válidos.

### 5.2 `CampaignDetail`: resposta do painel
Tudo de `CampaignInput`, mais:
```json
{
  "id": "5e0c…",
  "status": "PUBLISHED",
  "phase": "SCHEDULED",
  "version": 4,
  "createdAt": "…", "updatedAt": "…",
  "createdBy": "admin@fausto.com", "updatedBy": "admin@fausto.com",
  "publishedAt": "…"
}
```

### 5.3 `CampaignSummary`: item da listagem
```json
{
  "id": "5e0c…", "name": "Black Friday 2026", "type": "BLACK_FRIDAY",
  "status": "PUBLISHED", "phase": "ACTIVE", "priority": 10,
  "startsAt": "…", "endsAt": "…", "updatedAt": "…", "updatedBy": "admin@fausto.com",
  "collectionCount": 2, "version": 4
}
```

### 5.4 `PublicCampaign`: o que a loja recebe
Só o necessário para exibir. Nunca leva `name`, `description`, `priority`, autores nem rascunhos.
```json
{
  "id": "5e0c…",
  "type": "BLACK_FRIDAY",
  "startsAt": "…",
  "endsAt": "…",
  "updatedAt": "…",
  "theme": { … },
  "content": { … },
  "collections": [
    { "title": "Ofertas Black Friday", "slug": "ofertas", "position": 0, "productIds": ["3f2a…", "9b7e…"] }
  ]
}
```
`productIds` já vem na ordem certa e sem produtos desativados.

## 6. Requisitos para publicar

`publish`, `activate-now` e `reactivate` exigem (senão `422 publish_requirements`):
- `name`, `type`, `startsAt`, `endsAt`;
- `theme.dark` com os campos obrigatórios;
- `endsAt` no futuro;
- se houver `hero`, a `imageDesktop`.

Em `theme` e `content`, só o que está nesta lista pode faltar num rascunho. Os demais campos obrigatórios valem sempre que o objeto que os contém vier: por exemplo, `hero.title`, `topBar.text`, os quatro tons de `gold` e os cinco campos obrigatórios de `theme.light`.

## 7. Endpoints

### 7.1 Público

#### `GET /api/campaigns/active`
Sem autenticação. Responde sempre `200`:
```json
{
  "serverTime": "2026-11-27T14:00:00Z",
  "nextChangeAt": "2026-12-01T03:00:00Z",
  "campaign": { …PublicCampaign… }
}
```
- Qual aparece: entre as publicadas no período (`ACTIVE`), a de maior `priority`. Um empate (que a T08 impede) é resolvido sempre da mesma forma: início mais recente, depois a criada por último, depois o menor `id`.
- `campaign: null` → nenhuma ativa; a loja usa o tema padrão.
- `serverTime`: o front compara com o relógio local, para não confiar num computador com a hora errada (T17).
- `nextChangeAt`: próximo instante em que a resposta muda sozinha (fim da ativa ou início da próxima agendada que passaria a vencer); `null` se nada estiver previsto. O front agenda a nova consulta para esse instante.
- Cabeçalhos (T13): `Cache-Control: public, max-age=60`, `ETag`; `If-None-Match` igual → `304`.

### 7.2 Painel (`/api/admin/campaigns`, só `ADMIN`)

| Método e rota | O que faz | Corpo | Resposta | 🔐 |
|---|---|---|---|---|
| `GET /api/admin/campaigns` | Lista com filtros | — | `PagedModel<CampaignSummary>` | |
| `GET /api/admin/campaigns/{id}` | Detalhe | — | `CampaignDetail` | |
| `POST /api/admin/campaigns` | Cria rascunho (`Idempotency-Key`) | `CampaignInput` | `201 CampaignDetail` | |
| `PUT /api/admin/campaigns/{id}` | Edita | `CampaignInput` | `CampaignDetail` | 🔐 se `PUBLISHED` |
| `POST /api/admin/campaigns/{id}/publish` | Rascunho → publicada | `{ "version" }` | `CampaignDetail` | 🔐 |
| `POST /api/admin/campaigns/{id}/activate-now` | Publica (se rascunho) e antecipa `startsAt` para agora | `{ "version" }` | `CampaignDetail` | 🔐 |
| `POST /api/admin/campaigns/{id}/disable` | Tira do ar | `{ "version" }` | `CampaignDetail` | |
| `POST /api/admin/campaigns/{id}/reactivate` | Desativada → publicada | `{ "version" }` | `CampaignDetail` | 🔐 |
| `POST /api/admin/campaigns/{id}/duplicate` | Cópia como rascunho, sem datas (`Idempotency-Key`) | — | `201 CampaignDetail` | |
| `POST /api/admin/campaigns/{id}/archive` | Arquiva | `{ "version" }` | `CampaignDetail` | 🔐 |
| `DELETE /api/admin/campaigns/{id}?version=N` | Exclui | — | `204` | 🔐 |
| `GET /api/admin/campaigns/{id}/preview` | Prévia, qualquer status (T33) | — | mesmo formato de `/api/campaigns/active`, com `campaign` preenchida | |
| `GET /api/admin/campaigns/{id}/history` | Histórico (T34) | — | `PagedModel` no formato de `/api/admin/audit` | |

Filtros da listagem: `status`, `phase`, `type` (cada um aceita vários, separados por vírgula), `from` e `to` (campanhas cujo período cruza o intervalo), `q` (busca no nome), `page`, `size`. Ordem: `startsAt` decrescente, rascunhos sem data primeiro.

### 7.3 Transições permitidas

| De ↓ / ação → | `publish` | `activate-now` | `disable` | `reactivate` | `archive` | `DELETE` | `PUT` |
|---|---|---|---|---|---|---|---|
| `DRAFT` | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |
| `PUBLISHED` · `SCHEDULED` | — | ✅ | ✅ | — | — | — | ✅ 🔐 |
| `PUBLISHED` · `ACTIVE` | — | — | ✅ | — | — | — | ✅ 🔐 |
| `PUBLISHED` · `EXPIRED` | — | — | — | — | ✅ | — | — |
| `DISABLED` | — | — | — | ✅ | ✅ | — | ✅ |
| `ARCHIVED` | — | — | — | — | — | — | — |

- Fora da tabela → `409 invalid_transition`.
- `DELETE` só para rascunhos: o que já foi ao ar é arquivado, para não perder o histórico.
- Campanha expirada não é editada; para repetir no ano seguinte, duplique.
- Conflito de período (`409 campaign_conflict`) é verificado em `publish`, `activate-now`, `reactivate` e no `PUT` de campanha publicada.

### 7.4 Upload de banners (T15)
`POST /api/upload?folder=campaigns` (multipart, campo `file`). JPEG, PNG ou WebP, até 5 MB; SVG é recusado. Resposta: `{ "url", "width", "height" }`. O upload de produtos continua igual.

## 8. Impacto no front
- `/api/admin/campaigns` entra em `ADMIN_ONLY_MARKERS` (`src/build.test.ts`): nenhuma dessas chamadas pode ir no bundle público, nem a da prévia.
- Os tipos TypeScript (T16) nascem deste documento; a resposta de `/api/campaigns/active` é validada antes do uso e, se vier malformada, a loja fica no tema padrão.

## 9. Decisões e observações
- **Limites** (tamanhos de texto, 8 coleções, 60 produtos por coleção, 120 dias, 5 MB): aprovados como estão.
- **`discount` na primeira versão:** recusado com `400 discount_not_supported`, em vez de ignorado.
- **Para a T09:** o `PUT` exige 🔐 só quando a campanha está `PUBLISHED`. Como `@RequiresReauth` é fixo por rota, a API precisa fazer essa verificação dentro do serviço.
