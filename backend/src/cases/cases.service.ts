import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper method to resolve clientId from userId safely
  private async getClientId(userId: string): Promise<string> {
    const client = await this.prisma.client.findUnique({
      where: { userId },
    });
    if (!client) {
      throw new ForbiddenException('Client profile not found for this user');
    }
    return client.id;
  }

  async create(userId: string, data: CreateCaseDto) {
    const clientId = await this.getClientId(userId);
    return this.prisma.case.create({
      data: {
        ...data,
        clientId,
      },
    });
  }

  async findAllForClient(userId: string) {
    const clientId = await this.getClientId(userId);
    return this.prisma.case.findMany({
      where: {
        clientId,
        deletedAt: null, // Don't return soft-deleted cases
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForClient(userId: string, id: string) {
    const clientId = await this.getClientId(userId);
    const caseData = await this.prisma.case.findUnique({
      where: { id },
    });

    if (!caseData || caseData.deletedAt !== null) {
      throw new NotFoundException(`Case with ID ${id} not found`);
    }

    if (caseData.clientId !== clientId) {
      throw new ForbiddenException(
        'You do not have permission to access this case',
      );
    }

    return caseData;
  }

  async update(userId: string, id: string, data: UpdateCaseDto) {
    // First, verify ownership
    await this.findOneForClient(userId, id);

    return this.prisma.case.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    // Verify ownership
    await this.findOneForClient(userId, id);

    // Soft delete
    return this.prisma.case.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
