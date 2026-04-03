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

export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const verifyUrl = `${siteUrl}/api/auth/verify-email?token=${token}`;
  try {
    logger.info({ to, siteUrl }, "Attempting to send verification email");
    logger.debug({ smtpHost: process.env.SMTP_HOST, smtpUser: process.env.SMTP_USER, fromAddress }, "SMTP Configuration");
    
    const result = await transporter.sendMail({
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
    
    logger.info({ to, result }, "Verification email sent successfully");
    return true;
  } catch (err) {
    logger.error({ err, to, smtpHost: process.env.SMTP_HOST }, "Failed to send verification email");
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  try {
    logger.info({ to }, "Attempting to send password reset email");
    logger.debug({ smtpHost: process.env.SMTP_HOST, smtpUser: process.env.SMTP_USER, fromAddress }, "SMTP Configuration");
    
    const result = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: "Reset your Scootware password",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#7c3aed">Password Reset Request</h2>
          <p>We received a request to reset your Scootware password. Click the button below to create a new password:</p>
          <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
            Reset Password
          </a>
          <p style="color:#666;margin-top:16px">Or paste this link in your browser: ${resetUrl}</p>
          <p style="color:#999;font-size:12px">This link expires in 1 hour for security.</p>
          <p style="color:#999;font-size:12px">If you didn't request this, you can safely ignore this email. Your password remains unchanged.</p>
        </div>
      `,
    });
    
    logger.info({ to, result }, "Password reset email sent successfully");
    return true;
  } catch (err) {
    logger.error({ err, to, smtpHost: process.env.SMTP_HOST }, "Failed to send password reset email");
    return false;
  }
}
