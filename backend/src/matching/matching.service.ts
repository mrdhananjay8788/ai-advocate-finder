import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdvocateScoringService } from './scoring/advocate-scoring.service';
import { CaseStatus, VerificationStatus, MatchStatus } from '../prisma-enums';;

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: AdvocateScoringService,
  ) {}

  /**
   * Generates matches for a given case.
   * Returns a list of advocate match records sorted by matchScore.
   */
  async matchCase(clientId: string, caseId: string) {
    // 1. Verify case exists and ownership
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData || caseData.deletedAt) {
      throw new NotFoundException('Case not found');
    }

    if (caseData.clientId !== clientId) {
      throw new ForbiddenException('You do not own this case');
    }

    // 2. Verify intake is confirmed
    // Only cases whose intake has been confirmed should be eligible for matching.
    if (caseData.status !== CaseStatus.INTAKE_COMPLETED) {
      throw new BadRequestException(
        'Case intake must be completed before matching',
      );
    }

    // 3. Retrieve eligible advocates
    // verifiedStatus = VERIFIED and availabilityStatus != UNAVAILABLE
    const eligibleAdvocates = await this.prisma.advocate.findMany({
      where: {
        verifiedStatus: VerificationStatus.VERIFIED,
        availabilityStatus: true, // true = available
      },
    });

    // 4. Calculate score for each advocate
    const matches = eligibleAdvocates.map((advocate) => {
      return this.scoringService.calculateScore(caseData, advocate);
    });

    // 5. Sort descending by score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Filter to a reasonable top N (e.g., top 10)
    const topMatches = matches.slice(0, 10);

    // 6. Store match records
    const results = [];
    for (const match of topMatches) {
      const matchRecord = await this.prisma.match.upsert({
        where: {
          caseId_advocateId: {
            caseId: caseId,
            advocateId: match.advocateId,
          },
        },
        update: {
          matchScore: match.matchScore,
          scoreBreakdown: match.scoreBreakdown as any,
          // Do not reset status if already accepted/declined, maybe in real system, but for now just update score
        },
        create: {
          caseId: caseId,
          advocateId: match.advocateId,
          matchScore: match.matchScore,
          scoreBreakdown: match.scoreBreakdown as any,
        },
      });

      // Load advocate details for response
      const advocateDetails = eligibleAdvocates.find(
        (a) => a.id === match.advocateId,
      );
      if (!advocateDetails) continue;

      results.push({
        advocateId: advocateDetails.id,
        name: advocateDetails.name,
        matchScore: match.matchScore,
        rating: advocateDetails.ratingAvg,
        reviewCount: advocateDetails.reviewCount,
        yearsExperience: advocateDetails.yearsExperience,
        city: advocateDetails.city,
        verified:
          advocateDetails.verifiedStatus === VerificationStatus.VERIFIED,
        availability: advocateDetails.availabilityStatus
          ? 'AVAILABLE'
          : 'UNAVAILABLE',
        scoreBreakdown: match.scoreBreakdown,
        practiceAreas: advocateDetails.practiceAreas,
        feeRange: advocateDetails.feeRange,
        languages: advocateDetails.languages,
      });
    }

    // Optional: mark case as matched if there are results
    if (results.length > 0) {
      await this.prisma.case.update({
        where: { id: caseId },
        data: { status: CaseStatus.MATCHED },
      });
    }

    return {
      caseId,
      matches: results,
    };
  }

  /**
   * Retrieve existing matches for a case
   */
  async getMatches(clientId: string, caseId: string) {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData || caseData.deletedAt) {
      throw new NotFoundException('Case not found');
    }

    if (caseData.clientId !== clientId) {
      throw new ForbiddenException('You do not own this case');
    }

    const matches = await this.prisma.match.findMany({
      where: { caseId },
      include: {
        advocate: true,
      },
      orderBy: { matchScore: 'desc' },
    });

    return {
      caseId,
      matches: matches.map((m) => ({
        advocateId: m.advocate.id,
        name: m.advocate.name,
        matchScore: m.matchScore,
        rating: m.advocate.ratingAvg,
        reviewCount: m.advocate.reviewCount,
        yearsExperience: m.advocate.yearsExperience,
        city: m.advocate.city,
        verified: m.advocate.verifiedStatus === VerificationStatus.VERIFIED,
        availability: m.advocate.availabilityStatus
          ? 'AVAILABLE'
          : 'UNAVAILABLE',
        scoreBreakdown: m.scoreBreakdown,
        practiceAreas: m.advocate.practiceAreas,
        feeRange: m.advocate.feeRange,
        languages: m.advocate.languages,
        matchStatus: m.status,
      })),
    };
  }

  /**
   * Retrieve matches for an advocate (omits sensitive case info)
   */
  async getMatchesForAdvocate(advocateId: string) {
    const matches = await this.prisma.match.findMany({
      where: { advocateId },
      include: {
        case: {
          select: {
            id: true,
            caseType: true,
            jurisdiction: true,
            urgencyLevel: true,
            budgetRange: true,
            caseStage: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            // Explicitly omitting rawTranscript and structuredSummary for privacy
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      matches: matches.map((m) => ({
        id: m.id,
        matchScore: m.matchScore,
        scoreBreakdown: m.scoreBreakdown,
        status: m.status,
        createdAt: m.createdAt,
        case: m.case,
      })),
    };
  }

  /**
   * Update match status (Accept/Decline)
   */
  async updateMatchStatus(advocateId: string, matchId: string, status: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.advocateId !== advocateId) {
      throw new ForbiddenException(
        'You are not authorized to update this match',
      );
    }

    if (match.status !== MatchStatus.SUGGESTED) {
      throw new BadRequestException(
        `Cannot change status from ${match.status}`,
      );
    }

    if (status !== MatchStatus.ACCEPTED && status !== MatchStatus.DECLINED) {
      throw new BadRequestException(
        'Invalid status. Must be ACCEPTED or DECLINED.',
      );
    }

    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: { status: status },
    });

    return updatedMatch;
  }
}
