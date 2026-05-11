import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!config.mail.smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.smtpHost,
      port: config.mail.smtpPort,
      secure: config.mail.smtpSecure,
      auth:
        config.mail.smtpUser && config.mail.smtpPass
          ? { user: config.mail.smtpUser, pass: config.mail.smtpPass }
          : undefined,
    });
  }
  return transporter;
}

/**
 * Sends login OTP when SMTP is configured (SMTP_HOST + MAIL_FROM).
 * Returns false if mail is not configured or send fails (caller should rely on logs / EXPOSE_LOGIN_OTP).
 */
export async function sendLoginOtpEmail(
  to: string,
  otp: string,
  expiresMinutes: number
): Promise<boolean> {
  const from = config.mail.from;
  if (!config.mail.smtpHost || !from) {
    return false;
  }

  const transport = getTransporter();
  if (!transport) return false;

  try {
    await transport.sendMail({
      from,
      to,
      subject: 'Your URIMPACT sign-in code',
      text: `Your URIMPACT verification code is: ${otp}\n\nIt expires in ${expiresMinutes} minutes. If you did not try to sign in, ignore this email.`,
      html: `<p>Your URIMPACT verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code expires in <strong>${expiresMinutes}</strong> minutes.</p><p>If you did not try to sign in, ignore this email.</p>`,
    });
    logger.info(`Login OTP email sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('sendLoginOtpEmail failed:', err);
    return false;
  }
}
