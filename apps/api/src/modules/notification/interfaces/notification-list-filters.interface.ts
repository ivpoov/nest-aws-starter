import type { NotificationListQueryInterface } from '@modules/notification/interfaces/notification-list-query.interface.js';
import type { NotificationScopeFiltersInterface } from '@modules/notification/interfaces/notification-scope-filters.interface.js';

export interface NotificationListFiltersInterface
  extends NotificationScopeFiltersInterface,
    NotificationListQueryInterface {}
