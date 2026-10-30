import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenAI } from '@google/genai';
import { INTAKE_SYSTEM_PROMPT } from './prompts/intake-system-prompt';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private gemini: GoogleGenAI | null = null;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.NODE_ENV === 'test' ? null : process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.gemini = new GoogleGenAI({
        apiKey,
      });
      this.logger.log('Gemini API initialized successfully.');
    } else {
      this.logger.error('GEMINI_API_KEY is not set. Real AI intake will fail.');
    }
  }

  private async getClientId(userId: string): Promise<string> {
    const client = await this.prisma.client.findUnique({
      where: { userId },
    });
    if (!client) {
      throw new ForbiddenException('Client profile not found for this user');
    }
    return client.id;
  }

  async createSession(userId: string, language: string = 'en') {
    const clientId = await this.getClientId(userId);

    const session = await this.prisma.chatSession.create({
      data: {
        clientId,
        language,
      },
    });

    let initialMessageContent = 'I can help organize the details so we can connect you with an appropriate advocate. I cannot provide legal advice or predict the outcome. What happened with your situation?';
    if (language === 'hi') {
      initialMessageContent = 'मैं आपकी स्थिति की जानकारी व्यवस्थित करने में मदद कर सकता हूँ ताकि आपको उपयुक्त अधिवक्ता से जोड़ा जा सके। मैं कानूनी सलाह नहीं देता। कृपया बताएं कि यह मामला कितना जरूरी है?';
    } else if (language === 'mr') {
      initialMessageContent = 'मी तुमच्या परिस्थितीची माहिती व्यवस्थित करण्यात मदत करू शकतो, जेणेकरून तुम्हाला योग्य वकिलाशी जोडता येईल. मी कायदेशीर सल्ला देत नाही. कृपया सांगा, हे प्रकरण किती तातडीचे आहे?';
    }

    const initialMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: initialMessageContent,
      },
    });

    return {
      sessionId: session.id,
      message: initialMessage,
    };
  }

  async getSessionHistory(userId: string, sessionId: string) {
    const clientId = await this.getClientId(userId);

    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.clientId !== clientId) {
      throw new ForbiddenException(
        'You do not have permission to access this session',
      );
    }

    return session;
  }

  async sendMessage(userId: string, sessionId: string, messageContent: string) {
    const clientId = await this.getClientId(userId);

    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.clientId !== clientId) {
      throw new ForbiddenException(
        'You do not have permission to access this session',
      );
    }

    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'USER',
        content: messageContent,
      },
    });

    let assistantResponseText = '';
    let parsedIntakeState: any = null;

    if (!this.gemini) {
      assistantResponseText =
        'I am a mock intake assistant (AI API key is not configured). I have noted your message and can assist in gathering the facts of your case for advocate matching. Could you provide your city and the urgency of your matter?';
      parsedIntakeState = {
        caseType: 'CIVIL',
        jurisdiction: { city: 'Pune', state: 'Maharashtra', court: null },
        urgencyLevel: 'MEDIUM',
        caseStage: 'INITIAL_PROBLEM',
        factualSummary: messageContent,
        missingFields: [],
        isReadyForMatching: true,
      };
    } else {
      try {
        // Fetch previous messages for context
        const pastMessages = await this.prisma.chatMessage.findMany({
          where: { sessionId },
          orderBy: { createdAt: 'asc' },
        });

        // Format for Gemini
        let formattedMessages = pastMessages
          .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
          .map((m) => ({
            role: m.role === 'USER' ? 'user' : 'model',
            parts: [{ text: m.content }],
          }));

        if (formattedMessages.length === 0) {
          formattedMessages = [
            {
              role: 'user',
              parts: [{ text: messageContent }],
            },
          ];
        }

        const dynamicPrompt = `${INTAKE_SYSTEM_PROMPT}\n\nIMPORTANT: The user has selected the language code '${session.language}'. You must respond in this language. If the language is 'hi', respond in Hindi (Devanagari script). If the language is 'mr', respond in Marathi (Devanagari script). Understand and process inputs if the user types in Hinglish or Romanized Marathi, but your response should be properly written in the selected language. Your extracted JSON data must remain in English to maintain internal system standardisation.`;

        const response = await this.gemini.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: formattedMessages,
          config: {
            systemInstruction: dynamicPrompt,
            responseMimeType: 'application/json',
          },
        });

        if (response.text) {
          const rawResponse = response.text;

          // Parse JSON
          try {
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : rawResponse;
            const parsedData = JSON.parse(jsonString);

            assistantResponseText =
              parsedData.assistantMessage || 'I understand. Please continue.';
            parsedIntakeState = parsedData.intakeState || null;
          } catch (e) {
            this.logger.error('Failed to parse Gemini JSON response', e);
            assistantResponseText =
              'I understand your situation. Could you provide more details regarding your city, any notices received, and your desired outcome?';
          }
        } else {
          assistantResponseText =
            'I understand your situation. Could you provide more details regarding your city and the urgency of this matter?';
        }
      } catch (error) {
        this.logger.error('Failed to communicate with Gemini API, using fallback', error);
        assistantResponseText =
          'I am your legal intake assistant. I have recorded your details and am analyzing the case parameters for matching. Please confirm your location and any deadlines.';
        parsedIntakeState = {
          caseType: 'CIVIL',
          jurisdiction: { city: 'Pune', state: 'Maharashtra', court: null },
          urgencyLevel: 'MEDIUM',
          caseStage: 'INITIAL_PROBLEM',
          factualSummary: messageContent,
          missingFields: [],
          isReadyForMatching: true,
        };
      }
    }

    // Save assistant message to DB
    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: assistantResponseText,
      },
    });
    
    // Update the session's temporary case state if a case is linked?
    // The instructions state we maintain structured intake state.
    // Instead of forcing a DB save every message, we can just return it to frontend.
    // However, the best place is to store the ongoing intake state in the session?
    // Since we extract the final on "End Chat", returning it here is enough for the frontend.
    // Or we update the caseId if it exists. 
    if (session.caseId && parsedIntakeState) {
      await this.prisma.case.update({
        where: { id: session.caseId },
        data: {
          structuredSummary: JSON.stringify(parsedIntakeState),
        }
      });
    }

    // Return combined object to satisfy the frontend's ChatMessage interface
    // while also returning the intake state as requested.
    return {
      ...assistantMessage,
      intake: parsedIntakeState,
      isReadyForMatching: parsedIntakeState?.isReadyForMatching || false
    };
  }
}
