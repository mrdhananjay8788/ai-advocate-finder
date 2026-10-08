import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { SavedAdvocatesController } from './saved-advocates/saved-advocates.controller';
import { SavedAdvocatesService } from './saved-advocates/saved-advocates.service';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClientsController, SavedAdvocatesController],
  providers: [ClientsService, SavedAdvocatesService],
  exports: [ClientsService],
})
export class ClientsModule {}
