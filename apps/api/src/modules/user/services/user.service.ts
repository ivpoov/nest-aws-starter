import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { USER_REPOSITORY } from '@modules/user/constants/user.constants.js';
import { USER_NOT_FOUND } from '@modules/user/constants/user-errors.constants.js';
import type { CreateEmailUserDataInterface } from '@modules/user/interfaces/create-email-user-data.interface.js';
import type { CreateOauthUserDataInterface } from '@modules/user/interfaces/create-oauth-user-data.interface.js';
import type { UpdateProfileDataInterface } from '@modules/user/interfaces/update-profile-data.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserRepositoryInterface } from '@modules/user/interfaces/user-repository.interface.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new CustomLoggerService(UserService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryInterface,
  ) {}

  public async createWithEmailMethod(data: CreateEmailUserDataInterface): Promise<UserInterface> {
    const user: UserInterface = await this.userRepository.createWithEmailMethod(data);

    this.logger.log(`User created with email method: ${user.id}`);

    return user;
  }

  public async createWithOauthMethod(data: CreateOauthUserDataInterface): Promise<UserInterface> {
    const user: UserInterface = await this.userRepository.createWithOauthMethod(data);

    this.logger.log(`User created with ${data.type} method: ${user.id}`);

    return user;
  }

  public async findByIdOrThrow(id: string): Promise<UserInterface> {
    const user: UserInterface | null = await this.userRepository.findById(id);

    if (!user) throw new NotFoundError(USER_NOT_FOUND);

    return user;
  }

  public async findByAuthEmail(email: string): Promise<UserWithMethodTypesInterface | null> {
    return this.userRepository.findByAuthEmail(email);
  }

  public async updateProfile(id: string, data: UpdateProfileDataInterface): Promise<UserInterface> {
    const user: UserInterface | null = await this.userRepository.updateProfile(id, data);

    if (!user) throw new NotFoundError(USER_NOT_FOUND);

    this.logger.log(`User profile updated: ${id}`);

    return user;
  }
}
