import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { RequestUploadDto } from '@modules/file/dtos/request-upload.dto.js';
import { DownloadUrlResponseDto } from '@modules/file/dtos/responses/download-url-response.dto.js';
import { FileResponseDto } from '@modules/file/dtos/responses/file-response.dto.js';
import { RequestUploadResponseDto } from '@modules/file/dtos/responses/request-upload-response.dto.js';
import type { FileInterface } from '@modules/file/interfaces/file.interface.js';
import { FileService } from '@modules/file/services/file.service.js';
import type {
  DownloadUrlResponseInterface,
  RequestUploadResponseInterface,
} from '@nest-aws-starter/shared';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Files')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: RequestUploadResponseDto })
  @Serialize(RequestUploadResponseDto)
  @Post('upload-request')
  public requestUpload(
    @CurrentUserId() userId: string,
    @Body() dto: RequestUploadDto,
  ): Promise<RequestUploadResponseInterface> {
    return this.fileService.requestUpload(userId, dto.intent, dto.contentType, dto.size);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: FileResponseDto })
  @Serialize(FileResponseDto)
  @HttpCode(StatusCodes.OK)
  @Post(':id/confirm')
  public confirmUpload(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileInterface> {
    return this.fileService.confirmUpload(userId, id);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: DownloadUrlResponseDto })
  @Serialize(DownloadUrlResponseDto)
  @Get(':id/download-url')
  public getDownloadUrl(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DownloadUrlResponseInterface> {
    return this.fileService.getDownloadUrl(userId, id);
  }
}
