import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdvocatesModule } from './advocates/advocates.module';
import { ClientsModule } from './clients/clients.module';
import { CasesModule } from './cases/cases.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { MatchingModule } from './matching/matching.module';
import { AdminModule } from './admin/admin.module';
import { ConnectionRequestsModule } from './connection-requests/connection-requests.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AdvocatesModule,
    ClientsModule,
    CasesModule,
    ChatbotModule,
    MatchingModule,
    AdminModule,
    ConnectionRequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
