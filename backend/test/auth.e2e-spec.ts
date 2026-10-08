import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../src/auth/enums/role.enum';
import * as bcrypt from 'bcrypt';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  VerificationStatus: {
    PENDING: 'PENDING',
    VERIFIED: 'VERIFIED',
    REJECTED: 'REJECTED',
  },
  CaseType: { CRIMINAL: 'CRIMINAL', CIVIL: 'CIVIL' },
  UrgencyLevel: { HIGH: 'HIGH', LOW: 'LOW' },
  CaseStage: { INITIAL_PROBLEM: 'INITIAL_PROBLEM' },
  CaseStatus: { OPEN: 'OPEN' },
}));

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    client: {
      create: jest.fn(),
    },
    advocate: {
      create: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    PrismaService.prototype.$connect = jest.fn();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/auth/register (POST)', () => {
    it('should reject admin registration', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'admin@test.com',
          password: 'password123',
          role: Role.ADMIN,
        })
        .expect(403);
    });

    it('should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          role: Role.CLIENT,
        })
        .expect(400);
    });

    it('should reject weak password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: '123', role: Role.CLIENT })
        .expect(400);
    });

    it('should reject duplicate email', () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: '1',
        email: 'test@test.com',
      });
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: 'password123',
          role: Role.CLIENT,
        })
        .expect(409);
    });

    it('should register client', () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: '1',
        email: 'test@test.com',
        role: Role.CLIENT,
      });
      mockPrismaService.client.create.mockResolvedValueOnce({});

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: 'password123',
          role: Role.CLIENT,
          name: 'Test Client',
        })
        .expect(201);
    });

    it('should register advocate', () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: '2',
        email: 'adv@test.com',
        role: Role.ADVOCATE,
      });
      mockPrismaService.advocate.create.mockResolvedValueOnce({});

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'adv@test.com',
          password: 'password123',
          role: Role.ADVOCATE,
          name: 'Test Advocate',
          barRegNumber: '12345',
        })
        .expect(201);
    });
  });

  describe('/api/auth/login (POST)', () => {
    it('should reject unknown user', () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'unknown@test.com', password: 'password123' })
        .expect(401);
    });

    it('should reject invalid password', () => {
      const realHash = bcrypt.hashSync('password123', 1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: '1',
        email: 'test@test.com',
        passwordHash: realHash,
      });

      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' })
        .expect(401);
    });

    it('should login valid credentials', () => {
      const realHash = bcrypt.hashSync('password123', 1);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: '1',
        email: 'test@test.com',
        passwordHash: realHash,
        role: Role.CLIENT,
      });

      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'password123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.user.email).toBe('test@test.com');
          expect(res.body.user.passwordHash).toBeUndefined();
        });
    });
  });
});
