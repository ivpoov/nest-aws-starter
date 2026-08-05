import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// One field per supported provider. Extend this DTO when a new
// PaymentProviderInterface implementation is registered.
export class ProviderRefsDto {
  @ApiPropertyOptional({ type: String, example: 'price_1AbCDeFGhIJkLmNoPQrStuVW' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly STRIPE?: string | undefined;
}
