import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { CaseExtractionService } from '../cases/services/case-extraction.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ChatbotController', () => {
  let controller: ChatbotController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotController],
      providers: [
        {
          provide: ChatbotService,
          useValue: {
            createSession: jest.fn(),
            getSessionHistory: jest.fn(),
            sendMessage: jest.fn(),
          },
        },
        {
          provide: CaseExtractionService,
          useValue: {
            extractCaseProfile: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            chatSession: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            case: {
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<ChatbotController>(ChatbotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
