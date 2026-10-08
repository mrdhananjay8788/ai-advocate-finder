import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAdvocateDto } from './dto/update-advocate.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdvocatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    search?: string;
    city?: string;
    state?: string;
    practiceArea?: string;
    language?: string;
    verified?: string;
    experience?: string;
    feeRange?: string;
    availability?: string;
    sortBy?: string;
  }) {
    const where: Prisma.AdvocateWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { city: { contains: filters.search } },
        { state: { contains: filters.search } },
        { practiceAreas: { contains: filters.search } },
        { courts: { contains: filters.search } },
      ];
    }

    if (filters.city) {
      where.city = { contains: filters.city };
    }
    if (filters.state) {
      where.state = { contains: filters.state };
    }
    if (filters.practiceArea) {
      where.practiceAreas = { contains: filters.practiceArea };
    }
    if (filters.language) {
      where.languages = { contains: filters.language };
    }
    if (filters.verified === 'true') {
      where.verifiedStatus = 'VERIFIED';
    } else if (filters.verified === 'false') {
      where.verifiedStatus = { not: 'VERIFIED' };
    }
    if (filters.experience) {
      const exp = parseInt(filters.experience, 10);
      if (!isNaN(exp)) {
        where.yearsExperience = { gte: exp };
      }
    }
    if (filters.feeRange) {
      where.feeRange = { contains: filters.feeRange };
    }
    if (filters.availability === 'true') {
      where.availabilityStatus = true;
    } else if (filters.availability === 'false') {
      where.availabilityStatus = false;
    }

    let orderBy: Prisma.AdvocateOrderByWithRelationInput[] = [];
    if (filters.sortBy === 'highestRated') {
      orderBy = [{ ratingAvg: 'desc' }];
    } else if (filters.sortBy === 'mostExperienced') {
      orderBy = [{ yearsExperience: 'desc' }];
    } else if (filters.sortBy === 'feeHighLow') {
      orderBy = [{ feeRange: 'desc' }];
    } else if (filters.sortBy === 'feeLowHigh') {
      orderBy = [{ feeRange: 'asc' }];
    } else {
      // Default: best match sorting (Verified first, then rating)
      orderBy = [
        { verifiedStatus: 'desc' }, // 'VERIFIED' comes before 'PENDING'
        { ratingAvg: 'desc' },
      ];
    }

    const advocates = await this.prisma.advocate.findMany({
      where,
      orderBy,
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
      },
    });

    return advocates;
  }

  async findOne(id: string) {
    const advocate = await this.prisma.advocate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        verifiedStatus: true,
        city: true,
        state: true,
        yearsExperience: true,
        feeRange: true,
        practiceAreas: true,
        courts: true,
        languages: true,
        bio: true,
        ratingAvg: true,
        reviewCount: true,
        availabilityStatus: true,
      },
    });

    if (!advocate) {
      throw new NotFoundException(`Advocate with ID ${id} not found`);
    }

    return advocate;
  }

  async findByUserId(userId: string) {
    const advocate = await this.prisma.advocate.findUnique({
      where: { userId },
    });

    if (!advocate) {
      throw new NotFoundException('Advocate profile not found');
    }

    return advocate;
  }

  async updateByUserId(userId: string, data: UpdateAdvocateDto) {
    const { practiceAreas, courts, languages, ...restData } = data;
    const updateData: Prisma.AdvocateUpdateInput = {
      ...restData,
      verifiedStatus: 'PENDING',
    };
    if (practiceAreas) updateData.practiceAreas = JSON.stringify(practiceAreas);
    if (courts) updateData.courts = JSON.stringify(courts);
    if (languages) updateData.languages = JSON.stringify(languages);

    return this.prisma.advocate.update({
      where: { userId },
      data: updateData,
    });
  }

  async updateVerification(id: string, data: UpdateVerificationDto) {
    return this.prisma.advocate.update({
      where: { id },
      data: {
        verifiedStatus: data.status,
      },
    });
  }
}
