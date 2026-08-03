import type { FacebookOauthConfig } from '@configs/facebook-oauth.config.js';

export type EnabledFacebookOauthConfigType = Extract<FacebookOauthConfig, { isEnabled: true }>;
