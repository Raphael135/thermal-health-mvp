import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { DeviceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** ADMIN registra um novo dispositivo. O segredo é retornado uma única vez. */
  async create(hardwareId: string, name?: string) {
    const existing = await this.prisma.device.findUnique({ where: { hardwareId } });
    if (existing) throw new ConflictException('Dispositivo já cadastrado.');

    const secret = randomBytes(24).toString('hex');
    const secretHash = await argon2.hash(secret);

    const device = await this.prisma.device.create({
      data: { hardwareId, name, secretHash },
    });

    return { device, secret }; // secret só existe nesta resposta — não é persistido em claro
  }

  async listAll() {
    return this.prisma.device.findMany({
      select: {
        id: true,
        hardwareId: true,
        name: true,
        status: true,
        ownerPatientId: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  }

  async setStatus(deviceId: string, status: DeviceStatus) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Dispositivo não encontrado.');
    return this.prisma.device.update({ where: { id: deviceId }, data: { status } });
  }

  async linkToPatient(deviceId: string, patientProfileId: string | null) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Dispositivo não encontrado.');
    return this.prisma.device.update({ where: { id: deviceId }, data: { ownerPatientId: patientProfileId } });
  }

  /** Usado pelo DeviceAuthGuard para autenticar requisições vindas do ESP32. */
  async validateCredentials(hardwareId: string, secret: string) {
    const device = await this.prisma.device.findUnique({ where: { hardwareId } });
    if (!device || device.status !== DeviceStatus.ACTIVE) {
      throw new UnauthorizedException('Dispositivo inválido, inativo ou bloqueado.');
    }

    const valid = await argon2.verify(device.secretHash, secret);
    if (!valid) throw new UnauthorizedException('Credenciais de dispositivo inválidas.');

    await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

    return device;
  }
}
