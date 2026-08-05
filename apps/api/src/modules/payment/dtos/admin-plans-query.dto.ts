import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';

// Cursor pagination only, no extra filters — the admin plan catalog is
// small and unfiltered listing (including inactive plans) is the point.
export class AdminPlansQueryDto extends CursorPaginationQueryDto {}
