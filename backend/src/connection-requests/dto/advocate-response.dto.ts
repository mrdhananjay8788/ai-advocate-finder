import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AdvocateResponseDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  response?: string;
}
