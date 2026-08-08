export interface RequestOptionsInterface {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
  readonly isPublic?: boolean;
}
