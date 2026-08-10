import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.url(),
  }),
]);

export type FacebookOauthConfig = z.infer<typeof configSchema>;

export const facebookOauthConfig = registerAs('facebookOauth', (): FacebookOauthConfig => {
  const isEnabled: boolean = process.env.FACEBOOK_OAUTH_ENABLED === 'true';

  return validateConfigSchema(
    configSchema,
    isEnabled
      ? {
          isEnabled: true,
          clientId: process.env.FACEBOOK_OAUTH_CLIENT_ID ?? '',
          clientSecret: process.env.FACEBOOK_OAUTH_CLIENT_SECRET ?? '',
          redirectUri: process.env.FACEBOOK_OAUTH_REDIRECT_URI ?? '',
        }
      : { isEnabled: false },
  );
});
