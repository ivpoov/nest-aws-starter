import { accountSecurityConfig } from '@configs/account-security.config.js';
import { appConfig } from '@configs/app.config.js';
import { authConfig } from '@configs/auth.config.js';
import { cloudfrontConfig } from '@configs/cloudfront.config.js'; // <module:cloudfront>
import { databaseConfig } from '@configs/database.config.js';
import { discordOauthConfig } from '@configs/discord-oauth.config.js'; // <module:oauth-discord>
import { facebookOauthConfig } from '@configs/facebook-oauth.config.js'; // <module:oauth-facebook>
import { googleOauthConfig } from '@configs/google-oauth.config.js'; // <module:oauth-google>
import { lambdaConfig } from '@configs/lambda.config.js';
import { mailConfig } from '@configs/mail.config.js';
import { paymentConfig } from '@configs/payment.config.js'; // <module:payment>
import { productionGuardConfig } from '@configs/production-guard.config.js';
import { redisConfig } from '@configs/redis.config.js';
import { retentionConfig } from '@configs/retention.config.js';
import { s3Config } from '@configs/s3.config.js';
import { schedulerConfig } from '@configs/scheduler.config.js';
import { snsConfig } from '@configs/sns.config.js';
import { sqsConfig } from '@configs/sqs.config.js';
import { stripeConfig } from '@configs/stripe.config.js'; // <module:payment>
import { swaggerConfig } from '@configs/swagger.config.js';
import { webAppConfig } from '@configs/web-app.config.js';
import { websocketConfig } from '@configs/websocket.config.js'; // <module:notification>

export const configs = [
  appConfig,
  authConfig,
  cloudfrontConfig, // <module:cloudfront>
  databaseConfig,
  discordOauthConfig, // <module:oauth-discord>
  facebookOauthConfig, // <module:oauth-facebook>
  googleOauthConfig, // <module:oauth-google>
  lambdaConfig,
  mailConfig,
  paymentConfig, // <module:payment>
  redisConfig,
  retentionConfig,
  s3Config,
  schedulerConfig,
  snsConfig,
  sqsConfig,
  stripeConfig, // <module:payment>
  accountSecurityConfig,
  swaggerConfig,
  webAppConfig,
  websocketConfig, // <module:notification>
  // Last: every other config has already validated its own slice by now, so a
  // production boot reports provider-level problems and unsafe values together.
  productionGuardConfig,
];
