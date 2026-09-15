-- AlterTable: bookable specialist fields
ALTER TABLE "employees" ADD COLUMN "avatar_url" TEXT;
ALTER TABLE "employees" ADD COLUMN "job_title" TEXT;
ALTER TABLE "employees" ADD COLUMN "bio" TEXT;
ALTER TABLE "employees" ADD COLUMN "is_bookable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: per-employee weekly schedule
CREATE TABLE "employee_schedules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "weekday" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,

    CONSTRAINT "employee_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_schedules_employee_id_weekday_key" ON "employee_schedules"("employee_id", "weekday");
CREATE INDEX "employee_schedules_company_id_employee_id_idx" ON "employee_schedules"("company_id", "employee_id");

ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
