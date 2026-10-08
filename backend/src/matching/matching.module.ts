import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { AdvocateScoringService } from './scoring/advocate-scoring.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MatchingController],
  providers: [MatchingService, AdvocateScoringService],
  exports: [MatchingService],
})
export class MatchingModule {}
