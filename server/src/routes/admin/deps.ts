import type { Csrf } from "../../auth/csrf.js";
import type { SessionService } from "../../auth/session.js";
import type { ServerEnv } from "../../config/env.js";
import type { Logger } from "../../lib/logger.js";
import type { Db } from "../../lib/prisma.js";
import type { Audit } from "../../services/audit.js";
import type { MediaStorage } from "../../services/media-storage.js";

export interface AdminDeps {
  db: Db;
  env: ServerEnv;
  logger: Logger;
  sessions: SessionService;
  csrf: Csrf;
  audit: Audit;
  storage: MediaStorage;
  // Se llama tras crear, editar o borrar beacons (actualiza el snapshot local).
  onBeaconsChanged: () => Promise<void>;
}
