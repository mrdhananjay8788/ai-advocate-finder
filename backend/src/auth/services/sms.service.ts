import { Injectable, Logger } from '@nestjs/common';

export interface SendSmsOtpResult {
  sent: boolean;
  mockDelivered?: boolean;
  reason?: string;
  provider?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private provider: string | null = null;
  private apiKey: string | null = null;
  private templateId: string | null = null;
  private senderId: string | null = null;
  private isConfigured = false;

  constructor() {
    this.initProvider();
  }

  private initProvider() {
    this.provider = (process.env.SMS_PROVIDER || '').toLowerCase();
    this.apiKey = process.env.SMS_API_KEY || null;
    this.templateId = process.env.SMS_TEMPLATE_ID || null;
    this.senderId = process.env.SMS_SENDER_ID || 'LXMTCH';

    if (this.apiKey && this.provider) {
      this.isConfigured = true;
      this.logger.log(`SMS Provider initialized: ${this.provider.toUpperCase()}`);
    } else {
      this.isConfigured = false;
      this.logger.warn(
        'SMS_PROVIDER or SMS_API_KEY is not configured in backend environment variables. Real SMS sending is safely disabled.',
      );
    }
  }

  getIsConfigured(): boolean {
    return this.isConfigured;
  }

  async sendOtpSms(phoneNumber: string, otp: string): Promise<SendSmsOtpResult> {
    const formattedPhone = phoneNumber.replace(/[\s-]/g, '');

    if (!this.isConfigured || !this.apiKey) {
      this.logger.warn(`[DEV LOG] Mobile OTP generated for ${formattedPhone}: [ ${otp} ] (SMS credentials not configured in environment)`);
      return {
        sent: false,
        mockDelivered: true,
        reason: 'SMS_PROVIDER_NOT_CONFIGURED',
        provider: this.provider || 'none',
      };
    }

    try {
      if (this.provider === 'msg91') {
        // MSG91 Send OTP v5 API
        const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(
          this.templateId || '',
        )}&mobile=${encodeURIComponent(formattedPhone)}&authkey=${encodeURIComponent(
          this.apiKey,
        )}&otp=${encodeURIComponent(otp)}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const data: any = await response.json();
        if (data.type === 'success' || response.ok) {
          this.logger.log(`MSG91 OTP sent successfully to ${formattedPhone}`);
          return { sent: true, provider: 'msg91' };
        } else {
          throw new Error(data.message || 'MSG91 API error');
        }
      } else if (this.provider === '2factor') {
        // 2Factor OTP API: https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}/{template_name}
        const template = this.templateId ? `/${encodeURIComponent(this.templateId)}` : '';
        const url = `https://2factor.in/API/V1/${encodeURIComponent(
          this.apiKey,
        )}/SMS/${encodeURIComponent(formattedPhone)}/${encodeURIComponent(otp)}${template}`;

        const response = await fetch(url, { method: 'GET' });
        const data: any = await response.json();

        if (data.Status === 'Success' || response.ok) {
          this.logger.log(`2Factor OTP sent successfully to ${formattedPhone}`);
          return { sent: true, provider: '2factor' };
        } else {
          throw new Error(data.Details || '2Factor API error');
        }
      } else {
        // Generic HTTP Provider / Webhook
        this.logger.warn(`Unknown SMS provider "${this.provider}". Safe fallback used.`);
        return {
          sent: false,
          mockDelivered: true,
          reason: `UNSUPPORTED_SMS_PROVIDER_${this.provider}`,
          provider: this.provider || undefined,
        };
      }
    } catch (error: any) {
      this.logger.error(`Failed to send SMS OTP to ${formattedPhone}: ${error.message}`);
      return {
        sent: false,
        reason: error.message || 'SMS_SEND_FAILED',
        provider: this.provider || 'unknown',
      };
    }
  }
}
