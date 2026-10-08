import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ConnectionRequestsService } from './connection-requests.service';
import { CreateConnectionRequestDto } from './dto/create-connection-request.dto';
import { AdvocateResponseDto } from './dto/advocate-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('api/connection-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConnectionRequestsController {
  constructor(
    private readonly connectionRequestsService: ConnectionRequestsService,
  ) {}

  @Post()
  @Roles(Role.CLIENT)
  create(@Request() req: any, @Body() createDto: CreateConnectionRequestDto) {
    return this.connectionRequestsService.create(req.user.userId, createDto);
  }

  @Get('client/me')
  @Roles(Role.CLIENT)
  findClientRequests(@Request() req: any) {
    return this.connectionRequestsService.findClientRequests(req.user.userId);
  }

  @Patch(':id/cancel')
  @Roles(Role.CLIENT)
  cancelRequest(@Request() req: any, @Param('id') id: string) {
    return this.connectionRequestsService.cancelRequest(req.user.userId, id);
  }

  @Get('advocate/me')
  @Roles(Role.ADVOCATE)
  findAdvocateRequests(@Request() req: any) {
    return this.connectionRequestsService.findAdvocateRequests(req.user.userId);
  }

  @Patch(':id/accept')
  @Roles(Role.ADVOCATE)
  acceptRequest(@Request() req: any, @Param('id') id: string) {
    return this.connectionRequestsService.acceptRequest(req.user.userId, id);
  }

  @Patch(':id/decline')
  @Roles(Role.ADVOCATE)
  declineRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() declineDto: AdvocateResponseDto,
  ) {
    return this.connectionRequestsService.declineRequest(
      req.user.userId,
      id,
      declineDto,
    );
  }

  @Get(':id/details')
  getConnectionDetails(@Request() req: any, @Param('id') id: string) {
    // Accessible by CLIENT or ADVOCATE, verified inside the service logic
    return this.connectionRequestsService.getConnectionDetails(
      req.user.userId,
      id,
      req.user.role,
    );
  }
}
