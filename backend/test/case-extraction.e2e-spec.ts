import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { CaseExtractionService } from './../src/cases/services/case-extraction.service';
import { Role } from './../src/auth/enums/role.enum';
import { JwtService } from '@nestjs/jwt';

// Mocks
jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  CaseType: { CRIMINAL: 'CRIMINAL', CIVIL: 'CIVIL', OTHER: 'OTHER' },
  UrgencyLevel: {
    HIGH: 'HIGH',
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    CRITICAL: 'CRITICAL',
  },
  CaseStage: {
    INITIAL_PROBLEM: 'INITIAL_PROBLEM',
    NOTICE_RECEIVED: 'NOTICE_RECEIVED',
    INVESTIGATION: 'INVESTIGATION',
  },
  CaseStatus: { OPEN: 'OPEN', INTAKE_COMPLETED: 'INTAKE_COMPLETED' },
  VerificationStatus: { PENDING: 'PENDING', VERIFIED: 'VERIFIED' },
  ChatSessionStatus: { ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED' },
  ChatMessageRole: { USER: 'USER', ASSISTANT: 'ASSISTANT', SYSTEM: 'SYSTEM' },
}));

describe('CaseExtraction (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockPrismaService = {
    client: {
      findUnique: jest.fn(),
    },
    chatSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    case: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockExtractionService = {
    extractCaseProfile: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(CaseExtractionService)
      .useValue(mockExtractionService)
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

  describe('Extraction and Case Linking', () => {
    let clientAToken: string;
    let clientBToken: string;

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

    it('Client A can extract case profile from own session', async () => {
      // Setup session
      mockPrismaService.chatSession.findUnique.mockResolvedValueOnce({
        id: 'session1',
        clientId: 'clientA-id',
        client: { userId: 'clientA' },
        messages: [{ role: 'USER', content: 'Help me' }],
      });

      mockExtractionService.extractCaseProfile.mockResolvedValueOnce({
        caseType: 'CIVIL',
        jurisdiction: { city: 'Test City', state: 'Test State' },
        urgencyLevel: 'HIGH',
        caseStage: 'INITIAL_PROBLEM',
        summary: 'Test summary',
      });

      mockPrismaService.case.create.mockResolvedValueOnce({ id: 'case1' });

      const response = await request(app.getHttpServer())
        .post('/api/chatbot/sessions/session1/extract')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('caseId', 'case1');
      expect(response.body.structuredProfile.caseType).toBe('CIVIL');
    });

    it('Client B cannot extract Client A session', async () => {
      mockPrismaService.chatSession.findUnique.mockResolvedValueOnce({
        id: 'session1',
        clientId: 'clientA-id',
        client: { userId: 'clientA' },
        messages: [],
      });

      await request(app.getHttpServer())
        .post('/api/chatbot/sessions/session1/extract')
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(403);
    });

    it('Client A can patch case profile successfully', async () => {
      // Mock existing case ownership from generic case controller
      mockPrismaService.case.findUnique.mockResolvedValueOnce({
        id: 'case1',
        clientId: 'clientA-id',
        deletedAt: null,
        client: { userId: 'clientA' },
      });

      mockPrismaService.case.update.mockResolvedValueOnce({
        id: 'case1',
        caseType: 'CRIMINAL',
      });

      // The patch updates jurisdiction object to string behind the scenes
      const res = await request(app.getHttpServer())
        .patch('/api/cases/case1/profile')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({
          caseType: 'CRIMINAL',
          jurisdiction: { city: 'New City', state: 'New State' },
          urgencyLevel: 'CRITICAL',
          budgetRange: 'Low',
          language: 'English',
          caseStage: 'INVESTIGATION',
          summary: 'Updated summary',
        });
      console.log(res.body);
      expect(res.status).toBe(200);

      // Verify that update was called with correct structure
      expect(mockPrismaService.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseType: 'CRIMINAL',
            jurisdiction: 'New City, New State',
            status: 'INTAKE_COMPLETED',
          }),
        }),
      );
    });
  });
});
