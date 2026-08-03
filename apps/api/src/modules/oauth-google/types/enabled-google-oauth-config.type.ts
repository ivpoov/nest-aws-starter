import type { GoogleOauthConfig } from '@configs/google-oauth.config.js';

export type EnabledGoogleOauthConfigType = Extract<GoogleOauthConfig, { isEnabled: true }>;
