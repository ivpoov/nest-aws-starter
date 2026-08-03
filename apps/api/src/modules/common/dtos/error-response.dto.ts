import type { ErrorResponseInterface } from '@interfaces/error-response.interface.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto implements ErrorResponseInterface {
  @ApiProperty({ type: Number, example: 404 })
  readonly statusCode: number;

  @ApiProperty({ type: String, example: 'NOTE_NOT_FOUND' })
  readonly code: string;

  @ApiProperty({ type: String, example: 'Note not found' })
  readonly details: string;

  @ApiPropertyOptional({ type: Object, example: { providers: ['GOOGLE'] } })
  readonly meta?: Record<string, unknown> | undefined;

  @ApiProperty({ type: String, example: '2026-08-02T12:00:00.000Z' })
  readonly timestamp: string;

  @ApiProperty({ type: String, example: '/api/v1/notes/6d3d19c1-9e6a-4a5b-8f21-0f1d2c3b4a5e' })
  readonly path: string;
}
