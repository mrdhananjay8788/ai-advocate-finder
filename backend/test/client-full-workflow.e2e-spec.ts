import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../src/auth/enums/role.enum';
import { JwtService } from '@nestjs/jwt';

describe('End-to-End Client Workflow (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let clientAToken: string;
  let clientBToken: string;

  const mockCaseStore: any = {
    case1: {
      id: 'case1',
      clientId: 'clientA-id',
      caseType: 'PROPERTY',
      jurisdiction: 'Pune, Maharashtra',
      urgencyLevel: 'HIGH',
      budgetRange: 'Medium',
      language: 'English',
      caseStage: 'INITIAL_PROBLEM',
      status: 'OPEN',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockAdvocates = [
    {
      id: 'adv1',
      name: 'Demo Adv Rajesh Kumar',
      verifiedStatus: 'VERIFIED',
      availabilityStatus: true,
      practiceAreas: ['PROPERTY', 'CIVIL'],
      languages: ['English', 'Hindi'],
      city: 'Pune',
      state: 'Maharashtra',
      ratingAvg: 4.8,
      reviewCount: 24,
      yearsExperience: 10,
      feeRange: 'Medium',
      courts: ['District Court Pune'],
      bio: 'Experienced property and civil disputes advocate.',
    },
    {
      id: 'adv2',
      name: 'Demo Adv Priya Sharma',
      verifiedStatus: 'VERIFIED',
      availabilityStatus: true,
      practiceAreas: ['CRIMINAL'],
      languages: ['English'],
      city: 'Mumbai',
      state: 'Maharashtra',
      ratingAvg: 4.2,
      reviewCount: 15,
      yearsExperience: 6,
      feeRange: 'High',
      courts: ['Bombay High Court'],
      bio: 'Criminal defense lawyer.',
    },
  ];

  const mockPrismaService = {
    client: {
      findUnique: jest.fn().mockImplementation(async (args) => {
        if (args.where.userId === 'clientA') return { id: 'clientA-id', userId: 'clientA' };
        if (args.where.userId === 'clientB') return { id: 'clientB-id', userId: 'clientB' };
        return null;
      }),
    },
    chatSession: {
      create: jest.fn().mockResolvedValue({
        id: 'session-101',
        clientId: 'clientA-id',
        language: 'en',
      }),
      findUnique: jest.fn().mockImplementation(async (args) => {
        if (args.where.id === 'session-101') {
          return {
            id: 'session-101',
            clientId: 'clientA-id',
            language: 'en',
            client: { userId: 'clientA' },
            messages: [
              { role: 'USER', content: 'I have a land boundary dispute with my neighbor in Pune.' },
            ],
          };
        }
        return null;
      }),
      update: jest.fn().mockResolvedValue({ id: 'session-101' }),
    },
    chatMessage: {
      create: jest.fn().mockImplementation(async (args) => ({
        id: 'msg-' + Math.random(),
        sessionId: args.data.sessionId,
        role: args.data.role,
        content: args.data.content,
        createdAt: new Date(),
      })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    case: {
      create: jest.fn().mockImplementation(async (args) => {
        const id = 'case-' + Math.random().toString(36).substring(7);
        const record = { id, ...args.data, status: 'OPEN', deletedAt: null };
        mockCaseStore[id] = record;
        return record;
      }),
      findUnique: jest.fn().mockImplementation(async (args) => {
        return mockCaseStore[args.where.id] || null;
      }),
      findMany: jest.fn().mockImplementation(async (args) => {
        return Object.values(mockCaseStore).filter(
          (c: any) => c.clientId === args.where.clientId && !c.deletedAt,
        );
      }),
      update: jest.fn().mockImplementation(async (args) => {
        const existing = mockCaseStore[args.where.id];
        if (!existing) return null;
        const updated = { ...existing, ...args.data };
        mockCaseStore[args.where.id] = updated;
        return updated;
      }),
    },
    advocate: {
      findMany: jest.fn().mockResolvedValue(mockAdvocates),
      findUnique: jest.fn().mockImplementation(async (args) => {
        return mockAdvocates.find((a) => a.id === args.where.id) || null;
      }),
    },
    match: {
      upsert: jest.fn().mockResolvedValue({ id: 'match-1' }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'match-1',
          matchScore: 98,
          scoreBreakdown: JSON.stringify({
            specialization: 40,
            jurisdiction: 20,
            language: 10,
            experience: 10,
            budget: 10,
            availability: 10,
          }),
          status: 'SUGGESTED',
          advocate: mockAdvocates[0],
        },
      ]),
    },
    connectionRequest: {
      create: jest.fn().mockResolvedValue({
        id: 'conn-1',
        caseId: 'case1',
        clientId: 'clientA-id',
        advocateId: 'adv1',
        status: 'PENDING',
      }),
      findUnique: jest.fn().mockResolvedValue(null),
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
    clientAToken = jwtService.sign(
      { sub: 'clientA', email: 'clientA@example.com', role: Role.CLIENT },
      { secret: process.env.JWT_SECRET || 'fallback-secret' },
    );
    clientBToken = jwtService.sign(
      { sub: 'clientB', email: 'clientB@example.com', role: Role.CLIENT },
      { secret: process.env.JWT_SECRET || 'fallback-secret' },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: Client creates an AI intake chat session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/chatbot/sessions')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({ language: 'en' })
      .expect(201);

    expect(res.body).toHaveProperty('sessionId', 'session-101');
    expect(res.body).toHaveProperty('message');
    expect(res.body.message.role).toBe('ASSISTANT');
  });

  it('Step 2: Client sends message describing legal issue to AI chatbot', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/chatbot/sessions/session-101/messages')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({ message: 'I have a property boundary dispute with my neighbor in Pune. We received a legal notice.' })
      .expect(201);

    expect(res.body).toHaveProperty('role', 'ASSISTANT');
    expect(res.body.content.length).toBeGreaterThan(10);
  });

  it('Step 3: Client extracts structured case profile from session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/chatbot/sessions/session-101/extract')
      .set('Authorization', `Bearer ${clientAToken}`)
      .expect(201);

    expect(res.body).toHaveProperty('caseId');
    expect(res.body).toHaveProperty('structuredProfile');
    expect(res.body.structuredProfile.caseType).toBeDefined();
  });

  it('Step 4: Client reviews and confirms case profile (sets INTAKE_COMPLETED)', async () => {
    const patchPayload = {
      caseType: 'PROPERTY',
      jurisdiction: { city: 'Pune', state: 'Maharashtra' },
      urgencyLevel: 'HIGH',
      budgetRange: 'Medium',
      language: 'English',
      caseStage: 'NOTICE_RECEIVED',
      summary: 'Property boundary dispute requiring legal consultation in Pune.',
    };

    const res = await request(app.getHttpServer())
      .patch('/api/cases/case1/profile')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send(patchPayload)
      .expect(200);

    expect(mockCaseStore['case1'].status).toBe('INTAKE_COMPLETED');
    expect(mockCaseStore['case1'].caseType).toBe('PROPERTY');
  });

  it('Step 5: Client views saved case details', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cases/case1')
      .set('Authorization', `Bearer ${clientAToken}`)
      .expect(200);

    expect(res.body.id).toBe('case1');
    expect(res.body.status).toBe('INTAKE_COMPLETED');
    expect(res.body.jurisdiction).toContain('Pune');
  });

  it('Step 6: Client generates advocate matches for confirmed case', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/matching/cases/case1')
      .set('Authorization', `Bearer ${clientAToken}`)
      .expect(201);

    expect(res.body).toHaveProperty('caseId', 'case1');
    expect(res.body.matches.length).toBeGreaterThan(0);

    const topMatch = res.body.matches[0];
    expect(topMatch.advocateId).toBe('adv1');
    expect(topMatch.matchScore).toBeGreaterThanOrEqual(80);
    expect(topMatch.scoreBreakdown.specialization).toBe(40);
    expect(topMatch.scoreBreakdown.jurisdiction).toBe(20);
  });

  it('Step 7: Client retrieves existing matches', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/matching/cases/case1')
      .set('Authorization', `Bearer ${clientAToken}`)
      .expect(200);

    expect(res.body.matches).toBeDefined();
    expect(res.body.matches.length).toBe(1);
    expect(res.body.matches[0].name).toBe('Demo Adv Rajesh Kumar');
  });

  it('Step 8: Client views public advocate profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/advocates/adv1')
      .expect(200);

    expect(res.body.id).toBe('adv1');
    expect(res.body.name).toBe('Demo Adv Rajesh Kumar');
    expect(res.body.verifiedStatus).toBe('VERIFIED');
    expect(Array.isArray(res.body.practiceAreas)).toBe(true);
  });

  it('Step 9: Security check - Client B cannot view Client A case', async () => {
    await request(app.getHttpServer())
      .get('/api/cases/case1')
      .set('Authorization', `Bearer ${clientBToken}`)
      .expect(403);
  });

  it('Step 10: Security check - Client B cannot generate matches for Client A case', async () => {
    await request(app.getHttpServer())
      .post('/api/matching/cases/case1')
      .set('Authorization', `Bearer ${clientBToken}`)
      .expect(403);
  });
});
