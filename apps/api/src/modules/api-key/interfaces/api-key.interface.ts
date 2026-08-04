// Domain shape — deliberately excludes hashedKey: nothing outside the
// repository ever needs the hash itself, only the ability to look a key up
// by it (findByHashedKey) or compare against it.
export interface ApiKeyInterface {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly ownerId: string;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}
