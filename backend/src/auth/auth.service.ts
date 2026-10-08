import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Role } from './enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, phone, role, name, barRegNumber } = registerDto;

    if (role === Role.ADMIN) {
      throw new ForbiddenException('Admin registration is not allowed.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role,
      },
    });

    const defaultName = name || 'User';

    if (role === Role.CLIENT) {
      await this.prisma.client.create({
        data: {
          userId: user.id,
          name: defaultName,
        },
      });
    } else if (role === Role.ADVOCATE) {
      await this.prisma.advocate.create({
        data: {
          userId: user.id,
          name: defaultName,
          barRegNumber: barRegNumber || `BAR-${Date.now()}`,
        },
      });
    }

    return { message: 'Registration successful.' };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({ where: { email } });
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
      select: { id: true, email: true, role: true, preferredLanguage: true }
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
