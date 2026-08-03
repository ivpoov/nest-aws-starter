import { type CreateContactRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactDto implements CreateContactRequestInterface {
  @ApiProperty({ type: String, example: 'Jane Doe', maxLength: 120 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  readonly name: string;

  @ApiProperty({ type: String, example: 'jane@example.com', maxLength: 320 })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(320)
  readonly email: string;

  @ApiProperty({ type: String, example: 'Question about pricing', maxLength: 200 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  readonly subject: string;

  @ApiProperty({ type: String, example: 'Hi, I would like to know...', maxLength: 5000 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  readonly body: string;

  // Honeypot: hidden on the real form via CSS, so only bots fill it in. Never
  // documented as such in the public description — that would defeat it.
  @ApiPropertyOptional({ type: String, example: '', description: 'Leave this field empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly website?: string | undefined;
}
