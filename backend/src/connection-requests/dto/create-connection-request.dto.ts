import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateConnectionRequestDto {
  @IsString()
  @IsNotEmpty()
  caseId: string;

  @IsString()
  @IsNotEmpty()
  advocateId: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;
}
