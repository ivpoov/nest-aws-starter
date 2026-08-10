// The names OpenAPI security schemes are registered under in
// setup-swagger.helper.ts, and referred to by the `@ApiSecurity()` decorators on
// the controllers that require them. They live here rather than in the helper so
// a controller never has to import a bootstrap-time module to name a scheme, and
// so a typo in either half fails to compile instead of producing a document
// whose `security` entry points at a scheme that was never declared.
export const API_KEY_SECURITY_SCHEME = 'api-key';
