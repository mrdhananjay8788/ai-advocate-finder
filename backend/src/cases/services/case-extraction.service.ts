import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleGenAI } from '@google/genai';
import { EXTRACTION_SYSTEM_PROMPT } from '../prompts/extraction-system-prompt';
import { CaseProfileDto } from '../dto/case-profile.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CaseType, UrgencyLevel, CaseStage } from '../../prisma-enums';;

@Injectable()
export class CaseExtractionService {
  private readonly logger = new Logger(CaseExtractionService.name);
  private gemini: GoogleGenAI | null = null;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.gemini = new GoogleGenAI({ apiKey });
    }
  }

  private normalizeEnum<T extends Record<string, string>>(
    enumObj: T,
    value: any,
    fallback: T[keyof T] | null = null,
  ): T[keyof T] | null {
    if (!value) return fallback;
    const upperValue = String(value).toUpperCase();
    if (Object.values(enumObj).includes(upperValue)) {
      return upperValue as T[keyof T];
    }
    return fallback;
  }

  async extractCaseProfile(transcript: string): Promise<CaseProfileDto> {
    let rawJson = '';

    if (this.gemini) {
      try {
        const response = await this.gemini.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `Extract the case profile from the following transcript:\n\n${transcript}`,
          config: {
            systemInstruction: EXTRACTION_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
          }
        });

        if (response.text) {
          rawJson = response.text;
        }
      } catch (error) {
        this.logger.error('Failed LLM extraction', error);
      }
    }

    // Mock Fallback or if LLM failed
    if (!rawJson) {
      rawJson = JSON.stringify({
        caseType: 'OTHER',
        jurisdiction: {
          city: 'Mock City',
          state: 'Mock State',
          court: null,
        },
        urgencyLevel: 'MEDIUM',
        budgetRange: null,
        language: 'English',
        caseStage: 'INITIAL_PROBLEM',
        factualSummary:
          'This is a fallback mock extraction because the LLM was unavailable or failed.',
      });
    }

    // Try parsing
    let parsed: any = {};
    try {
      // Sometimes LLMs return markdown despite being told not to
      const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(rawJson);
      }
    } catch (e) {
      this.logger.error('Failed to parse LLM JSON', e);
      parsed = {};
    }

    // Normalize values
    const normalizedData = {
      caseType: this.normalizeEnum(CaseType, parsed.caseType, CaseType.OTHER),
      jurisdiction: {
        city: parsed.jurisdiction?.city || null,
        state: parsed.jurisdiction?.state || null,
        court: parsed.jurisdiction?.court || null,
      },
      urgencyLevel: this.normalizeEnum(UrgencyLevel, parsed.urgencyLevel, null),
      budgetRange: parsed.budgetRange || null,
      language: parsed.language || null,
      caseStage: this.normalizeEnum(
        CaseStage,
        parsed.caseStage,
        CaseStage.OTHER,
      ),
      factualSummary: parsed.factualSummary || null,
      missingFields: parsed.missingFields || [],
      isReadyForMatching: parsed.isReadyForMatching || false,
    };

    const instance = plainToInstance(CaseProfileDto, normalizedData);
    const errors = await validate(instance);

    if (errors.length > 0) {
      this.logger.warn(
        'Extraction validation failed. Falling back to safe defaults.',
        errors,
      );
      // Fallback
      return {
        caseType: CaseType.OTHER,
        jurisdiction: { city: null, state: null, court: null },
        urgencyLevel: null,
        budgetRange: null,
        language: null,
        caseStage: CaseStage.OTHER,
        factualSummary: 'Extraction failed due to validation errors.',
        missingFields: [],
        isReadyForMatching: false,
      };
    }

    return instance;
  }
}
