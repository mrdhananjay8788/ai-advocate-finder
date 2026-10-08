import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../src/auth/enums/role.enum';
import { JwtService } from '@nestjs/jwt';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  CaseType: { CRIMINAL: 'CRIMINAL', CIVIL: 'CIVIL' },
  UrgencyLevel: { HIGH: 'HIGH', LOW: 'LOW' },
  CaseStage: { INITIAL_PROBLEM: 'INITIAL_PROBLEM' },
  CaseStatus: { OPEN: 'OPEN' },
  VerificationStatus: {
    PENDING: 'PENDING',
    VERIFIED: 'VERIFIED',
    REJECTED: 'REJECTED',
  },
}));

describe('Clients & Cases Security (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockPrismaService = {
    client: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    case: {
      create: jest.fn(),
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

  afterAll(async () => {
    await app.close();
  });

  const getValidToken = (userId: string, email: string, role: Role) => {
    return jwtService.sign(
      { sub: userId, email, role },
      { secret: process.env.JWT_SECRET || 'fallback-secret' },
    );
  };

  describe('Client Profile', () => {
    let clientAToken: string;
    let advocateToken: string;

    beforeAll(() => {
      clientAToken = getValidToken(
        'clientA-user-id',
        'clientA@test.com',
        Role.CLIENT,
      );
      advocateToken = getValidToken(
        'adv-user-id',
        'adv@test.com',
        Role.ADVOCATE,
      );

      mockPrismaService.user.findUnique.mockImplementation(async (args) => {
        if (args.where.id === 'clientA-user-id')
          return { id: 'clientA-user-id', role: Role.CLIENT };
        if (args.where.id === 'adv-user-id')
          return { id: 'adv-user-id', role: Role.ADVOCATE };
        return null;
      });
    });

    it('CLIENT can get own profile', () => {
      mockPrismaService.client.findUnique.mockResolvedValueOnce({
        id: 'clientA-id',
        userId: 'clientA-user-id',
      });
      return request(app.getHttpServer())
        .get('/api/clients/me')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
    });

    it('ADVOCATE cannot access client profile endpoint', () => {
      return request(app.getHttpServer())
        .get('/api/clients/me')
        .set('Authorization', `Bearer ${advocateToken}`)
        .expect(403);
    });
  });

  describe('Case Ownership and Security', () => {
    let clientAToken: string;
    let clientBToken: string;
    let advocateToken: string;

    beforeAll(() => {
      clientAToken = getValidToken(
        'clientA-user-id',
        'clientA@test.com',
        Role.CLIENT,
      );
      clientBToken = getValidToken(
        'clientB-user-id',
        'clientB@test.com',
        Role.CLIENT,
      );
      advocateToken = getValidToken(
        'adv-user-id',
        'adv@test.com',
        Role.ADVOCATE,
      );
    });

    beforeEach(() => {
      // Setup mock to resolve client IDs correctly based on the incoming user ID
      mockPrismaService.client.findUnique.mockImplementation(async (args) => {
        if (args.where.userId === 'clientA-user-id')
          return { id: 'clientA-id', userId: 'clientA-user-id' };
        if (args.where.userId === 'clientB-user-id')
          return { id: 'clientB-id', userId: 'clientB-user-id' };
        return null;
      });
    });

    it('Client A can create a case', () => {
      const createCaseDto = {
        caseType: 'CRIMINAL',
        jurisdiction: 'Pune',
        urgencyLevel: 'HIGH',
        caseStage: 'INITIAL_PROBLEM',
        rawTranscript: 'test',
      };

      mockPrismaService.case.create.mockResolvedValueOnce({
        id: 'case1',
        clientId: 'clientA-id',
      });

      return request(app.getHttpServer())
        .post('/api/cases')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(createCaseDto)
        .expect(201);
    });

    it('Client A can access their own case', () => {
      mockPrismaService.case.findUnique.mockResolvedValueOnce({
        id: 'case1',
        clientId: 'clientA-id',
        deletedAt: null,
      });

      return request(app.getHttpServer())
        .get('/api/cases/case1')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);
    });

    it('Client B CANNOT access Client A case', () => {
      // Case 1 belongs to clientA-id
      mockPrismaService.case.findUnique.mockResolvedValueOnce({
        id: 'case1',
        clientId: 'clientA-id',
        deletedAt: null,
      });

      return request(app.getHttpServer())
        .get('/api/cases/case1')
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(403);
    });

    it('Client B CANNOT update Client A case', () => {
      mockPrismaService.case.findUnique.mockResolvedValueOnce({
        id: 'case1',
        clientId: 'clientA-id',
        deletedAt: null,
      });

      return request(app.getHttpServer())
        .patch('/api/cases/case1')
        .set('Authorization', `Bearer ${clientBToken}`)
        .send({ jurisdiction: 'Mumbai' })
        .expect(403);
    });

    it('Client B CANNOT delete Client A case', () => {
      mockPrismaService.case.findUnique.mockResolvedValueOnce({
        id: 'case1',
        clientId: 'clientA-id',
        deletedAt: null,
      });

      return request(app.getHttpServer())
        .delete('/api/cases/case1')
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(403);
    });

    it('Advocate CANNOT access cases endpoints', () => {
      return request(app.getHttpServer())
        .get('/api/cases')
        .set('Authorization', `Bearer ${advocateToken}`)
        .expect(403);
    });

    it('Cannot create case with invalid CaseType enum', () => {
      const createCaseDto = {
        caseType: 'NOT_A_REAL_TYPE', // Invalid
        jurisdiction: 'Pune',
        urgencyLevel: 'HIGH',
        caseStage: 'INITIAL_PROBLEM',
        rawTranscript: 'test',
      };

      return request(app.getHttpServer())
        .post('/api/cases')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send(createCaseDto)
        .expect(400); // Validation Pipe catches it
    });
  });
});
