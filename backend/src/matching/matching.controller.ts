import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MatchingService } from './matching.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

@Controller('api/matching')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
    private readonly prisma: PrismaService,
  ) {}

  private async getClientId(userId: string): Promise<string> {
    const client = await this.prisma.client.findUnique({
      where: { userId },
    });
    if (!client) {
      throw new ForbiddenException('Client profile not found');
    }
    return client.id;
  }

  @Post('cases/:caseId')
  @Roles(Role.CLIENT)
  async generateMatches(@Request() req: any, @Param('caseId') caseId: string) {
    const clientId = await this.getClientId(req.user.id);
    return this.matchingService.matchCase(clientId, caseId);
  }

  @Get('cases/:caseId')
  @Roles(Role.CLIENT)
  async getMatches(@Request() req: any, @Param('caseId') caseId: string) {
    const clientId = await this.getClientId(req.user.id);
    return this.matchingService.getMatches(clientId, caseId);
  }

  private async getAdvocateId(userId: string): Promise<string> {
    const advocate = await this.prisma.advocate.findUnique({
      where: { userId },
    });
    if (!advocate) {
      throw new ForbiddenException('Advocate profile not found');
    }
    return advocate.id;
  }

  @Get('advocates/me/matches')
  @Roles(Role.ADVOCATE)
  async getAdvocateMatches(@Request() req: any) {
    const advocateId = await this.getAdvocateId(req.user.id);
    return this.matchingService.getMatchesForAdvocate(advocateId);
  }

  @Patch('matches/:id/status')
  @Roles(Role.ADVOCATE)
  async updateMatchStatus(
    @Request() req: any,
    @Param('id') matchId: string,
    @Body('status') status: string,
  ) {
    const advocateId = await this.getAdvocateId(req.user.id);
    return this.matchingService.updateMatchStatus(advocateId, matchId, status);
  }
}
