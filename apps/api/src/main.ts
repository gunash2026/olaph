import "reflect-metadata";
import {
  Module,
  Catch,
  HttpException,
  type ExceptionFilter,
  type ArgumentsHost,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { json, type Response, type Request, type NextFunction } from "express";
import { ZodError } from "zod";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { config } from "./config.js";
import { ApiController } from "./controller.js";
import { ImportController } from "./import-controller.js";
import { AiController } from "./ai-controller.js";
import { assertRuntimeRole, authPool, pool } from "./db.js";
@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof ZodError) {
      response.status(400).json({
        message: "VALIDATION_FAILED",
        issues: error.issues.map((x) => ({
          path: x.path,
          message: x.message,
        })),
      });
      return;
    }
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json({ message: error.message });
      return;
    }
    const sql = error as { code?: string; message?: string },
      allowed = [
        "INSUFFICIENT_AVAILABLE_STOCK",
        "RECIPE_CYCLE",
        "WORKSPACE_LIMIT",
        "INVALID_INVITATION",
        "SEAT_LIMIT",
        "REQUEST_NOT_PENDING",
        "STALE_STOCK_COUNT",
        "IDEMPOTENCY_CONFLICT",
        "STOCK_REFERENCE_NOT_FOUND",
      ];
    if (sql.code?.startsWith("23")) {
      response.status(409).json({ message: "CONFLICT_OR_INVALID_REFERENCE" });
      return;
    }
    if (sql.code === "42501") {
      response.status(403).json({ message: "PERMISSION_DENIED" });
      return;
    }
    if (
      [
        "FORBIDDEN",
        "ADMIN_ROLE_PROTECTED",
        "MFA_REQUIRED_FOR_PRIVILEGED_ROLE",
      ].includes(sql.message || "")
    ) {
      response.status(403).json({ message: sql.message });
      return;
    }
    if (allowed.includes(sql.message || "")) {
      response.status(409).json({ message: sql.message });
      return;
    }
    console.error("Request failed", {
      name: (error as Error)?.name,
      code: sql.code,
    });
    response.status(500).json({ message: "REQUEST_FAILED" });
  }
}
@Module({ controllers: [ApiController, ImportController, AiController] })
class AppModule {}
async function bootstrap() {
  await assertRuntimeRole();
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ["error", "warn", "log"],
  });
  app.use(helmet());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== config.APP_URL
    ) {
      res.status(403).json({ message: "ORIGIN_REJECTED" });
      return;
    }
    next();
  });
  app
    .getHttpAdapter()
    .getInstance()
    .all("/api/auth/*path", toNodeHandler(auth));
  app.use(json({ limit: "256kb" }));
  app.useGlobalFilters(new ApiErrors());
  app.enableShutdownHooks();
  await app.listen(config.PORT, config.HOST);
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(
      signal,
      () => void Promise.all([app.close(), pool.end(), authPool.end()]),
    );
}
void bootstrap();
