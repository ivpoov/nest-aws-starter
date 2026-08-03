import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class RevokeSessionsQueryDto {
  @ApiPropertyOptional({ type: Boolean, example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }): boolean => value === 'true' || value === true)
  readonly includeCurrent: boolean = false;
}
