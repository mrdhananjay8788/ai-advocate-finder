import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../src/auth/enums/role.enum';
import { VerificationStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

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

describe('AdvocatesController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockPrismaService = {
    advocate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const getValidToken = (userId: string, email: string, role: Role) => {
    return jwtService.sign(
      { sub: userId, email, role },
      { secret: process.env.JWT_SECRET || 'fallback-secret' },
    );
  };

  describe('GET /api/advocates', () => {
    it('should return a list of advocates', () => {
      mockPrismaService.advocate.findMany.mockResolvedValue([
        { id: '1', name: 'Test Adv' },
      ]);
      return request(app.getHttpServer())
        .get('/api/advocates')
        .expect(200)
        .expect([{ id: '1', name: 'Test Adv' }]);
    });
  });

  describe('GET /api/advocates/:id', () => {
    it('should return a specific advocate', () => {
      mockPrismaService.advocate.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test Adv',
      });
      return request(app.getHttpServer())
        .get('/api/advocates/1')
        .expect(200)
        .expect({ id: '1', name: 'Test Adv' });
    });

    it('should return 404 if not found', () => {
      mockPrismaService.advocate.findUnique.mockResolvedValue(null);
      return request(app.getHttpServer()).get('/api/advocates/99').expect(404);
    });
  });

  describe('Advocate Profile Operations', () => {
    let token: string;

    beforeAll(() => {
      token = getValidToken('userId1', 'adv@test.com', Role.ADVOCATE);
      // Need user in DB for JwtStrategy
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'userId1',
        email: 'adv@test.com',
        role: Role.ADVOCATE,
      });
    });

    it('GET /api/advocates/me - success', () => {
      mockPrismaService.advocate.findUnique.mockResolvedValue({
        id: 'adv1',
        name: 'Test Adv',
      });
      return request(app.getHttpServer())
        .get('/api/advocates/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect({ id: 'adv1', name: 'Test Adv' });
    });

    it('PATCH /api/advocates/me - success', () => {
      const updateDto = { name: 'New Name', city: 'Pune' };
      mockPrismaService.advocate.update.mockResolvedValue({
        id: 'adv1',
        name: 'New Name',
        verifiedStatus: 'PENDING',
      });

      return request(app.getHttpServer())
        .patch('/api/advocates/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updateDto)
        .expect(200);
    });

    it('PATCH /api/advocates/me - invalid data', () => {
      const updateDto = { yearsExperience: -5 }; // Invalid: must be min 0
      return request(app.getHttpServer())
        .patch('/api/advocates/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updateDto)
        .expect(400);
    });
  });

  describe('Verification Operations', () => {
    let adminToken: string;
    let clientToken: string;
    let advocateToken: string;

    beforeAll(() => {
      adminToken = getValidToken('admin1', 'admin@test.com', Role.ADMIN);
      clientToken = getValidToken('client1', 'client@test.com', Role.CLIENT);
      advocateToken = getValidToken('adv1', 'adv@test.com', Role.ADVOCATE);

      mockPrismaService.user.findUnique.mockImplementation((args) => {
        if (args.where.id === 'admin1')
          return Promise.resolve({ id: 'admin1', role: Role.ADMIN });
        if (args.where.id === 'client1')
          return Promise.resolve({ id: 'client1', role: Role.CLIENT });
        if (args.where.id === 'adv1')
          return Promise.resolve({ id: 'adv1', role: Role.ADVOCATE });
        return Promise.resolve(null);
      });
    });

    it('ADMIN can verify advocate', () => {
      mockPrismaService.advocate.update.mockResolvedValue({});
      return request(app.getHttpServer())
        .patch('/api/advocates/advocate-id/verification')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'VERIFIED' })
        .expect(200);
    });

    it('CLIENT cannot verify advocate', () => {
      return request(app.getHttpServer())
        .patch('/api/advocates/advocate-id/verification')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ status: 'VERIFIED' })
        .expect(403);
    });

    it('ADVOCATE cannot verify themselves', () => {
      return request(app.getHttpServer())
        .patch('/api/advocates/advocate-id/verification')
        .set('Authorization', `Bearer ${advocateToken}`)
        .send({ status: 'VERIFIED' })
        .expect(403);
    });

    it('Unauthenticated cannot verify advocate', () => {
      return request(app.getHttpServer())
        .patch('/api/advocates/advocate-id/verification')
        .send({ status: 'VERIFIED' })
        .expect(401);
    });
  });
});
