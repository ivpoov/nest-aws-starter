import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const PRODUCTION_DEVELOPMENT_DEFAULT: ErrorArgsInterface = {
  code: 'PRODUCTION_DEVELOPMENT_DEFAULT',
  details: 'Value still equals the development default shipped in .env.example',
};

export const PRODUCTION_WEAK_JWT_SECRET: ErrorArgsInterface = {
  code: 'PRODUCTION_WEAK_JWT_SECRET',
  details: 'AUTH_JWT_SECRET carries less than 32 bytes of entropy',
};

export const PRODUCTION_UNSAFE_CORS_ORIGIN: ErrorArgsInterface = {
  code: 'PRODUCTION_UNSAFE_CORS_ORIGIN',
  details: 'CORS_ORIGINS allows a wildcard or a loopback origin',
};

export const PRODUCTION_UNAUTHENTICATED_SWAGGER: ErrorArgsInterface = {
  code: 'PRODUCTION_UNAUTHENTICATED_SWAGGER',
  details: 'SWAGGER_ENABLED=true without basic-auth credentials',
};
