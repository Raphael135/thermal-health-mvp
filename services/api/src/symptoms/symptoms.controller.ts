import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SymptomsService } from './symptoms.service';
import { CreateSymptomDto } from './dto/create-symptom.dto';

@Controller('symptoms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SymptomsController {
  constructor(private readonly symptomsService: SymptomsService) {}

  @Post()
  @Roles(Role.PATIENT)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSymptomDto) {
    return this.symptomsService.createOwn(user.patientProfileId!, dto);
  }

  @Get('me')
  @Roles(Role.PATIENT)
  listOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.symptomsService.listOwn(user.patientProfileId!);
  }

  @Get()
  @Roles(Role.DOCTOR)
  listForDoctor(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId: string) {
    return this.symptomsService.listForDoctor(user, patientId);
  }
}
