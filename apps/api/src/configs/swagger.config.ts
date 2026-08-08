import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  isEnabled: z.boolean(),
  user: z.string(),
  password: z.string(),
});

export type SwaggerConfig = Required<z.infer<typeof scheme>>;

export const swaggerConfig = registerAs('swagger', (): SwaggerConfig => {
  // Unset means "on everywhere but production" — the historical behaviour.
  // Turning it on in production is possible but never silent: the production
  // boot guard refuses to start without basic-auth credentials.
  const isProduction: boolean = process.env.NODE_ENV === 'production';
  const override: string | undefined = process.env.SWAGGER_ENABLED;

  const config: SwaggerConfig = {
    isEnabled: override === undefined ? !isProduction : override === 'true',
    user: process.env.SWAGGER_USER ?? '',
    password: process.env.SWAGGER_PASSWORD ?? '',
  };

  validateScheme(scheme, config, new Logger('SwaggerConfig'));

  return config;
});
