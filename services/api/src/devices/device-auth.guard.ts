import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { DevicesService } from './devices.service';

/**
 * Autentica requisições do próprio ESP32 (não um usuário humano).
 * Espera os headers: x-device-id (hardwareId) e x-device-secret.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly devicesService: DevicesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const hardwareId = request.headers['x-device-id'];
    const secret = request.headers['x-device-secret'];

    if (!hardwareId || !secret) {
      throw new UnauthorizedException('Credenciais de dispositivo ausentes.');
    }

    const device = await this.devicesService.validateCredentials(
      String(hardwareId),
      String(secret),
    );
    request.device = device;
    return true;
  }
}
