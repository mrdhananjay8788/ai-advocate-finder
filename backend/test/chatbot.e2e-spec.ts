import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../src/auth/enums/role.enum';
import { JwtService } from '@nestjs/jwt';

// Ensure all enums are mocked for the entire app context to prevent random failures
jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  CaseType: { CRIMINAL: 'CRIMINAL', CIVIL: 'CIVIL' },
  UrgencyLevel: { HIGH: 'HIGH', LOW: 'LOW' },
  CaseStage: { INITIAL_PROBLEM: 'INITIAL_PROBLEM' },
  CaseStatus: { OPEN: 'OPEN' },
  VerificationStatus: { PENDING: 'PENDING', VERIFIED: 'VERIFIED' },
  ChatSessionStatus: { ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED' },
  ChatMessageRole: { USER: 'USER', ASSISTANT: 'ASSISTANT', SYSTEM: 'SYSTEM' },
}));

describe('ChatbotController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockPrismaService = {
    client: {
      findUnique: jest.fn(),
    },
    chatSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
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

  describe('Session Security and Logic', () => {
    let clientAToken: string;
    let clientBToken: string;
    let advocateToken: string;

    beforeAll(() => {
      clientAToken = getValidToken('clientA', 'clientA@test.com', Role.CLIENT);
      clientBToken = getValidToken('clientB', 'clientB@test.com', Role.CLIENT);
      advocateToken = getValidToken('adv', 'adv@test.com', Role.ADVOCATE);
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

    it('Client can create session', async () => {
      mockPrismaService.chatSession.create.mockResolvedValueOnce({
        id: 'session1',
        clientId: 'clientA-id',
      });
      mockPrismaService.chatMessage.create.mockResolvedValueOnce({
        id: 'msg1',
        content: 'mock',
      });

      const response = await request(app.getHttpServer())
        .post('/api/chatbot/sessions')
        .set('Authorization', `Bearer ${clientAToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('sessionId', 'session1');
    });

    it('Advocate cannot create session', () => {
      return request(app.getHttpServer())
        .post('/api/chatbot/sessions')
        .set('Authorization', `Bearer ${advocateToken}`)
        .expect(403);
    });

    it('Unauthenticated user cannot create session', () => {
      return request(app.getHttpServer())
        .post('/api/chatbot/sessions')
        .expect(401);
    });

    it('Client A cannot access Client B session', async () => {
      // Setup session belonging to Client A
      mockPrismaService.chatSession.findUnique.mockResolvedValueOnce({
        id: 'session1',
        clientId: 'clientA-id',
      });

      // Client B tries to access Client A's session
      await request(app.getHttpServer())
        .get('/api/chatbot/sessions/session1')
        .set('Authorization', `Bearer ${clientBToken}`)
        .expect(403);
    });

    it('Client A cannot send message to Client B session', async () => {
      mockPrismaService.chatSession.findUnique.mockResolvedValueOnce({
        id: 'session1',
        clientId: 'clientA-id',
      });

      await request(app.getHttpServer())
        .post('/api/chatbot/sessions/session1/messages')
        .set('Authorization', `Bearer ${clientBToken}`)
        .send({ message: 'Hello' })
        .expect(403);
    });

    it('Empty message rejected', () => {
      return request(app.getHttpServer())
        .post('/api/chatbot/sessions/session1/messages')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ message: '' }) // fails IsNotEmpty
        .expect(400);
    });

    it('Oversized message rejected', () => {
      return request(app.getHttpServer())
        .post('/api/chatbot/sessions/session1/messages')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ message: 'a'.repeat(2000) }) // > 1000 limit
        .expect(400);
    });

    it('Client A can send valid message and get mock response (no API key)', async () => {
      mockPrismaService.chatSession.findUnique.mockResolvedValueOnce({
        id: 'session1',
        clientId: 'clientA-id',
      });
      mockPrismaService.chatMessage.create.mockResolvedValueOnce({
        id: 'msg1',
        role: 'USER',
      });
      mockPrismaService.chatMessage.findMany.mockResolvedValueOnce([]); // no history

      mockPrismaService.chatMessage.create.mockResolvedValueOnce({
        id: 'msg2',
        role: 'ASSISTANT',
        content:
          'I am a mock intake assistant (Anthropic API key is not configured).',
      });

      const response = await request(app.getHttpServer())
        .post('/api/chatbot/sessions/session1/messages')
        .set('Authorization', `Bearer ${clientAToken}`)
        .send({ message: 'I need help' })
        .expect(201);

      expect(response.body.content).toContain('mock intake assistant');
    });
  });
});
