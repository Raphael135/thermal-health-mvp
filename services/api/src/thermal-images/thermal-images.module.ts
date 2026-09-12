import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ThermalImagesService } from './thermal-images.service';
import { ThermalImagesController } from './thermal-images.controller';

@Module({
  imports: [AuditLogsModule],
  providers: [ThermalImagesService],
  controllers: [ThermalImagesController],
})
export class ThermalImagesModule {}
