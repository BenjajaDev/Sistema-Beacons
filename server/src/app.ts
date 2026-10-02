import cookieParser from "cookie-parser";
import express from "express";
import { pinoHttp } from "pino-http";
import { createCsrf } from "./auth/csrf.js";
import { createSessionService } from "./auth/session.js";
import type { BeaconReader } from "./beacons/store.js";
import type { ServerEnv } from "./config/env.js";
import { ApiError, errorHandler } from "./http/errors.js";
import { corsPolicy, originCheck, securityHeaders } from "./http/security.js";
import type { Logger } from "./lib/logger.js";
import type { Db } from "./lib/prisma.js";
import { adminPanel } from "./routes/admin-panel.js";
import { adminApi } from "./routes/admin/index.js";
import { legacyBeaconsRouter } from "./routes/legacy-beacons.js";
import { createAudit } from "./services/audit.js";

export interface AppDeps {
  env: ServerEnv;
  logger: Logger;
  db: Db;
  beacons: { primary: BeaconReader; fallback: BeaconReader };
  // Comprueba la base de datos para /api/health. Lanza si no responde.
  pingDb: () => Promise<void>;
}

export function createApp(deps: AppDeps) {
  const { env, logger, db } = deps;
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy);

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      // Nunca se registra la ruta oculta del panel en los logs de acceso.
      serializers: {
        req: (req: { method: string; url: string }) => ({
          method: req.method,
          url: req.url.replace(`/${env.ADMIN_PATH}`, "/<panel>"),
        }),
      },
    }),
  );
  app.use(securityHeaders(env));
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));

  // --- App Android (contrato histórico) ---
  app.use(legacyBeaconsRouter({ ...deps.beacons, logger }));

  // --- API ---
  app.use("/api", corsPolicy(env), originCheck(env));

  app.get("/api/health", async (_req, res) => {
    try {
      await deps.pingDb();
      res.json({ ok: true, db: "ok" });
    } catch {
      res.status(503).json({ ok: false, db: "sin conexión" });
    }
  });

  const sessions = createSessionService({
    jwtSecret: env.JWT_SECRET,
    ttlHours: env.SESSION_TTL_HOURS,
    secureCookies: env.COOKIE_SECURE,
  });
  const csrf = createCsrf({ secret: env.CSRF_SECRET, secureCookies: env.COOKIE_SECURE });
  const admin = adminApi({ db, env, logger, sessions, csrf, audit: createAudit(db, logger) });
  app.use("/api/admin", admin.router);
  // Expuesta para el test que recorre todas las rutas y verifica 401/403.
  app.locals.adminRoutes = admin.routes;

  // --- Panel (ruta oculta) ---
  app.use(adminPanel({ adminPath: env.ADMIN_PATH, distDir: env.adminDistDir }));

  // Cualquier otra ruta: 404, nunca una redirección al login.
  app.use(() => {
    throw new ApiError(404, "NOT_FOUND", "No encontrado");
  });
  app.use(errorHandler(logger));

  return app;
}
