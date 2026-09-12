import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DoctorsService } from './doctors.service';

@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get('me')
  @Roles(Role.DOCTOR)
  getOwnProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.doctorsService.getOwnProfile(user.userId);
  }

  // Lista de médicos disponível para a paciente escolher a quem se vincular, e para o admin gerenciar.
  @Get()
  @Roles(Role.PATIENT, Role.ADMIN)
  list() {
    return this.doctorsService.listAll();
  }
}
