import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AccessControlService } from '../common/access-control.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class ThermalImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly accessControl: AccessControlService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Única porta de entrada para visualizar a imagem térmica. Só DOCTOR com vínculo
   * ativo com a paciente do exame chega até aqui (garantido pelo controller + guard de role).
   * Toda chamada bem-sucedida gera um AuditLog — não é opcional.
   */
  async getSignedImageUrl(
    user: AuthenticatedUser,
    examinationId: string,
    ipAddress: string | null,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const examination = await this.prisma.examination.findUnique({
      where: { id: examinationId },
      include: { thermalCapture: true },
    });
    if (!examination || !examination.thermalCapture?.storageKey) {
      throw new NotFoundException('Imagem térmica ainda não disponível para este exame.');
    }

    await this.accessControl.assertDoctorHasActiveLink(user.userId, examination.patientId);

    const expiresInSeconds = Number(process.env.SIGNED_URL_EXPIRES_IN_SECONDS ?? 300);
    const url = this.storageService.getSignedUrl(examination.thermalCapture.storageKey, expiresInSeconds);

    await this.auditLogService.record({
      userId: user.userId,
      action: 'THERMAL_IMAGE_VIEW',
      resourceType: 'Examination',
      resourceId: examinationId,
      ipAddress,
      metadata: { patientId: examination.patientId },
    });

    return { url, expiresInSeconds };
  }
}
