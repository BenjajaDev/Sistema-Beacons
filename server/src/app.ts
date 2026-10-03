import compression from "compression";
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
import { landing } from "./routes/landing.js";
import { legacyBeaconsRouter } from "./routes/legacy-beacons.js";
import { writeBeaconSnapshot } from "./beacons/snapshot.js";
import { themeCss } from "./content/theme.js";
import { publicApi } from "./routes/public.js";
import { createAudit } from "./services/audit.js";
import { createMediaStorage, type MediaStorage } from "./services/media-storage.js";

export interface AppDeps {
  env: ServerEnv;
  logger: Logger;
  db: Db;
  beacons: { primary: BeaconReader; fallback: BeaconReader };
  // Comprueba la base de datos para /api/health. Lanza si no responde.
  pingDb: () => Promise<void>;
  // Por defecto, según STORAGE_DRIVER. Los tests pueden inyectar otro.
  storage?: MediaStorage;
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
        // Solo el código: las cabeceras de respuesta incluyen Set-Cookie con el JWT
        // de sesión, que no debe quedar en los logs.
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(securityHeaders(env));
  // gzip/brotli para HTML, JS, CSS y JSON: el bundle baja de ~360 KB a ~115 KB.
  app.use(compression());
  app.use(cookieParser());
  // 1 MB: una noticia larga, en el JSON del editor, puede pasar de 100 KB.
  app.use(express.json({ limit: "1mb" }));

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
  app.use("/api/public", publicApi({ db, logger }));

  const admin = adminApi({
    db,
    env,
    logger,
    sessions,
    csrf,
    audit: createAudit(db, logger),
    storage: deps.storage ?? createMediaStorage(env),
    onBeaconsChanged: async () => {
      try {
        await writeBeaconSnapshot(db, env.beaconSnapshotPath);
      } catch (err) {
        logger.error({ err }, "No se pudo actualizar el snapshot de beacons");
      }
    },
  });
  app.use("/api/admin", admin.router);
  // Expuesta para el test que recorre todas las rutas y verifica 401/403.
  app.locals.adminRoutes = admin.routes;

  // --- Imágenes subidas (solo con almacenamiento local) ---
  if (env.STORAGE_DRIVER === "local") {
    app.use(
      "/uploads",
      express.static(env.uploadDir, {
        index: false,
        dotfiles: "deny",
        immutable: true,
        maxAge: "365d",
      }),
    );
  }

  // --- Panel (ruta oculta) ---
  // El tema guardado se inyecta en el HTML. Si la base falla, quedan los valores por defecto.
  const getThemeCss = async () => {
    try {
      const s = await db.siteSettings.findUnique({
        where: { id: 1 },
        select: { palette: true, fonts: true },
      });
      return s ? themeCss(s) : null;
    } catch (err) {
      logger.warn({ err }, "No se pudo leer el tema; se usan los colores por defecto");
      return null;
    }
  };
  app.use(adminPanel({ adminPath: env.ADMIN_PATH, distDir: env.adminDistDir, getThemeCss }));

  // --- Landing pública ---
  app.use(
    landing({
      db,
      logger,
      distDir: env.publicDistDir,
      siteUrl: env.SITE_URL,
      cacheHtml: env.isProduction,
      getThemeCss,
    }),
  );

  // Cualquier otra ruta: 404, nunca una redirección al login.
  app.use(() => {
    throw new ApiError(404, "NOT_FOUND", "No encontrado");
  });
  app.use(errorHandler(logger));

  return app;
}
