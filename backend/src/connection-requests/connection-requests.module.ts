import { Module } from '@nestjs/common';
import { ConnectionRequestsService } from './connection-requests.service';
import { ConnectionRequestsController } from './connection-requests.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ConnectionRequestsController],
  providers: [ConnectionRequestsService, PrismaService],
})
export class ConnectionRequestsModule {}
