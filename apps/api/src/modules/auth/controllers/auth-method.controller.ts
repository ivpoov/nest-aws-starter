import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { AUTH_METHOD_NOT_FOUND } from '@modules/auth/constants/linking-errors.constants.js';
import { AddEmailMethodDto } from '@modules/auth/dtos/add-email-method.dto.js';
import { AuthMethodsResponseDto } from '@modules/auth/dtos/responses/auth-methods-response.dto.js';
import { MethodLinkingService } from '@modules/auth/services/method-linking.service.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Auth methods')
@Controller('auth/methods')
export class AuthMethodController {
  constructor(private readonly linkingService: MethodLinkingService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: AuthMethodsResponseDto })
  @Serialize(AuthMethodsResponseDto)
  @Get()
  public async list(@CurrentUserId() userId: string): Promise<{ methods: AuthMethodInterface[] }> {
    return { methods: await this.linkingService.listMethods(userId) };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post('email')
  public addEmail(@CurrentUserId() userId: string, @Body() dto: AddEmailMethodDto): Promise<void> {
    return this.linkingService.addEmailMethod(userId, dto.email, dto.password);
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Delete(':type')
  public unlink(@CurrentUserId() userId: string, @Param('type') type: string): Promise<void> {
    return this.linkingService.unlinkMethod(userId, this.parseType(type));
  }

  private parseType(raw: string): AuthMethodTypeEnum {
    const type: AuthMethodTypeEnum | undefined = Object.values(AuthMethodTypeEnum).find(
      (candidate: AuthMethodTypeEnum): boolean => candidate.toLowerCase() === raw.toLowerCase(),
    );

    if (!type) throw new NotFoundError(AUTH_METHOD_NOT_FOUND);

    return type;
  }
}
