import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ExaminationsService } from './examinations.service';

@Controller('examinations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExaminationsController {
  constructor(private readonly examinationsService: ExaminationsService) {}

  // Captura de demonstração (sem aparelho). Só funciona com ALLOW_DEMO_CAPTURE=true.
  @Post('demo')
  @Roles(Role.PATIENT)
  createDemo(@CurrentUser() user: AuthenticatedUser) {
    return this.examinationsService.createDemoExamination(user.patientProfileId!);
  }

  @Get('me')
  @Roles(Role.PATIENT)
  listOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.examinationsService.listForPatient(user.patientProfileId!);
  }

  @Get(':id')
  @Roles(Role.PATIENT, Role.DOCTOR)
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    if (user.role === Role.PATIENT) {
      return this.examinationsService.getForPatient(user, id);
    }
    return this.examinationsService.getForDoctor(user, id);
  }

  @Get()
  @Roles(Role.DOCTOR)
  listForPatientAsDoctor(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId: string) {
    return this.examinationsService.listForDoctor(user, patientId);
  }
}
