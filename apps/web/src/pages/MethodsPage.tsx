import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { ProviderButtons } from '../components/Auth/ProviderButtons';
import { AddEmailForm } from '../components/Methods/AddEmailForm';
import { ConflictHint } from '../components/Methods/ConflictHint';
import { MethodList } from '../components/Methods/MethodList';
import { Card } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';
import { useLinkedMethods } from '../hooks/methods/useLinkedMethods';

export function MethodsPage(): ReactElement {
  const { methods, isLoading, error, addEmail, unlink } = useLinkedMethods();

  if (isLoading && methods.length === 0) return <Loader />;

  const hasEmailMethod: boolean = methods.some(
    (method): boolean => method.type === AuthMethodTypeEnum.EMAIL,
  );

  return (
    <div className="flex flex-col gap-6">
      <Card title="Sign-in methods">
        <MethodList methods={methods} onUnlink={(type): void => void unlink(type)} />
        {error ? (
          <div className="mt-4">
            <ConflictHint error={error} />
          </div>
        ) : null}
      </Card>
      {hasEmailMethod ? null : (
        <Card title="Add email sign-in">
          <AddEmailForm
            onSubmit={(email: string, password: string): Promise<boolean> =>
              addEmail({ email, password })
            }
          />
        </Card>
      )}
      <Card title="Link a provider">
        <ProviderButtons intent="link" />
      </Card>
    </div>
  );
}
