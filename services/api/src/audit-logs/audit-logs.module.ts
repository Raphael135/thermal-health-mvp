import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  providers: [AuditLogService],
  controllers: [AuditLogsController],
  exports: [AuditLogService],
})
export class AuditLogsModule {}
