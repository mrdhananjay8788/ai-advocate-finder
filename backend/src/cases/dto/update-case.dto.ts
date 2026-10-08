import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CaseType, UrgencyLevel, CaseStage } from '../../prisma-enums';;

export class UpdateCaseDto {
  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsEnum(UrgencyLevel)
  urgencyLevel?: UrgencyLevel;

  @IsOptional()
  @IsString()
  budgetRange?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsEnum(CaseStage)
  caseStage?: CaseStage;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rawTranscript?: string;
}
