import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Role } from './enums/role.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, phone, role, name, barRegNumber } = registerDto;

    if (role === Role.ADMIN) {
      throw new ForbiddenException('Admin registration is not allowed.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        phone: phone ? phone.trim() : null,
        passwordHash,
        role,
        isVerified: true,
        emailVerified: true,
        phoneVerified: true,
      },
    });

    const defaultName = name || 'User';

    if (role === Role.CLIENT) {
      await this.prisma.client.create({
        data: {
          userId: user.id,
          name: defaultName,
          phone: phone || null,
        },
      });
    } else if (role === Role.ADVOCATE) {
      await this.prisma.advocate.create({
        data: {
          userId: user.id,
          name: defaultName,
          barRegNumber: barRegNumber || `BAR-${Date.now()}`,
          verifiedStatus: 'PENDING',
        },
      });
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Registration successful.',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        preferredLanguage: true,
      },
    });
    return user;
  }

  async updateLanguage(userId: string, language: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { preferredLanguage: language },
    });
    return { message: 'Language updated successfully' };
  }
}
