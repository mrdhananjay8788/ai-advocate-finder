import { IsEnum, IsOptional, IsString, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { CaseType, UrgencyLevel, CaseStage } from '../../prisma-enums';;

export class JurisdictionDto {
  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  state?: string | null;

  @IsOptional()
  @IsString()
  court?: string | null;
}

export class CaseProfileDto {
  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => JurisdictionDto)
  jurisdiction?: JurisdictionDto | null;

  @IsOptional()
  @IsEnum(UrgencyLevel)
  urgencyLevel?: UrgencyLevel | null;

  @IsOptional()
  @IsString()
  budgetRange?: string | null;

  @IsOptional()
  @IsString()
  language?: string | null;

  @IsOptional()
  @IsEnum(CaseStage)
  caseStage?: CaseStage | null;

  @IsOptional()
  @IsString()
  factualSummary?: string | null;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingFields?: string[];

  @IsOptional()
  @IsBoolean()
  isReadyForMatching?: boolean;
}
