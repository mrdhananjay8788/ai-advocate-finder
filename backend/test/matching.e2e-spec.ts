import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../src/auth/enums/role.enum';
import { JwtService } from '@nestjs/jwt';

// Ensure required fields for testing enums
jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  CaseStatus: {
    OPEN: 'OPEN',
    INTAKE_COMPLETED: 'INTAKE_COMPLETED',
    MATCHED: 'MATCHED',
  },
  VerificationStatus: { PENDING: 'PENDING', VERIFIED: 'VERIFIED' },
  MatchStatus: {
    SUGGESTED: 'SUGGESTED',
    ACCEPTED: 'ACCEPTED',
    DECLINED: 'DECLINED',
  },
  CaseType: {
    CRIMINAL: 'CRIMINAL',
    CIVIL: 'CIVIL',
    PROPERTY: 'PROPERTY',
    OTHER: 'OTHER',
  },
  UrgencyLevel: { HIGH: 'HIGH', LOW: 'LOW', MEDIUM: 'MEDIUM' },
  CaseStage: { INITIAL_PROBLEM: 'INITIAL_PROBLEM' },
}));

describe('Matching (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockPrismaService = {
    client: {
      findUnique: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    advocate: {
      findMany: jest.fn(),
    },
    match: {
      findMany: jest.fn(),
      upsert: jest.fn(),
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

  describe('Matching Engine Rules', () => {
    let clientAToken: string;
    let clientBToken: string;

    const mockAdvocates = [
      {
        id: 'adv1',
        name: 'Advocate A',
        verifiedStatus: 'VERIFIED',
        availabilityStatus: true,
        practiceAreas: ['PROPERTY'],
        city: 'Pune',
        state: 'Maharashtra',
        ratingAvg: 4.8,
        reviewCount: 10,
        yearsExperience: 8,
        feeRange: 'Medium',
        languages: ['English'],
      },
      {
        id: 'adv2',
        name: 'Advocate B',
        verifiedStatus: 'VERIFIED',
        availabilityStatus: true,
        practiceAreas: ['CRIMINAL'],
        city: 'Mumbai',
        state: 'Maharashtra',
        ratingAvg: 4.5,
        reviewCount: 5,
        yearsExperience: 10,
        feeRange: 'High',
        languages: ['English'],
      },
      {
        id: 'adv3',
        name: 'Advocate C',
        verifiedStatus: 'VERIFIED',
        availabilityStatus: false, // Unavailable
        practiceAreas: ['PROPERTY'],
        city: 'Pune',
        state: 'Maharashtra',
        ratingAvg: 4.2,
        reviewCount: 2,
        yearsExperience: 3,
        feeRange: 'Medium',
        languages: ['Hindi'],
      },
      {
        id: 'adv4',
        name: 'Advocate D',
        verifiedStatus: 'VERIFIED',
        availabilityStatus: true,
        practiceAreas: ['PROPERTY', 'CIVIL'],
        city: 'Pune',
        state: 'Maharashtra',
        ratingAvg: 4.9,
        reviewCount: 50,
        yearsExperience: 12,
        feeRange: 'Low',
        languages: ['English'],
      },
    ];

    beforeAll(() => {
      clientAToken = getValidToken('clientA', 'clientA@test.com', Role.CLIENT);
      clientBToken = getValidToken('clientB', 'clientB@test.com', Role.CLIENT);
    });

    beforeEach(() => {
      jest.clearAllMocks();

      mockPrismaService.client.findUnique.mockImplementation(async (args) => {
        if (args.where.userId === 'clientA')
          return { id: 'clientA-id', userId: 'clientA' };
        if (args.where.userId === 'clientB')
          return { id: 'clientB-id', userId: 'clientB' };
        return null;
      });
    });

    it('Client A generates matches for confirmed case successfully', async () => {
      mockPrismaService.case.findUnique.mockResolvedValue({
        id: 'case1',
        clientId: 'clientA-id',
        status: 'INTAKE_COMPLETED',
        caseType: 'PROPERTY',
        jurisdiction: 'Pune, Maharashtra',
        budgetRange: 'Medium',
        language: 'English',
        deletedAt: null,
      });

      // Mock only eligible advocates: Adv 1, 2, 4 (3 is unavailable)
      mockPrismaService.advocate.findMany.mockResolvedValue([
        mockAdvocates[0],
        mockAdvocates[1],
        mockAdvocates[3],
      ]);

      mockPrismaService.match.upsert.mockResolvedValue({});

      const response = await request(app.getHttpServer())
        .post('/api/matching/cases/case1')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(201);

      const matches = response.body.matches;
      expect(matches).toHaveLength(3);

      // Advocate A should be top due to budget match (97.4 vs 94.7 for Adv D)
      expect(matches[0].advocateId).toBe('adv1');
      // Total max 100 constraint
      expect(matches[0].matchScore).toBeLessThanOrEqual(100);

      // Advocate B should have 0 for specialization and lower score
      const advB = matches.find((m) => m.advocateId === 'adv2');
      expect(advB.scoreBreakdown.specialization).toBe(0);
      expect(advB.scoreBreakdown.jurisdiction).toBe(10); // State match
    });

    it('Fails to match if case status is not INTAKE_COMPLETED', async () => {
      mockPrismaService.case.findUnique.mockResolvedValue({
        id: 'case2',
        clientId: 'clientA-id',
        status: 'OPEN',
        deletedAt: null,
      });

      const res = await request(app.getHttpServer())
        .post('/api/matching/cases/case2')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(400);

      expect(res.body.message).toContain('completed');
    });

    it('Client B cannot generate matches for Client A case', async () => {
      mockPrismaService.case.findUnique.mockResolvedValue({
        id: 'case1',
        clientId: 'clientA-id',
        status: 'INTAKE_COMPLETED',
        deletedAt: null,
      });

      await request(app.getHttpServer())
        .post('/api/matching/cases/case1')
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(403);
    });

    it('Client A can get existing matches', async () => {
      mockPrismaService.case.findUnique.mockResolvedValue({
        id: 'case1',
        clientId: 'clientA-id',
        deletedAt: null,
      });

      mockPrismaService.match.findMany.mockResolvedValue([
        {
          caseId: 'case1',
          matchScore: 90,
          status: 'SUGGESTED',
          advocate: mockAdvocates[0],
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/matching/cases/case1')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(200);

      expect(res.body.matches[0].name).toBe('Advocate A');
      expect(res.body.matches[0].matchScore).toBe(90);
    });
  });
});
