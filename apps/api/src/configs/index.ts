import { appConfig } from '@configs/app.config.js';
import { authConfig } from '@configs/auth.config.js';
import { databaseConfig } from '@configs/database.config.js';
import { facebookOauthConfig } from '@configs/facebook-oauth.config.js';
import { googleOauthConfig } from '@configs/google-oauth.config.js';
import { lambdaConfig } from '@configs/lambda.config.js';
import { mailConfig } from '@configs/mail.config.js';
import { redisConfig } from '@configs/redis.config.js';
import { s3Config } from '@configs/s3.config.js';
import { snsConfig } from '@configs/sns.config.js';
import { sqsConfig } from '@configs/sqs.config.js';
import { webAppConfig } from '@configs/web-app.config.js';

export const configs = [
  appConfig,
  authConfig,
  databaseConfig,
  facebookOauthConfig,
  googleOauthConfig,
  lambdaConfig,
  mailConfig,
  redisConfig,
  s3Config,
  snsConfig,
  sqsConfig,
  webAppConfig,
];
