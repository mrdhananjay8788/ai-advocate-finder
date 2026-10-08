import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { UpdateVerificationDto } from './dto/update-verification.dto';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('advocates/pending')
  getPendingAdvocates() {
    return this.adminService.getPendingAdvocates();
  }

  @Patch('advocates/:id/verification')
  updateAdvocateVerification(
    @Param('id') id: string,
    @Body() updateVerificationDto: UpdateVerificationDto,
  ) {
    return this.adminService.updateAdvocateVerification(
      id,
      updateVerificationDto,
    );
  }

  @Get('advocates')
  getAdvocates(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getAdvocates(page, limit);
  }

  @Get('clients')
  getClients(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getClients(page, limit);
  }

  @Get('cases/stats')
  getCaseStats() {
    return this.adminService.getCaseStats();
  }

  @Get('cases')
  getCases(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getCases(page, limit);
  }

  @Get('matches/stats')
  getMatchesStats() {
    return this.adminService.getMatchesStats();
  }

  @Get('matches')
  getMatches(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getMatches(page, limit);
  }

  @Get('chatbot/audit')
  getChatbotAudit(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getChatbotAudit(page, limit);
  }

  @Get('reviews')
  getReviews() {
    return this.adminService.getReviews();
  }
}
