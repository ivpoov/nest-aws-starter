import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.url(),
  }),
]);

export type DiscordOauthConfig = z.infer<typeof scheme>;

export const discordOauthConfig = registerAs('discordOauth', (): DiscordOauthConfig => {
  const isEnabled: boolean = process.env.DISCORD_OAUTH_ENABLED === 'true';

  const config: DiscordOauthConfig = isEnabled
    ? {
        isEnabled: true,
        clientId: process.env.DISCORD_OAUTH_CLIENT_ID ?? '',
        clientSecret: process.env.DISCORD_OAUTH_CLIENT_SECRET ?? '',
        redirectUri: process.env.DISCORD_OAUTH_REDIRECT_URI ?? '',
      }
    : { isEnabled: false };

  validateScheme(scheme, config, new Logger('DiscordOauthConfig'));

  return config;
});
