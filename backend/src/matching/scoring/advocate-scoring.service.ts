import { Injectable } from '@nestjs/common';
import { Case, Advocate } from '@prisma/client';

export interface ScoreBreakdown {
  specialization: number;
  jurisdiction: number;
  language: number;
  experience: number;
  budget: number;
  availability: number;
}

export interface MatchResult {
  advocateId: string;
  matchScore: number;
  scoreBreakdown: ScoreBreakdown;
}

@Injectable()
export class AdvocateScoringService {
  /**
   * Calculates the total match score between a case and an advocate.
   * Maximum total score is 100 points.
   */
  calculateScore(caseData: Case, advocate: Advocate): MatchResult {
    const specialization = this.scoreSpecialization(caseData, advocate);
    const jurisdiction = this.scoreJurisdiction(caseData, advocate);
    const language = this.scoreLanguage(caseData, advocate);
    const experience = this.scoreExperience(advocate);
    const budget = this.scoreBudget(caseData, advocate);
    const availability = this.scoreAvailability(advocate);

    const matchScore =
      specialization +
      jurisdiction +
      language +
      experience +
      budget +
      availability;

    // Ensure it does not exceed 100
    const clampedScore = Math.min(100, Math.max(0, matchScore));

    return {
      advocateId: advocate.id,
      matchScore: clampedScore,
      scoreBreakdown: {
        specialization,
        jurisdiction,
        language,
        experience,
        budget,
        availability,
      },
    };
  }

  private normalizeString(str?: string | null): string {
    if (!str) return '';
    // Lowercase and remove basic punctuation and extra whitespace
    return str
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * SPECIALIZATION MATCH = 40 points
   * Map case types to practice areas.
   */
  private scoreSpecialization(caseData: Case, advocate: Advocate): number {
    const caseTypeMapping: Record<string, string[]> = {
      property: ['property law', 'civil law', 'real estate'],
      criminal: ['criminal law'],
      family: ['family law', 'divorce'],
      corporate: ['corporate law', 'business law'],
      cybercrime: ['cyber law', 'criminal law'],
      consumer: ['consumer law'],
      labour: ['labour law', 'employment law'],
      civil: ['civil law'],
    };

    const caseTypeStr = this.normalizeString(caseData.caseType).replace(/\s+/g, '_');
    const mappedAreas = caseTypeMapping[caseTypeStr] || [caseTypeStr]; // Fallback to raw string

    // Advocate practice areas are stored as JSON string `["Property Law", ...]`
    let advAreas: string[] = [];
    try {
      advAreas = JSON.parse(advocate.practiceAreas || '[]');
    } catch {
      advAreas = [advocate.practiceAreas];
    }

    const normalizedAdvAreas = advAreas.map(a => this.normalizeString(a));

    for (const mappedArea of mappedAreas) {
      if (normalizedAdvAreas.includes(this.normalizeString(mappedArea))) {
        return 40;
      }
    }

    // Partial match on substring
    for (const area of normalizedAdvAreas) {
      if (mappedAreas.some(m => m.includes(area) || area.includes(m))) {
        return 20; // Partial score
      }
    }

    return 0;
  }

  /**
   * JURISDICTION SCORE = 20 points
   * Exact city match = 20 points
   * Same state but different city = 10 points
   * No match = 0 points
   */
  private scoreJurisdiction(caseData: Case, advocate: Advocate): number {
    const caseJurisdiction = this.normalizeString(caseData.jurisdiction);
    const advCity = this.normalizeString(advocate.city);
    const advState = this.normalizeString(advocate.state);

    // Attempt basic parsing from case jurisdiction if it follows "City, State"
    // Since Case jurisdiction is stored as a single string, we check includes.
    if (advCity && caseJurisdiction.includes(advCity)) {
      return 20;
    }

    if (advState && caseJurisdiction.includes(advState)) {
      return 10;
    }

    return 0;
  }

  /**
   * EXPERIENCE SCORE = 10 points
   * 10+ years -> 10, 7-9 -> 8, 4-6 -> 6, 1-3 -> 4, 0 -> 0
   */
  private scoreExperience(advocate: Advocate): number {
    const exp = advocate.yearsExperience || 0;

    if (exp >= 10) return 10;
    if (exp >= 7) return 8;
    if (exp >= 4) return 6;
    if (exp >= 1) return 4;
    return 0;
  }

  /**
   * AVAILABILITY SCORE = 10 points
   * AVAILABLE -> 10, UNAVAILABLE -> 0
   * Stored as a boolean true = available, false = unavailable.
   */
  private scoreAvailability(advocate: Advocate): number {
    return advocate.availabilityStatus ? 10 : 0;
  }

  /**
   * BUDGET SCORE = 10 points
   */
  private scoreBudget(caseData: Case, advocate: Advocate): number {
    const cBudget = this.normalizeString(caseData.budgetRange);
    const aFee = this.normalizeString(advocate.feeRange);

    if (!cBudget || !aFee) {
      return 0;
    }

    if (cBudget === aFee) {
      return 10;
    }

    // Can add partial logic
    return 0;
  }

  /**
   * LANGUAGE SCORE = 10 points
   */
  private scoreLanguage(caseData: Case, advocate: Advocate): number {
    const caseLang = this.normalizeString(caseData.language);
    
    let advLangs: string[] = [];
    try {
      advLangs = JSON.parse(advocate.languages || '[]');
    } catch {
      advLangs = [advocate.languages];
    }

    if (!caseLang || !advLangs || advLangs.length === 0) {
      return 0;
    }

    for (const lang of advLangs) {
      if (this.normalizeString(lang).includes(caseLang) || caseLang.includes(this.normalizeString(lang))) {
        return 10;
      }
    }

    return 0;
  }
}
