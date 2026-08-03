export interface FacebookProfileResponseInterface {
  readonly id: string;
  readonly name?: string | undefined;
  readonly email?: string | undefined;
  readonly picture?:
    | { readonly data?: { readonly url?: string | undefined } | undefined }
    | undefined;
}
