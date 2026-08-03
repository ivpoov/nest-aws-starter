import { Module } from '@nestjs/common';

// Carrier for CaslModule.forFeature dynamic registrations — a distinct class so
// each feature registration is its own module instance, never merged with the
// global CaslModule.
@Module({})
export class CaslFeatureModule {}
