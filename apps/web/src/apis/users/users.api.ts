import type {
  AvatarUploadResponseInterface,
  UpdateProfileRequestInterface,
  UserResponseInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function fetchMe(): Promise<UserResponseInterface> {
  return apiClient.get<UserResponseInterface>('/users/me');
}

export function updateMe(body: UpdateProfileRequestInterface): Promise<UserResponseInterface> {
  return apiClient.patch<UserResponseInterface>('/users/me', body);
}

export function createAvatarUpload(contentType: string): Promise<AvatarUploadResponseInterface> {
  return apiClient.post<AvatarUploadResponseInterface>('/users/me/avatar-upload', { contentType });
}

export async function uploadAvatar(file: File): Promise<void> {
  const target: AvatarUploadResponseInterface = await createAvatarUpload(file.type);

  await apiClient.uploadToUrl(target.uploadUrl, file, file.type);
}
