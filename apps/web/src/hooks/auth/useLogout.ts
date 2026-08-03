import { useNavigate } from 'react-router';
import { logout as logoutRequest } from '../../apis/auth';
import type { UseLogoutResultInterface } from '../../interfaces/use-logout-result.interface';
import { useAuthStore } from '../../stores/auth.store';
import { logger } from '../../utils/logger';

export function useLogout(): UseLogoutResultInterface {
  const navigate = useNavigate();
  const clear = useAuthStore((state) => state.clear);

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } catch (caught) {
      logger.warn('Logout request failed, clearing local session anyway', caught);
    }

    clear();
    await navigate('/login');
  }

  return { logout };
}
