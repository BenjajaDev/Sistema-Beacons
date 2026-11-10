import { handleRequest, type EdgeEnv } from "../apps/edge/src/proxy.ts";

// Cloudflare Pages ejecuta esta Function en todas las rutas. La lógica y sus
// pruebas están en apps/edge.
export const onRequest: PagesFunction<EdgeEnv> = (context) =>
  handleRequest(context.request, context.env);
