import { FileIntentEnum } from '@nest-aws-starter/shared';
import type { ChangeEvent, ReactElement } from 'react';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { ALLOWED_FILE_CONTENT_TYPES } from '../constants/file-upload.constants';
import { useProfile } from '../hooks/users/useProfile';

const AVATAR_ACCEPT: string = ALLOWED_FILE_CONTENT_TYPES[FileIntentEnum.AVATAR].join(',');

export function ProfilePage(): ReactElement {
  const { profile, isLoading, isUploadingAvatar, error, rename, uploadAvatar } = useProfile();
  const [displayName, setDisplayName] = useState<string | null>(null);

  if (isLoading && !profile) return <Loader />;
  if (error && !profile) return <ErrorMessage error={error} />;
  if (!profile) return <Loader />;

  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    const file: File | undefined = event.target.files?.[0];

    if (file) void uploadAvatar(file);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Profile">
        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt="Avatar"
              className="size-16 rounded-full border border-edge object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full border border-edge text-content-muted">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <label className="cursor-pointer text-sm text-accent">
            {isUploadingAvatar ? 'Uploading…' : 'Change avatar'}
            <input
              type="file"
              accept={AVATAR_ACCEPT}
              onChange={handleFile}
              disabled={isUploadingAvatar}
              className="hidden"
            />
          </label>
        </div>
        <form
          className="mt-6 flex items-end gap-3"
          onSubmit={(event): void => {
            event.preventDefault();
            if (displayName !== null) void rename(displayName);
          }}
        >
          <div className="grow">
            <Input
              label="Display name"
              value={displayName ?? profile.displayName}
              onChange={setDisplayName}
            />
          </div>
          <Button type="submit" isDisabled={displayName === null || displayName.length === 0}>
            Save
          </Button>
        </form>
        {error ? <p className="mt-3 text-sm text-danger">{error.details}</p> : null}
      </Card>
    </div>
  );
}
