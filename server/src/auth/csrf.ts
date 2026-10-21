import { doubleCsrf } from "csrf-csrf";
import { baseCookieOptions, csrfCookieName } from "./session.js";

// Protección CSRF de doble envío firmado: el token va en una cookie httpOnly y
// en la cabecera X-CSRF-Token, firmado con HMAC y atado al id de la sesión.
// Complementa a SameSite=Strict y a la comprobación de Origin.
export function createCsrf(config: { secret: string; secureCookies: boolean }) {
  return doubleCsrf({
    getSecret: () => config.secret,
    getSessionIdentifier: (req) => req.sessionId ?? "",
    cookieName: csrfCookieName(config.secureCookies),
    cookieOptions: baseCookieOptions(config.secureCookies),
    getCsrfTokenFromRequest: (req) => req.get("x-csrf-token"),
    errorConfig: { statusCode: 403, code: "EBADCSRFTOKEN" },
  });
}

export type Csrf = ReturnType<typeof createCsrf>;
