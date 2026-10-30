import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { CaseExtractionService } from '../cases/services/case-extraction.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('api/chatbot/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly caseExtractionService: CaseExtractionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(Role.CLIENT)
  createSession(@Request() req: any, @Body('language') language?: string) {
    return this.chatbotService.createSession(req.user.id, language);
  }

  @Get(':sessionId')
  @Roles(Role.CLIENT)
  getSessionHistory(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ) {
    return this.chatbotService.getSessionHistory(req.user.id, sessionId);
  }

  @Post(':sessionId/messages')
  @Roles(Role.CLIENT)
  sendMessage(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() data: SendMessageDto,
  ) {
    return this.chatbotService.sendMessage(
      req.user.id,
      sessionId,
      data.message,
    );
  }

  @Post(':sessionId/extract')
  @Roles(Role.CLIENT)
  async extractCaseProfile(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ) {
    // Verify ownership
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        client: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session || session.client.userId !== req.user.id) {
      throw new ForbiddenException('Access denied');
    }

    const transcript = session.messages
      .map((m) => `[${m.role}] ${m.content}`)
      .join('\n');

    // Call extraction service
    const extractedProfile =
      await this.caseExtractionService.extractCaseProfile(transcript);

    const isReady =
      extractedProfile.isReadyForMatching !== undefined
        ? extractedProfile.isReadyForMatching
        : Boolean(
            extractedProfile.caseType &&
              (extractedProfile.jurisdiction?.city ||
                extractedProfile.jurisdiction?.state),
          );

    if (!isReady) {
      const missing = (extractedProfile.missingFields || []).join(', ');
      throw new BadRequestException(
        `Case profile is incomplete. Please provide more information about: ${missing || 'case details'}`,
      );
    }

    // Format jurisdiction
    const jurisdictionStr =
      [
        extractedProfile.jurisdiction?.city,
        extractedProfile.jurisdiction?.state,
      ]
        .filter(Boolean)
        .join(', ') || 'Unknown';

    // Create or update Case
    let caseRecord;
    if (session.caseId) {
      caseRecord = await this.prisma.case.update({
        where: { id: session.caseId },
        data: {
          caseType: extractedProfile.caseType || 'OTHER',
          jurisdiction: jurisdictionStr,
          urgencyLevel: extractedProfile.urgencyLevel || 'MEDIUM',
          budgetRange: extractedProfile.budgetRange,
          language: extractedProfile.language,
          caseStage: extractedProfile.caseStage || 'OTHER',
          structuredSummary: JSON.stringify(extractedProfile),
          rawTranscript: transcript,
          status: 'OPEN',
        },
      });
    } else {
      caseRecord = await this.prisma.case.create({
        data: {
          clientId: session.clientId,
          caseType: extractedProfile.caseType || 'OTHER',
          jurisdiction: jurisdictionStr,
          urgencyLevel: extractedProfile.urgencyLevel || 'MEDIUM',
          budgetRange: extractedProfile.budgetRange,
          language: extractedProfile.language,
          caseStage: extractedProfile.caseStage || 'OTHER',
          structuredSummary: JSON.stringify(extractedProfile),
          rawTranscript: transcript,
          status: 'OPEN',
        },
      });

      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { caseId: caseRecord.id, status: 'COMPLETED' },
      });
    }

    return {
      caseId: caseRecord.id,
      structuredProfile: extractedProfile,
    };
  }
}
