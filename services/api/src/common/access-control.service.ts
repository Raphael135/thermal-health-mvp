import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LinkStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './decorators/current-user.decorator';

/**
 * Ponto único de decisão para "quem pode ver o quê".
 * Nenhum controller/service deve checar vínculo médico-paciente por conta própria —
 * sempre passar por aqui, para manter a regra de acesso centralizada e auditável.
 */
@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lança ForbiddenException se o médico não tiver vínculo ATIVO com a paciente. */
  async assertDoctorHasActiveLink(doctorUserId: string, patientProfileId: string): Promise<void> {
    const doctorProfile = await this.prisma.doctorProfile.findUnique({
      where: { userId: doctorUserId },
    });
    if (!doctorProfile) {
      throw new ForbiddenException('Perfil médico não encontrado.');
    }

    const link = await this.prisma.doctorPatientLink.findUnique({
      where: {
        doctorId_patientId: {
          doctorId: doctorProfile.id,
          patientId: patientProfileId,
        },
      },
    });

    if (!link || link.status !== LinkStatus.ACTIVE) {
      throw new ForbiddenException('Você não possui vínculo ativo com esta paciente.');
    }
  }

  /** Lança ForbiddenException se a paciente autenticada não for a dona do recurso. */
  assertPatientOwnsResource(user: AuthenticatedUser, resourcePatientProfileId: string): void {
    if (user.role !== Role.PATIENT || user.patientProfileId !== resourcePatientProfileId) {
      throw new ForbiddenException('Você só pode acessar seus próprios dados.');
    }
  }

  /**
   * Regra combinada usada nos endpoints de exame/imagem:
   * - PATIENT só acessa o próprio recurso (e nunca a imagem térmica em si).
   * - DOCTOR só acessa se tiver vínculo ativo com a paciente do exame.
   * - ADMIN é bloqueado por padrão (uso apenas administrativo, não clínico).
   */
  async assertCanAccessPatientRecord(
    user: AuthenticatedUser,
    patientProfileId: string,
  ): Promise<void> {
    if (user.role === Role.PATIENT) {
      this.assertPatientOwnsResource(user, patientProfileId);
      return;
    }

    if (user.role === Role.DOCTOR) {
      await this.assertDoctorHasActiveLink(user.userId, patientProfileId);
      return;
    }

    throw new ForbiddenException('Perfil sem permissão para acessar dados clínicos da paciente.');
  }

  /**
   * Acesso ao CADASTRO (não clínico) da paciente: ADMIN sempre pode (gestão de usuários),
   * DOCTOR precisa de vínculo ativo, PATIENT só o próprio. Use esta função em
   * PatientsService — nunca em ExaminationsModule/ThermalImagesModule, onde ADMIN
   * deve continuar bloqueado por padrão.
   */
  async assertCanAccessPatientProfile(
    user: AuthenticatedUser,
    patientProfileId: string,
  ): Promise<void> {
    if (user.role === Role.ADMIN) return;
    await this.assertCanAccessPatientRecord(user, patientProfileId);
  }

  async getPatientProfileIdOrThrow(userId: string): Promise<string> {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Perfil de paciente não encontrado.');
    return profile.id;
  }

  async getDoctorProfileIdOrThrow(userId: string): Promise<string> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Perfil de médico não encontrado.');
    return profile.id;
  }
}
