import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUsersQueryDto extends CursorPaginationQueryDto {
  // Case-insensitive substring match against the display name and against
  // every linked auth method's email — deliberately not prefix-only, because
  // finding a user by "@company.com" or by a surname is most of what this box
  // is for. Both sides are served by trigram indexes (see schema.prisma);
  // trigrams need three characters, so one- and two-character searches still
  // scan. They match densely enough that the page limit ends the scan early.
  @ApiPropertyOptional({
    type: String,
    example: 'igor',
    description:
      'Case-insensitive substring match on display name or linked email. Searches of three characters or more are index-accelerated.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  readonly search: string | null = null;
}
