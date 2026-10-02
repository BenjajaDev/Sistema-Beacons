import type { Csrf } from "../../auth/csrf.js";
import type { SessionService } from "../../auth/session.js";
import type { ServerEnv } from "../../config/env.js";
import type { Logger } from "../../lib/logger.js";
import type { Db } from "../../lib/prisma.js";
import type { Audit } from "../../services/audit.js";

export interface AdminDeps {
  db: Db;
  env: ServerEnv;
  logger: Logger;
  sessions: SessionService;
  csrf: Csrf;
  audit: Audit;
}
