import { appConfig } from '@configs/app.config.js';
import { authConfig } from '@configs/auth.config.js';
import { cloudfrontConfig } from '@configs/cloudfront.config.js'; // <module:cloudfront>
import { databaseConfig } from '@configs/database.config.js';
import { discordOauthConfig } from '@configs/discord-oauth.config.js'; // <module:oauth-discord>
import { facebookOauthConfig } from '@configs/facebook-oauth.config.js'; // <module:oauth-facebook>
import { googleOauthConfig } from '@configs/google-oauth.config.js'; // <module:oauth-google>
import { lambdaConfig } from '@configs/lambda.config.js';
import { mailConfig } from '@configs/mail.config.js';
import { redisConfig } from '@configs/redis.config.js';
import { s3Config } from '@configs/s3.config.js';
import { schedulerConfig } from '@configs/scheduler.config.js';
import { snsConfig } from '@configs/sns.config.js';
import { sqsConfig } from '@configs/sqs.config.js';
import { suspiciousActivityConfig } from '@configs/suspicious-activity.config.js';
import { webAppConfig } from '@configs/web-app.config.js';

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
  redisConfig,
  s3Config,
  schedulerConfig,
  snsConfig,
  sqsConfig,
  suspiciousActivityConfig,
  webAppConfig,
];
