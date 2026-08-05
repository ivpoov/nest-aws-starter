import type { NotificationScopeFiltersInterface } from '@modules/notification/interfaces/notification-scope-filters.interface.js';

export interface NotificationListFiltersInterface extends NotificationScopeFiltersInterface {
  readonly unreadOnly: boolean;
}
