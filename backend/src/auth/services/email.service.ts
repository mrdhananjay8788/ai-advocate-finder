import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendEmailOtpResult {
  sent: boolean;
  mockDelivered?: boolean;
  reason?: string;
  messageId?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.MAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.MAIL_PORT || '587', 10);
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASSWORD;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      this.isConfigured = true;
      this.logger.log(`SMTP Email transporter initialized with host: ${host}:${port}`);
    } else {
      this.isConfigured = false;
      this.logger.warn(
        'MAIL_USER or MAIL_PASSWORD is not configured in backend environment variables. Real email sending is safely disabled.',
      );
    }
  }

  getIsConfigured(): boolean {
    return this.isConfigured;
  }

  async sendOtpEmail(toEmail: string, otp: string, recipientName?: string): Promise<SendEmailOtpResult> {
    const from = process.env.MAIL_FROM || `"LexisMatch AI" <${process.env.MAIL_USER || 'no-reply@lexismatch.ai'}>`;
    const name = recipientName || 'User';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }
            .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background: #0f172a; padding: 24px 32px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
            .body { padding: 32px; color: #1e293b; line-height: 1.6; }
            .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
            .code-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
            .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2563eb; margin: 0; }
            .expiry-note { color: #dc2626; font-size: 13px; font-weight: 600; margin-top: 10px; }
            .security-notice { font-size: 13px; color: #64748b; background: #f8fafc; border-left: 3px solid #2563eb; padding: 12px 16px; margin: 20px 0; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ LexisMatch AI</h1>
            </div>
            <div class="body">
              <div class="greeting">Hello ${name},</div>
              <p>Thank you for registering with <strong>LexisMatch AI</strong>. Please use the following 6-digit verification code to confirm your email address and activate your account:</p>
              
              <div class="code-box">
                <div class="otp-code">${otp}</div>
                <div class="expiry-note">⏱️ Valid for 5 minutes only</div>
              </div>

              <div class="security-notice">
                <strong>Security Reminder:</strong> Never share this verification code with anyone. LexisMatch AI representatives will never ask for your code or password.
              </div>

              <p>If you did not initiate this registration request, please disregard this email.</p>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} LexisMatch AI. Smart Legal Assistance Platform. All rights reserved.
            </div>
          </div>
        </body>
      </html>
    `;

    if (!this.isConfigured || !this.transporter) {
      this.logger.warn(`[DEV LOG] Email OTP generated for ${toEmail}: [ ${otp} ] (SMTP credentials not configured in environment)`);
      return {
        sent: false,
        mockDelivered: true,
        reason: 'SMTP_CREDENTIALS_NOT_CONFIGURED',
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: toEmail,
        subject: `Your LexisMatch AI Verification Code: ${otp}`,
        text: `Your LexisMatch AI verification code is: ${otp}. It is valid for 5 minutes. Do not share this code with anyone.`,
        html: htmlContent,
      });

      this.logger.log(`Verification email sent successfully to ${toEmail}. MessageId: ${info.messageId}`);
      return {
        sent: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${toEmail}: ${error.message}`);
      return {
        sent: false,
        reason: error.message || 'EMAIL_SEND_FAILED',
      };
    }
  }
}
