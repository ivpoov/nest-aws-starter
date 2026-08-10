// The one callback shape both CORS implementations in this app accept for a
// dynamic origin decision: @fastify/cors (behind Nest's `enableCors`) and the
// `cors` package (behind Socket.IO/engine.io). Both call it with the request's
// Origin header — `undefined` when there is none — and both treat a `false`
// answer as "write no CORS headers at all", which is what a refusal is: the
// browser sees no Access-Control-Allow-Origin and drops the response.
export type CorsOriginDelegateType = (
  requestOrigin: string | undefined,
  callback: (error: Error | null, isAllowed: boolean) => void,
) => void;
