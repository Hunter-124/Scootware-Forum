import nodemailer from "nodemailer";
import { logger } from "./logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const fromAddress = `${process.env.SMTP_FROM_NAME || "Scootware"} <${process.env.SMTP_FROM || "noreply@scootware.com"}>`;
const siteUrl = process.env.SITE_URL || "http://localhost:80";

export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${siteUrl}/api/auth/verify-email?token=${token}`;
  try {
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: "Verify your Scootware account",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#7c3aed">Welcome to Scootware!</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verifyUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
            Verify Email
          </a>
          <p style="color:#666;margin-top:16px">Or paste this link in your browser: ${verifyUrl}</p>
          <p style="color:#999;font-size:12px">This link expires in 24 hours.</p>
        </div>
      `,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send verification email");
  }
}
