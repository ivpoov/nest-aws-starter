import type { DevelopmentDefaultInterface } from '@interfaces/development-default.interface.js';

// Every security-relevant value apps/api/.env.example ships with a working
// local value. Each one boots a laptop and compromises a deployment, so
// production refuses to start while any of them is still in place. Keep this
// table and .env.example in step: adding a defaulted credential, endpoint or
// redirect target there means adding a row here.
//
// Deliberately absent: TRUST_PROXY=true (correct behind an ALB, so flagging it
// would cry wolf on most real deployments) and the ports/toggles that carry no
// security weight.
export const DEVELOPMENT_DEFAULTS: readonly DevelopmentDefaultInterface[] = [
  {
    variable: 'AUTH_JWT_SECRET',
    value: 'local-development-secret-change-me-32chars',
    remedy: 'generate a fresh secret with `openssl rand -hex 48`',
  },
  {
    variable: 'DATABASE_URL',
    value: 'postgresql://postgres:postgres@localhost:5433/starter?connection_limit=10',
    remedy: 'point it at the production database, with credentials of its own',
  },
  {
    variable: 'REDIS_URL',
    value: 'redis://localhost:6390',
    remedy: 'point it at the production Redis endpoint',
  },
  {
    variable: 'AWS_ACCESS_KEY_ID',
    value: 'test',
    remedy: 'use a real IAM access key, or unset it and let the instance/task role sign requests',
  },
  {
    variable: 'AWS_SECRET_ACCESS_KEY',
    value: 'test',
    remedy: 'use a real IAM secret key, or unset it and let the instance/task role sign requests',
  },
  {
    variable: 'AWS_ENDPOINT_URL',
    value: 'http://localhost:4567',
    remedy: 'unset it so the AWS SDK talks to AWS instead of a local LocalStack',
  },
  {
    variable: 'S3_ENDPOINT',
    value: 'http://localhost:9010',
    remedy: 'unset it for real S3, or set the endpoint of your own object storage',
  },
  {
    variable: 'S3_ACCESS_KEY',
    value: 'minioadmin',
    remedy: 'use a real S3 credential (this one is the public MinIO default)',
  },
  {
    variable: 'S3_SECRET_KEY',
    value: 'minioadmin',
    remedy: 'use a real S3 credential (this one is the public MinIO default)',
  },
  {
    variable: 'WEB_APP_BASE_URL',
    value: 'http://localhost:5173',
    remedy: 'set the deployed web app origin, which verification and reset links point at',
  },
  {
    variable: 'MAIL_FROM_ADDRESS',
    value: 'no-reply@example.com',
    remedy: 'set a sender on a domain verified with SES',
  },
  // <module:payment>
  {
    variable: 'SQS_PAYMENT_WEBHOOK_QUEUE_URL',
    value: 'http://localhost:4567/000000000000/starter-payment-webhook-queue',
    remedy: 'set the real queue URL (webhooks are dropped while it points at LocalStack)',
  },
  {
    variable: 'STRIPE_PORTAL_RETURN_URL',
    value: 'http://localhost:5173',
    remedy: 'set the deployed web app origin, where Checkout redirects customers back to',
  },
  // </module:payment>
];
