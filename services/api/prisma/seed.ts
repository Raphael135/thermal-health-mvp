import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@thermal-health.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log('Admin já existe, pulando seed.');
    return;
  }

  // Em ambiente exposto, defina SEED_ADMIN_PASSWORD; o padrão é só para uso local.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const passwordHash = await argon2.hash(adminPassword);
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(
    process.env.SEED_ADMIN_PASSWORD
      ? `Admin criado: ${adminEmail} (senha vinda de SEED_ADMIN_PASSWORD)`
      : `Admin criado: ${adminEmail} / senha: Admin@12345 (padrão local; NÃO use em ambiente exposto)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
