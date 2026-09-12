import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../common/access-control.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateObservationDto } from './dto/create-observation.dto';

@Injectable()
export class MedicalObservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateObservationDto) {
    const examination = await this.prisma.examination.findUnique({ where: { id: dto.examinationId } });
    if (!examination) throw new NotFoundException('Exame não encontrado.');

    await this.accessControl.assertDoctorHasActiveLink(user.userId, examination.patientId);

    return this.prisma.medicalObservation.create({
      data: {
        examinationId: dto.examinationId,
        doctorId: user.doctorProfileId!,
        note: dto.note,
        releasedToPatient: dto.releasedToPatient ?? false,
      },
    });
  }
}
