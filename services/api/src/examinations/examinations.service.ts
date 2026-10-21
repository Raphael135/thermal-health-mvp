import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

const DEMO_WIDTH = 32;
const DEMO_HEIGHT = 24;
const DEMO_EXAMINATIONS_PER_PATIENT = 10;

// Quadro térmico FALSO (fundo ~32 °C, uma região mais quente em posição aleatória e ruído),
// no mesmo formato do MLX90640. Não representa nenhuma medição real.
function generateDemoMatrix(width: number, height: number): number[] {
  const baseline = 31 + Math.random();
  const hotX = width * (0.3 + Math.random() * 0.4);
  const hotY = height * (0.3 + Math.random() * 0.4);
  const values: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distance = Math.hypot(x - hotX, y - hotY);
      const hotspot = Math.max(0, 4 - distance * 0.35);
      const noise = (Math.random() - 0.5) * 0.6;
      values.push(Number((baseline + hotspot + noise).toFixed(2)));
    }
  }
  return values;
}

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

    return this.createExamination(dto.patientId, device.id, {
      width: dto.width,
      height: dto.height,
      unit: dto.unit,
      temperatures: dto.temperatures,
      capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
    });
  }

  /**
   * Captura de DEMONSTRAÇÃO, sem aparelho: gera uma matriz térmica sintética para a paciente
   * logada e segue o mesmo caminho de uma captura real (fila, worker, processador). Só existe
   * com ALLOW_DEMO_CAPTURE=true; serve para testar o app antes de haver hardware.
   */
  async createDemoExamination(patientProfileId: string) {
    if (process.env.ALLOW_DEMO_CAPTURE !== 'true') {
      throw new NotFoundException();
    }

    const existing = await this.prisma.examination.count({
      where: { patientId: patientProfileId, deviceId: null },
    });
    if (existing >= DEMO_EXAMINATIONS_PER_PATIENT) {
      throw new HttpException(
        `Limite de ${DEMO_EXAMINATIONS_PER_PATIENT} exames de demonstração por paciente atingido.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.createExamination(patientProfileId, null, {
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      unit: 'celsius',
      temperatures: generateDemoMatrix(DEMO_WIDTH, DEMO_HEIGHT),
      capturedAt: new Date(),
    });
  }

  private async createExamination(
    patientId: string,
    deviceId: string | null,
    capture: { width: number; height: number; unit: string; temperatures: number[]; capturedAt: Date },
  ) {
    const examination = await this.prisma.examination.create({
      data: {
        patientId,
        deviceId,
        status: ExaminationStatus.RECEIVED,
        thermalCapture: {
          create: {
            width: capture.width,
            height: capture.height,
            unit: capture.unit,
            rawTemperatures: capture.temperatures,
            capturedAt: capture.capturedAt,
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
