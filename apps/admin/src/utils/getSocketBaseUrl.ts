const apiBaseUrl: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

// The gateway binds to the same Fastify server as the REST API, but on the
// default Socket.IO namespace/path (`/socket.io`) at the server root — the
// REST global prefix (`/api/v1`) never applies to it. Deriving the origin
// from VITE_API_BASE_URL avoids a second env var that could drift from it.
export function getSocketBaseUrl(): string {
  return new URL(apiBaseUrl).origin;
}
