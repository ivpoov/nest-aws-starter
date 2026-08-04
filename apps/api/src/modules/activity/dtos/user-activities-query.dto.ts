import { ActivitiesQueryDto } from '@modules/activity/dtos/activities-query.dto.js';
import { OmitType } from '@nestjs/swagger';

// The user id comes from the route param — the query never repeats it.
export class UserActivitiesQueryDto extends OmitType(ActivitiesQueryDto, ['userId'] as const) {}
