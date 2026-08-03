import type { ApiErrorInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import { submitContact } from '../apis/contact';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { toApiError } from '../utils/toApiError';

const NAME_MAX_LENGTH = 120;
const EMAIL_MAX_LENGTH = 320;
const SUBJECT_MAX_LENGTH = 200;
const BODY_MAX_LENGTH = 5000;

export function ContactPage(): ReactElement {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [isSent, setIsSent] = useState<boolean>(false);
  const isSubmitDisabled: boolean = isPending || !name || !email || !subject || !body;

  async function handleSubmit(): Promise<void> {
    setIsPending(true);
    setError(null);

    try {
      await submitContact({ name, email, subject, body, website });
      setIsSent(true);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card title="Contact us">
        {isSent ? (
          <p className="text-sm">Thanks — we&apos;ll get back to you.</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event): void => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <Input label="Name" value={name} onChange={setName} maxLength={NAME_MAX_LENGTH} />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              maxLength={EMAIL_MAX_LENGTH}
            />
            <Input
              label="Subject"
              value={subject}
              onChange={setSubject}
              maxLength={SUBJECT_MAX_LENGTH}
            />
            <Textarea label="Message" value={body} onChange={setBody} maxLength={BODY_MAX_LENGTH} />
            {/* Extra field left empty by real visitors; kept off-screen and out of the accessibility tree. */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(event): void => setWebsite(event.target.value)}
              className="absolute -left-[9999px] h-px w-px overflow-hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            {error ? <p className="text-sm text-danger">{error.details}</p> : null}
            <Button type="submit" isDisabled={isSubmitDisabled}>
              Send message
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-content-muted">
          <Link to="/login" className="hover:text-content">
            Back to log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
