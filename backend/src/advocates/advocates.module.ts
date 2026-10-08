import { Module } from '@nestjs/common';
import { AdvocatesService } from './advocates.service';
import { AdvocatesController } from './advocates.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdvocatesController],
  providers: [AdvocatesService],
})
export class AdvocatesModule {}
