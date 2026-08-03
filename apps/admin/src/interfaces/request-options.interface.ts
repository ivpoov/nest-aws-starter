export interface RequestOptionsInterface {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
  readonly isPublic?: boolean;
}
