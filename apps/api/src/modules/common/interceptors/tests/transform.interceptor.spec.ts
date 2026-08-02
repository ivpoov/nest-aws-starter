import { TransformInterceptor } from '@modules/common/interceptors/transform.interceptor.js';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Expose } from 'class-transformer';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

class FixtureDto {
  @Expose()
  readonly id!: string;

  @Expose()
  readonly title!: string;
}

const context = {} as ExecutionContext;

function handlerOf(data: unknown): CallHandler {
  return { handle: () => of(data) };
}

describe('TransformInterceptor', () => {
  it('strips fields that are not exposed on the dto', async () => {
    const interceptor: TransformInterceptor<FixtureDto> = new TransformInterceptor(FixtureDto);

    const result: FixtureDto | FixtureDto[] = await firstValueFrom(
      interceptor.intercept(context, handlerOf({ id: '1', title: 'a', secret: 'hidden' })),
    );

    expect(result).toEqual({ id: '1', title: 'a' });
    expect(result).not.toHaveProperty('secret');
  });

  it('serializes arrays element-wise', async () => {
    const interceptor: TransformInterceptor<FixtureDto> = new TransformInterceptor(FixtureDto);

    const result: FixtureDto | FixtureDto[] = await firstValueFrom(
      interceptor.intercept(context, handlerOf([{ id: '1', title: 'a', extra: true }])),
    );

    expect(result).toEqual([{ id: '1', title: 'a' }]);
  });
});
