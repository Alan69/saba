-- AlterEnum: платформенная роль супер-администратора
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'superadmin';
