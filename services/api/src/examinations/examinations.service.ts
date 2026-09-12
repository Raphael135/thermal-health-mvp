import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Device, ExaminationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AccessControlService } from '../common/access-control.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateThermalCaptureDto } from './dto/create-thermal-capture.dto';

// Campos seguros para retornar à PACIENTE — nunca inclui matriz bruta, min/max/avg ou storageKey.
const PATIENT_SAFE_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
  device: { select: { name: true, hardwareId: true } },
  medicalObservations: {
    where: { releasedToPatient: true },
    select: { id: true, note: true, createdAt: true, doctor: { select: { fullName: true } } },
  },
} as const;

@Injectable()
export class ExaminationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly accessControl: AccessControlService,
  ) {}

  /** Chamado a partir do endpoint autenticado por DeviceAuthGuard. */
  async createFromDeviceCapture(device: Device, dto: CreateThermalCaptureDto) {
    if (!device.ownerPatientId) {
      throw new ForbiddenException('Dispositivo ainda não está vinculado a nenhuma paciente.');
    }
    if (device.ownerPatientId !== dto.patientId) {
      throw new ForbiddenException('Este dispositivo não está vinculado a esta paciente.');
    }
    if (dto.temperatures.length !== dto.width * dto.height) {
      throw new BadRequestException('O tamanho da matriz de temperaturas não bate com width*height.');
    }

    const examination = await this.prisma.examination.create({
      data: {
        patientId: dto.patientId,
        deviceId: device.id,
        status: ExaminationStatus.RECEIVED,
        thermalCapture: {
          create: {
            width: dto.width,
            height: dto.height,
            unit: dto.unit,
            rawTemperatures: dto.temperatures,
            capturedAt: new Date(dto.capturedAt),
          },
        },
      },
      include: { thermalCapture: true },
    });

    await this.queueService.enqueueThermalProcessing({
      examinationId: examination.id,
      thermalCaptureId: examination.thermalCapture!.id,
    });

    return { id: examination.id, status: examination.status, createdAt: examination.createdAt };
  }

  async listForPatient(patientProfileId: string) {
    return this.prisma.examination.findMany({
      where: { patientId: patientProfileId },
      select: PATIENT_SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForPatient(user: AuthenticatedUser, examinationId: string) {
    const examination = await this.prisma.examination.findUnique({
      where: { id: examinationId },
      select: { ...PATIENT_SAFE_SELECT, patientId: true },
    });
    if (!examination) throw new NotFoundException('Exame não encontrado.');
    this.accessControl.assertPatientOwnsResource(user, examination.patientId);
    return examination;
  }

  /** Visão do médico: metadados completos do exame, SEM a imagem (isso é ThermalImagesModule). */
  async listForDoctor(user: AuthenticatedUser, patientProfileId: string) {
    await this.accessControl.assertDoctorHasActiveLink(user.userId, patientProfileId);

    return this.prisma.examination.findMany({
      where: { patientId: patientProfileId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        thermalCapture: { select: { minTemp: true, maxTemp: true, avgTemp: true, capturedAt: true } },
        symptomReports: { select: { id: true, description: true, severity: true, reportedAt: true } },
        medicalObservations: { select: { id: true, note: true, releasedToPatient: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForDoctor(user: AuthenticatedUser, examinationId: string) {
    const examination = await this.prisma.examination.findUnique({
      where: { id: examinationId },
      include: {
        thermalCapture: { select: { minTemp: true, maxTemp: true, avgTemp: true, capturedAt: true, storageKey: true } },
        symptomReports: true,
        medicalObservations: { include: { doctor: { select: { fullName: true } } } },
      },
    });
    if (!examination) throw new NotFoundException('Exame não encontrado.');
    await this.accessControl.assertDoctorHasActiveLink(user.userId, examination.patientId);

    // A chave do storage nunca deve vazar para fora — apenas indicamos se há imagem disponível.
    const { thermalCapture, ...rest } = examination;
    return {
      ...rest,
      thermalCapture: thermalCapture
        ? { ...thermalCapture, storageKey: undefined, hasImage: Boolean(thermalCapture.storageKey) }
        : null,
    };
  }

  /** Usado internamente pelo worker de processamento. */
  async markProcessed(
    examinationId: string,
    thermalCaptureId: string,
    result: { minTemp: number; maxTemp: number; avgTemp: number; storageBucket: string; storageKey: string },
  ) {
    await this.prisma.$transaction([
      this.prisma.thermalCapture.update({
        where: { id: thermalCaptureId },
        data: {
          minTemp: result.minTemp,
          maxTemp: result.maxTemp,
          avgTemp: result.avgTemp,
          storageBucket: result.storageBucket,
          storageKey: result.storageKey,
          processedAt: new Date(),
        },
      }),
      this.prisma.examination.update({
        where: { id: examinationId },
        data: { status: ExaminationStatus.PROCESSED },
      }),
    ]);
  }

  async markFailed(examinationId: string, reason: string) {
    await this.prisma.examination.update({
      where: { id: examinationId },
      data: { status: ExaminationStatus.FAILED, failureReason: reason },
    });
  }

  async markProcessing(examinationId: string) {
    await this.prisma.examination.update({
      where: { id: examinationId },
      data: { status: ExaminationStatus.PROCESSING },
    });
  }
}
