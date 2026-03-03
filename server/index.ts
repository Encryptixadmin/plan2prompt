import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { providerValidationService } from "./services/ai/provider-validation.service";
import { migrateFilesystemArtifacts } from "./services/artifact.service";
import { logger } from "./logger";
import { pool } from "./db";
import * as Sentry from "@sentry/node";
import helmet from "helmet";
import crypto from "crypto";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.2,
  });
  logger.info("Sentry initialized");
}

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise: String(promise) }, "Unhandled promise rejection");
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  }
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception — process will exit");
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
    Sentry.flush(2000).finally(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
    requestId: string;
  }
}

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    hsts: process.env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);

app.use((req, _res, next) => {
  req.requestId = req.headers["x-request-id"] as string || crypto.randomUUID();
  next();
});

app.use((_req, res, next) => {
  const requestId = (_req as any).requestId;
  if (requestId) {
    res.setHeader("X-Request-Id", requestId);
  }
  next();
});

app.use((req, res, next) => {
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    req.path.startsWith("/api/") &&
    req.path !== "/api/health" &&
    !req.headers["content-type"]?.includes("application/json") &&
    !req.headers["content-type"]?.includes("multipart/form-data")
  ) {
    return res.status(415).json({
      success: false,
      error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json" },
    });
  }
  next();
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const requestId = req.requestId;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logger.info(
        {
          requestId,
          method: req.method,
          path,
          status: res.statusCode,
          durationMs: duration,
          ...(capturedJsonResponse && { responseBody: capturedJsonResponse }),
        },
        `${req.method} ${path} ${res.statusCode} in ${duration}ms`
      );
    }
  });

  next();
});

(async () => {
  // Validate AI providers at startup
  await providerValidationService.validateAllProvidersAtStartup();

  // Migrate any existing filesystem artifacts to the database
  await migrateFilesystemArtifacts();
  
  // Setup Replit Auth BEFORE registering other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  
  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (status >= 500) {
      logger.error({ err, requestId: req.requestId, method: req.method, url: req.url, status }, "Unhandled server error");
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
      }
    }

    res.status(status).json({ success: false, error: { code: "INTERNAL_ERROR", message } });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully...");

    const forceTimeout = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000);

    try {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info("HTTP server closed");

      await pool.end();
      logger.info("Database pool drained");

      if (process.env.SENTRY_DSN) {
        await Sentry.flush(2000);
      }
    } catch (err) {
      logger.error({ err }, "Error during graceful shutdown");
    } finally {
      clearTimeout(forceTimeout);
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
