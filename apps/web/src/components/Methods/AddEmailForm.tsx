import type { ReactElement } from 'react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface AddEmailFormPropsInterface {
  readonly onSubmit: (email: string, password: string) => Promise<boolean>;
}

export function AddEmailForm({ onSubmit }: AddEmailFormPropsInterface): ReactElement {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isPending, setIsPending] = useState<boolean>(false);

  async function handleSubmit(): Promise<void> {
    setIsPending(true);

    const isAdded: boolean = await onSubmit(email, password);

    if (isAdded) {
      setEmail('');
      setPassword('');
    }

    setIsPending(false);
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event): void => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <Input label="Email" type="email" value={email} onChange={setEmail} />
      <Input label="Password" type="password" value={password} onChange={setPassword} />
      <Button type="submit" isDisabled={isPending || !email || password.length < 8}>
        Add email sign-in
      </Button>
    </form>
  );
}
