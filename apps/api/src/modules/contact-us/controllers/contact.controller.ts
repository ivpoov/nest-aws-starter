import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Public } from '@decorators/public.decorator.js';
import { CreateContactDto } from '@modules/contact-us/dtos/create-contact.dto.js';
import { ContactMessageService } from '@modules/contact-us/services/contact-message.service.js';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactMessageService: ContactMessageService) {}

  // Public: the contact form is reachable before any account exists. Always
  // 204 — a filled honeypot and a real submission look identical on the
  // wire, and the message id is never echoed back publicly.
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post()
  public submit(@Body() dto: CreateContactDto, @Req() request: FastifyRequest): Promise<void> {
    return this.contactMessageService.submit(dto, dto.website, request.ip);
  }
}
