import type { LogEntryInterface } from '@modules/logger/interfaces/log-entry.interface.js';
import { RequestContextService } from '@modules/logger/services/request-context.service.js';
import { ConsoleLogger, type LogLevel } from '@nestjs/common';

export class CustomLoggerService extends ConsoleLogger {
  protected override printMessages(
    messages: unknown[],
    context: string = '',
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
  ): void {
    if (process.env.NODE_ENV !== 'production') {
      super.printMessages(messages, context, logLevel, writeStreamType);

      return;
    }

    const stream: NodeJS.WriteStream =
      writeStreamType === 'stderr' ? process.stderr : process.stdout;

    for (const message of messages) {
      stream.write(`${this.formatEntry(logLevel, context, message)}\n`);
    }
  }

  public formatEntry(level: LogLevel, context: string, message: unknown): string {
    const requestId: string | null = RequestContextService.getRequestId();
    const entry: LogEntryInterface = {
      level,
      context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      timestamp: new Date().toISOString(),
      ...(requestId !== null && { requestId }),
    };

    return JSON.stringify(entry);
  }
}
