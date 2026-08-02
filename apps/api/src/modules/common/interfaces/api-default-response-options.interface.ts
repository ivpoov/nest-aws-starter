import type { Type } from '@nestjs/common';

export interface ApiDefaultResponseOptionsInterface {
  readonly status: number;
  readonly type?: Type<unknown> | undefined;
  readonly isArray?: boolean | undefined;
}
