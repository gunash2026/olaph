import pg from "pg";
import nodemailer from "nodemailer";
import { Queue, Worker } from "bullmq";
export async function startWorker() {
  for (const key of [
    "WORKER_DATABASE_URL",
    "VALKEY_HOST",
    "VALKEY_PASSWORD",
    "SMTP_HOST",
    "MAIL_FROM",
  ])
    if (!process.env[key]) throw Error(`${key} is required`);
  const db = new pg.Pool({
    connectionString: process.env.WORKER_DATABASE_URL,
    max: 3,
  });
  const privileges = (
    await db.query(
      "SELECT rolsuper,rolbypassrls,has_table_privilege(current_user,'materials','SELECT') AS catalog_access FROM pg_roles WHERE rolname=current_user",
    )
  ).rows[0];
  if (
    !privileges ||
    privileges.rolsuper ||
    privileges.rolbypassrls ||
    privileges.catalog_access
  ) {
    await db.end();
    throw Error("WORKER_ROLE_MUST_BE_RESTRICTED_TO_OUTBOX");
  }
  const connection = {
    host: process.env.VALKEY_HOST,
    port: Number(process.env.VALKEY_PORT || 6379),
    password: process.env.VALKEY_PASSWORD,
    maxRetriesPerRequest: null,
  };
  const queue = new Queue("olaph-outbox", {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    },
  });
  const smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  const worker = new Worker(
    "olaph-outbox",
    async (job) => {
      const row = (
        await db.query(
          "SELECT * FROM outbox WHERE id=$1 AND processed_at IS NULL",
          [job.id],
        )
      ).rows[0];
      if (!row) return;
      if (row.kind !== "email") throw Error("NO_PROVIDER_FOR_JOB_KIND");
      const { to, subject, text } = row.payload as Record<string, string>;
      if (!to || !subject || !text) throw Error("INVALID_EMAIL_JOB");
      try {
        await smtp.sendMail({
          from: process.env.MAIL_FROM,
          to,
          subject,
          text,
          messageId: `<${row.id}@olaph.local>`,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        await db.query(
          "UPDATE outbox SET processed_at=now(),last_error=NULL WHERE id=$1",
          [row.id],
        );
      } catch (error) {
        await db.query(
          "UPDATE outbox SET attempts=attempts+1,last_error=$2 WHERE id=$1",
          [row.id, (error as Error).name],
        );
        throw error;
      }
    },
    { connection, concurrency: 3 },
  );
  worker.on("failed", (job, error) =>
    console.error("Notification delivery failed", {
      id: job?.id,
      type: error.name,
    }),
  );
  let stopping = false;
  const drain = async () => {
    if (stopping) return;
    try {
      const rows = (
        await db.query(
          "UPDATE outbox SET available_at=now()+interval '2 minutes' WHERE id IN(SELECT id FROM outbox WHERE processed_at IS NULL AND attempts<5 AND available_at<=now() ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED) RETURNING id",
        )
      ).rows;
      for (const row of rows) await queue.add("deliver", {}, { jobId: row.id });
    } catch (error) {
      console.error("Outbox dispatch failed", { type: (error as Error).name });
    }
  };
  await drain();
  const timer = setInterval(() => void drain(), 10000);
  const stop = async () => {
    stopping = true;
    clearInterval(timer);
    await worker.close();
    await queue.close();
    await db.end();
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => void stop());
  console.log("Notification worker ready.");
  return { stop };
}
