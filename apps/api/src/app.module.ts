import { configs } from '@configs/index.js';
import { CaslModule } from '@modules/casl/casl.module.js';
import { EventModule } from '@modules/event/event.module.js';
import { HealthModule } from '@modules/health/health.module.js';
import { NoteModule } from '@modules/note/note.module.js';
import { PrismaModule } from '@modules/prisma/prisma.module.js';
import { SessionModule } from '@modules/session/session.module.js';
import { TokenModule } from '@modules/token/token.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@providers/cache/cache.module.js';
import { HttpClientModule } from '@providers/http-client/http-client.module.js';
import { LambdaModule } from '@providers/lambda/lambda.module.js';
import { MailModule } from '@providers/mail/mail.module.js';
import { RedisModule } from '@providers/redis/redis.module.js';
import { S3Module } from '@providers/s3/s3.module.js';
import { SnsModule } from '@providers/sns/sns.module.js';
import { SqsModule } from '@providers/sqs/sqs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: configs }),
    PrismaModule,
    RedisModule,
    CacheModule,
    EventModule,
    CaslModule,
    S3Module,
    SqsModule,
    SnsModule,
    MailModule,
    LambdaModule,
    HttpClientModule,
    HealthModule,
    UserModule,
    TokenModule,
    SessionModule,
    NoteModule,
  ],
})
export class AppModule {}
