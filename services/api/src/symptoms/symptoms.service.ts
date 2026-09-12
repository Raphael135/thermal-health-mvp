import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../common/access-control.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateSymptomDto } from './dto/create-symptom.dto';

@Injectable()
export class SymptomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async createOwn(patientProfileId: string, dto: CreateSymptomDto) {
    return this.prisma.symptomReport.create({
      data: {
        patientId: patientProfileId,
        description: dto.description,
        severity: dto.severity,
        examinationId: dto.examinationId,
      },
    });
  }

  async listOwn(patientProfileId: string) {
    return this.prisma.symptomReport.findMany({
      where: { patientId: patientProfileId },
      orderBy: { reportedAt: 'desc' },
    });
  }

  /** Médico consulta sintomas de uma paciente vinculada. */
  async listForDoctor(user: AuthenticatedUser, patientProfileId: string) {
    await this.accessControl.assertDoctorHasActiveLink(user.userId, patientProfileId);
    return this.prisma.symptomReport.findMany({
      where: { patientId: patientProfileId },
      orderBy: { reportedAt: 'desc' },
    });
  }
}
