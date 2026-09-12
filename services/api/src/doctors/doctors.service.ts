import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnProfile(userId: string) {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Perfil de médico não encontrado.');
    return profile;
  }

  async listAll() {
    return this.prisma.doctorProfile.findMany({
      select: {
        id: true,
        fullName: true,
        crm: true,
        specialty: true,
        createdAt: true,
        user: { select: { email: true, isActive: true } },
      },
    });
  }
}
