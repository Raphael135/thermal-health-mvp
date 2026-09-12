import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { DoctorsModule } from './doctors/doctors.module';
import { LinksModule } from './links/links.module';
import { DevicesModule } from './devices/devices.module';
import { ExaminationsModule } from './examinations/examinations.module';
import { ThermalImagesModule } from './thermal-images/thermal-images.module';
import { SymptomsModule } from './symptoms/symptoms.module';
import { MedicalObservationsModule } from './medical-observations/medical-observations.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    QueueModule,
    CommonModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    DoctorsModule,
    LinksModule,
    DevicesModule,
    ExaminationsModule,
    ThermalImagesModule,
    SymptomsModule,
    MedicalObservationsModule,
    AuditLogsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
