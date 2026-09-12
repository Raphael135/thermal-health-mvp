import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Device } from '@prisma/client';
import { DeviceAuthGuard } from '../devices/device-auth.guard';
import { ExaminationsService } from './examinations.service';
import { CreateThermalCaptureDto } from './dto/create-thermal-capture.dto';

interface RequestWithDevice extends Request {
  device: Device;
}

/**
 * Endpoint chamado pelo próprio dispositivo (ESP32 real ou simulador),
 * autenticado por x-device-id / x-device-secret — nunca por JWT de usuário.
 */
@Controller('device-captures')
@UseGuards(DeviceAuthGuard)
export class DeviceCapturesController {
  constructor(private readonly examinationsService: ExaminationsService) {}

  @Post()
  create(@Req() req: RequestWithDevice, @Body() dto: CreateThermalCaptureDto) {
    return this.examinationsService.createFromDeviceCapture(req.device, dto);
  }
}
