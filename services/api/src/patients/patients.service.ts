import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../common/access-control.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async getOwnProfile(userId: string) {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Perfil de paciente não encontrado.');
    return profile;
  }

  async updateOwnProfile(userId: string, dto: UpdatePatientDto) {
    const profile = await this.getOwnProfile(userId);
    return this.prisma.patientProfile.update({
      where: { id: profile.id },
      data: {
        fullName: dto.fullName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        phone: dto.phone,
      },
    });
  }

  /** Usado pelo médico/admin. Nunca retorna dados de exame/imagem — isso fica em ExaminationsModule. */
  async getById(user: AuthenticatedUser, patientProfileId: string) {
    await this.accessControl.assertCanAccessPatientProfile(user, patientProfileId);

    const profile = await this.prisma.patientProfile.findUnique({ where: { id: patientProfileId } });
    if (!profile) throw new NotFoundException('Paciente não encontrada.');
    return profile;
  }

  /** Lista pacientes vinculadas (médico) ou todas (admin). */
  async list(user: AuthenticatedUser) {
    if (user.role === 'ADMIN') {
      return this.prisma.patientProfile.findMany({
        select: { id: true, fullName: true, createdAt: true, user: { select: { email: true, isActive: true } } },
      });
    }

    // DOCTOR: apenas pacientes com vínculo ativo.
    const doctorProfileId = await this.accessControl.getDoctorProfileIdOrThrow(user.userId);
    const links = await this.prisma.doctorPatientLink.findMany({
      where: { doctorId: doctorProfileId, status: 'ACTIVE' },
      include: { patient: { select: { id: true, fullName: true, createdAt: true } } },
    });
    return links.map((l) => l.patient);
  }
}
