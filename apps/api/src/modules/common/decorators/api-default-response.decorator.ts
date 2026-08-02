import type { ApiDefaultResponseOptionsInterface } from '@interfaces/api-default-response-options.interface.js';
import { ErrorResponseDto } from '@modules/common/dtos/error-response.dto.js';
import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export function ApiDefaultResponse(options: ApiDefaultResponseOptionsInterface): MethodDecorator {
  return applyDecorators(
    ApiResponse({
      status: options.status,
      type: options.type,
      isArray: options.isArray,
    }),
    ApiResponse({
      status: 'default',
      description: 'Coded error envelope',
      type: ErrorResponseDto,
    }),
  );
}
