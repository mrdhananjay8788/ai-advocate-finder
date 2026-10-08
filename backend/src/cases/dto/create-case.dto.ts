import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CaseType, UrgencyLevel, CaseStage } from '../../prisma-enums';;

export class CreateCaseDto {
  @IsNotEmpty()
  @IsEnum(CaseType)
  caseType: CaseType;

  @IsNotEmpty()
  @IsString()
  jurisdiction: string;

  @IsNotEmpty()
  @IsEnum(UrgencyLevel)
  urgencyLevel: UrgencyLevel;

  @IsOptional()
  @IsString()
  budgetRange?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsNotEmpty()
  @IsEnum(CaseStage)
  caseStage: CaseStage;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rawTranscript?: string;
}
