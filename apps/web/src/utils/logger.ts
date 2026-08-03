const isProduction: boolean = import.meta.env.PROD;

export const logger = {
  debug(...args: unknown[]): void {
    if (!isProduction) console.debug(...args);
  },
  warn(...args: unknown[]): void {
    if (!isProduction) console.warn(...args);
  },
  error(...args: unknown[]): void {
    console.error(...args);
  },
};
