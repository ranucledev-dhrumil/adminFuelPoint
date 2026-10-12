import { pino } from "pino";
import { env } from "../../config/env.js";

const isDev = env.NODE_ENV === "development";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : isDev ? "debug" : "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "req.body.code",
      "*.password_hash",
      "*.token_hash",
      "*.code_hash",
      "*.qr_token",
    ],
    censor: "[REDACTED]",
  },
  transport:
    isDev && env.NODE_ENV !== "test"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});
