import { UserRoleEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAdminGate } from '../../hooks/auth/useAdminGate';
import { useLogout } from '../../hooks/auth/useLogout';
import { Loader } from '../ui/Loader';

export function AdminGate(): ReactElement {
  const { isAuthenticated, isResolving, role } = useAdminGate();
  const { logout } = useLogout();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isResolving) return <Loader />;

  if (role !== UserRoleEnum.ADMIN) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg">403 — this area needs an admin account.</p>
        <button
          type="button"
          onClick={(): void => void logout()}
          className="rounded-lg border border-edge px-4 py-2 text-sm hover:bg-surface"
        >
          Switch account
        </button>
      </div>
    );
  }

  return <Outlet />;
}
