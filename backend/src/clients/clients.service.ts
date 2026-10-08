import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(userId: string, data: CreateClientDto) {
    const existingClient = await this.prisma.client.findUnique({
      where: { userId },
    });

    if (existingClient) {
      throw new ConflictException('Client profile already exists');
    }

    return this.prisma.client.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async getProfile(userId: string) {
    const client = await this.prisma.client.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client profile not found');
    }

    return client;
  }

  async updateProfile(userId: string, data: UpdateClientDto) {
    const existingClient = await this.prisma.client.findUnique({
      where: { userId },
    });

    if (!existingClient) {
      throw new NotFoundException('Client profile not found');
    }

    return this.prisma.client.update({
      where: { userId },
      data,
    });
  }
}
