import { IsEnum, IsNotEmpty } from 'class-validator';
import { VerificationStatus } from '../../prisma-enums';;

export class UpdateVerificationDto {
  @IsNotEmpty()
  @IsEnum(VerificationStatus)
  status: VerificationStatus;
}
