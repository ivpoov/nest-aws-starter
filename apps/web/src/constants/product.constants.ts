// The one place a fork renames the product. Everything that shows the name —
// the login page, the browser tab — reads it from here, so renaming is an
// env var rather than a grep.
//
// A default is deliberate: a fresh clone with no .env has to render something
// sensible, and a placeholder that reads `%VITE_PRODUCT_NAME%` on screen would
// be worse than a name somebody has to change.
export const PRODUCT_NAME: string =
  (import.meta.env.VITE_PRODUCT_NAME as string | undefined) ?? 'Starter';
