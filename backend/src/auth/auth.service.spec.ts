import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from './enums/role.enum';
import { ForbiddenException, UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;

  const mockUsers: any[] = [];

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(async (args) => {
        if (args.where.email) {
          return mockUsers.find((u) => u.email === args.where.email) || null;
        }
        if (args.where.id) {
          return mockUsers.find((u) => u.id === args.where.id) || null;
        }
        return null;
      }),
      create: jest.fn().mockImplementation(async (args) => {
        const newUser = {
          id: 'user-' + Math.random().toString(36).substring(7),
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockUsers.push(newUser);
        return newUser;
      }),
      update: jest.fn().mockImplementation(async (args) => {
        const idx = mockUsers.findIndex((u) => u.id === args.where.id);
        if (idx !== -1) {
          mockUsers[idx] = { ...mockUsers[idx], ...args.data };
          return mockUsers[idx];
        }
        return null;
      }),
    },
    client: {
      create: jest.fn().mockImplementation(async (args) => ({
        id: 'client-1',
        ...args.data,
      })),
      findUnique: jest.fn(),
    },
    advocate: {
      create: jest.fn().mockImplementation(async (args) => ({
        id: 'adv-1',
        ...args.data,
      })),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    mockUsers.length = 0;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('Registration', () => {
    it('registers a new Client user', async () => {
      const res = await authService.register({
        email: 'client@example.com',
        password: 'password123',
        role: Role.CLIENT,
        name: 'Test Client',
      });

      expect(res.message).toBe('Registration successful.');
      expect(res.accessToken).toBe('mock-jwt-token');
      expect(mockUsers.length).toBe(1);
      expect(mockUsers[0].email).toBe('client@example.com');
      expect(mockUsers[0].role).toBe(Role.CLIENT);
    });

    it('registers a new Advocate user', async () => {
      const res = await authService.register({
        email: 'advocate@example.com',
        password: 'password123',
        phone: '+919876543210',
        role: Role.ADVOCATE,
        name: 'Advocate Verma',
        barRegNumber: 'MAH/1234/2020',
      });

      expect(res.message).toBe('Registration successful.');
      expect(mockUsers.length).toBe(1);
      expect(mockUsers[0].role).toBe(Role.ADVOCATE);
    });

    it('rejects duplicate email registration', async () => {
      mockUsers.push({
        id: 'existing',
        email: 'duplicate@example.com',
        passwordHash: 'hash',
        role: Role.CLIENT,
      });

      await expect(
        authService.register({
          email: 'duplicate@example.com',
          password: 'password123',
          role: Role.CLIENT,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('prevents direct Admin registration', async () => {
      await expect(
        authService.register({
          email: 'admin@example.com',
          password: 'password123',
          role: Role.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Login', () => {
    it('successfully logs in with valid credentials', async () => {
      const passwordHash = await bcrypt.hash('secretPass', 10);
      mockUsers.push({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash,
        role: Role.CLIENT,
        preferredLanguage: 'en',
      });

      const res = await authService.login({
        email: 'user@example.com',
        password: 'secretPass',
      });

      expect(res.accessToken).toBe('mock-jwt-token');
      expect(res.user.email).toBe('user@example.com');
      expect(res.user.role).toBe(Role.CLIENT);
    });

    it('rejects login with invalid password', async () => {
      const passwordHash = await bcrypt.hash('correctPass', 10);
      mockUsers.push({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash,
        role: Role.CLIENT,
      });

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login with non-existent email', async () => {
      await expect(
        authService.login({
          email: 'notfound@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
