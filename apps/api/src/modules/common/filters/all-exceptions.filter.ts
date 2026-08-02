import { HTTP_STATUS_BY_ERROR_CATEGORY } from '@constants/error-category-http-status.constants.js';
import { INTERNAL_SERVER_ERROR } from '@constants/errors.constants.js';
import type { ErrorResponseInterface } from '@interfaces/error-response.interface.js';
import type { MappedExceptionInterface } from '@interfaces/mapped-exception.interface.js';
import { AppError } from '@modules/common/errors/app.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new CustomLoggerService(AllExceptionsFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const reply: FastifyReply = context.getResponse<FastifyReply>();
    const request: FastifyRequest = context.getRequest<FastifyRequest>();
    const mapped: MappedExceptionInterface = this.mapException(exception);
    const body: ErrorResponseInterface = {
      ...mapped,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    void reply.status(mapped.statusCode).send(body);
  }

  private mapException(exception: unknown): MappedExceptionInterface {
    if (exception instanceof AppError) {
      return {
        statusCode: HTTP_STATUS_BY_ERROR_CATEGORY[exception.category],
        ...exception.args,
      };
    }

    if (exception instanceof HttpException) return this.mapHttpException(exception);

    const stack: string | undefined = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(`Unhandled exception: ${String(exception)}`, stack);

    return { statusCode: StatusCodes.INTERNAL_SERVER_ERROR, ...INTERNAL_SERVER_ERROR };
  }

  // Edge exceptions (router 404, ValidationPipe 400, guards) are genuinely
  // HTTP-layer and keep Nest's classes; they get a generic status-derived code.
  // Anything needing a specific code must be a domain AppError.
  private mapHttpException(exception: HttpException): MappedExceptionInterface {
    const statusCode: number = exception.getStatus();
    const code: string = getReasonPhrase(statusCode)
      .toUpperCase()
      .replace(/[^A-Z]+/g, '_');

    return { statusCode, code, details: this.extractDetails(exception) };
  }

  private extractDetails(exception: HttpException): string {
    const response: string | object = exception.getResponse();

    if (typeof response === 'string') return response;

    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message: unknown = (response as { message: unknown }).message;

      return Array.isArray(message) ? message.join('; ') : String(message);
    }

    return exception.message;
  }
}
