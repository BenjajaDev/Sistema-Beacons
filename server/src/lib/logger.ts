import { pino } from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Nunca se registran credenciales ni cookies de sesión.
  redact: [
    "req.headers.cookie",
    "req.headers.authorization",
    'res.headers["set-cookie"]',
    "*.password",
    "*.passwordHash",
  ],
});

export type Logger = typeof logger;
