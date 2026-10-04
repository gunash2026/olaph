import nodemailer from "nodemailer";
import { config } from "./config.js";
const mail = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: config.SMTP_USER
    ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
    : undefined,
});
export async function sendMail(to: string, subject: string, text: string) {
  await mail.sendMail({
    from: config.MAIL_FROM,
    to,
    subject,
    text,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
