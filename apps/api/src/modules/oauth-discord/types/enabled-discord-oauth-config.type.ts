import type { DiscordOauthConfig } from '@configs/discord-oauth.config.js';

export type EnabledDiscordOauthConfigType = Extract<DiscordOauthConfig, { isEnabled: true }>;
