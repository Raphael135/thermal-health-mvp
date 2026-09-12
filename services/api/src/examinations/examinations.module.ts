import { Module } from '@nestjs/common';
import { ExaminationsService } from './examinations.service';
import { ExaminationsController } from './examinations.controller';
import { DeviceCapturesController } from './device-captures.controller';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule],
  providers: [ExaminationsService],
  controllers: [ExaminationsController, DeviceCapturesController],
  exports: [ExaminationsService],
})
export class ExaminationsModule {}
