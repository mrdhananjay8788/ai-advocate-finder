import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('api/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post('me')
  @Roles(Role.CLIENT)
  createProfile(@Request() req: any, @Body() data: CreateClientDto) {
    return this.clientsService.createProfile(req.user.id, data);
  }

  @Get('me')
  @Roles(Role.CLIENT)
  getProfile(@Request() req: any) {
    return this.clientsService.getProfile(req.user.id);
  }

  @Patch('me')
  @Roles(Role.CLIENT)
  updateProfile(@Request() req: any, @Body() data: UpdateClientDto) {
    return this.clientsService.updateProfile(req.user.id, data);
  }
}
