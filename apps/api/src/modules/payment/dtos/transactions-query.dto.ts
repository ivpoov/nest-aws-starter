import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';

// Cursor pagination only — own-transactions is always scoped to the caller,
// no filters needed.
export class TransactionsQueryDto extends CursorPaginationQueryDto {}
