import { PrismaClient } from '@prisma/client';
import { Role, VerificationStatus, CaseType, UrgencyLevel, CaseStage, CaseStatus, MatchStatus, ConnectionRequestStatus } from '../src/prisma-enums';;
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Seeding aborted for safety.');
  }

  console.log('Starting idempotent seed script...');

  // 1. Idempotency: Clean up ALL previous demo data
  // Because of onDelete: Cascade, deleting Users will wipe associated Clients, Advocates, Cases, Matches, Requests, etc.
  console.log('Cleaning up existing demo records...');
  await prisma.user.deleteMany({
    where: {
      email: { endsWith: '@example.com' }
    }
  });

  const demoPassword = 'DemoPass123!';
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  // 2. Admin User
  console.log('Seeding Admin...');
  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash,
      role: Role.ADMIN,
    }
  });

  // 3. Advocate Users
  console.log('Seeding Advocates...');
  const advocatesData = [
    { email: 'advocate1@example.com', name: 'Demo Adv Rajesh Kumar', practiceAreas: ['Criminal Law', 'Cyber Law'], verified: VerificationStatus.VERIFIED, avail: true, bar: 'DEMO-BAR-0001', city: 'Pune', languages: ['en', 'hi', 'mr'], fee: '₹10,000 - ₹20,000' },
    { email: 'advocate2@example.com', name: 'Demo Adv Priya Sharma', practiceAreas: ['Family Law', 'Divorce'], verified: VerificationStatus.VERIFIED, avail: true, bar: 'DEMO-BAR-0002', city: 'Mumbai', languages: ['en', 'mr'], fee: '₹5,000 - ₹15,000' },
    { email: 'advocate3@example.com', name: 'Demo Adv Amit Patel', practiceAreas: ['Property Law', 'Real Estate', 'Civil Law'], verified: VerificationStatus.VERIFIED, avail: true, bar: 'DEMO-BAR-0003', city: 'Pune', languages: ['en', 'hi', 'mr'], fee: '₹5,000 - ₹15,000' }, // This matches the Pune Property case
    { email: 'advocate4@example.com', name: 'Demo Adv Sneha Iyer', practiceAreas: ['Corporate Law', 'Business Law'], verified: VerificationStatus.VERIFIED, avail: true, bar: 'DEMO-BAR-0004', city: 'Nashik', languages: ['en', 'hi'], fee: '₹20,000+' },
    { email: 'advocate5@example.com', name: 'Demo Adv Vikram Singh', practiceAreas: ['Consumer Law'], verified: VerificationStatus.VERIFIED, avail: false, bar: 'DEMO-BAR-0005', city: 'Pune', languages: ['en', 'hi'], fee: '₹0 - ₹5,000' },
    { email: 'advocate6@example.com', name: 'Demo Adv Anjali Desai', practiceAreas: ['Cyber Law', 'Criminal Law'], verified: VerificationStatus.VERIFIED, avail: true, bar: 'DEMO-BAR-0006', city: 'Mumbai', languages: ['en', 'mr', 'gu'], fee: '₹10,000 - ₹20,000' },
    { email: 'advocate7@example.com', name: 'Demo Adv Rohan Gupta', practiceAreas: ['Civil Law', 'Property Law'], verified: VerificationStatus.VERIFIED, avail: true, bar: 'DEMO-BAR-0007', city: 'Pune', languages: ['en', 'hi'], fee: '₹20,000+' },
    { email: 'advocate8@example.com', name: 'Demo Adv Neha Verma', practiceAreas: ['Labour Law', 'Employment Law'], verified: VerificationStatus.VERIFIED, avail: true, bar: 'DEMO-BAR-0008', city: 'Mumbai', languages: ['en', 'mr'], fee: '₹5,000 - ₹15,000' },
    { email: 'advocate9@example.com', name: 'Demo Adv Rahul Mehta', practiceAreas: ['Criminal Law'], verified: VerificationStatus.PENDING, avail: true, bar: 'DEMO-BAR-0009', city: 'Pune', languages: ['en', 'hi', 'mr'], fee: '₹5,000 - ₹15,000' },
    { email: 'advocate10@example.com', name: 'Demo Adv Pooja Joshi', practiceAreas: ['Family Law'], verified: VerificationStatus.PENDING, avail: true, bar: 'DEMO-BAR-0010', city: 'Mumbai', languages: ['en', 'mr'], fee: '₹10,000 - ₹20,000' },
    { email: 'advocate11@example.com', name: 'Demo Adv Manish Tiwari', practiceAreas: ['Property Law'], verified: VerificationStatus.PENDING, avail: true, bar: 'DEMO-BAR-0011', city: 'Nagpur', languages: ['en', 'hi'], fee: '₹5,000 - ₹15,000' },
    { email: 'advocate12@example.com', name: 'Demo Adv Kiran Kadam', practiceAreas: ['Civil Law'], verified: VerificationStatus.REJECTED, avail: false, bar: 'DEMO-BAR-0012', city: 'Nashik', languages: ['en', 'mr'], fee: '₹20,000+' },
  ];

  const advocateMap = new Map();

  for (const adv of advocatesData) {
    const user = await prisma.user.create({
      data: {
        email: adv.email,
        passwordHash,
        role: Role.ADVOCATE,
        advocate: {
          create: {
            name: adv.name,
            barRegNumber: adv.bar,
            verifiedStatus: adv.verified,
            city: adv.city,
            state: 'Maharashtra',
            yearsExperience: Math.floor(Math.random() * 20) + 2,
            feeRange: adv.fee,
            practiceAreas: JSON.stringify(adv.practiceAreas),
            languages: JSON.stringify(adv.languages),
            availabilityStatus: adv.avail,
            bio: 'Fictional demo advocate profile for development testing.',
            ratingAvg: 4.5,
            reviewCount: Math.floor(Math.random() * 50)
          }
        }
      },
      include: { advocate: true }
    }) as any;
    advocateMap.set(adv.email, user.advocate);
  }

  // 4. Client Users & Cases
  console.log('Seeding Clients & Cases...');
  
  // Client 1: Multiple cases (OPEN, ONGOING)
  const client1 = await prisma.user.create({
    data: {
      email: 'client1@example.com',
      passwordHash,
      role: Role.CLIENT,
      client: {
        create: {
          name: 'Demo Client One',
          city: 'Pune',
          cases: {
            create: [
              {
                caseType: CaseType.CRIMINAL,
                jurisdiction: 'Pune District Court',
                urgencyLevel: UrgencyLevel.HIGH,
                caseStage: CaseStage.FIR_FILED,
                status: CaseStatus.OPEN,
                structuredSummary: '{"caseType": "CRIMINAL", "summary": "Fictional demo dispute regarding criminal matter."}'
              },
              {
                caseType: CaseType.CIVIL,
                jurisdiction: 'Pune Civil Court',
                urgencyLevel: UrgencyLevel.MEDIUM,
                caseStage: CaseStage.NOTICE_RECEIVED,
                status: CaseStatus.ONGOING,
                structuredSummary: '{"caseType": "CIVIL", "summary": "Fictional demo dispute regarding civil matter."}'
              }
            ]
          }
        }
      }
    },
    include: { client: { include: { cases: true } } }
  });

  // Client 2: One MATCHED case
  const client2 = await prisma.user.create({
    data: {
      email: 'client2@example.com',
      passwordHash,
      role: Role.CLIENT,
      client: {
        create: {
          name: 'Demo Client Two',
          city: 'Mumbai',
          cases: {
            create: [
              {
                caseType: CaseType.FAMILY,
                jurisdiction: 'Mumbai Family Court',
                urgencyLevel: UrgencyLevel.MEDIUM,
                caseStage: CaseStage.INITIAL_PROBLEM,
                status: CaseStatus.MATCHED,
                structuredSummary: '{"caseType": "FAMILY", "summary": "Fictional demo family dispute."}'
              }
            ]
          }
        }
      }
    },
    include: { client: { include: { cases: true } } }
  });

  // Client 3: One CONNECTION_PENDING case
  const client3 = await prisma.user.create({
    data: {
      email: 'client3@example.com',
      passwordHash,
      role: Role.CLIENT,
      client: {
        create: {
          name: 'Demo Client Three',
          city: 'Nagpur',
          cases: {
            create: [
              {
                caseType: CaseType.PROPERTY,
                jurisdiction: 'Nagpur Civil Court',
                urgencyLevel: UrgencyLevel.LOW,
                caseStage: CaseStage.NOTICE_RECEIVED,
                status: CaseStatus.CONNECTION_PENDING,
                structuredSummary: '{"caseType": "PROPERTY", "summary": "Fictional demo property dispute."}'
              }
            ]
          }
        }
      }
    },
    include: { client: { include: { cases: true } } }
  });

  // Client 4: One CONNECTED case
  const client4 = await prisma.user.create({
    data: {
      email: 'client4@example.com',
      passwordHash,
      role: Role.CLIENT,
      client: {
        create: {
          name: 'Demo Client Four',
          city: 'Nashik',
          cases: {
            create: [
              {
                caseType: CaseType.CORPORATE,
                jurisdiction: 'Nashik Commercial Court',
                urgencyLevel: UrgencyLevel.CRITICAL,
                caseStage: CaseStage.COURT_PROCEEDING,
                status: CaseStatus.CONNECTED,
                structuredSummary: '{"caseType": "CORPORATE", "summary": "Fictional demo corporate dispute."}'
              }
            ]
          }
        }
      }
    },
    include: { client: { include: { cases: true } } }
  });

  // Client 5: Empty state (No cases)
  await prisma.user.create({
    data: {
      email: 'client5@example.com',
      passwordHash,
      role: Role.CLIENT,
      client: {
        create: {
          name: 'Demo Client Five',
          city: 'Pune'
        }
      }
    }
  });

  // 5. Matches & Connection Requests
  console.log('Seeding Matches & Requests...');

  // Match for Client 2
  const c2Case = client2.client!.cases[0];
  const c2Advocate = advocateMap.get('advocate2@example.com');
  await prisma.match.create({
    data: {
      caseId: c2Case.id,
      advocateId: c2Advocate.id,
      matchScore: 92.5,
      status: MatchStatus.SUGGESTED,
      scoreBreakdown: JSON.stringify({ specialization: 40, jurisdiction: 30, experience: 22.5 })
    }
  });

  // Request for Client 3 (PENDING)
  const c3Case = client3.client!.cases[0];
  const c3Advocate = advocateMap.get('advocate3@example.com');
  await prisma.connectionRequest.create({
    data: {
      caseId: c3Case.id,
      clientId: client3.client!.id,
      advocateId: c3Advocate.id,
      status: ConnectionRequestStatus.PENDING,
      clientMessage: 'Hello, I have a fictional property dispute and need advice.'
    }
  });
  await prisma.match.create({
    data: {
      caseId: c3Case.id,
      advocateId: c3Advocate.id,
      matchScore: 88,
      status: MatchStatus.ACCEPTED // The match is accepted when request is made
    }
  });

  // Request for Client 4 (ACCEPTED / CONNECTED)
  const c4Case = client4.client!.cases[0];
  const c4Advocate = advocateMap.get('advocate4@example.com');
  await prisma.connectionRequest.create({
    data: {
      caseId: c4Case.id,
      clientId: client4.client!.id,
      advocateId: c4Advocate.id,
      status: ConnectionRequestStatus.ACCEPTED,
      clientMessage: 'Urgent corporate matter, please review.',
      advocateResponse: 'I am available to assist with this fictional dispute.',
      respondedAt: new Date()
    }
  });
  await prisma.match.create({
    data: {
      caseId: c4Case.id,
      advocateId: c4Advocate.id,
      matchScore: 95,
      status: MatchStatus.ACCEPTED 
    }
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
