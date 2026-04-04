import nodemailer from "nodemailer";
import { logger } from "./logger";
import { db, siteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

// ──────────────────────────────────────────────────────────────
// Email Template System with Variable Substitution
// ──────────────────────────────────────────────────────────────

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

/**
 * Fetch email template from database with fallback to defaults
 */
export async function getEmailTemplate(templateKey: string): Promise<EmailTemplate> {
  try {
    const rows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, templateKey)).limit(1);
    if (rows.length > 0) {
      const parsed = JSON.parse(rows[0].value);
      return {
        subject: parsed.subject || getDefaultEmailTemplate(templateKey).subject,
        html: parsed.html || getDefaultEmailTemplate(templateKey).html,
        text: parsed.text,
      };
    }
  } catch (err) {
    logger.warn({ err, templateKey }, "Failed to parse email template, using defaults");
  }
  return getDefaultEmailTemplate(templateKey);
}

/**
 * Get default email templates if not customized
 */
function getDefaultEmailTemplate(templateKey: string): EmailTemplate {
  const defaults: Record<string, EmailTemplate> = {
    purchase_confirmation: {
      subject: "🎉 Purchase Confirmed - Welcome to ~product~!",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
          <div style="background:#7c3aed;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center">
            <h1 style="margin:0;font-size:24px">Purchase Confirmed!</h1>
          </div>
          <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none">
            <p>Hi <strong>~username~</strong>,</p>
            <p>Thank you for your purchase! Your access to <strong>~product~</strong> is now active.</p>
            
            <div style="background:#fff;padding:15px;border:1px solid #e5e7eb;border-radius:6px;margin:15px 0">
              <p style="margin:5px 0"><strong>Order Details:</strong></p>
              <p style="margin:5px 0">Product: ~product~</p>
              <p style="margin:5px 0">Payment Method: ~method~</p>
              <p style="margin:5px 0">Transaction ID: ~transaction_id~</p>
              <p style="margin:5px 0">Access Until: ~expiry_date~</p>
            </div>
            
            <p><strong>What's next?</strong></p>
            <ul>
              <li>Log in to your account to view your subscription</li>
              <li>Download the loader from your dashboard</li>
              <li>Join our private forum for exclusive content</li>
            </ul>
            
            <p style="color:#666;font-size:13px">If you have any questions, please contact our support team.</p>
          </div>
          <div style="background:#f3f4f6;padding:15px;text-align:center;font-size:12px;color:#666;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            © 2026 Scootware. All rights reserved.
          </div>
        </div>
      `,
    },
  };
  return defaults[templateKey] || defaults.purchase_confirmation;
}

/**
 * Substitute template variables with actual values
 */
export function substituteTemplateVariables(
  template: string,
  variables: Record<string, string | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    if (value) {
      result = result.replace(new RegExp(`~${key}~`, "g"), value);
    }
  }
  return result;
}

/**
 * Send purchase confirmation email with customizable template
 */
export async function sendPurchaseConfirmationEmail(
  to: string,
  username: string,
  productNames: string[],
  method: "crypto" | "stripe" | "paypal",
  transactionId: string,
  expiryDate: Date
): Promise<boolean> {
  try {
    logger.info({ to, productNames, method }, "Attempting to send purchase confirmation email");

    const template = await getEmailTemplate("purchase_confirmation");
    const productLabel = productNames.join(", ");

    const variables = {
      username,
      product: productLabel,
      method: method.toUpperCase(),
      transaction_id: transactionId,
      expiry_date: expiryDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };

    const subject = substituteTemplateVariables(template.subject, variables);
    const html = substituteTemplateVariables(template.html, variables);

    const result = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text: template.text ? substituteTemplateVariables(template.text, variables) : undefined,
    });

    logger.info({ to, productNames, result }, "Purchase confirmation email sent successfully");
    return true;
  } catch (err) {
    logger.error(
      { err, to, productNames, method: method },
      "Failed to send purchase confirmation email"
    );
    return false;
  }
}
