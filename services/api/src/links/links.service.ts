import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LinkStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Paciente solicita vínculo com um médico (fica PENDING até o médico aceitar). */
  async requestLink(patientProfileId: string, doctorProfileId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { id: doctorProfileId } });
    if (!doctor) throw new NotFoundException('Médico não encontrado.');

    const existing = await this.prisma.doctorPatientLink.findUnique({
      where: { doctorId_patientId: { doctorId: doctorProfileId, patientId: patientProfileId } },
    });
    if (existing && existing.status !== LinkStatus.REVOKED) {
      throw new ConflictException('Já existe um vínculo ativo ou pendente com este médico.');
    }

    if (existing) {
      return this.prisma.doctorPatientLink.update({
        where: { id: existing.id },
        data: { status: LinkStatus.PENDING, revokedAt: null },
      });
    }

    return this.prisma.doctorPatientLink.create({
      data: { doctorId: doctorProfileId, patientId: patientProfileId, status: LinkStatus.PENDING },
    });
  }

  /** Médico aceita um vínculo pendente com uma paciente. */
  async acceptLink(doctorProfileId: string, linkId: string) {
    const link = await this.prisma.doctorPatientLink.findUnique({ where: { id: linkId } });
    if (!link || link.doctorId !== doctorProfileId) {
      throw new NotFoundException('Vínculo não encontrado.');
    }
    return this.prisma.doctorPatientLink.update({
      where: { id: linkId },
      data: { status: LinkStatus.ACTIVE },
    });
  }

  /** Médico ou Admin revoga um vínculo existente. */
  async revokeLink(linkId: string, actor: { role: string; doctorProfileId?: string }) {
    const link = await this.prisma.doctorPatientLink.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');

    if (actor.role === 'DOCTOR' && link.doctorId !== actor.doctorProfileId) {
      throw new ForbiddenException('Você só pode revogar seus próprios vínculos.');
    }

    return this.prisma.doctorPatientLink.update({
      where: { id: linkId },
      data: { status: LinkStatus.REVOKED, revokedAt: new Date() },
    });
  }

  /** Admin cria vínculo já ativo diretamente (sem fluxo de solicitação). */
  async createActiveLink(doctorProfileId: string, patientProfileId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { id: doctorProfileId } });
    const patient = await this.prisma.patientProfile.findUnique({ where: { id: patientProfileId } });
    if (!doctor || !patient) throw new NotFoundException('Médico ou paciente não encontrado.');

    return this.prisma.doctorPatientLink.upsert({
      where: { doctorId_patientId: { doctorId: doctorProfileId, patientId: patientProfileId } },
      update: { status: LinkStatus.ACTIVE, revokedAt: null },
      create: { doctorId: doctorProfileId, patientId: patientProfileId, status: LinkStatus.ACTIVE },
    });
  }

  async listForPatient(patientProfileId: string) {
    return this.prisma.doctorPatientLink.findMany({
      where: { patientId: patientProfileId },
      include: { doctor: { select: { id: true, fullName: true, crm: true, specialty: true } } },
    });
  }

  async listForDoctor(doctorProfileId: string, status?: LinkStatus) {
    return this.prisma.doctorPatientLink.findMany({
      where: { doctorId: doctorProfileId, status },
      include: { patient: { select: { id: true, fullName: true } } },
    });
  }

  async listAll() {
    return this.prisma.doctorPatientLink.findMany({
      include: {
        doctor: { select: { id: true, fullName: true, crm: true } },
        patient: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
