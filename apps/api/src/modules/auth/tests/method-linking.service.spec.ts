import {
  AUTH_LAST_METHOD,
  AUTH_METHOD_NOT_FOUND,
} from '@modules/auth/constants/linking-errors.constants.js';
import type { EmailFlowService } from '@modules/auth/services/email-flow.service.js';
import { MethodLinkingService } from '@modules/auth/services/method-linking.service.js';
import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import { UnlinkMethodResultEnum } from '@modules/user/enums/unlink-method-result.enum.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

function method(overrides: Partial<AuthMethodInterface>): AuthMethodInterface {
  return {
    id: 'm-1',
    userId: 'u-1',
    type: AuthMethodTypeEnum.EMAIL,
    email: 'user@example.com',
    isEmailVerified: true,
    passwordHash: 'hash',
    providerAccountId: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    lastUsedAt: null,
    ...overrides,
  };
}

interface SetupInterface {
  readonly service: MethodLinkingService;
  readonly users: {
    findMethodsByUserId: ReturnType<typeof vi.fn>;
    findEmailMethod: ReturnType<typeof vi.fn>;
    findByAuthEmail: ReturnType<typeof vi.fn>;
    addEmailMethod: ReturnType<typeof vi.fn>;
    removeMethodUnlessLast: ReturnType<typeof vi.fn>;
  };
  readonly emailFlow: { requestEmailVerification: ReturnType<typeof vi.fn> };
  readonly emit: ReturnType<typeof vi.fn>;
}

function setup(methods: AuthMethodInterface[]): SetupInterface {
  const users = {
    findMethodsByUserId: vi.fn().mockResolvedValue(methods),
    findEmailMethod: vi.fn().mockResolvedValue(null),
    findByAuthEmail: vi.fn().mockResolvedValue(null),
    addEmailMethod: vi.fn().mockResolvedValue(undefined),
    removeMethodUnlessLast: vi.fn().mockResolvedValue(UnlinkMethodResultEnum.REMOVED),
  };
  const emailFlow = { requestEmailVerification: vi.fn().mockResolvedValue(undefined) };
  const emit = vi.fn();
  const eventBus = { emit } as unknown as EventBusService;
  const service: MethodLinkingService = new MethodLinkingService(
    users as unknown as UserService,
    emailFlow as unknown as EmailFlowService,
    eventBus,
  );

  return { service, users, emailFlow, emit };
}

describe('MethodLinkingService addEmailMethod', () => {
  it('hashes the password, stores the method and kicks off verification', async () => {
    const { service, users, emailFlow, emit } = setup([
      method({ type: AuthMethodTypeEnum.GOOGLE, providerAccountId: 'acc' }),
    ]);

    await service.addEmailMethod('u-1', 'new@example.com', 'correct-horse-battery');

    const [userId, email, passwordHash] = users.addEmailMethod.mock.calls[0] as string[];

    expect(userId).toBe('u-1');
    expect(email).toBe('new@example.com');
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(emailFlow.requestEmailVerification).toHaveBeenCalledWith('u-1');
    expect(emit).toHaveBeenCalledWith('auth.method-linked', {
      userId: 'u-1',
      type: AuthMethodTypeEnum.EMAIL,
    });
  });

  it('rejects when an email method already exists', async () => {
    const { service, users } = setup([method({})]);

    await expect(service.addEmailMethod('u-1', 'x@example.com', 'password-123')).rejects.toThrow(
      ConflictError,
    );
    expect(users.addEmailMethod).not.toHaveBeenCalled();
  });

  it('rejects when the email is another account sign-in and names its providers', async () => {
    const { service, users } = setup([
      method({ type: AuthMethodTypeEnum.GOOGLE, providerAccountId: 'acc' }),
    ]);

    users.findEmailMethod.mockResolvedValue(method({ userId: 'u-other' }));
    users.findMethodsByUserId.mockImplementation(
      async (userId: string): Promise<AuthMethodInterface[]> =>
        userId === 'u-other'
          ? [method({ userId: 'u-other' })]
          : [method({ type: AuthMethodTypeEnum.GOOGLE, providerAccountId: 'acc' })],
    );

    const caught = await service
      .addEmailMethod('u-1', 'user@example.com', 'password-123')
      .then(() => null)
      .catch((error: ConflictError): ConflictError => error);

    expect(caught?.args.code).toBe('AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT');
    expect(caught?.args.meta).toEqual({ providers: [AuthMethodTypeEnum.EMAIL] });
  });

  it('rejects when the email is claimed by another account through oauth', async () => {
    const { service, users } = setup([
      method({ type: AuthMethodTypeEnum.GOOGLE, providerAccountId: 'acc' }),
    ]);

    users.findByAuthEmail.mockResolvedValue({
      id: 'u-other',
      methodTypes: [AuthMethodTypeEnum.DISCORD],
    });

    const caught = await service
      .addEmailMethod('u-1', 'user@example.com', 'password-123')
      .then(() => null)
      .catch((error: ConflictError): ConflictError => error);

    expect(caught?.args.code).toBe('AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT');
    expect(caught?.args.meta).toEqual({ providers: [AuthMethodTypeEnum.DISCORD] });
  });

  it('allows the email when it only matches the caller own oauth method', async () => {
    const { service, users } = setup([
      method({ type: AuthMethodTypeEnum.GOOGLE, providerAccountId: 'acc' }),
    ]);

    users.findByAuthEmail.mockResolvedValue({
      id: 'u-1',
      methodTypes: [AuthMethodTypeEnum.GOOGLE],
    });

    await service.addEmailMethod('u-1', 'user@example.com', 'password-123');

    expect(users.addEmailMethod).toHaveBeenCalled();
  });
});

describe('MethodLinkingService unlinkMethod', () => {
  it('removes a linked method when the guarded delete reports success', async () => {
    const { service, users, emit } = setup([
      method({}),
      method({ id: 'm-2', type: AuthMethodTypeEnum.GOOGLE, providerAccountId: 'acc' }),
    ]);

    await service.unlinkMethod('u-1', AuthMethodTypeEnum.GOOGLE);

    expect(users.removeMethodUnlessLast).toHaveBeenCalledWith('u-1', AuthMethodTypeEnum.GOOGLE);
    expect(emit).toHaveBeenCalledWith('auth.method-unlinked', {
      userId: 'u-1',
      type: AuthMethodTypeEnum.GOOGLE,
    });
  });

  it('rejects unlinking a method that is not linked', async () => {
    const { service, users, emit } = setup([method({})]);

    users.removeMethodUnlessLast.mockResolvedValue(UnlinkMethodResultEnum.NOT_FOUND);

    const caught = await service
      .unlinkMethod('u-1', AuthMethodTypeEnum.GOOGLE)
      .then(() => null)
      .catch((error: NotFoundError): NotFoundError => error);

    expect(caught).toBeInstanceOf(NotFoundError);
    expect(caught?.args.code).toBe(AUTH_METHOD_NOT_FOUND.code);
    expect(emit).not.toHaveBeenCalled();
  });

  it('guards the last remaining method', async () => {
    const { service, users, emit } = setup([method({})]);

    users.removeMethodUnlessLast.mockResolvedValue(UnlinkMethodResultEnum.LAST_METHOD);

    const caught = await service
      .unlinkMethod('u-1', AuthMethodTypeEnum.EMAIL)
      .then(() => null)
      .catch((error: ConflictError): ConflictError => error);

    expect(caught).toBeInstanceOf(ConflictError);
    expect(caught?.args.code).toBe(AUTH_LAST_METHOD.code);
    expect(emit).not.toHaveBeenCalled();
  });

  // Regression guard for the unlink race: the service must not decide "is this
  // the last method?" from a read of its own. Any such read is by definition
  // stale by the time the delete runs, which is how two concurrent unlinks
  // used to strip an account of every way in.
  it('never pre-reads the method list to decide the last-method question', async () => {
    const { service, users } = setup([
      method({}),
      method({ id: 'm-2', type: AuthMethodTypeEnum.GOOGLE, providerAccountId: 'acc' }),
    ]);

    await service.unlinkMethod('u-1', AuthMethodTypeEnum.GOOGLE);

    expect(users.findMethodsByUserId).not.toHaveBeenCalled();
  });
});
