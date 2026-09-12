import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ThermalImagesService } from './thermal-images.service';

@Controller('examinations/:id/thermal-image')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ThermalImagesController {
  constructor(private readonly thermalImagesService: ThermalImagesService) {}

  // Apenas DOCTOR chega aqui — PATIENT e ADMIN são bloqueados por padrão (regra de produto).
  @Get()
  @Roles(Role.DOCTOR)
  getSignedUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    const ip = req.ip ?? null;
    return this.thermalImagesService.getSignedImageUrl(user, id, ip);
  }
}
