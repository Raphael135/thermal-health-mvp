import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LinksService } from './links.service';

class RequestLinkDto {
  @IsUUID()
  doctorProfileId!: string;
}

class CreateLinkDto {
  @IsUUID()
  doctorProfileId!: string;

  @IsUUID()
  patientProfileId!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post('patients/me/doctor-links')
  @Roles(Role.PATIENT)
  requestLink(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestLinkDto) {
    return this.linksService.requestLink(user.patientProfileId!, dto.doctorProfileId);
  }

  @Get('patients/me/doctor-links')
  @Roles(Role.PATIENT)
  listOwnLinks(@CurrentUser() user: AuthenticatedUser) {
    return this.linksService.listForPatient(user.patientProfileId!);
  }

  @Get('doctors/me/patient-links')
  @Roles(Role.DOCTOR)
  listDoctorLinks(@CurrentUser() user: AuthenticatedUser) {
    return this.linksService.listForDoctor(user.doctorProfileId!);
  }

  @Patch('doctors/me/patient-links/:linkId/accept')
  @Roles(Role.DOCTOR)
  acceptLink(@CurrentUser() user: AuthenticatedUser, @Param('linkId') linkId: string) {
    return this.linksService.acceptLink(user.doctorProfileId!, linkId);
  }

  @Patch('doctor-patient-links/:linkId/revoke')
  @Roles(Role.DOCTOR, Role.ADMIN)
  revokeLink(@CurrentUser() user: AuthenticatedUser, @Param('linkId') linkId: string) {
    return this.linksService.revokeLink(linkId, {
      role: user.role,
      doctorProfileId: user.doctorProfileId,
    });
  }

  @Post('admin/doctor-patient-links')
  @Roles(Role.ADMIN)
  createLink(@Body() dto: CreateLinkDto) {
    return this.linksService.createActiveLink(dto.doctorProfileId, dto.patientProfileId);
  }

  @Get('admin/doctor-patient-links')
  @Roles(Role.ADMIN)
  listAll() {
    return this.linksService.listAll();
  }
}
