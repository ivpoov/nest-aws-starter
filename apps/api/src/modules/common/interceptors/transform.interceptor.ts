import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { type ClassConstructor, plainToInstance } from 'class-transformer';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class TransformInterceptor<T> implements NestInterceptor<unknown, T | T[]> {
  constructor(private readonly dto: ClassConstructor<T>) {}

  public intercept(_context: ExecutionContext, next: CallHandler): Observable<T | T[]> {
    return next
      .handle()
      .pipe(
        map(
          (data: unknown): T | T[] =>
            plainToInstance(this.dto, data, { excludeExtraneousValues: true }) as T | T[],
        ),
      );
  }
}
