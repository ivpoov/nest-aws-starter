import { Global, Module } from '@nestjs/common';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';

@Global()
@Module({
  providers: [HttpClientService],
  exports: [HttpClientService],
})
export class HttpClientModule {}
