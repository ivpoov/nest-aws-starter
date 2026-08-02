// Echo handler demonstrating the invoker pattern: whatever the API sends via
// LambdaProviderService.invoke() comes straight back under `echoed`.
// Plain ESM JavaScript on purpose — the demo needs no build step; zip and deploy.
export const handler = async (event) => {
  return { echoed: event };
};
