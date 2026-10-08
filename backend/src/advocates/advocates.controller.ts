import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AdvocatesService } from './advocates.service';
import { UpdateAdvocateDto } from './dto/update-advocate.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('api/advocates')
export class AdvocatesController {
  constructor(private readonly advocatesService: AdvocatesService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('practiceArea') practiceArea?: string,
    @Query('language') language?: string,
    @Query('verified') verified?: string,
    @Query('experience') experience?: string,
    @Query('feeRange') feeRange?: string,
    @Query('availability') availability?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.advocatesService.findAll({
      search,
      city,
      state,
      practiceArea,
      language,
      verified,
      experience,
      feeRange,
      availability,
      sortBy,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADVOCATE)
  @Get('me')
  findMe(@Request() req: any) {
    return this.advocatesService.findByUserId(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADVOCATE)
  @Patch('me')
  updateMe(@Request() req: any, @Body() updateAdvocateDto: UpdateAdvocateDto) {
    return this.advocatesService.updateByUserId(req.user.id, updateAdvocateDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADVOCATE)
  @Post('me')
  createMe(@Request() req: any, @Body() updateAdvocateDto: UpdateAdvocateDto) {
    // Usually created at registration, but if missing, can be created/updated here
    return this.advocatesService.updateByUserId(req.user.id, updateAdvocateDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADVOCATE)
  @Patch('me/availability')
  updateAvailability(
    @Request() req: any,
    @Body('availabilityStatus') status: string,
  ) {
    // Map string to boolean based on schema: AVAILABLE -> true, UNAVAILABLE -> false
    const booleanStatus = status === 'AVAILABLE' ? true : false;
    return this.advocatesService.updateByUserId(req.user.id, {
      availabilityStatus: booleanStatus,
    } as any);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.advocatesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/verification')
  updateVerification(
    @Param('id') id: string,
    @Body() updateVerificationDto: UpdateVerificationDto,
  ) {
    return this.advocatesService.updateVerification(id, updateVerificationDto);
  }
}
