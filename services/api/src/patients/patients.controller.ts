import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PatientsService } from './patients.service';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get('me')
  @Roles(Role.PATIENT)
  getOwnProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.getOwnProfile(user.userId);
  }

  @Patch('me')
  @Roles(Role.PATIENT)
  updateOwnProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePatientDto) {
    return this.patientsService.updateOwnProfile(user.userId, dto);
  }

  @Get()
  @Roles(Role.DOCTOR, Role.ADMIN)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.list(user);
  }

  @Get(':id')
  @Roles(Role.DOCTOR, Role.ADMIN)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patientsService.getById(user, id);
  }
}
