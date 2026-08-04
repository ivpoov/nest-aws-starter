import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { AdminScope } from '@modules/casl/decorators/admin-scope.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { ContactMessagesQueryDto } from '@modules/contact-us/dtos/contact-messages-query.dto.js';
import { ContactMessageListResponseDto } from '@modules/contact-us/dtos/responses/contact-message-list-response.dto.js';
import { ContactMessageResponseDto } from '@modules/contact-us/dtos/responses/contact-message-response.dto.js';
import { UpdateContactMessageStatusDto } from '@modules/contact-us/dtos/update-contact-message-status.dto.js';
import { ContactMessageEntity } from '@modules/contact-us/entities/contact-message.entity.js';
import type { ContactMessageInterface } from '@modules/contact-us/interfaces/contact-message.interface.js';
import type { ContactMessageListInterface } from '@modules/contact-us/interfaces/contact-message-list.interface.js';
import { ContactMessageService } from '@modules/contact-us/services/contact-message.service.js';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Admin contact messages')
@UseGuards(AccessGuard)
@AdminScope()
@Controller('admin/contact-messages')
export class ContactMessageAdminController {
  constructor(private readonly contactMessageService: ContactMessageService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: ContactMessageListResponseDto })
  @Serialize(ContactMessageListResponseDto)
  @UseAbility(ActionsEnum.READ, ContactMessageEntity)
  @Get()
  public findMany(@Query() query: ContactMessagesQueryDto): Promise<ContactMessageListInterface> {
    return this.contactMessageService.findMany(
      { cursor: query.cursor, limit: query.limit },
      { status: query.status ?? null },
    );
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: ContactMessageResponseDto })
  @Serialize(ContactMessageResponseDto)
  @UseAbility(ActionsEnum.UPDATE, ContactMessageEntity)
  @Patch(':id/status')
  public updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactMessageStatusDto,
  ): Promise<ContactMessageInterface> {
    return this.contactMessageService.updateStatus(id, dto.status);
  }
}
