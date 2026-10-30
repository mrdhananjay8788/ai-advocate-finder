import {
  IsNotEmpty,
  IsString,
  IsIn,
  Length,
  IsOptional,
} from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsIn(['EMAIL', 'PHONE'])
  type: 'EMAIL' | 'PHONE';

  @IsString()
  @IsOptional()
  name?: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsIn(['EMAIL', 'PHONE'])
  type: 'EMAIL' | 'PHONE';

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp: string;
}

export class ResendOtpDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsIn(['EMAIL', 'PHONE'])
  type: 'EMAIL' | 'PHONE';
}
