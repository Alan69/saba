// Создаёт (или обновляет пароль) супер-администратора платформы.
// Запуск: SUPERADMIN_PHONE=+7... SUPERADMIN_PASSWORD=... node prisma/create-superadmin.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const PLATFORM_SLUG = 'saba-platform';
const CLOSED = { enabled: false, start: '00:00', end: '00:00' };

async function main() {
  const phone = process.env.SUPERADMIN_PHONE;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME || 'Супер-админ';
  if (!phone || !password) throw new Error('Нужны SUPERADMIN_PHONE и SUPERADMIN_PASSWORD');
  if (!/^\+?[0-9]{10,15}$/.test(phone)) throw new Error('Неверный формат телефона');
  if (password.length < 8) throw new Error('Пароль минимум 8 символов');

  const prisma = new PrismaClient();
  try {
    const company =
      (await prisma.company.findUnique({ where: { slug: PLATFORM_SLUG } })) ??
      (await prisma.company.create({
        data: {
          name: 'Saba Platform',
          slug: PLATFORM_SLUG,
          mode: 'frozen', // служебный тенант, записи в нём не ведутся
          workingHours: { mon: CLOSED, tue: CLOSED, wed: CLOSED, thu: CLOSED, fri: CLOSED, sat: CLOSED, sun: CLOSED },
        },
      }));

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { phone },
      update: { passwordHash, role: 'superadmin', companyId: company.id, deletedAt: null },
      create: { phone, passwordHash, name, role: 'superadmin', companyId: company.id },
    });
    console.log(`Супер-админ готов: ${user.phone} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
