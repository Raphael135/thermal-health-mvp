import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DeviceStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DevicesService } from './devices.service';

class CreateDeviceDto {
  @IsString()
  hardwareId!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class SetStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'BLOCKED'])
  status!: DeviceStatus;
}

class LinkPatientDto {
  @IsOptional()
  @IsUUID()
  patientProfileId?: string | null;
}

@Controller('admin/devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TECHNICIAN)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto.hardwareId, dto.name);
  }

  @Get()
  list() {
    return this.devicesService.listAll();
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.devicesService.setStatus(id, dto.status);
  }

  @Patch(':id/link-patient')
  linkPatient(@Param('id') id: string, @Body() dto: LinkPatientDto) {
    return this.devicesService.linkToPatient(id, dto.patientProfileId ?? null);
  }
}
