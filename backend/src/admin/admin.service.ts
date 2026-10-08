import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationStatus, CaseStatus, MatchStatus } from '../prisma-enums';;
import { UpdateVerificationDto } from './dto/update-verification.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      totalClients,
      totalAdvocates,
      verifiedAdvocates,
      pendingVerification,
      totalCases,
      openCases,
      matchedCases,
      totalMatches,
    ] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.advocate.count(),
      this.prisma.advocate.count({ where: { verifiedStatus: 'VERIFIED' } }),
      this.prisma.advocate.count({ where: { verifiedStatus: 'PENDING' } }),
      this.prisma.case.count(),
      this.prisma.case.count({ where: { status: 'OPEN' } }),
      this.prisma.case.count({
        where: {
          status: { in: ['MATCHED', 'CONNECTED', 'ONGOING', 'CLOSED'] },
        },
      }), // Or just any match
      this.prisma.match.count(),
    ]);

    return {
      totalClients,
      totalAdvocates,
      verifiedAdvocates,
      pendingVerification,
      totalCases,
      openCases,
      matchedCases,
      totalMatches,
    };
  }

  async getPendingAdvocates() {
    return this.prisma.advocate.findMany({
      where: { verifiedStatus: 'PENDING' },
      select: {
        id: true,
        name: true,
        barRegNumber: true,
        city: true,
        state: true,
        practiceAreas: true,
        yearsExperience: true,
        createdAt: true,
        verifiedStatus: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAdvocateVerification(
    id: string,
    updateVerificationDto: UpdateVerificationDto,
  ) {
    const advocate = await this.prisma.advocate.findUnique({ where: { id } });
    if (!advocate) {
      throw new NotFoundException('Advocate not found');
    }

    // Simple state machine: Only allow PENDING -> VERIFIED or PENDING -> REJECTED
    // unless you want more flexible transitions, but instructions suggest controlled transitions
    if (advocate.verifiedStatus !== 'PENDING') {
      throw new BadRequestException(
        `Cannot change verification status from ${advocate.verifiedStatus}`,
      );
    }

    return this.prisma.advocate.update({
      where: { id },
      data: { verifiedStatus: updateVerificationDto.verifiedStatus },
    });
  }

  async getAdvocates(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.advocate.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          verifiedStatus: true,
          city: true,
          state: true,
          practiceAreas: true,
          yearsExperience: true,
          ratingAvg: true,
          availabilityStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.advocate.count(),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getClients(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          city: true,
          createdAt: true,
          _count: {
            select: { cases: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count(),
    ]);

    return {
      data: items.map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        createdAt: c.createdAt,
        caseCount: c._count.cases,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCaseStats() {
    const [totalCases, statusCounts, typeCounts, urgencyCounts] =
      await Promise.all([
        this.prisma.case.count(),
        this.prisma.case.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.case.groupBy({
          by: ['caseType'],
          _count: { _all: true },
        }),
        this.prisma.case.groupBy({
          by: ['urgencyLevel'],
          _count: { _all: true },
        }),
      ]);

    return {
      totalCases,
      byStatus: statusCounts.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      byType: typeCounts.map((t) => ({
        type: t.caseType,
        count: t._count._all,
      })),
      byUrgency: urgencyCounts.map((u) => ({
        urgency: u.urgencyLevel,
        count: u._count._all,
      })),
    };
  }

  async getCases(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.case.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          caseType: true,
          jurisdiction: true,
          urgencyLevel: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.case.count(),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMatchesStats() {
    const [totalMatches, statusCounts] = await Promise.all([
      this.prisma.match.count(),
      this.prisma.match.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const suggested =
      statusCounts.find((s) => s.status === 'SUGGESTED')?._count._all || 0;
    const accepted =
      statusCounts.find((s) => s.status === 'ACCEPTED')?._count._all || 0;
    const declined =
      statusCounts.find((s) => s.status === 'DECLINED')?._count._all || 0;

    // Average match score requires an aggregation
    const avgResult = await this.prisma.match.aggregate({
      _avg: {
        matchScore: true,
      },
    });

    return {
      totalMatches,
      suggested,
      accepted,
      declined,
      averageScore: avgResult._avg.matchScore || 0,
    };
  }

  async getMatches(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.match.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          matchScore: true,
          status: true,
          createdAt: true,
          case: {
            select: {
              id: true,
              caseType: true,
            },
          },
          advocate: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.match.count(),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getChatbotAudit(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.chatSession.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          clientId: true,
          caseId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.chatSession.count(),
    ]);

    return {
      data: items.map((s) => ({
        id: s.id,
        clientId: s.clientId, // In a real system you might pseudonymise this
        caseId: s.caseId,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s._count.messages,
        extractionFailed: s.status === 'ABANDONED', // Simple flag logic based on schema
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReviews() {
    // Review model does not exist yet. Returning empty or placeholder info.
    return {
      message:
        'Review moderation will be available when client review functionality is enabled.',
      data: [],
    };
  }
}
