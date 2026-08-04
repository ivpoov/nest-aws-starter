import { configs } from '@configs/index.js';
import { JwtAuthGuard } from '@guards/jwt-auth.guard.js';
import { ThrottlerBehindProxyGuard } from '@guards/throttler-behind-proxy.guard.js';
import { ActivityModule } from '@modules/activity/activity.module.js';
import { ApiKeyModule } from '@modules/api-key/api-key.module.js'; // <module:api-key>
import { AuthModule } from '@modules/auth/auth.module.js';
import { CaslModule } from '@modules/casl/casl.module.js';
import { ThrottlerRedisStorageService } from '@modules/common/services/throttler-redis-storage.service.js';
import { ContactUsModule } from '@modules/contact-us/contact-us.module.js'; // <module:contact-us>
import { EventModule } from '@modules/event/event.module.js';
import { FileModule } from '@modules/file/file.module.js'; // <module:file>
import { HealthModule } from '@modules/health/health.module.js';
import { NoteModule } from '@modules/note/note.module.js';
import { OauthModule } from '@modules/oauth/oauth.module.js';
import { DiscordOauthModule } from '@modules/oauth-discord/discord-oauth.module.js'; // <module:oauth-discord>
import { FacebookOauthModule } from '@modules/oauth-facebook/facebook-oauth.module.js'; // <module:oauth-facebook>
import { GoogleOauthModule } from '@modules/oauth-google/google-oauth.module.js'; // <module:oauth-google>
import { PrismaModule } from '@modules/prisma/prisma.module.js';
import { SessionModule } from '@modules/session/session.module.js';
import { StatisticModule } from '@modules/statistic/statistic.module.js'; // <module:statistic>
import { SuspiciousActivityModule } from '@modules/suspicious-activity/suspicious-activity.module.js';
import { TokenModule } from '@modules/token/token.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@providers/cache/cache.module.js';
import { CloudFrontModule } from '@providers/cloudfront/cloudfront.module.js'; // <module:cloudfront>
import { HttpClientModule } from '@providers/http-client/http-client.module.js';
import { LambdaModule } from '@providers/lambda/lambda.module.js';
import { MailModule } from '@providers/mail/mail.module.js';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import { RedisModule } from '@providers/redis/redis.module.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { S3Module } from '@providers/s3/s3.module.js';
import { SnsModule } from '@providers/sns/sns.module.js';
import { SqsModule } from '@providers/sqs/sqs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: configs }),
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: RedisClientType) => ({
        throttlers: [{ name: 'default', limit: 100, ttl: 60_000 }],
        storage: new ThrottlerRedisStorageService(redis),
      }),
    }),
    PrismaModule,
    RedisModule,
    CacheModule,
    EventModule,
    CaslModule,
    S3Module,
    CloudFrontModule, // <module:cloudfront>
    SqsModule,
    SnsModule,
    MailModule,
    LambdaModule,
    HttpClientModule,
    HealthModule,
    UserModule,
    TokenModule,
    SessionModule,
    AuthModule,
    OauthModule,
    GoogleOauthModule, // <module:oauth-google>
    FacebookOauthModule, // <module:oauth-facebook>
    DiscordOauthModule, // <module:oauth-discord>
    NoteModule,
    FileModule, // <module:file>
    ActivityModule,
    SuspiciousActivityModule,
    StatisticModule, // <module:statistic>
    ContactUsModule, // <module:contact-us>
    ApiKeyModule, // <module:api-key>
  ],
  providers: [
    // Order matters: throttling runs before authentication.
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
