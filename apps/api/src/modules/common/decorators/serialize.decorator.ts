import { TransformInterceptor } from '@modules/common/interceptors/transform.interceptor.js';
import { UseInterceptors } from '@nestjs/common';
import type { ClassConstructor } from 'class-transformer';

export function Serialize<T>(dto: ClassConstructor<T>): MethodDecorator & ClassDecorator {
  return UseInterceptors(new TransformInterceptor(dto));
}
