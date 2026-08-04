export interface CloudFrontSignerInterface {
  getSignedUrl(key: string): Promise<string>;
}
