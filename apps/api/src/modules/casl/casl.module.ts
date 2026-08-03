import { CaslFeatureModule } from '@modules/casl/casl-feature.module.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import type { CaslFeatureOptionsInterface } from '@modules/casl/interfaces/casl-feature-options.interface.js';
import { CaslAbilityFactoryService } from '@modules/casl/services/casl-ability-factory.service.js';
import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';

@Global()
@Module({
  providers: [CaslAbilityFactoryService, AccessGuard],
  exports: [CaslAbilityFactoryService, AccessGuard],
})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic-module convention — forFeature lives on the module class
export class CaslModule {
  public static forFeature(options: CaslFeatureOptionsInterface): DynamicModule {
    const registrationProvider: Provider = {
      provide: Symbol('CASL_FEATURE_REGISTRATION'),
      inject: [CaslAbilityFactoryService],
      useFactory: (factory: CaslAbilityFactoryService): boolean => {
        factory.register(options.permissions);

        return true;
      },
    };

    return {
      module: CaslFeatureModule,
      providers: [registrationProvider],
    };
  }
}
