import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CaseProfileDto } from './dto/case-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('api/cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @Roles(Role.CLIENT)
  create(@Request() req: any, @Body() createCaseDto: CreateCaseDto) {
    return this.casesService.create(req.user.id, createCaseDto);
  }

  @Get()
  @Roles(Role.CLIENT)
  findAll(@Request() req: any) {
    return this.casesService.findAllForClient(req.user.id);
  }

  @Get(':id')
  @Roles(Role.CLIENT)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.casesService.findOneForClient(req.user.id, id);
  }

  @Patch(':id')
  @Roles(Role.CLIENT)
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateCaseDto: UpdateCaseDto,
  ) {
    return this.casesService.update(req.user.id, id, updateCaseDto);
  }

  @Delete(':id')
  @Roles(Role.CLIENT)
  remove(@Request() req: any, @Param('id') id: string) {
    return this.casesService.remove(req.user.id, id);
  }

  @Patch(':id/profile')
  @Roles(Role.CLIENT)
  async updateProfile(
    @Request() req: any,
    @Param('id') id: string,
    @Body() profileDto: CaseProfileDto,
  ) {
    // Jurisdiction might come in as object
    let jurisdictionStr = 'Unknown';
    if (profileDto.jurisdiction) {
      jurisdictionStr =
        [profileDto.jurisdiction.city, profileDto.jurisdiction.state]
          .filter(Boolean)
          .join(', ') || 'Unknown';
    }

    const summaryText = profileDto.summary || profileDto.factualSummary || null;

    const updateData: any = {
      caseType: profileDto.caseType,
      jurisdiction: jurisdictionStr,
      urgencyLevel: profileDto.urgencyLevel,
      budgetRange: profileDto.budgetRange,
      language: profileDto.language,
      caseStage: profileDto.caseStage,
      structuredSummary: JSON.stringify({
        ...profileDto,
        factualSummary: summaryText,
      }),
      status: 'INTAKE_COMPLETED', // Mark completed when they confirm
    };

    if (summaryText) {
      updateData.rawTranscript = summaryText;
    }

    return this.casesService.update(req.user.id, id, updateData);
  }
}
