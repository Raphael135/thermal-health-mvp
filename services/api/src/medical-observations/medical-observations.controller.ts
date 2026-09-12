import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MedicalObservationsService } from './medical-observations.service';
import { CreateObservationDto } from './dto/create-observation.dto';

@Controller('medical-observations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
export class MedicalObservationsController {
  constructor(private readonly service: MedicalObservationsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateObservationDto) {
    return this.service.create(user, dto);
  }
}
