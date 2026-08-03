export interface DiscordUserResponseInterface {
  readonly id: string;
  readonly username: string;
  readonly global_name?: string | undefined;
  readonly email?: string | undefined;
  readonly verified?: boolean | undefined;
  readonly avatar?: string | undefined;
}
