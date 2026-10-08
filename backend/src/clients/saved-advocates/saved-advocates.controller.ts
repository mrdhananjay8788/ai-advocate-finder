import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { SavedAdvocatesService } from './saved-advocates.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ClientsService } from '../clients.service';

@Controller('api/clients/me/saved-advocates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENT)
export class SavedAdvocatesController {
  constructor(
    private readonly savedAdvocatesService: SavedAdvocatesService,
    private readonly clientsService: ClientsService
  ) { }

  @Get()
  async getSavedAdvocates(@Request() req: any) {
    const client = await this.clientsService.getProfile(req.user.id);
    return this.savedAdvocatesService.getSavedAdvocates(client.id);
  }

  @Post(':advocateId')
  async saveAdvocate(@Request() req: any, @Param('advocateId') advocateId: string) {
    const client = await this.clientsService.getProfile(req.user.id);
    return this.savedAdvocatesService.saveAdvocate(client.id, advocateId);
  }

  @Delete(':advocateId')
  async removeSavedAdvocate(@Request() req: any, @Param('advocateId') advocateId: string) {
    const client = await this.clientsService.getProfile(req.user.id);
    return this.savedAdvocatesService.removeSavedAdvocate(client.id, advocateId);
  }
}
