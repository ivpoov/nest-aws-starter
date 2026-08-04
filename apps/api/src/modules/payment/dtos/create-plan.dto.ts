import {
  PLAN_MAX_AMOUNT_CENTS,
  PLAN_MAX_INTERVAL_DAYS,
} from '@modules/payment/constants/plan-validation.constants.js';
import { ProviderRefsDto } from '@modules/payment/dtos/provider-refs.dto.js';
import type { CreatePlanRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePlanDto implements CreatePlanRequestInterface {
  @ApiProperty({ type: String, example: 'Starter Monthly', maxLength: 120 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  readonly name: string;

  @ApiPropertyOptional({ type: String, example: 'Monthly access to the starter tier' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string | undefined;

  @ApiProperty({ type: Number, example: 999, minimum: 1, maximum: PLAN_MAX_AMOUNT_CENTS })
  @IsInt()
  @Min(1)
  @Max(PLAN_MAX_AMOUNT_CENTS)
  @Type(() => Number)
  readonly amountCents: number;

  // ISO-4217 alphabetic code — three uppercase letters.
  @ApiProperty({ type: String, example: 'USD', minLength: 3, maxLength: 3 })
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter uppercase ISO-4217 code' })
  readonly currency: string;

  @ApiProperty({ type: Number, example: 30, minimum: 1, maximum: PLAN_MAX_INTERVAL_DAYS })
  @IsInt()
  @Min(1)
  @Max(PLAN_MAX_INTERVAL_DAYS)
  @Type(() => Number)
  readonly intervalDays: number;

  // Typed as the shared wire shape (Record<string, string>) — ProviderRefsDto
  // only exists to drive validation/transform; it structurally satisfies this
  // shape by construction (one optional string field per known provider).
  @ApiPropertyOptional({ type: ProviderRefsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderRefsDto)
  readonly providerRefs?: Record<string, string> | undefined;
}
