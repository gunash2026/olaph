import nodemailer from "nodemailer";
import type { EmailAdapter } from "payload";
export const cmsEmail: EmailAdapter = () => ({
  name: "olaph-smtp",
  defaultFromAddress: process.env.CMS_MAIL_FROM || "noreply@localhost",
  defaultFromName: "OLAPH İçerik",
  async sendEmail(message) {
    if (!process.env.SMTP_HOST) throw Error("SMTP_NOT_CONFIGURED");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 1025),
      secure: process.env.SMTP_PORT === "465",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    return transport.sendMail({
      from: process.env.CMS_MAIL_FROM || "OLAPH İçerik <noreply@localhost>",
      to: message.to,
      subject: message.subject,
      text: typeof message.text === "string" ? message.text : undefined,
      html: typeof message.html === "string" ? message.html : undefined,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  },
});
