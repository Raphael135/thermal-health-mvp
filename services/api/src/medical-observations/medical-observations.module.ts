import { Module } from '@nestjs/common';
import { MedicalObservationsService } from './medical-observations.service';
import { MedicalObservationsController } from './medical-observations.controller';

@Module({
  providers: [MedicalObservationsService],
  controllers: [MedicalObservationsController],
})
export class MedicalObservationsModule {}
