import type { CheckoutResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class CheckoutResponseDto implements CheckoutResponseInterface {
  @ApiProperty({ type: String, example: 'https://checkout.example.com/session/cs_test_123' })
  @Expose()
  readonly url: string;
}
