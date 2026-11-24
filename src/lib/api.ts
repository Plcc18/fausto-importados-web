export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Base das rotas `/auth/*` (login, refresh, logout).
 *
 * Em produção o front fica na Vercel e a API no Render — sites diferentes, onde o cookie de refresh
 * (`SameSite=Strict`) não seria enviado. Por isso a Vercel faz proxy de `/auth/*` (ver vercel.json) e,
 * com `VITE_AUTH_SAME_ORIGIN=true`, essas chamadas vão para a própria origem do front ("").
 * Em desenvolvimento (localhost:5173 → localhost:8080, mesmo site) chama a API direto.
 *
 * As demais rotas (`/api/*`) continuam indo direto para `API_URL`, autenticadas por `Authorization: Bearer`.
 */
export const AUTH_URL: string =
  import.meta.env.VITE_AUTH_SAME_ORIGIN === 'true' ? '' : API_URL;

// `authFetch` (requisições autenticadas, com renovação automática do token) vive em "@/lib/auth".
