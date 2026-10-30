import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export interface GeneratedOtp {
  otp: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
  private readonly MAX_ATTEMPTS = 5;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a cryptographically secure 6-digit OTP.
   */
  private generateSecureCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Issues a new OTP for an identifier (Email or Mobile).
   * Enforces 60-second resend cooldown and limits repeated spam requests.
   * Invalidates previously issued pending OTPs for the same identifier.
   */
  async issueOtp(
    identifier: string,
    type: 'EMAIL' | 'PHONE',
    userId?: string,
  ): Promise<GeneratedOtp> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const now = new Date();

    // 1. Check if there's a recent pending OTP with an active cooldown
    const latestPending = await this.prisma.otpVerification.findFirst({
      where: {
        identifier: normalizedIdentifier,
        type,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestPending && latestPending.resendAvailableAt > now) {
      const waitSeconds = Math.ceil(
        (latestPending.resendAvailableAt.getTime() - now.getTime()) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${waitSeconds} second${waitSeconds > 1 ? 's' : ''} before requesting another code.`,
      );
    }

    // 2. Check total requests in the last 15 minutes to prevent abuse
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const recentRequestsCount = await this.prisma.otpVerification.count({
      where: {
        identifier: normalizedIdentifier,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentRequestsCount >= 8) {
      throw new BadRequestException(
        'Too many verification attempts. Please wait a few minutes before trying again.',
      );
    }

    // 3. Invalidate previous PENDING OTPs for this identifier
    await this.prisma.otpVerification.updateMany({
      where: {
        identifier: normalizedIdentifier,
        type,
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED',
      },
    });

    // 4. Generate new OTP and hash it with bcrypt
    const rawOtp = this.generateSecureCode();
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const expiresAt = new Date(now.getTime() + this.OTP_EXPIRY_MS);
    const resendAvailableAt = new Date(now.getTime() + this.RESEND_COOLDOWN_MS);

    // 5. Save to database
    await this.prisma.otpVerification.create({
      data: {
        userId: userId || null,
        identifier: normalizedIdentifier,
        type,
        otpHash,
        attempts: 0,
        maxAttempts: this.MAX_ATTEMPTS,
        expiresAt,
        resendAvailableAt,
        status: 'PENDING',
      },
    });

    this.logger.log(`New ${type} OTP created for ${normalizedIdentifier}. Valid for 5 minutes.`);

    return {
      otp: rawOtp,
      expiresAt,
      resendAvailableAt,
    };
  }

  /**
   * Verifies the submitted 6-digit OTP against the stored hash.
   * Enforces expiry, max 5 attempts, and sets status to VERIFIED on success.
   */
  async verifyOtp(
    identifier: string,
    type: 'EMAIL' | 'PHONE',
    submittedOtp: string,
  ): Promise<{ success: boolean; message: string; userId?: string }> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const cleanOtp = submittedOtp.trim();
    const now = new Date();

    if (!/^\d{6}$/.test(cleanOtp)) {
      throw new BadRequestException('Please enter a valid 6-digit verification code.');
    }

    // Find the latest pending OTP record
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        identifier: normalizedIdentifier,
        type,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        'Invalid or expired verification code. Please request a new code.',
      );
    }

    // Check expiry
    if (now > otpRecord.expiresAt) {
      await this.prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException(
        'This verification code has expired. Please request a new code.',
      );
    }

    // Check if attempts exceeded
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await this.prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new code.',
      );
    }

    // Compare hashed OTP
    const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otpHash);

    if (!isMatch) {
      const newAttempts = otpRecord.attempts + 1;
      const isFailed = newAttempts >= otpRecord.maxAttempts;

      await this.prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: {
          attempts: newAttempts,
          status: isFailed ? 'FAILED' : 'PENDING',
        },
      });

      const remainingAttempts = Math.max(0, otpRecord.maxAttempts - newAttempts);
      if (isFailed) {
        throw new BadRequestException(
          'Maximum verification attempts exceeded. Please request a new code.',
        );
      }

      throw new BadRequestException(
        `Invalid verification code. ${remainingAttempts} attempt${
          remainingAttempts === 1 ? '' : 's'
        } remaining.`,
      );
    }

    // Code is correct: Mark OTP as VERIFIED
    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: now,
      },
    });

    // Update associated User account
    let matchedUserId = otpRecord.userId;

    if (!matchedUserId) {
      // Look up user by email or phone
      const user = await this.prisma.user.findFirst({
        where: type === 'EMAIL'
          ? { email: normalizedIdentifier }
          : { phone: normalizedIdentifier },
      });
      if (user) matchedUserId = user.id;
    }

    if (matchedUserId) {
      const updateData: any = {
        isVerified: true,
      };
      if (type === 'EMAIL') {
        updateData.emailVerified = true;
      } else {
        updateData.phoneVerified = true;
      }

      await this.prisma.user.update({
        where: { id: matchedUserId },
        data: updateData,
      });

      this.logger.log(`User ${matchedUserId} contact method verified via ${type}.`);
    }

    return {
      success: true,
      message: 'Verification successful.',
      userId: matchedUserId || undefined,
    };
  }

  /**
   * Retrieves verification status and cooldown timer for a given identifier.
   */
  async getStatus(identifier: string, type: 'EMAIL' | 'PHONE') {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const now = new Date();

    const latest = await this.prisma.otpVerification.findFirst({
      where: { identifier: normalizedIdentifier, type },
      orderBy: { createdAt: 'desc' },
    });

    const user = await this.prisma.user.findFirst({
      where: type === 'EMAIL'
        ? { email: normalizedIdentifier }
        : { phone: normalizedIdentifier },
      select: {
        id: true,
        email: true,
        phone: true,
        isVerified: true,
        emailVerified: true,
        phoneVerified: true,
        role: true,
      },
    });

    const isPending = latest?.status === 'PENDING' && latest.expiresAt > now;
    const cooldownRemaining =
      latest && latest.resendAvailableAt > now
        ? Math.ceil((latest.resendAvailableAt.getTime() - now.getTime()) / 1000)
        : 0;

    return {
      isVerified: user ? user.isVerified : latest?.status === 'VERIFIED',
      emailVerified: user?.emailVerified || false,
      phoneVerified: user?.phoneVerified || false,
      hasPendingOtp: isPending,
      cooldownSeconds: cooldownRemaining,
      type,
    };
  }
}
