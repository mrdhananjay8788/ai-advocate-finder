import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConnectionRequestDto } from './dto/create-connection-request.dto';
import { AdvocateResponseDto } from './dto/advocate-response.dto';
import { ConnectionRequestStatus, CaseStatus } from '../prisma-enums';;

@Injectable()
export class ConnectionRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createDto: CreateConnectionRequestDto) {
    const { caseId, advocateId, message } = createDto;

    // 1. User role must be CLIENT (checked by Guards)
    // 2. Case must belong to logged-in client
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const caseRec = await this.prisma.case.findUnique({
      where: { id: caseId },
    });
    if (!caseRec) throw new NotFoundException('Case not found');
    if (caseRec.clientId !== client.id)
      throw new ForbiddenException('Case does not belong to you');

    // 3. Case must not be CLOSED
    if (caseRec.status === CaseStatus.CLOSED) {
      throw new BadRequestException(
        'Cannot request connection for a closed case',
      );
    }

    // 4. Advocate must exist & be verified
    const advocate = await this.prisma.advocate.findUnique({
      where: { id: advocateId },
    });
    if (!advocate) throw new NotFoundException('Advocate not found');
    if (advocate.verifiedStatus !== 'VERIFIED')
      throw new BadRequestException('Advocate is not verified yet');
    if (!advocate.availabilityStatus)
      throw new BadRequestException('Advocate is currently unavailable');

    // 5. Duplicate PENDING requests must be prevented
    const existing = await this.prisma.connectionRequest.findUnique({
      where: {
        caseId_advocateId: {
          caseId,
          advocateId,
        },
      },
    });

    if (existing) {
      if (existing.status === ConnectionRequestStatus.PENDING) {
        throw new ConflictException(
          'An active connection request already exists.',
        );
      } else if (existing.status === ConnectionRequestStatus.ACCEPTED) {
        throw new ConflictException('Connection request was already accepted.');
      } else {
        // If declined or cancelled, we could theoretically allow re-request, but to be safe for now
        // we might just throw or update. Let's just update if it's cancelled/declined.
        return this.prisma.connectionRequest.update({
          where: { id: existing.id },
          data: {
            status: ConnectionRequestStatus.PENDING,
            clientMessage: message,
            updatedAt: new Date(),
          },
        });
      }
    }

    return this.prisma.connectionRequest.create({
      data: {
        caseId,
        clientId: client.id,
        advocateId,
        clientMessage: message,
        status: ConnectionRequestStatus.PENDING,
      },
    });
  }

  async findClientRequests(userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    return this.prisma.connectionRequest.findMany({
      where: { clientId: client.id },
      include: {
        advocate: {
          select: {
            name: true,
            verifiedStatus: true,
            practiceAreas: true,
            city: true,
            state: true,
            ratingAvg: true,
          },
        },
        case: {
          select: {
            caseType: true,
            jurisdiction: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelRequest(userId: string, requestId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const request = await this.prisma.connectionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.clientId !== client.id)
      throw new ForbiddenException('Not your request');

    if (request.status !== ConnectionRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    return this.prisma.connectionRequest.update({
      where: { id: requestId },
      data: { status: ConnectionRequestStatus.CANCELLED },
    });
  }

  async findAdvocateRequests(userId: string) {
    const advocate = await this.prisma.advocate.findUnique({
      where: { userId },
    });
    if (!advocate) throw new NotFoundException('Advocate profile not found');

    return this.prisma.connectionRequest.findMany({
      where: { advocateId: advocate.id },
      include: {
        case: {
          select: {
            caseType: true,
            jurisdiction: true,
            urgencyLevel: true,
            caseStage: true,
            budgetRange: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptRequest(userId: string, requestId: string) {
    const advocate = await this.prisma.advocate.findUnique({
      where: { userId },
    });
    if (!advocate) throw new NotFoundException('Advocate profile not found');

    const request = await this.prisma.connectionRequest.findUnique({
      where: { id: requestId },
      include: { case: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.advocateId !== advocate.id)
      throw new ForbiddenException('Not your request');

    if (request.status !== ConnectionRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot accept a request with status ${request.status}`,
      );
    }

    const updatedRequest = await this.prisma.connectionRequest.update({
      where: { id: requestId },
      data: {
        status: ConnectionRequestStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    // Case Integration: Update case to CONNECTED if it safely allows
    const caseRec = request.case;
    if (
      caseRec &&
      caseRec.status !== CaseStatus.CLOSED &&
      caseRec.status !== CaseStatus.ONGOING
    ) {
      await this.prisma.case.update({
        where: { id: caseRec.id },
        data: { status: CaseStatus.CONNECTED },
      });
    }

    return updatedRequest;
  }

  async declineRequest(
    userId: string,
    requestId: string,
    declineDto: AdvocateResponseDto,
  ) {
    const advocate = await this.prisma.advocate.findUnique({
      where: { userId },
    });
    if (!advocate) throw new NotFoundException('Advocate profile not found');

    const request = await this.prisma.connectionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.advocateId !== advocate.id)
      throw new ForbiddenException('Not your request');

    if (request.status !== ConnectionRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be declined');
    }

    return this.prisma.connectionRequest.update({
      where: { id: requestId },
      data: {
        status: ConnectionRequestStatus.DECLINED,
        advocateResponse: declineDto.response,
        respondedAt: new Date(),
      },
    });
  }

  async getConnectionDetails(
    userId: string,
    requestId: string,
    userRole: string,
  ) {
    const request: any = await this.prisma.connectionRequest.findUnique({
      where: { id: requestId },
      include: {
        client: {
          select: {
            id: true,
            userId: true,
            name: true,
            phone: true,
            user: { select: { email: true } },
          },
        },
        advocate: {
          select: {
            id: true,
            userId: true,
            name: true,
            user: { select: { email: true, phone: true } },
            city: true,
            state: true,
            bio: true,
            practiceAreas: true,
          },
        },
        case: {
          select: {
            caseType: true,
            jurisdiction: true,
            structuredSummary: true,
            urgencyLevel: true,
          },
        },
      },
    });

    if (!request) throw new NotFoundException('Request not found');

    // Privacy protection
    let isClient = false;
    let isAdvocate = false;

    if (userRole === 'CLIENT') {
      const client = await this.prisma.client.findUnique({ where: { userId } });
      if (client && request.clientId === client.id) isClient = true;
    } else if (userRole === 'ADVOCATE') {
      const advocate = await this.prisma.advocate.findUnique({
        where: { userId },
      });
      if (advocate && request.advocateId === advocate.id) isAdvocate = true;
    }

    if (!isClient && !isAdvocate) {
      throw new ForbiddenException('You do not have access to this connection');
    }

    if (request.status !== ConnectionRequestStatus.ACCEPTED) {
      throw new ForbiddenException(
        'Connection details are only available for ACCEPTED requests',
      );
    }

    return {
      status: request.status,
      clientMessage: request.clientMessage,
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
      client: {
        name: request.client.name,
        email: request.client.user.email,
        phone: request.client.phone || request.client.user.phone,
      },
      advocate: {
        name: request.advocate.name,
        email: request.advocate.user.email,
        phone: request.advocate.user.phone,
        bio: request.advocate.bio,
        location: `${request.advocate.city}, ${request.advocate.state}`,
        practiceAreas: request.advocate.practiceAreas,
      },
      case: request.case,
    };
  }
}
