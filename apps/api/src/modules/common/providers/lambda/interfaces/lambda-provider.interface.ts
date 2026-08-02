export interface LambdaProviderInterface {
  invoke<TPayload, TResult>(functionName: string, payload: TPayload): Promise<TResult>;
}
