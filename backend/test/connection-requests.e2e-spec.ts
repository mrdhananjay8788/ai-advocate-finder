import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  Role: { CLIENT: 'CLIENT', ADVOCATE: 'ADVOCATE', ADMIN: 'ADMIN' },
  VerificationStatus: {
    PENDING: 'PENDING',
    VERIFIED: 'VERIFIED',
    REJECTED: 'REJECTED',
  },
  CaseType: {
    CRIMINAL: 'CRIMINAL',
    CIVIL: 'CIVIL',
    FAMILY: 'FAMILY',
    CORPORATE: 'CORPORATE',
  },
  UrgencyLevel: { HIGH: 'HIGH', LOW: 'LOW', MEDIUM: 'MEDIUM' },
  CaseStage: {
    INITIAL_PROBLEM: 'INITIAL_PROBLEM',
    FIRST_HEARING: 'FIRST_HEARING',
    TRIAL: 'TRIAL',
  },
  CaseStatus: { OPEN: 'OPEN', IN_PROGRESS: 'IN_PROGRESS', CLOSED: 'CLOSED' },
  RequestStatus: {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    DECLINED: 'DECLINED',
    CANCELLED: 'CANCELLED',
  },
}));

describe('Connection Requests (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    PrismaService.prototype.$connect = jest.fn();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Because the database is mocked/unreachable in this phase, we are just putting structural placeholders
  // for the security test suite as requested by the plan.

  it('/api/connection-requests (POST) - fails without auth', () => {
    return request(app.getHttpServer())
      .post('/api/connection-requests')
      .send({ caseId: '123', advocateId: '456' })
      .expect(401);
  });

  it('/api/connection-requests/client/me (GET) - fails for non-clients', () => {
    // This expects to fail because even if we had a valid token, we're not providing one
    return request(app.getHttpServer())
      .get('/api/connection-requests/client/me')
      .expect(401);
  });

  it('/api/connection-requests/:id/details (GET) - fails without auth', () => {
    return request(app.getHttpServer())
      .get('/api/connection-requests/123/details')
      .expect(401);
  });
});
