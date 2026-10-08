import { IsEnum } from 'class-validator';
import { VerificationStatus } from '../../prisma-enums';;

export class UpdateVerificationDto {
  @IsEnum(VerificationStatus)
  verifiedStatus: VerificationStatus;
}
