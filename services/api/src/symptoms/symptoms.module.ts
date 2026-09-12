import { Module } from '@nestjs/common';
import { SymptomsService } from './symptoms.service';
import { SymptomsController } from './symptoms.controller';

@Module({
  providers: [SymptomsService],
  controllers: [SymptomsController],
})
export class SymptomsModule {}
