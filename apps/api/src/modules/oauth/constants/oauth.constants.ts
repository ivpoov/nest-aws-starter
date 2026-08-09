export const OAUTH_STORE_REPOSITORY = Symbol('OAUTH_STORE_REPOSITORY');

export const OAUTH_STATE_TTL_SEC = 600;
export const OAUTH_EXCHANGE_TTL_SEC = 60;

// The web app routes an OAuth redirect may land on. A redirect target is
// accepted only when its origin equals WEB_APP_BASE_URL's origin exactly AND
// its path is one of these — the path list is what keeps the one-time exchange
// code away from any other route of the same origin.
export const OAUTH_ALLOWED_REDIRECT_PATHS: readonly string[] = ['/auth/callback'];
