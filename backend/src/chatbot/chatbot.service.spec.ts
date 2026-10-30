import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ChatbotService', () => {
  let service: ChatbotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        {
          provide: PrismaService,
          useValue: {
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
            case: {
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
