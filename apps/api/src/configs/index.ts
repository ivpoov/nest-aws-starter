import { appConfig } from '@configs/app.config.js';
import { databaseConfig } from '@configs/database.config.js';
import { redisConfig } from '@configs/redis.config.js';
import { s3Config } from '@configs/s3.config.js';

export const configs = [appConfig, databaseConfig, redisConfig, s3Config];
