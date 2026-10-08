import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SavedAdvocatesService {
  constructor(private readonly prisma: PrismaService) {}

  async getSavedAdvocates(clientId: string) {
    const saved = await this.prisma.savedAdvocate.findMany({
      where: { clientId },
      include: {
        advocate: {
          select: {
            id: true,
            name: true,
            verifiedStatus: true,
            city: true,
            state: true,
            yearsExperience: true,
            feeRange: true,
            practiceAreas: true,
            languages: true,
            ratingAvg: true,
            reviewCount: true,
            availabilityStatus: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return saved.map(s => s.advocate);
  }

  async saveAdvocate(clientId: string, advocateId: string) {
    // Check if advocate exists
    const advocate = await this.prisma.advocate.findUnique({ where: { id: advocateId } });
    if (!advocate) {
      throw new NotFoundException('Advocate not found');
    }

    try {
      const saved = await this.prisma.savedAdvocate.create({
        data: {
          clientId,
          advocateId,
        }
      });
      return saved;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Advocate is already saved');
      }
      throw error;
    }
  }

  async removeSavedAdvocate(clientId: string, advocateId: string) {
    try {
      await this.prisma.savedAdvocate.delete({
        where: {
          clientId_advocateId: {
            clientId,
            advocateId,
          }
        }
      });
      return { success: true };
    } catch (error) {
      throw new NotFoundException('Saved advocate not found');
    }
  }
}
