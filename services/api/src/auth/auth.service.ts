import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterDoctorDto } from './dto/register-doctor.dto';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async registerPatient(dto: RegisterPatientDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('E-mail já cadastrado.');

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: Role.PATIENT,
        patientProfile: {
          create: {
            fullName: dto.fullName,
            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
            phone: dto.phone,
          },
        },
      },
      include: { patientProfile: true },
    });

    return this.issueTokensForUser(user.id, user.email, user.role);
  }

  async registerDoctor(dto: RegisterDoctorDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('E-mail já cadastrado.');

    const existingCrm = await this.prisma.doctorProfile.findUnique({ where: { crm: dto.crm } });
    if (existingCrm) throw new ConflictException('CRM já cadastrado.');

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: Role.DOCTOR,
        doctorProfile: {
          create: {
            fullName: dto.fullName,
            crm: dto.crm,
            specialty: dto.specialty,
          },
        },
      },
      include: { doctorProfile: true },
    });

    return this.issueTokensForUser(user.id, user.email, user.role);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas ou conta desativada.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.issueTokensForUser(user.id, user.email, user.role);
  }

  /**
   * Login SEM senha, só para acelerar testes manuais locais. Só funciona com
   * ALLOW_DEV_LOGIN=true no .env — nunca deve ser habilitado em produção.
   * Ver docs/DECISIONS.md.
   */
  async devLogin(email: string): Promise<TokenPair> {
    if (process.env.ALLOW_DEV_LOGIN !== 'true') {
      throw new ForbiddenException('Login de desenvolvimento desabilitado (ALLOW_DEV_LOGIN != true).');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (!user.isActive) throw new UnauthorizedException('Conta desativada.');

    return this.issueTokensForUser(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; jti: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const tokenHash = this.hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { id: payload.jti, userId: payload.sub, tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou já utilizado.');
    }

    // Rotação: revoga o token usado e emite um novo par.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    if (!user.isActive) throw new UnauthorizedException('Conta desativada.');

    return this.issueTokensForUser(user.id, user.email, user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<{ sub: string; jti: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti, userId: payload.sub },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Token já inválido/expirado — nada a revogar.
    }
  }

  private async issueTokensForUser(userId: string, email: string, role: Role): Promise<TokenPair> {
    const patientProfile =
      role === Role.PATIENT
        ? await this.prisma.patientProfile.findUnique({ where: { userId } })
        : null;
    const doctorProfile =
      role === Role.DOCTOR
        ? await this.prisma.doctorProfile.findUnique({ where: { userId } })
        : null;

    const accessToken = this.jwtService.sign(
      {
        sub: userId,
        email,
        role,
        patientProfileId: patientProfile?.id,
        doctorProfileId: doctorProfile?.id,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      },
    );

    const jti = randomUUID();
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
    const refreshToken = this.jwtService.sign(
      { sub: userId, jti },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: refreshExpiresIn },
    );

    const decoded = this.jwtService.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
