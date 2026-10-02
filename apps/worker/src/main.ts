// Deliberately fail closed: email, AI and supplier actions need explicit adapters.
// Do not attach a consumer that acknowledges work without performing it.
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
  console.error("Worker adapters are not configured. No jobs were consumed.");
  process.exitCode = 1;
}
