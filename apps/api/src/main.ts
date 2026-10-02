import "reflect-metadata";
import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
@Controller()
class HealthController {
  @Get("health") health() {
    return {
      service: "olaph-api",
      version: "0.1.0",
      status: "ok",
      businessEndpoints: "disabled",
    };
  }
  @Get("ready") ready() {
    throw new ServiceUnavailableException(
      "Production identity, database and provider checks are not configured.",
    );
  }
}
@Module({ controllers: [HealthController] })
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  app.use(helmet());
  app.enableShutdownHooks();
  await app.listen(
    Number(process.env.PORT || 4000),
    process.env.HOST || "127.0.0.1",
  );
}
void bootstrap();
