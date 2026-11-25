import { handleAuthProxy } from "../../src/server/authProxy"

// Função de borda da Vercel: repassa /auth/* à API com o IP do visitante (ver src/server/authProxy.ts)
export const config = { runtime: "edge" }

export default function handler(request: Request): Promise<Response> {
  return handleAuthProxy(request, {
    API_ORIGIN: process.env.API_ORIGIN,
    PROXY_SHARED_SECRET: process.env.PROXY_SHARED_SECRET,
  })
}
