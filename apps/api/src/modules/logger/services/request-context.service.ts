import { AsyncLocalStorage } from 'node:async_hooks';

// biome-ignore lint/complexity/noStaticOnlyClass: the ALS store must be process-global and reachable from loggers created as class fields, outside DI
export class RequestContextService {
  private static readonly storage: AsyncLocalStorage<string> = new AsyncLocalStorage<string>();

  public static run(requestId: string, callback: () => void): void {
    RequestContextService.storage.run(requestId, callback);
  }

  public static getRequestId(): string | null {
    return RequestContextService.storage.getStore() ?? null;
  }
}
