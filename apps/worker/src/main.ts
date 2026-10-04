import { startWorker } from "./processor";
import { Queue } from "bullmq";
export function createNotificationQueue() {
  if (!process.env.VALKEY_HOST) throw Error("VALKEY_HOST is required");
  return new Queue("olaph-notifications", {
    connection: {
      host: process.env.VALKEY_HOST,
      port: Number(process.env.VALKEY_PORT || 6379),
      password: process.env.VALKEY_PASSWORD,
    },
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  });
}
if (require.main === module) {
  void startWorker().catch((error) => {
    console.error("Worker could not start", { type: error.name });
    process.exitCode = 1;
  });
}
