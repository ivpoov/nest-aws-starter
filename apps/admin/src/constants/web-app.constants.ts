// The admin UI opens the web app's OAuth-style exchange-code callback for
// "login as user" — never tokens in a URL. Separate deployable, own env var.
export const WEB_APP_URL: string =
  (import.meta.env.VITE_WEB_APP_URL as string | undefined) ?? 'http://localhost:5173';
