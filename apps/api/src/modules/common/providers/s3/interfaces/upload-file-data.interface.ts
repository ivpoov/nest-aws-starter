export interface UploadFileDataInterface {
  readonly key: string;
  readonly body: Buffer;
  readonly contentType: string;
}
