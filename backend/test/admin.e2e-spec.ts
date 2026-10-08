import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../src/auth/enums/role.enum';
import * as jwt from 'jsonwebtoken';

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

describe('AdminController (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    advocate: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    client: {
      count: jest.fn().mockResolvedValue(0),
    },
    case: {
      count: jest.fn().mockResolvedValue(0),
    },
    match: {
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const generateToken = (role: Role) => {
    return jwt.sign(
      { sub: 'user-id', email: 'test@test.com', role },
      process.env.JWT_SECRET || 'fallback-secret',
    );
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

  afterAll(async () => {
    await app.close();
  });

  describe('Security & Access', () => {
    it('should reject unauthenticated access', () => {
      return request(app.getHttpServer())
        .get('/api/admin/overview')
        .expect(401);
    });

    it('should reject CLIENT role access', () => {
      const token = generateToken(Role.CLIENT);
      return request(app.getHttpServer())
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should reject ADVOCATE role access', () => {
      const token = generateToken(Role.ADVOCATE);
      return request(app.getHttpServer())
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should allow ADMIN role access', () => {
      const token = generateToken(Role.ADMIN);
      return request(app.getHttpServer())
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('Verification Process', () => {
    it('Admin can verify pending advocate', () => {
      const token = generateToken(Role.ADMIN);
      mockPrismaService.advocate.findUnique.mockResolvedValueOnce({
        id: '1',
        verifiedStatus: 'PENDING',
      });
      mockPrismaService.advocate.update.mockResolvedValueOnce({
        id: '1',
        verifiedStatus: 'VERIFIED',
      });

      return request(app.getHttpServer())
        .patch('/api/admin/advocates/1/verification')
        .set('Authorization', `Bearer ${token}`)
        .send({ verifiedStatus: 'VERIFIED' })
        .expect(200);
    });

    it('should reject invalid verification status transition (e.g. from VERIFIED)', () => {
      const token = generateToken(Role.ADMIN);
      mockPrismaService.advocate.findUnique.mockResolvedValueOnce({
        id: '1',
        verifiedStatus: 'VERIFIED',
      });

      return request(app.getHttpServer())
        .patch('/api/admin/advocates/1/verification')
        .set('Authorization', `Bearer ${token}`)
        .send({ verifiedStatus: 'REJECTED' })
        .expect(400); // Bad Request from service
    });
  });
});
