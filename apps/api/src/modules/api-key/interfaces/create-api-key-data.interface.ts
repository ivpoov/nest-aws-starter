export interface CreateApiKeyDataInterface {
  readonly name: string;
  readonly ownerId: string;
  readonly hashedKey: string;
  readonly prefix: string;
}
